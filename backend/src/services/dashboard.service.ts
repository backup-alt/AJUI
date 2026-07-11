import { Types } from "mongoose";
import { Client } from "../models/Client.js";
import { Site } from "../models/Site.js";
import { Project } from "../models/Project.js";
import { Supervisor } from "../models/Supervisor.js";
import { Material } from "../models/Material.js";
import { Labour } from "../models/Labour.js";
import { Expense } from "../models/Expense.js";
import { Payment } from "../models/Payment.js";
import { Vendor } from "../models/Vendor.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { Approval } from "../models/Approval.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";

export interface DashboardKPIs {
  counts: {
    clients: { total: number; active: number };
    projects: { total: number; active: number; onHold: number; completed: number };
    sites: { total: number; active: number };
    supervisors: { total: number; active: number; onLeave: number };
    vendors: { total: number; active: number };
    approvals: { pending: number; approved: number; rejected: number };
  };
  financials: {
    totalProjectValue: number;
    totalReceived: number;
    totalPending: number;
    totalMaterialSpend: number;
    totalLabourPayable: number;
    totalExpenseReceived: number;
    outstandingSubcontractValue: number;
  };
  recentActivity: {
    pendingApprovals: number;
    pendingMaterials: number;
    pendingExpenses: number;
    pendingPayments: number;
    pendingSubcontracts: number;
  };
}

export async function getDashboardKPIs(scopeProjectIds: ProjectScopeIds = null): Promise<DashboardKPIs> {
  const hasProjectScope = scopeProjectIds !== null;
  const projectQuery: Record<string, unknown> = {};
  const projectDataQuery: Record<string, unknown> = {};
  const siteQuery: Record<string, unknown> = {};
  applyProjectScope(projectQuery, "_id", scopeProjectIds);
  applyProjectScope(projectDataQuery, "projectId", scopeProjectIds);
  applyProjectScope(siteQuery, "projectIds", scopeProjectIds);

  const scopedClientQuery: Record<string, unknown> = {};
  if (hasProjectScope) {
    const scopedProjects = await Project.find(projectQuery).select("clientId").lean();
    const clientIds = [...new Set(scopedProjects.map((p) => p.clientId?.toString()).filter(Boolean))]
      .map((id) => new Types.ObjectId(id));
    scopedClientQuery._id = { $in: clientIds };
  }

  const [
    clientsTotal,
    clientsActive,
    projectsTotal,
    projectsActive,
    projectsOnHold,
    projectsCompleted,
    sitesTotal,
    sitesActive,
    supervisorsTotal,
    supervisorsActive,
    supervisorsOnLeave,
    vendorsTotal,
    vendorsActive,
    approvalsPending,
    approvalsApproved,
    approvalsRejected,
    financialAgg,
    subAgg,
    pendingMaterials,
    pendingExpenses,
    pendingPayments,
    pendingSubcontracts,
  ] = await Promise.all([
    Client.countDocuments(scopedClientQuery),
    Client.countDocuments({ ...scopedClientQuery, status: "Active" }),
    Project.countDocuments(projectQuery),
    Project.countDocuments({ ...projectQuery, status: "Active" }),
    Project.countDocuments({ ...projectQuery, status: "On Hold" }),
    Project.countDocuments({ ...projectQuery, status: "Completed" }),
    Site.countDocuments(siteQuery),
    Site.countDocuments({ ...siteQuery, status: "Active" }),
    Supervisor.countDocuments(hasProjectScope ? { assignedProjectId: { $in: scopeProjectIds } } : {}),
    Supervisor.countDocuments({ status: "Active", ...(hasProjectScope ? { assignedProjectId: { $in: scopeProjectIds } } : {}) }),
    Supervisor.countDocuments({ status: "On Leave", ...(hasProjectScope ? { assignedProjectId: { $in: scopeProjectIds } } : {}) }),
    Vendor.countDocuments(),
    Vendor.countDocuments({ status: "Active" }),
    Approval.countDocuments({ ...projectDataQuery, status: "Pending" }),
    Approval.countDocuments({ ...projectDataQuery, status: "Approved" }),
    Approval.countDocuments({ ...projectDataQuery, status: "Rejected" }),
    Project.aggregate([
      { $match: projectQuery },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$totalValue" },
          received: { $sum: "$receivedAmount" },
          materialSpend: { $sum: "$materialSpend" },
          labourPayable: { $sum: "$labourPayable" },
          expenseReceived: { $sum: "$totalExpenseReceived" },
        },
      },
    ]),
    Subcontractor.aggregate([
      { $match: projectDataQuery },
      {
        $group: {
          _id: null,
          outstanding: { $sum: "$balance" },
        },
      },
    ]),
    Material.countDocuments({ ...projectDataQuery, status: "Pending" }),
    Expense.countDocuments({ ...projectDataQuery, status: "Pending" }),
    Payment.countDocuments({ ...projectDataQuery, status: "Pending" }),
    Subcontractor.countDocuments({ ...projectDataQuery, approvalStatus: "Pending" }),
  ]);

  const fin = financialAgg[0] || {
    totalValue: 0,
    received: 0,
    materialSpend: 0,
    labourPayable: 0,
    expenseReceived: 0,
  };

  const sub = subAgg[0] || { outstanding: 0 };

  return {
    counts: {
      clients: { total: clientsTotal, active: clientsActive },
      projects: { total: projectsTotal, active: projectsActive, onHold: projectsOnHold, completed: projectsCompleted },
      sites: { total: sitesTotal, active: sitesActive },
      supervisors: { total: supervisorsTotal, active: supervisorsActive, onLeave: supervisorsOnLeave },
      vendors: { total: vendorsTotal, active: vendorsActive },
      approvals: { pending: approvalsPending, approved: approvalsApproved, rejected: approvalsRejected },
    },
    financials: {
      totalProjectValue: fin.totalValue,
      totalReceived: fin.received,
      totalPending: Math.max(0, fin.totalValue - fin.received),
      totalMaterialSpend: fin.materialSpend,
      totalLabourPayable: fin.labourPayable,
      totalExpenseReceived: fin.expenseReceived,
      outstandingSubcontractValue: sub.outstanding,
    },
    recentActivity: {
      pendingApprovals: approvalsPending,
      pendingMaterials,
      pendingExpenses,
      pendingPayments,
      pendingSubcontracts,
    },
  };
}

export interface UniversalFilter {
  projectId?: string;
  clientId?: string;
  siteId?: string;
  from?: string;
  to?: string;
  scopeProjectIds?: ProjectScopeIds;
}

export async function getUniversalDashboard(filter: UniversalFilter) {
  const baseMatch: Record<string, unknown> = {};
  if (filter.projectId) baseMatch.projectId = new Types.ObjectId(filter.projectId);
  if (filter.clientId) baseMatch.clientId = new Types.ObjectId(filter.clientId);
  if (filter.siteId) baseMatch.siteId = new Types.ObjectId(filter.siteId);
  applyProjectScope(baseMatch, "projectId", filter.scopeProjectIds);

  const dateMatch: Record<string, unknown> = {};
  if (filter.from || filter.to) {
    dateMatch.$gte = filter.from || "1970-01-01";
    dateMatch.$lte = filter.to || "9999-12-31";
  }

  const [materials, labour, expenses, payments, subcontractors] = await Promise.all([
    Material.find({ ...baseMatch, ...(Object.keys(dateMatch).length ? { requestDate: dateMatch } : {}) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Labour.find({ ...baseMatch, ...(Object.keys(dateMatch).length ? { attendanceDate: dateMatch } : {}) })
      .sort({ attendanceDate: -1 })
      .limit(100)
      .lean(),
    Expense.find({ ...baseMatch, ...(Object.keys(dateMatch).length ? { date: dateMatch } : {}) })
      .sort({ date: -1 })
      .limit(100)
      .lean(),
    Payment.find({ ...baseMatch, ...(Object.keys(dateMatch).length ? { date: dateMatch } : {}) })
      .sort({ date: -1 })
      .limit(100)
      .lean(),
    Subcontractor.find({ ...baseMatch, ...(Object.keys(dateMatch).length ? { startDate: dateMatch } : {}) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  return {
    materials,
    labour,
    expenses,
    payments,
    subcontractors,
    counts: {
      materials: materials.length,
      labour: labour.length,
      expenses: expenses.length,
      payments: payments.length,
      subcontractors: subcontractors.length,
    },
    filter,
  };
}
