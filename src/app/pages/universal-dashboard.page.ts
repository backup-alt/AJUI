import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import { ErpDataService } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, formatNumber, statusClass } from "../shared/format";

type DashboardModule = "materials" | "clients" | "labour" | "expenses" | "payments" | "vendors" | "reports";
type FieldType = "text" | "number" | "date";
type TableRow = Record<string, string | number>;
type FieldSchema = { key: string; label: string; type?: FieldType };
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
    label: "Expenses",
    title: "All Expense Details",
    description: "Every supervisor ledger and site expense detail across active projects.",
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
        <agb-enterprise-header [showTitle]="false" role="Admin" searchPlaceholder="Search universal dashboard..." />

        <ion-content class="erp-page">
          <main class="workspace-shell">
            <section class="dashboard-command-strip">
              <div>
                <span>Universal Operations</span>
                <h1>Central Dashboard</h1>
                <p>All clients, projects, material, labour, expenses, payments, vendors, and reports in one table-first workspace.</p>
              </div>
              <div class="dashboard-kpi-strip">
                <div><span>Clients</span><strong>{{ data.clients().length }}</strong></div>
                <div><span>Projects</span><strong>{{ data.projects().length }}</strong></div>
                <div><span>Materials</span><strong>{{ data.materials().length }}</strong></div>
                <div><span>Payments</span><strong>{{ formatMoney(totalReceived()) }}</strong></div>
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
                  {{ module.label }}
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
                <span>{{ activeConfig().filters.length }} filters</span>
                <span>Inline editable cells</span>
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
                        contenteditable="true"
                        spellcheck="false"
                        (blur)="updateCell(rowIndex, column.key, $any($event.target).textContent || '')"
                      >
                        {{ row[column.key] }}
                      </td>
                      <td class="row-actions">
                        <button type="button" (click)="duplicateRow(row)">Duplicate</button>
                        <button type="button" (click)="deleteRow(row)">Delete</button>
                      </td>
                    </tr>
                    <tr *ngIf="visibleRows().length === 0">
                      <td class="empty-row" [attr.colspan]="columnsForActive().length + 1">No records match the current filters.</td>
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
                    <h2>Add Universal Record</h2>
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
  readonly activeModule = signal<DashboardModule>("materials");
  readonly searchText = signal("");
  readonly selectedFilters = signal<Record<string, string>>({});
  readonly recordDialogOpen = signal(false);
  readonly fieldDialogOpen = signal(false);
  readonly draftRow = signal<TableRow>({});
  readonly newFieldLabel = signal("");
  readonly customColumns = signal<Record<DashboardModule, FieldSchema[]>>(this.emptyColumnMap());
  readonly tableRows = signal<Record<DashboardModule, TableRow[]>>(this.buildRows());
  readonly activeConfig = computed(() => dashboardModules.find((module) => module.key === this.activeModule()) ?? dashboardModules[0]);

  totalReceived() {
    return this.data.projects().reduce((sum, project) => sum + project.receivedAmount, 0);
  }

  switchModule(module: DashboardModule) {
    this.activeModule.set(module);
    this.searchText.set("");
    this.selectedFilters.set({});
  }

  columnsForActive(): FieldSchema[] {
    const base = this.activeConfig().columns;
    return [...base, ...this.customColumns()[this.activeModule()]];
  }

  visibleRows(): TableRow[] {
    const query = this.searchText().trim().toLowerCase();
    const filters = this.selectedFilters();
    return this.tableRows()[this.activeModule()].filter((row) => {
      const matchesSearch = !query || Object.values(row).some((value) => String(value).toLowerCase().includes(query));
      const matchesFilters = Object.entries(filters).every(([key, value]) => !value || String(row[key]) === value);
      return matchesSearch && matchesFilters;
    });
  }

  filterValues(key: string): string[] {
    const values = new Set<string>();
    for (const row of this.tableRows()[this.activeModule()]) {
      const value = row[key];
      if (value !== undefined && value !== "") values.add(String(value));
    }
    return [...values].sort((a, b) => a.localeCompare(b));
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
    this.tableRows.update((rows) => ({ ...rows, [module]: [{ ...this.draftRow() }, ...rows[module]] }));
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
    const key = this.fieldKey(label, this.columnsForActive());
    this.customColumns.update((columns) => ({ ...columns, [module]: [...columns[module], { key, label }] }));
    this.tableRows.update((rows) => ({ ...rows, [module]: rows[module].map((row) => ({ ...row, [key]: "" })) }));
    this.fieldDialogOpen.set(false);
  }

  updateCell(visibleIndex: number, key: string, value: string) {
    const target = this.visibleRows()[visibleIndex];
    if (!target) return;
    const module = this.activeModule();
    this.tableRows.update((rows) => ({
      ...rows,
      [module]: rows[module].map((row) => (row === target ? { ...row, [key]: value.trim() } : row)),
    }));
  }

  duplicateRow(row: TableRow) {
    const module = this.activeModule();
    this.tableRows.update((rows) => ({ ...rows, [module]: [{ ...row }, ...rows[module]] }));
  }

  deleteRow(row: TableRow) {
    const module = this.activeModule();
    this.tableRows.update((rows) => ({ ...rows, [module]: rows[module].filter((existingRow) => existingRow !== row) }));
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

    const expenses = this.data.expenses().map((row) => ({
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

    const payments = this.data.payments().map((row) => ({
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
    ].map(([category, reportName, scope, owner, exportFormat, status]) => ({ category, reportName, scope, owner, exportFormat, status }));

    return { materials, clients, labour, expenses, payments, vendors, reports };
  }

  private emptyColumnMap(): Record<DashboardModule, FieldSchema[]> {
    return { materials: [], clients: [], labour: [], expenses: [], payments: [], vendors: [], reports: [] };
  }

  private fieldKey(label: string, existingColumns: FieldSchema[]): string {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const candidate = base || `custom-${Date.now()}`;
    const existing = new Set(existingColumns.map((column) => column.key));
    if (!existing.has(candidate)) return candidate;
    let index = 2;
    while (existing.has(`${candidate}-${index}`)) index += 1;
    return `${candidate}-${index}`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
