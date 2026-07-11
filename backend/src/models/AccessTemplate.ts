import { Schema, model, Document } from "mongoose";

export interface IAccessTemplate extends Document {
  _id: Schema.Types.ObjectId;
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
      type: Schema.Types.Map,
      of: {
        canApprove: { type: Boolean, default: false },
        canReject: { type: Boolean, default: false },
      },
      default: () => new Map([
        ["material", { canApprove: false, canReject: false }],
        ["labour", { canApprove: false, canReject: false }],
        ["expense", { canApprove: false, canReject: false }],
        ["payment", { canApprove: false, canReject: false }],
        ["subcontract", { canApprove: false, canReject: false }],
      ]),
    },
  },
  { timestamps: true }
);

accessTemplateSchema.index({ role: 1 }, { unique: true });

export const AccessTemplate = model<IAccessTemplate>("AccessTemplate", accessTemplateSchema);