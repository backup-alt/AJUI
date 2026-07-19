import { Schema, model, Document, Types } from "mongoose";

export type QuotationStatus = "Draft" | "Sent" | "Accepted" | "Rejected";

export interface IQuotationItem extends Document {
  description: string;
  hsnCode?: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
  isCustom?: boolean;
}

export interface IQuotation extends Document {
  _id: Types.ObjectId;
  quotationNumber: string;
  date: string;
  companyName: string;
  companyAddress: string;
  state: string;
  gstin: string;
  clientName: string;
  clientAddress: string;
  clientState: string;
  clientGstin: string;
  items: IQuotationItem[];
  customColumns: string[];
  subtotal: number;
  cgstPercent: number;
  sgstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
  status: QuotationStatus;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const quotationItemSchema = new Schema<IQuotationItem>(
  {
    description: { type: String, required: true },
    hsnCode: { type: String, default: "" },
    unit: { type: String, default: "" },
    qty: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    isCustom: { type: Boolean, default: false },
  },
  { _id: false }
);

const quotationSchema = new Schema<IQuotation>(
  {
    quotationNumber: { type: String, required: true, unique: true, index: true },
    date: { type: String, default: "" },
    companyName: { type: String, default: "" },
    companyAddress: { type: String, default: "" },
    state: { type: String, default: "" },
    gstin: { type: String, default: "" },
    clientName: { type: String, default: "" },
    clientAddress: { type: String, default: "" },
    clientState: { type: String, default: "" },
    clientGstin: { type: String, default: "" },
    items: { type: [quotationItemSchema], default: [] },
    customColumns: { type: [String], default: [] },
    subtotal: { type: Number, default: 0 },
    cgstPercent: { type: Number, default: 0 },
    sgstPercent: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    amountInWords: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Accepted", "Rejected"],
      default: "Draft",
      index: true,
    },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

quotationSchema.index({ quotationNumber: "text", clientName: "text", companyName: "text" });

export const Quotation = model<IQuotation>("Quotation", quotationSchema);