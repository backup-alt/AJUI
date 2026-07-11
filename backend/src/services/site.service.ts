import { Site } from "../models/Site.js";
import { Project } from "../models/Project.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { CreateSiteInput, UpdateSiteInput } from "../schemas/entities.schema.js";
import { Types } from "mongoose";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";

export async function createSite(input: CreateSiteInput) {
  const siteId = await generateId("SITE");
  const projectIds = (input.projectIds || []).map((id) => new Types.ObjectId(id));
  const site = await Site.create({ ...input, siteId, projectIds });

  if (projectIds.length > 0) {
    await Project.updateMany(
      { _id: { $in: projectIds } },
      {
        $addToSet: { siteIds: site._id, siteNames: site.name },
      }
    );
  }
  return site.toObject();
}

export async function listSites(filter: { status?: string; search?: string; scopeProjectIds?: ProjectScopeIds } = {}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.search) query.name = { $regex: filter.search, $options: "i" };
  applyProjectScope(query, "projectIds", filter.scopeProjectIds);
  return Site.find(query).sort({ createdAt: -1 }).lean();
}

export async function getSiteById(id: string, scopeProjectIds?: ProjectScopeIds) {
  const query: Record<string, unknown> = { _id: id };
  applyProjectScope(query, "projectIds", scopeProjectIds);
  const site = await Site.findOne(query).lean();
  if (!site) throw new AppError(404, "Site not found");
  return site;
}

export async function updateSite(id: string, patch: UpdateSiteInput, scopeProjectIds?: ProjectScopeIds) {
  await getSiteById(id, scopeProjectIds);
  const updateData: Record<string, unknown> = { ...patch };
  if (patch.projectIds) {
    updateData.projectIds = patch.projectIds.map((pid) => new Types.ObjectId(pid));
  }
  const site = await Site.findByIdAndUpdate(id, updateData, { new: true });
  if (!site) throw new AppError(404, "Site not found");

  if (patch.projectIds) {
    await Project.updateMany(
      { _id: { $in: patch.projectIds } },
      {
        $addToSet: { siteIds: site._id, siteNames: site.name },
      }
    );
  }
  return site.toObject();
}

export async function deleteSite(id: string, scopeProjectIds?: ProjectScopeIds) {
  await getSiteById(id, scopeProjectIds);
  const result = await Site.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Site not found");
}
