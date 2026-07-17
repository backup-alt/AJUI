import { Schema, model, Document, Types } from "mongoose";

export interface IMaterialBillLink extends Document {
  _id: Types.ObjectId;
  vendorName: string;
  siteName: string;
  materialId: string;
  billUrl: string;
  billLabel?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const materialBillLinkSchema = new Schema<IMaterialBillLink>(
  {
    vendorName: { type: String, required: true, trim: true, index: true },
    siteName: { type: String, required: true, trim: true, index: true },
    materialId: { type: String, required: true, trim: true, index: true },
    billUrl: { type: String, required: true, trim: true },
    billLabel: { type: String, trim: true },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

materialBillLinkSchema.index({ vendorName: 1, siteName: 1, materialId: 1 }, { unique: true });

export const MaterialBillLink = model<IMaterialBillLink>("MaterialBillLink", materialBillLinkSchema);
