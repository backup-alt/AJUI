import { Schema, model, Document, Types } from "mongoose";

export type CustomFieldEntityType =
  | "clients"
  | "projects"
  | "materials"
  | "labour"
  | "expenses"
  | "payments"
  | "vendors"
  | "subcontractors";

export type CustomFieldType = "text" | "number" | "date" | "boolean";

export interface ICustomField extends Document {
  _id: Types.ObjectId;
  entityType: CustomFieldEntityType;
  entityId: Types.ObjectId;
  key: string;
  label: string;
  value: string | number | boolean | null;
  fieldType: CustomFieldType;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const customFieldSchema = new Schema<ICustomField>(
  {
    entityType: {
      type: String,
      required: true,
      enum: [
        "clients",
        "projects",
        "materials",
        "labour",
        "expenses",
        "payments",
        "vendors",
        "subcontractors",
      ],
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: Schema.Types.Mixed, default: null },
    fieldType: {
      type: String,
      enum: ["text", "number", "date", "boolean"],
      default: "text",
    },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

customFieldSchema.index({ entityType: 1, entityId: 1, order: 1 });
customFieldSchema.index({ entityType: 1, entityId: 1, key: 1 }, { unique: true });

export const CustomField = model<ICustomField>("CustomField", customFieldSchema);
