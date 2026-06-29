import { Types } from "mongoose";
import { Material } from "../models/Material";
import { Project } from "../models/Project";
import { Client } from "../models/Client";
import { Vendor } from "../models/Vendor";
import { AppError } from "../middleware/errorHandler";
import { generateId } from "./id-generator.service";
import { createApproval } from "./approval.service";
import { CreateMaterialInput } from "../schemas/financial.schema";

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

export async function createMaterial(input: CreateMaterialInput) {
  const { project, client, vendor } = await populateRefs(input);
  const materialId = await generateId("MAT");
  const material = await Material.create({
    materialId,
    projectId: project._id,
    projectName: project.name,
    clientId: client._id,
    clientName: client.name,
    siteId: input.siteId ? new Types.ObjectId(input.siteId) : undefined,
    site: input.site,
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
  });

  await createApproval({
    type: "material",
    title: `${input.name} - ${input.requestedQuantity}${input.unit}`,
    sourceCollection: "materials",
    sourceId: material._id,
    projectId: project._id,
    projectName: project.name,
    site: input.site,
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
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.vendorId) query.vendorId = new Types.ObjectId(filter.vendorId);
  if (filter.status) query.status = filter.status;
  if (filter.search) query.name = { $regex: filter.search, $options: "i" };

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Material.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Material.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function getMaterialById(id: string) {
  const material = await Material.findById(id).lean();
  if (!material) throw new AppError(404, "Material not found");
  return material;
}

export async function updateMaterial(id: string, patch: Partial<CreateMaterialInput>) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.siteId) update.siteId = new Types.ObjectId(patch.siteId);
  if (patch.vendorId) update.vendorId = new Types.ObjectId(patch.vendorId);

  const material = await Material.findByIdAndUpdate(id, update, { new: true });
  if (!material) throw new AppError(404, "Material not found");
  return material.toObject();
}

export async function deleteMaterial(id: string) {
  const result = await Material.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Material not found");
}

export async function getPendingMaterials() {
  return Material.find({ status: "Pending" }).sort({ createdAt: -1 }).lean();
}
