import { Schema, model, Document, Types } from "mongoose";

export type UserRole = "admin" | "accountant" | "project_manager" | "supervisor";
export type UserStatus = "active" | "inactive" | "on_leave";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdBy?: Types.ObjectId;
  supervisorProfileId?: Types.ObjectId;
  managedProjectIds: Types.ObjectId[];
  requestPermissions?: {
    canApproveMaterial: boolean;
    canApproveLabour: boolean;
    canApproveExpense: boolean;
    canApproveGeneral: boolean;
    canApproveSubcontract: boolean;
    canApprovePayment: boolean;
    canManageWorkers: boolean;
    canViewReports: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  deactivatedAt?: Date;
  deactivatedBy?: Types.ObjectId;
  loginOtpHash?: string;
  loginOtpExpiresAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["admin", "accountant", "project_manager", "supervisor"],
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "on_leave"],
      default: "active",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    supervisorProfileId: { type: Schema.Types.ObjectId, ref: "Supervisor" },
    managedProjectIds: [{ type: Schema.Types.ObjectId, ref: "Project" }],
    lastLoginAt: { type: Date },
    deactivatedAt: { type: Date },
    deactivatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    requestPermissions: {
      canApproveMaterial: { type: Boolean, default: false },
      canApproveLabour: { type: Boolean, default: false },
      canApproveExpense: { type: Boolean, default: false },
      canApproveGeneral: { type: Boolean, default: false },
      canApproveSubcontract: { type: Boolean, default: false },
      canApprovePayment: { type: Boolean, default: false },
      canManageWorkers: { type: Boolean, default: false },
      canViewReports: { type: Boolean, default: false },
    },
    loginOtpHash: { type: String },
    loginOtpExpiresAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.passwordHash;
    return obj;
  },
});

export const User = model<IUser>("User", userSchema);
