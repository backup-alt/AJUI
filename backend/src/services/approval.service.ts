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
import { generatePoNumberForSite } from "./po-number.service.js";
import { recomputeSiteLedger } from "./expense.service.js";
import { addApprovedMaterialToInventory } from "./inventory.service.js";

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

export async function approveRequest(
  approvalId: string,
  reviewer: string,
  options: {
    issuedAmount?: number;
    givenAmount?: number;
    poNumber?: string;
    approvedQuantity?: number;
    vendor?: string;
  } = {}
): Promise<IApproval> {
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

  if (options.issuedAmount !== undefined) sourceUpdate.issuedAmount = options.issuedAmount;
  if (options.givenAmount !== undefined) sourceUpdate.givenAmount = options.givenAmount;

  let projectId: Types.ObjectId | undefined;
  let generatedPoNumber: string | undefined;
  switch (approval.sourceCollection) {
    case "materials":
    case "Material": {
      const mat = await Material.findById(approval.sourceId).lean();
      const generatedPo = options.poNumber || await generatePoNumberForSite(
        mat?.siteId ? String(mat.siteId) : undefined,
        mat?.site,
        mat?.projectId ? String(mat.projectId) : undefined
      );
      generatedPoNumber = generatedPo;
      await Material.updateOne(
        { _id: approval.sourceId },
        {
          ...sourceUpdate,
          poNumber: generatedPo,
          ...(options.approvedQuantity !== undefined ? { approvedQuantity: options.approvedQuantity } : {}),
          ...(options.vendor !== undefined ? { vendor: options.vendor } : {}),
        }
      );
      await addApprovedMaterialToInventory(
        approval.sourceId,
        options.approvedQuantity ?? mat?.approvedQuantity ?? mat?.requestedQuantity ?? 0,
        reviewer
      );
      projectId = mat?.projectId;
      break;
    }
    case "labour":
    case "Labour": {
      await Labour.updateOne({ _id: approval.sourceId }, sourceUpdate);
      const lab = await Labour.findById(approval.sourceId).lean();
      projectId = lab?.projectId;
      break;
    }
    case "expenses":
    case "Expense": {
      const exp = await Expense.findById(approval.sourceId).lean();
      // Purchase approvals generate a PO and then move into the supervisor bill upload flow.
      // Cash Added approvals become approved here and then update the site ledger.
      if (exp?.transactionType === "Purchase") {
        const generatedPo = options.poNumber || await generatePoNumberForSite(
          exp.siteId ? String(exp.siteId) : undefined,
          exp.site,
          exp.projectId ? String(exp.projectId) : undefined
        );
        generatedPoNumber = generatedPo;
        // Keep status Pending so the supervisor still has to upload a
        // receipt. The approval record itself becomes "Approved" below.
        await Expense.updateOne(
          { _id: approval.sourceId },
          {
            status: "Approved",
            approvedBy: reviewer,
            approvedAt: new Date(),
            poNumber: generatedPo,
            ...(options.issuedAmount !== undefined ? { issuedAmount: options.issuedAmount } : {}),
            ...(options.givenAmount !== undefined ? { givenAmount: options.givenAmount } : {}),
          }
        );
      } else {
        await Expense.updateOne({ _id: approval.sourceId }, sourceUpdate);
        if (exp?.projectId && exp.site) {
          await recomputeSiteLedger(exp.projectId, exp.site);
        }
      }
      projectId = exp?.projectId;
      if (exp?.isSiteMaterial) {
        const materialId = await generateId("MAT");
        const createdMaterial = await (await import("../models/Material.js")).Material.create({
          materialId,
          projectId: exp.projectId,
          projectName: exp.projectName,
          clientId: exp.clientId,
          clientName: exp.clientName,
          siteId: exp.siteId,
          site: exp.site,
          name: exp.materialName || exp.description,
          unit: exp.materialUnit || "units",
          requestedQuantity: exp.materialQuantity || 1,
          approvedQuantity: exp.materialQuantity || 1,
          purchasedQuantity: 0,
          consumedQuantity: 0,
          remainingStock: exp.materialQuantity || 1,
          vendor: exp.materialVendor,
          vendorId: exp.materialVendorId,
          poNumber: generatedPoNumber,
          status: "Approved",
          approvedBy: reviewer,
          approvedAt: new Date(),
          requestDate: exp.date,
          createdBy: exp.submittedBy,
          issuedAmount: options.issuedAmount,
          givenAmount: options.givenAmount,
          supervisorName: exp.supervisor,
          notes: exp.notes,
          ...(options.issuedAmount !== undefined ? { issuedAmount: options.issuedAmount } : {}),
          ...(options.givenAmount !== undefined ? { givenAmount: options.givenAmount } : {}),
        });
        await addApprovedMaterialToInventory(
          createdMaterial._id,
          createdMaterial.approvedQuantity,
          reviewer
        );
      }
      break;
    }
    case "payments":
    case "Payment": {
      await Payment.updateOne({ _id: approval.sourceId }, sourceUpdate);
      const pay = await Payment.findById(approval.sourceId).lean();
      projectId = pay?.projectId;
      break;
    }
    case "subcontractors":
    case "Subcontractor": {
      await Subcontractor.updateOne({ _id: approval.sourceId }, sourceUpdate);
      const sub = await Subcontractor.findById(approval.sourceId).lean();
      projectId = sub?.projectId;
      break;
    }
    default:
      throw new AppError(400, `Unknown source collection: ${approval.sourceCollection}`);
  }

  approval.status = "Approved";
  approval.reviewedBy = reviewer;
  approval.reviewedAt = new Date();
  if (generatedPoNumber) {
    approval.poNumber = generatedPoNumber;
  }
  await approval.save();

  if (projectId) {
    await recomputeProjectTotals(projectId);
  }

  // Send push notification to project supervisors and owner (non-blocking best-effort)
  try {
    const { notifyProjectSupervisors, notifyUserOfApproval } = await import("./device-token.service.js");
    const notificationData = {
      approvalId: approval.approvalId,
      type: approval.type,
      status: "Approved",
      projectId: approval.projectId?.toString() || "",
      ...(generatedPoNumber && { poNumber: generatedPoNumber }),
    };
    if (projectId) {
      await notifyProjectSupervisors(
        projectId,
        `${approval.title} - Approved`,
        generatedPoNumber
          ? `Your ${approval.type} request has been approved. PO: ${generatedPoNumber}`
          : `Your ${approval.type} request has been approved`,
        notificationData
      );
    }
    // Notify the owner who submitted the request
    if (approval.owner) {
      await notifyUserOfApproval(
        approval.owner,
        `${approval.title} - Approved`,
        generatedPoNumber
          ? `Your ${approval.type} request has been approved. PO: ${generatedPoNumber}`
          : `Your ${approval.type} request has been approved`,
        notificationData
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
    case "Material": {
      await Material.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
    }
    case "labour":
    case "Labour": {
      await Labour.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
    }
    case "expenses":
    case "Expense": {
      await Expense.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
    }
    case "payments":
    case "Payment": {
      await Payment.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
    }
    case "subcontractors":
    case "Subcontractor": {
      await Subcontractor.updateOne({ _id: approval.sourceId }, sourceUpdate);
      break;
    }
  }

  approval.status = "Rejected";
  approval.reviewedBy = reviewer;
  approval.reviewedAt = new Date();
  await approval.save();

  // Send push notification to project supervisors and owner
  try {
    const { notifyProjectSupervisors, notifyUserOfApproval } = await import("./device-token.service.js");
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
    // Notify the owner who submitted the request
    if (approval.owner) {
      await notifyUserOfApproval(
        approval.owner,
        `${approval.title} - Rejected`,
        `Your ${approval.type} request has been rejected`,
        {
          approvalId: approval.approvalId,
          type: approval.type,
          status: "Rejected",
          projectId: approval.projectId?.toString() || "",
        }
      );
    }
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
  userRole?: string;
  userId?: string;
}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  else query.status = "Pending";
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  // No permission-based type filtering – all roles can see all approval types
  if (filter.type) query.type = filter.type;
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Approval.find(query).sort({ submittedAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Approval.countDocuments(query),
  ]);

  const enriched = await Promise.all(items.map((item) => enrichApprovalWithSource(item)));
  return { items: enriched, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

async function enrichApprovalWithSource(approval: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sourceCollection = approval.sourceCollection as string;
  const sourceId = approval.sourceId as Types.ObjectId | undefined;
  const owner = approval.owner as string | undefined;

  let sourceData: Record<string, unknown> | null = null;
  let supervisorName: string | undefined;

  if (sourceId && sourceCollection) {
    try {
      if (sourceCollection === "Material" || sourceCollection === "materials") {
        const doc = await (await import("../models/Material.js")).Material.findById(sourceId).lean();
        if (doc) {
          const d = doc as any;
          sourceData = {
            materialName: d.name,
            unit: d.unit,
            requestedQuantity: d.requestedQuantity,
            approvedQuantity: d.approvedQuantity,
            vendor: d.vendor,
            poNumber: d.poNumber,
            requestDate: d.requestDate || (d.createdAt ? new Date(d.createdAt).toISOString().slice(0,10) : new Date().toISOString().slice(0,10)),
            submittedBy: d.createdBy,
            clientName: d.clientName,
            supervisorName: d.supervisorName,
            issuedAmount: d.issuedAmount,
            givenAmount: d.givenAmount,
          };
        }
      } else if (sourceCollection === "Labour" || sourceCollection === "labour") {
        const doc = await (await import("../models/Labour.js")).Labour.findById(sourceId).lean();
        if (doc) {
          sourceData = {
            attendanceDate: doc.attendanceDate,
            staffName: doc.partyName,
            labourTypes: doc.category,
            staffCount: doc.presentCount,
            dailyWage: doc.dailyWage,
            shift: doc.shift,
            overtimeHours: doc.overtime,
            lateFine: doc.lateFine,
            submittedBy: doc.submittedBy,
          };
        }
      } else if (sourceCollection === "Expense" || sourceCollection === "expenses") {
        const doc = await (await import("../models/Expense.js")).Expense.findById(sourceId).lean();
        if (doc) {
          sourceData = {
            expenseDate: doc.date,
            transactionType: doc.transactionType,
            description: doc.description,
            amount: doc.amount,
            submittedBy: doc.submittedBy,
            clientName: doc.clientName,
            supervisorName: doc.supervisor,
            isSiteMaterial: doc.isSiteMaterial,
            siteMaterialName: doc.materialName,
            materialUnit: doc.materialUnit,
            materialQuantity: doc.materialQuantity,
            materialVendor: doc.materialVendor,
            issuedAmount: doc.issuedAmount,
            givenAmount: doc.givenAmount,
            billUrl: doc.billUrl,
            poNumber: doc.poNumber,
          };
        }
      }
    } catch {
      // source document not found - skip enrichment
    }
  }

  if (owner && !supervisorName) {
    try {
      const { User } = await import("../models/User.js");
      const user = await User.findById(owner).select("name").lean();
      supervisorName = user?.name;
    } catch {
      // user lookup failed, skip
    }
  }

  return { ...approval, ...sourceData, supervisorName: supervisorName || sourceData?.["supervisorName"] };
}

export async function getApprovalById(id: string) {
  const approval = await Approval.findOne({ approvalId: id }).lean();
  if (!approval) throw new AppError(404, "Approval not found");
  return approval;
}

export async function getApprovalCount(filter: { projectId?: string; type?: ApprovalType; scopeProjectIds?: ProjectScopeIds; userRole?: string; userId?: string } = {}) {
  const query: Record<string, unknown> = { status: "Pending" };
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  // No permission-based type filtering – all roles can see all approval types
  if (filter.type) query.type = filter.type;

  const [total, byType] = await Promise.all([
    Approval.countDocuments(query),
    Approval.aggregate([
      { $match: query },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);
  return { total, byType };
}
