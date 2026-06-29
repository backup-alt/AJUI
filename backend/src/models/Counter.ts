import { Schema, model } from "mongoose";

export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = model("Counter", counterSchema);

export async function getNextSequence(prefix: string, padding = 3): Promise<string> {
  const result = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `${prefix}-${String(result.seq).padStart(padding, "0")}`;
}
