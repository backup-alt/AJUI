import { Schema, model, Document, Types } from "mongoose";

export interface ISubcontractorLabor extends Document {
  _id: Types.ObjectId;
  subcontractorId: Types.ObjectId;
  name: string;
  address?: string;
  phone: string;
  role: string;
  notes?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subcontractorLaborSchema = new Schema<ISubcontractorLabor>(
  {
    subcontractorId: { type: Schema.Types.ObjectId, ref: "Subcontractor", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    address: { type: String, default: "", trim: true, maxlength: 500 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    role: { type: String, required: true, trim: true, maxlength: 100 },
    notes: { type: String, default: "", trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

subcontractorLaborSchema.index({ subcontractorId: 1, name: 1 });

export const SubcontractorLabor = model<ISubcontractorLabor>("SubcontractorLabor", subcontractorLaborSchema);

