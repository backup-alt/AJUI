import { Types } from "mongoose";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { Material } from "../models/Material.js";
import { Labour } from "../models/Labour.js";
import { Expense } from "../models/Expense.js";
import { Payment } from "../models/Payment.js";
import { AppError } from "../middleware/errorHandler.js";

export interface ProjectFinancialSummary {
  projectId: string;
  totalValue: number;
  estimatedValue: number;
  advanceAmount: number;
  receivedAmount: number;
  totalExpenseReceived: number;
  pendingBalance: number;
  materialSpend: number;
  labourPayable: number;
  expenseBalance: number;
  completion: number;
}

export async function recomputeProjectTotals(projectObjectId: Types.ObjectId): Promise<void> {
  const project = await Project.findById(projectObjectId);
  if (!project) throw new AppError(404, "Project not found");

  // Only approved records contribute to project totals
  const [paymentAgg, materialAgg, labourAgg, expenseAgg] = await Promise.all([
    Payment.aggregate([
      { $match: { projectId: projectObjectId, status: "Approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Material.aggregate([
      { $match: { projectId: projectObjectId, status: "Approved" } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $multiply: ["$purchasedQuantity", "$dailyWage"],
            },
          },
          // Fallback: if no dailyWage field, just count approved materials
          count: { $sum: 1 },
        },
      },
    ]),
    Labour.aggregate([
      { $match: { projectId: projectObjectId, status: "Approved" } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $multiply: [
                { $add: [{ $ifNull: ["$presentDays", 0] }, { $ifNull: ["$presentCount", 0] }] },
                { $ifNull: ["$dailyWage", 0] },
              ],
            },
          },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { projectId: projectObjectId, type: "site", status: "Approved", transactionType: { $ne: "Cash Added" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  project.receivedAmount = paymentAgg[0]?.total ?? 0;
  project.materialSpend = materialAgg[0]?.total ?? 0;
  project.labourPayable = labourAgg[0]?.total ?? 0;
  project.totalExpenseReceived = expenseAgg[0]?.total ?? 0;

  project.pendingBalance = Math.max(0, project.totalValue - project.receivedAmount);
  project.lastActivityAt = new Date();

  await project.save();
}

export async function recomputeClientTotals(clientObjectId: Types.ObjectId): Promise<void> {
  const client = await Client.findById(clientObjectId);
  if (!client) throw new AppError(404, "Client not found");

  const projects = await Project.find({ clientId: clientObjectId });
  const totalProjectValue = projects.reduce((sum, p) => sum + p.totalValue, 0);
  const amountReceived = projects.reduce((sum, p) => sum + p.receivedAmount, 0);
  const pendingBalance = Math.max(0, totalProjectValue - amountReceived);

  client.totalProjectValue = totalProjectValue;
  client.amountReceived = amountReceived;
  client.pendingBalance = pendingBalance;
  await client.save();
}

export function computeProjectLedger(p: {
  totalValue: number;
  estimatedValue: number;
  advanceAmount: number;
  receivedAmount: number;
  totalExpenseReceived: number;
  materialSpend: number;
  labourPayable: number;
  expenseBalance: number;
  completion: number;
}): ProjectFinancialSummary {
  return {
    projectId: "",
    totalValue: p.totalValue,
    estimatedValue: p.estimatedValue,
    advanceAmount: p.advanceAmount,
    receivedAmount: p.receivedAmount,
    totalExpenseReceived: p.totalExpenseReceived,
    pendingBalance: Math.max(0, p.totalValue - p.receivedAmount),
    materialSpend: p.materialSpend,
    labourPayable: p.labourPayable,
    expenseBalance: p.expenseBalance,
    completion: p.completion,
  };
}
