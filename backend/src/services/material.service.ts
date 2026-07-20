import { Types } from "mongoose";
import { Material } from "../models/Material.js";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { Vendor } from "../models/Vendor.js";
import { Site } from "../models/Site.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { createApproval } from "./approval.service.js";
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
  const materialId = await generateId("MAT");
  const siteName = await resolveSiteName(input.site, input.siteId);
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
    status: input.approvedQuantity ? "Pending" : "Pending",
    createdBy: input.createdBy,
    notes: input.notes,
  });

  await createApproval({
    type: "material",
    title: `${input.name} - ${input.requestedQuantity}${input.unit}`,
    sourceCollection: "materials",
    sourceId: material._id,
    projectId: project._id,
    projectName: project.name,
    site: siteName,
    amount: input.requestedQuantity,
    detail: `${input.requestedQuantity} ${input.unit} of ${input.name}`,
  });

  return material.toObject();
}

export async function listMaterials(filter: {
  projectId?: string;
  siteId?: string;
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
  const query: Record<string, unknown> = { status: "Pending" };
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
