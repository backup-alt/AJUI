import { Schema, model, Document, Types } from "mongoose";

/**
 * Per-day, per-sub-contractor headcount snapshot. Each row records the
 * number of workers a sub-contractor brought on-site, broken down by
 * labour type (e.g. 2 helpers, 2 masons, 2 civil).
 *
 * Design note: we intentionally do NOT track individual workers (name,
 * phone, address, weekly pay, etc.) here. The mobile-only attendance
 * flow is meant to capture the *headcount* needed for daily muster /
 * billing reconciliation — not a worker roster. Per-worker data
 * (if needed in future) lives in `SubcontractorLabor`.
 */
export interface ISubcontractorAttendanceEntry {
  labourType: string;
  count: number;
}

export interface ISubcontractorAttendance extends Document {
  _id: Types.ObjectId;
  subcontractorId: Types.ObjectId;
  subcontractorName: string;
  projectId?: Types.ObjectId;
  projectName?: string;
  siteId?: Types.ObjectId;
  siteName?: string;
  attendanceDate: string; // YYYY-MM-DD
  entries: ISubcontractorAttendanceEntry[];
  totalCount: number;
  shifts?: number; // 1 = half day, 2 = full day
  notes?: string;
  submittedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subcontractorAttendanceEntrySchema = new Schema<ISubcontractorAttendanceEntry>(
  {
    labourType: { type: String, required: true, trim: true, maxlength: 80 },
    count: { type: Number, required: true, min: 0, max: 1000, default: 0 },
  },
  { _id: false }
);

const subcontractorAttendanceSchema = new Schema<ISubcontractorAttendance>(
  {
    subcontractorId: {
      type: Schema.Types.ObjectId,
      ref: "Subcontractor",
      required: true,
      index: true,
    },
    subcontractorName: { type: String, required: true, trim: true, maxlength: 200 },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    projectName: { type: String, trim: true, maxlength: 200 },
    siteId: { type: Schema.Types.ObjectId, ref: "Site", index: true },
    siteName: { type: String, trim: true, maxlength: 200 },
    attendanceDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    entries: { type: [subcontractorAttendanceEntrySchema], default: [] },
    totalCount: { type: Number, default: 0, min: 0 },
    shifts: { type: Number, default: 2, min: 1, max: 2 },
    notes: { type: String, default: "", trim: true, maxlength: 1000 },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One muster per (sub-contractor, project, date). Re-submitting the same
// day for the same sub-contractor is treated as an upsert, not a
// duplicate. The compound key ignores siteId because a sub-contractor
// usually works the same project on the same day.
subcontractorAttendanceSchema.index(
  { subcontractorId: 1, projectId: 1, attendanceDate: 1 },
  { unique: true }
);
subcontractorAttendanceSchema.index({ attendanceDate: 1, projectId: 1 });

export const SubcontractorAttendance = model<ISubcontractorAttendance>(
  "SubcontractorAttendance",
  subcontractorAttendanceSchema
);
