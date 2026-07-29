import { Types } from "mongoose";
import { IInventory, Inventory } from "../models/Inventory.js";
import { IMaterial, Material } from "../models/Material.js";
import { Site } from "../models/Site.js";
import { AppError } from "../middleware/errorHandler.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { findAllOrFallback } from "../utils/find-all.js";
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
export async function listAllInventory(filter: {
  projectId?: string;
  siteId?: string;
  search?: string;
  scopeProjectIds?: ProjectScopeIds;
  max?: number;
}): Promise<any[]> {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.search) query.name = { $regex: filter.search, $options: "i" };
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  return findAllOrFallback(Inventory, "inventory/all", query, filter.max ?? 500);
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
  if (filter.cursor) {
    try {
      query._id = { $gt: new Types.ObjectId(filter.cursor) };
    } catch {
      // Invalid cursor → fall through and start from the beginning
    }
  }

  // DIAGNOSTIC: log the query that will be executed against M0
  console.log(
    `[listInventory.diag] query=${JSON.stringify(query)} limit=${filter.limit ?? "default"} scope=${filter.scopeProjectIds?.length ?? "null"}`
  );

  // Cap default at 100 — matches the hydration request size, matches
  // labour/payments/subcontractors default.
  const effectiveLimit = Math.min(Math.max(filter.limit || 100, 1), 100);
  type InventoryLike = { [k: string]: unknown };
  let items: InventoryLike[] = [];
  let total = 0;
  let nextCursor: string | null = null;
  try {
    // Serialize through the in-process mutex so this query doesn't
    // contend with other concurrent requests for the M0 cluster's
    // shared resources.
    const foundItems = await dbMutex.run(() =>
      withRetry(
        () => Inventory.find(query)
          .sort({ _id: -1 })
          .limit(effectiveLimit + 1)
          .lean()
          .maxTimeMS(10000),
        { label: "listInventory.find" }
      )
    );
    if (!filter.cursor) {
      try {
        const foundTotal = await dbMutex.run(() =>
          withRetry(
            () => Inventory.countDocuments(query).maxTimeMS(8000),
            { label: "listInventory.count" }
          )
        );
        total = foundTotal;
      } catch (countErr) {
        console.warn("[listInventory] countDocuments failed (non-fatal):", (countErr as Error).message);
        total = items.length;
      }
    } else {
      total = filter.page * effectiveLimit;
    }
    items = foundItems as unknown as InventoryLike[];
    if (items.length > effectiveLimit) {
      const nextItem = items.pop();
      if (nextItem && (nextItem as any)._id) {
        nextCursor = String((nextItem as any)._id);
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
  }

  return {
    items: items as unknown as IInventory[],
    total,
    page: filter.page,
    limit: effectiveLimit,
    pages: Math.ceil(total / effectiveLimit),
    nextCursor,
  };
}

export async function backfillApprovedMaterialsToInventory(materialQuery: Record<string, unknown>) {
  let materials;
  try {
    materials = await Material.find({ ...materialQuery, status: { $in: ["Approved", "Received", "Completed", "Not Received"] } }).lean();
  } catch {
    return;
  }
  for (const material of materials) {
    try {
      const existing = await Inventory.findOne(inventoryMatchForMaterial(material)).lean();
      if (existing) {
        const qty = Math.max(0, Number(material.approvedQuantity) || 0);
        if (qty <= 0) continue;
        const alreadyRecorded = (existing.purchaseHistory || []).some(
          (h) => h.materialId && h.materialId.toString() === material._id.toString()
        );
        if (alreadyRecorded) continue;
        await addApprovedMaterialToInventory(material._id, qty, material.createdBy);
        continue;
      }
      const quantity = Math.max(0, Number(material.approvedQuantity) || 0);
      if (quantity <= 0) continue;
      const inventory = new Inventory({
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
        purchaseHistory: [{
          vendor: material.vendor || "",
          vendorId: material.vendorId,
          quantity: quantity,
          date: new Date(),
          poNumber: material.poNumber,
          materialId: material._id,
        }],
      });
      await inventory.save();
    } catch {
      continue;
    }
  }
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
