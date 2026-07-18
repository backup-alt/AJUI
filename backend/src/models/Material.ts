import { Schema, model, Document, Types } from "mongoose";

export type MaterialStatus = "Pending" | "Approved" | "Rejected" | "Completed" | "Received" | "Not Received";

export interface IMaterial extends Document {
  _id: Types.ObjectId;
  materialId: string;
  projectId: Types.ObjectId;
  projectName: string;
  clientId: Types.ObjectId;
  clientName: string;
  siteId?: Types.ObjectId;
  site: string;
  name: string;
  unit: string;
  requestedQuantity: number;
  approvedQuantity: number;
  purchasedQuantity: number;
  consumedQuantity: number;
  remainingStock: number;
  issuedAmount?: number;
  givenAmount?: number;
  vendor?: string;
  vendorId?: Types.ObjectId;
  poNumber?: string;
  requestDate: string;
  approvalDate?: string;
  status: MaterialStatus;
  notes?: string;
  billUrl?: string;
  customFields?: Record<string, string | number | boolean | null>;
  createdBy?: string;
  supervisorName?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema<IMaterial>(
  {
    materialId: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    projectName: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    clientName: { type: String, required: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    site: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    unit: { type: String, required: true },
    requestedQuantity: { type: Number, default: 0 },
    approvedQuantity: { type: Number, default: 0 },
    purchasedQuantity: { type: Number, default: 0 },
    consumedQuantity: { type: Number, default: 0 },
    remainingStock: { type: Number, default: 0 },
    issuedAmount: { type: Number },
    givenAmount: { type: Number },
    vendor: { type: String, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    poNumber: { type: String, trim: true },
    requestDate: { type: String, required: true, index: true },
    approvalDate: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed", "Received", "Not Received"],
      default: "Pending",
      index: true,
    },
    createdBy: { type: String },
    supervisorName: { type: String, trim: true },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 2000 },
    billUrl: { type: String, trim: true },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

materialSchema.pre("save", function (next) {
  this.remainingStock = Math.max(0, this.purchasedQuantity - this.consumedQuantity);
  next();
});

export const Material = model<IMaterial>("Material", materialSchema);

