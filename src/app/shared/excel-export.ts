import ExcelJS from "exceljs";
import type { Font } from "exceljs";

export interface ExportRow {
  id: string;
  description: string;
  hsnCode?: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
  parentRowId?: string | null;
  customValues?: Record<string, string>;
}

export interface ExportCompanyProfile {
  name: string;
  address: string;
  state: string;
  gstin: string;
}

export interface ExportClientInfo {
  name: string;
  address: string;
  state: string;
  gstin: string;
}

export interface ExportTotals {
  subtotal: number;
  cgstPercent: number;
  cgstAmount: number;
  sgstPercent: number;
  sgstAmount: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
}

export interface BuildExportArgs {
  documentTitle: "QUOTATION" | "TAX INVOICE";
  documentNumber: string;
  documentDate: string;
  company: ExportCompanyProfile;
  client: ExportClientInfo;
  items: ExportRow[];
  customColumns: string[];
  totals: ExportTotals;
  fileName: string;
}

/**
 * Shared XLSX builder for both Quotation and Tax Invoice exports.
 * Produces a real .xlsx workbook with professional formatting:
 *  - company header block
 *  - document meta (title, number, date)
 *  - "Bill To" client block
 *  - items table with parent-only S.No, sub-row indent, currency formatting
 *  - totals section (subtotal, CGST, SGST, round-off, grand total)
 *  - amount-in-words footer
 */
export async function buildBusinessDocumentXlsx(args: BuildExportArgs): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Annai Golden Builders";
  wb.created = new Date();

  const sheet = wb.addWorksheet(args.documentTitle, {
    views: [{ showGridLines: false }],
  });

  // Visual constants
  const HEADER_FILL = "FF1A4A8A"; // dark blue for document title (small accent)
  const TABLE_HEADER_FILL = "FFEAF1FB"; // light professional blue tint
  const TABLE_HEADER_TEXT = "FF002263"; // matches app's dark blue text
  const TOTAL_LABEL_FILL = "FFF1F5F9";
  const GRAND_TOTAL_FILL = "FFE2E8F0";
  const BORDER_COLOR = "FFCFDBE6";
  const SUBTLE_BORDER = "FFE2E8F0";

  const FONT_NAME = "Calibri";
  const baseFont: Partial<Font> = { name: FONT_NAME, size: 11 };

  // Column setup: width hints (auto-sized after writing). The first column
  // acts as the left margin label for header rows.
  const hasHsn = !!args.items.length && args.documentTitle === "TAX INVOICE";
  const baseCols: Array<{ header: string; width: number }> = hasHsn
    ? [
        { header: "S.No", width: 6 },
        { header: "Description", width: 38 },
        { header: "HSN Code", width: 12 },
        { header: "Unit", width: 8 },
        { header: "Qty", width: 8 },
        { header: "Rate", width: 14 },
        { header: "Amount", width: 14 },
      ]
    : [
        { header: "S.No", width: 6 },
        { header: "Description", width: 44 },
        { header: "Unit", width: 8 },
        { header: "Qty", width: 8 },
        { header: "Rate", width: 14 },
        { header: "Amount", width: 14 },
      ];
  args.customColumns.forEach((col) => baseCols.push({ header: col, width: 14 }));
  baseCols.forEach((c) => sheet.getColumn(baseCols.indexOf(c) + 1).width = c.width);

  const dataColCount = baseCols.length;
  const lastColLetter = sheet.getColumn(dataColCount).letter;

  // ─── Header block (company info) ────────────────────────────────────────
  sheet.mergeCells(`A1:${lastColLetter}1`);
  const companyNameCell = sheet.getCell("A1");
  companyNameCell.value = args.company.name || "Company Name";
  companyNameCell.font = { ...baseFont, bold: true, size: 16, color: { argb: "FF0F172A" } };
  companyNameCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(`A2:${lastColLetter}2`);
  const addrCell = sheet.getCell("A2");
  addrCell.value = args.company.address || "";
  addrCell.font = { ...baseFont, size: 10, color: { argb: "FF475569" } };
  addrCell.alignment = { vertical: "middle", horizontal: "left" };

  sheet.mergeCells(`A3:${lastColLetter}3`);
  const gstCell = sheet.getCell("A3");
  const stateGst = [args.company.state, args.company.gstin ? `GSTIN: ${args.company.gstin}` : ""]
    .filter(Boolean)
    .join(" | ");
  gstCell.value = stateGst;
  gstCell.font = { ...baseFont, size: 10, color: { argb: "FF1E293B" }, bold: true };
  gstCell.alignment = { vertical: "middle", horizontal: "left" };

  // ─── Document title + meta (right side) ───────────────────────────────
  // We render the document title as a separate styled block in columns C-D
  // for visual emphasis (looks like a professional letterhead).
  const titleCol = sheet.getColumn(dataColCount - 1).letter; // 2nd-to-last data col
  const lastDataCol = lastColLetter;
  sheet.mergeCells(`${titleCol}1:${lastDataCol}1`);
  const titleCell = sheet.getCell(`${titleCol}1`);
  titleCell.value = args.documentTitle;
  titleCell.font = { ...baseFont, bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.border = {
    top: { style: "thin", color: { argb: HEADER_FILL } },
    left: { style: "thin", color: { argb: HEADER_FILL } },
    right: { style: "thin", color: { argb: HEADER_FILL } },
    bottom: { style: "thin", color: { argb: HEADER_FILL } },
  };

  sheet.mergeCells(`${titleCol}2:${lastDataCol}2`);
  const numCell = sheet.getCell(`${titleCol}2`);
  numCell.value = `${args.documentTitle === "QUOTATION" ? "Quotation" : "Invoice"} #: ${args.documentNumber || "—"}`;
  numCell.font = { ...baseFont, size: 10, color: { argb: "FF1E293B" }, bold: true };
  numCell.alignment = { vertical: "middle", horizontal: "right" };

  sheet.mergeCells(`${titleCol}3:${lastDataCol}3`);
  const dateCell = sheet.getCell(`${titleCol}3`);
  dateCell.value = `Date: ${args.documentDate || "—"}`;
  dateCell.font = { ...baseFont, size: 10, color: { argb: "FF1E293B" } };
  dateCell.alignment = { vertical: "middle", horizontal: "right" };

  // ─── Spacer ──────────────────────────────────────────────────────────────
  sheet.addRow([]);

  // ─── Bill To section ───────────────────────────────────────────────────
  const billToStart = sheet.lastRow!.number + 1;
  sheet.mergeCells(`A${billToStart}:${lastColLetter}${billToStart}`);
  const billToLabel = sheet.getCell(`A${billToStart}`);
  billToLabel.value = "BILL TO";
  billToLabel.font = { ...baseFont, bold: true, size: 9, color: { argb: "FF64748B" } };
  billToLabel.alignment = { vertical: "middle", horizontal: "left" };
  billToLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };

  const clientNameRow = billToStart + 1;
  sheet.mergeCells(`A${clientNameRow}:${lastColLetter}${clientNameRow}`);
  const clientNameCell = sheet.getCell(`A${clientNameRow}`);
  clientNameCell.value = args.client.name || "—";
  clientNameCell.font = { ...baseFont, bold: true, size: 13, color: { argb: "FF0F172A" } };
  clientNameCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(clientNameRow).height = 22;

  const clientAddrRow = clientNameRow + 1;
  sheet.mergeCells(`A${clientAddrRow}:${lastColLetter}${clientAddrRow}`);
  const clientAddrCell = sheet.getCell(`A${clientAddrRow}`);
  clientAddrCell.value = args.client.address || "";
  clientAddrCell.font = { ...baseFont, size: 10, color: { argb: "FF475569" } };
  clientAddrCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  const clientStateRow = clientAddrRow + 1;
  sheet.mergeCells(`A${clientStateRow}:${lastColLetter}${clientStateRow}`);
  const clientStateCell = sheet.getCell(`A${clientStateRow}`);
  const clientStateGst = [
    args.client.state,
    args.client.gstin ? `GSTIN: ${args.client.gstin}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  clientStateCell.value = clientStateGst || "—";
  clientStateCell.font = { ...baseFont, size: 10, color: { argb: "FF1E293B" }, bold: true };
  clientStateCell.alignment = { vertical: "middle", horizontal: "left" };

  // ─── Spacer ──────────────────────────────────────────────────────────────
  sheet.addRow([]);

  // ─── Items table header ─────────────────────────────────────────────────
  const itemsHeaderRowNumber = sheet.lastRow!.number + 1;
  const headers = baseCols.map((c) => c.header);
  const itemsHeaderRow = sheet.getRow(itemsHeaderRowNumber);
  itemsHeaderRow.values = headers;
  itemsHeaderRow.height = 22;
  itemsHeaderRow.eachCell((cell) => {
    cell.font = { ...baseFont, bold: true, size: 10, color: { argb: TABLE_HEADER_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TABLE_HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER_COLOR } },
      bottom: { style: "medium", color: { argb: TABLE_HEADER_TEXT } },
      left: { style: "thin", color: { argb: BORDER_COLOR } },
      right: { style: "thin", color: { argb: BORDER_COLOR } },
    };
  });

  // ─── Items table body ───────────────────────────────────────────────────
  // Compute parent-only serial numbers (children skip).
  const parentSnoMap: Record<string, number> = {};
  let counter = 0;
  for (const row of args.items) {
    if (!row.parentRowId) counter += 1;
    parentSnoMap[row.id] = counter;
  }

  for (const row of args.items) {
    const values: Array<string | number> = [];
    values.push(row.parentRowId ? "" : parentSnoMap[row.id]); // S.No
    values.push(row.description || ""); // Description
    if (hasHsn) values.push(row.hsnCode || "");
    values.push(row.unit || "");
    values.push(Number(row.qty) || 0);
    values.push(Number(row.rate) || 0);
    values.push(Number(row.amount) || 0);
    // Custom column values
    for (const col of args.customColumns) {
      values.push((row.customValues && row.customValues[col]) || (row as any)[col] || "");
    }

    const excelRow = sheet.addRow(values);
    const isSub = !!row.parentRowId;
    const rowHeight = isSub ? 18 : 20;
    excelRow.height = rowHeight;

    for (let colIdx = 0; colIdx < values.length; colIdx++) {
      const cell = excelRow.getCell(colIdx + 1);
      cell.font = {
        ...baseFont,
        size: 11,
        italic: isSub,
        color: { argb: isSub ? "FF334155" : "FF0F172A" },
      };
      cell.border = {
        top: { style: "hair", color: { argb: SUBTLE_BORDER } },
        bottom: { style: "hair", color: { argb: SUBTLE_BORDER } },
        left: { style: "hair", color: { argb: SUBTLE_BORDER } },
        right: { style: "hair", color: { argb: SUBTLE_BORDER } },
      };

      // Column-specific formatting (header is at index 0)
      const headerName = baseCols[colIdx]?.header || "";
      if (headerName === "S.No") {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (headerName === "Description") {
        const prefix = isSub ? "    ↳ " : "";
        cell.value = `${prefix}${values[colIdx] || ""}`;
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        cell.indent = isSub ? 1 : 0;
      } else if (headerName === "HSN Code" || headerName === "Unit") {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (headerName === "Qty") {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "#,##0.##";
      } else if (headerName === "Rate" || headerName === "Amount") {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "#,##0.00";
      } else {
        // Custom columns: text left
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      }
    }
  }

  // ─── Spacer + totals ────────────────────────────────────────────────────
  sheet.addRow([]);

  const labelCols = dataColCount - 2;
  const amountColLetter = lastColLetter;
  const totals: Array<{ label: string; value: number; bold?: boolean; highlight?: boolean }> = [
    { label: "Sub Total", value: args.totals.subtotal, bold: true },
    { label: `Add: CGST @ ${args.totals.cgstPercent}%`, value: args.totals.cgstAmount },
    { label: `Add: SGST @ ${args.totals.sgstPercent}%`, value: args.totals.sgstAmount },
    { label: "Round Off", value: args.totals.roundOff },
    { label: "GRAND TOTAL (₹)", value: args.totals.totalAmount, bold: true, highlight: true },
  ];

  const labelEndColLetter = sheet.getColumn(labelCols).letter;
  const amountStartColLetter = sheet.getColumn(labelCols + 1).letter;

  for (const t of totals) {
    const rowNumber = sheet.lastRow!.number + 1;
    sheet.mergeCells(`A${rowNumber}:${labelEndColLetter}${rowNumber}`);
    sheet.mergeCells(`${amountStartColLetter}${rowNumber}:${amountColLetter}${rowNumber}`);

    const labelCell = sheet.getCell(`A${rowNumber}`);
    labelCell.value = t.label;
    labelCell.font = {
      ...baseFont,
      bold: !!t.bold,
      size: 11,
      color: { argb: t.highlight ? "FF0F172A" : "FF1E293B" },
    };
    labelCell.alignment = { vertical: "middle", horizontal: "right" };
    labelCell.fill = t.highlight
      ? { type: "pattern", pattern: "solid", fgColor: { argb: GRAND_TOTAL_FILL } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_LABEL_FILL } };
    labelCell.border = {
      top: { style: "thin", color: { argb: BORDER_COLOR } },
      bottom: { style: "thin", color: { argb: BORDER_COLOR } },
      left: { style: "thin", color: { argb: BORDER_COLOR } },
      right: { style: "thin", color: { argb: BORDER_COLOR } },
    };

    const amountCell = sheet.getCell(`${amountStartColLetter}${rowNumber}`);
    amountCell.value = t.value;
    amountCell.font = {
      ...baseFont,
      bold: !!t.bold,
      size: t.highlight ? 12 : 11,
      color: { argb: t.highlight ? "FF0F172A" : "FF1E293B" },
    };
    amountCell.alignment = { vertical: "middle", horizontal: "right" };
    amountCell.numFmt = "#,##0.00";
    amountCell.fill = t.highlight
      ? { type: "pattern", pattern: "solid", fgColor: { argb: GRAND_TOTAL_FILL } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_LABEL_FILL } };
    amountCell.border = {
      top: { style: "thin", color: { argb: BORDER_COLOR } },
      bottom: { style: "thin", color: { argb: BORDER_COLOR } },
      left: { style: "thin", color: { argb: BORDER_COLOR } },
      right: { style: "thin", color: { argb: BORDER_COLOR } },
    };

    sheet.getRow(rowNumber).height = t.highlight ? 24 : 20;
    sheet.addRow([]);
  }

  // ─── Amount in Words ───────────────────────────────────────────────────
  sheet.addRow([]);
  const aiwRowNumber = sheet.lastRow!.number + 1;
  sheet.mergeCells(`A${aiwRowNumber}:${amountColLetter}${aiwRowNumber}`);
  const aiwCell = sheet.getCell(`A${aiwRowNumber}`);
  aiwCell.value = `Amount in Words: ${args.totals.amountInWords || "—"}`;
  aiwCell.font = { ...baseFont, italic: true, size: 10, color: { argb: "FF475569" } };
  aiwCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
  sheet.getRow(aiwRowNumber).height = 30;

  // ─── Footer ────────────────────────────────────────────────────────────
  sheet.addRow([]);
  const footerRowNumber = sheet.lastRow!.number + 1;
  sheet.mergeCells(`A${footerRowNumber}:${amountColLetter}${footerRowNumber}`);
  const footerCell = sheet.getCell(`A${footerRowNumber}`);
  footerCell.value = `This is a computer-generated ${args.documentTitle.toLowerCase()} from Annai Golden Builders.`;
  footerCell.font = { ...baseFont, italic: true, size: 9, color: { argb: "FF94A3B8" } };
  footerCell.alignment = { vertical: "middle", horizontal: "center" };

  // ─── Print setup: A4 portrait, fit to one page wide ───────────────────
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
    horizontalCentered: false,
  };
  sheet.headerFooter.oddFooter = "&L&8Generated by AGB&CR&8Page &P of &N&R";

  // ─── Generate and download ─────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, args.fileName);
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revoke so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}