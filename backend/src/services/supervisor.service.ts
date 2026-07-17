import { Types } from "mongoose";
import { Supervisor } from "../models/Supervisor.js";
import { Site } from "../models/Site.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import {
  CreateSupervisorInput,
  UpdateSupervisorInput,
} from "../schemas/entities.schema.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";

type SiteAssignmentInput = {
  assignedSite?: string;
  assignedSites?: string[];
  assignedSiteId?: string;
  assignedSiteIds?: string[];
};

function toObjectId(value: unknown): Types.ObjectId | undefined {
  if (!value) return undefined;
  const str = String(value).trim();
  if (!str || !Types.ObjectId.isValid(str)) return undefined;
  return new Types.ObjectId(str);
}

function uniqueObjectIds(values: Array<Types.ObjectId | undefined>): Types.ObjectId[] {
  const seen = new Set<string>();
  const ids: Types.ObjectId[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(value);
  }
  return ids;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(trimmed);
  }
  return list;
}

async function normalizeSiteAssignment(input: SiteAssignmentInput) {
  const assignedSiteIds = uniqueObjectIds([
    toObjectId(input.assignedSiteId),
    ...(input.assignedSiteIds || []).map(toObjectId),
  ]);

  // Parse assignedSites to separate ObjectIds from names
  const assignedSitesInput = input.assignedSites || [];
  const assignedSiteIdStrings: string[] = [];
  const assignedSiteNames: string[] = [];

  for (const value of assignedSitesInput) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (Types.ObjectId.isValid(trimmed)) {
      assignedSiteIdStrings.push(trimmed);
    } else {
      assignedSiteNames.push(trimmed);
    }
  }

  // Also include any ObjectIds from assignedSiteIdStrings
  const allAssignedSiteIds = uniqueObjectIds([
    ...assignedSiteIds,
    ...assignedSiteIdStrings.map(toObjectId),
  ]);

  const sites = allAssignedSiteIds.length > 0
    ? await Site.find({ _id: { $in: allAssignedSiteIds } }).select("name").lean()
    : [];

  const siteNamesFromIds = sites.map((site) => site.name);

  return {
    assignedSiteId: allAssignedSiteIds[0],
    assignedSiteIds: allAssignedSiteIds,
    assignedSites: uniqueStrings([
      ...assignedSiteNames,
      input.assignedSite,
      ...siteNamesFromIds,
    ]),
  };
}

async function backfillAssignedSites(
  supervisorId: Types.ObjectId,
  supervisorName: string,
  assignedSiteIds: Types.ObjectId[]
) {
  if (assignedSiteIds.length === 0) return;
  await Site.updateMany(
    { _id: { $in: assignedSiteIds } },
    { $set: { supervisor: supervisorName, supervisorId } }
  );
}

export async function createSupervisor(input: CreateSupervisorInput) {
  const supervisorId = await generateId("SUP");
  const siteAssignment = await normalizeSiteAssignment(input);

  const assignedProjectIds = uniqueObjectIds([
    toObjectId(input.assignedProjectId),
    ...(input.assignedProjectIds || []).map(toObjectId),
  ]);

  const supervisor = await Supervisor.create({
    ...input,
    supervisorId,
    assignedProjectId: assignedProjectIds[0],
    assignedProjects: assignedProjectIds,
    ...siteAssignment,
  });
  await backfillAssignedSites(supervisor._id, supervisor.name, siteAssignment.assignedSiteIds);
  return supervisor.toObject();
}

export async function listSupervisors(filter: { status?: string; search?: string; scopeProjectIds?: ProjectScopeIds } = {}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: "i" } },
      { phone: { $regex: filter.search, $options: "i" } },
      { email: { $regex: filter.search, $options: "i" } },
    ];
  }
  applyProjectScope(query, "assignedProjects", filter.scopeProjectIds);
  return Supervisor.find(query).sort({ createdAt: -1 }).lean();
}

export async function getSupervisorById(id: string, scopeProjectIds?: ProjectScopeIds) {
  const query: Record<string, unknown> = { _id: id };
  applyProjectScope(query, "assignedProjects", scopeProjectIds);
  const supervisor = await Supervisor.findOne(query).lean();
  if (!supervisor) throw new AppError(404, "Supervisor not found");
  return supervisor;
}

export async function updateSupervisor(id: string, patch: UpdateSupervisorInput, scopeProjectIds?: ProjectScopeIds) {
  await getSupervisorById(id, scopeProjectIds);
  const updateData: Record<string, unknown> = { ...patch };

  if (patch.assignedProjectId) {
    updateData.assignedProjectId = new Types.ObjectId(patch.assignedProjectId);
  }
  if (patch.assignedProjectIds) {
    const projectIds = patch.assignedProjectIds
      .map((pid) => toObjectId(pid))
      .filter((id): id is Types.ObjectId => id !== undefined);
    updateData.assignedProjects = projectIds;
    if (projectIds.length > 0 && !patch.assignedProjectId) {
      updateData.assignedProjectId = projectIds[0];
    }
  }

  const shouldNormalizeSites = ["assignedSite", "assignedSites", "assignedSiteId", "assignedSiteIds"].some((key) =>
    Object.prototype.hasOwnProperty.call(patch, key)
  );
  if (shouldNormalizeSites) {
    Object.assign(updateData, await normalizeSiteAssignment(patch));
    delete updateData.assignedSite;
  }

  const update: Record<string, unknown> = { $set: updateData };
  if (shouldNormalizeSites && !updateData.assignedSiteId) {
    delete updateData.assignedSiteId;
    update.$unset = { assignedSiteId: "" };
  }

  const supervisor = await Supervisor.findByIdAndUpdate(id, update, { new: true });
  if (!supervisor) throw new AppError(404, "Supervisor not found");
  if (shouldNormalizeSites) {
    await backfillAssignedSites(
      supervisor._id,
      supervisor.name,
      (updateData.assignedSiteIds as Types.ObjectId[] | undefined) || []
    );
  }
  return supervisor.toObject();
}

export async function deleteSupervisor(id: string, scopeProjectIds?: ProjectScopeIds) {
  await getSupervisorById(id, scopeProjectIds);
  const result = await Supervisor.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Supervisor not found");
}
