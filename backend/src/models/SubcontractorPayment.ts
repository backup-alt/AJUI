import { Schema, model, Document, Types } from "mongoose";

/**
 * One payment recorded against a sub-contractor. Stored as its own
 * collection (not embedded on Subcontractor) so the same record is
 * shared between the project workspace table and the main
 * subcontractor page, and so the project total expense is always
 * computed from the sum of these rows — no double counting, no stale
 * aggregates.
 *
 * The relationship:
 *   SubcontractorPayment ──belongs to──> Subcontractor (by _id)
 *   SubcontractorPayment ──belongs to──> Project     (by projectId)
 *   SubcontractorPayment ──belongs to──> Site        (by siteId, must
 *                                                  belong to projectId)
 *
 * All relationships are stored as IDs; display names are joined in
 * the service layer before returning to the API.
 */
export interface ISubcontractorPayment extends Document {
  _id: Types.ObjectId;
  subcontractorId: Types.ObjectId;
  projectId: Types.ObjectId;
  siteId?: Types.ObjectId;
  // Stored alongside the relationship for display — kept in sync on
  // update by the service. Lets us render rows without a join.
  subcontractorName: string;
  projectName: string;
  siteName?: string;
  date: string;            // ISO date (YYYY-MM-DD)
  paymentType: string;
  description: string;     // free text — work the payment covers
  employeeCount: number;   // >= 1
  amount: number;          // > 0
  notes?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subcontractorPaymentSchema = new Schema<ISubcontractorPayment>(
  {
    subcontractorId: {
      type: Schema.Types.ObjectId,
      ref: "Subcontractor",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    siteId: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      index: true,
    },
    subcontractorName: { type: String, required: true, trim: true },
    projectName: { type: String, required: true, trim: true },
    siteName: { type: String, trim: true },
    date: { type: String, required: true, index: true },
    paymentType: { type: String, required: true, default: "Bank Transfer", trim: true, maxlength: 50 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    employeeCount: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0.01 },
    notes: { type: String, default: "", maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Frequently filtered / sorted indexes. NO compound uniqueness —
// multiple payments for the same (subcontractor, project, site) on
// different dates are valid (e.g. partial payments over weeks).
subcontractorPaymentSchema.index({ subcontractorId: 1, date: -1 });
subcontractorPaymentSchema.index({ projectId: 1, date: -1 });
subcontractorPaymentSchema.index({ siteId: 1, date: -1 });

export const SubcontractorPayment = model<ISubcontractorPayment>(
  "SubcontractorPayment",
  subcontractorPaymentSchema
);
