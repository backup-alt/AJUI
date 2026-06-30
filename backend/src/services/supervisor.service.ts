import { Types } from "mongoose";
import { Supervisor } from "../models/Supervisor.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import {
  CreateSupervisorInput,
  UpdateSupervisorInput,
} from "../schemas/entities.schema.js";

export async function createSupervisor(input: CreateSupervisorInput) {
  const supervisorId = await generateId("SUP");
  const supervisor = await Supervisor.create({
    ...input,
    supervisorId,
    assignedProjectId: input.assignedProjectId
      ? new Types.ObjectId(input.assignedProjectId)
      : undefined,
    assignedSiteId: input.assignedSiteId
      ? new Types.ObjectId(input.assignedSiteId)
      : undefined,
  });
  return supervisor.toObject();
}

export async function listSupervisors(filter: { status?: string; search?: string } = {}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: "i" } },
      { phone: { $regex: filter.search, $options: "i" } },
      { email: { $regex: filter.search, $options: "i" } },
    ];
  }
  return Supervisor.find(query).sort({ createdAt: -1 }).lean();
}

export async function getSupervisorById(id: string) {
  const supervisor = await Supervisor.findById(id).lean();
  if (!supervisor) throw new AppError(404, "Supervisor not found");
  return supervisor;
}

export async function updateSupervisor(id: string, patch: UpdateSupervisorInput) {
  const updateData: Record<string, unknown> = { ...patch };
  if (patch.assignedProjectId) {
    updateData.assignedProjectId = new Types.ObjectId(patch.assignedProjectId);
  }
  if (patch.assignedSiteId) {
    updateData.assignedSiteId = new Types.ObjectId(patch.assignedSiteId);
  }
  const supervisor = await Supervisor.findByIdAndUpdate(id, updateData, { new: true });
  if (!supervisor) throw new AppError(404, "Supervisor not found");
  return supervisor.toObject();
}

export async function deleteSupervisor(id: string) {
  const result = await Supervisor.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Supervisor not found");
}
