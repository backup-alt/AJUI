import { Schema, model, Document, Types } from "mongoose";

export type PurchaseOrderItemSource = "existing" | "manual";

export interface IPurchaseOrderItem {
  materialId: Types.ObjectId;
  source: PurchaseOrderItemSource;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  itemAmount: number;
  gstPercent: number;
  gstAmount: number;
}

export interface IPurchaseOrder extends Document {
  _id: Types.ObjectId;
  poNumber: string;
  projectId: Types.ObjectId;
  projectName: string;
  vendorId: Types.ObjectId;
  vendorName: string;
  date: string;
  items: IPurchaseOrderItem[];
  subtotal: number;
  totalGst: number;
  roundOff: number;
  grandTotal: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    source: { type: String, enum: ["existing", "manual"], required: true },
    description: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    rate: { type: Number, required: true, min: 0 },
    itemAmount: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, required: true, min: 0, max: 100 },
    gstAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    poNumber: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    projectName: { type: String, required: true, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    vendorName: { type: String, required: true, trim: true },
    date: { type: String, required: true, index: true },
    items: { type: [purchaseOrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    totalGst: { type: Number, required: true, min: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ projectId: 1, createdAt: -1 });
purchaseOrderSchema.index({ vendorId: 1, createdAt: -1 });

export const PurchaseOrder = model<IPurchaseOrder>("PurchaseOrder", purchaseOrderSchema);

