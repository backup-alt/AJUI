import { Schema, model, Document, Types } from "mongoose";

export interface IVendorCustomColumn extends Document {
  _id: Types.ObjectId;
  vendorName: string;
  siteName: string;
  columnKey: string;
  label: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const vendorCustomColumnSchema = new Schema<IVendorCustomColumn>(
  {
    vendorName: { type: String, required: true, trim: true, index: true },
    siteName: { type: String, required: true, trim: true, index: true },
    columnKey: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

vendorCustomColumnSchema.index({ vendorName: 1, siteName: 1, columnKey: 1 }, { unique: true });

export const VendorCustomColumn = model<IVendorCustomColumn>("VendorCustomColumn", vendorCustomColumnSchema);
