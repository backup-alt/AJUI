import { Types } from "mongoose";
import { User } from "../models/User.js";
import { Supervisor } from "../models/Supervisor.js";
import { Project } from "../models/Project.js";
import { Site } from "../models/Site.js";
import { Material } from "../models/Material.js";
import { Labour } from "../models/Labour.js";
import { Expense } from "../models/Expense.js";
import { Payment } from "../models/Payment.js";
import { Approval } from "../models/Approval.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { AppError } from "../middleware/errorHandler.js";

export async function getSupervisorByUserId(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found");
  if (user.role !== "supervisor") throw new AppError(403, "Not a supervisor user");

  const profile = user.supervisorProfileId
    ? await Supervisor.findById(user.supervisorProfileId).lean()
    : await Supervisor.findOne({ userId: user._id }).lean();

  if (!profile) throw new AppError(404, "Supervisor profile not found");

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
    profile,
  };
}

export async function updateSupervisorProfile(
  userId: string,
  patch: { name?: string; email?: string; phone?: string; address?: string }
) {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found");
  if (user.role !== "supervisor") throw new AppError(403, "Not a supervisor user");

  if (patch.name) user.name = patch.name;
  if (patch.email) user.email = patch.email;
  if (patch.phone) user.phone = patch.phone;
  await user.save();

  if (user.supervisorProfileId) {
    const profile = await Supervisor.findById(user.supervisorProfileId);
    if (profile) {
      if (patch.name) profile.name = patch.name;
      if (patch.email) profile.email = patch.email;
      if (patch.phone) profile.phone = patch.phone;
      if (patch.address) profile.address = patch.address;
      await profile.save();
    }
  }

  return getSupervisorByUserId(userId);
}

export async function getAssignedProjects(userId: string) {
  const user = await User.findById(userId);
  if (!user || user.role !== "supervisor") throw new AppError(403, "Not a supervisor user");

  const projects = await Project.find({
    $or: [
      { _id: { $in: user.managedProjectIds || [] } },
      { supervisorId: user.supervisorProfileId },
    ],
    status: { $ne: "Completed" },
  })
    .sort({ lastActivityAt: -1 })
    .lean();

  return projects.map((p) => ({
    id: p._id.toString(),
    projectId: p.projectId,
    name: p.name,
    client: p.client,
    clientId: p.clientId,
    status: p.status,
    startDate: p.startDate,
    totalValue: p.totalValue,
    receivedAmount: p.receivedAmount,
    pendingBalance: p.pendingBalance,
    materialSpend: p.materialSpend,
    labourPayable: p.labourPayable,
    completion: p.completion,
    siteNames: p.siteNames,
    lastActivityAt: p.lastActivityAt,
  }));
}

export async function getAssignedSites(userId: string) {
  const projects = await getAssignedProjects(userId);
  const projectIds = projects.map((p) => p.id);
  const projectIdToName = new Map<string, string>();
  for (const p of projects) projectIdToName.set(p.id, p.name);

  const sites = await Site.find({ projectIds: { $in: projectIds.map((id) => new Types.ObjectId(id)) } })
    .sort({ createdAt: -1 })
    .lean();

  const today = new Date().toISOString().slice(0, 10);

  const labourStats = await Labour.aggregate([
    { $match: { projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) } } },
    {
      $group: {
        _id: { site: "$site", projectId: "$projectId" },
        todayPresentCount: {
          $sum: {
            $cond: [{ $eq: ["$attendanceDate", today] }, "$presentCount", 0],
          },
        },
        daysActive: { $addToSet: "$attendanceDate" },
      },
    },
    {
      $project: {
        _id: 0,
        site: "$_id.site",
        projectId: "$_id.projectId",
        employeeCount: "$todayPresentCount",
        daysActiveCount: { $size: "$daysActive" },
      },
    },
  ]);

  const labourMap = new Map<string, { employeeCount: number; daysActiveCount: number }>();
  for (const stat of labourStats) {
    const siteName = stat.site as string;
    const pid = (stat.projectId as Types.ObjectId).toString();
    const key = `${siteName}__${pid}`;
    labourMap.set(key, { employeeCount: stat.employeeCount, daysActiveCount: stat.daysActiveCount });
  }

  return sites.map((s) => {
    const firstProjectId = s.projectIds?.[0]?.toString();
    const key = `${s.name}__${firstProjectId}`;
    const stats = labourMap.get(key) || { employeeCount: 0, daysActiveCount: 0 };
    return {
      id: s._id.toString(),
      siteId: s.siteId,
      name: s.name,
      status: s.status,
      supervisor: s.supervisor,
      startDate: s.startDate,
      targetEndDate: s.targetEndDate,
      projectId: firstProjectId,
      projectName: firstProjectId ? projectIdToName.get(firstProjectId) : undefined,
      employeeCount: stats.employeeCount,
      daysActive: stats.daysActiveCount,
    };
  });
}

export async function getActionableApprovals(userId: string) {
  const user = await User.findById(userId);
  if (!user || user.role !== "supervisor") throw new AppError(403, "Not a supervisor user");

  const projects = await Project.find({
    $or: [
      { _id: { $in: user.managedProjectIds || [] } },
      { supervisorId: user.supervisorProfileId },
    ],
  }).lean();
  const projectIds = projects.map((p) => p._id);

  const approvals = await Approval.find({
    projectId: { $in: projectIds },
    status: "Pending",
  })
    .sort({ submittedAt: -1 })
    .lean();

  return approvals.map((a) => ({
    approvalId: a.approvalId,
    type: a.type,
    title: a.title,
    projectId: a.projectId,
    projectName: a.projectName,
    site: a.site,
    amount: a.amount,
    submittedAt: a.submittedAt,
    sourceCollection: a.sourceCollection,
    sourceId: a.sourceId,
  }));
}

export async function getSupervisorDashboard(userId: string) {
  const projects = await getAssignedProjects(userId);
  const sites = await getAssignedSites(userId);
  const approvals = await getActionableApprovals(userId);

  const projectIds = projects.map((p) => p.id).map((id) => new Types.ObjectId(id));

  const [pendingMaterials, pendingLabour, pendingExpenses, todayExpenses] = await Promise.all([
    Material.countDocuments({ projectId: { $in: projectIds }, status: "Pending" }),
    Labour.countDocuments({ projectId: { $in: projectIds }, status: "Pending" }),
    Expense.countDocuments({ projectId: { $in: projectIds }, status: "Pending", type: "site" }),
    Expense.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          date: new Date().toISOString().slice(0, 10),
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    counts: {
      projects: projects.length,
      sites: sites.length,
      pendingApprovals: approvals.length,
      pendingMaterials,
      pendingLabour,
      pendingExpenses,
    },
    todayExpense: {
      total: todayExpenses[0]?.total ?? 0,
      count: todayExpenses[0]?.count ?? 0,
    },
    projects: projects.slice(0, 10),
    pendingApprovals: approvals.slice(0, 20),
  };
}

export async function getSupervisorProjectsDetailed(userId: string) {
  const projects = await getAssignedProjects(userId);
  const projectIds = projects.map((p) => new Types.ObjectId(p.id));

  const [
    materialsByProject,
    labourByProject,
    expensesByProject,
    paymentsByProject,
    subcontractorsByProject,
  ] = await Promise.all([
    Material.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: "$projectId", count: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } } } },
    ]),
    Labour.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: "$projectId", count: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } } } },
    ]),
    Expense.aggregate([
      { $match: { projectId: { $in: projectIds }, type: "site" } },
      { $group: { _id: "$projectId", count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]),
    Payment.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: "$projectId", count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]),
    Subcontractor.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: "$projectId", count: { $sum: 1 }, contractTotal: { $sum: "$contractValue" } } },
    ]),
  ]);

  const indexByProject = (arr: { _id: Types.ObjectId; [k: string]: unknown }[]) => {
    const map = new Map<string, Record<string, unknown>>();
    for (const item of arr) {
      map.set(item._id.toString(), item);
    }
    return map;
  };

  const matMap = indexByProject(materialsByProject as never);
  const labMap = indexByProject(labourByProject as never);
  const expMap = indexByProject(expensesByProject as never);
  const payMap = indexByProject(paymentsByProject as never);
  const subMap = indexByProject(subcontractorsByProject as never);

  return projects.map((p) => ({
    ...p,
    stats: {
      materials: matMap.get(p.id) || { count: 0, pending: 0 },
      labour: labMap.get(p.id) || { count: 0, pending: 0 },
      expenses: expMap.get(p.id) || { count: 0, total: 0 },
      payments: payMap.get(p.id) || { count: 0, total: 0 },
      subcontractors: subMap.get(p.id) || { count: 0, contractTotal: 0 },
    },
  }));
}

export async function getSupervisorProjectDetail(userId: string, projectId: string) {
  const user = await User.findById(userId);
  if (!user || user.role !== "supervisor") throw new AppError(403, "Not a supervisor user");

  const project = await Project.findById(projectId).lean();
  if (!project) throw new AppError(404, "Project not found");

  const isAssigned =
    (user.managedProjectIds || []).some((id) => id.toString() === projectId) ||
    (user.supervisorProfileId && project.supervisorId?.toString() === user.supervisorProfileId.toString());

  if (!isAssigned) throw new AppError(403, "Not assigned to this project");

  return project;
}

export async function getSupervisorProjectApprovals(userId: string, projectId: string) {
  await getSupervisorProjectDetail(userId, projectId);

  const approvals = await Approval.find({
    projectId: new Types.ObjectId(projectId),
    status: "Pending",
  })
    .sort({ submittedAt: -1 })
    .lean();

  return approvals.map((a) => ({
    approvalId: a.approvalId,
    type: a.type,
    title: a.title,
    site: a.site,
    amount: a.amount,
    submittedAt: a.submittedAt,
    sourceCollection: a.sourceCollection,
  }));
}

// =================== LISTING (per-site / per-project) ===================
async function getProjectIdStrings(userId: string): Promise<string[]> {
  const projects = await getAssignedProjects(userId);
  return projects.map((p) => p.id);
}

export async function listMaterialsForSupervisor(
  userId: string,
  filters: { siteId?: string; status?: string; page?: number; limit?: number }
) {
  const projectIds = await getProjectIdStrings(userId);
  const query: Record<string, unknown> = { projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) } };
  if (filters.siteId) query.siteId = new Types.ObjectId(filters.siteId);
  if (filters.status) query.status = filters.status;

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Material.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Material.countDocuments(query),
  ]);

  return {
    materials: items.map((m) => ({
      _id: m._id.toString(),
      materialId: m.materialId,
      projectId: m.projectId,
      projectName: m.projectName,
      siteId: m.siteId,
      site: m.site,
      name: m.name,
      unit: m.unit,
      requestedQuantity: m.requestedQuantity,
      approvedQuantity: m.approvedQuantity,
      purchasedQuantity: m.purchasedQuantity,
      consumedQuantity: m.consumedQuantity,
      remainingStock: m.remainingStock,
      vendor: m.vendor,
      poNumber: m.poNumber,
      requestDate: m.requestDate,
      status: m.status,
      notes: m.notes,
      createdBy: m.createdBy,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function listLabourForSupervisor(
  userId: string,
  filters: { siteId?: string; status?: string; page?: number; limit?: number }
) {
  const projectIds = await getProjectIdStrings(userId);
  const query: Record<string, unknown> = { projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) } };
  if (filters.siteId) query.siteId = new Types.ObjectId(filters.siteId);
  if (filters.status) query.status = filters.status;

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Labour.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Labour.countDocuments(query),
  ]);

  return {
    labour: items.map((l) => ({
      _id: l._id.toString(),
      labourId: l.labourId,
      projectId: l.projectId,
      projectName: l.projectName,
      siteId: l.siteId,
      site: l.site,
      partyName: l.partyName,
      category: l.category,
      attendanceDate: l.attendanceDate,
      presentCount: l.presentCount,
      dailyWage: l.dailyWage,
      shift: l.shift,
      status: l.status,
      submittedBy: l.submittedBy,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function listExpensesForSupervisor(
  userId: string,
  filters: { siteId?: string; status?: string; type?: string; page?: number; limit?: number }
) {
  const projectIds = await getProjectIdStrings(userId);
  const query: Record<string, unknown> = { projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) } };
  if (filters.siteId) query.siteId = new Types.ObjectId(filters.siteId);
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Expense.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Expense.countDocuments(query),
  ]);

  return {
    expenses: items.map((e) => ({
      _id: e._id.toString(),
      expenseId: e.expenseId,
      type: e.type,
      projectId: e.projectId,
      projectName: e.projectName,
      siteId: e.siteId,
      site: e.site,
      transactionType: e.transactionType,
      reference: e.reference,
      amount: e.amount,
      date: e.date,
      description: e.description,
      status: e.status,
      submittedBy: e.submittedBy,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getMaterialDetailForSupervisor(userId: string, materialId: string) {
  const projectIds = await getProjectIdStrings(userId);
  const material = await Material.findOne({
    _id: materialId,
    projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) },
  }).lean();
  if (!material) throw new AppError(404, "Material not found or not accessible");
  return material;
}

export async function updateMaterialStockForSupervisor(
  userId: string,
  materialId: string,
  updates: { purchasedQuantity?: number; consumedQuantity?: number }
) {
  const projectIds = await getProjectIdStrings(userId);
  const material = await Material.findOne({
    _id: materialId,
    projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) },
  });
  if (!material) throw new AppError(404, "Material not found or not accessible");
  if (updates.purchasedQuantity !== undefined) material.purchasedQuantity = updates.purchasedQuantity;
  if (updates.consumedQuantity !== undefined) material.consumedQuantity = updates.consumedQuantity;
  await material.save();
  return material.toObject();
}

export async function getLabourDetailForSupervisor(userId: string, labourId: string) {
  const projectIds = await getProjectIdStrings(userId);
  const labour = await Labour.findOne({
    _id: labourId,
    projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) },
  }).lean();
  if (!labour) throw new AppError(404, "Labour entry not found or not accessible");
  return labour;
}

export async function getExpenseDetailForSupervisor(userId: string, expenseId: string) {
  const projectIds = await getProjectIdStrings(userId);
  const expense = await Expense.findOne({
    _id: expenseId,
    projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) },
  }).lean();
  if (!expense) throw new AppError(404, "Expense not found or not accessible");
  return expense;
}

export async function takeApprovalActionForSupervisor(
  userId: string,
  approvalId: string,
  action: { action: "approve" | "reject"; comment?: string }
) {
  const projectIds = await getProjectIdStrings(userId);
  const approval = await Approval.findOne({
    _id: approvalId,
    projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) },
  });
  if (!approval) throw new AppError(404, "Approval not found or not accessible");
  if (approval.status !== "Pending") throw new AppError(400, "Approval is not pending");

  approval.status = action.action === "approve" ? "Approved" : "Rejected";
  approval.reviewedAt = new Date();
  approval.reviewedBy = userId;
  if (action.comment) approval.detail = action.comment;
  await approval.save();

  // Update the linked source document
  if (approval.sourceCollection && approval.sourceId) {
    const Model =
      approval.sourceCollection === "Material"
        ? Material
        : approval.sourceCollection === "Labour"
        ? Labour
        : approval.sourceCollection === "Expense"
        ? Expense
        : null;

    if (Model) {
      const doc: any = await (Model as any).findById(approval.sourceId);
      if (doc) {
        doc.status = approval.status;
        if (action.action === "approve") {
          doc.approvedBy = userId;
          doc.approvedAt = new Date();
        }
        await doc.save();
      }
    }
  }

  return approval;
}

export async function getApprovalDetailForSupervisor(userId: string, approvalId: string) {
  const projectIds = await getProjectIdStrings(userId);
  const approval = await Approval.findOne({
    _id: approvalId,
    projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) },
  }).lean();
  if (!approval) throw new AppError(404, "Approval not found or not accessible");
  return approval;
}
