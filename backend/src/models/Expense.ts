import { Schema, model, Document, Types } from "mongoose";

export type ExpenseType = "site" | "general";
export type ExpenseStatus = "Pending" | "Approved" | "Rejected";

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
  transactionType?: string;
  amount: number;
  siteMaterialBalance?: number;
  reference?: string;
  runningBalance: number;
  department?: string;
  category?: string;
  amountPaidBy?: string;
  date: string;
  description: string;
  status: ExpenseStatus;
  submittedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  isSiteMaterial?: boolean;
  materialName?: string;
  materialUnit?: string;
  materialQuantity?: number;
  materialVendor?: string;
  materialVendorId?: Types.ObjectId;
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
    transactionType: { type: String },
    amount: { type: Number, required: true },
    siteMaterialBalance: { type: Number },
    reference: { type: String, trim: true },
    runningBalance: { type: Number, default: 0 },
    department: { type: String },
    category: { type: String },
    amountPaidBy: { type: String },
    date: { type: String, required: true, index: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    submittedBy: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    isSiteMaterial: { type: Boolean, default: false },
    materialName: { type: String },
    materialUnit: { type: String },
    materialQuantity: { type: Number },
    materialVendor: { type: String },
    materialVendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

expenseSchema.index({ projectId: 1, site: 1, date: 1 });
expenseSchema.index({ type: 1, status: 1 });

export const Expense = model<IExpense>("Expense", expenseSchema);
