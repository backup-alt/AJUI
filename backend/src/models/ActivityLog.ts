import { Schema, model, Document, Types } from "mongoose";

export type ActivityAction =
  | "sign_in"
  | "sign_out"
  | "account_created"
  | "approval_approved"
  | "approval_rejected"
  | "permission_updated"
  | "password_changed";

export interface IActivityLog extends Document {
  userId: Types.ObjectId;
  action: ActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: {
      type: String,
      enum: ["sign_in", "sign_out", "account_created", "approval_approved", "approval_rejected", "permission_updated", "password_changed"],
      required: true,
      index: true,
    },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ userId: 1, createdAt: -1 });

export const ActivityLog = model<IActivityLog>("ActivityLog", activityLogSchema);