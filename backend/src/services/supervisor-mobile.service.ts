import { Types } from "mongoose";
import { User } from "../models/User";
import { Supervisor } from "../models/Supervisor";
import { Project } from "../models/Project";
import { Site } from "../models/Site";
import { Material } from "../models/Material";
import { Labour } from "../models/Labour";
import { Expense } from "../models/Expense";
import { Payment } from "../models/Payment";
import { Approval } from "../models/Approval";
import { Subcontractor } from "../models/Subcontractor";
import { AppError } from "../middleware/errorHandler";

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

  const sites = await Site.find({ projectIds: { $in: projectIds.map((id) => new Types.ObjectId(id)) } })
    .sort({ createdAt: -1 })
    .lean();

  return sites.map((s) => ({
    id: s._id.toString(),
    siteId: s.siteId,
    name: s.name,
    status: s.status,
    supervisor: s.supervisor,
    startDate: s.startDate,
    targetEndDate: s.targetEndDate,
  }));
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
