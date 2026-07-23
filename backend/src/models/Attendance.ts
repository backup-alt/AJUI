import { Schema, model, Document, Types } from "mongoose";

export type AttendanceStatus = "Present" | "Absent";

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  attendanceId: string;
  workerId: Types.ObjectId;
  workerName: string;
  projectId: Types.ObjectId;
  projectName: string;
  clientId: Types.ObjectId;
  siteId?: Types.ObjectId;
  site: string;
  labourType: string;
  weeklyPay: number;
  attendanceDate: string;
  shiftCount: number;
  overtimeHours: number;
  overtimeAmount: number;
  lateFine: number;
  paymentMode: "Cash" | "NEFT" | "UPI" | "Cheque";
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    attendanceId: { type: String, required: true, unique: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true, index: true },
    workerName: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    projectName: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    site: { type: String, required: true },
    labourType: { type: String, required: true },
    weeklyPay: { type: Number, required: true },
    attendanceDate: { type: String, required: true, index: true },
    shiftCount: { type: Number, default: 1, min: 1, max: 2 },
    overtimeHours: { type: Number, default: 0, min: 0 },
    overtimeAmount: { type: Number, default: 0, min: 0 },
    lateFine: { type: Number, default: 0, min: 0 },
    paymentMode: {
      type: String,
      enum: ["Cash", "NEFT", "UPI", "Cheque"],
      default: "Cash",
    },
    notes: { type: String, trim: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ siteId: 1, attendanceDate: 1 });
attendanceSchema.index({ workerId: 1, attendanceDate: 1 });

export const Attendance = model<IAttendance>("Attendance", attendanceSchema);