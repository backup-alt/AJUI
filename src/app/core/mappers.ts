import type {
  Client,
  Vendor,
  Supervisor,
  Subcontractor,
  ClientStatus,
} from "../data/erp-data.service";
import type { TaxInvoice, TaxInvoiceRow } from "../../data/dashboardData";
import { environment } from "../../environments/environment";

function billUrlFor(row: any): string | undefined {
  if (row?.pcloudFileId) {
    return `${environment.apiUrl}/media/pcloud/${encodeURIComponent(String(row.pcloudFileId))}`;
  }
  return row?.billUrl || (row?.receiptImage
    ? `data:${row.receiptImageMimeType || 'image/jpeg'};base64,${row.receiptImage}`
    : undefined);
}

/**
 * Mappers from backend API response shapes (Mongoose documents) to
 * frontend TypeScript types (used by templates + ErpDataService signals).
 *
 * Backend returns IDs like "CLI-001", "AB-1024", "SITE-001", "MAT-450"
 * Frontend uses these same strings as `id` in templates (URLs use them).
 */

export function mapClient(c: any): Client {
  return {
    _id: c._id,
    id: c.clientId,
    initials: c.initials || getInitials(c.name),
    name: c.name,
    mobile: c.mobile,
    address: c.address,
    gstNumber: c.gstNumber || "",
    status: (c.status || "Active") as ClientStatus,
    projectIds: c.projectIds || [],
    supervisor: c.supervisor || "",
    customFields: c.customFields || {},
  };
}

export function mapProject(p: any): any {
  return {
    projectId: p.projectId,
    id: p._id || p.id,
    name: p.name,
    client: p.client,
    clientId: p.clientId,
    mobile: p.mobile,
    address: p.address,
    supervisor: p.supervisor,
    supervisorId: p.supervisorId,
    sites: p.siteNames || p.sites || [],
    siteIds: p.siteIds || [],
    siteNames: p.siteNames || [],
    status: p.status,
    startDate: p.startDate,
    totalValue: p.totalValue,
    estimatedValue: p.estimatedValue,
    advanceAmount: p.advanceAmount,
    receivedAmount: p.receivedAmount,
    pendingBalance: p.pendingBalance,
    materialSpend: p.materialSpend,
    labourPayable: p.labourPayable,
    expenseBalance: p.expenseBalance,
    completion: p.completion,
  };
}

export function mapSite(s: any): any {
  return {
    _id: s._id,
    id: s._id || s.id,
    siteId: s.siteId,
    name: s.name,
    status: s.status,
    supervisor: s.supervisor,
    startDate: s.startDate,
    targetEndDate: s.targetEndDate,
    projectIds: s.projectIds || [],
  };
}

export function mapVendor(v: any): Vendor {
  return {
    _id: v._id,
    id: v.vendorId,
    name: v.name,
    materialType: v.materialType,
    phone: v.phone,
    address: v.address,
    gst: v.gstNumber || "",
    status: v.status === "Not Active" ? "Not Active" : "Active",
    siteIds: Array.isArray(v.siteIds) ? v.siteIds.map((id: any) => String(id)) : [],
    customFields: v.customFields || {},
  };
}

export function mapSupervisor(s: any): Supervisor {
  return {
    _id: s._id,
    id: s.supervisorId,
    name: s.name,
    phone: s.phone,
    role: s.role || "Site Supervisor",
    assignedProject: s.assignedProject || "",
    assignedSite: s.assignedSite || "",
    cashLimit: s.cashLimit || 0,
    activeAdvances: s.activeAdvances || 0,
    approvalAuthority: typeof s.approvalAuthority === "number"
      ? `₹${s.approvalAuthority}`
      : s.approvalAuthority || "₹0",
    status: s.status || "Active",
  };
}

export function mapMaterial(m: any): any {
  const remainingStock = m.remainingStock ?? Math.max(0, (m.purchasedQuantity ?? 0) - (m.consumedQuantity ?? 0));
  return {
    _id: m._id,
    id: m.materialId,
    materialId: m.materialId,
    projectId: m.projectId,
    projectName: m.projectName,
    clientId: m.clientId,
    clientName: m.clientName,
    siteId: m.siteId,
    site: m.site,
    name: m.name,
    unit: m.unit,
    requested: m.requestedQuantity ?? 0,
    approved: m.approvedQuantity ?? 0,
    purchased: m.purchasedQuantity ?? 0,
    consumed: m.consumedQuantity ?? 0,
    quantity: m.approvedQuantity ?? remainingStock,
    remainingStock,
    vendor: m.vendor,
    vendorId: m.vendorId,
    poNumber: m.poNumber,
    billUrl: billUrlFor(m),
    issuedAmount: m.issuedAmount,
    givenAmount: m.givenAmount,
    requestDate: m.requestDate,
    approvalDate: m.approvalDate,
    notes: m.notes || "",
    status: m.status,
    customFields: m.customFields || {},
  };
}

export function mapLabour(l: any): any {
  return {
    _id: l._id,
    id: l.labourId,
    labourId: l.labourId,
    projectId: l.projectId,
    projectName: l.projectName,
    clientId: l.clientId,
    siteId: l.siteId,
    site: l.site,
    partyName: l.partyName,
    category: l.category,
    attendanceDate: l.attendanceDate,
    presentCount: l.presentCount,
    presentDays: l.presentDays,
    absentDays: l.absentDays,
    dailyWage: l.dailyWage,
    overtime: l.overtime,
    lateFine: l.lateFine,
    shift: l.shift,
    paymentMode: l.paymentMode,
    wagePeriod: l.wagePeriod,
    laborTypes: l.laborTypes || [],
    notes: l.notes,
    status: l.status,
    supervisorName: l.supervisorName || "",
    customFields: l.customFields || {},
  };
}

export function mapExpense(e: any): any {
  const amount = Number(e.amount) || 0;
  const uiType: "Site Expense" | "General Expense" =
    e.type === "site" ? "Site Expense" : "General Expense";
  const isCashAdded = e.transactionType === "Cash Added";
  return {
    _id: e._id,
    id: e.expenseId,
    expenseId: e.expenseId,
    type: uiType,
    rawType: e.type,
    projectId: e.projectId,
    projectName: e.projectName,
    clientId: e.clientId,
    siteId: e.siteId,
    site: e.site,
    supervisor: e.supervisor,
    transactionType: e.transactionType,
    amount,
    spent: amount,
    cashIssued: isCashAdded ? amount : 0,
    received: 0,
    openingBalance: isCashAdded ? (Number(e.runningBalance) || amount) : 0,
    siteMaterialBalance: e.siteMaterialBalance,
    poNumber: e.poNumber,
    billUrl: billUrlFor(e),
    receiptImage: e.receiptImage,
    receiptImageMimeType: e.receiptImageMimeType,
    receiptImageName: e.receiptImageName,
    runningBalance: e.runningBalance,
    date: e.date,
    description: e.description,
    notes: e.notes || "",
    status: e.status,
    isSiteMaterial: e.isSiteMaterial,
    materialName: e.materialName,
    materialUnit: e.materialUnit,
    materialQuantity: e.materialQuantity,
    materialVendor: e.materialVendor,
    materialRemainingStock: e.materialRemainingStock,
    submittedBy: e.submittedBy,
    approvedBy: e.approvedBy,
    approvedAt: e.approvedAt,
    customFields: e.customFields || {},
  };
}

export function mapPayment(p: any): any {
  return {
    _id: p._id,
    id: p.paymentId,
    paymentId: p.paymentId,
    projectId: p.projectId,
    projectName: p.projectName,
    clientId: p.clientId,
    clientName: p.clientName,
    date: p.date,
    amount: p.amount,
    mode: p.mode,
    receiptNumber: p.receiptNumber,
    transactionReference: p.transactionReference,
    collectedBy: p.collectedBy,
    status: p.status,
    customFields: p.customFields || {},
  };
}

export function mapSubcontractor(s: any): Subcontractor {
  return {
    _id: s._id,
    id: s.subcontractId,
    projectId: s.projectName || "",
    site: s.site || "",
    name: s.subcontractorName,
    workPackage: s.workPackage,
    contractValue: s.contractValue,
    advancePaid: s.advancePaid,
    startDate: s.startDate,
    dueDate: s.dueDate,
    supervisor: s.supervisor,
    approvalStatus: s.approvalStatus || "Pending",
    paymentStatus: s.paymentStatus || "Not Started",
    customFields: s.customFields || {},
  };
}

export function mapInvoice(i: any): TaxInvoice {
  return {
    id: i._id,
    invoiceNumber: i.invoiceNumber,
    date: i.date,
    companyName: i.companyName || "",
    companyAddress: i.companyAddress || "",
    state: i.state || "",
    gstin: i.gstin || "",
    clientId: i.clientId || "",
    clientName: i.clientName || "",
    clientAddress: i.clientAddress || "",
    clientState: i.clientState || "",
    clientGstin: i.clientGstin || "",
    items: (i.items || []).map((it: any, idx: number): TaxInvoiceRow => ({
      id: String(idx),
      sno: it.sno ?? idx + 1,
      description: it.description || "",
      hsnCode: it.hsnCode || "",
      unit: it.unit || "",
      qty: it.qty ?? 0,
      rate: it.rate ?? 0,
      amount: it.amount ?? 0,
      isCustom: it.isCustom ?? false,
    })),
    customColumns: i.customColumns || [],
    subtotal: i.subtotal ?? 0,
    cgstPercent: i.cgstPercent ?? 9,
    sgstPercent: i.sgstPercent ?? 9,
    cgstAmount: i.cgstAmount ?? 0,
    sgstAmount: i.sgstAmount ?? 0,
    roundOff: i.roundOff ?? 0,
    totalAmount: i.totalAmount ?? 0,
    amountInWords: i.amountInWords || "",
    supplyType: i.supplyType || "Intrastate",
    status: (i.status as TaxInvoice["status"]) || "Draft",
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "AG";
}

export function mapInventory(i: any): any {
  return {
    _id: i._id,
    id: i._id || `${i.projectId}-${i.siteKey || (i.siteId ? i.siteId.toString() : (i.site || ""))}-${i.normalizedName || (i.name || "").toLowerCase()}`,
    projectId: i.projectId,
    projectName: i.projectName,
    clientId: i.clientId,
    siteId: i.siteId,
    site: i.site,
    siteKey: i.siteKey,
    name: i.name,
    normalizedName: i.normalizedName,
    unit: i.unit,
    normalizedUnit: i.normalizedUnit,
    requestedQuantity: i.requestedQuantity ?? 0,
    approvedQuantity: i.approvedQuantity ?? 0,
    purchasedQuantity: i.purchasedQuantity ?? 0,
    consumedQuantity: i.consumedQuantity ?? 0,
    remainingStock: i.remainingStock ?? 0,
    quantity: i.remainingStock ?? i.purchasedQuantity ?? 0,
    minimumQuantity: i.minimumQuantity ?? 0,
    vendor: i.vendor,
    poNumber: i.poNumber,
    billUrl: billUrlFor(i),
    purchaseHistory: i.purchaseHistory || [],
    requestDate: i.updatedAt || i.createdAt || "",
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    customFields: i.customFields || {},
  };
}
