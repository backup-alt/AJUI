import { Types } from "mongoose";
import { Payment } from "../models/Payment";
import { Project } from "../models/Project";
import { Client } from "../models/Client";
import { AppError } from "../middleware/errorHandler";
import { generateId } from "./id-generator.service";
import { createApproval } from "./approval.service";
import { CreatePaymentInput } from "../schemas/financial.schema";

export async function createPayment(input: CreatePaymentInput) {
  const project = await Project.findById(input.projectId);
  if (!project) throw new AppError(404, "Project not found");

  const client = await Client.findById(input.clientId);
  if (!client) throw new AppError(404, "Client not found");

  const paymentId = await generateId("PAY");
  const payment = await Payment.create({
    paymentId,
    projectId: project._id,
    projectName: project.name,
    clientId: client._id,
    clientName: client.name,
    date: input.date,
    amount: input.amount,
    mode: input.mode,
    receiptNumber: input.receiptNumber,
    transactionReference: input.transactionReference,
    collectedBy: input.collectedBy,
    notes: input.notes,
  });

  await createApproval({
    type: "payment",
    title: `Payment: ${client.name} - ${input.amount}`,
    sourceCollection: "payments",
    sourceId: payment._id,
    projectId: project._id,
    projectName: project.name,
    owner: input.collectedBy,
    amount: input.amount,
    detail: `${input.mode} via ${input.transactionReference || input.receiptNumber || "n/a"}`,
  });

  return payment.toObject();
}

export async function listPayments(filter: {
  projectId?: string;
  clientId?: string;
  status?: string;
  mode?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.clientId) query.clientId = new Types.ObjectId(filter.clientId);
  if (filter.status) query.status = filter.status;
  if (filter.mode) query.mode = filter.mode;
  if (filter.from || filter.to) {
    query.date = {};
    if (filter.from) (query.date as Record<string, string>).$gte = filter.from;
    if (filter.to) (query.date as Record<string, string>).$lte = filter.to;
  }

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Payment.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Payment.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function getPaymentById(id: string) {
  const payment = await Payment.findById(id).lean();
  if (!payment) throw new AppError(404, "Payment not found");
  return payment;
}

export async function updatePayment(id: string, patch: Partial<CreatePaymentInput>) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.projectId) update.projectId = new Types.ObjectId(patch.projectId);
  if (patch.clientId) update.clientId = new Types.ObjectId(patch.clientId);

  const payment = await Payment.findByIdAndUpdate(id, update, { new: true });
  if (!payment) throw new AppError(404, "Payment not found");
  return payment.toObject();
}

export async function deletePayment(id: string) {
  const result = await Payment.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Payment not found");
}

export async function getCollectionSummary(filter: { projectId?: string; from?: string; to?: string }) {
  const match: Record<string, unknown> = { status: "Approved" };
  if (filter.projectId) match.projectId = new Types.ObjectId(filter.projectId);
  if (filter.from || filter.to) {
    match.date = {};
    if (filter.from) (match.date as Record<string, string>).$gte = filter.from;
    if (filter.to) (match.date as Record<string, string>).$lte = filter.to;
  }

  const result = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: { mode: "$mode", month: { $substr: ["$date", 0, 7] } },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.month": -1 } },
  ]);
  return result;
}

export async function getPendingPayments() {
  return Payment.find({ status: "Pending" }).sort({ createdAt: -1 }).lean();
}
