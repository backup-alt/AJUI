import { Schema, model, Document, Types } from "mongoose";

export type LabourStatus = "Pending" | "Approved" | "Rejected";
export type LabourShift = "Day" | "Night" | "Evening";

export interface ILaborTypeEntry {
  name: string;
  dailyWage: number;
  staffCount: number;
}

export interface ILabour extends Document {
  _id: Types.ObjectId;
  labourId: string;
  projectId: Types.ObjectId;
  projectName: string;
  clientId: Types.ObjectId;
  siteId?: Types.ObjectId;
  site: string;
  partyName: string;
  category: string;
  attendanceDate: string;
  presentCount: number;
  presentDays: number;
  absentDays: number;
  dailyWage: number;
  overtime: number;
  lateFine: number;
  shift: LabourShift;
  paymentMode: "Cash" | "NEFT" | "UPI" | "Cheque";
  wagePeriod?: string;
  laborTypes: ILaborTypeEntry[];
  notes?: string;
  status: LabourStatus;
  submittedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const laborTypeSchema = new Schema<ILaborTypeEntry>(
  {
    name: { type: String, required: true },
    dailyWage: { type: Number, default: 0 },
    staffCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const labourSchema = new Schema<ILabour>(
  {
    labourId: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    projectName: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    site: { type: String, required: true },
    partyName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    attendanceDate: { type: String, required: true, index: true },
    presentCount: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    dailyWage: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    lateFine: { type: Number, default: 0 },
    shift: {
      type: String,
      enum: ["Day", "Night", "Evening"],
      default: "Day",
    },
    paymentMode: {
      type: String,
      enum: ["Cash", "NEFT", "UPI", "Cheque"],
      default: "Cash",
    },
    wagePeriod: { type: String },
    laborTypes: { type: [laborTypeSchema], default: [] },
    notes: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    submittedBy: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

export const Labour = model<ILabour>("Labour", labourSchema);
