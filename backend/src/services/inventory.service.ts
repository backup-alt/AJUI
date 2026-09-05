import { Types } from "mongoose";
import { IInventory, Inventory } from "../models/Inventory.js";
import { IMaterial, Material } from "../models/Material.js";
import { Site } from "../models/Site.js";
import { AppError } from "../middleware/errorHandler.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { withRetry } from "../utils/retry.js";
import { dbMutex } from "../utils/db-mutex.js";

function normalized(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function siteKey(siteId?: Types.ObjectId | string, site?: string): string {
  return siteId ? String(siteId) : normalized(site);
}

function applyLatestReceiptState(
  inventory: IInventory,
  material: Pick<IMaterial, "_id" | "status" | "receivedDate">
): void {
  inventory.lastMaterialId = material._id;
  inventory.received = material.status === "Received";
  inventory.receivedDate = inventory.received ? material.receivedDate : undefined;
}

function receiptHistoryEntry(
  material: Pick<
    IMaterial,
    "_id" | "vendor" | "vendorId" | "poNumber" | "status" | "receivedDate" | "createdAt"
  >,
  quantity: number
) {
  return {
    vendor: material.vendor || "",
    vendorId: material.vendorId,
    quantity,
    date: material.createdAt || new Date(),
    poNumber: material.poNumber,
    materialId: material._id,
    received: material.status === "Received",
    receivedDate: material.status === "Received" ? material.receivedDate : undefined,
  };
}

export function inventoryMatchForMaterial(material: Pick<IMaterial, "projectId" | "siteId" | "site" | "name" | "unit">) {
  return {
    projectId: material.projectId,
    siteKey: siteKey(material.siteId, material.site),
    normalizedName: normalized(material.name),
    normalizedUnit: normalized(material.unit),
  };
}

export async function addApprovedMaterialToInventory(
  materialId: Types.ObjectId | string,
  quantity: number,
  updatedBy?: string
) {
  const material = await Material.findById(materialId).lean();
  if (!material) throw new AppError(404, "Material not found");

  const qty = Math.max(0, Number(quantity) || 0);
  if (qty <= 0) return null;

  const match = inventoryMatchForMaterial(material);
  let inventory = await Inventory.findOne(match);
  if (inventory) {
    inventory.approvedQuantity += qty;
    inventory.purchasedQuantity += qty;
    inventory.vendor = material.vendor;
    inventory.vendorId = material.vendorId;
    inventory.poNumber = material.poNumber;
    applyLatestReceiptState(inventory, material);
    inventory.lastUpdatedBy = updatedBy;
    inventory.purchaseHistory = inventory.purchaseHistory || [];
    inventory.purchaseHistory.push(receiptHistoryEntry(material, qty));
  } else {
    inventory = new Inventory({
      projectId: material.projectId,
      projectName: material.projectName,
      clientId: material.clientId,
      clientName: material.clientName,
      siteId: material.siteId,
      site: material.site,
      siteKey: siteKey(material.siteId, material.site),
      name: material.name,
      normalizedName: normalized(material.name),
      unit: material.unit,
      normalizedUnit: normalized(material.unit),
      requestedQuantity: material.requestedQuantity || 0,
      minimumQuantity: 0,
      consumedQuantity: 0,
      approvedQuantity: qty,
      purchasedQuantity: qty,
      vendor: material.vendor,
      vendorId: material.vendorId,
      poNumber: material.poNumber,
      lastMaterialId: material._id,
      lastUpdatedBy: updatedBy,
      received: material.status === "Received",
      receivedDate: material.status === "Received" ? material.receivedDate : undefined,
      purchaseHistory: [{
        vendor: material.vendor || "",
        vendorId: material.vendorId,
        quantity: qty,
        date: new Date(),
        poNumber: material.poNumber,
        materialId: material._id,
        received: material.status === "Received",
        receivedDate: material.status === "Received" ? material.receivedDate : undefined,
      }],
    });
  }
  if (!inventory) return null;
  inventory.remainingStock = Math.max(0, inventory.purchasedQuantity - inventory.consumedQuantity);
  await inventory.save();
  return inventory;
}

/**
 * Ensure every material request is represented in Inventory immediately.
 * Quantity fields supplied by the web material form are accumulated here,
 * while receipt state still starts from this newest Material document.
 */
export async function ensureMaterialInInventory(
  materialId: Types.ObjectId | string,
  updatedBy?: string
) {
  const material = await Material.findById(materialId).lean();
  if (!material) throw new AppError(404, "Material not found");
  if (!material.projectId) return null;

  const requested = Math.max(0, Number(material.requestedQuantity) || 0);
  const approved = Math.max(0, Number(material.approvedQuantity) || 0);
  const purchased = Math.max(0, Number(material.purchasedQuantity) || 0);
  const match = inventoryMatchForMaterial(material);
  const inventory = await Inventory.findOne(match);
  if (inventory) {
    inventory.requestedQuantity = Math.max(0, Number(inventory.requestedQuantity) || 0) + requested;
    inventory.approvedQuantity = Math.max(0, Number(inventory.approvedQuantity) || 0) + approved;
    inventory.purchasedQuantity = Math.max(0, Number(inventory.purchasedQuantity) || 0) + purchased;
    applyLatestReceiptState(inventory, material);
    inventory.lastUpdatedBy = updatedBy;
    if (purchased > 0 && !inventory.purchaseHistory?.some(
      (entry) => entry.materialId?.toString() === material._id.toString()
    )) {
      inventory.purchaseHistory = inventory.purchaseHistory || [];
      inventory.purchaseHistory.push(receiptHistoryEntry(material, purchased));
    }
    await inventory.save();
    return inventory.toObject();
  }

  const created = await Inventory.create({
    ...match,
    projectName: material.projectName || "Project",
    clientId: material.clientId,
    clientName: material.clientName,
    siteId: material.siteId,
    site: material.site || "",
    name: material.name,
    unit: material.unit,
    requestedQuantity: requested,
    approvedQuantity: approved,
    purchasedQuantity: purchased,
    consumedQuantity: Math.max(0, Number(material.consumedQuantity) || 0),
    minimumQuantity: 0,
    vendor: material.vendor,
    vendorId: material.vendorId,
    poNumber: material.poNumber,
    lastMaterialId: material._id,
    lastUpdatedBy: updatedBy,
    received: material.status === "Received",
    receivedDate: material.status === "Received" ? material.receivedDate : undefined,
    purchaseHistory: purchased > 0 ? [receiptHistoryEntry(material, purchased)] : [],
  });
  return created.toObject();
}

/** Reconcile a PO-created material using its recorded contribution, so repeated
 * saves do not add stock twice. Pending lines may also change name or unit. */
export async function syncPurchaseOrderMaterialInventory(materialId: Types.ObjectId | string, updatedBy?: string) {
  const material = await Material.findById(materialId).lean();
  if (!material?.projectId) return null;
  const previous = await Inventory.findOne({
    projectId: material.projectId,
    "purchaseHistory.materialId": material._id,
  });
  if (!previous) return ensureMaterialInInventory(material._id, updatedBy);

  const entries = (previous.purchaseHistory || []).filter((entry) => String(entry.materialId) === String(material._id));
  const oldQuantity = entries.reduce((total, entry) => total + Number(entry.quantity || 0), 0);
  const quantity = Math.max(0, Number(material.purchasedQuantity) || 0);
  const sameGroup = `${previous.projectId}__${previous.siteKey}__${previous.normalizedName}__${previous.normalizedUnit}` === inventoryKeyForMaterial(material);
  const delta = (sameGroup ? quantity : 0) - oldQuantity;
  previous.requestedQuantity = Math.max(0, previous.requestedQuantity + delta);
  previous.approvedQuantity = Math.max(0, previous.approvedQuantity + delta);
  previous.purchasedQuantity = Math.max(0, previous.purchasedQuantity + delta);
  previous.purchaseHistory = (previous.purchaseHistory || []).filter((entry) => String(entry.materialId) !== String(material._id));
  if (sameGroup) {
    previous.purchaseHistory.push(receiptHistoryEntry(material, quantity));
    previous.vendor = material.vendor;
    previous.vendorId = material.vendorId;
    previous.poNumber = material.poNumber;
    applyLatestReceiptState(previous, material);
  } else if (String(previous.lastMaterialId) === String(material._id)) {
    const latest = previous.purchaseHistory[previous.purchaseHistory.length - 1];
    previous.lastMaterialId = latest?.materialId;
    previous.received = Boolean(latest?.received);
    previous.receivedDate = latest?.receivedDate;
  }
  previous.lastUpdatedBy = updatedBy;
  await previous.save();
  return sameGroup ? previous.toObject() : ensureMaterialInInventory(material._id, updatedBy);
}

export async function syncMaterialReceivedStatus(materialId: Types.ObjectId | string) {
  const material = await Material.findById(materialId).lean();
  if (!material?.projectId) return null;
  const inventory = await Inventory.findOne({
    projectId: material.projectId,
    $or: [
      { lastMaterialId: material._id },
      { "purchaseHistory.materialId": material._id },
      inventoryMatchForMaterial(material),
    ],
  });
  if (!inventory) return null;

  for (const purchase of inventory.purchaseHistory || []) {
    if (purchase.materialId?.toString() === material._id.toString()) {
      purchase.received = material.status === "Received";
      purchase.receivedDate = material.status === "Received" ? material.receivedDate : undefined;
    }
  }

  const latestMaterial = inventory.lastMaterialId?.toString() === material._id.toString()
    ? material
    : inventory.lastMaterialId
      ? await Material.findById(inventory.lastMaterialId).select("_id status receivedDate").lean()
      : null;
  if (latestMaterial) {
    inventory.received = latestMaterial.status === "Received";
    inventory.receivedDate = inventory.received ? latestMaterial.receivedDate : undefined;
  } else {
    inventory.received = false;
    inventory.receivedDate = undefined;
  }
  await inventory.save();
  return inventory.toObject();
}

/**
 * Stock that a supervisor may consume right now. A newly added purchase can
 * remain pending without locking stock from older, already received purchases.
 */
export function receivedRemainingStock(inventory: Pick<
  IInventory,
  "purchaseHistory" | "purchasedQuantity" | "consumedQuantity" | "received"
>): number {
  const history = Array.isArray(inventory.purchaseHistory) ? inventory.purchaseHistory : [];
  if (history.length === 0) {
    return inventory.received
      ? Math.max(0, Number(inventory.purchasedQuantity || 0) - Number(inventory.consumedQuantity || 0))
      : 0;
  }

  const receivedQuantity = history.reduce(
    (total, purchase) => total + (purchase.received ? Math.max(0, Number(purchase.quantity) || 0) : 0),
    0,
  );
  return Math.max(0, receivedQuantity - Math.max(0, Number(inventory.consumedQuantity) || 0));
}

/** Keep Inventory totals and per-addition receipt history aligned after the
 * web app changes the purchased quantity on an existing Material row. */
export async function syncMaterialQuantityChange(
  materialId: Types.ObjectId | string,
  previousPurchasedQuantity: number,
  updatedBy?: string,
) {
  const material = await Material.findById(materialId).lean();
  if (!material?.projectId) return null;

  const nextPurchased = Math.max(0, Number(material.purchasedQuantity) || 0);
  const previousPurchased = Math.max(0, Number(previousPurchasedQuantity) || 0);
  const delta = nextPurchased - previousPurchased;
  if (delta === 0) return Inventory.findOne(inventoryMatchForMaterial(material)).lean();

  const inventory = await Inventory.findOne(inventoryMatchForMaterial(material));
  if (!inventory) return ensureMaterialInInventory(material._id, updatedBy);

  inventory.requestedQuantity = Math.max(0, Number(inventory.requestedQuantity) || 0) + delta;
  inventory.approvedQuantity = Math.max(0, Number(inventory.approvedQuantity) || 0) + delta;
  inventory.purchasedQuantity = Math.max(0, Number(inventory.purchasedQuantity) || 0) + delta;
  inventory.lastMaterialId = material._id;
  inventory.lastUpdatedBy = updatedBy;
  inventory.purchaseHistory = inventory.purchaseHistory || [];

  if (delta > 0) {
    inventory.purchaseHistory.push(receiptHistoryEntry(material, delta));
    inventory.received = false;
    inventory.receivedDate = undefined;
  } else {
    let reduction = Math.abs(delta);
    for (let index = inventory.purchaseHistory.length - 1; index >= 0 && reduction > 0; index -= 1) {
      const purchase = inventory.purchaseHistory[index];
      if (purchase.materialId?.toString() !== material._id.toString()) continue;
      const quantity = Math.max(0, Number(purchase.quantity) || 0);
      const deducted = Math.min(quantity, reduction);
      purchase.quantity = quantity - deducted;
      reduction -= deducted;
    }
    inventory.purchaseHistory = inventory.purchaseHistory.filter((purchase) => Number(purchase.quantity) > 0);
    const latestPurchase = inventory.purchaseHistory[inventory.purchaseHistory.length - 1];
    inventory.received = Boolean(latestPurchase?.received);
    inventory.receivedDate = inventory.received ? latestPurchase?.receivedDate : undefined;
  }

  await inventory.save();
  return inventory.toObject();
}

/**
 * Single-shot "give me everything" endpoint.
 *
 * Strategy: try one big query first. If M0 times out (which happens
 * during cold-start or when the pool is exhausted), transparently fall
 * back to a cursor-paginated walk that pages through 25 rows at a time
 * and always returns data — never throws.
 *
 * Default cap is 500. The 2000 cap on the previous version was the root
 * cause of repeated 503s on /inventory/all.
 */
export async function listAllInventory(_filter?: unknown): Promise<any[]> {
  throw new AppError(410, "Use paginated /inventory?limit=25&page=1");
}

export async function listInventory(filter: {
  projectId?: string;
  siteId?: string;
  search?: string;
  page: number;
  limit: number;
  cursor?: string;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.search) query.name = { $regex: filter.search, $options: "i" };
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  // Cursor-based pagination via _id — uses the _id index for an O(log n)
  // range query instead of the O(n) skip-then-limit pattern that timed
  // out on M0 free tier.
  //
  // Sort is {_id: -1} (descending), so the popped cursor is the SMALLEST
  // _id in the page. Next page needs SMALLER _id values → $lt.
  if (filter.cursor) {
    try {
      query._id = { $lt: new Types.ObjectId(filter.cursor) };
    } catch {
      // Invalid cursor → fall through and start from the beginning
    }
  }

  // Cap default at 25 — Atlas M0 free tier rate-limit/rejection threshold.
  const effectiveLimit = Math.min(Math.max(filter.limit || 200, 1), 200);
  const effectivePage = Math.max(filter.page || 1, 1);
  const skip = filter.cursor ? 0 : (effectivePage - 1) * effectiveLimit;
  type InventoryLike = { [k: string]: unknown };
  let items: InventoryLike[] = [];
  let total = 0;
  let nextCursor: string | null = null;
  let queryFailed = false;
  try {
    const tDb = Date.now();
    if (!filter.cursor && effectivePage === 1) {
      // First page: find + count in a SINGLE dbMutex acquisition.
      const [foundItems, foundTotal] = await dbMutex.run(() =>
        withRetry(async () => {
          const findPromise = Inventory.find(query)
            .select({ receiptImage: 0 })
            .sort({ _id: -1 })
            .skip(skip)
            .limit(effectiveLimit)
            .lean()
            .maxTimeMS(60_000);
          const countPromise = Inventory.countDocuments(query).maxTimeMS(30_000);
          return Promise.all([findPromise, countPromise]) as Promise<[any[], number]>;
        }, { label: "listInventory.find+count" })
      );
      items = foundItems as unknown as InventoryLike[];
      total = foundTotal;
      if (items.length === 0 && total === 0) {
        await backfillApprovedMaterialsToInventory(inventoryQueryToMaterialQuery(query));
        const [repairedItems, repairedTotal] = await dbMutex.run(() =>
          withRetry(async () => {
            const findPromise = Inventory.find(query)
              .select({ receiptImage: 0 })
              .sort({ _id: -1 })
              .limit(effectiveLimit)
              .lean()
              .maxTimeMS(60_000);
            const countPromise = Inventory.countDocuments(query).maxTimeMS(30_000);
            return Promise.all([findPromise, countPromise]) as Promise<[any[], number]>;
          }, { label: "listInventory.repaired.find+count" })
        );
        items = repairedItems as unknown as InventoryLike[];
        total = repairedTotal;
        if (items.length === 0 && total === 0) {
          const materialBacked = await listMaterialBackedInventory(query, effectiveLimit, effectivePage, skip, Boolean(filter.cursor));
          items = materialBacked.items;
          total = materialBacked.total;
        }
      }
      console.log(`[listInventory] dbMutex find+count dt=${Date.now() - tDb}ms items=${items.length} total=${total}`);
    } else {
      const foundItems = await dbMutex.run(() =>
        withRetry(
          () => Inventory.find(query)
            .select({ receiptImage: 0 })
            .sort({ _id: -1 })
            .skip(skip)
            .limit(effectiveLimit)
            .lean()
            .maxTimeMS(60_000),
          { label: "listInventory.find" }
        )
      );
      items = foundItems as unknown as InventoryLike[];
      if (items.length === 0) {
        const materialBacked = await listMaterialBackedInventory(query, effectiveLimit, effectivePage, skip, Boolean(filter.cursor));
        items = materialBacked.items;
      }
      // Avoid a second filtered count on every page. The first page carries
      // the authoritative total; later pages only need continuation data.
      total = items.length < effectiveLimit
        ? skip + items.length
        : skip + effectiveLimit + 1;
      console.log(`[listInventory] dbMutex find dt=${Date.now() - tDb}ms items=${items.length}`);
    }
    // Cursor-based pagination by _id, descending. Sort is {_id: -1} so
    // the last item in the page has the SMALLEST _id in the page. The
    // next page query is `_id < cursor` (already applied above when
    // filter.cursor is set) — the cursor item is NOT re-included.
    //
    // We only emit a nextCursor when the page is full. A short page
    // (< effectiveLimit) means we've reached the end of the collection.
    //
    // Example with 58 items and limit=25:
    //   page 1: items 0..24 (25, full) → cursor = items[24]._id
    //   page 2: items 25..49 (25, full) → cursor = items[49]._id
    //   page 3: items 50..57 (8, short) → nextCursor = null, walk ends
    //   total returned: 58
    if (items.length === effectiveLimit) {
      const lastItem = items[items.length - 1];
      if (lastItem && (lastItem as any)._id) {
        nextCursor = String((lastItem as any)._id);
      }
    }
  } catch (err) {
    console.error(
      "[listInventory] query failed (projectId=%s siteId=%s search=%s scopeLen=%s):",
      String(filter.projectId || ""),
      String(filter.siteId || ""),
      String(filter.search || ""),
      String(filter.scopeProjectIds?.length ?? 0),
      (err as Error)?.message || err
    );
    items = [];
    total = 0;
    queryFailed = true;
  }

  // Inventory.received is a summary of the newest material addition only.
  // Hydrate it from that Material document so legacy rows with an old
  // any-purchase-is-received value cannot show a stale status on the web.
  const latestIds = items
    .map((item) => item["lastMaterialId"])
    .filter((id): id is Types.ObjectId => Boolean(id));
  if (latestIds.length > 0) {
    const latestMaterials = await Material.find({ _id: { $in: latestIds } })
      .select("_id status receivedDate")
      .lean();
    const latestReceiptById = new Map(latestMaterials.map((material) => [
      material._id.toString(),
      { received: material.status === "Received", receivedDate: material.receivedDate },
    ]));
    items = items.map((item) => {
      const latestId = item["lastMaterialId"];
      const latestReceipt = latestId ? latestReceiptById.get(String(latestId)) : undefined;
      const history = Array.isArray(item["purchaseHistory"])
        ? item["purchaseHistory"] as Array<{ materialId?: unknown; received?: boolean; receivedDate?: string }>
        : [];
      const latestHistory = history[history.length - 1];
      const latestLinkedCount = latestId
        ? history.filter((entry) => String(entry.materialId || "") === String(latestId)).length
        : 0;
      if (latestHistory && latestLinkedCount > 1) {
        return {
          ...item,
          received: Boolean(latestHistory.received),
          receivedDate: latestHistory.receivedDate,
        };
      }
      return latestReceipt
        ? { ...item, received: latestReceipt.received, receivedDate: latestReceipt.receivedDate }
        : item;
    });
  }

  return {
    items: items as unknown as IInventory[],
    total,
    page: effectivePage,
    limit: effectiveLimit,
    pages: Math.ceil(total / effectiveLimit),
    nextCursor,
    queryFailed,
  };
}

function inventoryQueryToMaterialQuery(query: Record<string, unknown>): Record<string, unknown> {
  const materialQuery: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === "_id") continue;
    materialQuery[key] = value;
  }
  return materialQuery;
}

async function listMaterialBackedInventory(
  query: Record<string, unknown>,
  effectiveLimit: number,
  effectivePage: number,
  skip: number,
  hasCursor: boolean
): Promise<{ items: any[]; total: number }> {
  const materialQuery = inventoryQueryToMaterialQuery(query);
  if (query._id) materialQuery._id = query._id;
  const foundMaterials = await dbMutex.run(() =>
    withRetry(
      () => Material.find(materialQuery)
        .select("_id projectId projectName clientId clientName siteId site name unit requestedQuantity approvedQuantity purchasedQuantity consumedQuantity remainingStock vendor vendorId poNumber status receivedDate createdAt updatedAt")
        .sort({ _id: -1 })
        .skip(hasCursor ? 0 : skip)
        .limit(effectiveLimit)
        .lean()
        .maxTimeMS(60_000),
      { label: "listInventory.materialFallback.find" }
    )
  );
  const total = !hasCursor && effectivePage === 1
    ? await Material.countDocuments(materialQuery).maxTimeMS(30_000)
    : foundMaterials.length < effectiveLimit
      ? (effectivePage - 1) * effectiveLimit + foundMaterials.length
      : effectivePage * effectiveLimit + 1;
  return {
    items: foundMaterials.map((material: any) => ({
      _id: material._id,
      projectId: material.projectId,
      projectName: material.projectName,
      clientId: material.clientId,
      clientName: material.clientName,
      siteId: material.siteId,
      site: material.site,
      siteKey: siteKey(material.siteId, material.site),
      name: material.name,
      normalizedName: normalized(material.name),
      unit: material.unit,
      normalizedUnit: normalized(material.unit),
      requestedQuantity: Number(material.requestedQuantity) || 0,
      approvedQuantity: Number(material.approvedQuantity) || 0,
      purchasedQuantity: Number(material.purchasedQuantity) || 0,
      consumedQuantity: Number(material.consumedQuantity) || 0,
      remainingStock: material.remainingStock ?? Math.max(0, (Number(material.purchasedQuantity) || 0) - (Number(material.consumedQuantity) || 0)),
      minimumQuantity: 0,
      vendor: material.vendor,
      vendorId: material.vendorId,
      poNumber: material.poNumber,
      received: material.status === "Received",
      receivedDate: material.receivedDate,
      lastMaterialId: material._id,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
    })),
    total,
  };
}

export async function backfillApprovedMaterialsToInventory(materialQuery: Record<string, unknown>) {
  const t0 = Date.now();
  const batchSize = 25;
  const grouped = new Map<string, {
    material: any;
    requested: number;
    approved: number;
    purchased: number;
    consumed: number;
    received: boolean;
    receivedDate?: string;
    history: any[];
  }>();
  let cursor: Types.ObjectId | undefined;
  let scanned = 0;

  try {
    while (true) {
      const pageQuery: Record<string, unknown> = { ...materialQuery };
      if (cursor) pageQuery._id = { $gt: cursor };

      const materials = await withRetry(
        () => Material.find(pageQuery)
          .select("_id projectId projectName clientId clientName siteId site name unit requestedQuantity approvedQuantity purchasedQuantity consumedQuantity vendor vendorId poNumber status receivedDate createdBy createdAt updatedAt")
          .sort({ _id: 1 })
          .limit(batchSize)
          .lean()
          .maxTimeMS(30_000),
        { label: "backfillInventory.materials" }
      );

      for (const material of materials) {
        if (!material.projectId) continue;
        const requested = Math.max(0, Number(material.requestedQuantity) || 0);
        const approved = Math.max(0, Number(material.approvedQuantity) || 0);
        const purchased = Math.max(0, Number(material.purchasedQuantity) || 0);

        const key = inventoryKeyForMaterial(material);
        const current = grouped.get(key);
        const history = {
          vendor: material.vendor || "",
          vendorId: material.vendorId,
          quantity: purchased,
          date: material.updatedAt || material.createdAt || new Date(),
          poNumber: material.poNumber,
          materialId: material._id,
          received: material.status === "Received",
          receivedDate: material.status === "Received" ? material.receivedDate : undefined,
        };
        if (current) {
          current.material = material;
          current.requested += requested;
          current.approved += approved;
          current.purchased += purchased;
          current.consumed += Number(material.consumedQuantity) || 0;
          // Materials are scanned oldest-to-newest, so the group status must
          // follow this latest addition rather than any earlier receipt.
          current.received = material.status === "Received";
          current.receivedDate = current.received ? material.receivedDate : undefined;
          current.history.push(history);
        } else {
          grouped.set(key, {
            material,
            requested,
            approved,
            purchased,
            consumed: Number(material.consumedQuantity) || 0,
            received: material.status === "Received",
            receivedDate: material.receivedDate,
            history: [history],
          });
        }
      }

      scanned += materials.length;
      if (materials.length < batchSize) break;
      cursor = materials[materials.length - 1]._id;
    }
  } catch (err) {
    console.warn("[backfill] paginated Material.find failed:", (err as Error).message);
    return { scanned, inserted: 0 };
  }

  if (grouped.size === 0) {
    console.log("[backfill] no eligible materials matched; nothing to backfill");
    return { scanned, inserted: 0 };
  }

  const groups = [...grouped.values()];
  const existingKeys = new Set<string>();
  for (let i = 0; i < groups.length; i += batchSize) {
    const chunk = groups.slice(i, i + batchSize);
    const existing = await withRetry(
      () => Inventory.find({ $or: chunk.map(({ material }) => inventoryMatchForMaterial(material)) })
        .select("projectId siteKey normalizedName normalizedUnit")
        .lean()
        .maxTimeMS(30_000),
      { label: "backfillInventory.existing" }
    );
    for (const inventory of existing) {
      existingKeys.add(`${inventory.projectId}__${inventory.siteKey}__${inventory.normalizedName}__${inventory.normalizedUnit}`);
    }
  }

  const missing = groups.filter(({ material }) => !existingKeys.has(inventoryKeyForMaterial(material)));
  let inserted = 0;
  for (let i = 0; i < missing.length; i += batchSize) {
    const operations = missing.slice(i, i + batchSize).map(
      ({ material, requested, approved, purchased, consumed, received, receivedDate, history }) => {
        const match = inventoryMatchForMaterial(material);
        return {
          updateOne: {
            filter: match,
            update: {
              $setOnInsert: {
                ...match,
                projectName: material.projectName || "Project",
                clientId: material.clientId,
                clientName: material.clientName,
                siteId: material.siteId,
                site: material.site || "",
                name: material.name,
                unit: material.unit,
                requestedQuantity: requested,
                approvedQuantity: approved,
                purchasedQuantity: purchased,
                consumedQuantity: consumed,
                remainingStock: Math.max(0, purchased - consumed),
                minimumQuantity: 0,
                vendor: material.vendor,
                vendorId: material.vendorId,
                poNumber: material.poNumber,
                lastMaterialId: material._id,
                received,
                receivedDate,
                purchaseHistory: history.filter((entry) => entry.quantity > 0),
              },
            },
            upsert: true,
          },
        };
      }
    );
    const result = await Inventory.bulkWrite(operations, { ordered: false });
    inserted += result.upsertedCount ?? 0;
  }

  console.log(`[backfill] scanned ${scanned} materials and inserted ${inserted}/${missing.length} missing inventory records in ${Date.now() - t0}ms`);
  return { scanned, inserted };
}

export async function adjustInventoryStock(
  id: string,
  updates: { purchasedQuantity?: number; consumedQuantity?: number },
  updatedBy?: string
) {
  const inventory = await Inventory.findById(id);
  if (!inventory) throw new AppError(404, "Inventory item not found");

  if (updates.purchasedQuantity !== undefined) {
    inventory.purchasedQuantity = Math.max(0, inventory.purchasedQuantity + updates.purchasedQuantity);
    inventory.approvedQuantity = Math.max(inventory.approvedQuantity, inventory.purchasedQuantity);
  }
  if (updates.consumedQuantity !== undefined) {
    inventory.consumedQuantity = Math.max(0, inventory.consumedQuantity + updates.consumedQuantity);
  }
  inventory.lastUpdatedBy = updatedBy;
  await inventory.save();

  if (inventory.lastMaterialId) {
    await Material.updateOne(
      { _id: inventory.lastMaterialId },
      {
        purchasedQuantity: inventory.purchasedQuantity,
        consumedQuantity: inventory.consumedQuantity,
        remainingStock: inventory.remainingStock,
      }
    );
  }

  return inventory.toObject();
}

export async function uploadInventoryReceipt(
  id: string,
  payload: { data: string; mimeType: string; fileName?: string; givenAmount?: number; received?: boolean }
) {
  const inventory = await Inventory.findById(id);
  if (!inventory) throw new AppError(404, "Inventory item not found");

  const { uploadToPCloud } = await import("./pcloud.service.js");

  try {
    const pcloudResult = await uploadToPCloud(
      payload.data,
      payload.fileName || `receipt_inv_${inventory.name.replace(/\s+/g, "_")}.${payload.mimeType.split("/")[1] || "jpg"}`,
      payload.mimeType
    );
    inventory.billUrl = pcloudResult.mediaUrl;
    inventory.pcloudFileId = pcloudResult.fileId;
    inventory.pcloudPublicCode = pcloudResult.publicCode;
    inventory.receiptImageName = pcloudResult.fileName;
    inventory.receiptImage = undefined;
    inventory.receiptImageMimeType = undefined;
  } catch (err) {
    console.error("[pCloud] Upload failed for inventory item:", err);
    throw new AppError(503, "Bill upload failed. Please retry after pCloud is available.");
  }

  if (payload.givenAmount !== undefined) {
    inventory.received = true;
  } else if (payload.received !== undefined) {
    inventory.received = payload.received;
  }
  if (inventory.received) inventory.receivedDate = new Date().toISOString().slice(0, 10);

  await inventory.save();

  if (inventory.billUrl) {
    try {
      const { Material } = await import("../models/Material.js");
      const pcloudUpdate = {
        $set: {
          billUrl: inventory.billUrl,
          pcloudFileId: inventory.pcloudFileId,
          pcloudPublicCode: inventory.pcloudPublicCode,
          ...(inventory.received ? { status: "Received", receivedDate: inventory.receivedDate } : {}),
        },
        $unset: { receiptImage: "", receiptImageMimeType: "" },
      };
      if (inventory.lastMaterialId) {
        await Material.updateOne({ _id: inventory.lastMaterialId }, pcloudUpdate);
      } else {
        await Material.updateOne(
          { projectId: inventory.projectId, name: inventory.name, unit: inventory.unit },
          pcloudUpdate
        );
      }
    } catch (err) {
      console.warn("[Inventory] Failed to propagate billUrl to Material:", err);
    }
  }

  return inventory.toObject();
}

export async function inventoryStockMapForMaterials(materials: Array<Pick<IMaterial, "projectId" | "siteId" | "site" | "name" | "unit">>) {
  if (materials.length === 0) return new Map<string, number>();
  const ors = materials.map(inventoryMatchForMaterial);
  const inventory = await Inventory.find({ $or: ors }).lean();
  return new Map(inventory.map((item) => [
    `${item.projectId}__${item.siteKey}__${item.normalizedName}__${item.normalizedUnit}`,
    item.remainingStock,
  ]));
}

export function inventoryKeyForMaterial(material: Pick<IMaterial, "projectId" | "siteId" | "site" | "name" | "unit">) {
  const match = inventoryMatchForMaterial(material);
  return `${match.projectId}__${match.siteKey}__${match.normalizedName}__${match.normalizedUnit}`;
}

export async function getMissingMaterialsForSite(siteId: string) {
  const site = await Site.findById(siteId).lean();
  if (!site) throw new AppError(404, "Site not found");

  const allMaterials = await Material.find({
    siteId: new Types.ObjectId(siteId),
    status: { $in: ["Approved", "Received", "Completed", "Not Received"] },
  }).lean();

  if (allMaterials.length === 0) return { materials: [], site };

  const ors = allMaterials.map(inventoryMatchForMaterial);
  const existingInventory = await Inventory.find({ $or: ors }).lean();
  const existingKeys = new Set(
    existingInventory.map((item) =>
      `${item.projectId}__${item.siteKey}__${item.normalizedName}__${item.normalizedUnit}`
    )
  );

  const missing = allMaterials.filter((m) => {
    const key = inventoryKeyForMaterial(m);
    return !existingKeys.has(key);
  });

  return {
    site,
    materials: missing.map((m) => ({
      _id: m._id,
      materialId: m.materialId,
      name: m.name,
      unit: m.unit,
      projectId: m.projectId,
      projectName: m.projectName,
      vendor: m.vendor,
      poNumber: m.poNumber,
      purchasedQuantity: m.purchasedQuantity,
      consumedQuantity: m.consumedQuantity,
      approvedQuantity: m.approvedQuantity,
    })),
  };
}

export async function initializeSiteInventory(
  siteId: string,
  items: Array<{ materialId: string; quantity: number }>,
  updatedBy?: string
) {
  const site = await Site.findById(siteId).lean();
  if (!site) throw new AppError(404, "Site not found");

  const results: Array<{ materialId: string; inventory: unknown; created: boolean }> = [];

  for (const item of items) {
    const material = await Material.findById(item.materialId).lean();
    if (!material) throw new AppError(404, `Material ${item.materialId} not found`);

    const qty = Math.max(0, Number(item.quantity) || 0);
    if (qty <= 0) continue;

    const match = inventoryMatchForMaterial(material);
    const existing = await Inventory.findOne(match);
    if (existing) {
      existing.purchasedQuantity += qty;
      existing.approvedQuantity = Math.max(existing.approvedQuantity, existing.purchasedQuantity);
      existing.lastUpdatedBy = updatedBy;
      applyLatestReceiptState(existing, material);
      existing.purchaseHistory = existing.purchaseHistory || [];
      existing.purchaseHistory.push({
        vendor: material.vendor || "",
        vendorId: material.vendorId,
        quantity: qty,
        date: new Date(),
        poNumber: material.poNumber,
        materialId: material._id,
        received: material.status === "Received",
        receivedDate: material.status === "Received" ? material.receivedDate : undefined,
      });
      existing.remainingStock = Math.max(0, existing.purchasedQuantity - existing.consumedQuantity);
      await existing.save();
      results.push({ materialId: item.materialId, inventory: existing.toObject(), created: false });
    } else {
      const inventory = new Inventory({
        projectId: material.projectId,
        projectName: material.projectName,
        clientId: material.clientId,
        clientName: material.clientName,
        siteId: material.siteId,
        site: material.site || site.name,
        siteKey: siteKey(material.siteId || siteId, material.site || site.name),
        name: material.name,
        normalizedName: normalized(material.name),
        unit: material.unit,
        normalizedUnit: normalized(material.unit),
        requestedQuantity: material.requestedQuantity || 0,
        minimumQuantity: 0,
        consumedQuantity: 0,
        approvedQuantity: qty,
        purchasedQuantity: qty,
        vendor: material.vendor,
        vendorId: material.vendorId,
        poNumber: material.poNumber,
        lastMaterialId: material._id,
        lastUpdatedBy: updatedBy,
        received: material.status === "Received",
        receivedDate: material.status === "Received" ? material.receivedDate : undefined,
        purchaseHistory: [{
          vendor: material.vendor || "",
          vendorId: material.vendorId,
          quantity: qty,
          date: new Date(),
          poNumber: material.poNumber,
          materialId: material._id,
          received: material.status === "Received",
          receivedDate: material.status === "Received" ? material.receivedDate : undefined,
        }],
      });
      await inventory.save();
      results.push({ materialId: item.materialId, inventory: inventory.toObject(), created: true });
    }
  }

  return { site, results };
}

export async function addInventoryMaterial(
  input: {
    siteId: string;
    projectId?: string;
    name: string;
    unit: string;
    quantity?: number;
    isExistingMaterial?: boolean;
    issuedAmount?: number;
    givenAmount?: number;
    minimumStock?: number;
    remarks?: string;
    requestDate?: string;
  },
  updatedBy?: string
) {
  const site = await Site.findById(input.siteId).lean();
  if (!site) throw new AppError(404, "Site not found");

  const trimmedName = String(input.name || "").trim();
  const trimmedUnit = String(input.unit || "").trim();
  if (!trimmedName) throw new AppError(400, "Material name is required");
  if (!trimmedUnit) throw new AppError(400, "Unit is required");

  const normalizedName = normalized(trimmedName);
  const normalizedUnit = normalized(trimmedUnit);
  const siteObjectId = new Types.ObjectId(input.siteId);
  const siteKeyValue = siteKey(input.siteId, site.name);

  const { Project } = await import("../models/Project.js");
  let projectId: Types.ObjectId | undefined;
  let projectName: string | undefined;
  let clientId: Types.ObjectId | undefined;
  let clientName: string | undefined;
  const projectIds = (site as any).projectIds || [];
  const requestedProjectId = input.projectId && Types.ObjectId.isValid(input.projectId)
    ? input.projectId
    : projectIds[0];
  if (requestedProjectId) {
    const project = await Project.findById(requestedProjectId).lean();
    if (project) {
      projectId = project._id;
      projectName = project.name;
      if ((project as any).clientId) {
        clientId = (project as any).clientId;
        const { Client } = await import("../models/Client.js");
        const client = await Client.findById(clientId).lean();
        if (client) clientName = (client as any).name;
      }
    }
  }

  const quantity = Math.max(0, Number(input.quantity) || 0);
  const isExistingMaterial = Boolean(input.isExistingMaterial);
  const issuedAmount = isExistingMaterial ? undefined : Math.max(0, Number(input.issuedAmount) || 0);
  const givenAmount = isExistingMaterial ? undefined : Math.max(0, Number(input.givenAmount) || 0);
  const minimumStockRaw = input.minimumStock !== undefined && input.minimumStock !== null
    ? Number(input.minimumStock)
    : undefined;
  const minimumStock = minimumStockRaw !== undefined && !Number.isNaN(minimumStockRaw)
    ? Math.max(0, minimumStockRaw)
    : undefined;
  const remarks = input.remarks ? String(input.remarks).trim() : undefined;
  const requestDate = input.requestDate || new Date().toISOString().slice(0, 10);

  const syncInventory = async (materialId: Types.ObjectId) => {
    const invMatch = {
      projectId: projectId || undefined,
      siteKey: siteKeyValue,
      normalizedName,
      normalizedUnit,
    };
    const existingInv = await Inventory.findOne(invMatch);
    if (existingInv) {
      existingInv.approvedQuantity = Math.max(0, Number(existingInv.approvedQuantity) || 0) + quantity;
      existingInv.purchasedQuantity = Math.max(0, Number(existingInv.purchasedQuantity) || 0) + quantity;
      existingInv.remainingStock = Math.max(0, existingInv.purchasedQuantity - (Number(existingInv.consumedQuantity) || 0));
      if (minimumStock !== undefined) existingInv.minimumQuantity = minimumStock;
      existingInv.lastMaterialId = materialId;
      existingInv.received = false;
      existingInv.receivedDate = undefined;
      existingInv.lastUpdatedBy = updatedBy;
      if (quantity > 0) {
        existingInv.purchaseHistory = existingInv.purchaseHistory || [];
        existingInv.purchaseHistory.push({
          vendor: "",
          quantity,
          date: new Date(),
          materialId,
          received: false,
        });
      }
      await existingInv.save();
      return;
    }

    const inv = new Inventory({
      projectId,
      projectName,
      clientId,
      clientName,
      siteId: siteObjectId,
      site: site.name,
      siteKey: siteKeyValue,
      name: trimmedName,
      normalizedName,
      unit: trimmedUnit,
      normalizedUnit,
      requestedQuantity: quantity,
      approvedQuantity: quantity,
      purchasedQuantity: quantity,
      consumedQuantity: 0,
      remainingStock: quantity,
      minimumQuantity: minimumStock ?? 0,
      lastMaterialId: materialId,
      lastUpdatedBy: updatedBy,
      received: false,
      purchaseHistory: quantity > 0 ? [{
        quantity,
        date: new Date(),
        materialId,
        received: false,
      }] : [],
    });
    await inv.save();
  };

  // Existing stock intentionally updates its original row. A material
  // entered with the toggle off is a new procurement record, even when
  // its name/unit already exists, so its amounts and PO state stay distinct.
  const existing = isExistingMaterial ? await Material.findOne({
    siteId: siteObjectId,
    name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    unit: { $regex: new RegExp(`^${trimmedUnit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  }) : null;

  if (existing) {
    if (quantity > 0) {
      existing.approvedQuantity = Math.max(0, Number(existing.approvedQuantity) || 0) + quantity;
      existing.purchasedQuantity = Math.max(0, Number(existing.purchasedQuantity) || 0) + quantity;
      existing.remainingStock = Math.max(0, existing.purchasedQuantity - (Number(existing.consumedQuantity) || 0));
      // A new addition has its own pending receipt even when it reuses the
      // existing Material row. PurchaseHistory keeps older receipts intact.
      existing.status = "Not Received";
      existing.receivedDate = undefined;
    }
    if (minimumStock !== undefined) {
      (existing as any).minimumQuantity = minimumStock;
    }
    if (remarks) {
      existing.notes = remarks;
    }
    existing.isExistingMaterial = isExistingMaterial;
    existing.issuedAmount = issuedAmount;
    existing.givenAmount = givenAmount;
    (existing as any).createdBy = updatedBy;
    await existing.save();
    await syncInventory(existing._id);
    return { material: existing.toObject(), created: false };
  }

  const { generateId } = await import("./id-generator.service.js");
  const newMaterialId = await generateId("MAT");

  const created = await Material.create({
    materialId: newMaterialId,
    projectId,
    projectName,
    clientId,
    clientName,
    siteId: siteObjectId,
    site: site.name,
    name: trimmedName,
    unit: trimmedUnit,
    requestedQuantity: quantity,
    approvedQuantity: quantity,
    purchasedQuantity: quantity,
    consumedQuantity: 0,
    remainingStock: quantity,
    isExistingMaterial,
    issuedAmount,
    givenAmount,
    ...(minimumStock !== undefined ? { minimumQuantity: minimumStock } : {}),
    status: "Not Received",
    requestDate,
    notes: remarks,
    createdBy: updatedBy,
  });

  // Also create or update Inventory so both project tables stay in sync.
  await syncInventory(created._id);

  return { material: created.toObject(), created: true };
}

let siteIdBackfillDone = false;

export async function backfillMaterialSiteIds(): Promise<void> {
  if (siteIdBackfillDone) return;
  try {
    const materials = await Material.find({ siteId: { $exists: false } }).lean();
    if (materials.length === 0) {
      siteIdBackfillDone = true;
      return;
    }

    const siteNameToId = new Map<string, Types.ObjectId>();
    const sites = await Site.find({}).select("_id name").lean();
    for (const s of sites) {
      if (s.name) siteNameToId.set(s.name.toLowerCase(), s._id);
    }

    const bulkOps: any[] = [];
    for (const m of materials) {
      const siteId = siteNameToId.get((m.site || "").toLowerCase());
      if (siteId) {
        bulkOps.push({ updateOne: { filter: { _id: m._id }, update: { $set: { siteId } } } });
      }
    }

    if (bulkOps.length > 0) {
      await Material.bulkWrite(bulkOps, { ordered: false });
    }

    console.log(`[Startup] backfillMaterialSiteIds: updated ${bulkOps.length}/${materials.length} materials`);
    siteIdBackfillDone = true;
  } catch (err: any) {
    console.error("[Startup] backfillMaterialSiteIds failed (non-fatal):", err?.message || err);
  }
}
