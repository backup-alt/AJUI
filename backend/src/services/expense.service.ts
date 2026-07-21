import { Types } from "mongoose";
import { Expense } from "../models/Expense.js";
import { Approval } from "../models/Approval.js";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { CreateExpenseInput } from "../schemas/financial.schema.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { generatePoNumberForSite } from "./po-number.service.js";
import { uploadToPCloud } from "./pcloud.service.js";

/**
 * Recompute the running balance for every approved site expense of a single
 * (projectId, site) pair in chronological order. The opening balance is the
 * earliest Cash Added record for that site (if any), otherwise 0. Each row
 * is then assigned `previous + signedAmount`, clamped at 0.
 */
export async function recomputeSiteLedger(
  projectId: Types.ObjectId,
  site: string
): Promise<void> {
  const expenses = await Expense.find({
    projectId,
    site,
    type: "site",
    status: "Approved",
  })
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean();

  const earliestCashAdded = expenses.find(
    (row) => row.transactionType === "Cash Added"
  );
  let running = Number(earliestCashAdded?.amount ?? 0);

  for (const row of expenses) {
    const amount = Number(row.amount) || 0;
    if (row._id.toString() === earliestCashAdded?._id.toString()) {
      running = amount;
    } else if (row.transactionType === "Cash Added") {
      running += amount;
    } else {
      running = Math.max(0, running - amount);
    }
    if (Number(row.runningBalance ?? 0) !== running) {
      await Expense.updateOne({ _id: row._id }, { $set: { runningBalance: running } });
    }
  }
}

/**
 * Recompute every (projectId, site) pair that has approved site expenses.
 * This is the single source of truth for balances shown in both the web
 * and mobile apps.
 */
export async function recomputeAllSiteLedgers(): Promise<void> {
  const groups = await Expense.aggregate<{ _id: { projectId: Types.ObjectId; site: string } }>([
    { $match: { type: "site", status: "Approved" } },
    {
      $group: {
        _id: { projectId: "$projectId", site: "$site" },
      },
    },
  ]);
  for (const group of groups) {
    if (!group?._id?.projectId || !group?._id?.site) continue;
    await recomputeSiteLedger(group._id.projectId, group._id.site);
  }
}

export async function createExpense(input: CreateExpenseInput) {
  let project: { _id: Types.ObjectId; name: string; clientId: Types.ObjectId } | null = null;
  let client: { _id: Types.ObjectId; name: string } | null = null;

  if (input.type === "site") {
    if (!input.projectId) throw new AppError(400, "projectId required for site expense");
    project = await Project.findById(input.projectId);
    if (!project) throw new AppError(404, "Project not found");
    client = await Client.findById(project.clientId);
    if (!client) throw new AppError(404, "Client not found");
  }

  const expenseId = await generateId("EXP");
  const status = "Pending";

  const expense = await Expense.create({
    expenseId,
    type: input.type,
    projectId: project?._id,
    projectName: project?.name,
    clientId: client?._id,
    siteId: input.siteId ? new Types.ObjectId(input.siteId) : undefined,
    site: input.site,
    supervisor: input.supervisor,
    supervisorId: input.supervisorId ? new Types.ObjectId(input.supervisorId) : undefined,
    transactionType: input.transactionType,
    amount: input.amount,
    siteMaterialBalance: input.siteMaterialBalance,
    runningBalance: 0,
    date: input.date,
    description: input.description,
    notes: input.notes,
    submittedBy: input.submittedBy,
    isSiteMaterial: input.isSiteMaterial,
    materialName: input.materialName,
    materialUnit: input.materialUnit,
    materialQuantity: input.materialQuantity,
    materialVendor: input.materialVendor,
    materialVendorId: input.materialVendorId
      ? new Types.ObjectId(input.materialVendorId)
      : undefined,
    materialRemainingStock: input.materialRemainingStock,
    issuedAmount: input.issuedAmount,
    customFields: input.customFields,
    status,
  });

  if (input.type === "site") {
    const isSiteMaterialExpense = input.isSiteMaterial === true;
    await Approval.create({
      approvalId: await generateId("APR"),
      type: "expense",
      title: isSiteMaterialExpense
        ? `Site Material: ${expense.materialName || expense.description}`
        : input.transactionType === "Cash Added"
        ? `Cash Added: ${expense.description}`
        : `Site Expense: ${expense.description}`,
      sourceCollection: "expenses",
      sourceId: expense._id,
      projectId: expense.projectId,
      projectName: expense.projectName,
      site: expense.site,
      owner: input.submittedBy,
      amount: expense.amount,
      detail: isSiteMaterialExpense
        ? `Material: ${expense.materialName} - Qty: ${expense.materialQuantity} ${expense.materialUnit}`
        : `${expense.transactionType || "Expense"} - ${expense.description}`,
      status: "Pending",
      submittedAt: new Date(),
    });
  }

  return expense.toObject();
}

export async function listExpenses(filter: {
  type?: string;
  projectId?: string;
  siteId?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.type) query.type = filter.type;
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.status) query.status = filter.status;
  if (filter.from || filter.to) {
    query.date = {};
    if (filter.from) (query.date as Record<string, string>).$gte = filter.from;
    if (filter.to) (query.date as Record<string, string>).$lte = filter.to;
  }
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Expense.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Expense.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function getExpenseById(id: string) {
  const expense = await Expense.findById(id).lean();
  if (!expense) throw new AppError(404, "Expense not found");
  return expense;
}

export async function updateExpense(id: string, patch: Partial<CreateExpenseInput>) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.siteId) update.siteId = new Types.ObjectId(patch.siteId);
  if (patch.supervisorId) update.supervisorId = new Types.ObjectId(patch.supervisorId);
  if (patch.projectId) update.projectId = new Types.ObjectId(patch.projectId);

  const expense = await Expense.findByIdAndUpdate(id, update, { new: true });
  if (!expense) throw new AppError(404, "Expense not found");
  return expense.toObject();
}

export async function uploadExpenseReceipt(
  id: string,
  payload: { data: string; mimeType: string; fileName?: string; givenAmount?: number }
) {
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError(404, "Expense not found");
  if (expense.status !== "Pending" && expense.status !== "Approved" && expense.status !== "Completed") {
    throw new AppError(400, "Receipt upload is not allowed for this expense");
  }

  try {
    const pcloudResult = await uploadToPCloud(
      payload.data,
      payload.fileName || `receipt_${expense.expenseId}.${payload.mimeType.split("/")[1] || "jpg"}`,
      payload.mimeType
    );
    expense.billUrl = pcloudResult.fileUrl;
    expense.receiptImageName = pcloudResult.fileName;
  } catch (err) {
    console.warn("[pCloud] Upload failed, falling back to base64 storage:", err);
    expense.receiptImage = payload.data;
    expense.receiptImageMimeType = payload.mimeType;
    expense.receiptImageName = payload.fileName;
    expense.billUrl = `data:${payload.mimeType};base64,${payload.data}`;
  }

  if (payload.givenAmount !== undefined) {
    expense.givenAmount = payload.givenAmount;
    expense.received = true;
    expense.status = "Completed";
  }

  expense.receiptUploadedAt = new Date();
  await expense.save();

  if (expense.type === "site" && expense.projectId && expense.site) {
    await recomputeSiteLedger(expense.projectId, expense.site);
  }

  if (expense.poNumber && expense.billUrl) {
    const { Material } = await import("../models/Material.js");
    await Material.updateOne({ poNumber: expense.poNumber }, { billUrl: expense.billUrl });
  }

  return expense.toObject();
}

export async function markExpenseAsReceived(id: string) {
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError(404, "Expense not found");
  if (expense.status !== "Approved") {
    throw new AppError(400, "Only approved expenses can be marked as received");
  }
  if (!expense.billUrl && !expense.receiptImage) {
    throw new AppError(400, "Bill must be uploaded before marking as received");
  }

  expense.received = true;
  expense.status = "Completed";
  await expense.save();

  if (expense.type === "site" && expense.projectId && expense.site) {
    await recomputeSiteLedger(expense.projectId, expense.site);
  }

  return expense.toObject();
}

export async function deleteExpense(id: string) {
  const result = await Expense.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Expense not found");
}

export async function getExpenseLedger(projectId: string, site: string, scopeProjectIds?: ProjectScopeIds) {
  const pid = new Types.ObjectId(projectId);
  const query: Record<string, unknown> = { projectId: pid, site, type: "site" };
  applyProjectScope(query, "projectId", scopeProjectIds);
  return Expense.find(query)
    .sort({ date: 1, createdAt: 1 })
    .lean();
}

export async function getPendingExpenses(scopeProjectIds?: ProjectScopeIds) {
  const query: Record<string, unknown> = { status: "Pending" };
  applyProjectScope(query, "projectId", scopeProjectIds);
  return Expense.find(query).sort({ createdAt: -1 }).lean();
}

/**
 * Site-level balance summary: opening (earliest Cash Added or 0), total
 * cash added, total spent, and current balance. Values are derived from
 * actual approved transactions only.
 */
export async function getSiteBalanceSummary(projectId: string, site: string) {
  const pid = new Types.ObjectId(projectId);
  const [rows, earliest] = await Promise.all([
    Expense.find({ projectId: pid, site, type: "site", status: "Approved" })
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .lean(),
    Expense.findOne({ projectId: pid, site, type: "site", status: "Approved", transactionType: "Cash Added" })
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .lean(),
  ]);
  const cashAdded = rows
    .filter((r) => r.transactionType === "Cash Added")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const spent = rows
    .filter((r) => r.transactionType !== "Cash Added")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const opening = Number(earliest?.amount ?? 0);
  const current = Math.max(0, cashAdded - spent);
  return { opening, cashAdded, spent, current };
}
