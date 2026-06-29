import { Schema, model, Document, Types } from "mongoose";

export type PaymentMode = "Cash" | "Bank Transfer" | "Cheque" | "UPI" | "NEFT";
export type PaymentStatus = "Pending" | "Approved" | "Rejected";

export interface IPayment extends Document {
  _id: Types.ObjectId;
  paymentId: string;
  projectId: Types.ObjectId;
  projectName: string;
  clientId: Types.ObjectId;
  clientName: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  receiptNumber?: string;
  transactionReference?: string;
  collectedBy: string;
  status: PaymentStatus;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    projectName: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    clientName: { type: String, required: true },
    date: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    mode: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Cheque", "UPI", "NEFT"],
      required: true,
    },
    receiptNumber: { type: String, trim: true },
    transactionReference: { type: String, trim: true },
    collectedBy: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Payment = model<IPayment>("Payment", paymentSchema);
