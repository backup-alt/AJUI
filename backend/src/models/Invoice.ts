import { Schema, model, Document, Types } from "mongoose";

export type InvoiceStatus = "Draft" | "Sent" | "Paid";

export interface IInvoiceItem extends Document {
  description: string;
  hsnCode?: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
  isCustom?: boolean;
}

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  date: string;
  companyName: string;
  companyAddress: string;
  state: string;
  gstin: string;
  clientName: string;
  clientAddress: string;
  clientState: string;
  clientGstin: string;
  items: IInvoiceItem[];
  customColumns: string[];
  subtotal: number;
  cgstPercent: number;
  sgstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
  supplyType: "Intrastate" | "Interstate";
  status: InvoiceStatus;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
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

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    date: { type: String, default: "" },
    companyName: { type: String, default: "" },
    companyAddress: { type: String, default: "" },
    state: { type: String, default: "" },
    gstin: { type: String, default: "" },
    clientName: { type: String, default: "" },
    clientAddress: { type: String, default: "" },
    clientState: { type: String, default: "" },
    clientGstin: { type: String, default: "" },
    items: { type: [invoiceItemSchema], default: [] },
    customColumns: { type: [String], default: [] },
    subtotal: { type: Number, default: 0 },
    cgstPercent: { type: Number, default: 9 },
    sgstPercent: { type: Number, default: 9 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    amountInWords: { type: String, default: "" },
    supplyType: { type: String, enum: ["Intrastate", "Interstate"], default: "Intrastate" },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Paid"],
      default: "Draft",
      index: true,
    },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ invoiceNumber: "text", clientName: "text", companyName: "text" });

export const Invoice = model<IInvoice>("Invoice", invoiceSchema);