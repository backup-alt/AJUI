import type {
  Client,
  Vendor,
  Supervisor,
  Subcontractor,
  ClientStatus,
} from "../data/erp-data.service";

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
    status: (c.status || "Active") as ClientStatus,
    projectIds: c.projectIds || [],
    supervisor: c.supervisor || "",
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
    remainingStock: m.remainingStock ?? Math.max(0, (m.purchasedQuantity ?? 0) - (m.consumedQuantity ?? 0)),
    vendor: m.vendor,
    vendorId: m.vendorId,
    poNumber: m.poNumber,
    requestDate: m.requestDate,
    approvalDate: m.approvalDate,
    status: m.status,
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
    receiptImage: e.receiptImage,
    receiptImageMimeType: e.receiptImageMimeType,
    receiptImageName: e.receiptImageName,
    runningBalance: e.runningBalance,
    date: e.date,
    description: e.description,
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
