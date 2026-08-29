import { Types } from "mongoose";
import { Expense } from "../models/Expense.js";
import { GeneralExpense } from "../models/GeneralExpense.js";
import { Material } from "../models/Material.js";
import { SubcontractorPayment } from "../models/SubcontractorPayment.js";
import { AppError } from "../middleware/errorHandler.js";
import { isProjectInScope, ProjectScopeIds } from "../utils/scope.js";

export interface ProjectExpenseOutputRollup {
  supervisorExpense: number;
  materialExpense: number;
  nonLabourExpense: number;
  subcontractorPayments: number;
  totalExpense: number;
}

function aggregateTotal(rows: Array<{ total?: number }> | undefined): number {
  return Math.max(0, Number(rows?.[0]?.total) || 0);
}

/** Source-of-truth rollup for money leaving a project. */
export async function projectExpenseOutputRollup(
  projectId: string,
  scopeProjectIds?: ProjectScopeIds,
): Promise<ProjectExpenseOutputRollup> {
  if (!Types.ObjectId.isValid(projectId)) throw new AppError(400, "Invalid projectId");
  if (!isProjectInScope(projectId, scopeProjectIds)) {
    throw new AppError(403, "Project is outside the permitted scope");
  }

  const projectObjectId = new Types.ObjectId(projectId);
  const [siteExpenseRows, generalRows, materialRows, subcontractorRows] = await Promise.all([
    Expense.aggregate<{ _id: "supervisor" | "material"; total: number }>([
      {
        $match: {
          projectId: projectObjectId,
          type: "site",
          transactionType: { $ne: "Cash Added" },
          status: { $ne: "Rejected" },
        },
      },
      {
        $group: {
          _id: { $cond: [{ $eq: ["$isSiteMaterial", true] }, "material", "supervisor"] },
          total: { $sum: "$amount" },
        },
      },
    ]),
    GeneralExpense.aggregate<{ total: number }>([
      { $match: { projectId: projectObjectId, status: { $ne: "Rejected" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Material.aggregate<{ total: number }>([
      { $match: { projectId: projectObjectId, isExistingMaterial: { $ne: true } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$givenAmount", 0] } } } },
    ]),
    SubcontractorPayment.aggregate<{ total: number }>([
      { $match: { projectId: projectObjectId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const supervisorExpense = Math.max(0, Number(siteExpenseRows.find((row) => row._id === "supervisor")?.total) || 0);
  const siteMaterialExpense = Math.max(0, Number(siteExpenseRows.find((row) => row._id === "material")?.total) || 0);
  const materialExpense = siteMaterialExpense + aggregateTotal(materialRows);
  const nonLabourExpense = aggregateTotal(generalRows);
  const subcontractorPayments = aggregateTotal(subcontractorRows);

  return {
    supervisorExpense,
    materialExpense,
    nonLabourExpense,
    subcontractorPayments,
    totalExpense: supervisorExpense + materialExpense + nonLabourExpense + subcontractorPayments,
  };
}
