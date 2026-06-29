import { Types } from "mongoose";
import { Subcontractor } from "../models/Subcontractor";
import { Project } from "../models/Project";
import { Client } from "../models/Client";
import { AppError } from "../middleware/errorHandler";
import { generateId } from "./id-generator.service";
import { createApproval } from "./approval.service";
import { CreateSubcontractorInput } from "../schemas/financial.schema";

export async function createSubcontractor(input: CreateSubcontractorInput) {
  const project = await Project.findById(input.projectId);
  if (!project) throw new AppError(404, "Project not found");

  const client = await Client.findById(project.clientId);
  if (!client) throw new AppError(404, "Client not found");

  const subcontractId = await generateId("SUB");
  const sub = await Subcontractor.create({
    subcontractId,
    projectId: project._id,
    projectName: project.name,
    clientId: client._id,
    siteId: input.siteId ? new Types.ObjectId(input.siteId) : undefined,
    site: input.site,
    subcontractorName: input.subcontractorName,
    workPackage: input.workPackage,
    contractValue: input.contractValue,
    advancePaid: input.advancePaid,
    balance: input.contractValue - input.advancePaid,
    startDate: input.startDate,
    dueDate: input.dueDate,
    supervisor: input.supervisor,
    supervisorId: input.supervisorId ? new Types.ObjectId(input.supervisorId) : undefined,
  });

  await createApproval({
    type: "subcontract",
    title: `Subcontract: ${input.subcontractorName} - ${input.workPackage}`,
    sourceCollection: "subcontractors",
    sourceId: sub._id,
    projectId: project._id,
    projectName: project.name,
    site: input.site,
    owner: input.subcontractorName,
    amount: input.contractValue,
    detail: `${input.workPackage} for ${input.contractValue}`,
  });

  return sub.toObject();
}

export async function listSubcontractors(filter: {
  projectId?: string;
  approvalStatus?: string;
  paymentStatus?: string;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.approvalStatus) query.approvalStatus = filter.approvalStatus;
  if (filter.paymentStatus) query.paymentStatus = filter.paymentStatus;

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Subcontractor.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Subcontractor.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function getSubcontractorById(id: string) {
  const sub = await Subcontractor.findById(id).lean();
  if (!sub) throw new AppError(404, "Subcontractor not found");
  return sub;
}

export async function updateSubcontractor(
  id: string,
  patch: Partial<CreateSubcontractorInput> & { approvalStatus?: string; paymentStatus?: string }
) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.siteId) update.siteId = new Types.ObjectId(patch.siteId);
  if (patch.supervisorId) update.supervisorId = new Types.ObjectId(patch.supervisorId);
  if (patch.projectId) update.projectId = new Types.ObjectId(patch.projectId);

  const sub = await Subcontractor.findByIdAndUpdate(id, update, { new: true });
  if (!sub) throw new AppError(404, "Subcontractor not found");
  return sub.toObject();
}

export async function deleteSubcontractor(id: string) {
  const result = await Subcontractor.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Subcontractor not found");
}

export async function getPendingSubcontractors() {
  return Subcontractor.find({ approvalStatus: "Pending" }).sort({ createdAt: -1 }).lean();
}
