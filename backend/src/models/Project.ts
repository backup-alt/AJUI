import { Schema, model, Document, Types } from "mongoose";

export type ProjectStatus = "Active" | "On Hold" | "Completed";

export interface IProject extends Document {
  _id: Types.ObjectId;
  projectId: string;
  name: string;
  client: string;
  clientId: Types.ObjectId;
  mobile: string;
  address: string;
  supervisor: string;
  supervisorId?: Types.ObjectId;
  siteIds: Types.ObjectId[];
  siteNames: string[];
  status: ProjectStatus;
  startDate: string;
  totalValue: number;
  estimatedValue: number;
  advanceAmount: number;
  receivedAmount: number;
  totalExpenseReceived: number;
  pendingBalance: number;
  materialSpend: number;
  labourPayable: number;
  expenseBalance: number;
  completion: number;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    client: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    mobile: { type: String, required: true },
    address: { type: String, required: true },
    supervisor: { type: String, required: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: "Supervisor" },
    siteIds: [{ type: Schema.Types.ObjectId, ref: "Site" }],
    siteNames: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["Active", "On Hold", "Completed"],
      default: "Active",
      index: true,
    },
    startDate: { type: String, required: true },
    totalValue: { type: Number, default: 0 },
    estimatedValue: { type: Number, default: 0 },
    advanceAmount: { type: Number, default: 0 },
    receivedAmount: { type: Number, default: 0 },
    totalExpenseReceived: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    materialSpend: { type: Number, default: 0 },
    labourPayable: { type: Number, default: 0 },
    expenseBalance: { type: Number, default: 0 },
    completion: { type: Number, default: 0, min: 0, max: 100 },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

projectSchema.index({ name: "text", client: "text" });

projectSchema.pre("save", function (next) {
  this.lastActivityAt = new Date();
  if (this.totalValue > 0 && this.receivedAmount > 0) {
    this.pendingBalance = Math.max(0, this.totalValue - this.receivedAmount);
  }
  next();
});

export const Project = model<IProject>("Project", projectSchema);
