import { Types } from "mongoose";
import { Project } from "../models/Project.js";
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
import { recomputeClientTotals, computeProjectLedger } from "./financial.service.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { paginateByCursor } from "../utils/cursor-pagination.js";

function toObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  const str = String(value);
  return Types.ObjectId.isValid(str) ? new Types.ObjectId(str) : null;
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
    if (newSupervisorId && projectSiteIds.length > 0) {
      const sup = await Supervisor.findById(newSupervisorId).select("_id userId").lean();
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
        if (sup.userId) {
          await User.updateOne(
            { _id: sup.userId },
            { $addToSet: { managedProjectIds: projectId } },
          );
          invalidateAccessCache(sup.userId.toString());
        }
      }
    }
    return;
  }

  // Detach from old supervisor.
  if (oldSupervisorId) {
    const oldSup = await Supervisor.findById(oldSupervisorId).select("_id userId").lean();
    if (oldSup) {
      await Supervisor.updateOne(
        { _id: oldSupervisorId },
        {
          $pull: {
            assignedProjects: projectId,
            assignedSiteIds: { $in: projectSiteIds },
            assignedSites: { $in: projectSiteNames },
          },
        },
      );
      if (oldSup.userId) {
        await User.updateOne(
          { _id: oldSup.userId },
          { $pull: { managedProjectIds: projectId } },
        );
        invalidateAccessCache(oldSup.userId.toString());
      }
    }
    // Unset Site.supervisorId for old-supervisor sites only if no other
    // project of theirs still references the site. Keep simple: leave
    // Site.supervisorId untouched here because the new supervisor update
    // below will overwrite it for the project's sites.
  }

  // Attach to new supervisor.
  if (newSupervisorId) {
    const newSup = await Supervisor.findById(newSupervisorId).select("_id userId").lean();
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
      if (newSup.userId) {
        await User.updateOne(
          { _id: newSup.userId },
          { $addToSet: { managedProjectIds: projectId } },
        );
        invalidateAccessCache(newSup.userId.toString());
      }
    }
  }
}

export async function createProject(input: CreateProjectInput) {
  const client = await Client.findById(input.clientId);
  if (!client) throw new AppError(404, "Client not found");

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
    supervisorId: input.supervisorId ? new Types.ObjectId(input.supervisorId) : undefined,
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
    newSupervisorId: toObjectId(input.supervisorId),
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

  return paginateByCursor(Project, query, {
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
  });
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
  if (patch.supervisorId) updateData.supervisorId = new Types.ObjectId(patch.supervisorId);
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
      ? toObjectId(patch.supervisorId)
      : oldSupervisorId;

  const supervisorChanged = oldSupervisorId?.toString() !== (newSupervisorId?.toString() ?? "");
  const sitesChanged = sitesProvided || !!patch.siteIds;

  if (supervisorChanged || sitesChanged) {
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
  await recomputeClientTotals(project.clientId);
  return computeProjectLedger(project);
}

export async function getProjectsSummary(scopeProjectIds?: ProjectScopeIds) {
  const projectQuery: Record<string, unknown> = {};
  applyProjectScope(projectQuery, "_id", scopeProjectIds);
  const [active, onHold, completed, financials] = await Promise.all([
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
  ]);

  return {
    counts: { active, onHold, completed, total: active + onHold + completed },
    financials: financials[0] || {
      totalValue: 0,
      receivedAmount: 0,
      pendingBalance: 0,
      materialSpend: 0,
      labourPayable: 0,
      subcontractorSpend: 0,
    },
  };
}
