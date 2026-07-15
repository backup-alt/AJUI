import { Schema, model, Document, Types } from "mongoose";

export type ApprovalType = "material" | "labour" | "expense" | "payment" | "subcontract";
export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

export interface IApproval extends Document {
  _id: Types.ObjectId;
  approvalId: string;
  type: ApprovalType;
  title: string;
  projectId?: Types.ObjectId;
  projectName?: string;
  site?: string;
  owner?: string;
  amount?: number;
  detail?: string;
  submittedAt: Date;
  status: ApprovalStatus;
  poNumber?: string;
  sourceCollection: string;
  sourceId: Types.ObjectId;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const approvalSchema = new Schema<IApproval>(
  {
    approvalId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ["material", "labour", "expense", "payment", "subcontract"],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    projectName: { type: String },
    site: { type: String },
    owner: { type: String },
    amount: { type: Number },
    detail: { type: String },
    submittedAt: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    sourceCollection: { type: String, required: true },
    sourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    poNumber: { type: String, trim: true },
  },
  { timestamps: true }
);

approvalSchema.index({ status: 1, submittedAt: -1 });
approvalSchema.index({ type: 1, status: 1 });

export const Approval = model<IApproval>("Approval", approvalSchema);
