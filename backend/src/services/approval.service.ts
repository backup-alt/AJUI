import { Types } from "mongoose";
import { Approval, ApprovalType, IApproval } from "../models/Approval.js";
import { Material } from "../models/Material.js";
import { Labour } from "../models/Labour.js";
import { Expense } from "../models/Expense.js";
import { Payment } from "../models/Payment.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { generateId } from "./id-generator.service.js";
import { recomputeProjectTotals } from "./financial.service.js";
import { AppError } from "../middleware/errorHandler.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";

export interface CreateApprovalParams {
  type: ApprovalType;
  title: string;
  sourceCollection: string;
  sourceId: Types.ObjectId;
  projectId?: Types.ObjectId;
  projectName?: string;
  site?: string;
  owner?: string;
  amount?: number;
  detail?: string;
}

export async function createApproval(params: CreateApprovalParams): Promise<IApproval> {
  const approvalId = await generateId("APR");
  const approval = await Approval.create({
    approvalId,
    type: params.type,
    title: params.title,
    sourceCollection: params.sourceCollection,
    sourceId: params.sourceId,
    projectId: params.projectId,
    projectName: params.projectName,
    site: params.site,
    owner: params.owner,
    amount: params.amount,
    detail: params.detail,
    status: "Pending",
    submittedAt: new Date(),
  });
  return approval.toObject();
}

export async function approveRequest(approvalId: string, reviewer: string): Promise<IApproval> {
  const approval = await Approval.findOne({ approvalId });
  if (!approval) throw new AppError(404, "Approval not found");
  if (approval.status !== "Pending") {
    throw new AppError(409, `Approval already ${approval.status.toLowerCase()}`);
  }

  const sourceUpdate: Record<string, unknown> = {
    status: "Approved",
    approvedBy: reviewer,
    approvedAt: new Date(),
  };

  let projectId: Types.ObjectId | undefined;
  switch (approval.sourceCollection) {
    case "materials":
      await Material.updateOne({ _id: approval.sourceId }, sourceUpdate);
      const mat = await Material.findById(approval.sourceId).lean();
      projectId = mat?.projectId;
      break;
    case "labour":
      await Labour.updateOne({ _id: approval.sourceId }, sourceUpdate);
      const lab = await Labour.findById(approval.sourceId).lean();
      projectId = lab?.projectId;
      break;
    case "expenses":
      await Expense.updateOne({ _id: approval.sourceId }, sourceUpdate);
      const exp = await Expense.findById(approval.sourceId).lean();
      projectId = exp?.projectId;
      break;
    case "payments":
      await Payment.updateOne({ _id: approval.sourceId }, sourceUpdate);
      const pay = await Payment.findById(approval.sourceId).lean();
      projectId = pay?.projectId;
      break;
    case "subcontractors":
      await Subcontractor.updateOne({ _id: approval.sourceId }, sourceUpdate);
      const sub = await Subcontractor.findById(approval.sourceId).lean();
      projectId = sub?.projectId;
      break;
    default:
      throw new AppError(400, "Unknown source collection");
  }

  approval.status = "Approved";
  approval.reviewedBy = reviewer;
  approval.reviewedAt = new Date();
  await approval.save();

  if (projectId) {
    await recomputeProjectTotals(projectId);
  }

  // Send push notification to project supervisors (non-blocking best-effort)
  try {
    const { notifyProjectSupervisors } = await import("./device-token.service.js");
    if (projectId) {
      await notifyProjectSupervisors(
        projectId,
        `${approval.title} - Approved`,
        `Your ${approval.type} request has been approved`,
        {
          approvalId: approval.approvalId,
          type: approval.type,
          status: "Approved",
          projectId: approval.projectId?.toString() || "",
        }
      );
    }
  } catch (err) {
    console.warn("[Notification] Failed to send approval notification:", err);
  }

  return approval.toObject();
}

export async function rejectRequest(approvalId: string, reviewer: string): Promise<IApproval> {
  const approval = await Approval.findOne({ approvalId });
  if (!approval) throw new AppError(404, "Approval not found");
  if (approval.status !== "Pending") {
    throw new AppError(409, `Approval already ${approval.status.toLowerCase()}`);
  }

  const sourceUpdate: Record<string, unknown> = {
    status: "Rejected",
    approvedBy: reviewer,
    approvedAt: new Date(),
  };

  switch (approval.sourceCollection) {
    case "materials":
      await Material.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
    case "labour":
      await Labour.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
    case "expenses":
      await Expense.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
    case "payments":
      await Payment.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
    case "subcontractors":
      await Subcontractor.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
  }

  approval.status = "Rejected";
  approval.reviewedBy = reviewer;
  approval.reviewedAt = new Date();
  await approval.save();

  // Send push notification to project supervisors
  try {
    const { notifyProjectSupervisors } = await import("./device-token.service.js");
    await notifyProjectSupervisors(
      approval.projectId || "",
      `${approval.title} - Rejected`,
      `Your ${approval.type} request has been rejected`,
      {
        approvalId: approval.approvalId,
        type: approval.type,
        status: "Rejected",
        projectId: approval.projectId?.toString() || "",
      }
    );
  } catch (err) {
    console.warn("[Notification] Failed to send rejection notification:", err);
  }

  return approval.toObject();
}

export async function listApprovals(filter: {
  type?: ApprovalType;
  projectId?: string;
  status?: string;
  page: number;
  limit: number;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.type) query.type = filter.type;
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.status) query.status = filter.status;
  else query.status = "Pending";
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Approval.find(query).sort({ submittedAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Approval.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function getApprovalById(id: string) {
  const approval = await Approval.findOne({ approvalId: id }).lean();
  if (!approval) throw new AppError(404, "Approval not found");
  return approval;
}

export async function getApprovalCount(filter: { projectId?: string; type?: ApprovalType; scopeProjectIds?: ProjectScopeIds } = {}) {
  const query: Record<string, unknown> = { status: "Pending" };
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.type) query.type = filter.type;
  applyProjectScope(query, "projectId", filter.scopeProjectIds);
  const [total, byType] = await Promise.all([
    Approval.countDocuments(query),
    Approval.aggregate([
      { $match: query },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);
  return { total, byType };
}
