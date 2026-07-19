import { Types } from "mongoose";
import { Worker } from "../models/Worker.js";
import { Attendance } from "../models/Attendance.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";

export async function createWorker(input: {
  projectId: string;
  siteId?: string;
  site: string;
  name: string;
  address?: string;
  labourType: string;
  weeklyPay: number;
  isSubcontract: boolean;
  subcontractorId?: string;
  subcontractorName?: string;
  createdBy: string;
}) {
  const { Project } = await import("../models/Project.js");
  const project = await Project.findById(input.projectId).lean();
  if (!project) throw new AppError(404, "Project not found");

  let subcontractorObjectId: Types.ObjectId | undefined;
  if (input.isSubcontract && input.subcontractorId) {
    const sub = await Subcontractor.findOne({
      subcontractId: input.subcontractorId,
      projectId: project._id,
    })
      .select("_id")
      .lean();
    if (!sub) throw new AppError(404, "Subcontractor not found for this project");
    subcontractorObjectId = sub._id;
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
    weeklyPay: input.weeklyPay,
    isSubcontract: input.isSubcontract,
    subcontractorId: subcontractorObjectId,
    subcontractorName: input.subcontractorName,
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

  const page = filter.page || 1;
  const limit = filter.limit || 50;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Worker.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Worker.countDocuments(query),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
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
}) {
  return listWorkers({
    siteId: filter.siteId,
    projectId: filter.projectId,
    labourType: filter.labourType,
    page: filter.page,
    limit: filter.limit,
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
  const worker = await Worker.findById(input.workerId).lean();
  if (!worker) throw new AppError(404, "Worker not found");

  const attendanceId = await generateId("ATT");
  const attendance = await Attendance.create({
    attendanceId,
    workerId: worker._id,
    workerName: worker.name,
    projectId: new Types.ObjectId(input.projectId),
    projectName: worker.projectName,
    clientId: worker.clientId,
    siteId: input.siteId && Types.ObjectId.isValid(input.siteId) ? new Types.ObjectId(input.siteId) : undefined,
    site: input.site,
    labourType: worker.labourType,
    weeklyPay: worker.weeklyPay,
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

export async function listAttendanceForWorker(workerId: string, page = 1, limit = 50) {
  if (!Types.ObjectId.isValid(workerId)) {
    throw new AppError(400, "Invalid worker id");
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Attendance.find({ workerId: new Types.ObjectId(workerId) })
      .sort({ attendanceDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attendance.countDocuments({ workerId: new Types.ObjectId(workerId) }),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
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

export async function listSubcontractors(projectId: string, siteId?: string) {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new AppError(400, "Invalid project id");
  }
  const query: Record<string, unknown> = {
    projectId: new Types.ObjectId(projectId),
    approvalStatus: "Approved",
  };
  if (siteId && Types.ObjectId.isValid(siteId)) {
    query.siteId = new Types.ObjectId(siteId);
  }

  const subs = await Subcontractor.find(query)
    .select("subcontractId subcontractorName")
    .sort({ subcontractorName: 1 })
    .lean();

  return subs.map((s) => ({
    subcontractorId: s.subcontractId,
    subcontractorName: s.subcontractorName,
  }));
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