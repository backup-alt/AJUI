import { Types } from "mongoose";
import { Project } from "../models/Project.js";
import { Payment } from "../models/Payment.js";
import { Client } from "../models/Client.js";
import { Site } from "../models/Site.js";
import { Supervisor } from "../models/Supervisor.js";
import { User } from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { invalidateAccessCache } from "./supervisor-mobile.service.js";
import {
  CreateProjectInput,
  UpdateProjectInput,
} from "../schemas/entities.schema.js";
import { recomputeClientTotals, recomputeProjectTotals, computeProjectLedger } from "./financial.service.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { paginateByCursor } from "../utils/cursor-pagination.js";

function toObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  const str = String(value);
  return Types.ObjectId.isValid(str) ? new Types.ObjectId(str) : null;
}

function exactNamePattern(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

/**
 * Older supervisor records can be linked only from User.supervisorProfileId,
 * leaving Supervisor.userId empty. Project assignment then updates the
 * profile but cannot update the User document used by Roles & Employees and
 * RBAC. Repair that reverse link whenever a project touches the profile.
 */
async function ensureSupervisorUserLink(
  supervisorProfileId: Types.ObjectId,
): Promise<Types.ObjectId | null> {
  const profile = await Supervisor.findById(supervisorProfileId)
    .select("_id userId email phone")
    .lean();
  if (!profile) return null;
  if (profile.userId) return profile.userId as Types.ObjectId;

  const identity: Record<string, unknown>[] = [
    { supervisorProfileId: profile._id },
  ];
  if (profile.email) identity.push({ email: profile.email.toLowerCase() });
  if (profile.phone) identity.push({ phone: profile.phone });

  const user = await User.findOne({
    role: "supervisor",
    $or: identity,
  }).select("_id").lean();
  if (!user?._id) return null;

  await Promise.all([
    Supervisor.updateOne(
      { _id: profile._id },
      { $set: { userId: user._id } },
    ),
    User.updateOne(
      { _id: user._id },
      { $set: { supervisorProfileId: profile._id } },
    ),
  ]);
  return user._id as Types.ObjectId;
}

/**
 * Project forms historically sent a User id while Project.supervisorId points
 * at a Supervisor profile. Resolve either representation and lazily create the
 * profile for older supervisor accounts accepted without an initial project.
 */
async function resolveSupervisorProfileId(
  value: unknown,
  supervisorName?: string,
): Promise<Types.ObjectId | null> {
  const candidateId = toObjectId(value);
  const profileQuery = candidateId
    ? { $or: [{ _id: candidateId }, { userId: candidateId }] }
    : supervisorName?.trim()
      ? { name: exactNamePattern(supervisorName.trim()) }
      : null;

  if (!profileQuery) return null;

  const existingProfile = await Supervisor.findOne(profileQuery).select("_id").lean();
  if (existingProfile?._id) {
    await ensureSupervisorUserLink(existingProfile._id as Types.ObjectId);
    return existingProfile._id as Types.ObjectId;
  }

  const userQuery = candidateId
    ? { _id: candidateId, role: "supervisor" }
    : { name: exactNamePattern(supervisorName!.trim()), role: "supervisor" };
  const supervisorUser = await User.findOne(userQuery)
    .select("_id name email phone supervisorProfileId")
    .lean();
  if (!supervisorUser) return null;

  if (supervisorUser.supervisorProfileId) {
    const linkedProfile = await Supervisor.findById(supervisorUser.supervisorProfileId)
      .select("_id")
      .lean();
    if (linkedProfile?._id) {
      await ensureSupervisorUserLink(linkedProfile._id as Types.ObjectId);
      return linkedProfile._id as Types.ObjectId;
    }
  }

  const createdProfile = await Supervisor.create({
    supervisorId: await generateId("SUP"),
    userId: supervisorUser._id,
    name: supervisorUser.name,
    phone: supervisorUser.phone,
    email: supervisorUser.email,
    role: "Project Supervisor",
    assignedProjects: [],
    assignedSiteIds: [],
    assignedSites: [],
    status: "Active",
  });
  await User.updateOne(
    { _id: supervisorUser._id },
    { $set: { supervisorProfileId: createdProfile._id } },
  );
  return createdProfile._id as Types.ObjectId;
}

function uniqueNames(values: Array<string | undefined | null>): string[] {
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

/**
 * Resolve site names into actual Site documents.
 * - For each name, find an existing Site (case-insensitive) or create a new one.
 * - The returned sites are linked to the project via projectIds.
 */
async function resolveSitesFromNames(
  names: string[],
  projectObjectId: Types.ObjectId,
): Promise<Array<{ _id: Types.ObjectId; name: string }>> {
  const unique = uniqueNames(names);
  if (unique.length === 0) return [];
  const resolved: Array<{ _id: Types.ObjectId; name: string }> = [];
  for (const name of unique) {
    const existing = await Site.findOne({ name }).select("_id name").lean();
    if (existing && existing._id) {
      resolved.push({ _id: existing._id as Types.ObjectId, name: existing.name });
      continue;
    }
    const siteId = await generateId("SITE");
    const created = await Site.create({
      siteId,
      name,
      status: "Active",
      projectIds: [projectObjectId],
    });
    resolved.push({ _id: created._id as Types.ObjectId, name: created.name });
  }
  return resolved;
}

/**
 * Sync the supervisor↔project↔sites relationship after a project create or update.
 * - Adds the project to supervisor.assignedProjects / user.managedProjectIds.
 * - Adds the project's sites to supervisor.assignedSiteIds / assignedSites.
 * - Sets site.supervisorId = supervisorId for every site in the project.
 * - Optionally detaches the project from a previous supervisor (oldSupervisorId)
 *   so cross-assignment does not leak.
 * - Invalidates the access cache for both old and new supervisor users so the
 *   supervisor mobile app reflects the change on its next request.
 */
async function syncSupervisorAssignment(args: {
  projectId: Types.ObjectId;
  projectSiteIds: Types.ObjectId[];
  projectSiteNames: string[];
  newSupervisorId: Types.ObjectId | null;
  oldSupervisorId: Types.ObjectId | null;
}) {
  const { projectId, projectSiteIds, projectSiteNames, newSupervisorId, oldSupervisorId } = args;

  // Update Site.supervisorId for every site in the project so the
  // mobile "Site.find({ supervisorId })" lookup stays consistent.
  if (projectSiteIds.length > 0) {
    if (newSupervisorId) {
      await Site.updateMany(
        { _id: { $in: projectSiteIds } },
        { $set: { supervisorId: newSupervisorId } },
      );
    } else {
      await Site.updateMany(
        { _id: { $in: projectSiteIds } },
        { $unset: { supervisorId: "" } },
      );
    }
  }

  // If the supervisor didn't change there's nothing to migrate.
  if (oldSupervisorId && oldSupervisorId.toString() === (newSupervisorId?.toString() ?? "")) {
    // Same supervisor — just make sure assignments include the project's sites/project.
    if (newSupervisorId) {
      const sup = await Supervisor.findById(newSupervisorId).select("_id").lean();
      if (sup) {
        await Supervisor.updateOne(
          { _id: newSupervisorId },
          {
            $addToSet: {
              assignedProjects: projectId,
              assignedSiteIds: { $each: projectSiteIds },
              assignedSites: { $each: projectSiteNames },
            },
            $set: { assignedProjectId: new Types.ObjectId(projectId) },
          },
        );
        const userId = await ensureSupervisorUserLink(newSupervisorId);
        if (userId) {
          await User.updateOne(
            { _id: userId },
            { $addToSet: { managedProjectIds: projectId } },
          );
          invalidateAccessCache(userId.toString());
        }
      }
    }
    return;
  }

  // Detach from old supervisor.
  if (oldSupervisorId) {
    const oldSup = await Supervisor.findById(oldSupervisorId).select("_id").lean();
    if (oldSup) {
      const detached = await Supervisor.findByIdAndUpdate(
        { _id: oldSupervisorId },
        {
          $pull: {
            assignedProjects: projectId,
            assignedSiteIds: { $in: projectSiteIds },
            assignedSites: { $in: projectSiteNames },
          },
        },
        { new: true },
      );

      // Legacy single-assignment fields are also included in mobile access.
      // Leaving either one pointed at the moved project/site would keep the
      // old supervisor authorized even after the array assignments changed.
      if (detached) {
        const singletonUpdate: Record<string, unknown> = {};
        const singletonUnset: Record<string, string> = {};
        if (detached.assignedProjectId?.toString() === projectId.toString()) {
          const fallbackProjectId = detached.assignedProjects[0];
          if (fallbackProjectId) {
            singletonUpdate.assignedProjectId = fallbackProjectId;
          } else {
            singletonUnset.assignedProjectId = "";
            singletonUnset.assignedProject = "";
          }
        }
        if (
          detached.assignedSiteId &&
          projectSiteIds.some((siteId) => siteId.toString() === detached.assignedSiteId?.toString())
        ) {
          const fallbackSiteId = detached.assignedSiteIds[0];
          if (fallbackSiteId) {
            singletonUpdate.assignedSiteId = fallbackSiteId;
          } else {
            singletonUnset.assignedSiteId = "";
          }
        }
        if (Object.keys(singletonUpdate).length || Object.keys(singletonUnset).length) {
          await Supervisor.updateOne(
            { _id: oldSupervisorId },
            {
              ...(Object.keys(singletonUpdate).length ? { $set: singletonUpdate } : {}),
              ...(Object.keys(singletonUnset).length ? { $unset: singletonUnset } : {}),
            },
          );
        }
      }
      const oldUserId = await ensureSupervisorUserLink(oldSupervisorId);
      if (oldUserId) {
        await User.updateOne(
          { _id: oldUserId },
          { $pull: { managedProjectIds: projectId } },
        );
        invalidateAccessCache(oldUserId.toString());
      }
    }
    // Unset Site.supervisorId for old-supervisor sites only if no other
    // project of theirs still references the site. Keep simple: leave
    // Site.supervisorId untouched here because the new supervisor update
    // below will overwrite it for the project's sites.
  }

  // Attach to new supervisor.
  if (newSupervisorId) {
    const newSup = await Supervisor.findById(newSupervisorId).select("_id").lean();
    if (newSup) {
      await Supervisor.updateOne(
        { _id: newSupervisorId },
        {
          $addToSet: {
            assignedProjects: projectId,
            assignedSiteIds: { $each: projectSiteIds },
            assignedSites: { $each: projectSiteNames },
          },
          $set: { assignedProjectId: new Types.ObjectId(projectId) },
        },
      );
      const newUserId = await ensureSupervisorUserLink(newSupervisorId);
      if (newUserId) {
        await User.updateOne(
          { _id: newUserId },
          { $addToSet: { managedProjectIds: projectId } },
        );
        invalidateAccessCache(newUserId.toString());
      }
    }
  }
}

export async function createProject(input: CreateProjectInput) {
  const client = await Client.findById(input.clientId);
  if (!client) throw new AppError(404, "Client not found");

  const supervisorProfileId = await resolveSupervisorProfileId(
    input.supervisorId,
    input.supervisor,
  );
  if (input.supervisorId && !supervisorProfileId) {
    throw new AppError(400, "Selected supervisor was not found");
  }

  const projectId = await generateId("AB");

  // 1) Create the project shell so we have a stable _id for site backrefs.
  const project = await Project.create({
    projectId,
    name: input.name,
    client: client.name,
    clientId: client._id,
    mobile: input.mobile || client.mobile,
    address: input.address || client.address,
    supervisor: input.supervisor,
    supervisorId: supervisorProfileId || undefined,
    siteIds: [],
    siteNames: [],
    status: input.status,
    startDate: input.startDate,
    totalValue: input.totalValue,
    estimatedValue: input.estimatedValue,
    advanceAmount: input.advanceAmount,
    receivedAmount: input.receivedAmount,
    materialSpend: input.materialSpend,
    labourPayable: input.labourPayable,
    expenseBalance: input.expenseBalance,
    completion: input.completion,
  });

  // 2) Resolve site names -> Site documents (re-use existing, or create new).
  const siteNameInput: string[] = [];
  if (input.sites && input.sites.length > 0) siteNameInput.push(...input.sites);
  const resolvedSites = await resolveSitesFromNames(siteNameInput, project._id as Types.ObjectId);

  const siteIds = resolvedSites.map((s) => s._id);
  const siteNames = resolvedSites.map((s) => s.name);

  if (siteIds.length > 0) {
    await Project.updateOne(
      { _id: project._id },
      { $set: { siteIds, siteNames } },
    );
    // Mirror the projectId on every site (idempotent).
    await Site.updateMany(
      { _id: { $in: siteIds } },
      { $addToSet: { projectIds: project._id } },
    );
  }

  await Client.findByIdAndUpdate(client._id, { $addToSet: { projectIds: project.projectId } });

  // 3) Sync supervisor assignment (assignedProjects/sites, Site.supervisorId,
  //    user.managedProjectIds, access-cache invalidation).
  await syncSupervisorAssignment({
    projectId: project._id as Types.ObjectId,
    projectSiteIds: siteIds,
    projectSiteNames: siteNames,
    newSupervisorId: supervisorProfileId,
    oldSupervisorId: null,
  });

  // Return a fresh read with the updated siteIds/siteNames.
  const finalDoc = await Project.findById(project._id).lean();
  return finalDoc || project.toObject();
}

export async function listProjects(filter: {
  search?: string;
  status?: string;
  clientId?: string;
  siteId?: string;
  supervisorId?: string;
  page: number;
  limit: number;
  cursor?: string;
  scopeQuery?: Record<string, unknown>;
}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.clientId) query.clientId = new Types.ObjectId(filter.clientId);
  if (filter.siteId) query.siteIds = new Types.ObjectId(filter.siteId);
  if (filter.supervisorId) query.supervisorId = new Types.ObjectId(filter.supervisorId);
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: "i" } },
      { projectId: { $regex: filter.search, $options: "i" } },
      { client: { $regex: filter.search, $options: "i" } },
    ];
  }

  // Apply role-based scope
  if (filter.scopeQuery && Object.keys(filter.scopeQuery).length > 0) {
    Object.assign(query, filter.scopeQuery);
  }

  const result = await paginateByCursor(Project, query, {
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
  });
  const projectIds = result.items.map((project: any) => project._id as Types.ObjectId);
  const paymentTotals = projectIds.length
    ? await Payment.aggregate<{ _id: Types.ObjectId; total: number }>([
        { $match: { projectId: { $in: projectIds }, status: { $ne: "Rejected" } } },
        { $group: { _id: "$projectId", total: { $sum: "$amount" } } },
      ])
    : [];
  const totalsByProject = new Map(paymentTotals.map((row) => [row._id.toString(), row.total]));
  return {
    ...result,
    items: result.items.map((project: any) => {
      const receivedAmount = totalsByProject.get(project._id.toString()) || 0;
      const totalValue = Number(project.totalValue || 0);
      return {
        ...project,
        receivedAmount,
        pendingBalance: Math.max(0, totalValue - receivedAmount),
        completion: totalValue > 0
          ? Math.min(100, Math.max(0, (receivedAmount / totalValue) * 100))
          : 0,
      };
    }),
  };
}

export async function getProjectById(id: string, scopeProjectIds?: ProjectScopeIds) {
  const query: Record<string, unknown> = { _id: id };
  applyProjectScope(query, "_id", scopeProjectIds);
  const project = await Project.findOne(query).lean();
  if (!project) throw new AppError(404, "Project not found");
  return project;
}

export async function updateProject(id: string, patch: UpdateProjectInput, scopeProjectIds?: ProjectScopeIds) {
  const existing = await getProjectById(id, scopeProjectIds);

  const updateData: Record<string, unknown> = { ...patch };
  if (patch.clientId) {
    const nextClient = await Client.findById(patch.clientId).lean();
    if (!nextClient) throw new AppError(404, "Client not found");
    updateData.clientId = new Types.ObjectId(patch.clientId);
    updateData.client = nextClient.name;
    updateData.mobile = nextClient.mobile;
    updateData.address = nextClient.address;
  }
  let patchedSupervisorProfileId: Types.ObjectId | null | undefined;
  if (patch.supervisorId !== undefined) {
    patchedSupervisorProfileId = await resolveSupervisorProfileId(
      patch.supervisorId,
      patch.supervisor,
    );
    if (!patchedSupervisorProfileId) {
      throw new AppError(400, "Selected supervisor was not found");
    }
    updateData.supervisorId = patchedSupervisorProfileId;
  }
  // sites (names) is handled below, not as a direct set on Project.
  delete (updateData as Record<string, unknown>).sites;

  let nextSiteIds: Types.ObjectId[] = (existing.siteIds || []).map((id) => id as Types.ObjectId);
  let nextSiteNames: string[] = [...(existing.siteNames || [])];
  const sitesProvided = Array.isArray((patch as { sites?: string[] }).sites);

  if (sitesProvided) {
    const incomingNames = ((patch as { sites?: string[] }).sites || []);
    // Resolve the new site list from scratch. Any sites no longer
    // referenced are unlinked from the project below.
    const uniqueIncoming = uniqueNames(incomingNames);
    const newResolved = await resolveSitesFromNames(uniqueIncoming, existing._id as Types.ObjectId);
    nextSiteIds = newResolved.map((s) => s._id);
    nextSiteNames = newResolved.map((s) => s.name);

    const previousIds = new Set(((existing.siteIds || []) as Types.ObjectId[]).map((i) => i.toString()));
    const removed = [...previousIds].filter((id) => !nextSiteIds.some((sid) => sid.toString() === id));
    if (removed.length > 0) {
      await Site.updateMany(
        { _id: { $in: removed.map((s) => new Types.ObjectId(s)) } },
        { $pull: { projectIds: existing._id } },
      );
    }

    updateData.siteIds = nextSiteIds;
    updateData.siteNames = nextSiteNames;

    // Make sure every site knows about this project (idempotent).
    await Site.updateMany(
      { _id: { $in: nextSiteIds } },
      { $addToSet: { projectIds: existing._id } },
    );
  } else if (patch.siteIds) {
    // Legacy path: explicit siteIds list.
    const siteIds = patch.siteIds.map((sid) => new Types.ObjectId(sid));
    updateData.siteIds = siteIds;
    const sites = await Site.find({ _id: { $in: siteIds } }).lean();
    updateData.siteNames = sites.map((s) => s.name);
    nextSiteIds = siteIds;
    nextSiteNames = sites.map((s) => s.name);
  }

  const project = await Project.findByIdAndUpdate(id, updateData, { new: true });
  if (!project) throw new AppError(404, "Project not found");

  if (patch.clientId) {
    const oldClientId = String((existing.clientId as Types.ObjectId | undefined)?.toString() ?? "");
    const newClientId = patch.clientId;
    // A project must belong to exactly one client — detach it from the
    // previous client when it is reassigned, otherwise it would appear
    // under both clients.
    if (oldClientId && oldClientId !== newClientId) {
      await Client.findByIdAndUpdate(oldClientId, { $pull: { projectIds: project.projectId } });
    }
    await Client.findByIdAndUpdate(newClientId, { $addToSet: { projectIds: project.projectId } });
  }

  // Sync supervisor↔project↔sites if the supervisor changed OR if sites
  // were edited while a supervisor is assigned.
  const oldSupervisorId = (existing.supervisorId as Types.ObjectId | undefined) ?? null;
  const newSupervisorId =
    patch.supervisorId !== undefined
      ? patchedSupervisorProfileId ?? null
      : oldSupervisorId;

  const supervisorChanged = oldSupervisorId?.toString() !== (newSupervisorId?.toString() ?? "");
  const sitesChanged = sitesProvided || !!patch.siteIds;

  // Always reconcile an assigned supervisor. This is idempotent and repairs
  // legacy projects whose Project.supervisorId was saved before the profile
  // and Roles & Employees scopes were synchronized.
  if (supervisorChanged || sitesChanged || newSupervisorId) {
    await syncSupervisorAssignment({
      projectId: project._id as Types.ObjectId,
      projectSiteIds: nextSiteIds,
      projectSiteNames: nextSiteNames,
      newSupervisorId,
      oldSupervisorId,
    });
  }

  return project.toObject();
}

export async function deleteProject(id: string, scopeProjectIds?: ProjectScopeIds) {
  const project = await Project.findById(id);
  if (!project) throw new AppError(404, "Project not found");

  // Detach project from supervisors/users before deletion.
  const oldSupervisorId = (project.supervisorId as Types.ObjectId | undefined) ?? null;
  const projectSiteIds = (project.siteIds || []) as Types.ObjectId[];
  const projectSiteNames = [...(project.siteNames || [])];

  await Client.findByIdAndUpdate(project.clientId, {
    $pull: { projectIds: project.projectId },
  });

  if (projectSiteIds.length > 0) {
    await Site.updateMany(
      { _id: { $in: projectSiteIds } },
      { $pull: { projectIds: project._id } },
    );
  }

  if (oldSupervisorId) {
    const sup = await Supervisor.findById(oldSupervisorId).select("_id userId").lean();
    if (sup) {
      await Supervisor.updateOne(
        { _id: oldSupervisorId },
        {
          $pull: {
            assignedProjects: project._id,
            assignedSiteIds: { $in: projectSiteIds },
            assignedSites: { $in: projectSiteNames },
          },
        },
      );
      if (sup.userId) {
        await User.updateOne(
          { _id: sup.userId },
          { $pull: { managedProjectIds: project._id } },
        );
        invalidateAccessCache(sup.userId.toString());
      }
    }
  }

  await Project.deleteOne({ _id: id });
}

export async function getProjectLedger(id: string, scopeProjectIds?: ProjectScopeIds) {
  const project = await getProjectById(id, scopeProjectIds);
  await recomputeProjectTotals(project._id);
  await recomputeClientTotals(project.clientId);
  const refreshedProject = await getProjectById(id, scopeProjectIds);
  return computeProjectLedger(refreshedProject);
}

export async function getProjectsSummary(scopeProjectIds?: ProjectScopeIds) {
  const projectQuery: Record<string, unknown> = {};
  const paymentQuery: Record<string, unknown> = {};
  applyProjectScope(projectQuery, "_id", scopeProjectIds);
  applyProjectScope(paymentQuery, "projectId", scopeProjectIds);
  const [active, onHold, completed, financials, paymentTotals] = await Promise.all([
    Project.countDocuments({ ...projectQuery, status: "Active" }),
    Project.countDocuments({ ...projectQuery, status: "On Hold" }),
    Project.countDocuments({ ...projectQuery, status: "Completed" }),
    Project.aggregate([
      { $match: projectQuery },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$totalValue" },
          receivedAmount: { $sum: "$receivedAmount" },
          pendingBalance: { $sum: "$pendingBalance" },
          materialSpend: { $sum: "$materialSpend" },
          labourPayable: { $sum: "$labourPayable" },
          subcontractorSpend: { $sum: "$subcontractorSpend" },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { ...paymentQuery, status: { $ne: "Rejected" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const financialSummary = financials[0] || {
    totalValue: 0,
    receivedAmount: 0,
    pendingBalance: 0,
    materialSpend: 0,
    labourPayable: 0,
    subcontractorSpend: 0,
  };
  const receivedAmount = paymentTotals[0]?.total || 0;

  return {
    counts: { active, onHold, completed, total: active + onHold + completed },
    financials: {
      ...financialSummary,
      receivedAmount,
      pendingBalance: Math.max(0, financialSummary.totalValue - receivedAmount),
    },
  };
}
