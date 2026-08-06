import { Types } from "mongoose";
import { Worker } from "../models/Worker.js";
import { Attendance } from "../models/Attendance.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { User } from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { paginateByCursor } from "../utils/cursor-pagination.js";

async function resolveSupervisorName(userId: string): Promise<string> {
  if (!userId || !Types.ObjectId.isValid(userId)) return "";
  const user = await User.findById(userId).select("name").lean();
  return user?.name || "";
}

export async function createWorker(input: {
  projectId: string;
  siteId?: string;
  site: string;
  name: string;
  address?: string;
  labourType: string;
  weeklyPay?: number;
  isSubcontract: boolean;
  subcontractorId?: string;
  subcontractorName?: string;
  supervisorId?: string;
  supervisorName?: string;
  createdBy: string;
}) {
  const { Project } = await import("../models/Project.js");
  const project = await Project.findById(input.projectId).lean();
  if (!project) throw new AppError(404, "Project not found");

  let subcontractorObjectId: Types.ObjectId | undefined;
  if (input.isSubcontract && input.subcontractorId) {
    // The mobile worker-create form sends the subcontractor's Mongo `_id`
    // (24-char ObjectId). Sub-contractors are intentionally shared
    // resources: the same party ("Sri Balaji Electricals") can be
    // active under multiple projects and sites, so we look the
    // subcontractor up by `_id` alone — without constraining to the
    // current project. The supervisor-role check on the route + the
    // universal list endpoint together ensure cross-tenant data
    // isn't reachable.
    if (!Types.ObjectId.isValid(input.subcontractorId)) {
      throw new AppError(400, "Invalid subcontractor id");
    }
    const sub = await Subcontractor.findOne({
      _id: new Types.ObjectId(input.subcontractorId),
      status: "active",
    })
      .select("_id subcontractorName projectId")
      .lean();
    if (!sub) throw new AppError(404, "Subcontractor not found or inactive");
    subcontractorObjectId = sub._id;
  }

  let supervisorObjectId: Types.ObjectId | undefined;
  if (!input.isSubcontract && input.supervisorId) {
    // Directly-hired workers: look up the supervisor by `_id` and
    // verify they are active and assigned to this project (so a
    // supervisor at site A can't be assigned to a worker at site B).
    if (!Types.ObjectId.isValid(input.supervisorId)) {
      throw new AppError(400, "Invalid supervisor id");
    }
    const { Supervisor } = await import("../models/Supervisor.js");
    const sup = await Supervisor.findOne({
      _id: new Types.ObjectId(input.supervisorId),
      status: "Active",
      assignedProjects: project._id,
    })
      .select("_id")
      .lean();
    if (!sup) throw new AppError(404, "Supervisor not found for this project");
    supervisorObjectId = sup._id;
  }

  const workerId = await generateId("WRK");
  const worker = await Worker.create({
    workerId,
    projectId: project._id,
    projectName: project.name,
    clientId: project.clientId,
    siteId: input.siteId && Types.ObjectId.isValid(input.siteId) ? new Types.ObjectId(input.siteId) : undefined,
    site: input.site,
    name: input.name,
    address: input.address,
    labourType: input.labourType,
    // weeklyPay is optional on the supervisor mobile create form —
    // admin-side custom fields drive the per-project wage.
    ...(input.weeklyPay !== undefined ? { weeklyPay: input.weeklyPay } : {}),
    isSubcontract: input.isSubcontract,
    subcontractorId: subcontractorObjectId,
    subcontractorName: input.subcontractorName,
    supervisorId: supervisorObjectId,
    supervisorName: input.supervisorName,
    createdBy: input.createdBy,
  });

  return worker.toObject();
}

export async function listWorkers(filter: {
  projectId?: string;
  siteId?: string;
  labourType?: string;
  createdBy?: string;
  page?: number;
  limit?: number;
  cursor?: string;
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId && Types.ObjectId.isValid(filter.projectId)) {
    query.projectId = new Types.ObjectId(filter.projectId);
  }
  if (filter.siteId && Types.ObjectId.isValid(filter.siteId)) {
    query.siteId = new Types.ObjectId(filter.siteId);
  }
  if (filter.labourType) query.labourType = filter.labourType;
  if (filter.createdBy) query.createdBy = filter.createdBy;

  return paginateByCursor(Worker, query, {
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
  });
}

/**
 * List all workers accessible to the current supervisor.
 * Filters by site and/or project; ignores the historical createdBy filter
 * so any supervisor with site access can see every worker for that site.
 */
export async function listWorkersForSupervisor(filter: {
  siteId?: string;
  projectId?: string;
  labourType?: string;
  page?: number;
  limit?: number;
  cursor?: string;
}) {
  return listWorkers({
    siteId: filter.siteId,
    projectId: filter.projectId,
    labourType: filter.labourType,
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
  });
}

export async function getWorkerById(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(400, "Invalid worker id");
  }
  const worker = await Worker.findById(id).lean();
  if (!worker) throw new AppError(404, "Worker not found");
  return worker;
}

export async function updateWorker(id: string, updates: { weeklyPay?: number }) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(400, "Invalid worker id");
  }
  const worker = await Worker.findById(id);
  if (!worker) throw new AppError(404, "Worker not found");
  if (updates.weeklyPay !== undefined) {
    worker.weeklyPay = updates.weeklyPay;
  }
  await worker.save();
  return worker.toObject();
}

export async function getWorkersBySite(siteId: string, labourType?: string) {
  const query: Record<string, unknown> = { siteId: new Types.ObjectId(siteId) };
  if (labourType) query.labourType = labourType;
  return Worker.find(query).sort({ name: 1 }).lean();
}

export async function markAttendance(input: {
  workerId: string;
  projectId: string;
  siteId?: string;
  site: string;
  attendanceDate: string;
  shiftCount: number;
  overtimeHours: number;
  overtimeAmount: number;
  lateFine: number;
  paymentMode: "Cash" | "NEFT" | "UPI" | "Cheque";
  notes?: string;
  createdBy: string;
}) {
  if (!Types.ObjectId.isValid(input.workerId)) {
    throw new AppError(400, "Invalid worker id");
  }
  if (!Types.ObjectId.isValid(input.projectId)) {
    throw new AppError(400, "Invalid project id");
  }
  const today = new Date().toISOString().slice(0, 10);
  if (input.attendanceDate > today) {
    throw new AppError(400, "Attendance cannot be marked for future dates");
  }
  const worker = await Worker.findById(input.workerId).lean();
  if (!worker) throw new AppError(404, "Worker not found");

  const existing = await Attendance.findOne({
    workerId: new Types.ObjectId(input.workerId),
    attendanceDate: input.attendanceDate,
  }).lean();
  if (existing) {
    throw new AppError(
      409,
      `Attendance already marked for this worker on ${input.attendanceDate}`
    );
  }

  const attendanceId = await generateId("ATT");
  const attendance = await Attendance.create({
    attendanceId,
    workerId: worker._id,
    workerName: worker.name || "Unknown",
    projectId: new Types.ObjectId(input.projectId),
    projectName: worker.projectName || "Unknown",
    clientId: worker.clientId || worker.projectId,
    siteId: input.siteId && Types.ObjectId.isValid(input.siteId) ? new Types.ObjectId(input.siteId) : undefined,
    site: input.site,
    labourType: worker.labourType || "General",
    weeklyPay: worker.weeklyPay ?? 0,
    attendanceDate: input.attendanceDate,
    shiftCount: input.shiftCount,
    overtimeHours: input.overtimeHours,
    overtimeAmount: input.overtimeAmount,
    lateFine: input.lateFine,
    paymentMode: input.paymentMode,
    notes: input.notes,
    createdBy: input.createdBy,
  });

  return attendance.toObject();
}

export async function listAttendanceForDate(siteId: string | undefined, date: string, projectId?: string) {
  const query: Record<string, unknown> = {
    attendanceDate: date,
  };
  if (siteId && Types.ObjectId.isValid(siteId)) {
    query.siteId = new Types.ObjectId(siteId);
  } else if (siteId) {
    delete query.siteId;
  }
  if (projectId && Types.ObjectId.isValid(projectId)) {
    query.projectId = new Types.ObjectId(projectId);
  }
  return Attendance.find(query).sort({ workerName: 1 }).lean();
}

export async function listAttendanceForWorker(workerId: string, page = 1, limit = 50, cursor?: string) {
  if (!Types.ObjectId.isValid(workerId)) {
    throw new AppError(400, "Invalid worker id");
  }
  const query: Record<string, unknown> = { workerId: new Types.ObjectId(workerId) };
  return paginateByCursor(Attendance, query, { page, limit, cursor });
}

export async function getAttendanceById(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(400, "Invalid attendance id");
  }
  const attendance = await Attendance.findById(id).lean();
  if (!attendance) throw new AppError(404, "Attendance record not found");
  return attendance;
}

export async function updateAttendance(
  id: string,
  patch: {
    shiftCount?: number;
    overtimeHours?: number;
    overtimeAmount?: number;
    lateFine?: number;
    paymentMode?: "Cash" | "NEFT" | "UPI" | "Cheque";
    notes?: string;
  }
) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(400, "Invalid attendance id");
  }
  const attendance = await Attendance.findByIdAndUpdate(id, patch, { new: true });
  if (!attendance) throw new AppError(404, "Attendance record not found");
  return attendance.toObject();
}

export async function deleteAttendance(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(400, "Invalid attendance id");
  }
  const result = await Attendance.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Attendance record not found");
}

export async function getLabourTypeCounts(siteId: string | undefined, date: string) {
  if (!siteId || !Types.ObjectId.isValid(siteId)) {
    return [];
  }
  const siteObjectId = new Types.ObjectId(siteId);

  const workers = await Worker.find({ siteId: siteObjectId }).lean();

  const attendances = await Attendance.find({
    siteId: siteObjectId,
    attendanceDate: date,
  }).lean();

  const typeCountMap = new Map<string, number>();

  for (const att of attendances) {
    const type = att.labourType;
    typeCountMap.set(type, (typeCountMap.get(type) || 0) + 1);
  }

  return Array.from(typeCountMap.entries()).map(([labourType, count]) => ({
    labourType,
    count,
  }));
}
