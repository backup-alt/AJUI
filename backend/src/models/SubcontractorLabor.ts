import { Schema, model, Document, Types } from "mongoose";

export interface ISubcontractorLabor extends Document {
  _id: Types.ObjectId;
  subcontractorId: Types.ObjectId;
  workerId?: Types.ObjectId;
  // Optional project linkage. When set, the labour row is eligible to
  // appear in the matching project's worker roster (the web admin worker
  // table). When unset, the row is sub-contractor-scoped only — useful
  // for sub-contractors who manage their own labour independently of any
  // specific project. Stored as ObjectId + denormalised name for display.
  projectId?: Types.ObjectId;
  projectName?: string;
  name: string;
  address?: string;
  // Optional — site supervisors frequently roster labour without a
  // phone number (e.g. walk-in workers). The web admin's labour
  // drawer mirrors that permissiveness and the matching Zod schema
  // accepts an empty / missing value.
  phone?: string;
  role: string;
  notes?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subcontractorLaborSchema = new Schema<ISubcontractorLabor>(
  {
    subcontractorId: { type: Schema.Types.ObjectId, ref: "Subcontractor", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "Worker", index: true, sparse: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    projectName: { type: String, trim: true, maxlength: 200 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    address: { type: String, default: "", trim: true, maxlength: 500 },
    phone: { type: String, default: "", trim: true, maxlength: 40 },
    role: { type: String, required: true, trim: true, maxlength: 100 },
    notes: { type: String, default: "", trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

subcontractorLaborSchema.index({ subcontractorId: 1, name: 1 });

export const SubcontractorLabor = model<ISubcontractorLabor>("SubcontractorLabor", subcontractorLaborSchema);

