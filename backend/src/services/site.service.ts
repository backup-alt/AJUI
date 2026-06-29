import { Site } from "../models/Site";
import { Project } from "../models/Project";
import { AppError } from "../middleware/errorHandler";
import { generateId } from "./id-generator.service";
import { CreateSiteInput, UpdateSiteInput } from "../schemas/entities.schema";
import { Types } from "mongoose";

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

export async function listSites(filter: { status?: string; search?: string } = {}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.search) query.name = { $regex: filter.search, $options: "i" };
  return Site.find(query).sort({ createdAt: -1 }).lean();
}

export async function getSiteById(id: string) {
  const site = await Site.findById(id).lean();
  if (!site) throw new AppError(404, "Site not found");
  return site;
}

export async function updateSite(id: string, patch: UpdateSiteInput) {
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

export async function deleteSite(id: string) {
  const result = await Site.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Site not found");
}
