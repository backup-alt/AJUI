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

  const inputSiteNames = uniqueStrings([
    input.assignedSite,
    ...(input.assignedSites || []),
  ]);

  const sites = assignedSiteIds.length > 0
    ? await Site.find({ _id: { $in: assignedSiteIds } }).select("name").lean()
    : [];

  return {
    assignedSiteId: assignedSiteIds[0],
    assignedSiteIds,
    assignedSites: uniqueStrings([
      ...inputSiteNames,
      ...sites.map((site) => site.name),
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
  const supervisor = await Supervisor.create({
    ...input,
    supervisorId,
    assignedProjectId: input.assignedProjectId
      ? new Types.ObjectId(input.assignedProjectId)
      : undefined,
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
  applyProjectScope(query, "assignedProjectId", filter.scopeProjectIds);
  return Supervisor.find(query).sort({ createdAt: -1 }).lean();
}

export async function getSupervisorById(id: string, scopeProjectIds?: ProjectScopeIds) {
  const query: Record<string, unknown> = { _id: id };
  applyProjectScope(query, "assignedProjectId", scopeProjectIds);
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
