import { Report } from "../models/Report.js";
import { generateId } from "../services/id-generator.service.js";

export async function seedDefaultReports(): Promise<void> {
  const defaultReports = [
    { category: "Financial", reportName: "Payment Collection Report" },
    { category: "Financial", reportName: "Expense Report" },
    { category: "Financial", reportName: "Supervisor Ledger" },
    { category: "Labour", reportName: "Attendance Report" },
    { category: "Labour", reportName: "Wage Report" },
    { category: "Labour", reportName: "Labour Ledger" },
    { category: "Material", reportName: "Purchase Report" },
    { category: "Material", reportName: "Consumption Report" },
    { category: "Material", reportName: "Inventory Report" },
    { category: "Vendor", reportName: "Vendor Performance Report" },
    { category: "Subcontract", reportName: "Subcontractor Ledger" },
    { category: "Project", reportName: "Project Summary" },
    { category: "Project", reportName: "Site Summary" },
  ] as const;

  for (const r of defaultReports) {
    const exists = await Report.findOne({ reportName: r.reportName });
    if (!exists) {
      const seq = await generateId("RPT");
      await Report.create({ reportId: seq, ...r, owner: "System" });
    }
  }
}
