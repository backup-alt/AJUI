import { Schema, model, Document } from "mongoose";

export interface IAccessSchedule extends Document {
  enabled: boolean;
  windows: Array<{
    id: string;
    startTime: string;
    endTime: string;
    days: string[];
    appliesTo: string[];
    note?: string;
    isActive: boolean;
    createdAt: Date;
    createdBy: string;
  }>;
  updatedAt: Date;
}

const accessScheduleSchema = new Schema<IAccessSchedule>(
  {
    enabled: { type: Boolean, default: false },
    windows: [{
      id: { type: String, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      days: [{ type: String }],
      appliesTo: [{ type: String }],
      note: { type: String },
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now },
      createdBy: { type: String },
    }],
  },
  { timestamps: true }
);

export const AccessSchedule = model<IAccessSchedule>("AccessSchedule", accessScheduleSchema);