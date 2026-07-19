import { Schema, model, Document, Types } from "mongoose";

export interface IAccessTemplate extends Document {
  _id: Types.ObjectId;
  name: string;
  role: "admin" | "project_manager" | "accountant" | "supervisor";
  approvalTypes: {
    material: { canApprove: boolean };
    labour: { canApprove: boolean };
    attendance: { canApprove: boolean };
    site_expense: { canApprove: boolean };
    general_expense: { canApprove: boolean };
    payment: { canApprove: boolean };
    subcontract: { canApprove: boolean };
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
        material: { canApprove: { type: Boolean, default: false } },
        labour: { canApprove: { type: Boolean, default: false } },
        attendance: { canApprove: { type: Boolean, default: false } },
        site_expense: { canApprove: { type: Boolean, default: false } },
        general_expense: { canApprove: { type: Boolean, default: false } },
        payment: { canApprove: { type: Boolean, default: false } },
        subcontract: { canApprove: { type: Boolean, default: false } },
      },
      default: () => ({
        material: { canApprove: false },
        labour: { canApprove: false },
        attendance: { canApprove: false },
        site_expense: { canApprove: false },
        general_expense: { canApprove: false },
        payment: { canApprove: false },
        subcontract: { canApprove: false },
      }),
    },
  },
  { timestamps: true }
);

export const AccessTemplate = model<IAccessTemplate>("AccessTemplate", accessTemplateSchema);