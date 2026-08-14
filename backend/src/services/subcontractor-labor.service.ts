import { Types } from "mongoose";
import { AppError } from "../middleware/errorHandler.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { SubcontractorLabor } from "../models/SubcontractorLabor.js";

export type SubcontractorLaborInput = {
  subcontractorId: string;
  name: string;
  address?: string;
  phone: string;
  role: string;
  notes?: string;
  createdBy?: string;
};

export async function listSubcontractorLabor(subcontractorId: string) {
  return SubcontractorLabor.find({ subcontractorId: new Types.ObjectId(subcontractorId) })
    .sort({ name: 1, _id: -1 })
    .lean();
}

export async function createSubcontractorLabor(input: SubcontractorLaborInput) {
  const subcontractor = await Subcontractor.findById(input.subcontractorId).select("_id").lean();
  if (!subcontractor) throw new AppError(404, "Subcontractor not found");
  const labor = await SubcontractorLabor.create({
    ...input,
    subcontractorId: new Types.ObjectId(input.subcontractorId),
    createdBy: input.createdBy ? new Types.ObjectId(input.createdBy) : undefined,
  });
  return labor.toObject();
}

export async function updateSubcontractorLabor(id: string, patch: Partial<SubcontractorLaborInput>) {
  const update = { ...patch } as Record<string, unknown>;
  delete update.subcontractorId;
  delete update.createdBy;
  const labor = await SubcontractorLabor.findByIdAndUpdate(id, update, { new: true });
  if (!labor) throw new AppError(404, "Labor record not found");
  return labor.toObject();
}

