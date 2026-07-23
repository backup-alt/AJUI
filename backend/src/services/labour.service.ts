import { Types } from "mongoose";
import { Labour } from "../models/Labour.js";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { createApproval } from "./approval.service.js";
import { CreateLabourInput } from "../schemas/financial.schema.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";

export async function createLabour(input: CreateLabourInput) {
  const project = await Project.findById(input.projectId);
  if (!project) throw new AppError(404, "Project not found");

  const client = await Client.findById(project.clientId);
  if (!client) throw new AppError(404, "Client not found");

  const labourId = await generateId("LAB");
  const labour = await Labour.create({
    labourId,
    projectId: project._id,
    projectName: project.name,
    clientId: client._id,
    siteId: input.siteId ? new Types.ObjectId(input.siteId) : undefined,
    site: input.site,
    partyName: input.partyName,
    category: input.category,
    attendanceDate: input.attendanceDate,
    presentCount: input.presentCount,
    presentDays: input.presentDays,
    absentDays: input.absentDays,
    dailyWage: input.dailyWage,
    overtime: input.overtime,
    lateFine: input.lateFine,
    shift: input.shift,
    paymentMode: input.paymentMode,
    wagePeriod: input.wagePeriod,
    laborTypes: input.laborTypes,
    notes: input.notes,
    submittedBy: input.submittedBy,
  });

  const totalStaff = input.laborTypes.reduce((sum, lt) => sum + lt.staffCount, 0) || input.presentCount;
  await createApproval({
    type: "labour",
    title: `${input.partyName} - ${input.category}`,
    sourceCollection: "labour",
    sourceId: labour._id,
    projectId: project._id,
    projectName: project.name,
    site: input.site,
    owner: input.partyName,
    amount: input.dailyWage * totalStaff,
    detail: `${totalStaff} workers on ${input.attendanceDate}`,
  });

  return labour.toObject();
}

export async function listLabour(filter: {
  projectId?: string;
  siteId?: string;
  site?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.site) query.site = filter.site;
  if (filter.category) query.category = filter.category;
  if (filter.status) query.status = filter.status;
  if (filter.from || filter.to) {
    query.attendanceDate = {};
    if (filter.from) (query.attendanceDate as Record<string, string>).$gte = filter.from;
    if (filter.to) (query.attendanceDate as Record<string, string>).$lte = filter.to;
  }
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Labour.find(query).sort({ attendanceDate: -1, createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Labour.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function getLabourById(id: string) {
  const labour = await Labour.findById(id).lean();
  if (!labour) throw new AppError(404, "Labour record not found");
  return labour;
}

export async function updateLabour(id: string, patch: Partial<CreateLabourInput>) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.siteId) update.siteId = new Types.ObjectId(patch.siteId);

  const labour = await Labour.findByIdAndUpdate(id, update, { new: true });
  if (!labour) throw new AppError(404, "Labour record not found");
  return labour.toObject();
}

export async function deleteLabour(id: string) {
  const result = await Labour.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Labour record not found");
}

export async function getLabourSummary(projectId: string, scopeProjectIds?: ProjectScopeIds) {
  const pid = new Types.ObjectId(projectId);
  const query: Record<string, unknown> = { projectId: pid, status: "Approved" };
  applyProjectScope(query, "projectId", scopeProjectIds);
  const agg = await Labour.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$category",
        totalStaff: { $sum: "$presentCount" },
        totalDays: { $sum: "$presentDays" },
        totalWages: { $sum: { $multiply: ["$dailyWage", "$presentCount"] } },
        count: { $sum: 1 },
      },
    },
  ]);
  return agg;
}

export async function getPendingLabour(scopeProjectIds?: ProjectScopeIds) {
  const query: Record<string, unknown> = { status: "Pending" };
  applyProjectScope(query, "projectId", scopeProjectIds);
  return Labour.find(query).sort({ createdAt: -1 }).lean();
}
