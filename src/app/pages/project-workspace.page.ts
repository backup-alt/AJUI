import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import type { Project, ProjectStatus } from "../../data/dashboardData";
import { ErpDataService, type SharedModuleKey, type SharedTableField, type SharedTableRow } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, formatNumber, statusClass } from "../shared/format";
import { ProjectFormDialogComponent, type ProjectFormValue } from "../shared/project-form-dialog.component";

type ModuleKey = Exclude<SharedModuleKey, "clients" | "generalExpenses" | "settings" | "supervisors">;
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
      { key: "attendanceDate", label: "Date", type: "date" },
      { key: "labourName", label: "Labour Name" },
      { key: "category", label: "Category" },
      { key: "site", label: "Site" },
      { key: "attendance", label: "Attendance" },
      { key: "shift", label: "Shift" },
      { key: "overtime", label: "Overtime" },
      { key: "dailyPay", label: "Daily Labour Pay" },
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
      { key: "transactionType", label: "Transaction Type" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "openingBalance", label: "Opening Balance" },
      { key: "runningBalance", label: "Balance" },
      { key: "site", label: "Site" },
      { key: "supervisor", label: "Supervisor" },
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
    key: "subcontractors",
    label: "Subcontracts",
    title: "Subcontractor Register",
    description: "Project subcontractor work packages with site, value, advances, due dates, supervisor, and payment status.",
    columns: [
      { key: "site", label: "Site" },
      { key: "subcontractorName", label: "Subcontractor Name" },
      { key: "workPackage", label: "Work Package" },
      { key: "contractValue", label: "Contract Value" },
      { key: "advancePaid", label: "Advance Paid" },
      { key: "balance", label: "Balance" },
      { key: "startDate", label: "Start Date", type: "date" },
      { key: "dueDate", label: "Due Date", type: "date" },
      { key: "supervisor", label: "Supervisor" },
      { key: "approvalStatus", label: "Approval Status" },
      { key: "paymentStatus", label: "Payment Status" },
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
];

@Component({
  standalone: true,
  imports: [
    CommonModule,
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
        <agb-enterprise-header
          title="Project Workspace"
          eyebrow="Project Operations"
          metaLabel="Site records"
          [blurred]="recordDialogOpen() || fieldDialogOpen() || showProjectForm()"
          [showTitle]="false"
          role="Admin"
          searchPlaceholder="Search table records..."
        />

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
                <div>
                  <dt>Status</dt>
                  <dd>
                    <label class="status-edit-shell" [ngClass]="statusClass(currentProject.status)">
                      <span class="sr-only">Project status</span>
                      <select [value]="currentProject.status" (change)="updateProjectStatus($any($event.target).value)">
                        <option value="Active">Active</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </label>
                  </dd>
                </div>
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
                      <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <form *ngIf="siteDraftOpen()" class="site-add-form" (submit)="saveSite($event)">
                      <input
                        [value]="siteDraftName()"
                        (input)="siteDraftName.set($any($event.target).value)"
                        placeholder="New site"
                      />
                      <button type="submit" class="site-confirm" aria-label="Add site">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                        <span>Add</span>
                      </button>
                      <button type="button" class="site-cancel" aria-label="Cancel site" (click)="siteDraftOpen.set(false)">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                          <path d="M6 6l12 12" />
                          <path d="M18 6 6 18" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
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
                  <button type="button" class="primary-table-action add-row-action" title="Add row" aria-label="Add row" (click)="addInlineRow()">
                    <ion-icon name="add-outline"></ion-icon>
                    Add Row
                  </button>
                  <button type="button" (click)="openFieldDialog()">Add Field</button>
                  <button type="button" (click)="exportPdf()"><ion-icon name="document-text-outline"></ion-icon>PDF Report</button>
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
                        [class.readonly-cell]="isReadonlyColumn(column.key)"
                        [class.select-cell]="selectOptions(activeSection(), column.key).length > 0"
                      >
                        <select
                          *ngIf="selectOptions(activeSection(), column.key).length > 0; else editableProjectCell"
                          [value]="row[column.key] || ''"
                          (change)="updateCell(activeSection(), rowIndex, column.key, $any($event.target).value)"
                        >
                          <option *ngFor="let option of selectOptions(activeSection(), column.key)" [value]="option">{{ option }}</option>
                        </select>
                        <ng-template #editableProjectCell>
                          <span
                            class="editable-cell"
                            [attr.contenteditable]="isReadonlyColumn(column.key) ? null : 'true'"
                            spellcheck="false"
                            (blur)="!isReadonlyColumn(column.key) && updateCell(activeSection(), rowIndex, column.key, $any($event.target).textContent || '')"
                          >
                            {{ row[column.key] }}
                          </span>
                        </ng-template>
                      </td>
                      <td class="row-actions">
                        <button type="button" (click)="deleteRow(row)">Delete</button>
                      </td>
                    </tr>
                    <tr *ngIf="visibleRows(activeSection()).length === 0">
                      <td class="empty-row" [attr.colspan]="columnsFor(activeSection()).length + 1">
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
    if (query) rows = rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query)));
    return this.withComputedRows(section, rows);
  }

  addInlineRow() {
    const section = this.activeSection();
    const currentProject = this.project();
    this.data.addCustomRow(section, {
      ...this.defaultRowFor(section),
      __projectId: this.projectId(),
      projectId: this.projectId(),
      client: currentProject?.client ?? "",
      project: currentProject?.name ?? "",
      expenseScope: section === "expenses" ? "Site" : undefined,
    });
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
    return section === "materials" || section === "labour" || section === "expenses" || section === "subcontractors";
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
    if (this.isReadonlyColumn(key)) return;
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

  exportPdf() {
    const section = this.activeSection();
    const columns = this.reportColumns(section);
    const rows = this.reportRows(section, this.visibleRows(section));
    const currentProject = this.project();
    const summary = section === "labour" ? this.labourSummaryHtml(rows) : section === "expenses" ? this.expenseSummaryHtml(rows) : "";
    this.openPrintableReport({
      title: section === "labour" ? "Labour Attendance Report" : section === "expenses" ? "Expense Ledger Report" : this.activeConfig().title,
      subtitle: `${currentProject?.name ?? this.projectId()} - ${this.activeSiteFilter() === "All" ? "All Sites" : this.activeSiteFilter()}`,
      columns,
      rows,
      summary,
    });
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
      status: project.status,
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

  updateProjectStatus(value: string) {
    if (!this.isProjectStatus(value)) return;
    this.data.updateProject(this.projectId(), { status: value });
  }

  deleteProject(project: Project) {
    const confirmed = window.confirm(`Delete ${project.name}? This removes the project from this client.`);
    if (!confirmed) return;
    const deletingCurrent = project.id === this.projectId();
    this.data.deleteProject(project.id);
    if (deletingCurrent) {
      const nextProject = this.data.firstProjectForClient(this.client());
      if (nextProject) {
        void this.router.navigate(["/clients", this.clientId(), "projects", nextProject.id, this.activeSection()]);
      } else {
        void this.router.navigate(["/clients", this.clientId()]);
      }
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
      attendanceDate: "2026-06-05",
      labourName: row.party,
      category: row.category,
      site: row.site,
      attendance: "Present",
      shift: row.shift,
      overtime: `${row.overtime} hrs`,
      dailyPay: formatMoney(row.dailyWage),
      lateFine: formatMoney(row.lateFine),
      weeklyPayable: formatMoney(row.dailyWage * row.presentDays * row.presentCount + row.overtime * 175 - row.lateFine),
      presentUnits: row.presentDays * row.presentCount,
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
        transactionType: row.type,
        description: row.description,
        amount: formatMoney(row.spent),
        openingBalance: row.received ? formatMoney(row.received) : "",
        runningBalance: formatMoney(runningBalance),
        site: row.site,
        supervisor: row.supervisor,
        cashIssued: formatMoney(row.received),
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

    const subcontractors = this.data.subcontractorsForProject(projectId).map((row) => ({
      __rowId: `subcontractor:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      site: row.site,
      subcontractorName: row.name,
      workPackage: row.workPackage,
      contractValue: formatMoney(row.contractValue),
      advancePaid: formatMoney(row.advancePaid),
      balance: formatMoney(row.contractValue - row.advancePaid),
      startDate: row.startDate,
      dueDate: row.dueDate,
      supervisor: row.supervisor,
      approvalStatus: row.approvalStatus,
      paymentStatus: row.paymentStatus,
    }));

    const reports = [
      ["Financial", "Payment Collection Report", "Client receipt and pending receivable export", "Accountant", "PDF / Excel", "Ready"],
      ["Financial", "Expense Report", "Supervisor expense and bill reference export", "Admin", "PDF / Excel", "Ready"],
      ["Labour", "Attendance Report", "Site-wise attendance and wage export", "Project Manager", "Excel", "Ready"],
      ["Material", "Inventory Report", "Purchased, consumed, and remaining stock export", "Project Manager", "Excel", "Ready"],
      ["Subcontract", "Subcontractor Ledger", "Work package value, advance, balance, and status export", "Project Manager", "Excel", "Ready"],
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

    return {
      materials,
      labour,
      expenses,
      payments,
      vendors,
      subcontractors,
      reports,
    };
  }

  private normalizeSection(value: string | null): ModuleKey {
    return sectionConfigs.some((section) => section.key === value) ? (value as ModuleKey) : "materials";
  }

  private rowBelongsToProject(row: TableRow): boolean {
    const rowProjectId = row["__projectId"];
    return rowProjectId === undefined || rowProjectId === "" || String(rowProjectId) === this.projectId();
  }

  private isProjectStatus(value: string): value is ProjectStatus {
    return value === "Active" || value === "On Hold" || value === "Completed";
  }

  isReadonlyColumn(key: string): boolean {
    return key === "runningBalance" || key === "weeklyPayable" || key === "balance";
  }

  selectOptions(section: ModuleKey, key: string): string[] {
    if (section === "expenses" && key === "transactionType") {
      return [
        "Site Expense",
        "Opening Balance",
        "Cash Issued to Supervisor",
        "Payment Received from Annai Golden Builders Pvt Ltd",
        "Adjustment",
      ];
    }
    if (section === "labour" && key === "attendance") return ["Present", "Absent"];
    if (key === "approvalStatus" || key === "status") return ["Pending", "Approved", "Rejected"];
    if (key === "paymentMode") return ["Cash", "NEFT", "UPI", "Bank Transfer", "Cheque"];
    if (key === "paymentStatus") return ["Not Started", "Part Paid", "Paid"];
    return [];
  }

  private defaultRowFor(section: ModuleKey): TableRow {
    const today = new Date().toISOString().slice(0, 10);
    const site = this.activeSiteFilter() === "All" ? this.projectSites()[0] ?? "" : this.activeSiteFilter();
    const currentProject = this.project();
    const defaults: Record<ModuleKey, TableRow> = {
      materials: {
        site,
        materialName: "",
        unit: "",
        requestedQuantity: "",
        approvedQuantity: "",
        requestDate: today,
        vendor: "",
        poNumber: "",
        remainingStock: "",
        status: "Pending",
      },
      labour: {
        attendanceDate: today,
        labourName: "",
        category: "",
        site,
        attendance: "Present",
        shift: "Day",
        overtime: "0",
        dailyPay: "0",
        lateFine: "0",
        weeklyPayable: formatMoney(0),
        presentUnits: 1,
        paymentMode: "Cash",
        notes: "",
        status: "Pending",
      },
      expenses: {
        expenseDate: today,
        transactionType: "Site Expense",
        description: "",
        amount: "0",
        openingBalance: "",
        runningBalance: formatMoney(0),
        site,
        supervisor: currentProject?.supervisor ?? "",
        reference: "",
        approvalStatus: "Pending",
      },
      payments: {
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
        phoneNumber: "",
        address: "",
        gstNumber: "",
        purchaseHistory: "",
      },
      subcontractors: {
        site,
        subcontractorName: "",
        workPackage: "",
        contractValue: "0",
        advancePaid: "0",
        balance: formatMoney(0),
        startDate: today,
        dueDate: today,
        supervisor: currentProject?.supervisor ?? "",
        approvalStatus: "Pending",
        paymentStatus: "Not Started",
      },
      reports: {
        category: "",
        reportName: "",
        description: "",
        owner: "",
        exportFormat: "PDF / Excel",
        status: "Ready",
      },
    };
    return defaults[section];
  }

  private withComputedRows(section: ModuleKey, rows: TableRow[]): TableRow[] {
    if (section === "expenses") return this.withExpenseBalances(rows);
    if (section === "labour") return rows.map((row) => this.withLabourPayable(row));
    if (section === "subcontractors") {
      return rows.map((row) => ({
        ...row,
        balance: formatMoney(this.moneyNumber(row["contractValue"]) - this.moneyNumber(row["advancePaid"])),
      }));
    }
    return rows;
  }

  private withExpenseBalances(rows: TableRow[]): TableRow[] {
    let balance = 0;
    return rows.map((row) => {
      const transactionType = String(row["transactionType"] || row["expenseScope"] || "Site Expense");
      const openingBalance = this.moneyNumber(row["openingBalance"] ?? row["cashIssued"]);
      const amount = this.moneyNumber(row["amount"]);
      if (openingBalance) balance += openingBalance;
      if (amount) balance += this.isExpenseCredit(transactionType) ? amount : -amount;
      return {
        ...row,
        transactionType,
        openingBalance: openingBalance ? formatMoney(openingBalance) : row["openingBalance"] ?? "",
        runningBalance: formatMoney(balance),
      };
    });
  }

  private withLabourPayable(row: TableRow): TableRow {
    const attendance = String(row["attendance"] || "Present");
    const presentUnits = attendance.toLowerCase() === "absent" ? 0 : this.moneyNumber(row["presentUnits"] || 1) || 1;
    const dailyPay = this.moneyNumber(row["dailyPay"]);
    const overtime = this.moneyNumber(row["overtime"]);
    const lateFine = this.moneyNumber(row["lateFine"]);
    return {
      ...row,
      attendance,
      weeklyPayable: formatMoney(dailyPay * presentUnits + overtime * 175 - lateFine),
    };
  }

  private isExpenseCredit(transactionType: string): boolean {
    const normalized = transactionType.toLowerCase();
    return normalized.includes("payment") || normalized.includes("received") || normalized.includes("cash issued") || normalized.includes("opening");
  }

  private reportColumns(section: ModuleKey): FieldSchema[] {
    if (section === "expenses") {
      return [
        { key: "expenseDate", label: "Date" },
        { key: "transactionType", label: "Transaction Type" },
        { key: "description", label: "Description" },
        { key: "amount", label: "Amount" },
        { key: "runningBalance", label: "Balance" },
      ];
    }
    if (section === "labour") {
      return [
        { key: "attendanceDate", label: "Date" },
        { key: "labourName", label: "Staff Name" },
        { key: "attendance", label: "Attendance" },
        { key: "shift", label: "Shift" },
        { key: "overtimeLate", label: "Overtime / Late" },
        { key: "weeklyPayable", label: "Payable" },
      ];
    }
    return this.columnsFor(section);
  }

  private reportRows(section: ModuleKey, rows: TableRow[]): TableRow[] {
    if (section !== "labour") return rows;
    return rows.map((row) => ({
      ...row,
      overtimeLate: `${row["overtime"] || "0"} overtime / ${row["lateFine"] || "0"} late fine`,
    }));
  }

  private labourSummaryHtml(rows: TableRow[]): string {
    const summary = new Map<string, { present: number; absent: number; payable: number }>();
    for (const row of rows) {
      const name = String(row["labourName"] || "Unnamed");
      const current = summary.get(name) ?? { present: 0, absent: 0, payable: 0 };
      if (String(row["attendance"] || "").toLowerCase() === "absent") current.absent += 1;
      else current.present += 1;
      current.payable += this.moneyNumber(row["weeklyPayable"]);
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
    const spent = rows.reduce((sum, row) => sum + (this.isExpenseCredit(String(row["transactionType"] || "")) ? 0 : this.moneyNumber(row["amount"])), 0);
    const received = rows.reduce((sum, row) => sum + this.moneyNumber(row["openingBalance"]) + (this.isExpenseCredit(String(row["transactionType"] || "")) ? this.moneyNumber(row["amount"]) : 0), 0);
    const closing = rows.length ? String(rows[rows.length - 1]["runningBalance"] || formatMoney(0)) : formatMoney(0);
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

  private moneyNumber(value: unknown): number {
    const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
