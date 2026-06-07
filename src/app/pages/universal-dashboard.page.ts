import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import { ErpDataService, type SharedTableField, type SharedTableRow } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, formatNumber, statusClass } from "../shared/format";

type DashboardModule = "materials" | "clients" | "labour" | "expenses" | "generalExpenses" | "payments" | "vendors" | "reports";
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
    description: "Every labour row across sites, with site, category, present, absentee, shift, overtime, and wage fields.",
    columns: [
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "labourName", label: "Labour Name" },
      { key: "category", label: "Category" },
      { key: "present", label: "Present" },
      { key: "absent", label: "Absent" },
      { key: "shift", label: "Shift" },
      { key: "overtime", label: "Overtime" },
      { key: "lateFine", label: "Late Fine" },
      { key: "weeklyPayable", label: "Weekly Payable" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "status", label: "Status" },
    ],
    filters: [
      { key: "site", label: "Site" },
      { key: "category", label: "Category" },
      { key: "present", label: "Present" },
      { key: "absent", label: "Absent" },
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
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "supervisor", label: "Supervisor" },
      { key: "cashIssued", label: "Cash Issued" },
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
      { key: "phoneNumber", label: "Phone Number" },
      { key: "address", label: "Address" },
      { key: "gstNumber", label: "GST Number" },
      { key: "purchaseHistory", label: "Purchase History" },
    ],
    filters: [
      { key: "materialType", label: "Material Type" },
      { key: "vendorName", label: "Vendor" },
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
          metaLabel="Company-wide view"
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
                  <button type="button" class="primary-table-action" (click)="openRecordDialog()">
                    <ion-icon name="add-outline"></ion-icon>
                    Add Record
                  </button>
                  <button type="button" (click)="openFieldDialog()">Add Field</button>
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
                        [attr.contenteditable]="isReadonlyColumn(column.key) ? null : 'true'"
                        [class.readonly-cell]="isReadonlyColumn(column.key)"
                        spellcheck="false"
                        (blur)="!isReadonlyColumn(column.key) && updateCell(rowIndex, column.key, $any($event.target).textContent || '')"
                      >
                        {{ row[column.key] }}
                      </td>
                      <td class="row-actions">
                        <button type="button" (click)="deleteRow(row)">Delete</button>
                      </td>
                    </tr>
                    <tr *ngIf="visibleRows().length === 0">
                      <td class="empty-row" [attr.colspan]="columnsForActive().length + 1">
                        <div class="empty-record-state icon-only" aria-label="No records in this table">
                          <span class="empty-box-icon" aria-hidden="true">
                            <svg viewBox="0 0 226.512 226.512" aria-hidden="true">
                              <path d="M186.268,9.011H38.929c0,0-3.04,0-6.799,0c-3.753,0-8.577,4.536-10.764,10.128L3.009,65.958 c-2.187,5.591-3.47,14.974-2.856,20.951l12.287,119.774c0.609,5.978,5.983,10.818,11.988,10.818h177.672 c6.005,0,11.379-4.846,11.988-10.818l12.287-119.774c0.609-5.978-0.87-15.273-3.312-20.755l-21.414-47.238 C199.158,13.444,192.272,9.011,186.268,9.011z M148.162,148.615H78.362c-6.005,0-10.878-4.873-10.878-10.878v-24.476 c0-6.005,4.873-10.878,10.878-10.878h69.799c6.005,0,10.878,4.873,10.878,10.878v24.476 C159.04,143.742,154.166,148.615,148.162,148.615z M28.834,68.514l6.88-20.201c1.936-5.684,8.376-10.296,14.386-10.296h122.896 c6.005,0,12.863,4.444,15.311,9.932l9.361,20.935c2.448,5.488-0.435,9.932-6.445,9.932H36.209 C30.199,78.816,26.898,74.204,28.834,68.514z" />
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
                    <input [type]="column.type || 'text'" [value]="draftRow()[column.key] || ''" (input)="updateDraftField(column.key, $any($event.target).value)" />
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
    return this.rowsFor(this.activeModule()).filter((row) => {
      const matchesSearch = !query || Object.values(row).some((value) => String(value).toLowerCase().includes(query));
      const matchesFilters = Object.entries(filters).every(([key, value]) => !value || String(row[key]) === value);
      return matchesSearch && matchesFilters;
    });
  }

  filterValues(key: string): string[] {
    const values = new Set<string>();
    for (const row of this.rowsFor(this.activeModule())) {
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
    return key === "clientId" || key === "vendorId";
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
    for (const column of this.columnsForActive()) row[column.key] = "";
    this.draftRow.set(row);
    this.recordDialogOpen.set(true);
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

  openClients() {
    void this.router.navigate(["/clients"]);
  }

  private buildRows(): Record<DashboardModule, TableRow[]> {
    const projectById = (projectId: string) => this.data.projectById(projectId);
    const projectName = (projectId: string) => projectById(projectId)?.name ?? projectId;
    const clientName = (projectId: string) => projectById(projectId)?.client ?? "";

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
      project: projectName(row.projectId),
      site: row.site,
      labourName: row.party,
      category: row.category,
      present: `${row.presentDays} days / ${row.presentCount} staff`,
      absent: row.absentDays,
      shift: row.shift,
      overtime: `${row.overtime} hrs`,
      lateFine: formatMoney(row.lateFine),
      weeklyPayable: formatMoney(row.dailyWage * row.presentDays * row.presentCount + row.overtime * 175 - row.lateFine),
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
      description: row.description,
      amount: formatMoney(row.spent),
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
      phoneNumber: vendor.phone,
      address: vendor.address,
      gstNumber: vendor.gst,
      purchaseHistory: "Available",
    }));

    const reports = [
      ["Financial", "Payment Collection Report", "All projects", "Accountant", "Excel", "Ready"],
      ["Financial", "Expense Report", "All sites", "Admin", "Excel", "Ready"],
      ["Labour", "Attendance Report", "All labour", "Project Manager", "Excel", "Ready"],
      ["Material", "Inventory Report", "All materials", "Project Manager", "Excel", "Ready"],
      ["Vendor", "Vendor Purchase Report", "All vendors", "Admin", "Excel", "Ready"],
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

    return { materials, clients, labour, expenses, generalExpenses, payments, vendors, reports };
  }

  private rowsFor(module: DashboardModule): TableRow[] {
    return this.data.tableRowsFor(module, this.buildRows()[module]);
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
