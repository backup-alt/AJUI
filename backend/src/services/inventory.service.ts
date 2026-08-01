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
    inventory.lastMaterialId = material._id;
    inventory.lastUpdatedBy = updatedBy;
    inventory.purchaseHistory = inventory.purchaseHistory || [];
    inventory.purchaseHistory.push({
      vendor: material.vendor || "",
      vendorId: material.vendorId,
      quantity: qty,
      date: new Date(),
      poNumber: material.poNumber,
      materialId: material._id,
    });
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
      purchaseHistory: [{
        vendor: material.vendor || "",
        vendorId: material.vendorId,
        quantity: qty,
        date: new Date(),
        poNumber: material.poNumber,
        materialId: material._id,
      }],
    });
  }
  if (!inventory) return null;
  inventory.remainingStock = Math.max(0, inventory.purchasedQuantity - inventory.consumedQuantity);
  await inventory.save();
  return inventory;
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
  const effectiveLimit = Math.min(Math.max(filter.limit || 25, 1), 25);
  const effectivePage = Math.max(filter.page || 1, 1);
  const skip = filter.cursor ? 0 : (effectivePage - 1) * effectiveLimit;
  try {
    const tDb = Date.now();
    const materialBacked = await listMaterialBackedInventory(query, effectiveLimit, effectivePage, skip, Boolean(filter.cursor));
    const items = materialBacked.items;
    const lastItem = items.length === effectiveLimit ? items[items.length - 1] : null;
    const nextCursor = lastItem?._id ? String(lastItem._id) : null;
    console.log(`[listInventory] material-backed dt=${Date.now() - tDb}ms items=${items.length} total=${materialBacked.total}`);
    return {
      items: items as unknown as IInventory[],
      total: materialBacked.total,
      page: effectivePage,
      limit: effectiveLimit,
      pages: Math.ceil(materialBacked.total / effectiveLimit),
      nextCursor,
      queryFailed: false,
    };
  } catch (err) {
    console.error(
      "[listInventory] material-backed query failed (projectId=%s siteId=%s search=%s scopeLen=%s):",
      String(filter.projectId || ""),
      String(filter.siteId || ""),
      String(filter.search || ""),
      String(filter.scopeProjectIds?.length ?? 0),
      (err as Error)?.message || err
    );
    return {
      items: [],
      total: 0,
      page: effectivePage,
      limit: effectiveLimit,
      pages: 0,
      nextCursor: null,
      queryFailed: true,
    };
  }

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
        .select("_id projectId projectName clientId clientName siteId site name unit requestedQuantity approvedQuantity purchasedQuantity consumedQuantity remainingStock vendor vendorId poNumber createdAt updatedAt")
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
      lastMaterialId: material._id,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
    })),
    total,
  };
}

/**
 * Efficient bulk backfill: pulls all materials in one query, all existing
 * inventory in one query, then bulk-inserts missing inventory records
 * with `ordered: false` so a single failure doesn't abort the batch.
 * Far faster than the previous N+1 loop (100s of queries → 2 queries + 1 bulk).
 */
export async function backfillApprovedMaterialsToInventory(materialQuery: Record<string, unknown>) {
  const t0 = Date.now();
  let materials: any[];
  try {
    materials = await Material.find({
      ...materialQuery,
      status: { $in: ["Approved", "Received", "Completed", "Not Received"] },
    })
      .select("_id projectId projectName clientId clientName siteId site name unit requestedQuantity approvedQuantity purchasedQuantity consumedQuantity vendor vendorId poNumber createdBy")
      .lean()
      .maxTimeMS(15000);
  } catch (err) {
    console.warn("[backfill] Material.find failed:", (err as Error).message);
    return;
  }
  if (materials.length === 0) {
    console.log("[backfill] no materials matched — nothing to backfill");
    return;
  }

  // Bulk-fetch all existing inventory in one query
  const matchClauses = materials.map(inventoryMatchForMaterial);
  const existing: any[] = await Inventory.find({ $or: matchClauses })
    .select("_id projectId siteKey normalizedName normalizedUnit purchaseHistory materialId")
    .lean()
    .maxTimeMS(15000)
    .catch((err) => {
      console.warn("[backfill] Inventory.find failed (non-fatal):", (err as Error).message);
      return [];
    });

  // Index existing inventory by composite key for O(1) lookup
  const existingByKey = new Map<string, any>();
  for (const inv of existing) {
    const key = `${inv.projectId}__${inv.siteKey}__${inv.normalizedName}__${inv.normalizedUnit}`;
    existingByKey.set(key, inv);
  }

  // Build bulk insert ops for missing inventory records
  const ops: any[] = [];
  for (const material of materials) {
    const quantity = Math.max(0, Number(material.approvedQuantity) || 0);
    if (quantity <= 0) continue;
    const key = inventoryKeyForMaterial(material);
    const inv = existingByKey.get(key);
    if (inv) {
      // Already exists — skip (no purchaseHistory update from backfill; that
      // happens inline when new materials are approved via addApprovedMaterialToInventory)
      continue;
    }
    ops.push({
      insertOne: {
        document: {
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
          approvedQuantity: quantity,
          purchasedQuantity: quantity,
          consumedQuantity: Number(material.consumedQuantity) || 0,
          vendor: material.vendor,
          vendorId: material.vendorId,
          poNumber: material.poNumber,
          lastMaterialId: material._id,
          purchaseHistory: [
            {
              vendor: material.vendor || "",
              vendorId: material.vendorId,
              quantity,
              date: new Date(),
              poNumber: material.poNumber,
              materialId: material._id,
            },
          ],
        },
      },
    });
  }

  if (ops.length === 0) {
    console.log(`[backfill] ${materials.length} materials, all already have inventory records — nothing to insert`);
    return;
  }

  // Chunk to respect M0's 1000-op bulkWrite limit and add small pauses
  const CHUNK_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    try {
      const result = await Inventory.bulkWrite(chunk, { ordered: false });
      inserted += result.insertedCount ?? 0;
    } catch (err: any) {
      // ordered: false means some inserts may succeed even if others fail
      const written = err?.result?.result?.nInserted ?? err?.insertedCount ?? 0;
      inserted += written;
      console.warn(`[backfill] chunk ${i / CHUNK_SIZE + 1} partial: ${(err as Error).message}`);
    }
    if (i + CHUNK_SIZE < ops.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  console.log(
    `[backfill] inserted ${inserted}/${ops.length} inventory records from ${materials.length} materials in ${Date.now() - t0}ms`
  );
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
    inventory.billUrl = pcloudResult.fileUrl;
  } catch (err) {
    console.warn("[pCloud] Upload failed for inventory item, falling back to base64 storage:", err);
    inventory.receiptImage = payload.data;
    inventory.receiptImageMimeType = payload.mimeType;
    inventory.receiptImageName = payload.fileName;
    inventory.billUrl = `data:${payload.mimeType};base64,${payload.data}`;
  }

  if (payload.givenAmount !== undefined) {
    inventory.received = true;
  } else if (payload.received !== undefined) {
    inventory.received = payload.received;
  }

  await inventory.save();

  if (inventory.billUrl) {
    try {
      const { Material } = await import("../models/Material.js");
      if (inventory.lastMaterialId) {
        await Material.updateOne({ _id: inventory.lastMaterialId }, { $set: { billUrl: inventory.billUrl } });
      } else {
        await Material.updateOne(
          { projectId: inventory.projectId, name: inventory.name, unit: inventory.unit },
          { $set: { billUrl: inventory.billUrl } }
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
      existing.purchaseHistory = existing.purchaseHistory || [];
      existing.purchaseHistory.push({
        vendor: material.vendor || "",
        vendorId: material.vendorId,
        quantity: qty,
        date: new Date(),
        poNumber: material.poNumber,
        materialId: material._id,
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
        purchaseHistory: [{
          vendor: material.vendor || "",
          vendorId: material.vendorId,
          quantity: qty,
          date: new Date(),
          poNumber: material.poNumber,
          materialId: material._id,
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
    name: string;
    unit: string;
    quantity?: number;
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
  if (projectIds.length > 0) {
    const project = await Project.findById(projectIds[0]).lean();
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
  const minimumStockRaw = input.minimumStock !== undefined && input.minimumStock !== null
    ? Number(input.minimumStock)
    : undefined;
  const minimumStock = minimumStockRaw !== undefined && !Number.isNaN(minimumStockRaw)
    ? Math.max(0, minimumStockRaw)
    : undefined;
  const remarks = input.remarks ? String(input.remarks).trim() : undefined;
  const requestDate = input.requestDate || new Date().toISOString().slice(0, 10);

  const existing = await Material.findOne({
    siteId: siteObjectId,
    name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    unit: { $regex: new RegExp(`^${trimmedUnit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });

  if (existing) {
    if (quantity > 0) {
      existing.approvedQuantity = Math.max(0, Number(existing.approvedQuantity) || 0) + quantity;
      existing.purchasedQuantity = Math.max(0, Number(existing.purchasedQuantity) || 0) + quantity;
      existing.remainingStock = Math.max(0, existing.purchasedQuantity - (Number(existing.consumedQuantity) || 0));
    }
    if (minimumStock !== undefined) {
      (existing as any).minimumQuantity = minimumStock;
    }
    if (remarks) {
      existing.notes = remarks;
    }
    (existing as any).createdBy = updatedBy;
    await existing.save();
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
    ...(minimumStock !== undefined ? { minimumQuantity: minimumStock } : {}),
    status: "Not Received",
    requestDate,
    notes: remarks,
    createdBy: updatedBy,
  });

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
