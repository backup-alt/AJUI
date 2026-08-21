import { Schema, model, Document, Types } from "mongoose";

export interface IWorker extends Document {
  _id: Types.ObjectId;
  workerId: string;
  projectId: Types.ObjectId;
  projectName: string;
  clientId: Types.ObjectId;
  siteId?: Types.ObjectId;
  site?: string;
  name: string;
  address?: string;
  // Optional contact number — captured by the web admin worker form. Left
  // unset (rather than validated required) so the mobile supervisor app
  // can keep creating workers without it.
  phone?: string;
  // Free-form notes about the worker (skills, shift preference, ID docs, etc).
  notes?: string;
  labourType: string;
  weeklyPay: number;
  isSubcontract: boolean;
  subcontractorId?: Types.ObjectId;
  subcontractorName?: string;
  // For directly-hired (non-subcontract) workers, the supervisor
  // accountable for their attendance. Mutually exclusive with
  // subcontractorId — exactly one of the two is set on a given worker.
  supervisorId?: Types.ObjectId;
  supervisorName?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const workerSchema = new Schema<IWorker>(
  {
    workerId: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    projectName: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    site: { type: String },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true, maxlength: 32 },
    notes: { type: String, trim: true, maxlength: 1000 },
    labourType: { type: String, required: true, trim: true, index: true },
    weeklyPay: { type: Number, min: 0 },
    isSubcontract: { type: Boolean, default: false },
    subcontractorId: { type: Schema.Types.ObjectId, ref: "Subcontractor" },
    subcontractorName: { type: String, trim: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: "Supervisor" },
    supervisorName: { type: String, trim: true },
    createdBy: { type: String, required: true, index: true },
  },
  { timestamps: true, collection: "workers" }
);

workerSchema.index({ siteId: 1, labourType: 1 });
workerSchema.index({ projectId: 1, siteId: 1 });
workerSchema.index({ siteId: 1, createdAt: -1 });

export const Worker = model<IWorker>("Worker", workerSchema);
