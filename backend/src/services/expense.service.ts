import { Types } from "mongoose";
import { Expense } from "../models/Expense.js";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { createApproval } from "./approval.service.js";
import { CreateExpenseInput } from "../schemas/financial.schema.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";

async function computeRunningBalance(
  projectId: Types.ObjectId,
  site: string,
  newAmount: number,
  date: string
): Promise<number> {
  const last = await Expense.findOne({
    projectId,
    site,
    type: "site",
    date: { $lte: date },
  })
    .sort({ date: -1, createdAt: -1 })
    .lean();
  return (last?.runningBalance ?? 0) + newAmount;
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
  let runningBalance = 0;
  if (input.type === "site" && project && input.site) {
    runningBalance = await computeRunningBalance(project._id, input.site, input.amount, input.date);
  }

  const isCashAdded = input.transactionType === "Cash Added";
  const status = isCashAdded ? "Approved" : "Pending";

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
    reference: input.reference,
    runningBalance,
    department: input.department,
    category: input.category,
    amountPaidBy: input.amountPaidBy,
    date: input.date,
    description: input.description,
    submittedBy: input.submittedBy,
    customFields: input.customFields,
    status,
  });

  if (!isCashAdded) {
    await createApproval({
      type: "expense",
      title: `${input.type === "site" ? "Site" : "General"}: ${input.description.slice(0, 50)}`,
      sourceCollection: "expenses",
      sourceId: expense._id,
      projectId: project?._id,
      projectName: project?.name,
      site: input.site,
      amount: input.amount,
      detail: input.description,
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
