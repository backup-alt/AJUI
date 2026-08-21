import { Schema, model, Document, Types } from "mongoose";

/**
 * "General Expense" — a project-level expense record that is separate from
 * the legacy `Expense` collection (which is the supervisor's site cash
 * ledger). Where the legacy collection tracks cash-issued / cash-spent by
 * the site supervisor against a running balance, the GeneralExpense
 * collection captures top-down, admin / manually-logged expense entries
 * (think: rent paid, loan EMI, fuel for management visits, software
 * subscriptions, etc.) and rolls them up into the project "Total Expense"
 * KPI alongside the supervisor's site-expense lines.
 *
 * Schema is intentionally minimal — the existing collection already
 * covers the supervisor-cash workflow and re-using those fields here
 * would muddy two very different concepts.
 */
export type GeneralExpenseStatus = "Pending" | "Approved" | "Rejected";

export interface IGeneralExpense extends Document {
  _id: Types.ObjectId;
  expenseId: string;
  // Where this expense came from. Lets the UI show "Manual entry" vs
  // "Imported from ..." without needing a separate collection later.
  origin: string;
  // Optional category (rent, fuel, admin, general, ...).
  category?: string;
  amount: number;
  date: string;
  description: string;
  projectId?: Types.ObjectId;
  projectName?: string;
  clientId?: Types.ObjectId;
  clientName?: string;
  siteId?: Types.ObjectId;
  site?: string;
  notes?: string;
  paymentMode?: string;
  paidBy?: string;
  reference?: string;
  billUrl?: string;
  pcloudFileId?: string;
  pcloudPublicCode?: string;
  receiptImageName?: string;
  status: GeneralExpenseStatus;
  // Free-form fields the user has added via the custom-fields workflow.
  customFields?: Record<string, unknown>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const generalExpenseSchema = new Schema<IGeneralExpense>(
  {
    expenseId: { type: String, required: true, unique: true, index: true },
    origin: { type: String, default: "manual", index: true },
    category: { type: String, trim: true, maxlength: 100, index: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    projectName: { type: String },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    clientName: { type: String },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    site: { type: String },
    notes: { type: String, trim: true, maxlength: 2000 },
    paymentMode: { type: String, trim: true, maxlength: 50, default: "Cash" },
    paidBy: { type: String, trim: true, maxlength: 200 },
    reference: { type: String, trim: true, maxlength: 500 },
    billUrl: { type: String },
    pcloudFileId: { type: String },
    pcloudPublicCode: { type: String },
    receiptImageName: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Approved",
      index: true,
    },
    customFields: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String },
  },
  { timestamps: true }
);

generalExpenseSchema.index({ projectId: 1, date: 1 });
generalExpenseSchema.index({ projectId: 1, status: 1, _id: -1 });
generalExpenseSchema.index({ siteId: 1, status: 1, _id: -1 });
generalExpenseSchema.index({ category: 1, _id: -1 });

export const GeneralExpense = model<IGeneralExpense>(
  "GeneralExpense",
  generalExpenseSchema,
  "general_expenses"
);
