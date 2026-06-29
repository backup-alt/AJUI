import { Schema, model, Document, Types } from "mongoose";

export type SiteStatus = "Active" | "On Hold" | "Completed";

export interface ISite extends Document {
  _id: Types.ObjectId;
  siteId: string;
  name: string;
  status: SiteStatus;
  supervisor?: string;
  supervisorId?: Types.ObjectId;
  startDate?: string;
  targetEndDate?: string;
  projectIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const siteSchema = new Schema<ISite>(
  {
    siteId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Active", "On Hold", "Completed"],
      default: "Active",
    },
    supervisor: { type: String, trim: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: "Supervisor" },
    startDate: { type: String },
    targetEndDate: { type: String },
    projectIds: [{ type: Schema.Types.ObjectId, ref: "Project" }],
  },
  { timestamps: true }
);

siteSchema.index({ name: 1 });

export const Site = model<ISite>("Site", siteSchema);
