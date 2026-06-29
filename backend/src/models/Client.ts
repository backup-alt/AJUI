import { Schema, model, Document, Types } from "mongoose";

export type ClientStatus = "Active" | "On Hold" | "Completed";

export interface IClient extends Document {
  _id: Types.ObjectId;
  clientId: string;
  name: string;
  initials: string;
  mobile: string;
  address: string;
  gstNumber?: string;
  status: ClientStatus;
  supervisor?: string;
  supervisorId?: Types.ObjectId;
  projectIds: string[];
  totalProjectValue: number;
  amountReceived: number;
  pendingBalance: number;
  activeSites: number;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClient>(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    initials: { type: String, default: "" },
    mobile: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    gstNumber: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Active", "On Hold", "Completed"],
      default: "Active",
      index: true,
    },
    supervisor: { type: String, trim: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: "Supervisor" },
    projectIds: { type: [String], default: [] },
    totalProjectValue: { type: Number, default: 0 },
    amountReceived: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    activeSites: { type: Number, default: 0 },
  },
  { timestamps: true }
);

clientSchema.index({ name: "text", mobile: "text" });

clientSchema.pre("save", function (next) {
  if (this.isModified("name") && !this.initials) {
    this.initials = this.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "AG";
  }
  next();
});

export const Client = model<IClient>("Client", clientSchema);
