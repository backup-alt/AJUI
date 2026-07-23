import { Types } from "mongoose";
import { Material } from "../models/Material.js";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { Vendor } from "../models/Vendor.js";
import { Site } from "../models/Site.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { CreateMaterialInput } from "../schemas/financial.schema.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { backfillApprovedMaterialsToInventory, inventoryKeyForMaterial, inventoryStockMapForMaterials } from "./inventory.service.js";

async function populateRefs(input: CreateMaterialInput) {
  const project = await Project.findById(input.projectId);
  if (!project) throw new AppError(404, "Project not found");

  const client = await Client.findById(project.clientId);
  if (!client) throw new AppError(404, "Client not found");

  let vendor: { name: string; vendorId?: Types.ObjectId } | undefined;
  if (input.vendorId) {
    const v = await Vendor.findById(input.vendorId);
    if (!v) throw new AppError(404, "Vendor not found");
    vendor = { name: v.name, vendorId: v._id };
  }

  return { project, client, vendor };
}

async function resolveSiteName(site?: string, siteId?: string): Promise<string | undefined> {
  if (site) return site;
  if (siteId) {
    const siteDoc = await Site.findById(siteId).lean();
    return siteDoc?.name;
  }
  return undefined;
}

export async function createMaterial(input: CreateMaterialInput) {
  const { project, client, vendor } = await populateRefs(input);
  const siteName = await resolveSiteName(input.site, input.siteId);

  const existingPending = await Material.findOne({
    projectId: project._id,
    site: siteName,
    name: input.name,
    unit: input.unit,
    status: { $in: ["Pending", "Not Received"] },
  });

  if (existingPending) {
    existingPending.requestedQuantity = input.requestedQuantity;
    existingPending.notes = input.notes;
    existingPending.vendor = input.vendor || vendor?.name;
    existingPending.vendorId = input.vendorId ? new Types.ObjectId(input.vendorId) : vendor?.vendorId;
    existingPending.poNumber = input.poNumber;
    existingPending.createdBy = input.createdBy;
    await existingPending.save();
    return existingPending.toObject();
  }

  const materialId = await generateId("MAT");
  const material = await Material.create({
    materialId,
    projectId: project._id,
    projectName: project.name,
    clientId: client._id,
    clientName: client.name,
    siteId: input.siteId ? new Types.ObjectId(input.siteId) : undefined,
    site: siteName,
    name: input.name,
    unit: input.unit,
    requestedQuantity: input.requestedQuantity,
    approvedQuantity: input.approvedQuantity ?? 0,
    purchasedQuantity: input.purchasedQuantity,
    consumedQuantity: input.consumedQuantity,
    remainingStock: Math.max(0, input.purchasedQuantity - input.consumedQuantity),
    vendor: input.vendor || vendor?.name,
    vendorId: input.vendorId ? new Types.ObjectId(input.vendorId) : vendor?.vendorId,
    poNumber: input.poNumber,
    requestDate: input.requestDate,
    approvalDate: input.approvedQuantity ? new Date().toISOString().slice(0, 10) : undefined,
    status: "Not Received",
    createdBy: input.createdBy,
    notes: input.notes,
  });

  return material.toObject();
}

export async function listMaterials(filter: {
  projectId?: string;
  siteId?: string;
  site?: string;
  vendorId?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.site) query.site = filter.site;
  if (filter.vendorId) query.vendorId = new Types.ObjectId(filter.vendorId);
  if (filter.status) query.status = filter.status;
  if (filter.search) query.name = { $regex: filter.search, $options: "i" };
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Material.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Material.countDocuments(query),
  ]);

  // Resolve site names for items that have siteId but site field is ObjectId or missing
  const siteIds = [...new Set(items.map(m => m.siteId?.toString()).filter(Boolean))];
  if (siteIds.length > 0) {
    const sites = await Site.find({ _id: { $in: siteIds.map(id => new Types.ObjectId(id)) } }).lean();
    const siteNameMap = new Map(sites.map(s => [s._id.toString(), s.name]));
    items.forEach(item => {
      if (item.siteId && (!item.site || typeof item.site === "object")) {
        item.site = siteNameMap.get(item.siteId.toString()) || item.site;
      }
    });
  }

  await backfillApprovedMaterialsToInventory(query);
  const stockMap = await inventoryStockMapForMaterials(items);
  items.forEach((item) => {
    const sharedStock = stockMap.get(inventoryKeyForMaterial(item));
    if (sharedStock !== undefined) item.remainingStock = sharedStock;
  });

  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function getMaterialById(id: string) {
  const material = await Material.findById(id).lean();
  if (!material) throw new AppError(404, "Material not found");
  return material;
}

export async function updateMaterial(id: string, patch: Partial<CreateMaterialInput>) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.siteId) {
    update.siteId = new Types.ObjectId(patch.siteId);
    const site = await Site.findById(patch.siteId).lean();
    if (site) update.site = site.name;
  }
  if (patch.vendorId) update.vendorId = new Types.ObjectId(patch.vendorId);

  const material = await Material.findByIdAndUpdate(id, update, { new: true });
  if (!material) throw new AppError(404, "Material not found");
  return material.toObject();
}

export async function deleteMaterial(id: string) {
  const result = await Material.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Material not found");
}

export async function getPendingMaterials(scopeProjectIds?: ProjectScopeIds) {
  // "Pending" status no longer exists; this function is retained for API
  // compatibility but returns materials that have not yet been received.
  const query: Record<string, unknown> = { status: "Not Received" };
  applyProjectScope(query, "projectId", scopeProjectIds);
  return Material.find(query).sort({ createdAt: -1 }).lean();
}

export async function uploadMaterialReceipt(
  id: string,
  payload: { data: string; mimeType: string; fileName?: string; givenAmount?: number }
) {
  const material = await Material.findById(id);
  if (!material) throw new AppError(404, "Material not found");

  const { uploadToPCloud } = await import("./pcloud.service.js");

  try {
    const pcloudResult = await uploadToPCloud(
      payload.data,
      payload.fileName || `receipt_mat_${material.materialId}.${payload.mimeType.split("/")[1] || "jpg"}`,
      payload.mimeType
    );
    material.billUrl = pcloudResult.fileUrl;
  } catch (err) {
    console.warn("[pCloud] Upload failed for material, falling back to base64 storage:", err);
    material.receiptImage = payload.data;
    material.receiptImageMimeType = payload.mimeType;
    material.receiptImageName = payload.fileName;
    material.billUrl = `data:${payload.mimeType};base64,${payload.data}`;
  }

  if (payload.givenAmount !== undefined) {
    material.givenAmount = payload.givenAmount;
    material.status = "Received";
  }

  await material.save();
  return material.toObject();
}

/**
 * Migrate legacy material statuses to the new 2-value enum.
 * Old values: Pending, Approved, Rejected, Completed -> Received | Not Received
 *  - Pending/Approved/Completed  -> "Received"  (we treat any "approved/past" state
 *    as having been delivered, since these were the historical "go ahead" signals)
 *  - Rejected                   -> "Not Received"
 *
 * Safe to call repeatedly: once a row's status is in the new enum, the query
 * returns zero documents.
 */
export async function migrateMaterialStatus(): Promise<{ matched: number; modified: number }> {
  const legacy = ["Pending", "Approved", "Rejected", "Completed"];
  const toReceived = ["Pending", "Approved", "Completed"];
  const toNotReceived = ["Rejected"];

  const [a, b] = await Promise.all([
    Material.updateMany(
      { status: { $in: toReceived } },
      { $set: { status: "Received" } }
    ),
    Material.updateMany(
      { status: { $in: toNotReceived } },
      { $set: { status: "Not Received" } }
    ),
  ]);

  const matched = (a.matchedCount ?? 0) + (b.matchedCount ?? 0);
  const modified = (a.modifiedCount ?? 0) + (b.modifiedCount ?? 0);

  if (matched > 0) {
    console.log(`[MIGRATE] material.status: ${modified} row(s) updated (matched ${matched} legacy values)`);
  }

  // Sanity: log any stragglers (should be impossible given the enum constraint)
  const stragglers = await Material.countDocuments({ status: { $nin: ["Received", "Not Received"] } });
  if (stragglers > 0) {
    console.warn(`[MIGRATE] material.status: ${stragglers} row(s) still have legacy status`);
  }

  return { matched, modified };
}
