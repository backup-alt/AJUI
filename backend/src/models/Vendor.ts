import { Schema, model, Document, Types } from "mongoose";

export type VendorStatus = "Active" | "Inactive" | "Not Active";

export interface IVendor extends Document {
  _id: Types.ObjectId;
  vendorId: string;
  name: string;
  materialType: string;
  materialBoard?: string;
  phone: string;
  email?: string;
  address: string;
  gstNumber?: string;
  materialsBought: number;
  totalPurchaseValue: number;
  rating: number;
  status: VendorStatus;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    vendorId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    materialType: { type: String, required: true, trim: true, index: true },
    materialBoard: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, required: true },
    gstNumber: { type: String, trim: true },
    materialsBought: { type: Number, default: 0 },
    totalPurchaseValue: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Not Active"],
      default: "Active",
    },
  },
  { timestamps: true }
);

export const Vendor = model<IVendor>("Vendor", vendorSchema);
