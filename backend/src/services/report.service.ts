import { Types } from "mongoose";
import { Report, IReport, ReportCategory, ReportScope } from "../models/Report.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";

export interface CreateReportInput {
  category: ReportCategory;
  reportName: string;
  scope?: ReportScope;
  owner: string;
  exportFormat?: "Excel" | "PDF" | "CSV";
  schedule?: "On Demand" | "Daily" | "Weekly" | "Monthly";
  description?: string;
}

export async function createReport(input: CreateReportInput): Promise<IReport> {
  const reportId = await generateId("RPT");
  const report = await Report.create({
    reportId,
    category: input.category,
    reportName: input.reportName,
    scope: input.scope || "All",
    owner: input.owner,
    exportFormat: input.exportFormat || "Excel",
    schedule: input.schedule || "On Demand",
    description: input.description,
  });
  return report.toObject();
}

export async function listReports(filter: { category?: ReportCategory; page: number; limit: number }) {
  const query: Record<string, unknown> = {};
  if (filter.category) query.category = filter.category;

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Report.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Report.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function getReportById(id: string): Promise<IReport> {
  const report = await Report.findOne({ reportId: id }).lean<IReport | null>();
  if (!report) throw new AppError(404, "Report not found");
  return report;
}

export async function updateReport(id: string, patch: Partial<CreateReportInput>): Promise<IReport> {
  const report = await Report.findOneAndUpdate({ reportId: id }, patch, { new: true });
  if (!report) throw new AppError(404, "Report not found");
  return report.toObject();
}

export async function deleteReport(id: string): Promise<void> {
  const result = await Report.deleteOne({ reportId: id });
  if (result.deletedCount === 0) throw new AppError(404, "Report not found");
}

export async function generateReport(id: string): Promise<{
  reportId: string;
  generatedAt: Date;
  format: string;
  rowCount: number;
  preview: Record<string, unknown>;
}> {
  const report = await Report.findOne({ reportId: id });
  if (!report) throw new AppError(404, "Report not found");

  let rowCount = 0;
  let preview: Record<string, unknown> = {};

  switch (report.category) {
    case "Financial":
      preview = { note: "Financial summary will be generated here", generatedFor: report.reportName };
      rowCount = 0;
      break;
    case "Labour":
      preview = { note: "Labour summary will be generated here" };
      rowCount = 0;
      break;
    case "Material":
      preview = { note: "Material usage report will be generated here" };
      rowCount = 0;
      break;
    case "Vendor":
      preview = { note: "Vendor purchase history will be generated here" };
      rowCount = 0;
      break;
    case "Subcontract":
      preview = { note: "Subcontract work report will be generated here" };
      rowCount = 0;
      break;
    case "Project":
      preview = { note: "Project progress report will be generated here" };
      rowCount = 0;
      break;
  }

  report.lastGeneratedAt = new Date();
  await report.save();

  return {
    reportId: report.reportId,
    generatedAt: report.lastGeneratedAt,
    format: report.exportFormat,
    rowCount,
    preview,
  };
}
