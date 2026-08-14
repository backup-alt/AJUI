import { Schema, model, Document, Types } from "mongoose";

export interface IGstRate extends Document {
  _id: Types.ObjectId;
  rate: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const gstRateSchema = new Schema<IGstRate>(
  {
    rate: { type: Number, required: true, unique: true, min: 0, max: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const GstRate = model<IGstRate>("GstRate", gstRateSchema);

