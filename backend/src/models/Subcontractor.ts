import { Schema, model, Document, Types } from "mongoose";

/**
 * A sub-contractor. Stores the sub-contractor's profile only — every
 * payment made to them lives in the SubcontractorPayment collection
 * (shared with the project workspace). The "Total Paid" displayed in
 * the UI is computed by summing that collection.
 */
export interface ISubcontractor extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  projectIds: Types.ObjectId[];
  projectName: string;
  clientId: Types.ObjectId;
  subcontractorName: string;
  description: string;
  employeeCount?: number;
  note?: string;
  // The four fields the admin types into the create form:
  address?: string;
  phone?: string;
  paymentMode: string;
  status: "active" | "inactive";
  createdBy?: Types.ObjectId;
  customFields?: Record<string, string | number | boolean | null>;
  createdAt: Date;
  updatedAt: Date;
}

const subcontractorSchema = new Schema<ISubcontractor>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    projectIds: [{ type: Schema.Types.ObjectId, ref: "Project", index: true }],
    projectName: { type: String },
    clientId: { type: Schema.Types.ObjectId, ref: "Project" },
    subcontractorName: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "", trim: true },
    employeeCount: { type: Number },
    note: { type: String, default: "" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    paymentMode: { type: String, default: "Bank Transfer", trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Subcontractor = model<ISubcontractor>("Subcontractor", subcontractorSchema);
