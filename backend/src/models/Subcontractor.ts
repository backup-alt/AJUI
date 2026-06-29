import { Schema, model, Document, Types } from "mongoose";

export type ApprovalStatus = "Pending" | "Approved" | "Rejected";
export type PaymentSubStatus = "Not Started" | "Part Paid" | "Paid";

export interface ISubcontractor extends Document {
  _id: Types.ObjectId;
  subcontractId: string;
  projectId: Types.ObjectId;
  projectName: string;
  clientId: Types.ObjectId;
  siteId?: Types.ObjectId;
  site: string;
  subcontractorName: string;
  workPackage: string;
  contractValue: number;
  advancePaid: number;
  balance: number;
  startDate: string;
  dueDate: string;
  supervisor: string;
  supervisorId?: Types.ObjectId;
  approvalStatus: ApprovalStatus;
  paymentStatus: PaymentSubStatus;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subcontractorSchema = new Schema<ISubcontractor>(
  {
    subcontractId: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    projectName: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    site: { type: String, required: true },
    subcontractorName: { type: String, required: true, trim: true, index: true },
    workPackage: { type: String, required: true, trim: true },
    contractValue: { type: Number, required: true },
    advancePaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    startDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    supervisor: { type: String, required: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: "Supervisor" },
    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Not Started", "Part Paid", "Paid"],
      default: "Not Started",
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

subcontractorSchema.pre("save", function (next) {
  this.balance = Math.max(0, this.contractValue - this.advancePaid);
  next();
});

export const Subcontractor = model<ISubcontractor>("Subcontractor", subcontractorSchema);
