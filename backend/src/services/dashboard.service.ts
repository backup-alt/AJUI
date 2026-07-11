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

export async function getDashboardKPIs(scopeQuery: Record<string, unknown> = {}): Promise<DashboardKPIs> {
  const hasProjectScope = Object.keys(scopeQuery).length > 0 && scopeQuery._id !== undefined;

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
    Client.countDocuments(hasProjectScope ? { projects: scopeQuery._id } : {}),
    Client.countDocuments({ status: "Active", ...(hasProjectScope ? { projects: scopeQuery._id } : {}) }),
    Project.countDocuments(scopeQuery),
    Project.countDocuments({ ...scopeQuery, status: "Active" }),
    Project.countDocuments({ ...scopeQuery, status: "On Hold" }),
    Project.countDocuments({ ...scopeQuery, status: "Completed" }),
    Site.countDocuments(hasProjectScope ? { projectId: scopeQuery._id } : {}),
    Site.countDocuments({ status: "Active", ...(hasProjectScope ? { projectId: scopeQuery._id } : {}) }),
    Supervisor.countDocuments(hasProjectScope ? { assignedProjectId: { $in: (scopeQuery._id as any)?.$in || [] } } : {}),
    Supervisor.countDocuments({ status: "Active", ...(hasProjectScope ? { assignedProjectId: { $in: (scopeQuery._id as any)?.$in || [] } } : {}) }),
    Supervisor.countDocuments({ status: "On Leave", ...(hasProjectScope ? { assignedProjectId: { $in: (scopeQuery._id as any)?.$in || [] } } : {}) }),
    Vendor.countDocuments(),
    Vendor.countDocuments({ status: "Active" }),
    Approval.countDocuments({ status: "Pending" }),
    Approval.countDocuments({ status: "Approved" }),
    Approval.countDocuments({ status: "Rejected" }),
    Project.aggregate([
      { $match: scopeQuery },
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
      { $match: hasProjectScope ? { projectId: scopeQuery._id } : {} },
      {
        $group: {
          _id: null,
          outstanding: { $sum: "$balance" },
        },
      },
    ]),
    hasProjectScope ? Material.countDocuments({ ...scopeQuery, status: "Pending" }) : Material.countDocuments({ status: "Pending" }),
    hasProjectScope ? Expense.countDocuments({ ...scopeQuery, status: "Pending" }) : Expense.countDocuments({ status: "Pending" }),
    hasProjectScope ? Payment.countDocuments({ ...scopeQuery, status: "Pending" }) : Payment.countDocuments({ status: "Pending" }),
    hasProjectScope ? Subcontractor.countDocuments({ ...scopeQuery, approvalStatus: "Pending" }) : Subcontractor.countDocuments({ approvalStatus: "Pending" }),
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
  scopeQuery?: Record<string, unknown>;
}

export async function getUniversalDashboard(filter: UniversalFilter) {
  const baseMatch: Record<string, unknown> = {};
  if (filter.projectId) baseMatch.projectId = new Types.ObjectId(filter.projectId);
  if (filter.clientId) baseMatch.clientId = new Types.ObjectId(filter.clientId);
  if (filter.siteId) baseMatch.siteId = new Types.ObjectId(filter.siteId);

  const hasProjectScope = filter.scopeQuery && Object.keys(filter.scopeQuery).length > 0;
  const projectMatch = hasProjectScope ? filter.scopeQuery : {};

  const dateMatch: Record<string, unknown> = {};
  if (filter.from || filter.to) {
    dateMatch.$gte = filter.from || "1970-01-01";
    dateMatch.$lte = filter.to || "9999-12-31";
  }

  const [materials, labour, expenses, payments, subcontractors] = await Promise.all([
    Material.find({ ...baseMatch, ...projectMatch, ...(Object.keys(dateMatch).length ? { requestDate: dateMatch } : {}) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Labour.find({ ...baseMatch, ...projectMatch, ...(Object.keys(dateMatch).length ? { attendanceDate: dateMatch } : {}) })
      .sort({ attendanceDate: -1 })
      .limit(100)
      .lean(),
    Expense.find({ ...baseMatch, ...projectMatch, ...(Object.keys(dateMatch).length ? { date: dateMatch } : {}) })
      .sort({ date: -1 })
      .limit(100)
      .lean(),
    Payment.find({ ...baseMatch, ...projectMatch, ...(Object.keys(dateMatch).length ? { date: dateMatch } : {}) })
      .sort({ date: -1 })
      .limit(100)
      .lean(),
    Subcontractor.find({ ...baseMatch, ...projectMatch, ...(Object.keys(dateMatch).length ? { startDate: dateMatch } : {}) })
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
