import { Injectable, inject, signal } from "@angular/core";
import { Observable, firstValueFrom } from "rxjs";
import { ApiService } from "./api.service";

export interface MaterialApprovalRow {
  rowId: string;
  module: "materials";
  field: "status" | "approvalStatus";
  client: string;
  project: string;
  site: string;
  materialName: string;
  unit: string;
  requestedQuantity: number;
  approvedQuantity: number;
  vendor: string;
  supervisor: string;
  requestDate: string;
  poNumber: string;
  status: string;
  sourceId: string;
}

export interface LabourApprovalRow {
  rowId: string;
  module: "labour";
  field: "status" | "approvalStatus";
  client: string;
  project: string;
  site: string;
  attendanceDate: string;
  staffName: string;
  labourTypes: string;
  staffCount: number;
  shift: string;
  overtime: string;
  lateFine: string;
  submittedBy: string;
  status: string;
  sourceId: string;
}

export interface ExpenseApprovalRow {
  rowId: string;
  module: "expenses";
  field: "status" | "approvalStatus";
  client: string;
  project: string;
  site: string;
  expenseDate: string;
  transactionType: string;
  description: string;
  amount: number;
  supervisor: string;
  reference: string;
  status: string;
  sourceId: string;
}

export interface GeneralExpenseApprovalRow {
  rowId: string;
  module: "generalExpenses";
  field: "status" | "approvalStatus";
  client: string;
  project: string;
  site: string;
  expenseDate: string;
  department: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
  reference: string;
  status: string;
  sourceId: string;
}

export interface PaymentApprovalRow {
  rowId: string;
  module: "payments";
  field: "status" | "approvalStatus";
  client: string;
  project: string;
  site: string;
  paymentDate: string;
  amount: number;
  mode: string;
  transactionReference: string;
  receiptNumber: string;
  collectedBy: string;
  status: string;
  sourceId: string;
}

export interface SubcontractApprovalRow {
  rowId: string;
  module: "subcontractors";
  field: "status" | "approvalStatus";
  client: string;
  project: string;
  site: string;
  subcontractorName: string;
  workPackage: string;
  contractValue: number;
  advancePaid: number;
  balance: number;
  supervisor: string;
  dueDate: string;
  paymentStatus: string;
  status: string;
  sourceId: string;
}

type AnyApprovalRow =
  | MaterialApprovalRow
  | LabourApprovalRow
  | ExpenseApprovalRow
  | GeneralExpenseApprovalRow
  | PaymentApprovalRow
  | SubcontractApprovalRow;

interface RawApprovalItem {
  _id: string;
  approvalId: string;
  type: string;
  title: string;
  projectId: string | null;
  projectName: string;
  site: string;
  amount: number;
  submittedAt: string;
  status: string;
  sourceCollection: string;
  sourceId: string;
  materialName?: string;
  unit?: string;
  requestedQuantity?: number;
  approvedQuantity?: number;
  vendor?: string;
  poNumber?: string;
  requestDate?: string;
  submittedBy?: string;
  clientName?: string;
  supervisorName?: string;
  attendanceDate?: string;
  staffName?: string;
  labourTypes?: string;
  staffCount?: number;
  dailyWage?: number;
  shift?: string;
  overtimeHours?: number;
  lateFine?: string;
  expenseDate?: string;
  transactionType?: string;
  description?: string;
  paidBy?: string;
  reference?: string;
}

@Injectable({ providedIn: "root" })
export class ApprovalsService {
  private api = inject(ApiService);

  async fetchApprovals(params: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<AnyApprovalRow[]> {
    const result = await firstValueFrom(
      this.api.listApprovals({ status: params.status ?? "Pending", limit: 100, ...params })
    );
    return (result.items || []).map((item: RawApprovalItem) =>
      this.mapToRow(item)
    );
  }

  approve(id: string) {
    return this.api.approveApproval(id);
  }

  reject(id: string) {
    return this.api.rejectApproval(id);
  }

  private mapToRow(a: RawApprovalItem): AnyApprovalRow {
    const base = {
      rowId: a.approvalId,
      client: "",
      project: a.projectName || "",
      site: a.site || "",
      status: a.status,
      sourceId: a.sourceId,
    };

    switch (a.type) {
      case "material":
        return {
          ...base,
          client: a.clientName || "",
          module: "materials" as const,
          materialName: a.materialName || a.title?.replace(/^Material:\s*/i, "") || "",
          unit: a.unit || "",
          requestedQuantity: a.requestedQuantity || 0,
          approvedQuantity: a.approvedQuantity || 0,
          vendor: a.vendor || "",
          supervisor: a.supervisorName || "",
          requestDate: a.requestDate || "",
          poNumber: a.poNumber || "",
        } as MaterialApprovalRow;

      case "labour":
        return {
          ...base,
          module: "labour" as const,
          attendanceDate: a.attendanceDate || "",
          staffName: a.staffName || "",
          labourTypes: a.labourTypes || "",
          staffCount: a.staffCount || 0,
          shift: a.shift || "",
          overtime: a.overtimeHours ? String(a.overtimeHours) : "0",
          lateFine: a.lateFine || "0",
          submittedBy: a.submittedBy || "",
        } as LabourApprovalRow;

      case "expense": {
        const isSiteExpense = a.sourceCollection === "Expense";
        if (isSiteExpense) {
          return {
            ...base,
            module: "expenses" as const,
            expenseDate: a.expenseDate || "",
            transactionType: a.transactionType || "",
            description: a.description || "",
            amount: a.amount || 0,
            supervisor: "",
            reference: a.reference || "",
          } as ExpenseApprovalRow;
        }
        return {
          ...base,
          module: "generalExpenses" as const,
          expenseDate: a.expenseDate || "",
          department: "",
          category: a.transactionType || "",
          description: a.description || "",
          amount: a.amount || 0,
          paidBy: a.paidBy || "",
          reference: a.reference || "",
        } as GeneralExpenseApprovalRow;
      }

      case "payment":
        return {
          ...base,
          module: "payments" as const,
          paymentDate: a.submittedAt,
          amount: a.amount || 0,
          mode: "",
          transactionReference: "",
          receiptNumber: "",
          collectedBy: "",
        } as PaymentApprovalRow;

      case "subcontract":
        return {
          ...base,
          module: "subcontractors" as const,
          subcontractorName: "",
          workPackage: "",
          contractValue: a.amount || 0,
          advancePaid: 0,
          balance: 0,
          supervisor: "",
          dueDate: "",
          paymentStatus: a.status,
        } as SubcontractApprovalRow;

      default:
        return {
          ...base,
          module: "materials" as const,
          materialName: a.title || "",
          unit: "",
          requestedQuantity: 0,
          approvedQuantity: 0,
          vendor: "",
          supervisor: "",
          requestDate: "",
          poNumber: "",
        } as MaterialApprovalRow;
    }
  }
}