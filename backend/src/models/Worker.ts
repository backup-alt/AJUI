import { Schema, model, Document, Types } from "mongoose";

export interface IWorker extends Document {
  _id: Types.ObjectId;
  workerId: string;
  projectId: Types.ObjectId;
  projectName: string;
  clientId: Types.ObjectId;
  siteId?: Types.ObjectId;
  site: string;
  name: string;
  address?: string;
  labourType: string;
  weeklyPay: number;
  isSubcontract: boolean;
  subcontractorId?: Types.ObjectId;
  subcontractorName?: string;
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
    site: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    labourType: { type: String, required: true, trim: true, index: true },
    weeklyPay: { type: Number, required: true, min: 0 },
    isSubcontract: { type: Boolean, default: false },
    subcontractorId: { type: Schema.Types.ObjectId, ref: "Subcontractor" },
    subcontractorName: { type: String, trim: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

workerSchema.index({ siteId: 1, labourType: 1 });

export const Worker = model<IWorker>("Worker", workerSchema);