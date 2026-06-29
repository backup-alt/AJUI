import { Schema, model, Document, Types } from "mongoose";

export type ExpenseType = "site" | "general";
export type ExpenseStatus = "Pending" | "Approved" | "Rejected";

export interface IExpense extends Document {
  _id: Types.ObjectId;
  expenseId: string;
  type: ExpenseType;
  // Site expense fields
  projectId?: Types.ObjectId;
  projectName?: string;
  clientId?: Types.ObjectId;
  siteId?: Types.ObjectId;
  site?: string;
  supervisor?: string;
  supervisorId?: Types.ObjectId;
  transactionType?: string;
  amount: number;
  siteMaterialBalance?: number;
  reference?: string;
  runningBalance: number;
  // General expense fields
  department?: string;
  category?: string;
  amountPaidBy?: string;
  // Common
  date: string;
  description: string;
  status: ExpenseStatus;
  submittedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    expenseId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["site", "general"], required: true, index: true },
    // Site expense
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    projectName: { type: String },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    site: { type: String },
    supervisor: { type: String },
    supervisorId: { type: Schema.Types.ObjectId, ref: "Supervisor" },
    transactionType: { type: String },
    amount: { type: Number, required: true },
    siteMaterialBalance: { type: Number },
    reference: { type: String, trim: true },
    runningBalance: { type: Number, default: 0 },
    // General expense
    department: { type: String },
    category: { type: String },
    amountPaidBy: { type: String },
    // Common
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
  },
  { timestamps: true }
);

expenseSchema.index({ projectId: 1, site: 1, date: 1 });
expenseSchema.index({ type: 1, status: 1 });

export const Expense = model<IExpense>("Expense", expenseSchema);
