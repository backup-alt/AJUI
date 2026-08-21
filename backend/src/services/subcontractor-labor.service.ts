import { Types } from "mongoose";
import { AppError } from "../middleware/errorHandler.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { SubcontractorLabor } from "../models/SubcontractorLabor.js";

export type SubcontractorLaborInput = {
  subcontractorId: string;
  projectId?: string;
  projectName?: string;
  name: string;
  address?: string;
  // Optional — site supervisors frequently roster labour without a
  // phone number (e.g. walk-in workers). Mirrors the Mongoose model.
  phone?: string;
  role: string;
  notes?: string;
  createdBy?: string;
};

export async function listSubcontractorLabor(subcontractorId: string) {
  return SubcontractorLabor.find({ subcontractorId: new Types.ObjectId(subcontractorId) })
    .sort({ name: 1, _id: -1 })
    .lean();
}

async function resolveProjectName(projectId: string): Promise<string> {
  if (!projectId || !Types.ObjectId.isValid(projectId)) return "";
  const { Project } = await import("../models/Project.js");
  const project = await Project.findById(projectId).select("name").lean();
  return project?.name || "";
}

/**
 * Validate that projectId is a real ObjectId (or empty/missing), then
 * look up the project name for denormalisation. Returns the
 * ObjectId-string and matching name, or empty strings when no project.
 */
async function normaliseProject(projectId?: string, projectName?: string) {
  const trimmed = (projectId || "").trim();
  if (!trimmed) return { projectId: undefined, projectName: "" };
  if (!Types.ObjectId.isValid(trimmed)) {
    throw new AppError(400, "Invalid projectId for subcontractor labour");
  }
  const name = projectName?.trim() || (await resolveProjectName(trimmed));
  return { projectId: trimmed, projectName: name };
}

export async function createSubcontractorLabor(input: SubcontractorLaborInput) {
  const subcontractor = await Subcontractor.findById(input.subcontractorId).select("_id").lean();
  if (!subcontractor) throw new AppError(404, "Subcontractor not found");
  const { projectId, projectName } = await normaliseProject(input.projectId, input.projectName);
  const labor = await SubcontractorLabor.create({
    ...input,
    subcontractorId: new Types.ObjectId(input.subcontractorId),
    projectId: projectId ? new Types.ObjectId(projectId) : undefined,
    projectName,
    createdBy: input.createdBy ? new Types.ObjectId(input.createdBy) : undefined,
  });
  return labor.toObject();
}

export async function updateSubcontractorLabor(id: string, patch: Partial<SubcontractorLaborInput>) {
  const update = { ...patch } as Record<string, unknown>;
  delete update.subcontractorId;
  delete update.createdBy;

  // Handle explicit projectId clearing: an empty string means "remove
  // the project linkage"; an ObjectId means "set / change"; missing key
  // means "leave unchanged".
  if (Object.prototype.hasOwnProperty.call(patch, "projectId")) {
    const { projectId, projectName } = await normaliseProject(
      patch.projectId,
      patch.projectName,
    );
    if (projectId) {
      update.projectId = new Types.ObjectId(projectId);
      update.projectName = projectName;
    } else {
      update.projectId = undefined;
      update.projectName = "";
    }
  }

  const labor = await SubcontractorLabor.findByIdAndUpdate(id, update, { new: true });
  if (!labor) throw new AppError(404, "Labor record not found");
  return labor.toObject();
}