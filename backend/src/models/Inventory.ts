import { Schema, model, Document, Types } from "mongoose";

export interface IInventory extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  projectName: string;
  clientId?: Types.ObjectId;
  clientName?: string;
  siteId?: Types.ObjectId;
  site: string;
  siteKey: string;
  name: string;
  normalizedName: string;
  unit: string;
  normalizedUnit: string;
  approvedQuantity: number;
  purchasedQuantity: number;
  consumedQuantity: number;
  remainingStock: number;
  minimumQuantity: number;
  vendor?: string;
  vendorId?: Types.ObjectId;
  poNumber?: string;
  lastMaterialId?: Types.ObjectId;
  lastUpdatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const inventorySchema = new Schema<IInventory>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    projectName: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    clientName: { type: String },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    site: { type: String, required: true },
    siteKey: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, index: true },
    unit: { type: String, required: true },
    normalizedUnit: { type: String, required: true, index: true },
    approvedQuantity: { type: Number, default: 0 },
    purchasedQuantity: { type: Number, default: 0 },
    consumedQuantity: { type: Number, default: 0 },
    remainingStock: { type: Number, default: 0 },
    minimumQuantity: { type: Number, default: 0 },
    vendor: { type: String, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    poNumber: { type: String, trim: true },
    lastMaterialId: { type: Schema.Types.ObjectId, ref: "Material" },
    lastUpdatedBy: { type: String },
  },
  { timestamps: true }
);

inventorySchema.index(
  { projectId: 1, siteKey: 1, normalizedName: 1, normalizedUnit: 1 },
  { unique: true }
);

inventorySchema.pre("validate", function (next) {
  this.normalizedName = String(this.name || "").trim().toLowerCase();
  this.normalizedUnit = String(this.unit || "").trim().toLowerCase();
  this.siteKey = this.siteId ? this.siteId.toString() : String(this.site || "").trim().toLowerCase();
  next();
});

inventorySchema.pre("save", function (next) {
  this.remainingStock = Math.max(0, this.purchasedQuantity - this.consumedQuantity);
  next();
});

export const Inventory = model<IInventory>("Inventory", inventorySchema);
