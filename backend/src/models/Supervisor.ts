import { Schema, model, Document, Types } from "mongoose";

export type SupervisorStatus = "Active" | "On Leave" | "Inactive";

export interface ISupervisor extends Document {
  _id: Types.ObjectId;
  supervisorId: string;
  userId?: Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  address?: string;
  role: string;
  assignedProject?: string;
  assignedProjectId?: Types.ObjectId;
  assignedSites?: string[];
  assignedSiteId?: Types.ObjectId;
  assignedSiteIds: Types.ObjectId[];
  cashLimit: number;
  activeAdvances: number;
  approvalAuthority: number;
  status: SupervisorStatus;
  createdAt: Date;
  updatedAt: Date;
}

const supervisorSchema = new Schema<ISupervisor>(
  {
    supervisorId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    address: { type: String },
    role: { type: String, default: "Site Supervisor" },
    assignedProject: { type: String },
    assignedProjectId: { type: Schema.Types.ObjectId, ref: "Project" },
    assignedSites: [{ type: String }],
    assignedSiteId: { type: Schema.Types.ObjectId, ref: "Site", index: true },
    assignedSiteIds: [{ type: Schema.Types.ObjectId, ref: "Site", index: true }],
    cashLimit: { type: Number, default: 0 },
    activeAdvances: { type: Number, default: 0 },
    approvalAuthority: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Active", "On Leave", "Inactive"],
      default: "Active",
      index: true,
    },
  },
  { timestamps: true }
);

export const Supervisor = model<ISupervisor>("Supervisor", supervisorSchema);
