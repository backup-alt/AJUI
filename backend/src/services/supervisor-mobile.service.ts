import { Types } from "mongoose";

interface CacheEntry<T> { data: T; expiresAt: number; }
const queryCache = new Map<string, CacheEntry<unknown>>();
function getCached<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { queryCache.delete(key); return null; }
  return entry.data as T;
}
function setCache(key: string, data: unknown, ttlMs = 30000): void {
  queryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  if (queryCache.size > 200) {
    const oldest = queryCache.keys().next().value;
    if (oldest) queryCache.delete(oldest);
  }
}
import { User } from "../models/User.js";
import { Supervisor } from "../models/Supervisor.js";
import { Project } from "../models/Project.js";
import { Site } from "../models/Site.js";
import { Material } from "../models/Material.js";
import { Inventory } from "../models/Inventory.js";
import { Labour } from "../models/Labour.js";
import { Worker } from "../models/Worker.js";
import { Expense } from "../models/Expense.js";
import { Payment } from "../models/Payment.js";
import { Approval } from "../models/Approval.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { AppError } from "../middleware/errorHandler.js";
import { buildPCloudMediaUrl } from "./pcloud.service.js";
import { withRetry } from "../utils/retry.js";
import { applyCursor } from "../utils/cursor-pagination.js";
import { dbMutex } from "../utils/db-mutex.js";
import { approveRequest, rejectRequest } from "./approval.service.js";

type SupervisorAccess = {
  user: Awaited<ReturnType<typeof User.findById>>;
  profile: Record<string, any> | null;
  projectIds: Types.ObjectId[];
  siteIds: Types.ObjectId[];
  siteNames: string[];
  siteIdToName: Map<string, string>;
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

const accessCache = new Map<string, { data: SupervisorAccess; expiresAt: number }>();
const ACCESS_CACHE_TTL_MS = 60_000;

function getCachedSupervisorAccess(userId: string): SupervisorAccess | null {
  const entry = accessCache.get(userId);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  if (entry) accessCache.delete(userId);
  return null;
}

function setCachedSupervisorAccess(userId: string, data: SupervisorAccess): void {
  accessCache.set(userId, { data, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
}

export function invalidateAccessCache(userId?: string): void {
  if (userId) {
    accessCache.delete(userId);
  } else {
    accessCache.clear();
  }
}

export async function getSupervisorAccess(userId: string): Promise<SupervisorAccess> {
  const cached = getCachedSupervisorAccess(userId);
  if (cached) return cached;

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

  console.log(`[getSupervisorAccess] user=${userId} profileFound=${!!profile} profileId=${(profile as any)?._id || "none"}`);

  const profileRecord = profile as Record<string, any> | null;
  const profileId = toObjectId(profileRecord?._id);
  if (profileId) {
    const needsProfileLink =
      !user.supervisorProfileId || user.supervisorProfileId.toString() !== profileId.toString();
    const needsUserLink =
      String(profileRecord?.userId || "") !== user._id.toString();
    if (needsProfileLink || needsUserLink) {
      User.updateOne({ _id: user._id }, { $set: { supervisorProfileId: profileId } }).catch(() => {});
      if (needsUserLink) {
        Supervisor.updateOne({ _id: profileId }, { $set: { userId: user._id } }).catch(() => {});
      }
    }
  }

  const projectIds = uniqueObjectIds([
    ...(user.managedProjectIds || []).map(toObjectId),
    toObjectId(profileRecord?.assignedProjectId),
    ...((profileRecord?.assignedProjects || []) as unknown[]).map(toObjectId),
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

  const scopedSiteIds = scopedSites.map((site) => toObjectId(site._id));
  const scopedSiteNames = scopedSites.map((site) => site.name);

  for (const site of scopedSites) {
    for (const pid of site.projectIds || []) {
      projectIds.push(new Types.ObjectId(pid));
    }
  }

  const siteIds = uniqueObjectIds([
    ...explicitSiteIds,
    ...scopedSiteIds,
  ]);

  const siteIdToName = new Map<string, string>();
  for (const site of scopedSites) {
    const id = toObjectId(site._id);
    if (id && site.name) siteIdToName.set(id.toString(), site.name);
  }

  const result: SupervisorAccess = {
    user: user as any,
    profile: profileRecord,
    projectIds: uniqueObjectIds(projectIds),
    siteIds,
    siteNames: uniqueStrings([
      ...scopedSiteNames,
      ...assignedSiteNameFallback,
    ]),
    siteIdToName,
  };

  console.log(`[getSupervisorAccess] resolved: projectIds=${result.projectIds.length} siteIds=${result.siteIds.length} siteNames=${result.siteNames.length} scopedSites=${scopedSites.length}`);

  setCachedSupervisorAccess(userId, result);
  return result;
}

async function getSiteScopeForFilter(access: SupervisorAccess, siteId?: string) {
  if (!siteId) {
    if (access.siteIds.length === 0 && access.siteNames.length === 0) return undefined;
    if (access.siteIds.length > 0) return { siteId: { $in: access.siteIds } };
    return { site: { $in: access.siteNames } };
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

  return { siteId: requestedSiteId };
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
    console.warn(`[buildScopedEntityQuery] No access resolved for user ${userId} — returning empty`);
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
  if (access.siteIds.length > 0) {
    if (query.site) {
      // Already filtering by site names, also include siteId matches
      query.$or = [
        { site: { $in: access.siteNames } },
        { siteId: { $in: access.siteIds } },
      ];
      delete query.site;
    } else {
      query.siteId = { $in: access.siteIds };
    }
  }
  if (access.projectIds.length === 0 && access.siteIds.length === 0 && access.siteNames.length === 0) {
    console.warn(`[approvalScopeQuery] No access resolved — returning empty`);
    query._id = { $exists: false };
  }
  if (status) query.status = status;
  return query;
}

function runMobileDb<T>(label: string, factory: () => Promise<T>): Promise<T> {
  return dbMutex.run(() => withRetry(factory, { label }));
}

function estimatedMobileTotal(itemsLength: number, limit: number, hasCursor?: boolean): number {
  if (hasCursor) return itemsLength;
  return itemsLength === limit ? limit + 1 : itemsLength;
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

  invalidateAccessCache(userId);
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

  // Count actual workers assigned to each site (from Worker model)
  const workerMatch: Record<string, unknown> = {};
  if (access.projectIds.length > 0) {
    workerMatch.projectId = { $in: access.projectIds };
  }
  const siteScope = await getSiteScopeForFilter(access);
  if (siteScope) Object.assign(workerMatch, siteScope);

  const workerStats = await runMobileDb("mobile.assignedSites.workerStats", () =>
    Worker.aggregate([
      {
        $match: { ...workerMatch },
      },
      {
        $group: {
          _id: { site: "$site", projectId: "$projectId" },
          workerCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          site: "$_id.site",
          projectId: "$_id.projectId",
          workerCount: 1,
        },
      },
    ]).option({ maxTimeMS: 20_000 })
  );

  // Also get Labour-based stats for daysActive count
  const labourMatch: Record<string, unknown> = {};
  if (access.projectIds.length > 0) {
    labourMatch.projectId = { $in: access.projectIds };
  }
  if (siteScope) Object.assign(labourMatch, siteScope);

  const labourStats = await runMobileDb("mobile.assignedSites.labourStats", () =>
    Labour.aggregate([
      {
        $match: labourMatch,
      },
      {
        $group: {
          _id: { site: "$site", projectId: "$projectId" },
          daysActive: { $addToSet: "$attendanceDate" },
        },
      },
      {
        $project: {
          _id: 0,
          site: "$_id.site",
          projectId: "$_id.projectId",
          daysActiveCount: { $size: "$daysActive" },
        },
      },
    ]).option({ maxTimeMS: 20_000 })
  );

  const workerMap = new Map<string, { workerCount: number; daysActiveCount: number }>();
  for (const stat of workerStats) {
    const siteName = stat.site as string;
    const key = siteName;
    const existing = workerMap.get(key) || { workerCount: 0, daysActiveCount: 0 };
    existing.workerCount += stat.workerCount;
    workerMap.set(key, existing);
  }
  for (const stat of labourStats) {
    const siteName = stat.site as string;
    const key = siteName;
    const existing = workerMap.get(key) || { workerCount: 0, daysActiveCount: 0 };
    existing.daysActiveCount = stat.daysActiveCount;
    workerMap.set(key, existing);
  }

  return sites.map((s) => {
    const stats = workerMap.get(s.name) || { workerCount: 0, daysActiveCount: 0 };
    const firstProjectId = s.projectIds?.[0]?.toString();
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
      employeeCount: stats.workerCount,
      daysActive: stats.daysActiveCount,
      openingBalance: Number(s.openingBalance) || 0,
      updatedAt: (s as any).updatedAt?.toISOString?.() || s.createdAt?.toISOString?.(),
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
    .select("_id approvalId type title projectId projectName site amount submittedAt status sourceCollection sourceId")
    .sort({ submittedAt: -1 })
    .limit(25)
    .lean()
    .maxTimeMS(20_000);

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

export async function getSupervisorDashboard(
  userId: string,
  filters: { siteId?: string; projectId?: string } = {}
) {
  const access = await getSupervisorAccess(userId);
  const { query: entityScope } = await buildScopedEntityQuery(userId, filters);
  const today = new Date().toISOString().slice(0, 10);

  const projectQuery: Record<string, unknown> = { status: { $ne: "Completed" } };
  if (filters.projectId) {
    const requestedProjectId = toObjectId(filters.projectId);
    if (requestedProjectId) projectQuery._id = requestedProjectId;
  } else if (access.projectIds.length > 0) {
    projectQuery._id = { $in: access.projectIds };
  } else {
    projectQuery._id = { $exists: false };
  }

  let siteQuery: Record<string, unknown> = {};
  if (filters.siteId) {
    const requestedSiteId = toObjectId(filters.siteId);
    siteQuery = requestedSiteId ? { _id: requestedSiteId } : { _id: { $exists: false } };
  } else if (access.siteIds.length > 0) {
    siteQuery = { _id: { $in: access.siteIds } };
  } else if (access.siteNames.length > 0) {
    siteQuery = { name: { $in: access.siteNames } };
  } else if (access.projectIds.length > 0) {
    siteQuery = { projectIds: { $in: access.projectIds } };
  } else {
    siteQuery = { _id: { $exists: false } };
  }

  const approvalQuery = approvalScopeQuery(access, "Pending");
  if (filters.projectId) approvalQuery.projectId = toObjectId(filters.projectId) || approvalQuery.projectId;
  const todayExpensesQuery = { ...entityScope, type: "site", date: today, transactionType: { $ne: "Cash Added" } };
  const safeDashboardList = async <T>(label: string, promise: Promise<T[]>): Promise<T[]> => {
    try {
      return await promise;
    } catch (err) {
      console.warn(`[mobile.dashboard] ${label} failed:`, (err as Error).message);
      return [];
    }
  };

  const [projects, sites, pendingApprovalCount, todayExpenseRows, inventoryCount, workerStats] = await Promise.all([
    safeDashboardList("projects", Project.find(projectQuery)
      .select("_id projectId name client clientId status startDate totalValue receivedAmount pendingBalance materialSpend labourPayable completion siteNames lastActivityAt")
      .sort({ lastActivityAt: -1, _id: -1 })
      .limit(10)
      .lean()
      .maxTimeMS(8_000)),
    safeDashboardList("sites", Site.find(siteQuery)
      .select("_id siteId name status supervisor startDate targetEndDate projectIds openingBalance updatedAt createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .limit(25)
      .lean()
      .maxTimeMS(8_000)),
    // Use count instead of fetching full approval documents
    (async () => {
      try {
        return await Approval.countDocuments(approvalQuery).maxTimeMS(8_000);
      } catch (err) {
        console.warn('[mobile.dashboard] approvals count failed:', (err as Error).message);
        return 0;
      }
    })(),
    safeDashboardList("todayExpenses", Expense.find(todayExpensesQuery)
      .select("_id expenseId type projectId projectName siteId site transactionType amount date description status materialVendor createdAt")
      .sort({ _id: -1 })
      .limit(5)
      .lean()
      .maxTimeMS(8_000)),
    // Use count instead of fetching full inventory documents
    (async () => {
      try {
        return await Inventory.countDocuments(entityScope).maxTimeMS(8_000);
      } catch (err) {
        console.warn('[mobile.dashboard] inventory count failed:', (err as Error).message);
        return 0;
      }
    })(),
    safeDashboardList("workerStats", Worker.aggregate([
      { $match: entityScope },
      {
        $group: {
          _id: { siteId: "$siteId", site: "$site" },
          workerCount: { $sum: 1 },
        },
      },
    ]).option({ maxTimeMS: 8_000 }).exec()),
  ]);

  const mappedProjects = projects.map((p) => ({
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

  const projectIdToName = new Map(mappedProjects.map((p) => [String(p.id), p.name]));
  const workersBySiteId = new Map<string, number>();
  const workersBySiteName = new Map<string, number>();
  for (const stat of workerStats) {
    const count = Number(stat.workerCount) || 0;
    const siteId = stat._id?.siteId?.toString();
    const siteName = String(stat._id?.site || "").trim().toLowerCase();
    if (siteId) workersBySiteId.set(siteId, (workersBySiteId.get(siteId) || 0) + count);
    if (siteName) workersBySiteName.set(siteName, (workersBySiteName.get(siteName) || 0) + count);
  }
  const mappedSites = sites.map((s) => {
    const firstProjectId = s.projectIds?.[0]?.toString();
    const employeeCount = workersBySiteId.get(s._id.toString())
      ?? workersBySiteName.get(s.name.trim().toLowerCase())
      ?? 0;
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
      employeeCount,
      daysActive: 0,
      openingBalance: Number(s.openingBalance) || 0,
      updatedAt: (s as any).updatedAt?.toISOString?.() || s.createdAt?.toISOString?.(),
    };
  });

  const todayTotal = todayExpenseRows.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

  return {
    counts: {
      projects: mappedProjects.length,
      sites: mappedSites.length,
      pendingApprovals: pendingApprovalCount,
      pendingMaterials: 0,
      pendingLabour: 0,
      pendingExpenses: 0,
      inventory: inventoryCount,
      labour: workerStats.reduce((total, stat) => total + (Number(stat.workerCount) || 0), 0),
    },
    todayExpense: {
      total: todayTotal,
      count: todayExpenseRows.length,
    },
    projects: mappedProjects,
    sites: mappedSites,
    todayExpenses: todayExpenseRows,
    pendingApprovals: [],
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
  filters: {
    projectId?: string;
    siteId?: string;
    status?: string;
    page?: number;
    limit?: number;
    cursor?: string;
    search?: string;
    stockStatus?: "all" | "available" | "low" | "out";
  }
) {
  const { access, query } = await buildScopedEntityQuery(userId, {
    projectId: filters.projectId,
    siteId: filters.siteId,
  });
  if (filters.status) query.status = filters.status;

  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 25);

  if (filters.status === "Approved") {
    const invQuery: Record<string, any> = { ...query };
    delete invQuery.status;
    const andConditions: Record<string, unknown>[] = [];
    const search = String(filters.search || "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: escaped, $options: "i" };
      andConditions.push({ $or: [{ name: regex }, { vendor: regex }, { poNumber: regex }, { site: regex }] });
    }
    if (filters.stockStatus === "available") {
      andConditions.push({ remainingStock: { $gt: 0 } });
    } else if (filters.stockStatus === "out") {
      andConditions.push({ remainingStock: { $lte: 0 } });
    } else if (filters.stockStatus === "low") {
      andConditions.push({
        $expr: {
          $and: [
            { $gt: ["$remainingStock", 0] },
            { $lte: ["$remainingStock", { $ifNull: ["$minimumQuantity", 0] }] },
          ],
        },
      });
    }
    if (andConditions.length > 0) {
      invQuery.$and = [...(Array.isArray(invQuery.$and) ? invQuery.$and : []), ...andConditions];
    }
    applyCursor(invQuery, filters.cursor);

    let items = await dbMutex.run(() =>
      withRetry(
        () => Inventory.find(invQuery)
          .select({ receiptImage: 0, receiptImageMimeType: 0, receiptImageName: 0 })
          .sort({ _id: -1 })
          .limit(limit)
          .lean()
          .maxTimeMS(20_000),
        { label: "mobile.listMaterials.inv.find" }
      )
    ).catch((err) => {
      console.error("[mobile.listMaterials] inventory query failed:", (err as Error).message);
      throw new AppError(503, "Inventory is temporarily unavailable. Please retry.");
    });

    if (items.length === 0 && (invQuery as any).siteId) {
      const fallbackQuery: Record<string, unknown> = { ...invQuery };
      const siteIdCondition = (fallbackQuery as any).siteId;
      delete (fallbackQuery as any).siteId;
      const names = filters.siteId
        ? uniqueStrings([access.siteIdToName.get(filters.siteId)])
        : access.siteNames;
      const siteKeys = names.map((name) => name.trim().toLowerCase()).filter(Boolean);
      const siteOr: Record<string, unknown>[] = [{ siteId: siteIdCondition }];
      if (names.length > 0) siteOr.push({ site: { $in: names } });
      if (siteKeys.length > 0) siteOr.push({ siteKey: { $in: siteKeys } });
      fallbackQuery.$and = [
        ...(Array.isArray(fallbackQuery.$and) ? fallbackQuery.$and as Record<string, unknown>[] : []),
        { $or: siteOr },
      ];

      items = await dbMutex.run(() =>
        withRetry(
          () => Inventory.find(fallbackQuery)
            .select({ receiptImage: 0, receiptImageMimeType: 0, receiptImageName: 0 })
            .sort({ _id: -1 })
            .limit(limit)
            .lean()
            .maxTimeMS(20_000),
          { label: "mobile.listMaterials.inv.fallbackFind" }
        )
      ).catch((err) => {
        console.error("[mobile.listMaterials] inventory fallback query failed:", (err as Error).message);
        throw new AppError(503, "Inventory is temporarily unavailable. Please retry.");
      });
    }

    // Batch-fetch billUrl for purchaseHistory entries across all items
    const allMatIds = items.flatMap((m) =>
      (m.purchaseHistory || []).filter((h: any) => h.materialId).map((h: any) => h.materialId)
    );
    let billMap = new Map<string, string>();
    if (allMatIds.length > 0) {
      try {
        const linkedMats = await Material.find({ _id: { $in: allMatIds } }).select("_id billUrl pcloudFileId").lean();
        billMap = new Map(linkedMats.map((m: any) => [
          m._id.toString(),
          m.pcloudFileId ? buildPCloudMediaUrl(String(m.pcloudFileId)) : (m.billUrl || ''),
        ]));
      } catch {}
    }

    return {
      materials: items.map((m) => ({
        _id: m._id.toString(),
        materialId: m._id.toString(),
        projectId: m.projectId,
        projectName: m.projectName,
        siteId: m.siteId,
        site: m.site,
        name: m.name,
        unit: m.unit,
        requestedQuantity: m.requestedQuantity || m.approvedQuantity,
        approvedQuantity: m.approvedQuantity,
        purchasedQuantity: m.purchasedQuantity,
        consumedQuantity: m.consumedQuantity,
        remainingStock: m.remainingStock,
        minimumQuantity: m.minimumQuantity,
        vendor: m.vendor,
        poNumber: m.poNumber,
        billUrl: m.pcloudFileId ? buildPCloudMediaUrl(String(m.pcloudFileId)) : m.billUrl,
        received: m.received,
        purchaseHistory: (m.purchaseHistory || []).map((h: any) => ({
          vendor: h.vendor,
          quantity: h.quantity,
          date: h.date,
          poNumber: h.poNumber,
          materialId: h.materialId,
          billUrl: h.materialId ? (billMap.get(h.materialId.toString()) || '') : '',
        })),
        requestDate: m.createdAt,
        status: "Approved" as const,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      pagination: {
        limit,
        total: estimatedMobileTotal(items.length, limit, !!filters.cursor),
        pages: items.length === limit ? 2 : 1,
        nextCursor: items.length === limit ? String((items[items.length - 1] as any)?._id ?? "") : null,
      },
    };
  }

  applyCursor(query, filters.cursor);
  const items = await dbMutex.run(() =>
    withRetry(
      () => Material.find(query)
        .select({ receiptImage: 0, receiptImageMimeType: 0, receiptImageName: 0 })
        .sort({ _id: -1 })
        .limit(limit)
        .lean()
        .maxTimeMS(20_000),
      { label: "mobile.listMaterials.find" }
    )
  ).catch((err) => {
    console.error("[mobile.listMaterials] main query failed:", (err as Error).message);
    throw new AppError(503, "Materials are temporarily unavailable. Please retry.");
  });

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
      billUrl: (m as any).pcloudFileId
        ? buildPCloudMediaUrl(String((m as any).pcloudFileId))
        : (m as any).billUrl,
      received: (m as any).status === "Received",
      requestDate: m.requestDate,
      status: m.status,
      notes: m.notes,
      createdBy: m.createdBy,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })),
    pagination: {
      limit,
      total: estimatedMobileTotal(items.length, limit, !!filters.cursor),
      pages: items.length === limit ? 2 : 1,
      nextCursor: items.length === limit ? String((items[items.length - 1] as any)?._id ?? "") : null,
    },
  };
}

export async function listMaterialBillRequestsForSupervisor(
  userId: string,
  filters: { projectId?: string; siteId?: string; limit?: number; cursor?: string }
) {
  const { query } = await buildScopedEntityQuery(userId, {
    projectId: filters.projectId,
    siteId: filters.siteId,
  });
  query.approvedAt = { $exists: true };
  query.status = { $in: ["Approved", "Not Received", "Received"] };
  applyCursor(query, filters.cursor);

  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 25);
  const items = await dbMutex.run(() =>
    withRetry(
      () => Material.find(query)
        .select({ receiptImage: 0, receiptImageMimeType: 0 })
        .sort({ _id: -1 })
        .limit(limit)
        .lean()
        .maxTimeMS(20_000),
      { label: "mobile.listMaterialBillRequests.find" }
    )
  ).catch((err) => {
    console.error("[mobile.listMaterialBillRequests] query failed:", (err as Error).message);
    throw new AppError(503, "Material bill requests are temporarily unavailable. Please retry.");
  });

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
      issuedAmount: m.issuedAmount,
      givenAmount: m.givenAmount,
      billUrl: (m as any).pcloudFileId
        ? buildPCloudMediaUrl(String((m as any).pcloudFileId))
        : m.billUrl,
      receiptImageName: m.receiptImageName,
      requestDate: m.requestDate,
      status: m.status,
      approvedAt: m.approvedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })),
    pagination: {
      limit,
      total: estimatedMobileTotal(items.length, limit, !!filters.cursor),
      pages: items.length === limit ? 2 : 1,
      nextCursor: items.length === limit ? String(items[items.length - 1]?._id ?? "") : null,
    },
  };
}

export async function listLabourForSupervisor(
  userId: string,
  filters: { projectId?: string; siteId?: string; status?: string; page?: number; limit?: number; cursor?: string }
) {
  const { query } = await buildScopedEntityQuery(userId, filters);

  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 25);
  applyCursor(query, filters.cursor);

  const items = await dbMutex.run(() =>
    withRetry(
      () => Labour.find(query)
        .sort({ _id: -1 })
        .limit(limit)
        .lean()
        .maxTimeMS(20_000),
      { label: "mobile.listLabour.find" }
    )
  ).catch((err) => {
    console.error("[mobile.listLabour] main query failed:", (err as Error).message);
    throw new AppError(503, "Labour is temporarily unavailable. Please retry.");
  });

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
    pagination: {
      limit,
      total: estimatedMobileTotal(items.length, limit, !!filters.cursor),
      pages: items.length === limit ? 2 : 1,
      nextCursor: items.length === limit ? String((items[items.length - 1] as any)?._id ?? "") : null,
    },
  };
}

export async function listExpensesForSupervisor(
  userId: string,
  filters: { projectId?: string; siteId?: string; status?: string; type?: string; page?: number; limit?: number; cursor?: string }
) {
  const { query } = await buildScopedEntityQuery(userId, filters);

  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 25);
  applyCursor(query, filters.cursor);

  const items = await dbMutex.run(() =>
    withRetry(
      () => Expense.find(query)
        .select({ receiptImage: 0, receiptImageMimeType: 0, receiptImageName: 0 })
        .sort({ _id: -1 })
        .limit(limit)
        .lean()
        .maxTimeMS(20_000),
      { label: "mobile.listExpenses.find" }
    )
  ).catch((err) => {
    console.error("[mobile.listExpenses] main query failed:", (err as Error).message);
    throw new AppError(503, "Expenses are temporarily unavailable. Please retry.");
  });

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
      billUrl: (e as any).pcloudFileId
        ? buildPCloudMediaUrl(String((e as any).pcloudFileId))
        : (e as any).billUrl,
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
    pagination: {
      limit,
      total: estimatedMobileTotal(items.length, limit, !!filters.cursor),
      pages: items.length === limit ? 2 : 1,
      nextCursor: items.length === limit ? String((items[items.length - 1] as any)?._id ?? "") : null,
    },
  };
}

export async function getMaterialDetailForSupervisor(userId: string, materialId: string) {
  const { query } = await buildScopedEntityQuery(userId);
  const material =
    await Inventory.findOne({ ...query, _id: materialId }).lean() ||
    await Material.findOne({ ...query, _id: materialId }).lean();
  if (!material) throw new AppError(404, "Material not found or not accessible");

  const result: any = material;
  if (result.pcloudFileId) {
    result.billUrl = buildPCloudMediaUrl(String(result.pcloudFileId));
  }

  const linkedId = (material as any).lastMaterialId;
  if (linkedId) {
      try {
        const linked = await Material.findById(linkedId).select("billUrl pcloudFileId pcloudPublicCode poNumber vendor").lean();
        if (linked) {
          result.billUrl = linked.pcloudFileId
            ? buildPCloudMediaUrl(String(linked.pcloudFileId))
            : (linked.billUrl || result.billUrl);
          result.pcloudFileId = linked.pcloudFileId || result.pcloudFileId;
          result.pcloudPublicCode = linked.pcloudPublicCode || result.pcloudPublicCode;
        }
    } catch {}
  }

  // Enrich purchaseHistory entries with billUrl from their linked Material documents
  const history = (result as any).purchaseHistory;
  if (Array.isArray(history) && history.length > 0) {
    const matIds = history
      .filter((h: any) => h.materialId)
      .map((h: any) => h.materialId);
    if (matIds.length > 0) {
      try {
        const linkedMats = await Material.find({ _id: { $in: matIds } })
          .select("_id billUrl pcloudFileId")
          .lean();
        const billMap = new Map(linkedMats.map((m: any) => [
          m._id.toString(),
          m.pcloudFileId ? buildPCloudMediaUrl(String(m.pcloudFileId)) : m.billUrl,
        ]));
        for (const entry of history) {
          if (entry.materialId) {
            entry.billUrl = billMap.get(entry.materialId.toString()) || '';
          }
        }
      } catch {}
    }
  }

  return result;
}

export async function updateMaterialStockForSupervisor(
  userId: string,
  materialId: string,
  updates: { purchasedQuantity?: number; consumedQuantity?: number }
) {
  const { query } = await buildScopedEntityQuery(userId);
  const inventory = await Inventory.findOne({ ...query, _id: materialId });
  if (!inventory) throw new AppError(404, "Material not found or not accessible");
  if (updates.purchasedQuantity !== undefined) {
    inventory.purchasedQuantity = Math.max(0, inventory.purchasedQuantity + updates.purchasedQuantity);
    inventory.approvedQuantity = Math.max(inventory.approvedQuantity, inventory.purchasedQuantity);
  }
  if (updates.consumedQuantity !== undefined) {
    inventory.consumedQuantity = Math.max(0, inventory.consumedQuantity + updates.consumedQuantity);
    if (updates.consumedQuantity > 0) {
      inventory.consumptionHistory = inventory.consumptionHistory || [];
      inventory.consumptionHistory.push({
        quantity: updates.consumedQuantity,
        date: new Date(),
        updatedBy: userId,
      });
    }
  }
  await inventory.save();

  // Keep the linked Material document in sync so all views (mobile + web)
  // see the same purchased / consumed / remaining numbers.
  if (inventory.lastMaterialId) {
    try {
      const linkedMaterial = await Material.findById(inventory.lastMaterialId);
      if (linkedMaterial) {
        linkedMaterial.purchasedQuantity = inventory.purchasedQuantity;
        linkedMaterial.consumedQuantity = inventory.consumedQuantity;
        linkedMaterial.approvedQuantity = inventory.approvedQuantity;
        await linkedMaterial.save();
      }
    } catch (err) {
      console.warn("[supervisor-mobile] failed to sync linked material", err);
    }
  }

  return inventory.toObject();
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

  if (!approval.approvalId) {
    throw new AppError(500, "Approval is missing its business identifier");
  }

  if (action.comment) {
    approval.detail = action.comment;
    await approval.save();
  }

  // Keep mobile and web approvals on one canonical path. This also creates
  // or updates Inventory whenever a material request is approved.
  return action.action === "approve"
    ? approveRequest(approval.approvalId, userId)
    : rejectRequest(approval.approvalId, userId);
}

export async function getApprovalDetailForSupervisor(userId: string, approvalId: string) {
  const access = await getSupervisorAccess(userId);
  const approval = await Approval.findOne({ ...approvalScopeQuery(access), _id: approvalId }).lean();
  if (!approval) throw new AppError(404, "Approval not found or not accessible");
  return approval;
}

export async function listMaterialNames(userId: string, search?: string) {
  const { query } = await buildScopedEntityQuery(userId);
  const matchStage: Record<string, unknown> = { ...query };
  if (search) {
    matchStage.name = { $regex: search, $options: "i" };
  }
  const names = await Inventory.distinct("name", matchStage);
  return names.sort();
}

/**
 * Add or update a material that already exists at the site.
 *
 * This is the "Add Existing Material" workflow — supervisors record
 * materials that are already on-site (e.g., leftover stock from a previous
 * project, materials transferred from another site, or stock found during
 * a site survey). No approval workflow is involved; the record is saved
 * directly to the Inventory collection.
 *
 * Behaviour:
 * - If a record with the same (projectId, siteKey, normalizedName, normalizedUnit)
 *   already exists, the supplied quantity is ADDED to purchasedQuantity and
 *   approvedQuantity, and vendor/poNumber are updated if provided.
 * - Otherwise, a new Inventory record is created with the supplied details.
 *
 * Authorization: supervisors only. Project assignment is verified — the
 * supervisor must be assigned to the project.
 */
export async function addExistingMaterialForSupervisor(
  userId: string,
  input: {
    projectId: string;
    siteId?: string;
    site: string;
    name: string;
    unit: string;
    quantity?: number;
    vendor?: string;
    vendorId?: string;
    poNumber?: string;
    minimumQuantity?: number;
    notes?: string;
  }
) {
  const projectObjectId = toObjectId(input.projectId);
  if (!projectObjectId) throw new AppError(400, "Invalid project id");

  // Verify supervisor is assigned to this project (and site if provided)
  const { access } = await buildScopedEntityQuery(userId, {
    projectId: input.projectId,
    siteId: input.siteId,
  });
  // buildScopedEntityQuery throws 403 if not assigned; if we reach here, OK.

  const project = await Project.findById(projectObjectId).select("_id name clientId clientName").lean();
  if (!project) throw new AppError(404, "Project not found");

  const siteObjectId = input.siteId ? toObjectId(input.siteId) : undefined;
  const normalizedName = String(input.name || "").trim().toLowerCase();
  const normalizedUnit = String(input.unit || "").trim().toLowerCase();
  const siteKey = siteObjectId ? siteObjectId.toString() : String(input.site || "").trim().toLowerCase();
  const qty = Math.max(0, Number(input.quantity) || 0);

  // Find existing inventory record using the unique compound key
  const existing = await Inventory.findOne({
    projectId: projectObjectId,
    siteKey,
    normalizedName,
    normalizedUnit,
  });

  const trimmedNotes = String(input.notes || "").trim() || undefined;
  // Persist the supervisor's note at the Inventory level (top-level + on the
  // matching purchaseHistory entry) so it round-trips through the API.
  // The note is also written to the Material record below so the web app's
  // Materials table can show it without needing a join to the inventory
  // collection.

  if (existing) {
    // Add quantities to the existing record
    existing.purchasedQuantity = (existing.purchasedQuantity || 0) + qty;
    existing.approvedQuantity = Math.max(existing.approvedQuantity || 0, existing.purchasedQuantity);
    existing.remainingStock = Math.max(0, existing.purchasedQuantity - (existing.consumedQuantity || 0));
    if (input.vendor) existing.vendor = input.vendor;
    if (input.vendorId) {
      const vid = toObjectId(input.vendorId);
      if (vid) existing.vendorId = vid;
    }
    if (input.poNumber) existing.poNumber = input.poNumber;
    if (input.minimumQuantity !== undefined) existing.minimumQuantity = input.minimumQuantity;
    if (trimmedNotes) existing.notes = trimmedNotes;
    existing.lastUpdatedBy = userId;
    existing.purchaseHistory = existing.purchaseHistory || [];
    existing.purchaseHistory.push({
      vendor: input.vendor || existing.vendor || "",
      vendorId: input.vendorId ? toObjectId(input.vendorId) || undefined : undefined,
      quantity: qty,
      date: new Date(),
      poNumber: input.poNumber || existing.poNumber,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    });
    await existing.save();
    await syncExistingMaterialWithNotes({
      material: existing,
      project,
      siteObjectId: siteObjectId ?? undefined,
      userId,
      notes: trimmedNotes,
    });
    return {
      inventory: existing.toObject(),
      created: false,
      message: `Added ${qty} ${input.unit} to existing ${input.name}. Total: ${existing.purchasedQuantity} ${input.unit}.`,
    };
  }

  // Create new inventory record
  const inv = new Inventory({
    projectId: projectObjectId,
    projectName: project.name,
    clientId: project.clientId,
    siteId: siteObjectId,
    site: input.site,
    siteKey,
    name: String(input.name).trim(),
    normalizedName,
    unit: String(input.unit).trim(),
    normalizedUnit,
    requestedQuantity: qty,
    approvedQuantity: qty,
    purchasedQuantity: qty,
    consumedQuantity: 0,
    remainingStock: qty,
    minimumQuantity: input.minimumQuantity || 0,
    vendor: input.vendor,
    vendorId: input.vendorId ? toObjectId(input.vendorId) || undefined : undefined,
    poNumber: input.poNumber,
    notes: trimmedNotes,
    lastUpdatedBy: userId,
    received: true,
    purchaseHistory: qty > 0 ? [{
      vendor: input.vendor || "",
      vendorId: input.vendorId ? toObjectId(input.vendorId) || undefined : undefined,
      quantity: qty,
      date: new Date(),
      poNumber: input.poNumber,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    }] : undefined,
  });
  await inv.save();
  await syncExistingMaterialWithNotes({
    material: inv,
    project,
    siteObjectId: siteObjectId ?? undefined,
    userId,
    notes: trimmedNotes,
  });
  return {
    inventory: inv.toObject(),
    created: true,
    message: `Recorded ${qty} ${input.unit} of ${input.name} at ${input.site}.`,
  };
}

/**
 * Make sure the supervisor's "Add existing material" note also lands on the
 * corresponding Material record so the web app's Materials table shows it
 * without a separate query. We upsert by (projectId, siteId|site, name, unit)
 * — the same compound key the inventory and approvals services use — and
 * preserve the existing materialId if a row already exists.
 */
async function syncExistingMaterialWithNotes(params: {
  material: { _id: Types.ObjectId; name: string; unit: string; projectId: Types.ObjectId; projectName?: string; clientId?: Types.ObjectId; clientName?: string; siteId?: Types.ObjectId; site: string; vendor?: string; vendorId?: Types.ObjectId; poNumber?: string; purchasedQuantity?: number; approvedQuantity?: number; remainingStock?: number; notes?: string };
  project: { _id: Types.ObjectId; name: string; clientId?: Types.ObjectId; clientName?: string };
  siteObjectId?: Types.ObjectId;
  userId: string;
  notes?: string;
}): Promise<void> {
  try {
    const { Material } = await import("../models/Material.js");
    const m = params.material;
    const query: Record<string, unknown> = {
      projectId: m.projectId,
      name: m.name,
      unit: m.unit,
    };
    if (m.siteId) query.siteId = m.siteId; else query.site = m.site;

    const existingMaterial = await Material.findOne(query);
    if (existingMaterial) {
      let changed = false;
      // Only refresh the note if the supervisor actually provided one — we
      // never clobber a non-empty note with empty.
      if (params.notes) {
        existingMaterial.notes = params.notes;
        changed = true;
      }
      if (m.purchasedQuantity !== undefined) {
        existingMaterial.purchasedQuantity =
          (existingMaterial.purchasedQuantity || 0) + Number(m.purchasedQuantity) || 0;
        existingMaterial.approvedQuantity = Math.max(
          existingMaterial.approvedQuantity || 0,
          existingMaterial.purchasedQuantity || 0
        );
        existingMaterial.remainingStock = Math.max(
          0,
          (existingMaterial.purchasedQuantity || 0) - (existingMaterial.consumedQuantity || 0)
        );
        changed = true;
      }
      if (m.vendor && !existingMaterial.vendor) {
        existingMaterial.vendor = m.vendor;
        changed = true;
      }
      if (m.vendorId && !existingMaterial.vendorId) {
        existingMaterial.vendorId = m.vendorId;
        changed = true;
      }
      if (m.poNumber && !existingMaterial.poNumber) {
        existingMaterial.poNumber = m.poNumber;
        changed = true;
      }
      if (changed) await existingMaterial.save();
      return;
    }

    // No existing material row — create one so the supervisor's record and
    // note show up in the web Materials table immediately.
    const { generateId } = await import("./id-generator.service.js");
    const materialId = await generateId("MAT");
    const today = new Date().toISOString().slice(0, 10);
    await Material.create({
      materialId,
      projectId: m.projectId,
      projectName: m.projectName || params.project.name,
      clientId: m.clientId || params.project.clientId,
      clientName: m.clientName || params.project.clientName,
      siteId: m.siteId,
      site: m.site,
      name: m.name,
      unit: m.unit,
      requestedQuantity: Number(m.purchasedQuantity) || 0,
      approvedQuantity: Number(m.purchasedQuantity) || 0,
      purchasedQuantity: Number(m.purchasedQuantity) || 0,
      consumedQuantity: 0,
      remainingStock: Number(m.remainingStock ?? m.purchasedQuantity) || 0,
      vendor: m.vendor,
      vendorId: m.vendorId,
      poNumber: m.poNumber,
      requestDate: today,
      status: "Received",
      createdBy: params.userId,
      supervisorName: params.userId,
      notes: params.notes,
    });
  } catch (err) {
    // Best-effort: never let the material sync fail the inventory write.
    // The note is already persisted on the Inventory record so the audit
    // trail survives even if the material write fails.
    console.warn("[addExistingMaterial] failed to sync material record:", (err as Error)?.message || err);
  }
}

export async function getRecentNotificationsForSupervisor(userId: string, limit: number) {
  const access = await getSupervisorAccess(userId);
  const query = approvalScopeQuery(access);
  // Fetch approved and rejected approvals (not pending) owned by this supervisor
  query.status = { $in: ["Approved", "Rejected"] };
  query.owner = userId;

  const approvals = await Approval.find(query)
    .sort({ reviewedAt: -1, submittedAt: -1 })
    .limit(limit)
    .lean();

  return approvals.map((a) => ({
    id: a._id.toString(),
    title: a.title,
    body: a.status === "Approved"
      ? `Approved${a.detail ? ' - ' + a.detail : ''}${a.amount ? ' (₹' + Number(a.amount).toLocaleString('en-IN') + ')' : ''}${a.poNumber ? '. PO: ' + a.poNumber : ''}`
      : `Rejected${a.detail ? ' - ' + a.detail : ''}${a.amount ? ' (₹' + Number(a.amount).toLocaleString('en-IN') + ')' : ''}`,
    type: a.type,
    status: a.status,
    receivedAt: (a.reviewedAt || a.submittedAt)?.getTime() || Date.now(),
    read: false,
  }));
}
