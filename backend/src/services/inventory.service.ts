import { Types } from "mongoose";
import { Inventory } from "../models/Inventory.js";
import { IMaterial, Material } from "../models/Material.js";
import { AppError } from "../middleware/errorHandler.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";

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

  const inventory = await Inventory.findOneAndUpdate(
    inventoryMatchForMaterial(material),
    {
      $setOnInsert: {
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
        minimumQuantity: 0,
        consumedQuantity: 0,
        purchaseHistory: [],
      },
      $inc: {
        approvedQuantity: qty,
        purchasedQuantity: qty,
      },
      $set: {
        vendor: material.vendor,
        vendorId: material.vendorId,
        poNumber: material.poNumber,
        lastMaterialId: material._id,
        lastUpdatedBy: updatedBy,
      },
      $push: {
        purchaseHistory: {
          vendor: material.vendor || "",
          vendorId: material.vendorId,
          quantity: qty,
          date: new Date(),
          poNumber: material.poNumber,
          materialId: material._id,
        },
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  if (!inventory) return null;
  inventory.remainingStock = Math.max(0, inventory.purchasedQuantity - inventory.consumedQuantity);
  await inventory.save();
  return inventory;
}

export async function listInventory(filter: {
  projectId?: string;
  siteId?: string;
  search?: string;
  page: number;
  limit: number;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.search) query.name = { $regex: filter.search, $options: "i" };
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Inventory.find(query).sort({ updatedAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Inventory.countDocuments(query),
  ]);

  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function backfillApprovedMaterialsToInventory(materialQuery: Record<string, unknown>) {
  const materials = await Material.find({ ...materialQuery, status: { $in: ["Approved", "Received", "Completed"] } }).lean();
  for (const material of materials) {
    const existing = await Inventory.findOne(inventoryMatchForMaterial(material)).lean();
    if (existing) {
      const qty = Math.max(
        0,
        Number(material.approvedQuantity) || 0,
        Number(material.purchasedQuantity) || 0,
        Number(material.remainingStock) || 0
      );
      if (qty <= 0) continue;
      const alreadyRecorded = (existing.purchaseHistory || []).some(
        (h) => h.materialId && h.materialId.toString() === material._id.toString()
      );
      if (alreadyRecorded) continue;
      await addApprovedMaterialToInventory(material._id, qty, material.createdBy);
      continue;
    }
    const quantity = Math.max(
      0,
      Number(material.approvedQuantity) || 0,
      Number(material.purchasedQuantity) || 0,
      Number(material.remainingStock) || 0
    );
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
