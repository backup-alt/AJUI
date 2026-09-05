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
  requestedQuantity: number;
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
  /** Free-text note attached to the most recent addition of this material at this site. */
  notes?: string;
  billUrl?: string;
  pcloudFileId?: string;
  pcloudPublicCode?: string;
  pcloudContentHash?: string;
  receiptImage?: string;
  receiptImageMimeType?: string;
  receiptImageName?: string;
  receiptUploadedBy?: string;
  received?: boolean;
  receivedDate?: string;
  purchaseHistory?: Array<{
    vendor: string;
    vendorId?: Types.ObjectId;
    quantity: number;
    date: Date;
    poNumber?: string;
    materialId?: Types.ObjectId;
    received?: boolean;
    receivedDate?: string;
    /** Free-text note attached when this purchase entry was recorded (e.g. supervisor's "Add existing material" note). */
    notes?: string;
  }>;
  consumptionHistory?: Array<{
    quantity: number;
    date: Date;
    updatedBy?: string;
    notes?: string;
  }>;
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
    site: { type: String, default: "" },
    // An empty key represents project stock that has no assigned site yet.
    siteKey: { type: String, default: "", index: true },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, index: true },
    unit: { type: String, required: true },
    normalizedUnit: { type: String, required: true, index: true },
    requestedQuantity: { type: Number, default: 0 },
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
    notes: { type: String, trim: true, maxlength: 2000 },
    billUrl: { type: String },
    pcloudFileId: { type: String, trim: true, index: true },
    pcloudPublicCode: { type: String, trim: true },
    pcloudContentHash: { type: String, trim: true },
    receiptImage: { type: String, select: false },
    receiptImageMimeType: { type: String, select: false },
    receiptImageName: { type: String },
    receiptUploadedBy: { type: String, index: true },
    received: { type: Boolean, default: false },
    receivedDate: { type: String },
    purchaseHistory: {
      type: [{
        vendor: { type: String, trim: true },
        vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
        quantity: { type: Number, default: 0 },
        date: { type: Date, default: Date.now },
        poNumber: { type: String, trim: true },
        materialId: { type: Schema.Types.ObjectId, ref: "Material" },
        received: { type: Boolean, default: false },
        receivedDate: { type: String },
        notes: { type: String, trim: true, maxlength: 2000 },
      }],
      default: undefined,
    },
    consumptionHistory: {
      type: [{
        quantity: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        updatedBy: { type: String },
        notes: { type: String, trim: true },
      }],
      default: undefined,
    },
  },
  { timestamps: true }
);

inventorySchema.index(
  { projectId: 1, siteKey: 1, normalizedName: 1, normalizedUnit: 1 },
  { unique: true }
);
inventorySchema.index({ projectId: 1, _id: -1 });
inventorySchema.index({ siteId: 1, _id: -1 });
inventorySchema.index({ projectId: 1, siteId: 1, _id: -1 });

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
