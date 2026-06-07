import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { IonBadge, IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import type { Project } from "../../data/dashboardData";
import { ErpDataService, type SharedModuleKey, type SharedTableField, type SharedTableRow } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, formatNumber, statusClass } from "../shared/format";
import { ProjectFormDialogComponent, type ProjectFormValue } from "../shared/project-form-dialog.component";

type ModuleKey = Exclude<SharedModuleKey, "clients" | "generalExpenses">;
type TableRow = SharedTableRow;
type FieldSchema = SharedTableField;
type SectionConfig = {
  key: ModuleKey;
  label: string;
  title: string;
  description: string;
  columns: FieldSchema[];
};

const sectionConfigs: SectionConfig[] = [
  {
    key: "materials",
    label: "Materials",
    title: "Material Requests",
    description: "Fixed procurement fields for requests, approvals, vendors, purchase orders, and stock visibility.",
    columns: [
      { key: "site", label: "Site" },
      { key: "materialName", label: "Material Name" },
      { key: "unit", label: "Unit" },
      { key: "requestedQuantity", label: "Requested Quantity", type: "number" },
      { key: "approvedQuantity", label: "Approved Quantity", type: "number" },
      { key: "requestDate", label: "Request Date", type: "date" },
      { key: "vendor", label: "Vendor" },
      { key: "poNumber", label: "PO Number" },
      { key: "remainingStock", label: "Remaining Stock" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "labour",
    label: "Labour",
    title: "Labour Attendance",
    description: "Attendance and wage fields for site labour, shifts, overtime, fine, notes, and approvals.",
    columns: [
      { key: "labourName", label: "Labour Name" },
      { key: "category", label: "Category" },
      { key: "site", label: "Site" },
      { key: "present", label: "Present" },
      { key: "absent", label: "Absent", type: "number" },
      { key: "shift", label: "Shift" },
      { key: "overtime", label: "Overtime" },
      { key: "lateFine", label: "Late Fine" },
      { key: "weeklyPayable", label: "Weekly Payable" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "notes", label: "Notes" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "expenses",
    label: "Expenses",
    title: "Site Expense Ledger",
    description: "Supervisor cash ledger and site expense fields with bill reference and approval status.",
    columns: [
      { key: "expenseDate", label: "Expense Date", type: "date" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "site", label: "Site" },
      { key: "supervisor", label: "Supervisor" },
      { key: "cashIssued", label: "Cash Issued" },
      { key: "runningBalance", label: "Running Balance" },
      { key: "reference", label: "Bill / Reference" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    title: "Payment Ledger",
    description: "Client collection fields for dates, modes, receipts, transaction references, and approval checks.",
    columns: [
      { key: "paymentDate", label: "Payment Date", type: "date" },
      { key: "amount", label: "Amount" },
      { key: "mode", label: "Mode" },
      { key: "transactionReference", label: "Transaction Reference" },
      { key: "receiptNumber", label: "Receipt Number" },
      { key: "collectedBy", label: "Collected By" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
  },
  {
    key: "vendors",
    label: "Vendors",
    title: "Vendor Directory",
    description: "Vendor master fields for material type, contact, address, GST, and purchase history.",
    columns: [
      { key: "vendorName", label: "Vendor Name" },
      { key: "materialType", label: "Material Type" },
      { key: "phoneNumber", label: "Phone Number" },
      { key: "address", label: "Address" },
      { key: "gstNumber", label: "GST Number" },
      { key: "purchaseHistory", label: "Purchase History" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    title: "Reports Register",
    description: "Report fields for financial, labour, material, and project exports.",
    columns: [
      { key: "category", label: "Category" },
      { key: "reportName", label: "Report Name" },
      { key: "description", label: "Description" },
      { key: "owner", label: "Owner" },
      { key: "exportFormat", label: "Export Format" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    title: "Project Settings",
    description: "Project configuration fields kept in a table so admin users can adjust operational defaults.",
    columns: [
      { key: "setting", label: "Setting" },
      { key: "value", label: "Value" },
      { key: "owner", label: "Owner" },
      { key: "updated", label: "Updated" },
    ],
  },
];

@Component({
  standalone: true,
  imports: [
    CommonModule,
    IonBadge,
    IonContent,
    IonIcon,
    IonSplitPane,
    EnterpriseHeaderComponent,
    EnterpriseSidebarComponent,
    ProjectFormDialogComponent,
  ],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar
        [clientId]="clientId()"
        [projectId]="projectId()"
        active="projects"
        (newProject)="openCreateProject()"
        (editProject)="openEditProject($event)"
        (deleteProject)="deleteProject($event)"
      ></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header [showTitle]="false" role="Admin" searchPlaceholder="Search table records..." />

        <ion-content class="erp-page">
          <main class="workspace-shell" *ngIf="project() as currentProject">
            <nav class="workspace-breadcrumb" aria-label="Breadcrumb">
              <button type="button" (click)="backToClients()">Clients</button>
              <span>/</span>
              <button type="button" (click)="backToProjects()">{{ currentProject.client }}</button>
              <span>/</span>
              <strong>{{ currentProject.name }}</strong>
            </nav>

            <section class="project-compact-strip">
              <div>
                <span>{{ currentProject.id }}</span>
                <h1>{{ currentProject.name }}</h1>
                <p>{{ currentProject.client }} - {{ currentProject.address }}</p>
              </div>
              <dl>
                <div><dt>Value</dt><dd>{{ formatMoney(currentProject.totalValue) }}</dd></div>
                <div><dt>Received</dt><dd>{{ formatMoney(currentProject.receivedAmount) }}</dd></div>
                <div><dt>Pending</dt><dd>{{ formatMoney(currentProject.totalValue - currentProject.receivedAmount) }}</dd></div>
                <div><dt>Supervisor</dt><dd>{{ currentProject.supervisor }}</dd></div>
                <div><dt>Status</dt><dd><ion-badge class="status" [ngClass]="statusClass(currentProject.status)">{{ currentProject.status }}</ion-badge></dd></div>
              </dl>
            </section>

            <section class="operations-workbench universal-workbench project-workbench">
              <nav class="operations-tabs" aria-label="Project table modules">
                <button
                  *ngFor="let section of sections"
                  type="button"
                  [class.active]="activeSection() === section.key"
                  (click)="switchSection(section.key)"
                >
                  <span>{{ section.label }}</span>
                  <small>{{ visibleRows(section.key).length }}</small>
                </button>
              </nav>

              <div class="site-workbench" *ngIf="isSiteAware(activeSection())">
                <div class="site-switch-row">
                  <span>Site</span>
                  <div class="site-chip-strip">
                    <button type="button" [class.active]="activeSiteFilter() === 'All'" (click)="selectSite('All')">All Sites</button>
                    <button
                      *ngFor="let site of projectSites()"
                      type="button"
                      [class.active]="activeSiteFilter() === site"
                      (click)="selectSite(site)"
                    >
                      {{ site }}
                    </button>
                    <button *ngIf="!siteDraftOpen()" type="button" class="site-add-chip" aria-label="Add site" (click)="openSiteDraft()">
                      <ion-icon name="add-outline"></ion-icon>
                    </button>
                    <form *ngIf="siteDraftOpen()" class="site-add-form" (submit)="saveSite($event)">
                      <input
                        [value]="siteDraftName()"
                        (input)="siteDraftName.set($any($event.target).value)"
                        placeholder="New site"
                      />
                      <button type="submit"><ion-icon name="checkmark-outline"></ion-icon></button>
                      <button type="button" (click)="siteDraftOpen.set(false)"><ion-icon name="close-outline"></ion-icon></button>
                    </form>
                  </div>
                </div>
                <label class="labour-site-filter" *ngIf="activeSection() === 'labour'">
                  <span>Labour site filter</span>
                  <select [value]="activeSiteFilter()" (change)="selectSite($any($event.target).value)">
                    <option value="All">All Sites</option>
                    <option *ngFor="let site of projectSites()" [value]="site">{{ site }}</option>
                  </select>
                </label>
              </div>

              <div class="module-toolbar table-first-toolbar">
                <div>
                  <h2>{{ activeConfig().title }}</h2>
                  <p>{{ activeConfig().description }}</p>
                </div>
                <div class="table-actions">
                  <label class="table-search">
                    <ion-icon name="search-outline"></ion-icon>
                    <input [value]="tableSearch()" (input)="tableSearch.set($any($event.target).value)" placeholder="Search rows" />
                  </label>
                  <button type="button" class="primary-table-action" (click)="openRecordDialog()">
                    <ion-icon name="add-outline"></ion-icon>
                    Add Record
                  </button>
                  <button type="button" (click)="openFieldDialog()">Add Field</button>
                  <button type="button" (click)="exportExcel()"><ion-icon name="download-outline"></ion-icon>Export Excel</button>
                </div>
              </div>

              <div class="table-meta-strip">
                <span>{{ visibleRows(activeSection()).length }} rows</span>
                <span>{{ columnsFor(activeSection()).length }} fields</span>
                <span>Inline editable cells</span>
              </div>

              <div class="table-wrap operations-table">
                <table>
                  <thead>
                    <tr>
                      <th *ngFor="let column of columnsFor(activeSection())">{{ column.label }}</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of visibleRows(activeSection()); let rowIndex = index">
                      <td
                        *ngFor="let column of columnsFor(activeSection())"
                        contenteditable="true"
                        spellcheck="false"
                        (blur)="updateCell(activeSection(), rowIndex, column.key, $any($event.target).textContent || '')"
                      >
                        {{ row[column.key] }}
                      </td>
                      <td class="row-actions">
                        <button type="button" (click)="deleteRow(row)">Delete</button>
                      </td>
                    </tr>
                    <tr *ngIf="visibleRows(activeSection()).length === 0">
                      <td class="empty-row" [attr.colspan]="columnsFor(activeSection()).length + 1">
                        <button type="button" class="empty-add-record" (click)="openRecordDialog()">
                          <ion-icon name="add-outline"></ion-icon>
                          <span>Add first record</span>
                        </button>
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
                  <label *ngFor="let column of columnsFor(activeSection())">
                    <span>{{ column.label }}</span>
                    <input
                      [type]="column.type || 'text'"
                      [value]="draftRow()[column.key] || ''"
                      (input)="updateDraftField(column.key, $any($event.target).value)"
                    />
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
                    <input [value]="newFieldLabel()" (input)="newFieldLabel.set($any($event.target).value)" placeholder="Example: Bill Checked By" />
                  </label>
                </div>
                <div class="dialog-actions">
                  <button type="button" class="secondary-action" (click)="fieldDialogOpen.set(false)">Cancel</button>
                  <button type="submit" class="primary-action">Add Field</button>
                </div>
              </form>
            </section>

            <agb-project-form-dialog
              *ngIf="showProjectForm() && client() as currentClient"
              [clientName]="currentClient.name"
              [defaultSupervisor]="currentClient.supervisor"
              [initialValue]="editingProjectValue()"
              [eyebrow]="editingProject() ? 'Project Edit' : 'Project Setup'"
              [title]="editingProject() ? 'Edit Project' : 'Create New Project'"
              [submitLabel]="editingProject() ? 'Save Project' : 'Create Project'"
              (cancel)="showProjectForm.set(false)"
              (create)="saveProject($event)"
            ></agb-project-form-dialog>
          </main>
        </ion-content>
      </div>
    </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectWorkspacePage {
  readonly data = inject(ErpDataService);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly paramMap = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;
  readonly showProjectForm = signal(false);
  readonly editingProject = signal<Project | null>(null);
  readonly sections = sectionConfigs;
  readonly activeSection = signal<ModuleKey>(this.normalizeSection(this.route.snapshot.paramMap.get("section")));
  readonly tableSearch = signal("");
  readonly recordDialogOpen = signal(false);
  readonly fieldDialogOpen = signal(false);
  readonly newFieldLabel = signal("");
  readonly draftRow = signal<TableRow>({});
  readonly activeSite = signal("All");
  readonly siteDraftOpen = signal(false);
  readonly siteDraftName = signal("");
  readonly tableRows = computed<Record<ModuleKey, TableRow[]>>(() => this.buildInitialRows(this.projectId()));

  readonly clientId = computed(() => this.paramMap().get("clientId") ?? "");
  readonly projectId = computed(() => this.paramMap().get("projectId") ?? "");
  readonly client = computed(() => this.data.clientById(this.clientId()));
  readonly project = computed(() => this.data.projectById(this.projectId()));
  readonly projectSites = computed(() => this.project()?.sites ?? []);
  readonly activeSiteFilter = computed(() => {
    const site = this.activeSite();
    return site === "All" || this.projectSites().includes(site) ? site : "All";
  });
  readonly activeConfig = computed(() => sectionConfigs.find((section) => section.key === this.activeSection()) ?? sectionConfigs[0]);

  switchSection(section: ModuleKey) {
    this.activeSection.set(section);
    this.tableSearch.set("");
    void this.router.navigate(["/clients", this.clientId(), "projects", this.projectId(), section]);
  }

  columnsFor(section: ModuleKey): FieldSchema[] {
    const base = sectionConfigs.find((config) => config.key === section)?.columns ?? [];
    return [...base, ...this.data.customFieldsFor(section)];
  }

  visibleRows(section: ModuleKey): TableRow[] {
    const query = this.tableSearch().trim().toLowerCase();
    let rows = this.data.tableRowsFor(section, this.tableRows()[section] ?? [], (row) => this.rowBelongsToProject(row));
    const site = this.activeSiteFilter();
    if (this.isSiteAware(section) && site !== "All") {
      rows = rows.filter((row) => String(row["site"] ?? "").toLowerCase() === site.toLowerCase());
    }
    if (!query) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query)));
  }

  openRecordDialog() {
    const row: TableRow = {};
    for (const column of this.columnsFor(this.activeSection())) {
      row[column.key] = column.key === "site" && this.activeSiteFilter() !== "All" ? this.activeSiteFilter() : "";
    }
    this.draftRow.set(row);
    this.recordDialogOpen.set(true);
  }

  updateDraftField(key: string, value: string) {
    this.draftRow.update((row) => ({ ...row, [key]: value }));
  }

  saveRecord(event: Event) {
    event.preventDefault();
    const section = this.activeSection();
    const currentProject = this.project();
    const selectedSite = this.activeSiteFilter();
    this.data.addCustomRow(section, {
      ...this.draftRow(),
      ...(this.isSiteAware(section) && selectedSite !== "All" ? { site: this.draftRow()["site"] || selectedSite } : {}),
      __projectId: this.projectId(),
      projectId: this.projectId(),
      client: currentProject?.client ?? "",
      project: currentProject?.name ?? "",
      expenseScope: section === "expenses" ? "Site" : undefined,
    });
    this.recordDialogOpen.set(false);
  }

  isSiteAware(section: ModuleKey): boolean {
    return section === "materials" || section === "labour" || section === "expenses";
  }

  selectSite(site: string) {
    this.activeSite.set(site);
    this.tableSearch.set("");
  }

  openSiteDraft() {
    this.siteDraftName.set("");
    this.siteDraftOpen.set(true);
  }

  saveSite(event: Event) {
    event.preventDefault();
    const site = this.siteDraftName().trim();
    if (!site) return;
    this.data.addSiteToProject(this.projectId(), site);
    this.activeSite.set(site);
    this.siteDraftOpen.set(false);
  }

  openFieldDialog() {
    this.newFieldLabel.set("");
    this.fieldDialogOpen.set(true);
  }

  saveField(event: Event) {
    event.preventDefault();
    const label = this.newFieldLabel().trim();
    if (!label) return;
    const section = this.activeSection();
    this.data.addCustomField(section, label, this.columnsFor(section));
    this.fieldDialogOpen.set(false);
  }

  updateCell(section: ModuleKey, visibleIndex: number, key: string, value: string) {
    const target = this.visibleRows(section)[visibleIndex];
    if (!target) return;
    const rowId = String(target["__rowId"] || "");
    if (rowId) this.data.updateSharedRowCell(rowId, key, value.trim());
  }

  deleteRow(row: TableRow) {
    this.data.deleteSharedRow(String(row["__rowId"] || ""));
  }

  exportExcel() {
    const section = this.activeSection();
    const columns = this.columnsFor(section);
    const rows = this.visibleRows(section);
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
    anchor.download = `annai-${this.projectId()}-${section}-${new Date().toISOString().slice(0, 10)}.xls`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  backToClients() {
    void this.router.navigate(["/clients"]);
  }

  backToProjects() {
    void this.router.navigate(["/clients", this.clientId()]);
  }

  openCreateProject() {
    this.editingProject.set(null);
    this.showProjectForm.set(true);
  }

  openEditProject(project: Project) {
    this.editingProject.set(project);
    this.showProjectForm.set(true);
  }

  editingProjectValue(): ProjectFormValue | null {
    const project = this.editingProject();
    if (!project) return null;
    return {
      name: project.name,
      sites: project.sites,
      startDate: project.startDate,
      supervisor: project.supervisor,
      totalValue: project.totalValue,
      advanceAmount: project.advanceAmount,
    };
  }

  saveProject(value: ProjectFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.startDate || !value.supervisor || !value.totalValue) return;
    const editing = this.editingProject();
    if (editing) {
      const updated = this.data.updateProject(editing.id, value);
      this.editingProject.set(null);
      this.showProjectForm.set(false);
      if (updated && editing.id === this.projectId()) {
        void this.router.navigate(["/clients", currentClient.id, "projects", updated.id, this.activeSection()]);
      }
      return;
    }
    const project = this.data.addProject(currentClient, value);
    this.showProjectForm.set(false);
    setTimeout(() => void this.router.navigate(["/clients", currentClient.id, "projects", project.id, "materials"]));
  }

  deleteProject(project: Project) {
    const confirmed = window.confirm(`Delete ${project.name}? This removes the project from this client.`);
    if (!confirmed) return;
    const deletingCurrent = project.id === this.projectId();
    this.data.deleteProject(project.id);
    if (deletingCurrent) {
      void this.router.navigate(["/clients", this.clientId()]);
    }
  }

  private buildInitialRows(projectId: string): Record<ModuleKey, TableRow[]> {
    const materials = this.data.materialsForProject(projectId).map((row) => ({
      __rowId: `material:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      site: row.site,
      materialName: row.name,
      unit: row.unit,
      requestedQuantity: formatNumber(row.requested),
      approvedQuantity: formatNumber(row.approved),
      requestDate: "2026-06-05",
      vendor: row.vendor,
      poNumber: row.poNumber,
      remainingStock: `${formatNumber(row.purchased - row.consumed)} ${row.unit}`,
      status: row.status,
    }));

    const labour = this.data.labourForProject(projectId).map((row) => ({
      __rowId: `labour:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      labourName: row.party,
      category: row.category,
      site: row.site,
      present: `${row.presentDays} days / ${row.presentCount} staff`,
      absent: row.absentDays,
      shift: row.shift,
      overtime: `${row.overtime} hrs`,
      lateFine: formatMoney(row.lateFine),
      weeklyPayable: formatMoney(row.dailyWage * row.presentDays * row.presentCount + row.overtime * 175 - row.lateFine),
      paymentMode: row.paymentMode,
      notes: row.notes,
      status: row.status,
    }));

    let runningBalance = this.data.projectById(projectId)?.expenseBalance ?? 0;
    const expenses = this.data.expensesForProject(projectId).filter((row) => row.type === "Site Expense").map((row) => {
      runningBalance += row.received - row.spent;
      return {
        __rowId: `expense:${row.id}`,
        __projectId: row.projectId,
        projectId: row.projectId,
        expenseScope: row.type,
        expenseDate: row.date,
        description: row.description,
        amount: formatMoney(row.spent),
        site: row.site,
        supervisor: row.supervisor,
        cashIssued: formatMoney(row.received),
        runningBalance: formatMoney(runningBalance),
        reference: row.reference,
        approvalStatus: row.status,
      };
    });

    const payments = this.data.paymentsForProject(projectId).map((row) => ({
      __rowId: `payment:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
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
      __projectId: projectId,
      projectId,
      vendorName: vendor.name,
      materialType: vendor.materialType,
      phoneNumber: vendor.phone,
      address: vendor.address,
      gstNumber: vendor.gst,
      purchaseHistory: "View History",
    }));

    const reports = [
      ["Financial", "Payment Collection Report", "Client receipt and pending receivable export", "Accountant", "PDF / Excel", "Ready"],
      ["Financial", "Expense Report", "Supervisor expense and bill reference export", "Admin", "PDF / Excel", "Ready"],
      ["Labour", "Attendance Report", "Site-wise attendance and wage export", "Project Manager", "Excel", "Ready"],
      ["Material", "Inventory Report", "Purchased, consumed, and remaining stock export", "Project Manager", "Excel", "Ready"],
      ["Project", "Project Summary", "Project value, progress, sites, and status export", "Admin", "PDF", "Ready"],
    ].map(([category, reportName, description, owner, exportFormat, status], index) => ({
      __rowId: `project-report:${projectId}:${index}`,
      __projectId: projectId,
      projectId,
      category,
      reportName,
      description,
      owner,
      exportFormat,
      status,
    }));

    const project = this.data.projectById(projectId);
    const settings = [
      { __rowId: `setting:${projectId}:name`, __projectId: projectId, projectId, setting: "Project Name", value: project?.name ?? "", owner: "Admin", updated: "Today" },
      { __rowId: `setting:${projectId}:supervisor`, __projectId: projectId, projectId, setting: "Assigned Supervisor", value: project?.supervisor ?? "", owner: "Admin", updated: "Today" },
      { __rowId: `setting:${projectId}:status`, __projectId: projectId, projectId, setting: "Status", value: project?.status ?? "", owner: "Project Manager", updated: "Today" },
      { __rowId: `setting:${projectId}:module`, __projectId: projectId, projectId, setting: "Default Module", value: "Materials", owner: "Admin", updated: "Today" },
    ];

    return {
      materials,
      labour,
      expenses,
      payments,
      vendors,
      reports,
      settings,
    };
  }

  private normalizeSection(value: string | null): ModuleKey {
    return sectionConfigs.some((section) => section.key === value) ? (value as ModuleKey) : "materials";
  }

  private rowBelongsToProject(row: TableRow): boolean {
    const rowProjectId = row["__projectId"];
    return rowProjectId === undefined || rowProjectId === "" || String(rowProjectId) === this.projectId();
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
