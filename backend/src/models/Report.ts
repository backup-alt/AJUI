import { Schema, model, Document, Types } from "mongoose";

export type ReportCategory = "Financial" | "Labour" | "Material" | "Vendor" | "Subcontract" | "Project";
export type ReportSchedule = "On Demand" | "Daily" | "Weekly" | "Monthly";
export type ReportExportFormat = "Excel" | "PDF" | "CSV";
export type ReportScope = "All" | "Project" | "Client" | "Site";

export interface IReport extends Document {
  _id: Types.ObjectId;
  reportId: string;
  category: ReportCategory;
  reportName: string;
  scope: ReportScope;
  owner: string;
  exportFormat: ReportExportFormat;
  schedule: ReportSchedule;
  description?: string;
  lastGeneratedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    category: {
      type: String,
      enum: ["Financial", "Labour", "Material", "Vendor", "Subcontract", "Project"],
      required: true,
      index: true,
    },
    reportName: { type: String, required: true, trim: true },
    scope: { type: String, enum: ["All", "Project", "Client", "Site"], default: "All" },
    owner: { type: String, required: true },
    exportFormat: {
      type: String,
      enum: ["Excel", "PDF", "CSV"],
      default: "Excel",
    },
    schedule: {
      type: String,
      enum: ["On Demand", "Daily", "Weekly", "Monthly"],
      default: "On Demand",
    },
    description: { type: String },
    lastGeneratedAt: { type: Date },
  },
  { timestamps: true }
);

export const Report = model<IReport>("Report", reportSchema);
