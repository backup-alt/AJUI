import { Schema, model, Document, Types } from "mongoose";

export interface IAccessTemplate extends Document {
  _id: Types.ObjectId;
  name: string;
  role: "admin" | "project_manager" | "accountant" | "supervisor";
  approvalTypes: {
    material: { canApprove: boolean; canReject: boolean };
    labour: { canApprove: boolean; canReject: boolean };
    expense: { canApprove: boolean; canReject: boolean };
    payment: { canApprove: boolean; canReject: boolean };
    subcontract: { canApprove: boolean; canReject: boolean };
  };
  createdAt: Date;
  updatedAt: Date;
}

const accessTemplateSchema = new Schema<IAccessTemplate>(
  {
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "project_manager", "accountant", "supervisor"],
      required: true,
      unique: true,
    },
    approvalTypes: {
      type: {
        material: {
          canApprove: { type: Boolean, default: false },
          canReject: { type: Boolean, default: false },
        },
        labour: {
          canApprove: { type: Boolean, default: false },
          canReject: { type: Boolean, default: false },
        },
        expense: {
          canApprove: { type: Boolean, default: false },
          canReject: { type: Boolean, default: false },
        },
        payment: {
          canApprove: { type: Boolean, default: false },
          canReject: { type: Boolean, default: false },
        },
        subcontract: {
          canApprove: { type: Boolean, default: false },
          canReject: { type: Boolean, default: false },
        },
      },
      default: () => ({
        material: { canApprove: false, canReject: false },
        labour: { canApprove: false, canReject: false },
        expense: { canApprove: false, canReject: false },
        payment: { canApprove: false, canReject: false },
        subcontract: { canApprove: false, canReject: false },
      }),
    },
  },
  { timestamps: true }
);

accessTemplateSchema.index({ role: 1 }, { unique: true });

export const AccessTemplate = model<IAccessTemplate>("AccessTemplate", accessTemplateSchema);