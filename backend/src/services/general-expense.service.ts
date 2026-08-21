import { Types } from "mongoose";
import { GeneralExpense, IGeneralExpense, GeneralExpenseStatus } from "../models/GeneralExpense.js";
import { Project } from "../models/Project.js";
import { Site } from "../models/Site.js";
import { Client } from "../models/Client.js";
import { AppError } from "../middleware/errorHandler.js";
import { ProjectScopeIds } from "../utils/scope.js";

export interface CreateGeneralExpenseInput {
  origin?: string;
  category?: string;
  amount: number;
  date: string;
  description: string;
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  siteId?: string;
  site?: string;
  notes?: string;
  paymentMode?: string;
  paidBy?: string;
  reference?: string;
  status?: GeneralExpenseStatus;
  customFields?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateGeneralExpenseInput extends Partial<CreateGeneralExpenseInput> {}

export interface ListGeneralExpensesInput {
  projectId?: string;
  siteId?: string;
  category?: string;
  status?: GeneralExpenseStatus;
  from?: string;
  to?: string;
  search?: string;
  scopeProjectIds?: ProjectScopeIds;
  page?: number;
  limit?: number;
  cursor?: string;
}

async function resolveNames(input: {
  projectId?: string;
  clientId?: string;
  siteId?: string;
}): Promise<{ projectName?: string; clientName?: string; site?: string }> {
  const result: { projectName?: string; clientName?: string; site?: string } = {};
  if (input.projectId && Types.ObjectId.isValid(input.projectId)) {
    const project = await Project.findById(input.projectId).select("name client").lean();
    if (project) {
      result.projectName = project.name;
      if (!input.clientId && project.client) {
        const client = await Client.findOne({ name: project.client }).select("name").lean();
        if (client) result.clientName = client.name;
      }
    }
  }
  if (input.clientId && Types.ObjectId.isValid(input.clientId)) {
    const client = await Client.findById(input.clientId).select("name").lean();
    if (client) result.clientName = client.name;
  }
  if (input.siteId && Types.ObjectId.isValid(input.siteId)) {
    const site = await Site.findById(input.siteId).select("name").lean();
    if (site) result.site = site.name;
  }
  return result;
}

function generateExpenseId(): string {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `GE-${ts}${random}`;
}

function applyScope(
  match: Record<string, unknown>,
  scopeProjectIds: ProjectScopeIds
): void {
  if (scopeProjectIds === null) return;
  if (!Array.isArray(scopeProjectIds) || scopeProjectIds.length === 0) {
    match.projectId = { $in: [] };
    return;
  }
  match.projectId = { $in: scopeProjectIds };
}

export async function createGeneralExpense(input: CreateGeneralExpenseInput): Promise<IGeneralExpense> {
  if (!input.description || !input.description.trim()) {
    throw new AppError(400, "description is required");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new AppError(400, "amount must be a non-negative number");
  }
  if (!input.date || !input.date.trim()) {
    throw new AppError(400, "date is required");
  }

  let projectId: Types.ObjectId | undefined;
  if (input.projectId && Types.ObjectId.isValid(input.projectId)) {
    projectId = new Types.ObjectId(input.projectId);
  }

  let clientId: Types.ObjectId | undefined;
  if (input.clientId && Types.ObjectId.isValid(input.clientId)) {
    clientId = new Types.ObjectId(input.clientId);
  }

  let siteId: Types.ObjectId | undefined;
  if (input.siteId && Types.ObjectId.isValid(input.siteId)) {
    siteId = new Types.ObjectId(input.siteId);
  }

  const names = await resolveNames({
    projectId: projectId?.toString(),
    clientId: clientId?.toString(),
    siteId: siteId?.toString(),
  });

  const expense = await GeneralExpense.create({
    expenseId: generateExpenseId(),
    origin: input.origin?.trim() || "manual",
    category: input.category?.trim() || undefined,
    amount: input.amount,
    date: input.date,
    description: input.description.trim(),
    projectId,
    projectName: input.projectName || names.projectName,
    clientId,
    clientName: input.clientName || names.clientName,
    siteId,
    site: input.site || names.site,
    notes: input.notes?.trim(),
    paymentMode: input.paymentMode?.trim() || "Cash",
    paidBy: input.paidBy?.trim() || undefined,
    reference: input.reference?.trim() || undefined,
    status: input.status || "Approved",
    customFields: input.customFields || {},
    createdBy: input.createdBy,
  });

  if (projectId) {
    await recomputeProjectExpenseTotal(projectId);
  }

  return expense;
}

export async function updateGeneralExpense(
  id: string,
  input: UpdateGeneralExpenseInput
): Promise<IGeneralExpense> {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
  const existing = await GeneralExpense.findById(id);
  if (!existing) throw new AppError(404, "General expense not found");

  if (input.amount !== undefined && (!Number.isFinite(input.amount) || input.amount < 0)) {
    throw new AppError(400, "amount must be a non-negative number");
  }

  if (input.origin !== undefined) existing.origin = input.origin.trim() || "manual";
  if (input.category !== undefined) existing.category = input.category?.trim() || undefined;
  if (input.amount !== undefined) existing.amount = input.amount;
  if (input.date !== undefined) existing.date = input.date;
  if (input.description !== undefined) existing.description = input.description.trim();
  if (input.notes !== undefined) existing.notes = input.notes?.trim() || undefined;
  if (input.paymentMode !== undefined) existing.paymentMode = input.paymentMode.trim() || "Cash";
  if (input.paidBy !== undefined) existing.paidBy = input.paidBy.trim() || undefined;
  if (input.reference !== undefined) existing.reference = input.reference.trim() || undefined;
  if (input.status !== undefined) existing.status = input.status;
  if (input.customFields !== undefined) existing.customFields = input.customFields;

  if (input.projectId !== undefined) {
    if (input.projectId && Types.ObjectId.isValid(input.projectId)) {
      existing.projectId = new Types.ObjectId(input.projectId);
    } else if (input.projectId === null || input.projectId === "") {
      existing.projectId = undefined;
    }
  }
  if (input.clientId !== undefined) {
    if (input.clientId && Types.ObjectId.isValid(input.clientId)) {
      existing.clientId = new Types.ObjectId(input.clientId);
    } else if (input.clientId === null || input.clientId === "") {
      existing.clientId = undefined;
    }
  }
  if (input.siteId !== undefined) {
    if (input.siteId && Types.ObjectId.isValid(input.siteId)) {
      existing.siteId = new Types.ObjectId(input.siteId);
    } else if (input.siteId === null || input.siteId === "") {
      existing.siteId = undefined;
    }
  }

  // Re-resolve display names when project/site/client change.
  const names = await resolveNames({
    projectId: existing.projectId?.toString(),
    clientId: existing.clientId?.toString(),
    siteId: existing.siteId?.toString(),
  });
  if (input.projectName !== undefined) existing.projectName = input.projectName;
  else if (names.projectName && !existing.projectName) existing.projectName = names.projectName;
  if (input.clientName !== undefined) existing.clientName = input.clientName;
  else if (names.clientName && !existing.clientName) existing.clientName = names.clientName;
  if (input.site !== undefined) existing.site = input.site;
  else if (names.site && !existing.site) existing.site = names.site;

  await existing.save();

  if (existing.projectId) {
    await recomputeProjectExpenseTotal(existing.projectId);
  }

  return existing;
}

export async function deleteGeneralExpense(id: string): Promise<IGeneralExpense | null> {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
  const existing = await GeneralExpense.findByIdAndDelete(id);
  if (existing?.projectId) {
    await recomputeProjectExpenseTotal(existing.projectId);
  }
  return existing;
}

export async function getGeneralExpenseById(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
  return GeneralExpense.findById(id).lean();
}

export async function uploadGeneralExpenseReceipt(
  id: string,
  payload: { data: string; mimeType: string; fileName?: string }
) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
  const expense = await GeneralExpense.findById(id);
  if (!expense) throw new AppError(404, "General expense not found");

  const { uploadToPCloud } = await import("./pcloud.service.js");
  try {
    const pcloudResult = await uploadToPCloud(
      payload.data,
      payload.fileName || `receipt_${expense.expenseId}.${payload.mimeType.split("/")[1] || "jpg"}`,
      payload.mimeType
    );
    expense.billUrl = pcloudResult.mediaUrl;
    expense.pcloudFileId = pcloudResult.fileId;
    expense.pcloudPublicCode = pcloudResult.publicCode;
    expense.receiptImageName = pcloudResult.fileName;
    expense.reference = pcloudResult.fileName;
    await expense.save();
    return expense.toObject();
  } catch (error) {
    console.error("[pCloud] Upload failed for general expense:", error);
    throw new AppError(503, "Bill upload failed. Please retry after pCloud is available.");
  }
}

export async function listGeneralExpenses(params: ListGeneralExpensesInput) {
  const match: Record<string, unknown> = {};
  if (params.projectId && Types.ObjectId.isValid(params.projectId)) {
    match.projectId = new Types.ObjectId(params.projectId);
  }
  if (params.siteId && Types.ObjectId.isValid(params.siteId)) {
    match.siteId = new Types.ObjectId(params.siteId);
  }
  if (params.category) match.category = params.category;
  if (params.status) match.status = params.status;
  if (params.from || params.to) {
    const date: Record<string, string> = {};
    if (params.from) date.$gte = params.from;
    if (params.to) date.$lte = params.to;
    match.date = date;
  }
  if (params.search) {
    match.$or = [
      { description: { $regex: params.search, $options: "i" } },
      { notes: { $regex: params.search, $options: "i" } },
      { category: { $regex: params.search, $options: "i" } },
    ];
  }
  applyScope(match, params.scopeProjectIds ?? null);

  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);
  const page = Math.max(params.page ?? 1, 1);

  try {
    const [items, total] = await Promise.all([
      GeneralExpense.find(match)
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      GeneralExpense.countDocuments(match),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit), queryFailed: false };
  } catch (e) {
    console.error("[listGeneralExpenses] db error:", (e as Error).message);
    return {
      items: [],
      total: 0,
      page,
      limit,
      pages: 0,
      queryFailed: true,
    };
  }
}

export async function listAllGeneralExpenses(params: Omit<ListGeneralExpensesInput, "page" | "limit" | "cursor">) {
  const match: Record<string, unknown> = {};
  if (params.projectId && Types.ObjectId.isValid(params.projectId)) {
    match.projectId = new Types.ObjectId(params.projectId);
  }
  if (params.siteId && Types.ObjectId.isValid(params.siteId)) {
    match.siteId = new Types.ObjectId(params.siteId);
  }
  if (params.category) match.category = params.category;
  if (params.status) match.status = params.status;
  if (params.from || params.to) {
    const date: Record<string, string> = {};
    if (params.from) date.$gte = params.from;
    if (params.to) date.$lte = params.to;
    match.date = date;
  }
  applyScope(match, params.scopeProjectIds ?? null);

  const items = await GeneralExpense.find(match).sort({ date: -1, _id: -1 }).lean();
  return { items, total: items.length };
}

/**
 * Recompute the sum of approved GeneralExpense rows for a project and
 * persist it onto Project.totalExpenseReceived alongside the existing
 * site-expense sum. The existing value is preserved so this call is
 * additive rather than destructive.
 */
export async function recomputeProjectExpenseTotal(
  projectObjectId: Types.ObjectId,
  legacyExpenseTotal?: number,
  recomputeLegacyIfMissing = true
): Promise<number> {
  const project = await Project.findById(projectObjectId).select("_id totalExpenseReceived").lean();
  if (!project) return 0;

  const [generalAgg] = await Promise.all([
    GeneralExpense.aggregate([
      { $match: { projectId: projectObjectId, status: "Approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  const generalTotal = generalAgg[0]?.total ?? 0;

  let legacyTotal = legacyExpenseTotal;
  if (legacyTotal === undefined) {
    if (!recomputeLegacyIfMissing) {
      // Caller is responsible for the legacy side; current
      // totalExpenseReceived is treated as the authoritative sum.
      await Project.updateOne(
        { _id: projectObjectId },
        { $inc: { totalExpenseReceived: generalTotal }, $set: { lastActivityAt: new Date() } }
      );
      const updated = await Project.findById(projectObjectId).select("totalExpenseReceived").lean();
      return updated?.totalExpenseReceived ?? 0;
    }
    const Expense = (await import("../models/Expense.js")).Expense;
    const legacyAgg = await Expense.aggregate([
      { $match: { projectId: projectObjectId, type: "site", status: "Approved", transactionType: { $ne: "Cash Added" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    legacyTotal = legacyAgg?.[0]?.total ?? 0;
  }

  const newTotal = legacyTotal + generalTotal;
  await Project.updateOne(
    { _id: projectObjectId },
    { $set: { totalExpenseReceived: newTotal, lastActivityAt: new Date() } }
  );
  return newTotal;
}
