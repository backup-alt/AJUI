import { Types } from "mongoose";
import { Subcontractor } from "../models/Subcontractor.js";
import { SubcontractorAttendance, ISubcontractorAttendanceEntry } from "../models/SubcontractorAttendance.js";
import { Project } from "../models/Project.js";
import { AppError } from "../middleware/errorHandler.js";
import { invalidateCachePrefix } from "../middleware/cache.js";
import { getSupervisorAccess } from "./supervisor-mobile.service.js";

export interface AttendanceEntryInput {
  labourType: string;
  count: number;
}

export interface MarkBulkAttendanceInput {
  subcontractorId: string;
  projectId?: string;
  siteId?: string;
  siteName?: string;
  attendanceDate: string; // YYYY-MM-DD
  entries: AttendanceEntryInput[];
  notes?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toObjectId(id: string | undefined | null): Types.ObjectId | undefined {
  if (!id) return undefined;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
  return new Types.ObjectId(id);
}

function normalizeEntries(entries: AttendanceEntryInput[] | undefined | null): ISubcontractorAttendanceEntry[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const out: ISubcontractorAttendanceEntry[] = [];
  for (const raw of entries) {
    if (!raw) continue;
    const labourType = String(raw.labourType || "").trim();
    if (!labourType) continue;
    const key = labourType.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const count = Math.max(0, Math.min(1000, Math.floor(Number(raw.count) || 0)));
    out.push({ labourType, count });
  }
  return out;
}

/**
 * Idempotent bulk attendance submission. Re-submitting the same
 * (sub-contractor, project, date) replaces the prior entry list — a
 * common workflow when the supervisor re-counts at the end of the
 * day. Zero-count rows are kept (the user explicitly entered 0) so the
 * muster reflects what was seen on site.
 */
export async function markBulkAttendance(
  input: MarkBulkAttendanceInput,
  submittedBy: string
) {
  if (!input?.subcontractorId) throw new AppError(400, "subcontractorId is required");
  if (!input.attendanceDate || !DATE_RE.test(input.attendanceDate)) {
    throw new AppError(400, "attendanceDate must be YYYY-MM-DD");
  }

  const subcontractorId = toObjectId(input.subcontractorId)!;
  const sub = await Subcontractor.findById(subcontractorId).lean();
  if (!sub) throw new AppError(404, "Subcontractor not found");

  const projectId = toObjectId(input.projectId ?? sub.projectId?.toString());
  if (!projectId) throw new AppError(400, "projectId is required");

  const project = await Project.findById(projectId).select("name").lean();
  if (!project) throw new AppError(404, "Project not found");

  const entries = normalizeEntries(input.entries);
  const totalCount = entries.reduce((sum, e) => sum + e.count, 0);

  const siteId = toObjectId(input.siteId);
  const update = {
    subcontractorId,
    subcontractorName: sub.subcontractorName,
    projectId,
    projectName: project.name,
    siteId,
    siteName: input.siteName || "",
    attendanceDate: input.attendanceDate,
    entries,
    totalCount,
    notes: input.notes?.trim() || "",
    submittedBy: toObjectId(submittedBy),
  };

  const doc = await SubcontractorAttendance.findOneAndUpdate(
    { subcontractorId, projectId, attendanceDate: input.attendanceDate },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  // Invalidate dashboard / list caches that key on the (date, project)
  // pair — the supervisor app hydrates attendance counts on its landing
  // page, so the next read needs to see this new muster.
  invalidateCachePrefix("/supervisor/attendance");
  invalidateCachePrefix("/supervisor/labour");

  return doc;
}

export async function listAttendanceForDate(filter: {
  attendanceDate: string;
  projectId?: string;
  siteId?: string;
  scopeProjectIds?: Types.ObjectId[];
}) {
  if (!filter.attendanceDate || !DATE_RE.test(filter.attendanceDate)) {
    throw new AppError(400, "attendanceDate must be YYYY-MM-DD");
  }
  const query: Record<string, unknown> = { attendanceDate: filter.attendanceDate };
  if (filter.projectId) {
    const projectId = toObjectId(filter.projectId);
    if (projectId) query.projectId = projectId;
  }
  if (filter.siteId) {
    const siteId = toObjectId(filter.siteId);
    if (siteId) query.siteId = siteId;
  }
  if (filter.scopeProjectIds && filter.scopeProjectIds.length > 0) {
    query.projectId = { $in: filter.scopeProjectIds };
  }
  const items = await SubcontractorAttendance.find(query)
    .sort({ subcontractorName: 1 })
    .lean();
  return items;
}

export async function listAttendanceForSupervisor(
  userId: string,
  attendanceDate: string
) {
  const access = await getSupervisorAccess(userId);
  if (access.projectIds.length === 0) {
    // Mirror the same project-by-site-name fallback as the subcontractor
    // service so supervisors tied only to a site name still get results.
    if (access.siteNames.length > 0) {
      const projects = await Project.find({ "sites.name": { $in: access.siteNames } })
        .select("_id")
        .lean();
      return listAttendanceForDate({
        attendanceDate,
        scopeProjectIds: projects.map((p) => p._id),
      });
    }
    return [];
  }
  return listAttendanceForDate({
    attendanceDate,
    scopeProjectIds: access.projectIds,
  });
}

export async function getBulkAttendanceById(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
  const doc = await SubcontractorAttendance.findById(id).lean();
  if (!doc) throw new AppError(404, "Attendance record not found");
  return doc;
}

export async function deleteBulkAttendance(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
  const result = await SubcontractorAttendance.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Attendance record not found");
  invalidateCachePrefix("/supervisor/attendance");
  invalidateCachePrefix("/supervisor/labour");
}
