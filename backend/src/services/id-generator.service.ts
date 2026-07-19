import { Counter } from "../models/Counter.js";
import { Quotation } from "../models/Quotation.js";
import { Invoice } from "../models/Invoice.js";

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
  | "QUO"
  | "RPT"
  | "PO"
  | "WRK"
  | "ATT"
  | "INV";

export async function generateId(prefix: IdPrefix, padding = 3): Promise<string> {
  const result = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const seq = result?.seq ?? 1;

  const maxSuffix = await seedMaxFromCollection(prefix, seq);
  const effectiveSeq = maxSuffix > seq ? maxSuffix : seq;

  if (effectiveSeq > seq) {
    const updated = await Counter.findByIdAndUpdate(prefix, { $set: { seq: effectiveSeq } }, { new: true });
    return `${prefix}-${String(updated?.seq ?? effectiveSeq).padStart(padding, "0")}`;
  }

  return `${prefix}-${String(seq).padStart(padding, "0")}`;
}

async function seedMaxFromCollection(prefix: IdPrefix, currentSeq: number): Promise<number> {
  let Collection: any;
  let field: string;
  let regex: RegExp;

  if (prefix === "QUO") {
    Collection = Quotation;
    field = "quotationNumber";
    regex = /^QUO-(\d+)$/;
  } else if (prefix === "INV") {
    Collection = Invoice;
    field = "invoiceNumber";
    regex = /^INV-(\d+)$/;
  } else {
    return currentSeq;
  }

  try {
    const doc = await Collection
      .findOne({ [field]: regex }, { [field]: 1, _id: 0 })
      .sort({ [field]: -1 })
      .lean();
    if (!doc) return currentSeq;
    const match = (doc as any)[field]?.match(regex);
    if (!match) return currentSeq;
    const max = parseInt(match[1], 10);
    return isNaN(max) ? currentSeq : max;
  } catch {
    return currentSeq;
  }
}