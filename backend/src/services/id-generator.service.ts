import { Counter } from "../models/Counter.js";

export type IdPrefix =
  | "CLI"
  | "SITE"
  | "AB"
  | "MAT"
  | "LAB"
  | "EXP"
  | "PAY"
  | "VEN"
  | "SUP"
  | "SUB"
  | "APR"
  | "RPT"
  | "PO"
  | "QUO"
  | "WRK"
  | "ATT";

export async function generateId(prefix: IdPrefix, padding = 3): Promise<string> {
  const result = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const seq = result?.seq ?? 1;
  return `${prefix}-${String(seq).padStart(padding, "0")}`;
}
