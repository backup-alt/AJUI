import { Schema, model, Document, Types } from "mongoose";

export type InviteRole = "supervisor";

export interface IInviteToken extends Document {
  _id: Types.ObjectId;
  token: string;
  createdByAdmin: Types.ObjectId;
  projectId?: Types.ObjectId;
  role: InviteRole;
  expiresAt: Date;
  usedAt?: Date;
  usedBy?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  supervisorEmail?: string;
  supervisorPhone?: string;
  otpHash?: string;
  otpExpiresAt?: Date;
  createdAt: Date;
}

const inviteTokenSchema = new Schema<IInviteToken>(
  {
    token: { type: String, required: true, unique: true, index: true },
    createdByAdmin: { type: Schema.Types.ObjectId, ref: "User", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    role: { type: String, enum: ["supervisor"], default: "supervisor", required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date },
    usedBy: { type: Schema.Types.ObjectId, ref: "User" },
    metadata: { type: Schema.Types.Mixed as any },
    supervisorEmail: { type: String },
    supervisorPhone: { type: String },
    otpHash: { type: String },
    otpExpiresAt: { type: Date },
  },
  { timestamps: true }
);

export const InviteToken = model<IInviteToken>("InviteToken", inviteTokenSchema);