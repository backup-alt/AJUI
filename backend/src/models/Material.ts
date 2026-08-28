import { Schema, model, Document, Types } from "mongoose";

export type MaterialStatus = "Pending" | "Approved" | "Received" | "Not Received";

export interface IMaterial extends Document {
  _id: Types.ObjectId;
  materialId: string;
  projectId?: Types.ObjectId;
  projectName?: string;
  clientId?: Types.ObjectId;
  clientName?: string;
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
  isExistingMaterial?: boolean;
  orderedDate?: string;
  vendor?: string;
  vendorId?: Types.ObjectId;
  poNumber?: string;
  paymentType?: string;
  requestDate: string;
  receivedDate?: string;
  approvalDate?: string;
  status: MaterialStatus;
  notes?: string;
  noteHistory?: Array<{ note: string; date: Date }>;
  billUrl?: string;
  pcloudFileId?: string;
  pcloudPublicCode?: string;
  pcloudContentHash?: string;
  receiptImage?: string;
  receiptImageMimeType?: string;
  receiptImageName?: string;
  billHistory?: Array<{
    billUrl: string;
    fileName?: string;
    pcloudFileId?: string;
    pcloudPublicCode?: string;
    uploadedAt: Date;
  }>;
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
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    projectName: { type: String },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    clientName: { type: String },
    siteId: { type: Schema.Types.ObjectId, ref: "Site", index: true },
    site: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    unit: { type: String, required: true },
    requestedQuantity: { type: Number, default: 0 },
    approvedQuantity: { type: Number, default: 0 },
    purchasedQuantity: { type: Number, default: 0 },
    consumedQuantity: { type: Number, default: 0 },
    remainingStock: { type: Number, default: 0 },
    issuedAmount: { type: Number },
    givenAmount: { type: Number },
    isExistingMaterial: { type: Boolean, default: false, index: true },
    orderedDate: { type: String, index: true },
    vendor: { type: String, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    poNumber: { type: String, trim: true },
    paymentType: { type: String, trim: true, maxlength: 50 },
    requestDate: { type: String, required: true, index: true },
    receivedDate: { type: String, index: true },
    approvalDate: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Received", "Not Received"],
      default: "Not Received",
      index: true,
    },
    createdBy: { type: String },
    supervisorName: { type: String, trim: true },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 2000 },
    noteHistory: {
      type: [{
        note: { type: String, required: true, trim: true, maxlength: 2000 },
        date: { type: Date, required: true, default: Date.now },
        _id: false,
      }],
      default: [],
    },
    billUrl: { type: String, trim: true },
    pcloudFileId: { type: String, trim: true, index: true },
    pcloudPublicCode: { type: String, trim: true },
    pcloudContentHash: { type: String, trim: true },
    receiptImage: { type: String, select: false },
    receiptImageMimeType: { type: String, select: false },
    receiptImageName: { type: String },
    billHistory: {
      type: [{
        billUrl: { type: String, required: true },
        fileName: { type: String },
        pcloudFileId: { type: String },
        pcloudPublicCode: { type: String },
        uploadedAt: { type: Date, required: true, default: Date.now },
        _id: false,
      }],
      default: [],
    },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

materialSchema.pre("save", function (next) {
  this.remainingStock = Math.max(0, this.purchasedQuantity - this.consumedQuantity);
  next();
});

materialSchema.index({ status: 1, _id: -1 });
materialSchema.index({ projectId: 1, _id: -1 });
materialSchema.index({ siteId: 1, _id: -1 });
materialSchema.index({ projectId: 1, status: 1, _id: -1 });
materialSchema.index({ siteId: 1, status: 1, _id: -1 });

export const Material = model<IMaterial>("Material", materialSchema);

