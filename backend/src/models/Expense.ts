import { Schema, model, Document, Types } from "mongoose";

export type ExpenseType = "site" | "general";
export type ExpenseStatus = "Pending" | "Approved" | "Rejected" | "Completed";
export type ExpenseTransactionType = "Purchase" | "Cash Added";

export interface IExpense extends Document {
  _id: Types.ObjectId;
  expenseId: string;
  type: ExpenseType;
  projectId?: Types.ObjectId;
  projectName?: string;
  clientId?: Types.ObjectId;
  clientName?: string;
  siteId?: Types.ObjectId;
  site?: string;
  supervisor?: string;
  supervisorId?: Types.ObjectId;
  transactionType?: ExpenseTransactionType;
  amount: number;
  siteMaterialBalance?: number;
  receiptImage?: string;
  receiptImageMimeType?: string;
  receiptImageName?: string;
  runningBalance: number;
  date: string;
  description: string;
  status: ExpenseStatus;
  poNumber?: string;
  submittedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  receiptUploadedAt?: Date;
  isSiteMaterial?: boolean;
  materialName?: string;
  materialUnit?: string;
  materialQuantity?: number;
  materialVendor?: string;
  materialVendorId?: Types.ObjectId;
  materialRemainingStock?: number;
  issuedAmount?: number;
  givenAmount?: number;
  received?: boolean;
  billUrl?: string;
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    expenseId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["site", "general"], required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    projectName: { type: String },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    clientName: { type: String },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    site: { type: String },
    supervisor: { type: String },
    supervisorId: { type: Schema.Types.ObjectId, ref: "Supervisor" },
    transactionType: { type: String, enum: ["Purchase", "Cash Added"], index: true },
    amount: { type: Number, required: true },
    siteMaterialBalance: { type: Number },
    receiptImage: { type: String },
    receiptImageMimeType: { type: String },
    receiptImageName: { type: String },
    runningBalance: { type: Number, default: 0 },
    date: { type: String, required: true, index: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed"],
      default: "Pending",
      index: true,
    },
    poNumber: { type: String, trim: true, index: true },
    submittedBy: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    receiptUploadedAt: { type: Date },
    isSiteMaterial: { type: Boolean, default: false },
    materialName: { type: String },
    materialUnit: { type: String },
    materialQuantity: { type: Number },
    materialVendor: { type: String },
    materialVendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    materialRemainingStock: { type: Number },
    issuedAmount: { type: Number },
    givenAmount: { type: Number },
    received: { type: Boolean, default: false },
    billUrl: { type: String },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

expenseSchema.index({ projectId: 1, site: 1, date: 1 });
expenseSchema.index({ type: 1, status: 1 });
expenseSchema.index({ projectId: 1, site: 1, transactionType: 1, date: 1 });

export const Expense = model<IExpense>("Expense", expenseSchema);
