import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from "@angular/core";
import { IonContent, IonSplitPane } from "@ionic/angular/standalone";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";
import { ErpDataService, type SharedModuleKey } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { ApprovalsService } from "../core/approvals.service";
import { MaterialsService } from "../core/materials.service";
import { ApiService } from "../core/api.service";
import { mapExpense } from "../core/mappers";

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
  requestedQuantity: number;
  approvedQuantity: number;
  vendor: string;
  supervisor: string;
  requestDate: string;
  poNumber: string;
  issuedAmount?: number;
  givenAmount?: number;
  sourceId?: string;
};

type LabourApprovalRow = ApprovalBaseRow & {
  attendanceDate: string;
  staffName: string;
  labourTypes: string;
  staffCount: number;
  shift: string;
  overtime: string;
  lateFine: string;
  submittedBy: string;
};

type ExpenseApprovalRow = ApprovalBaseRow & {
  expenseDate: string;
  transactionType: string;
  description: string;
  amount: number;
  supervisor: string;
  reference: string;
  sourceId: string;
  isSiteMaterial?: boolean;
  materialName?: string;
  materialUnit?: string;
  materialQuantity?: number;
  materialVendor?: string;
  issuedAmount?: number;
  givenAmount?: number;
  billUrl?: string;
  poNumber?: string;
};

type SubcontractApprovalRow = ApprovalBaseRow & {
  subcontractorName: string;
  workPackage: string;
  contractValue: number;
  advancePaid: number;
  balance: number;
  supervisor: string;
  dueDate: string;
  paymentStatus: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, FormsModule],
  styles: [`
    .image-preview-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .image-preview-overlay img {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    }
    .image-preview-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: #fff;
      font-size: 28px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image-preview-close:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  `],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="approvals"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Pending Approvals"
          eyebrow="Approval Queue"
          metaLabel=""
          [showTitle]="false"
          searchPlaceholder="Search"
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
              @if (showMaterial()) {
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
                        <th>Issued Amt</th>
                        <th>Given Amt</th>
                        <th>PO Number</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of materialApprovals()">
                        <td>{{ row.client || "-" }}</td>
                        <td>{{ row.project || "-" }}</td>
                        <td>{{ row.site || "-" }}</td>
                        <td><strong>{{ row.materialName }}</strong></td>
                        <td>{{ row.requestedQuantity }} {{ row.unit }}</td>
                        <td>
                          <input
                            class="approval-table-input"
                            inputmode="decimal"
                            type="number"
                            [(ngModel)]="row.approvedQuantity"
                            aria-label="Approved quantity"
                            min="0"
                          />
                        </td>
                        <td>
                          <select class="approval-table-select" [(ngModel)]="row.vendor">
                            <option *ngFor="let vendor of vendorOptions(row.vendor)" [value]="vendor">{{ vendor }}</option>
                          </select>
                        </td>
                        <td>{{ row.supervisor || "-" }}</td>
                        <td>{{ row.requestDate || "-" }}</td>
                        <td>
                          <input
                            class="approval-table-input"
                            inputmode="decimal"
                            type="number"
                            [(ngModel)]="row.issuedAmount"
                            aria-label="Issued amount"
                            min="0"
                          />
                        </td>
                        <td>
                          <input
                            class="approval-table-input"
                            inputmode="decimal"
                            type="number"
                            [(ngModel)]="row.givenAmount"
                            aria-label="Given amount"
                            min="0"
                          />
                        </td>
                        <td>
                          <input
                            class="approval-table-input"
                            type="text"
                            [(ngModel)]="row.poNumber"
                            aria-label="PO Number"
                            placeholder="Auto-generate"
                          />
                        </td>
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
              }

              

              @if (showSiteExpense()) {
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
                        <th>Issued Amt</th>
                        <th>Given Amt</th>
                        <th>PO Number</th>
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
                        <td>
                          <input
                            class="approval-table-input"
                            inputmode="decimal"
                            type="number"
                            [(ngModel)]="row.issuedAmount"
                            aria-label="Issued amount"
                            min="0"
                          />
                        </td>
                        <td>
                          <input
                            class="approval-table-input"
                            inputmode="decimal"
                            type="number"
                            [(ngModel)]="row.givenAmount"
                            aria-label="Given amount"
                            min="0"
                          />
                        </td>
                        <td>
                          <input
                            class="approval-table-input"
                            type="text"
                            [(ngModel)]="row.poNumber"
                            aria-label="PO Number"
                            placeholder="Auto-generate"
                          />
                        </td>
                        <td>{{ row.supervisor || "-" }}</td>
                        <td>
                          @if (row.billUrl) {
                            @if (isDataUrl(row.billUrl)) {
                              <button type="button" class="bill-link" (click)="openImagePreview(row.billUrl)">View Bill</button>
                            } @else {
                              <a class="bill-link" [href]="row.billUrl" target="_blank" rel="noopener noreferrer">View Bill</a>
                            }
                          } @else {
                            {{ row.reference || "-" }}
                          }
                        </td>
                        <td><span class="approval-status-pill">{{ row.status }}</span></td>
                        <td class="approval-actions">
                          <button type="button" class="approve-action" (click)="approve(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>Approve</button>
                          <button type="button" class="decline-action" (click)="decline(row)"><svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="m5.5 5.5 9 9" /><path d="m14.5 5.5-9 9" /></svg>Decline</button>
                        </td>
                      </tr>
                      <tr *ngIf="siteExpenseApprovals().length === 0"><td class="empty-row" colspan="13"><span>No pending site expense approvals.</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
              }





              
            </div>
          </main>
</ion-content>
        </div>

        @if (previewImageUrl()) {
          <div class="image-preview-overlay" (click)="closeImagePreview()">
            <button type="button" class="image-preview-close" (click)="closeImagePreview()" aria-label="Close">×</button>
            <img [src]="previewImageUrl()" alt="Bill preview" (click)="$event.stopPropagation()" />
          </div>
        }
      </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingApprovalsPage implements OnInit {
  private readonly data = inject(ErpDataService);
  private readonly approvalsService = inject(ApprovalsService);
  private readonly materialsService = inject(MaterialsService);
  private readonly api = inject(ApiService);

  readonly showMaterial = signal(false);
  readonly showLabour = signal(false);
  readonly showSiteExpense = signal(false);
  readonly isLoading = signal(false);
  readonly loadError = signal(false);

  readonly previewImageUrl = signal<string | null>(null);

  private _materialRows = signal<MaterialApprovalRow[]>([]);
  private _labourRows = signal<LabourApprovalRow[]>([]);
  private _siteExpenseRows = signal<ExpenseApprovalRow[]>([]);

  async ngOnInit() {
    this.showMaterial.set(true);
    this.showSiteExpense.set(true);
    await this.refreshApprovals();
  }

  async refreshApprovals(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(false);
    try {
      const all = await this.approvalsService.fetchApprovals({ status: "Pending", limit: 100 });
      this._materialRows.set(all.filter((r) => r.module === "materials") as MaterialApprovalRow[]);
      this._labourRows.set(all.filter((r) => r.module === "labour") as LabourApprovalRow[]);
      this._siteExpenseRows.set(all.filter((r) => r.module === "expenses") as ExpenseApprovalRow[]);
    } catch {
      this.loadError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  readonly materialApprovals = computed(() =>
    this.showMaterial() ? this._materialRows().filter((row) => this.isPending(row.status)) : []
  );
  readonly labourApprovals = computed(() =>
    this.showLabour() ? this._labourRows().filter((row) => this.isPending(row.status)) : []
  );
  readonly siteExpenseApprovals = computed<ExpenseApprovalRow[]>(() =>
    this.showSiteExpense() ? this._siteExpenseRows().filter((row) => this.isPending(row.status)) : ([] as ExpenseApprovalRow[])
  );

  pendingTotal(): number {
    return this.allPendingRows().length;
  }

  pendingClientCount(): number {
    return new Set(this.allPendingRows().map((row) => row.client).filter(Boolean)).size;
  }

  pendingProjectCount(): number {
    return new Set(this.allPendingRows().map((row) => row.project).filter(Boolean)).size;
  }

  toggleFilter(type: string) {
    switch (type) {
      case "material": this.showMaterial.update(v => !v); break;
      case "labour": this.showLabour.update(v => !v); break;
      case "site_expense": this.showSiteExpense.update(v => !v); break;
    }
  }

  isFilterActive(type: string): boolean {
    switch (type) {
      case "material": return this.showMaterial();
      case "labour": return this.showLabour();
      case "site_expense": return this.showSiteExpense();
      default: return true;
    }
  }

  vendorOptions(currentVendor = ""): string[] {
    return this.sortedUnique([
      currentVendor,
      ...this.data.vendors().map((vendor) => vendor.name),
      ...this.materialsService.materials().map((material) => material.vendor),
      ...this._materialRows().map((r) => r.vendor).filter(Boolean),
    ]);
  }

  updateApprovalCell(row: ApprovalBaseRow, key: string, value: string) {
    const numericFields = ['approvedQuantity', 'issuedAmount', 'givenAmount', 'amount'];
    const parsedValue = numericFields.includes(key) ? (value === '' ? undefined : Number(value)) : value;
    if (row.module === "materials") {
      this._materialRows.update((rows) =>
        rows.map((r) => r.rowId === row.rowId ? Object.assign({}, r, { [key]: parsedValue }) : r)
      );
    } else if (row.module === "expenses") {
      this._siteExpenseRows.update((rows) =>
        rows.map((r) => r.rowId === row.rowId ? Object.assign({}, r, { [key]: parsedValue }) : r)
      );
    }
  }

  approve(row: ApprovalBaseRow) {
    void this.applyApproval(row, "Approved");
  }

  decline(row: ApprovalBaseRow) {
    void this.applyApproval(row, "Rejected");
  }

  private async applyApproval(row: ApprovalBaseRow, status: "Approved" | "Rejected"): Promise<void> {
    try {
      if (status === "Approved") {
        let payload: any = {};
        if (row.module === "expenses") {
          const expenseRow = this._siteExpenseRows().find((r) => r.rowId === row.rowId);
          if (expenseRow) {
            if (expenseRow.issuedAmount !== undefined) payload.issuedAmount = expenseRow.issuedAmount;
            if (expenseRow.givenAmount !== undefined) payload.givenAmount = expenseRow.givenAmount;
            if (expenseRow.poNumber !== undefined && expenseRow.poNumber.trim() !== '') payload.poNumber = expenseRow.poNumber;
          }
        } else if (row.module === "materials") {
          const materialRow = this._materialRows().find((r) => r.rowId === row.rowId);
          if (materialRow) {
            payload.approvedQuantity = Number(materialRow.approvedQuantity) || 0;
            if (materialRow.vendor !== undefined && materialRow.vendor.trim() !== '') payload.vendor = materialRow.vendor;
            if (materialRow.issuedAmount !== undefined) payload.issuedAmount = materialRow.issuedAmount;
            if (materialRow.givenAmount !== undefined) payload.givenAmount = materialRow.givenAmount;
            if (materialRow.poNumber !== undefined && materialRow.poNumber.trim() !== '') payload.poNumber = materialRow.poNumber;
          }
        }
        await firstValueFrom(this.approvalsService.approve(row.rowId, payload));
        await this.refreshExpensesFromBackend();
      } else {
        await firstValueFrom(this.approvalsService.reject(row.rowId));
      }
      this.removeRowFromLists(row.rowId);
      window.alert(`Approval ${status.toLowerCase()} successfully.`);
    } catch (e) {
      window.alert("Failed to process approval. Please try again.");
    }
  }

  private async refreshExpensesFromBackend(): Promise<void> {
    try {
      const result = await firstValueFrom(this.api.listExpenses({ limit: 100 }));
      const mapped = (result.items || []).map(mapExpense);
      this.data.setExpenses(mapped);
    } catch (e) {
      console.warn("[PendingApprovals] Failed to refresh expenses", e);
    }
  }

  private removeRowFromLists(rowId: string) {
    this._materialRows.update((rows) => rows.filter((r) => r.rowId !== rowId));
    this._labourRows.update((rows) => rows.filter((r) => r.rowId !== rowId));
    this._siteExpenseRows.update((rows) => rows.filter((r) => r.rowId !== rowId));
  }

  private allPendingRows(): ApprovalBaseRow[] {
    return [
      ...this.materialApprovals(),
      ...this.labourApprovals(),
      ...this.siteExpenseApprovals(),
    ];
  }

  private isPending(value: string): boolean {
    return value.toLowerCase() === "pending";
  }

  private sortedUnique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean).map((value) => (value || "").trim()))].sort((first, second) => first.localeCompare(second));
  }

isDataUrl(url: string): boolean {
    return url.startsWith("data:");
  }

  openImagePreview(url: string) {
    this.previewImageUrl.set(url);
  }

  closeImagePreview() {
    this.previewImageUrl.set(null);
  }
}
