import { Types } from "mongoose";
import { Expense } from "../models/Expense.js";
import { Approval } from "../models/Approval.js";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { CreateExpenseInput } from "../schemas/financial.schema.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { findAllOrFallback } from "../utils/find-all.js";
import { withRetry } from "../utils/retry.js";
import { dbMutex } from "../utils/db-mutex.js";
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

/**
 * Single-shot "give me everything" endpoint.
 *
 * Strategy: try one big query first. If M0 times out (which happens
 * during cold-start or when the pool is exhausted), transparently fall
 * back to a cursor-paginated walk that pages through 25 rows at a time
 * and always returns data — never throws.
 *
 * Default cap is 500.
 */
export async function listAllExpenses(filter: {
  type?: string;
  projectId?: string;
  siteId?: string;
  site?: string;
  status?: string;
  from?: string;
  to?: string;
  scopeProjectIds?: ProjectScopeIds;
  max?: number;
}): Promise<any[]> {
  const query: Record<string, unknown> = {};
  if (filter.type) query.type = filter.type;
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.site) query.site = filter.site;
  if (filter.status) query.status = filter.status;
  if (filter.from || filter.to) {
    query.date = {};
    if (filter.from) (query.date as Record<string, string>).$gte = filter.from;
    if (filter.to) (query.date as Record<string, string>).$lte = filter.to;
  }
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  return findAllOrFallback(Expense, "expenses/all", query, filter.max ?? 500);
}

export async function listExpenses(filter: {
  type?: string;
  projectId?: string;
  siteId?: string;
  site?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  cursor?: string;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.type) query.type = filter.type;
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.site) query.site = filter.site;
  if (filter.status) query.status = filter.status;
  if (filter.from || filter.to) {
    query.date = {};
    if (filter.from) (query.date as Record<string, string>).$gte = filter.from;
    if (filter.to) (query.date as Record<string, string>).$lte = filter.to;
  }
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  // Cursor-based pagination via _id — O(log n) range query on the _id
  // index, no skip-and-scan that M0 can't handle above ~25 rows.
  if (filter.cursor) {
    try {
      query._id = { $gt: new Types.ObjectId(filter.cursor) };
    } catch {
      // Invalid cursor → start from beginning
    }
  }

  // DIAGNOSTIC: log the query that will be executed against M0
  console.log(
    `[listExpenses.diag] query=${JSON.stringify(query)} limit=${filter.limit ?? "default"} scope=${filter.scopeProjectIds?.length ?? "null"}`
  );

  // Cap default at 25 — Atlas M0 free tier rate-limit/rejection threshold.
  // Use cursor to paginate beyond 25 if the caller asks for more.
  const effectiveLimit = Math.min(Math.max(filter.limit || 25, 1), 25);
  type ExpenseLike = { [k: string]: unknown };
  let items: ExpenseLike[] = [];
  let total = 0;
  let nextCursor: string | null = null;
  try {
    // Serialize through the in-process mutex so this query doesn't
    // contend with other concurrent requests for the M0 cluster's
    // shared resources.
    //
    // Exclude receiptImage, billUrl, and customFields from list queries —
    // receiptImage is base64 (100KB-2MB), billUrl can occasionally be
    // large, and customFields is Mixed type that can store arbitrary
    // data. The single-record GET endpoint still returns the full document.
    const foundItems = await dbMutex.run(() =>
      withRetry(
        () => Expense.find(query)
          .select({ receiptImage: 0, billUrl: 0, customFields: 0 })
          .sort({ _id: -1 })
          .limit(effectiveLimit + 1)
          .lean()
          .maxTimeMS(10000),
        { label: "listExpenses.find" }
      )
    );
    if (!filter.cursor) {
      try {
        const foundTotal = await dbMutex.run(() =>
          withRetry(
            () => Expense.countDocuments(query).maxTimeMS(8000),
            { label: "listExpenses.count" }
          )
        );
        total = foundTotal;
      } catch (countErr) {
        console.warn("[listExpenses] countDocuments failed (non-fatal):", (countErr as Error).message);
        total = items.length;
      }
    } else {
      total = filter.page * effectiveLimit;
    }
    items = foundItems as unknown as ExpenseLike[];
    if (items.length > effectiveLimit) {
      const nextItem = items.pop();
      if (nextItem && (nextItem as any)._id) {
        nextCursor = String((nextItem as any)._id);
      }
    }
  } catch (err) {
    console.error("[listExpenses] main query failed, returning empty:", (err as Error).message);
  }
  return {
    items,
    total,
    page: filter.page,
    limit: effectiveLimit,
    pages: Math.ceil(total / effectiveLimit),
    nextCursor,
  };
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

  const customFields = (patch as any).customFields as Record<string, unknown> | undefined;
  if (customFields) {
    delete update.customFields;
    for (const [key, val] of Object.entries(customFields)) {
      update[`customFields.${key}`] = val;
    }
  }

  const expense = await Expense.findByIdAndUpdate(id, update, { new: true });
  if (!expense) throw new AppError(404, "Expense not found");
  return expense.toObject();
}

export async function uploadExpenseReceipt(
  id: string,
  payload: { data: string; mimeType: string; fileName?: string; givenAmount?: number }
) {
  console.log(`[uploadExpenseReceipt svc] id=${id} givenAmount=${payload.givenAmount}`);
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError(404, "Expense not found");
  if (expense.status !== "Pending" && expense.status !== "Approved" && expense.status !== "Completed") {
    throw new AppError(400, "Receipt upload is not allowed for this expense");
  }
  console.log(`[uploadExpenseReceipt svc] status=${expense.status} type=${expense.type} site=${expense.site}`);

  try {
    const pcloudResult = await uploadToPCloud(
      payload.data,
      payload.fileName || `receipt_${expense.expenseId}.${payload.mimeType.split("/")[1] || "jpg"}`,
      payload.mimeType
    );
    expense.billUrl = pcloudResult.fileUrl;
    expense.receiptImageName = pcloudResult.fileName;
    console.log(`[uploadExpenseReceipt svc] pCloud OK: ${pcloudResult.fileUrl?.substring(0, 60)}`);
  } catch (err) {
    console.warn("[uploadExpenseReceipt svc] pCloud failed, falling back to base64:", err);
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
  console.log(`[uploadExpenseReceipt svc] saved`);

  if (expense.type === "site" && expense.projectId && expense.site) {
    console.log(`[uploadExpenseReceipt svc] recomputing ledger for ${expense.projectId}/${expense.site}`);
    await recomputeSiteLedger(expense.projectId, expense.site);
    console.log(`[uploadExpenseReceipt svc] ledger done`);
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
