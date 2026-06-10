import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { IonContent, IonSplitPane } from "@ionic/angular/standalone";
import type { Project } from "../../data/dashboardData";
import { ErpDataService, type SharedModuleKey, type SharedTableRow } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney } from "../shared/format";

type ApprovalField = "status" | "approvalStatus";

type ApprovalBaseRow = {
  rowId: string;
  module: SharedModuleKey;
  field: ApprovalField;
  client: string;
  project: string;
  site: string;
  status: string;
  sourceExpenseRowId?: string;
};

type MaterialApprovalRow = ApprovalBaseRow & {
  materialName: string;
  unit: string;
  requestedQuantity: string;
  approvedQuantity: string;
  vendor: string;
  supervisor: string;
  requestDate: string;
  poNumber: string;
};

type LabourApprovalRow = ApprovalBaseRow & {
  attendanceDate: string;
  staffName: string;
  labourTypes: string;
  staffCount: string;
  shift: string;
  overtime: string;
  lateFine: string;
  submittedBy: string;
};

type ExpenseApprovalRow = ApprovalBaseRow & {
  expenseDate: string;
  transactionType: string;
  description: string;
  amount: string;
  supervisor: string;
  reference: string;
};

type GeneralExpenseApprovalRow = ApprovalBaseRow & {
  expenseDate: string;
  department: string;
  category: string;
  description: string;
  amount: string;
  paidBy: string;
  reference: string;
};

type PaymentApprovalRow = ApprovalBaseRow & {
  paymentDate: string;
  amount: string;
  mode: string;
  transactionReference: string;
  receiptNumber: string;
  collectedBy: string;
};

type SubcontractApprovalRow = ApprovalBaseRow & {
  subcontractorName: string;
  workPackage: string;
  contractValue: string;
  advancePaid: string;
  balance: string;
  supervisor: string;
  dueDate: string;
  paymentStatus: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="approvals"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Pending Approvals"
          eyebrow="Approval Queue"
          metaLabel=""
          [showTitle]="false"
          searchPlaceholder="Search approvals..."
        />

        <ion-content class="erp-page">
          <main class="workspace-shell approvals-shell">
            <section class="approval-command-strip">
              <div>
                <span>Project Manager Review</span>
                <h1>Pending Approvals</h1>
                <p>Review each pending item with the project, site, requester, quantity, amount, and approval context visible before taking action.</p>
              </div>
              <div class="approval-summary-grid">
                <div><span>Pending Items</span><strong>{{ pendingTotal() }}</strong></div>
                <div><span>Clients</span><strong>{{ pendingClientCount() }}</strong></div>
                <div><span>Projects</span><strong>{{ pendingProjectCount() }}</strong></div>
              </div>
            </section>

            <div class="approvals-stack">
              <section class="operations-workbench approvals-workbench approval-section">
                <div class="module-toolbar table-first-toolbar">
                  <div>
                    <h2>Material Requests</h2>
                    <p>Approve requested material quantities with vendor and site context.</p>
                  </div>
                  <span class="approval-count-pill">{{ materialApprovals().length }} pending</span>
                </div>
                <div class="table-wrap operations-table approvals-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Project</th>
                        <th>Site</th>
                        <th>Material</th>
                        <th>Requested Qty</th>
                        <th>Approved Qty</th>
                        <th>Vendor</th>
                        <th>Supervisor</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of materialApprovals()">
                        <td>{{ row.client || "-" }}</td>
                        <td>{{ row.project || "-" }}</td>
                        <td>{{ row.site || "-" }}</td>
                        <td><strong>{{ row.materialName }}</strong><small class="approval-context">{{ row.poNumber || "PO pending" }}</small></td>
                        <td>{{ row.requestedQuantity }} {{ row.unit }}</td>
                        <td>
                          <input
                            class="approval-table-input"
                            inputmode="decimal"
                            [value]="row.approvedQuantity"
                            (input)="updateApprovalCell(row, 'approvedQuantity', $any($event.target).value)"
                            aria-label="Approved quantity"
                          />
                        </td>
                        <td>
                          <select class="approval-table-select" [value]="row.vendor" (change)="updateApprovalCell(row, 'vendor', $any($event.target).value)">
                            <option *ngFor="let vendor of vendorOptions(row.vendor)" [value]="vendor">{{ vendor }}</option>
                          </select>
                        </td>
                        <td>{{ row.supervisor || "-" }}</td>
                        <td>{{ row.requestDate || "-" }}</td>
                        <td><span class="approval-status-pill">{{ row.status }}</span></td>
                        <td class="approval-actions">
                          <button type="button" class="approve-action" (click)="approve(row)" aria-label="Approve material">
                            <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
                            Approve
                          </button>
                          <button type="button" class="decline-action" (click)="decline(row)" aria-label="Decline material">
                            <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m5.5 5.5 9 9" /><path d="m14.5 5.5-9 9" /></svg>
                            Decline
                          </button>
                        </td>
                      </tr>
                      <tr *ngIf="materialApprovals().length === 0"><td class="empty-row" colspan="11"><span>No pending material approvals.</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="operations-workbench approvals-workbench approval-section">
                <div class="module-toolbar table-first-toolbar">
                  <div>
                    <h2>Labour Attendance</h2>
                    <p>Review staff count, labour mix, shift, overtime, and site before approval.</p>
                  </div>
                  <span class="approval-count-pill">{{ labourApprovals().length }} pending</span>
                </div>
                <div class="table-wrap operations-table approvals-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Project</th>
                        <th>Site</th>
                        <th>Date</th>
                        <th>Staff Name</th>
                        <th>Labour Types</th>
                        <th>Staff Count</th>
                        <th>Shift</th>
                        <th>Overtime</th>
                        <th>Late Fine</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of labourApprovals()">
                        <td>{{ row.client || "-" }}</td>
                        <td>{{ row.project || "-" }}</td>
                        <td>{{ row.site || "-" }}</td>
                        <td>{{ row.attendanceDate || "-" }}</td>
                        <td><strong>{{ row.staffName || "-" }}</strong></td>
                        <td>{{ row.labourTypes || "-" }}</td>
                        <td>{{ row.staffCount || "-" }}</td>
                        <td>{{ row.shift || "-" }}</td>
                        <td>{{ row.overtime || "0" }}</td>
                        <td>{{ row.lateFine || "0" }}</td>
                        <td><span class="approval-status-pill">{{ row.status }}</span></td>
                        <td class="approval-actions">
                          <button type="button" class="approve-action" (click)="approve(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>Approve</button>
                          <button type="button" class="decline-action" (click)="decline(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m5.5 5.5 9 9" /><path d="m14.5 5.5-9 9" /></svg>Decline</button>
                        </td>
                      </tr>
                      <tr *ngIf="labourApprovals().length === 0"><td class="empty-row" colspan="12"><span>No pending labour approvals.</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="operations-workbench approvals-workbench approval-section">
                <div class="module-toolbar table-first-toolbar">
                  <div>
                    <h2>Site Expenses</h2>
                    <p>Approve project-linked expenses with site, transaction type, supervisor, and bill reference visible.</p>
                  </div>
                  <span class="approval-count-pill">{{ siteExpenseApprovals().length }} pending</span>
                </div>
                <div class="table-wrap operations-table approvals-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Project</th>
                        <th>Site</th>
                        <th>Date</th>
                        <th>Transaction Type</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Supervisor</th>
                        <th>Bill / Reference</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of siteExpenseApprovals()">
                        <td>{{ row.client || "-" }}</td>
                        <td>{{ row.project || "-" }}</td>
                        <td>{{ row.site || "-" }}</td>
                        <td>{{ row.expenseDate || "-" }}</td>
                        <td>{{ row.transactionType || "-" }}</td>
                        <td><strong>{{ row.description || "-" }}</strong></td>
                        <td>{{ row.amount || "-" }}</td>
                        <td>{{ row.supervisor || "-" }}</td>
                        <td>{{ row.reference || "-" }}</td>
                        <td><span class="approval-status-pill">{{ row.status }}</span></td>
                        <td class="approval-actions">
                          <button type="button" class="approve-action" (click)="approve(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>Approve</button>
                          <button type="button" class="decline-action" (click)="decline(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m5.5 5.5 9 9" /><path d="m14.5 5.5-9 9" /></svg>Decline</button>
                        </td>
                      </tr>
                      <tr *ngIf="siteExpenseApprovals().length === 0"><td class="empty-row" colspan="11"><span>No pending site expense approvals.</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="operations-workbench approvals-workbench approval-section">
                <div class="module-toolbar table-first-toolbar">
                  <div>
                    <h2>General Expenses</h2>
                    <p>Review office and company expenses separately from site ledgers.</p>
                  </div>
                  <span class="approval-count-pill">{{ generalExpenseApprovals().length }} pending</span>
                </div>
                <div class="table-wrap operations-table approvals-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Department</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Paid By</th>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of generalExpenseApprovals()">
                        <td>{{ row.expenseDate || "-" }}</td>
                        <td>{{ row.department || "-" }}</td>
                        <td>{{ row.category || "-" }}</td>
                        <td><strong>{{ row.description || "-" }}</strong></td>
                        <td>{{ row.amount || "-" }}</td>
                        <td>{{ row.paidBy || "-" }}</td>
                        <td>{{ row.reference || "-" }}</td>
                        <td><span class="approval-status-pill">{{ row.status }}</span></td>
                        <td class="approval-actions">
                          <button type="button" class="approve-action" (click)="approve(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>Approve</button>
                          <button type="button" class="decline-action" (click)="decline(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m5.5 5.5 9 9" /><path d="m14.5 5.5-9 9" /></svg>Decline</button>
                        </td>
                      </tr>
                      <tr *ngIf="generalExpenseApprovals().length === 0"><td class="empty-row" colspan="9"><span>No pending general expense approvals.</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="operations-workbench approvals-workbench approval-section">
                <div class="module-toolbar table-first-toolbar">
                  <div>
                    <h2>Payments</h2>
                    <p>Approve collections with receipt, reference, collector, and client project context.</p>
                  </div>
                  <span class="approval-count-pill">{{ paymentApprovals().length }} pending</span>
                </div>
                <div class="table-wrap operations-table approvals-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Project</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Transaction Ref</th>
                        <th>Receipt</th>
                        <th>Collected By</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of paymentApprovals()">
                        <td>{{ row.client || "-" }}</td>
                        <td>{{ row.project || "-" }}</td>
                        <td>{{ row.paymentDate || "-" }}</td>
                        <td>{{ row.amount || "-" }}</td>
                        <td>{{ row.mode || "-" }}</td>
                        <td>{{ row.transactionReference || "-" }}</td>
                        <td>{{ row.receiptNumber || "-" }}</td>
                        <td>{{ row.collectedBy || "-" }}</td>
                        <td><span class="approval-status-pill">{{ row.status }}</span></td>
                        <td class="approval-actions">
                          <button type="button" class="approve-action" (click)="approve(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>Approve</button>
                          <button type="button" class="decline-action" (click)="decline(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m5.5 5.5 9 9" /><path d="m14.5 5.5-9 9" /></svg>Decline</button>
                        </td>
                      </tr>
                      <tr *ngIf="paymentApprovals().length === 0"><td class="empty-row" colspan="10"><span>No pending payment approvals.</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="operations-workbench approvals-workbench approval-section">
                <div class="module-toolbar table-first-toolbar">
                  <div>
                    <h2>Subcontracts</h2>
                    <p>Review subcontractor work packages with contract, advance, balance, and supervisor context.</p>
                  </div>
                  <span class="approval-count-pill">{{ subcontractApprovals().length }} pending</span>
                </div>
                <div class="table-wrap operations-table approvals-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Project</th>
                        <th>Site</th>
                        <th>Subcontractor</th>
                        <th>Work Package</th>
                        <th>Contract</th>
                        <th>Advance</th>
                        <th>Balance</th>
                        <th>Supervisor</th>
                        <th>Due Date</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of subcontractApprovals()">
                        <td>{{ row.client || "-" }}</td>
                        <td>{{ row.project || "-" }}</td>
                        <td>{{ row.site || "-" }}</td>
                        <td><strong>{{ row.subcontractorName || "-" }}</strong></td>
                        <td>{{ row.workPackage || "-" }}</td>
                        <td>{{ row.contractValue || "-" }}</td>
                        <td>{{ row.advancePaid || "-" }}</td>
                        <td>{{ row.balance || "-" }}</td>
                        <td>{{ row.supervisor || "-" }}</td>
                        <td>{{ row.dueDate || "-" }}</td>
                        <td>{{ row.paymentStatus || "-" }}</td>
                        <td><span class="approval-status-pill">{{ row.status }}</span></td>
                        <td class="approval-actions">
                          <button type="button" class="approve-action" (click)="approve(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>Approve</button>
                          <button type="button" class="decline-action" (click)="decline(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m5.5 5.5 9 9" /><path d="m14.5 5.5-9 9" /></svg>Decline</button>
                        </td>
                      </tr>
                      <tr *ngIf="subcontractApprovals().length === 0"><td class="empty-row" colspan="13"><span>No pending subcontract approvals.</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </main>
        </ion-content>
      </div>
    </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingApprovalsPage {
  private readonly data = inject(ErpDataService);

  readonly materialApprovals = computed(() =>
    this.materialRows().filter((row) => this.isPending(row.status) && !(this.data.settings().singleApprovalForSiteExpenseMaterials && row.sourceExpenseRowId)),
  );
  readonly labourApprovals = computed(() => this.labourRows().filter((row) => this.isPending(row.status)));
  readonly siteExpenseApprovals = computed(() => this.siteExpenseRows().filter((row) => this.isPending(row.status)));
  readonly generalExpenseApprovals = computed(() => this.generalExpenseRows().filter((row) => this.isPending(row.status)));
  readonly paymentApprovals = computed(() => this.paymentRows().filter((row) => this.isPending(row.status)));
  readonly subcontractApprovals = computed(() => this.subcontractRows().filter((row) => this.isPending(row.status)));

  pendingTotal(): number {
    return this.allPendingRows().length;
  }

  pendingClientCount(): number {
    return new Set(this.allPendingRows().map((row) => row.client).filter(Boolean)).size;
  }

  pendingProjectCount(): number {
    return new Set(this.allPendingRows().map((row) => row.project).filter(Boolean)).size;
  }

  vendorOptions(currentVendor = ""): string[] {
    return this.sortedUnique([
      currentVendor,
      ...this.data.vendors().map((vendor) => vendor.name),
      ...this.data.materials().map((material) => material.vendor),
    ]);
  }

  updateApprovalCell(row: ApprovalBaseRow, key: string, value: string) {
    this.data.updateSharedRowCell(row.rowId, key, value);
  }

  approve(row: ApprovalBaseRow) {
    this.applyApproval(row, "Approved");
  }

  decline(row: ApprovalBaseRow) {
    this.applyApproval(row, "Declined");
  }

  private applyApproval(row: ApprovalBaseRow, status: "Approved" | "Declined") {
    this.data.updateSharedRowCell(row.rowId, row.field, status);
    if (!this.data.settings().singleApprovalForSiteExpenseMaterials) return;

    if (row.module === "materials" && row.sourceExpenseRowId) {
      this.data.updateSharedRowCell(row.sourceExpenseRowId, "approvalStatus", status);
      return;
    }

    if (row.module === "expenses") {
      const linkedMaterial = this.data
        .tableRowsFor("materials", [])
        .find((material) => String(material["sourceExpenseRowId"] || "") === row.rowId);
      const linkedMaterialId = String(linkedMaterial?.["__rowId"] || "");
      if (linkedMaterialId) this.data.updateSharedRowCell(linkedMaterialId, "status", status);
    }
  }

  private allPendingRows(): ApprovalBaseRow[] {
    return [
      ...this.materialApprovals(),
      ...this.labourApprovals(),
      ...this.siteExpenseApprovals(),
      ...this.generalExpenseApprovals(),
      ...this.paymentApprovals(),
      ...this.subcontractApprovals(),
    ];
  }

  private materialRows(): MaterialApprovalRow[] {
    const rows = this.data.materials().map((row) => {
      const project = this.projectById(row.projectId);
      return {
        __rowId: `material:${row.id}`,
        __projectId: row.projectId,
        client: project?.client ?? "",
        project: project?.name ?? row.projectId,
        projectId: row.projectId,
        site: row.site,
        materialName: row.name,
        unit: row.unit,
        requestedQuantity: String(row.requested),
        approvedQuantity: String(row.approved),
        requestDate: "2026-06-05",
        vendor: row.vendor,
        poNumber: row.poNumber,
        supervisor: project?.supervisor ?? "",
        status: row.status,
      };
    });
    return this.data.tableRowsFor("materials", rows).map((row) => {
      const project = this.projectForRow(row);
      return {
        rowId: String(row["__rowId"] || ""),
        module: "materials",
        field: "status",
        client: String(row["client"] || project?.client || ""),
        project: String(row["project"] || project?.name || row["projectId"] || row["__projectId"] || ""),
        site: String(row["site"] || ""),
        status: this.normalizeApprovalStatus(row["status"]),
        sourceExpenseRowId: String(row["sourceExpenseRowId"] || ""),
        materialName: String(row["materialName"] || row["name"] || "Material"),
        unit: String(row["unit"] || ""),
        requestedQuantity: String(row["requestedQuantity"] || ""),
        approvedQuantity: String(row["approvedQuantity"] || ""),
        vendor: String(row["vendor"] || ""),
        supervisor: String(row["supervisor"] || project?.supervisor || ""),
        requestDate: String(row["requestDate"] || row["date"] || ""),
        poNumber: String(row["poNumber"] || ""),
      };
    });
  }

  private labourRows(): LabourApprovalRow[] {
    const rows = this.data.labour().map((row) => {
      const project = this.projectById(row.projectId);
      return {
        __rowId: `labour:${row.id}`,
        __projectId: row.projectId,
        client: project?.client ?? "",
        project: project?.name ?? row.projectId,
        projectId: row.projectId,
        site: row.site,
        attendanceDate: "2026-06-05",
        staffName: row.party,
        labourTypes: row.notes || `${row.category}: ${row.presentCount}`,
        staffCount: String(row.presentCount),
        shift: "1",
        overtime: String(row.overtime),
        lateFine: formatMoney(row.lateFine),
        submittedBy: row.paymentMode,
        status: row.status,
      };
    });
    return this.data.tableRowsFor("labour", rows).map((row) => ({
      rowId: String(row["__rowId"] || ""),
      module: "labour",
      field: "status",
      client: String(row["client"] || ""),
      project: String(row["project"] || row["projectId"] || row["__projectId"] || ""),
      site: String(row["site"] || ""),
      status: this.normalizeApprovalStatus(row["status"]),
      attendanceDate: String(row["attendanceDate"] || row["date"] || ""),
      staffName: String(row["staffName"] || row["labourName"] || ""),
      labourTypes: String(row["labourTypes"] || row["notes"] || ""),
      staffCount: String(row["staffCount"] || row["presentUnits"] || ""),
      shift: String(row["shift"] || ""),
      overtime: String(row["overtime"] || ""),
      lateFine: String(row["lateFine"] || ""),
      submittedBy: String(row["submittedBy"] || row["paymentMode"] || ""),
    }));
  }

  private siteExpenseRows(): ExpenseApprovalRow[] {
    const rows = this.data
      .expenses()
      .filter((row) => row.type === "Site Expense")
      .map((row) => {
        const project = this.projectById(row.projectId);
        return {
          __rowId: `expense:${row.id}`,
          __projectId: row.projectId,
          client: project?.client ?? "",
          project: project?.name ?? row.projectId,
          projectId: row.projectId,
          site: row.site,
          expenseDate: row.date,
          transactionType: "Site Expense",
          description: row.description,
          amount: formatMoney(row.spent),
          supervisor: row.supervisor,
          reference: row.reference,
          approvalStatus: row.status,
        };
      });
    return this.data.tableRowsFor("expenses", rows).map((row) => ({
      rowId: String(row["__rowId"] || ""),
      module: "expenses",
      field: "approvalStatus",
      client: String(row["client"] || ""),
      project: String(row["project"] || row["projectId"] || row["__projectId"] || ""),
      site: String(row["site"] || ""),
      status: this.normalizeApprovalStatus(row["approvalStatus"] || row["status"]),
      expenseDate: String(row["expenseDate"] || row["date"] || ""),
      transactionType: String(row["transactionType"] || "Site Expense"),
      description: String(row["description"] || ""),
      amount: String(row["amount"] || ""),
      supervisor: String(row["supervisor"] || ""),
      reference: String(row["reference"] || ""),
    }));
  }

  private generalExpenseRows(): GeneralExpenseApprovalRow[] {
    const rows = this.data
      .expenses()
      .filter((row) => row.type === "General Expense")
      .map((row) => ({
        __rowId: `general-expense:${row.id}`,
        client: "Company",
        project: "Head Office",
        site: "Office",
        expenseDate: row.date,
        department: "Head Office",
        category: "Office",
        description: row.description,
        amount: formatMoney(row.spent),
        paidBy: row.supervisor,
        reference: row.reference,
        approvalStatus: row.status,
      }));
    return this.data.tableRowsFor("generalExpenses", rows).map((row) => ({
      rowId: String(row["__rowId"] || ""),
      module: "generalExpenses",
      field: "approvalStatus",
      client: String(row["client"] || "Company"),
      project: String(row["project"] || "Head Office"),
      site: String(row["site"] || "Office"),
      status: this.normalizeApprovalStatus(row["approvalStatus"] || row["status"]),
      expenseDate: String(row["expenseDate"] || row["date"] || ""),
      department: String(row["department"] || ""),
      category: String(row["category"] || ""),
      description: String(row["description"] || ""),
      amount: String(row["amount"] || ""),
      paidBy: String(row["paidBy"] || row["supervisor"] || ""),
      reference: String(row["reference"] || ""),
    }));
  }

  private paymentRows(): PaymentApprovalRow[] {
    const rows = this.data.payments().map((row) => {
      const project = this.projectById(row.projectId);
      return {
        __rowId: `payment:${row.id}`,
        __projectId: row.projectId,
        client: project?.client ?? "",
        project: project?.name ?? row.projectId,
        projectId: row.projectId,
        paymentDate: row.date,
        amount: formatMoney(row.amount),
        mode: row.mode,
        transactionReference: row.reference,
        receiptNumber: row.receipt,
        collectedBy: row.collectedBy,
        approvalStatus: row.status,
      };
    });
    return this.data.tableRowsFor("payments", rows).map((row) => ({
      rowId: String(row["__rowId"] || ""),
      module: "payments",
      field: "approvalStatus",
      client: String(row["client"] || ""),
      project: String(row["project"] || row["projectId"] || row["__projectId"] || ""),
      site: String(row["site"] || ""),
      status: this.normalizeApprovalStatus(row["approvalStatus"] || row["status"]),
      paymentDate: String(row["paymentDate"] || row["date"] || ""),
      amount: String(row["amount"] || ""),
      mode: String(row["mode"] || ""),
      transactionReference: String(row["transactionReference"] || row["reference"] || ""),
      receiptNumber: String(row["receiptNumber"] || row["receipt"] || ""),
      collectedBy: String(row["collectedBy"] || ""),
    }));
  }

  private subcontractRows(): SubcontractApprovalRow[] {
    const rows = this.data.subcontractors().map((row) => {
      const project = this.projectById(row.projectId);
      return {
        __rowId: `subcontractor:${row.id}`,
        __projectId: row.projectId,
        client: project?.client ?? "",
        project: project?.name ?? row.projectId,
        projectId: row.projectId,
        site: row.site,
        subcontractorName: row.name,
        workPackage: row.workPackage,
        contractValue: formatMoney(row.contractValue),
        advancePaid: formatMoney(row.advancePaid),
        balance: formatMoney(row.contractValue - row.advancePaid),
        supervisor: row.supervisor,
        dueDate: row.dueDate,
        approvalStatus: row.approvalStatus,
        paymentStatus: row.paymentStatus,
      };
    });
    return this.data.tableRowsFor("subcontractors", rows).map((row) => ({
      rowId: String(row["__rowId"] || ""),
      module: "subcontractors",
      field: "approvalStatus",
      client: String(row["client"] || ""),
      project: String(row["project"] || row["projectId"] || row["__projectId"] || ""),
      site: String(row["site"] || ""),
      status: this.normalizeApprovalStatus(row["approvalStatus"] || row["status"]),
      subcontractorName: String(row["subcontractorName"] || row["name"] || ""),
      workPackage: String(row["workPackage"] || ""),
      contractValue: String(row["contractValue"] || ""),
      advancePaid: String(row["advancePaid"] || ""),
      balance: String(row["balance"] || ""),
      supervisor: String(row["supervisor"] || ""),
      dueDate: String(row["dueDate"] || ""),
      paymentStatus: String(row["paymentStatus"] || ""),
    }));
  }

  private projectForRow(row: SharedTableRow): Project | undefined {
    const projectId = String(row["projectId"] || row["__projectId"] || "");
    return this.projectById(projectId) ?? this.data.projects().find((project) => project.name === row["project"]);
  }

  private projectById(projectId: string): Project | undefined {
    return this.data.projectById(projectId);
  }

  private isPending(value: string): boolean {
    return value.toLowerCase() === "pending";
  }

  private normalizeApprovalStatus(value: unknown): string {
    const normalized = String(value || "Pending").trim().toLowerCase();
    if (!normalized || normalized === "pending") return "Pending";
    if (normalized === "approve" || normalized === "approved") return "Approved";
    if (normalized === "decline" || normalized === "declined" || normalized === "rejected") return "Declined";
    return String(value);
  }

  private sortedUnique(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((first, second) => first.localeCompare(second));
  }
}
