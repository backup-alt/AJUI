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

type SupervisorAccess = {
  user: Awaited<ReturnType<typeof User.findById>>;
  profile: Record<string, any> | null;
  projectIds: Types.ObjectId[];
  siteIds: Types.ObjectId[];
  siteNames: string[];
};

function toObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  const str = String(value);
  return Types.ObjectId.isValid(str) ? new Types.ObjectId(str) : null;
}

function uniqueObjectIds(values: Array<Types.ObjectId | null | undefined>): Types.ObjectId[] {
  const seen = new Set<string>();
  const ids: Types.ObjectId[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.toString();
    if (!seen.has(key)) {
      seen.add(key);
      ids.push(value);
    }
  }
  return ids;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push(trimmed);
    }
  }
  return list;
}

function hasObjectId(ids: Types.ObjectId[], value: Types.ObjectId): boolean {
  const key = value.toString();
  return ids.some((id) => id.toString() === key);
}

async function getSupervisorAccess(userId: string): Promise<SupervisorAccess> {
  const user = await User.findById(userId);
  if (!user || user.role !== "supervisor") throw new AppError(403, "Not a supervisor user");

  let profile = user.supervisorProfileId
    ? await Supervisor.findById(user.supervisorProfileId).lean()
    : null;
  if (!profile) {
    profile = await Supervisor.findOne({ userId: user._id }).lean();
  }
  if (!profile && user.email) {
    profile = await Supervisor.findOne({ email: user.email.toLowerCase() }).lean();
  }
  if (!profile && user.phone) {
    profile = await Supervisor.findOne({ phone: user.phone }).lean();
  }

  const profileRecord = profile as Record<string, any> | null;
  const profileId = toObjectId(profileRecord?._id);
  if (profileId) {
    if (!user.supervisorProfileId || user.supervisorProfileId.toString() !== profileId.toString()) {
      user.supervisorProfileId = profileId;
      await user.save();
    }
    if (String(profileRecord?.userId || "") !== user._id.toString()) {
      await Supervisor.updateOne({ _id: profileId }, { $set: { userId: user._id } });
    }
  }

  const projectIds = uniqueObjectIds([
    ...(user.managedProjectIds || []).map(toObjectId),
    toObjectId(profileRecord?.assignedProjectId),
  ]);

  const assignedSiteValues = ((profileRecord?.assignedSites || []) as unknown[]).map((value) =>
    String(value)
  );
  const assignedSiteIds = [
    ...((profileRecord?.assignedSiteIds || []) as unknown[]),
    profileRecord?.assignedSiteId,
    ...assignedSiteValues.filter((value) => Types.ObjectId.isValid(value)),
  ];
  const explicitSiteIds = uniqueObjectIds(assignedSiteIds.map(toObjectId));
  const assignedSiteNameFallback = uniqueStrings(
    assignedSiteValues.filter((value) => !Types.ObjectId.isValid(value))
  );

  let scopedSites: Array<{ _id: Types.ObjectId; name: string; projectIds?: Types.ObjectId[] }> = [];
  if (explicitSiteIds.length > 0) {
    scopedSites = await Site.find({ _id: { $in: explicitSiteIds } })
      .select("_id name projectIds")
      .lean();
  }
  if (scopedSites.length === 0 && profileId) {
    scopedSites = await Site.find({ supervisorId: profileId })
      .select("_id name projectIds")
      .lean();
  }
  if (scopedSites.length === 0 && assignedSiteNameFallback.length > 0) {
    scopedSites = await Site.find({ name: { $in: assignedSiteNameFallback } })
      .select("_id name projectIds")
      .lean();
  }
  if (scopedSites.length === 0 && projectIds.length > 0) {
    scopedSites = await Site.find({ projectIds: { $in: projectIds } })
      .select("_id name projectIds")
      .lean();
  }

  for (const site of scopedSites) {
    for (const pid of site.projectIds || []) {
      projectIds.push(new Types.ObjectId(pid));
    }
  }

  const siteIds = uniqueObjectIds([
    ...explicitSiteIds,
    ...scopedSites.map((site) => toObjectId(site._id)),
  ]);

  return {
    user,
    profile: profileRecord,
    projectIds: uniqueObjectIds(projectIds),
    siteIds,
    siteNames: uniqueStrings([
      ...scopedSites.map((site) => site.name),
      ...assignedSiteNameFallback,
    ]),
  };
}

async function getSiteScopeForFilter(access: SupervisorAccess, siteId?: string) {
  if (!siteId) {
    if (access.siteIds.length === 0 && access.siteNames.length === 0) return undefined;
    const or: Record<string, unknown>[] = [];
    const siteIdStrings = access.siteIds.map((id) => id.toString());
    if (access.siteIds.length > 0) {
      or.push({ siteId: { $in: access.siteIds } });
      or.push({ site: { $in: siteIdStrings } });
    }
    if (access.siteNames.length > 0) or.push({ site: { $in: access.siteNames } });
    return { $or: or };
  }

  const requestedSiteId = toObjectId(siteId);
  if (!requestedSiteId) throw new AppError(400, "Invalid site id");

  const site = await Site.findById(requestedSiteId).select("_id name projectIds").lean();
  if (!site) throw new AppError(404, "Site not found");

  const assignedBySiteId = access.siteIds.length === 0 || hasObjectId(access.siteIds, requestedSiteId);
  const assignedBySiteName = access.siteNames.some(
    (siteName) => siteName.toLowerCase() === site.name.toLowerCase()
  );
  const assignedBySite = assignedBySiteId || assignedBySiteName;
  const assignedByProject =
    access.projectIds.length === 0 ||
    (site.projectIds || []).some((projectId) => hasObjectId(access.projectIds, projectId));

  if (!assignedBySite || !assignedByProject) {
    throw new AppError(403, "Not assigned to this site");
  }

  return { $or: [{ siteId: requestedSiteId }, { site: site.name }, { site: requestedSiteId.toString() }] };
}

async function buildScopedEntityQuery(
  userId: string,
  filters: { projectId?: string; siteId?: string; status?: string; type?: string } = {}
) {
  const access = await getSupervisorAccess(userId);
  const query: Record<string, unknown> = {};

  if (filters.projectId) {
    const requestedProjectId = toObjectId(filters.projectId);
    if (!requestedProjectId) throw new AppError(400, "Invalid project id");
    if (!hasObjectId(access.projectIds, requestedProjectId)) {
      throw new AppError(403, "Not assigned to this project");
    }
    query.projectId = requestedProjectId;
  } else if (access.projectIds.length > 0) {
    query.projectId = { $in: access.projectIds };
  }

  const siteScope = await getSiteScopeForFilter(access, filters.siteId);
  if (siteScope) Object.assign(query, siteScope);
  if (
    !filters.projectId &&
    !filters.siteId &&
    access.projectIds.length === 0 &&
    access.siteIds.length === 0 &&
    access.siteNames.length === 0
  ) {
    query._id = { $exists: false };
  }
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;

  return { access, query };
}

function approvalScopeQuery(access: SupervisorAccess, status?: "Pending" | "Approved" | "Rejected") {
  const query: Record<string, unknown> = {};
  if (access.projectIds.length > 0) query.projectId = { $in: access.projectIds };
  if (access.siteNames.length > 0) query.site = { $in: access.siteNames };
  if (access.projectIds.length === 0 && access.siteNames.length === 0) {
    query._id = { $exists: false };
  }
  if (status) query.status = status;
  return query;
}

export async function ensureSupervisorSiteAccess(
  userId: string,
  projectId?: string,
  siteId?: string
) {
  const { access } = await buildScopedEntityQuery(userId, { projectId, siteId });
  return access;
}

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
  const access = await getSupervisorAccess(userId);
  if (access.projectIds.length === 0) return [];

  const projects = await Project.find({
    _id: { $in: access.projectIds },
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
  const access = await getSupervisorAccess(userId);
  const projects = await getAssignedProjects(userId);
  const projectIds = access.projectIds.map((id) => id.toString());
  const projectIdToName = new Map<string, string>();
  for (const p of projects) projectIdToName.set(p.id, p.name);

  let siteQuery: Record<string, unknown>;
  if (access.siteIds.length > 0) {
    siteQuery = { _id: { $in: access.siteIds } };
  } else if (access.siteNames.length > 0) {
    siteQuery = { name: { $in: access.siteNames } };
  } else if (access.projectIds.length > 0) {
    siteQuery = { projectIds: { $in: access.projectIds } };
  } else {
    return [];
  }

  const sites = await Site.find(siteQuery)
    .sort({ createdAt: -1 })
    .lean();

  const today = new Date().toISOString().slice(0, 10);

  const labourMatch: Record<string, unknown> = {};
  if (access.projectIds.length > 0) {
    labourMatch.projectId = { $in: access.projectIds };
  }
  const siteScope = await getSiteScopeForFilter(access);
  if (siteScope) Object.assign(labourMatch, siteScope);

  const labourStats = await Labour.aggregate([
    {
      $match: labourMatch,
    },
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
    const matchingProjectId = (s.projectIds || []).find((pid) =>
      projectIds.length === 0 || projectIds.includes(pid.toString())
    );
    const firstProjectId = matchingProjectId?.toString() || s.projectIds?.[0]?.toString();
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

export async function getActionableApprovals(
  userId: string,
  status: "Pending" | "Approved" | "Rejected" | "all" = "Pending"
) {
  const access = await getSupervisorAccess(userId);
  const approvals = await Approval.find(
    approvalScopeQuery(access, status === "all" ? undefined : status)
  )
    .sort({ submittedAt: -1 })
    .limit(status === "all" ? 100 : 50)
    .lean();

  return approvals.map((a) => ({
    _id: a._id.toString(),
    approvalId: a.approvalId,
    type: a.type,
    title: a.title,
    projectId: a.projectId,
    projectName: a.projectName,
    site: a.site,
    amount: a.amount,
    submittedAt: a.submittedAt,
    status: a.status,
    sourceCollection: a.sourceCollection,
    sourceId: a.sourceId,
  }));
}

export async function getSupervisorDashboard(userId: string) {
  const projects = await getAssignedProjects(userId);
  const sites = await getAssignedSites(userId);
  const approvals = await getActionableApprovals(userId);

  const { query: entityScope } = await buildScopedEntityQuery(userId);
  const siteExpenseScope = { ...entityScope, type: "site" };
  const today = new Date().toISOString().slice(0, 10);

  const [pendingMaterials, pendingLabour, pendingExpenses, todayExpenses] = await Promise.all([
    Material.countDocuments({ ...entityScope, status: "Pending" }),
    Labour.countDocuments({ ...entityScope, status: "Pending" }),
    Expense.countDocuments({ ...siteExpenseScope, status: "Pending" }),
Expense.aggregate([
        {
          $match: {
            ...siteExpenseScope,
            date: today,
            transactionType: { $ne: "Cash Added" },
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
  const access = await getSupervisorAccess(userId);
  const requestedProjectId = toObjectId(projectId);
  if (!requestedProjectId) throw new AppError(400, "Invalid project id");

  const project = await Project.findById(requestedProjectId).lean();
  if (!project) throw new AppError(404, "Project not found");

  if (!hasObjectId(access.projectIds, requestedProjectId)) {
    throw new AppError(403, "Not assigned to this project");
  }

  return project;
}

export async function getSupervisorProjectApprovals(userId: string, projectId: string) {
  await getSupervisorProjectDetail(userId, projectId);
  const access = await getSupervisorAccess(userId);

  const approvals = await Approval.find({
    ...approvalScopeQuery(access, "Pending"),
    projectId: new Types.ObjectId(projectId),
  })
    .sort({ submittedAt: -1 })
    .lean();

  return approvals.map((a) => ({
    _id: a._id.toString(),
    approvalId: a.approvalId,
    type: a.type,
    title: a.title,
    site: a.site,
    amount: a.amount,
    submittedAt: a.submittedAt,
    status: a.status,
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
  filters: { projectId?: string; siteId?: string; status?: string; page?: number; limit?: number }
) {
  const { query } = await buildScopedEntityQuery(userId, filters);

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
      issuedAmount: m.issuedAmount,
      givenAmount: (m as any).givenAmount,
      billUrl: (m as any).billUrl,
      received: (m as any).status === 'Received',
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
  filters: { projectId?: string; siteId?: string; status?: string; page?: number; limit?: number }
) {
  const { query } = await buildScopedEntityQuery(userId, filters);

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
  filters: { projectId?: string; siteId?: string; status?: string; type?: string; page?: number; limit?: number }
) {
  const { query } = await buildScopedEntityQuery(userId, filters);

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
      poNumber: e.poNumber,
      receiptImage: e.receiptImage,
      receiptImageMimeType: e.receiptImageMimeType,
      receiptImageName: e.receiptImageName,
      billUrl: (e as any).billUrl,
      received: (e as any).received,
      isSiteMaterial: (e as any).isSiteMaterial,
      materialName: (e as any).materialName,
      materialQuantity: (e as any).materialQuantity,
      materialUnit: (e as any).materialUnit,
      issuedAmount: (e as any).issuedAmount,
      givenAmount: (e as any).givenAmount,
      amount: e.amount,
      date: e.date,
      description: e.description,
      notes: (e as any).notes,
      status: e.status,
      submittedBy: e.submittedBy,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getMaterialDetailForSupervisor(userId: string, materialId: string) {
  const { query } = await buildScopedEntityQuery(userId);
  const material = await Material.findOne({ ...query, _id: materialId }).lean();
  if (!material) throw new AppError(404, "Material not found or not accessible");
  return material;
}

export async function updateMaterialStockForSupervisor(
  userId: string,
  materialId: string,
  updates: { purchasedQuantity?: number; consumedQuantity?: number }
) {
  const { query } = await buildScopedEntityQuery(userId);
  const material = await Material.findOne({ ...query, _id: materialId });
  if (!material) throw new AppError(404, "Material not found or not accessible");
  if (updates.purchasedQuantity !== undefined) {
    material.purchasedQuantity = Math.max(0, material.purchasedQuantity + updates.purchasedQuantity);
  }
  if (updates.consumedQuantity !== undefined) {
    material.consumedQuantity = Math.max(0, material.consumedQuantity + updates.consumedQuantity);
  }
  await material.save();
  return material.toObject();
}

export async function getLabourDetailForSupervisor(userId: string, labourId: string) {
  const { query } = await buildScopedEntityQuery(userId);
  const labour = await Labour.findOne({ ...query, _id: labourId }).lean();
  if (!labour) throw new AppError(404, "Labour entry not found or not accessible");
  return labour;
}

export async function getExpenseDetailForSupervisor(userId: string, expenseId: string) {
  const { query } = await buildScopedEntityQuery(userId);
  const expense = await Expense.findOne({ ...query, _id: expenseId }).lean();
  if (!expense) throw new AppError(404, "Expense not found or not accessible");
  return expense;
}

export async function takeApprovalActionForSupervisor(
  userId: string,
  approvalId: string,
  action: { action: "approve" | "reject"; comment?: string }
) {
  const access = await getSupervisorAccess(userId);
  const approval = await Approval.findOne({ ...approvalScopeQuery(access), _id: approvalId });
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
  const access = await getSupervisorAccess(userId);
  const approval = await Approval.findOne({ ...approvalScopeQuery(access), _id: approvalId }).lean();
  if (!approval) throw new AppError(404, "Approval not found or not accessible");
  return approval;
}
