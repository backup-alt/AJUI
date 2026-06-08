import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import { ErpDataService, type SharedTableField, type SharedTableRow } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, formatNumber, statusClass } from "../shared/format";

type DashboardModule =
  | "materials"
  | "clients"
  | "labour"
  | "expenses"
  | "generalExpenses"
  | "payments"
  | "vendors"
  | "supervisors"
  | "subcontractors"
  | "reports";
type TableRow = SharedTableRow;
type FieldSchema = SharedTableField;
type FilterSchema = { key: string; label: string };
type ModuleConfig = {
  key: DashboardModule;
  label: string;
  title: string;
  description: string;
  columns: FieldSchema[];
  filters: FilterSchema[];
};

const dashboardModules: ModuleConfig[] = [
  {
    key: "materials",
    label: "Materials",
    title: "All Material Records",
    description: "Every material request, approval, vendor, purchase order, and remaining stock across all projects.",
    columns: [
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "materialName", label: "Material Name" },
      { key: "unit", label: "Unit" },
      { key: "requestedQuantity", label: "Requested Quantity" },
      { key: "approvedQuantity", label: "Approved Quantity" },
      { key: "vendor", label: "Vendor" },
      { key: "poNumber", label: "PO Number" },
      { key: "remainingStock", label: "Remaining Stock" },
      { key: "status", label: "Status" },
    ],
    filters: [
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "vendor", label: "Vendor" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    title: "All Clients",
    description: "Every client with contact, project count, active sites, value, received amount, and pending balance.",
    columns: [
      { key: "clientId", label: "Client ID" },
      { key: "clientName", label: "Client Name" },
      { key: "mobile", label: "Mobile Number" },
      { key: "address", label: "Address" },
      { key: "projectCount", label: "Project Count" },
      { key: "activeSites", label: "Active Sites" },
      { key: "totalProjectValue", label: "Total Project Value" },
      { key: "amountReceived", label: "Amount Received" },
      { key: "pendingBalance", label: "Pending Balance" },
      { key: "supervisor", label: "Supervisor" },
      { key: "status", label: "Status" },
    ],
    filters: [
      { key: "status", label: "Status" },
      { key: "supervisor", label: "Supervisor" },
      { key: "projectCount", label: "Project Count" },
    ],
  },
  {
    key: "labour",
    label: "Labour",
    title: "All Labour Attendance",
    description: "Every staff attendance row across sites with labour types, staff count, shift, overtime, fine, and daily pay.",
    columns: [
      { key: "client", label: "Client" },
      { key: "clientId", label: "Client ID" },
      { key: "projectId", label: "Project ID" },
      { key: "site", label: "Site" },
      { key: "attendanceDate", label: "Date" },
      { key: "staffName", label: "Staff Name" },
      { key: "labourTypes", label: "Labour Types" },
      { key: "staffCount", label: "Staff Count" },
      { key: "attendance", label: "Attendance" },
      { key: "shift", label: "Shift" },
      { key: "overtime", label: "Overtime" },
      { key: "dailyPay", label: "Daily Labour Pay" },
      { key: "lateFine", label: "Late Fine" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "status", label: "Status" },
    ],
    filters: [
      { key: "site", label: "Site" },
      { key: "attendance", label: "Attendance" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "expenses",
    label: "Site Expenses",
    title: "Site Expense Details",
    description: "Project-linked supervisor ledger and site expense details across active sites.",
    columns: [
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "expenseDate", label: "Expense Date" },
      { key: "transactionType", label: "Transaction Type" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "runningBalance", label: "Balance" },
      { key: "supervisor", label: "Supervisor" },
      { key: "reference", label: "Bill / Reference" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
    filters: [
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "supervisor", label: "Supervisor" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
  },
  {
    key: "generalExpenses",
    label: "General Expenses",
    title: "General Office Expenses",
    description: "Office expenses not tied to a site, such as admin purchases, courier, printing, and overhead payments.",
    columns: [
      { key: "expenseDate", label: "Expense Date" },
      { key: "department", label: "Department / Office" },
      { key: "description", label: "Description" },
      { key: "category", label: "Category" },
      { key: "amount", label: "Amount" },
      { key: "paidBy", label: "Paid By" },
      { key: "reference", label: "Bill / Reference" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
    filters: [
      { key: "department", label: "Department" },
      { key: "category", label: "Category" },
      { key: "paidBy", label: "Paid By" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    title: "All Payments",
    description: "Every client payment collection with receipt, mode, transaction reference, collector, and approval status.",
    columns: [
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "paymentDate", label: "Payment Date" },
      { key: "amount", label: "Amount" },
      { key: "mode", label: "Mode" },
      { key: "transactionReference", label: "Transaction Reference" },
      { key: "receiptNumber", label: "Receipt Number" },
      { key: "collectedBy", label: "Collected By" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
    filters: [
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "mode", label: "Mode" },
      { key: "collectedBy", label: "Collected By" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
  },
  {
    key: "vendors",
    label: "Vendors",
    title: "Vendor Report",
    description: "Every vendor record with material type, phone, address, GST, and purchase history.",
    columns: [
      { key: "vendorId", label: "Vendor ID" },
      { key: "vendorName", label: "Vendor Name" },
      { key: "materialType", label: "Material Type" },
      { key: "materialsBought", label: "Materials Bought" },
      { key: "phoneNumber", label: "Phone Number" },
      { key: "address", label: "Address" },
      { key: "gstNumber", label: "GST Number" },
    ],
    filters: [
      { key: "materialType", label: "Material Type" },
      { key: "vendorName", label: "Vendor" },
    ],
  },
  {
    key: "supervisors",
    label: "Supervisors",
    title: "Supervisor Master List",
    description: "Company supervisor records with assignment, cash limits, advances, approval authority, and status.",
    columns: [
      { key: "supervisorId", label: "Supervisor ID" },
      { key: "supervisorName", label: "Supervisor Name" },
      { key: "phoneNumber", label: "Phone Number" },
      { key: "role", label: "Role" },
      { key: "assignedProject", label: "Assigned Project" },
      { key: "assignedSite", label: "Assigned Site" },
      { key: "cashLimit", label: "Cash Limit" },
      { key: "activeAdvances", label: "Active Advances" },
      { key: "approvalAuthority", label: "Approval Authority" },
      { key: "status", label: "Status" },
    ],
    filters: [
      { key: "role", label: "Role" },
      { key: "assignedProject", label: "Project" },
      { key: "assignedSite", label: "Site" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "subcontractors",
    label: "Subcontracts",
    title: "Subcontractor Register",
    description: "Subcontractor work packages with contract value, advances, balance, supervisor, and payment status.",
    columns: [
      { key: "subcontractId", label: "Subcontract ID" },
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "subcontractorName", label: "Subcontractor Name" },
      { key: "workPackage", label: "Work Package" },
      { key: "contractValue", label: "Contract Value" },
      { key: "advancePaid", label: "Advance Paid" },
      { key: "balance", label: "Balance" },
      { key: "startDate", label: "Start Date" },
      { key: "dueDate", label: "Due Date" },
      { key: "supervisor", label: "Supervisor" },
      { key: "approvalStatus", label: "Approval Status" },
      { key: "paymentStatus", label: "Payment Status" },
    ],
    filters: [
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "supervisor", label: "Supervisor" },
      { key: "paymentStatus", label: "Payment Status" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    title: "Universal Report Register",
    description: "Financial, labour, material, vendor, and project reports ready for Excel export.",
    columns: [
      { key: "category", label: "Category" },
      { key: "reportName", label: "Report Name" },
      { key: "scope", label: "Scope" },
      { key: "owner", label: "Owner" },
      { key: "exportFormat", label: "Export Format" },
      { key: "status", label: "Status" },
    ],
    filters: [
      { key: "category", label: "Category" },
      { key: "owner", label: "Owner" },
      { key: "status", label: "Status" },
    ],
  },
];

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="dashboard"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Dashboard"
          eyebrow="Universal Records"
          metaLabel=""
          [blurred]="recordDialogOpen() || fieldDialogOpen()"
          [showTitle]="false"
          role="Admin"
          searchPlaceholder="Search universal dashboard..."
        />

        <ion-content class="erp-page">
          <main class="workspace-shell">
            <section class="dashboard-command-strip dashboard-command-center">
              <div class="dashboard-command-copy">
                <h1>Dashboard</h1>
              </div>
              <div class="dashboard-kpi-strip dashboard-kpi-board">
                <div><span>Project Value</span><strong>{{ formatMoney(totalProjectValue()) }}</strong></div>
                <div><span>Payments</span><strong>{{ formatMoney(totalReceived()) }}</strong></div>
                <div><span>Pending</span><strong>{{ formatMoney(totalPending()) }}</strong></div>
                <div><span>Active Clients</span><strong>{{ data.activeClients() }}</strong></div>
              </div>
            </section>

            <section class="operations-workbench universal-workbench">
              <nav class="operations-tabs" aria-label="Universal dashboard modules">
                <button
                  *ngFor="let module of modules"
                  type="button"
                  [class.active]="activeModule() === module.key"
                  (click)="switchModule(module.key)"
                >
                  <span>{{ module.label }}</span>
                  <small>{{ rowCountFor(module.key) }}</small>
                </button>
              </nav>

              <div class="module-toolbar table-first-toolbar">
                <div>
                  <h2>{{ activeConfig().title }}</h2>
                  <p>{{ activeConfig().description }}</p>
                </div>
                <div class="table-actions">
                  <label class="table-search">
                    <ion-icon name="search-outline"></ion-icon>
                    <input [value]="searchText()" (input)="searchText.set($any($event.target).value)" placeholder="Search rows" />
                  </label>
                  <button type="button" class="primary-table-action add-row-action" title="Add row" aria-label="Add row" (click)="addInlineRow()">
                    <ion-icon name="add-outline"></ion-icon>
                    Add Row
                  </button>
                  <button type="button" (click)="openFieldDialog()">Add Field</button>
                  <button type="button" (click)="exportPdf()"><ion-icon name="document-text-outline"></ion-icon>PDF Report</button>
                  <button type="button" (click)="exportExcel()"><ion-icon name="download-outline"></ion-icon>Export Excel</button>
                </div>
              </div>

              <div class="universal-filter-bar">
                <label *ngFor="let filter of activeConfig().filters">
                  <span>{{ filter.label }}</span>
                  <select [value]="selectedFilters()[filter.key] || ''" (change)="setFilter(filter.key, $any($event.target).value)">
                    <option value="">All</option>
                    <option *ngFor="let value of filterValues(filter.key)" [value]="value">{{ value }}</option>
                  </select>
                </label>
                <button type="button" (click)="clearFilters()">Clear filters</button>
              </div>

              <div class="table-meta-strip">
                <span>{{ visibleRows().length }} rows</span>
                <span>{{ columnsForActive().length }} fields</span>
                <span>{{ selectedFilterCount() }} active filters</span>
                <span *ngIf="activeModule() === 'clients'">Customer records synced</span>
                <span *ngIf="activeModule() === 'expenses'">Balances grouped by Project + Site</span>
              </div>

              <div class="table-wrap operations-table universal-table">
                <table>
                  <thead>
                    <tr>
                      <th *ngFor="let column of columnsForActive()">{{ column.label }}</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of visibleRows(); let rowIndex = index">
                      <td
                        *ngFor="let column of columnsForActive()"
                        [class.readonly-cell]="isReadonlyColumn(column.key)"
                        [class.select-cell]="selectOptions(activeModule(), column.key).length > 0"
                        spellcheck="false"
                      >
                        <select
                          *ngIf="selectOptions(activeModule(), column.key).length > 0; else editableDashboardCell"
                          [value]="row[column.key] || ''"
                          (change)="updateCell(rowIndex, column.key, $any($event.target).value)"
                        >
                          <option *ngFor="let option of selectOptions(activeModule(), column.key)" [value]="option">{{ option }}</option>
                        </select>
                        <ng-template #editableDashboardCell>
                          <span
                            class="editable-cell"
                            [attr.contenteditable]="isReadonlyColumn(column.key) ? null : 'true'"
                            spellcheck="false"
                            (blur)="!isReadonlyColumn(column.key) && updateCell(rowIndex, column.key, $any($event.target).textContent || '')"
                          >
                            {{ row[column.key] }}
                          </span>
                        </ng-template>
                      </td>
                      <td class="row-actions">
                        <button type="button" class="icon-row-action danger" aria-label="Delete row" title="Delete row" (click)="deleteRow(row)">
                          <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                            <path d="M4 7h16" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M6 7l1 14h10l1-14" />
                            <path d="M9 7V4h6v3" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr *ngIf="visibleRows().length === 0">
                      <td class="empty-row" [attr.colspan]="columnsForActive().length + 1">
                        <div class="empty-record-state icon-only" aria-label="No records in this table">
                          <span class="empty-box-icon" aria-hidden="true">
                            <svg viewBox="0 0 226.512 226.512" aria-hidden="true">
                              <path class="empty-box-fill" d="M186.268 9.011H38.929c-6.005 0-13.189 4.536-16.116 10.128L3.009 65.958C.822 71.549-.461 80.932.153 86.909l12.287 119.774c.609 5.978 5.983 10.818 11.988 10.818h177.672c6.005 0 11.379-4.846 11.988-10.818l12.287-119.774c.609-5.978-.87-15.273-3.312-20.755l-21.414-47.238c-2.491-5.472-8.377-9.905-14.381-9.905Z" />
                              <path class="empty-box-line" d="M28.834 68.514l6.88-20.201c1.936-5.684 8.376-10.296 14.386-10.296h122.896c6.005 0 12.863 4.444 15.311 9.932l9.361 20.935c2.448 5.488-.435 9.932-6.445 9.932H36.209c-6.01 0-9.311-4.612-7.375-10.302Z" />
                              <path class="empty-box-line" d="M78.362 102.383h69.799c6.005 0 10.878 4.873 10.878 10.878v24.476c0 6.005-4.873 10.878-10.878 10.878H78.362c-6.005 0-10.878-4.873-10.878-10.878v-24.476c0-6.005 4.873-10.878 10.878-10.878Z" />
                            </svg>
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="form-overlay" *ngIf="recordDialogOpen()">
              <form class="erp-dialog operations-dialog" (submit)="saveRecord($event)">
                <div class="dialog-head">
                  <div>
                    <span>{{ activeConfig().label }}</span>
                    <h2>Add Record</h2>
                  </div>
                  <button type="button" class="icon-button" (click)="recordDialogOpen.set(false)">
                    <ion-icon name="close-outline"></ion-icon>
                  </button>
                </div>
                <div class="erp-form">
                  <label *ngFor="let column of columnsForActive()">
                    <span>{{ column.label }}</span>
                    <select
                      *ngIf="selectOptions(activeModule(), column.key).length > 0; else dashboardDraftInput"
                      [value]="draftRow()[column.key] || ''"
                      (change)="updateDraftField(column.key, $any($event.target).value)"
                    >
                      <option *ngFor="let option of selectOptions(activeModule(), column.key)" [value]="option">{{ option }}</option>
                    </select>
                    <ng-template #dashboardDraftInput>
                      <input [type]="column.type || 'text'" [value]="draftRow()[column.key] || ''" (input)="updateDraftField(column.key, $any($event.target).value)" />
                    </ng-template>
                  </label>
                </div>
                <div class="dialog-actions">
                  <button type="button" class="secondary-action" (click)="recordDialogOpen.set(false)">Cancel</button>
                  <button type="submit" class="primary-action">Add Record</button>
                </div>
              </form>
            </section>

            <section class="form-overlay" *ngIf="fieldDialogOpen()">
              <form class="erp-dialog field-dialog" (submit)="saveField($event)">
                <div class="dialog-head">
                  <div>
                    <span>{{ activeConfig().label }}</span>
                    <h2>Add Field</h2>
                  </div>
                  <button type="button" class="icon-button" (click)="fieldDialogOpen.set(false)">
                    <ion-icon name="close-outline"></ion-icon>
                  </button>
                </div>
                <div class="erp-form">
                  <label class="span-2">
                    <span>Field Name</span>
                    <input [value]="newFieldLabel()" (input)="newFieldLabel.set($any($event.target).value)" placeholder="Example: Verified By" />
                  </label>
                </div>
                <div class="dialog-actions">
                  <button type="button" class="secondary-action" (click)="fieldDialogOpen.set(false)">Cancel</button>
                  <button type="submit" class="primary-action">Add Field</button>
                </div>
              </form>
            </section>
          </main>
        </ion-content>
      </div>
    </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniversalDashboardPage {
  readonly data = inject(ErpDataService);
  readonly router = inject(Router);
  readonly modules = dashboardModules;
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;
  readonly activeModule = signal<DashboardModule>("clients");
  readonly searchText = signal("");
  readonly selectedFilters = signal<Record<string, string>>({});
  readonly recordDialogOpen = signal(false);
  readonly fieldDialogOpen = signal(false);
  readonly draftRow = signal<TableRow>({});
  readonly newFieldLabel = signal("");
  readonly activeConfig = computed(() => dashboardModules.find((module) => module.key === this.activeModule()) ?? dashboardModules[0]);

  totalProjectValue() {
    return this.data.projects().reduce((sum, project) => sum + project.totalValue, 0);
  }

  totalReceived() {
    return this.data.projects().reduce((sum, project) => sum + project.receivedAmount, 0);
  }

  totalPending() {
    return this.totalProjectValue() - this.totalReceived();
  }

  switchModule(module: DashboardModule) {
    this.activeModule.set(module);
    this.searchText.set("");
    this.selectedFilters.set({});
  }

  columnsForActive(): FieldSchema[] {
    const base = this.activeConfig().columns;
    return [...base, ...this.data.customFieldsFor(this.activeModule())];
  }

  visibleRows(): TableRow[] {
    const query = this.searchText().trim().toLowerCase();
    const filters = this.selectedFilters();
    const rows = this.rowsFor(this.activeModule()).filter((row) => {
      const matchesSearch = !query || Object.values(row).some((value) => String(value).toLowerCase().includes(query));
      const matchesFilters = Object.entries(filters).every(([key, value]) => !value || String(row[key]) === value);
      return matchesSearch && matchesFilters;
    });
    return this.withComputedRows(this.activeModule(), rows);
  }

  filterValues(key: string): string[] {
    const values = new Set<string>();
    for (const row of this.withComputedRows(this.activeModule(), this.rowsFor(this.activeModule()))) {
      const value = row[key];
      if (value !== undefined && value !== "") values.add(String(value));
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }

  rowCountFor(module: DashboardModule): number {
    return this.rowsFor(module).length;
  }

  selectedFilterCount(): number {
    return Object.values(this.selectedFilters()).filter(Boolean).length;
  }

  isReadonlyColumn(key: string): boolean {
    return (
      key === "clientId" ||
      key === "vendorId" ||
      key === "supervisorId" ||
      key === "subcontractId" ||
      key === "runningBalance" ||
      key === "weeklyPayable" ||
      key === "weeklyPay" ||
      key === "staffCount" ||
      key === "balance"
    );
  }

  setFilter(key: string, value: string) {
    this.selectedFilters.update((filters) => ({ ...filters, [key]: value }));
  }

  clearFilters() {
    this.selectedFilters.set({});
    this.searchText.set("");
  }

  openRecordDialog() {
    const row: TableRow = {};
    for (const column of this.columnsForActive()) {
      const options = this.selectOptions(this.activeModule(), column.key);
      row[column.key] = options[0] ?? "";
    }
    this.draftRow.set(row);
    this.recordDialogOpen.set(true);
  }

  addInlineRow() {
    const module = this.activeModule();
    if (module === "clients") {
      this.data.addClient({ name: "New Client", mobile: "", address: "", supervisor: "Unassigned" });
      return;
    }
    this.data.addCustomRow(module, this.defaultRowFor(module));
  }

  updateDraftField(key: string, value: string) {
    this.draftRow.update((row) => ({ ...row, [key]: value }));
  }

  saveRecord(event: Event) {
    event.preventDefault();
    const module = this.activeModule();
    const row = { ...this.draftRow() };
    if (module === "clients") {
      const client = this.data.addClient({
        name: String(row["clientName"] || "New Client").trim(),
        mobile: String(row["mobile"] || "").trim(),
        address: String(row["address"] || "").trim(),
        supervisor: String(row["supervisor"] || "Unassigned").trim(),
      });
      const status = this.normalizeClientStatus(String(row["status"] || ""));
      if (status !== "Active") this.data.updateClient(client.id, { status });
    } else {
      this.data.addCustomRow(module, row);
    }
    this.recordDialogOpen.set(false);
  }

  openFieldDialog() {
    this.newFieldLabel.set("");
    this.fieldDialogOpen.set(true);
  }

  saveField(event: Event) {
    event.preventDefault();
    const label = this.newFieldLabel().trim();
    if (!label) return;
    const module = this.activeModule();
    this.data.addCustomField(module, label, this.columnsForActive());
    this.fieldDialogOpen.set(false);
  }

  updateCell(visibleIndex: number, key: string, value: string) {
    if (this.isReadonlyColumn(key)) return;
    const target = this.visibleRows()[visibleIndex];
    if (!target) return;
    const module = this.activeModule();
    const trimmedValue = value.trim();

    if (module === "clients") {
      this.updateClientCell(target, key, trimmedValue);
    }

    const rowId = String(target["__rowId"] || "");
    if (!rowId) return;
    this.data.updateSharedRowCell(rowId, key, trimmedValue);
  }

  deleteRow(row: TableRow) {
    const module = this.activeModule();
    const rowId = String(row["__rowId"] || "");
    if (module === "clients") {
      this.data.deleteClient(String(row["clientId"] || ""));
      return;
    }
    this.data.deleteSharedRow(rowId);
  }

  exportExcel() {
    const columns = this.columnsForActive();
    const rows = this.visibleRows();
    const html = [
      "<table><thead><tr>",
      ...columns.map((column) => `<th>${this.escapeHtml(column.label)}</th>`),
      "</tr></thead><tbody>",
      ...rows.map((row) => `<tr>${columns.map((column) => `<td>${this.escapeHtml(String(row[column.key] ?? ""))}</td>`).join("")}</tr>`),
      "</tbody></table>",
    ].join("");
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `annai-${this.activeModule()}-${new Date().toISOString().slice(0, 10)}.xls`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  exportPdf() {
    const module = this.activeModule();
    const columns = this.reportColumns(module);
    const rows = this.reportRows(module, this.visibleRows());
    const summary = module === "labour" ? this.labourSummaryHtml(rows) : module === "expenses" ? this.expenseSummaryHtml(rows) : "";
    this.openPrintableReport({
      title: module === "labour" ? "Labour Attendance Report" : module === "expenses" ? "Expense Ledger Report" : this.activeConfig().title,
      subtitle: "Annai Golden Builders - Universal Dashboard",
      columns,
      rows,
      summary,
    });
  }

  openClients() {
    void this.router.navigate(["/clients"]);
  }

  private buildRows(): Record<DashboardModule, TableRow[]> {
    const projectById = (projectId: string) => this.data.projectById(projectId);
    const projectName = (projectId: string) => projectById(projectId)?.name ?? projectId;
    const clientName = (projectId: string) => projectById(projectId)?.client ?? "";
    const clientId = (projectId: string) => this.data.clients().find((client) => client.projectIds.includes(projectId) || client.name === clientName(projectId))?.id ?? "";

    const materials = this.data.materials().map((row) => ({
      __rowId: `material:${row.id}`,
      __projectId: row.projectId,
      client: clientName(row.projectId),
      project: projectName(row.projectId),
      site: row.site,
      materialName: row.name,
      unit: row.unit,
      requestedQuantity: formatNumber(row.requested),
      approvedQuantity: formatNumber(row.approved),
      vendor: row.vendor,
      poNumber: row.poNumber,
      remainingStock: `${formatNumber(row.purchased - row.consumed)} ${row.unit}`,
      status: row.status,
    }));

    const clients = this.data.clients().map((client) => {
      const summary = this.data.clientSummary(client);
      return {
        __rowId: `client:${client.id}`,
        clientId: client.id,
        clientName: client.name,
        mobile: client.mobile,
        address: client.address,
        projectCount: summary.projectCount,
        activeSites: summary.activeSites,
        totalProjectValue: formatMoney(summary.totalValue),
        amountReceived: formatMoney(summary.received),
        pendingBalance: formatMoney(summary.pending),
        supervisor: client.supervisor,
        status: client.status,
      };
    });

    const labour = this.data.labour().map((row) => ({
      __rowId: `labour:${row.id}`,
      __projectId: row.projectId,
      client: clientName(row.projectId),
      clientId: clientId(row.projectId),
      projectId: row.projectId,
      site: row.site,
      attendanceDate: "2026-06-05",
      staffName: row.party,
      labourTypes: this.labourTypesFromRow(row),
      staffCount: row.presentCount,
      attendance: "Present",
      shift: this.normalizeShift(row.shift),
      overtime: `${row.overtime} hrs`,
      dailyPay: formatMoney(row.dailyWage),
      lateFine: formatMoney(row.lateFine),
      presentUnits: row.presentDays * row.presentCount,
      paymentMode: row.paymentMode,
      status: row.status,
    }));

    const expenses = this.data.expenses().filter((row) => row.type === "Site Expense").map((row) => ({
      __rowId: `expense:${row.id}`,
      __projectId: row.projectId,
      client: clientName(row.projectId),
      project: projectName(row.projectId),
      site: row.site,
      expenseDate: row.date,
      transactionType: "Site Expense",
      description: row.description,
      amount: formatMoney(-row.spent),
      runningBalance: formatMoney(0),
      supervisor: row.supervisor,
      cashIssued: formatMoney(row.received),
      reference: row.reference,
      approvalStatus: row.status,
    }));

    const generalExpenses = this.data.expenses().filter((row) => row.type === "General Expense").map((row) => ({
      __rowId: `general-expense:${row.id}`,
      __projectId: "",
      expenseDate: row.date,
      department: "Head Office",
      description: row.description,
      category: "Office Expense",
      amount: formatMoney(row.spent),
      paidBy: row.supervisor,
      reference: row.reference,
      approvalStatus: row.status,
    }));

    const payments = this.data.payments().map((row) => ({
      __rowId: `payment:${row.id}`,
      __projectId: row.projectId,
      client: clientName(row.projectId),
      project: projectName(row.projectId),
      paymentDate: row.date,
      amount: formatMoney(row.amount),
      mode: row.mode,
      transactionReference: row.reference,
      receiptNumber: row.receipt,
      collectedBy: row.collectedBy,
      approvalStatus: row.status,
    }));

    const vendors = this.data.vendors().map((vendor) => ({
      __rowId: `vendor:${vendor.id}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      materialType: vendor.materialType,
      materialsBought: this.materialPurchaseSummaryForVendor(vendor.name),
      phoneNumber: vendor.phone,
      address: vendor.address,
      gstNumber: vendor.gst,
    }));

    const supervisors = this.data.supervisors().map((supervisor) => ({
      __rowId: `supervisor:${supervisor.id}`,
      supervisorId: supervisor.id,
      supervisorName: supervisor.name,
      phoneNumber: supervisor.phone,
      role: supervisor.role,
      assignedProject: supervisor.assignedProject,
      assignedSite: supervisor.assignedSite,
      cashLimit: formatMoney(supervisor.cashLimit),
      activeAdvances: formatMoney(supervisor.activeAdvances),
      approvalAuthority: supervisor.approvalAuthority,
      status: supervisor.status,
    }));

    const subcontractors = this.data.subcontractors().map((subcontractor) => {
      const project = projectById(subcontractor.projectId);
      return {
        __rowId: `subcontractor:${subcontractor.id}`,
        __projectId: subcontractor.projectId,
        subcontractId: subcontractor.id,
        client: project?.client ?? "",
        project: project?.name ?? subcontractor.projectId,
        site: subcontractor.site,
        subcontractorName: subcontractor.name,
        workPackage: subcontractor.workPackage,
        contractValue: formatMoney(subcontractor.contractValue),
        advancePaid: formatMoney(subcontractor.advancePaid),
        balance: formatMoney(subcontractor.contractValue - subcontractor.advancePaid),
        startDate: subcontractor.startDate,
        dueDate: subcontractor.dueDate,
        supervisor: subcontractor.supervisor,
        approvalStatus: subcontractor.approvalStatus,
        paymentStatus: subcontractor.paymentStatus,
      };
    });

    const reports = [
      ["Financial", "Payment Collection Report", "All projects", "Accountant", "Excel", "Ready"],
      ["Financial", "Expense Report", "All sites", "Admin", "Excel", "Ready"],
      ["Labour", "Attendance Report", "All labour", "Project Manager", "Excel", "Ready"],
      ["Material", "Inventory Report", "All materials", "Project Manager", "Excel", "Ready"],
      ["Vendor", "Vendor Purchase Report", "All vendors", "Admin", "Excel", "Ready"],
      ["Subcontract", "Subcontractor Ledger", "All subcontractors", "Project Manager", "Excel", "Ready"],
      ["Project", "Project Summary", "All clients", "Admin", "Excel", "Ready"],
    ].map(([category, reportName, scope, owner, exportFormat, status], index) => ({
      __rowId: `report:${index}`,
      category,
      reportName,
      scope,
      owner,
      exportFormat,
      status,
    }));

    return { materials, clients, labour, expenses, generalExpenses, payments, vendors, supervisors, subcontractors, reports };
  }

  private rowsFor(module: DashboardModule): TableRow[] {
    return this.data.tableRowsFor(module, this.buildRows()[module]);
  }

  selectOptions(module: DashboardModule, key: string): string[] {
    if (key === "site") return this.siteOptionsForModule(module);
    if (module === "labour" && key === "staffName") return this.staffNameOptions();
    if (module === "expenses" && key === "transactionType") {
      return [
        "Site Expense",
        "Material Purchase",
        "Supervisor Expense",
        "Cash Added",
        "Cash Issued to Supervisor",
        "Payment Received",
        "Payment Received from Annai Golden Builders Pvt Ltd",
        "Refund / Return",
        "Adjustment",
      ];
    }
    if (module === "labour" && key === "attendance") return ["Present", "Absent"];
    if (module === "labour" && key === "shift") return ["1", "2", "3"];
    if (key === "approvalStatus" || key === "status") return ["Pending", "Approved", "Rejected"];
    if (key === "paymentMode") return ["Cash", "NEFT", "UPI", "Bank Transfer", "Cheque"];
    if (key === "paymentStatus") return ["Not Started", "Part Paid", "Paid"];
    return [];
  }

  private defaultRowFor(module: DashboardModule): TableRow {
    const today = new Date().toISOString().slice(0, 10);
    const defaults: Record<DashboardModule, TableRow> = {
      materials: {
        client: "",
        project: "",
        site: "",
        materialName: "",
        unit: "",
        requestedQuantity: "",
        approvedQuantity: "",
        vendor: "",
        poNumber: "",
        remainingStock: "",
        status: "Pending",
      },
      clients: {},
      labour: {
        client: "",
        clientId: "",
        projectId: "",
        site: "",
        attendanceDate: today,
        staffName: this.staffNameOptions()[0] ?? "",
        labourTypes: "Mason: 1",
        staffCount: "1",
        attendance: "Present",
        shift: "1",
        overtime: "0",
        dailyPay: "0",
        lateFine: "0",
        presentUnits: 1,
        paymentMode: "Cash",
        status: "Pending",
      },
      expenses: {
        client: "",
        project: "",
        site: "",
        expenseDate: today,
        transactionType: "Site Expense",
        description: "",
        amount: "0",
        runningBalance: formatMoney(0),
        supervisor: "",
        reference: "",
        approvalStatus: "Pending",
      },
      generalExpenses: {
        expenseDate: today,
        department: "Head Office",
        description: "",
        category: "Office Expense",
        amount: "0",
        paidBy: "",
        reference: "",
        approvalStatus: "Pending",
      },
      payments: {
        client: "",
        project: "",
        paymentDate: today,
        amount: "0",
        mode: "Cash",
        transactionReference: "",
        receiptNumber: "",
        collectedBy: "",
        approvalStatus: "Pending",
      },
      vendors: {
        vendorName: "",
        materialType: "",
        materialsBought: formatNumber(0),
        phoneNumber: "",
        address: "",
        gstNumber: "",
      },
      supervisors: {
        supervisorName: "",
        phoneNumber: "",
        role: "",
        assignedProject: "",
        assignedSite: "",
        cashLimit: "0",
        activeAdvances: "0",
        approvalAuthority: "",
        status: "Active",
      },
      subcontractors: {
        client: "",
        project: "",
        site: "",
        subcontractorName: "",
        workPackage: "",
        contractValue: "0",
        advancePaid: "0",
        balance: formatMoney(0),
        startDate: today,
        dueDate: today,
        supervisor: "",
        approvalStatus: "Pending",
        paymentStatus: "Not Started",
      },
      reports: {
        category: "",
        reportName: "",
        scope: "",
        owner: "",
        exportFormat: "PDF / Excel",
        status: "Ready",
      },
    };
    return defaults[module];
  }

  private withComputedRows(module: DashboardModule, rows: TableRow[]): TableRow[] {
    if (module === "expenses") return this.withExpenseBalances(rows);
    if (module === "labour") return rows.map((row) => this.withLabourPayable(row));
    if (module === "subcontractors") {
      return rows.map((row) => ({
        ...row,
        balance: formatMoney(this.moneyNumber(row["contractValue"]) - this.moneyNumber(row["advancePaid"])),
      }));
    }
    return rows;
  }

  private withExpenseBalances(rows: TableRow[]): TableRow[] {
    const balances = new Map<string, number>();
    return rows.map((row) => {
      const transactionType = String(row["transactionType"] || "Site Expense");
      const groupKey = this.expenseGroupKey(row);
      const previousBalance = balances.get(groupKey) ?? this.expenseOpeningBalanceFor(row);
      const balance = previousBalance + this.expenseSignedAmount(row, transactionType);
      balances.set(groupKey, balance);
      return {
        ...row,
        transactionType,
        runningBalance: formatMoney(balance),
      };
    });
  }

  private withLabourPayable(row: TableRow): TableRow {
    const attendance = String(row["attendance"] || "Present");
    const labourTypes = String(row["labourTypes"] || row["notes"] || "").trim();
    const enteredStaffCount = this.moneyNumber(row["staffCount"]);
    const staffCount = this.staffCountFromLabourTypes(labourTypes) || enteredStaffCount || this.moneyNumber(row["presentUnits"]) || 1;
    return {
      ...row,
      staffName: row["staffName"] || row["labourName"] || "",
      labourTypes,
      attendance,
      shift: this.normalizeShift(row["shift"]),
      staffCount,
    };
  }

  private isExpenseCredit(transactionType: string): boolean {
    const normalized = transactionType.toLowerCase();
    return (
      normalized.includes("payment") ||
      normalized.includes("received") ||
      normalized.includes("cash issued") ||
      normalized.includes("cash added") ||
      normalized.includes("refund") ||
      normalized.includes("credit")
    );
  }

  private siteOptionsForModule(module: DashboardModule): string[] {
    const sites = new Set<string>();
    for (const project of this.data.projects()) project.sites.forEach((site) => sites.add(site));
    for (const row of this.rowsFor(module)) {
      const site = String(row["site"] || "").trim();
      if (site) sites.add(site);
    }
    return [...sites].sort((a, b) => a.localeCompare(b));
  }

  private staffNameOptions(): string[] {
    const names = new Set<string>();
    for (const row of this.rowsFor("labour")) {
      const name = String(row["staffName"] || row["labourName"] || "").trim();
      if (name) names.add(name);
    }
    ["Velu Mason Party", "Ganesh Plumbing", "Selvam Civil Works", "Balu Helper Team"].forEach((name) => names.add(name));
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  private materialPurchaseSummaryForVendor(vendorName: string): string {
    const rows = this.data.materials().filter((row) => row.vendor.toLowerCase() === vendorName.toLowerCase());
    const purchased = rows.reduce((sum, row) => sum + row.purchased, 0);
    return rows.length ? `${formatNumber(rows.length)} records / ${formatNumber(purchased)} purchased` : "0 records";
  }

  private labourTypesFromRow(row: { category: string; notes: string; presentCount: number }): string {
    const notes = row.notes.trim();
    if (this.staffCountFromLabourTypes(notes)) return notes;
    return `${row.category}: ${row.presentCount}`;
  }

  private normalizeShift(value: unknown): string {
    const text = String(value ?? "").trim();
    if (!text) return "1";
    if (text.toLowerCase().includes("night")) return "2";
    if (text.toLowerCase().includes("day")) return "1";
    const shift = this.moneyNumber(text);
    return shift ? String(shift) : "1";
  }

  private staffCountFromLabourTypes(value: string): number {
    return value
      .split(/[,;\n]+/)
      .map((part) => {
        const match = part.trim().match(/(?:^|[:x-])\s*(\d+(?:\.\d+)?)\s*$/i) ?? part.trim().match(/(\d+(?:\.\d+)?)/);
        return match ? Number(match[1]) : 0;
      })
      .filter((count) => Number.isFinite(count))
      .reduce((sum, count) => sum + count, 0);
  }

  private expenseGroupKey(row: TableRow): string {
    const projectId = String(row["projectId"] || row["__projectId"] || row["project"] || "project");
    const site = String(row["site"] || "Project").trim().toLowerCase();
    return `${projectId}::${site}`;
  }

  private expenseOpeningBalanceFor(row: TableRow): number {
    const explicitProjectId = String(row["projectId"] || row["__projectId"] || "");
    const site = String(row["site"] || "Project");
    const savedOpening = explicitProjectId ? this.data.expenseOpeningBalanceFor(explicitProjectId, site) : undefined;
    if (savedOpening !== undefined) return savedOpening;
    const explicitOpening = this.explicitExpenseOpeningForGroup(explicitProjectId, String(row["project"] || ""), String(row["site"] || ""));
    if (explicitOpening) return explicitOpening;
    const project =
      this.data.projectById(explicitProjectId) ??
      this.data.projects().find((projectRow) => projectRow.name === row["project"] || projectRow.id === row["project"]);
    return project?.expenseBalance ?? 0;
  }

  private expenseSignedAmount(row: TableRow, transactionType = String(row["transactionType"] || "")): number {
    const amountText = String(row["amount"] ?? "").trim();
    const amount = this.moneyNumber(amountText);
    if (!amount) return 0;
    if (amountText.startsWith("+") || amountText.startsWith("-")) return amount;
    return this.isExpenseCredit(transactionType) ? Math.abs(amount) : -Math.abs(amount);
  }

  private explicitExpenseOpeningForGroup(projectId: string, projectName: string, site: string): number {
    const normalizedSite = site.trim().toLowerCase();
    if (!normalizedSite) return 0;
    const rows = this.rowsFor("expenses");
    const match = rows.find((row) => {
      const rowProjectId = String(row["projectId"] || row["__projectId"] || "");
      const rowProjectName = String(row["project"] || "");
      const rowSite = String(row["site"] || "").trim().toLowerCase();
      const sameProject = projectId ? rowProjectId === projectId : rowProjectName === projectName;
      return sameProject && rowSite === normalizedSite && (this.moneyNumber(row["openingBalance"]) || this.moneyNumber(row["cashIssued"]));
    });
    return match ? this.moneyNumber(match["openingBalance"]) || this.moneyNumber(match["cashIssued"]) : 0;
  }

  private reportColumns(module: DashboardModule): FieldSchema[] {
    if (module === "expenses") {
      return [
        { key: "expenseDate", label: "Date" },
        { key: "transactionType", label: "Transaction Type" },
        { key: "description", label: "Description" },
        { key: "amount", label: "Amount" },
        { key: "runningBalance", label: "Balance" },
      ];
    }
    if (module === "labour") {
      return [
        { key: "attendanceDate", label: "Date" },
        { key: "staffName", label: "Staff Name" },
        { key: "labourTypes", label: "Labour Types" },
        { key: "staffCount", label: "Staff Count" },
        { key: "attendance", label: "Attendance" },
        { key: "shift", label: "Shift" },
        { key: "overtimeLate", label: "Overtime / Late" },
        { key: "dailyPay", label: "Daily Labour Pay" },
      ];
    }
    return this.columnsForActive();
  }

  private reportRows(module: DashboardModule, rows: TableRow[]): TableRow[] {
    if (module !== "labour") return rows;
    return rows.map((row) => ({
      ...row,
      overtimeLate: `${row["overtime"] || "0"} overtime / ${row["lateFine"] || "0"} late fine`,
    }));
  }

  private labourSummaryHtml(rows: TableRow[]): string {
    const summary = new Map<string, { present: number; absent: number; payable: number }>();
    for (const row of rows) {
      const name = String(row["staffName"] || row["labourName"] || "Unnamed");
      const current = summary.get(name) ?? { present: 0, absent: 0, payable: 0 };
      if (String(row["attendance"] || "").toLowerCase() === "absent") current.absent += 1;
      else current.present += 1;
      const staffCount = this.moneyNumber(row["staffCount"]) || this.staffCountFromLabourTypes(String(row["labourTypes"] || ""));
      const shift = this.moneyNumber(row["shift"]) || 1;
      const dailyPay = this.moneyNumber(row["dailyPay"]);
      const overtime = this.moneyNumber(row["overtime"]);
      const lateFine = this.moneyNumber(row["lateFine"]);
      current.payable += String(row["attendance"] || "").toLowerCase() === "absent" ? 0 : dailyPay * staffCount * shift + overtime * 175 - lateFine;
      summary.set(name, current);
    }
    if (!summary.size) return "";
    return `<section class="summary"><h2>Labour Summary</h2>${[...summary.entries()]
      .map(
        ([name, value]) =>
          `<div><strong>${this.escapeHtml(name)}</strong><span>Present: ${value.present}</span><span>Absent: ${value.absent}</span><span>${this.escapeHtml(formatMoney(value.payable))}</span></div>`,
      )
      .join("")}</section>`;
  }

  private expenseSummaryHtml(rows: TableRow[]): string {
    const openingByGroup = new Map<string, number>();
    const closingByGroup = new Map<string, number>();
    const spent = rows.reduce((sum, row) => {
      const key = this.expenseGroupKey(row);
      if (!openingByGroup.has(key)) openingByGroup.set(key, this.expenseOpeningBalanceFor(row));
      closingByGroup.set(key, this.moneyNumber(row["runningBalance"]));
      const amount = this.expenseSignedAmount(row);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
    const received = rows.reduce((sum, row) => {
      const amount = this.expenseSignedAmount(row);
      return amount > 0 ? sum + amount : sum;
    }, [...openingByGroup.values()].reduce((sum, amount) => sum + amount, 0));
    const closing = formatMoney([...closingByGroup.values()].reduce((sum, amount) => sum + amount, 0));
    return `<section class="summary"><h2>Expense Summary</h2><div><strong>Opening / Received</strong><span>${this.escapeHtml(formatMoney(received))}</span></div><div><strong>Expenses</strong><span>${this.escapeHtml(formatMoney(spent))}</span></div><div><strong>Closing Balance</strong><span>${this.escapeHtml(closing)}</span></div></section>`;
  }

  private openPrintableReport(config: { title: string; subtitle: string; columns: FieldSchema[]; rows: TableRow[]; summary: string }) {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;
    const tableRows = config.rows
      .map((row) => `<tr>${config.columns.map((column) => `<td>${this.escapeHtml(String(row[column.key] ?? ""))}</td>`).join("")}</tr>`)
      .join("");
    reportWindow.document.write(`<!doctype html>
<html>
<head>
  <title>${this.escapeHtml(config.title)}</title>
  <style>
    body { margin: 32px; color: #111827; font-family: Inter, Arial, sans-serif; }
    header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #002263; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    p { margin: 0; color: #526070; font-size: 13px; }
    table { width: 100%; margin-top: 22px; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 9px 10px; border: 1px solid #cfd8e6; text-align: left; vertical-align: top; }
    th { background: #eef4ff; color: #002263; font-weight: 800; }
    .summary { display: grid; gap: 8px; margin-top: 18px; padding: 14px; border: 1px solid #cfd8e6; background: #f8fafc; }
    .summary h2 { margin: 0 0 4px; font-size: 16px; }
    .summary div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e4e9f1; padding-bottom: 6px; }
    .summary div:last-child { border-bottom: 0; padding-bottom: 0; }
    footer { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 48px; font-size: 12px; }
    footer div { padding-top: 34px; border-top: 1px solid #94a3b8; text-align: center; color: #526070; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <header>
    <div><h1>${this.escapeHtml(config.title)}</h1><p>${this.escapeHtml(config.subtitle)}</p></div>
    <p>Generated ${new Date().toLocaleDateString()}</p>
  </header>
  <table>
    <thead><tr>${config.columns.map((column) => `<th>${this.escapeHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>${tableRows || `<tr><td colspan="${config.columns.length}">No records</td></tr>`}</tbody>
  </table>
  ${config.summary}
  <footer><div>Prepared By</div><div>Verified By</div><div>Approved / Stamp</div></footer>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 150));</script>
</body>
</html>`);
    reportWindow.document.close();
  }

  private countFromNotes(notes: string, label: string): number {
    const match = notes.match(new RegExp(`${label}\\s*[-:]\\s*(\\d+)`, "i"));
    return match ? Number(match[1]) : 0;
  }

  private moneyNumber(value: unknown): number {
    const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private updateClientCell(row: TableRow, key: string, value: string) {
    const clientId = String(row["clientId"] || "");
    if (!clientId) return;

    if (key === "clientName") this.data.updateClient(clientId, { name: value || "Unnamed Client" });
    if (key === "mobile") this.data.updateClient(clientId, { mobile: value });
    if (key === "address") this.data.updateClient(clientId, { address: value });
    if (key === "supervisor") this.data.updateClient(clientId, { supervisor: value || "Unassigned" });
    if (key === "status") this.data.updateClient(clientId, { status: this.normalizeClientStatus(value) });
  }

  private normalizeClientStatus(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "completed") return "Completed";
    if (normalized === "on hold" || normalized === "hold") return "On Hold";
    return "Active";
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
