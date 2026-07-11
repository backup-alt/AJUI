import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from "@angular/core";
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
type FilterBuilderStep = "fields" | "values";
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
    description: "Staff attendance with site, date, staff name, labour types, staff count, shift count, overtime, and fine.",
    columns: [
      { key: "client", label: "Client" },
      { key: "clientId", label: "Client ID" },
      { key: "projectId", label: "Project ID" },
      { key: "site", label: "Site" },
      { key: "attendanceDate", label: "Date", type: "date" },
      { key: "staffName", label: "Staff Name" },
      { key: "labourTypes", label: "Labour Types" },
      { key: "staffCount", label: "Staff Count", type: "number" },
      { key: "attendance", label: "Attendance" },
      { key: "shift", label: "Shift", type: "number" },
      { key: "overtime", label: "Overtime" },
      { key: "lateFine", label: "Late Fine" },
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
      { key: "siteMaterial", label: "Site Material" },
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
      { key: "materialsBought", label: "Materials Bought" },
      { key: "phoneNumber", label: "Phone Number" },
      { key: "address", label: "Address" },
      { key: "gstNumber", label: "GST Number" },
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
    ],
  },
];

const siteMaterialDetailFields: FieldSchema[] = [
  { key: "materialName", label: "Material Name" },
  { key: "unit", label: "Unit" },
  { key: "requestedQuantity", label: "Requested Quantity", type: "number" },
  { key: "vendor", label: "Vendor Name" },
  { key: "requestDate", label: "Request Date", type: "date" },
  { key: "poNumber", label: "PO Number" },
  { key: "remainingStock", label: "Remaining Stock" },
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
          [blurred]="recordDialogOpen() || fieldDialogOpen() || labourTypeDialogOpen() || filterBuilderOpen() || showProjectForm()"
          [showTitle]="false"
          searchPlaceholder="Search"
        />

        <ion-content class="erp-page">
          <main class="workspace-shell" [class.table-view-expanded]="tableViewExpanded()" *ngIf="project() as currentProject">
            <nav class="workspace-breadcrumb" aria-label="Breadcrumb" *ngIf="!tableViewExpanded()">
              <button type="button" (click)="backToClients()">Clients</button>
              <span>/</span>
              <button type="button" (click)="backToProjects()">{{ currentProject.client }}</button>
              <span>/</span>
              <strong>{{ currentProject.name }}</strong>
            </nav>

            <section class="project-compact-strip" *ngIf="!tableViewExpanded()">
              <div>
                <h1>{{ currentProject.name }}</h1>
                <p>{{ currentProject.client }} - {{ currentProject.address }}</p>
              </div>
              <dl>
                <div>
                  <dt>Estimated Value</dt>
                  <dd>
                    <input
                      class="project-metric-input"
                      type="number"
                      min="0"
                      step="1"
                      [value]="currentProject.totalValue"
                      (change)="updateProjectEstimatedValue($any($event.target).value)"
                      aria-label="Project estimated value"
                    />
                  </dd>
                </div>
                <div><dt>Total Expense</dt><dd>{{ totalProjectExpenseLabel() }}</dd></div>
                <div>
                  <dt>Received</dt>
                  <dd>
                    <input
                      class="project-metric-input"
                      type="number"
                      min="0"
                      step="1"
                      [value]="projectReceivedAmount(currentProject)"
                      readonly
                      aria-label="Project received amount from payment ledger"
                    />
                  </dd>
                </div>
                <div><dt>Pending</dt><dd>{{ formatMoney(projectPendingAmount(currentProject)) }}</dd></div>
                <div><dt>Supervisor</dt><dd>{{ currentProject.supervisor }}</dd></div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <label class="status-edit-shell" [ngClass]="statusClass(currentProject.status)">
                      <span class="sr-only">Project status</span>
                      <select [value]="currentProject.status" (change)="updateProjectStatus($any($event.target).value, $event)">
                        <option value="Active">Active</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </label>
                  </dd>
                </div>
              </dl>
            </section>

            <section class="operations-workbench universal-workbench project-workbench" [class.table-expanded]="tableViewExpanded()">
              <nav class="operations-tabs" aria-label="Project table modules" *ngIf="!tableViewExpanded()">
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

              <div class="site-workbench" *ngIf="!tableViewExpanded() && isSiteAware(activeSection())">
                <div class="site-switch-row">
                  <span>Site</span>
                  <div class="site-chip-strip">
                    <button type="button" [class.active]="activeSiteFilter() === 'All'" (click)="selectSite('All')">All Sites</button>
                    <span class="site-chip-unit" *ngFor="let site of projectSites()">
                      <button
                        type="button"
                        [class.active]="activeSiteFilter() === site"
                        (click)="selectSite(site)"
                      >
                        {{ site }}
                      </button>
                    </span>
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
                  <label class="table-search" *ngIf="!tableViewExpanded()">
                    <ion-icon name="search-outline"></ion-icon>
                    <input [value]="tableSearch()" (input)="tableSearch.set($any($event.target).value)" placeholder="Search rows" />
                  </label>
                  <button
                    type="button"
                    class="primary-table-action add-row-action"
                    *ngIf="!tableViewExpanded()"
                    [title]="selectedRowCount() ? 'Edit selected row' : 'Add row'"
                    [attr.aria-label]="selectedRowCount() ? 'Edit selected row' : 'Add row'"
                    (click)="selectedRowCount() ? editSelectedRows() : openRecordDialog()"
                  >
                    <ion-icon [name]="selectedRowCount() ? 'create-outline' : 'add-outline'"></ion-icon>
                    {{ selectedRowCount() ? 'Edit Row' : 'Add Row' }}
                  </button>
                  <button
                    *ngIf="!tableViewExpanded() && selectedRowCount()"
                    type="button"
                    class="danger-table-action"
                    [attr.aria-label]="selectedRowCount() === 1 ? 'Delete selected row' : 'Delete selected rows'"
                    (click)="deleteSelectedRows()"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                      <path d="M4 7h16" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M6 7l1 14h10l1-14" />
                      <path d="M9 7V4h6v3" />
                    </svg>
                    {{ selectedRowCount() === 1 ? 'Delete Row' : 'Delete Rows' }}
                  </button>
                  <button type="button" *ngIf="!tableViewExpanded()" (click)="openFieldDialog()">Add Field</button>
                  <button type="button" *ngIf="!tableViewExpanded()" (click)="exportPdf()"><ion-icon name="document-text-outline"></ion-icon>PDF Report</button>
                  <button type="button" *ngIf="!tableViewExpanded()" (click)="exportExcel()"><ion-icon name="download-outline"></ion-icon>Export Excel</button>
                  <button type="button" class="view-table-action" *ngIf="!tableViewExpanded()" (click)="openTableView()">
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                      <path d="M4 5h16v14H4z" />
                      <path d="M4 10h16" />
                      <path d="M10 10v9" />
                    </svg>
                    View Table
                  </button>
                  <button type="button" class="view-table-action minimize" *ngIf="tableViewExpanded()" (click)="closeTableView()">
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                      <path d="M5 12h14" />
                    </svg>
                    Minimize
                  </button>
                </div>
              </div>

              <div class="universal-filter-bar compact-filter-bar project-filter-bar" *ngIf="!tableViewExpanded()">
                <button type="button" class="filter-command-button" [class.active]="filterBuilderOpen()" (click)="toggleFilterBuilder()">
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                    <path d="M4 6h16" />
                    <path d="M7 12h10" />
                    <path d="M10 18h4" />
                  </svg>
                  Filter By
                  <span *ngIf="activeFieldFilterCount()">{{ activeFieldFilterCount() }}</span>
                </button>
                <button
                  *ngIf="dateFilterEnabled()"
                  type="button"
                  class="filter-command-button"
                  [class.active]="dateFilterOpen() || hasDateFilter()"
                  (click)="toggleDateFilter()"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                    <path d="M7 3v4" />
                    <path d="M17 3v4" />
                    <path d="M4 9h16" />
                    <path d="M5 5h14v16H5z" />
                  </svg>
                  {{ dateRangeLabel() || 'Filter by date' }}
                </button>
                <button type="button" class="filter-clear-button" *ngIf="selectedFilterCount()" (click)="clearFilters()">Clear filters</button>
              </div>

              <section class="date-filter-panel blue-date-panel" *ngIf="!tableViewExpanded() && dateFilterOpen() && dateFilterEnabled()">
                <div class="date-range-picker-fields">
                  <button type="button" [class.active]="datePickerTarget() === 'start'" (click)="datePickerTarget.set('start')">
                    <span>From</span>
                    <strong>{{ dateDisplay(dateRange().start) }}</strong>
                  </button>
                  <button type="button" [class.active]="datePickerTarget() === 'end'" (click)="datePickerTarget.set('end')">
                    <span>To</span>
                    <strong>{{ dateDisplay(dateRange().end) }}</strong>
                  </button>
                </div>
                <div class="blue-calendar-card">
                  <div class="blue-calendar-head">
                    <strong>{{ calendarTitle() }}</strong>
                    <div>
                      <button type="button" aria-label="Previous month" (click)="shiftCalendarMonth(-1)">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon"><path d="m15 18-6-6 6-6" /></svg>
                      </button>
                      <button type="button" aria-label="Next month" (click)="shiftCalendarMonth(1)">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon"><path d="m9 18 6-6-6-6" /></svg>
                      </button>
                    </div>
                  </div>
                  <div class="blue-calendar-grid weekdays">
                    <span *ngFor="let weekday of calendarWeekdays">{{ weekday }}</span>
                  </div>
                  <div class="blue-calendar-grid">
                    <button
                      type="button"
                      *ngFor="let day of calendarDays()"
                      [class.muted]="!day.inMonth"
                      [class.today]="day.today"
                      [class.selected]="day.selected"
                      [class.in-range]="day.inRange"
                      [class.disabled]="day.disabled"
                      [disabled]="day.disabled"
                      (pointerdown)="selectCalendarDate(day.key, $event)"
                    >
                      {{ day.label }}
                    </button>
                  </div>
                </div>
                <strong class="date-filter-summary">{{ dateRangeLabel() || 'Choose a start and end date' }}</strong>
                <button type="button" class="filter-clear-button" (click)="clearDateFilter()">Clear date</button>
                <button type="button" class="primary-mini-action" (click)="dateFilterOpen.set(false)">Apply</button>
              </section>

              <div class="active-filter-strip" *ngIf="!tableViewExpanded() && activeFilterSummary().length">
                <span *ngFor="let item of activeFilterSummary()">{{ item }}</span>
              </div>

              <ng-container *ngIf="tableState() as tableState">
              <div class="table-meta-strip" *ngIf="!tableViewExpanded()">
                <span>{{ tableState.rows.length }} rows</span>
                <span>{{ tableState.columns.length }} fields</span>
                <span>{{ selectedFilterCount() }} active filters</span>
                <span>Rows edit after selection</span>
                <button type="button" class="meta-reset-action" *ngIf="hiddenFieldCount(activeSection())" (click)="resetFields(activeSection())">
                  Reset fields
                </button>
              </div>

              <div class="expense-ledger-summary" *ngIf="!tableViewExpanded() && activeSection() === 'expenses'">
                <div><span>Opening</span><strong>{{ expenseOpeningBalanceLabel() }}</strong></div>
                <div><span>Cash Added</span><strong>{{ expenseCashAddedLabel() }}</strong></div>
                <div><span>Expenses</span><strong>{{ expenseSpentLabel() }}</strong></div>
                <div><span>Current Balance</span><strong>{{ expenseCurrentBalanceLabel() }}</strong></div>
              </div>

              <div class="table-wrap operations-table">
                <table>
                  <thead>
                    <tr>
                      <th *ngIf="hasSelectedRows()" class="row-check-column">
                        <input
                          type="checkbox"
                          [checked]="allVisibleRowsSelected()"
                          aria-label="Select all visible rows"
                          (click)="toggleVisibleRowsSelection($event)"
                        />
                      </th>
                      <th *ngFor="let column of tableState.columns; trackBy: trackColumn">
                        <span class="column-head-inner">
                          <span>{{ column.label }}</span>
                          <button
                            type="button"
                            class="column-insert-action"
                            aria-label="Add column after this column"
                            title="Add column after {{ column.label }}"
                            (click)="openFieldDialog(column.key, $event)"
                          >
                            <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                              <path d="M10 4v12" />
                              <path d="M4 10h12" />
                            </svg>
                          </button>
                          <button type="button" class="column-hide-action" aria-label="Hide column" title="Hide column" (click)="hideField(activeSection(), column.key, $event)">
                            <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                              <path d="m5.5 5.5 9 9" />
                              <path d="m14.5 5.5-9 9" />
                            </svg>
                          </button>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      *ngFor="let row of tableState.rows; trackBy: trackRow"
                      class="selectable-data-row"
                      [class.row-selected]="isRowSelected(row)"
                      [class.row-editing]="isRowEditing(row)"
                      (click)="selectRow(row, $event)"
                    >
                      <td *ngIf="hasSelectedRows()" class="row-check-column">
                        <input
                          type="checkbox"
                          [checked]="isRowChecked(row)"
                          aria-label="Select row"
                          (click)="toggleRowSelection(row, $event)"
                        />
                      </td>
                      <td
                        *ngFor="let column of tableState.columns; let first = first; trackBy: trackColumn"
                        [class.readonly-cell]="isReadonlyColumn(column.key)"
                        [class.select-cell]="isRowEditing(row) && !isReadonlyColumn(column.key) && selectOptions(activeSection(), column.key).length > 0"
                        [class.labour-types-cell-host]="activeSection() === 'labour' && column.key === 'labourTypes'"
                      >
                        <div
                          *ngIf="first && selectedRowKey() === rowKey(row)"
                          class="row-hover-toolbar"
                          [style.left.px]="rowToolbarPosition().x"
                          [style.top.px]="rowToolbarPosition().y"
                          (click)="$event.stopPropagation()"
                        >
                          <button type="button" class="icon-row-action" aria-label="Edit row" title="Edit row" (click)="startRowEdit(row, $event)">
                            <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                              <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" />
                              <path d="m13.5 6 4.5 4.5" />
                            </svg>
                          </button>
                          <button
                            *ngIf="activeSection() === 'reports'"
                            type="button"
                            class="icon-row-action"
                            aria-label="Download report"
                            title="Download report"
                            (click)="downloadReportRow(row)"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                              <path d="M12 4v10" />
                              <path d="m8 10 4 4 4-4" />
                              <path d="M5 20h14" />
                            </svg>
                          </button>
                          <button type="button" class="icon-row-action danger" aria-label="Delete row" title="Delete row" (click)="deleteRow(row)">
                            <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                              <path d="M4 7h16" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M6 7l1 14h10l1-14" />
                              <path d="M9 7V4h6v3" />
                            </svg>
                          </button>
                        </div>
                        <ng-container *ngIf="activeSection() === 'labour' && column.key === 'labourTypes'; else standardProjectCell">
                          <div class="labour-types-cell">
                            <div class="labour-type-chip-row" *ngIf="labourTypeCards(row).length; else emptyLabourTypes">
                              <span class="labour-type-chip" *ngFor="let type of labourTypeCards(row)">
                                <span>{{ type.type }}</span>
                                <strong>{{ type.count }}</strong>
                                <button
                                  *ngIf="isRowEditing(row)"
                                  type="button"
                                  aria-label="Remove labor type"
                                  title="Remove labor type"
                                  (pointerdown)="$event.stopPropagation()"
                                  (click)="removeLabourType(row, type.type, $event)"
                                >
                                  <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                                    <path d="m5.5 5.5 9 9" />
                                    <path d="m14.5 5.5-9 9" />
                                  </svg>
                                </button>
                              </span>
                            </div>
                            <ng-template #emptyLabourTypes>
                              <span class="labour-type-empty">No labor types</span>
                            </ng-template>
                            <button *ngIf="isRowEditing(row)" type="button" class="labour-type-add" (click)="openLabourTypeDialog(row)">
                              <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                                <path d="M10 4v12" />
                                <path d="M4 10h12" />
                              </svg>
                              Add labor type
                            </button>
                          </div>
                        </ng-container>
                        <ng-template #standardProjectCell>
                          <div
                            *ngIf="isRowEditing(row) && !isReadonlyColumn(column.key) && selectOptions(activeSection(), column.key).length > 0; else editableProjectCell"
                            class="erp-select-menu"
                            [class.open]="isSelectMenuOpen(row, column.key)"
                          >
                            <button type="button" class="erp-select-trigger" (click)="toggleSelectMenu(row, column.key)">
                              <span>{{ row[column.key] || 'Select' }}</span>
                              <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                                <path d="M5.5 7.5 10 12l4.5-4.5" />
                              </svg>
                            </button>
                            <div class="erp-select-panel" *ngIf="isSelectMenuOpen(row, column.key)">
                              <button
                                *ngFor="let option of selectOptions(activeSection(), column.key)"
                                type="button"
                                [class.selected]="option === row[column.key]"
                                (click)="selectCellOptionForRow(activeSection(), row, column.key, option)"
                              >
                                <span
                                  class="select-option-icon"
                                  *ngIf="selectOptionIcon(option) as icon"
                                  [class.approve]="icon === 'approve'"
                                  [class.decline]="icon === 'decline'"
                                >
                                  <svg *ngIf="icon === 'approve'" viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                                    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                                  </svg>
                                  <svg *ngIf="icon === 'decline'" viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                                    <path d="m5.5 5.5 9 9" />
                                    <path d="m14.5 5.5-9 9" />
                                  </svg>
                                </span>
                                {{ option }}
                              </button>
                              <label class="custom-select-entry" *ngIf="allowsCustomOption(activeSection(), column.key)">
                                <span>Custom</span>
                                <input
                                  #projectCustomValue
                                  (keydown.enter)="saveCustomSelectOptionForRow(activeSection(), row, column.key, projectCustomValue.value, $event)"
                                  placeholder="Type value and press Enter"
                                />
                              </label>
                            </div>
                          </div>
                          <ng-template #editableProjectCell>
                            <span
                              class="editable-cell"
                              [class.cell-readonly]="!isRowEditing(row) || isReadonlyColumn(column.key)"
                              [attr.contenteditable]="isRowEditing(row) && !isReadonlyColumn(column.key) ? 'true' : null"
                              spellcheck="false"
                              (blur)="isRowEditing(row) && !isReadonlyColumn(column.key) && updateRowCell(activeSection(), row, column.key, $any($event.target).textContent || '')"
                            >
                              {{ row[column.key] }}
                            </span>
                          </ng-template>
                        </ng-template>
                      </td>
                    </tr>
                    <tr *ngIf="tableState.rows.length === 0">
                      <td class="empty-row" [attr.colspan]="tableState.columns.length + (hasSelectedRows() ? 1 : 0)">
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
              </ng-container>
            </section>

            <section class="form-overlay" *ngIf="filterBuilderOpen()">
              <form class="erp-dialog operations-dialog filter-dialog" (submit)="submitFilterBuilder($event)">
                <div class="dialog-head">
                  <div>
                    <span>{{ activeConfig().label }}</span>
                    <h2>{{ filterBuilderStep() === 'fields' ? 'Filter By Fields' : 'Filter Values' }}</h2>
                    <p>
                      {{
                        filterBuilderStep() === 'fields'
                          ? 'Choose any project table fields to filter. Custom fields are included.'
                          : 'Enter one or more values. Pick a suggestion or type your own.'
                      }}
                    </p>
                  </div>
                  <button type="button" class="icon-button" (click)="closeFilterBuilder()">
                    <ion-icon name="close-outline"></ion-icon>
                  </button>
                </div>
                <div class="filter-dialog-body" *ngIf="filterBuilderStep() === 'fields'">
                  <div class="filter-field-grid filter-dialog-field-grid">
                    <button
                      type="button"
                      *ngFor="let column of filterableColumns()"
                      [class.selected]="isFilterFieldSelected(column.key)"
                      (click)="toggleFilterField(column.key)"
                    >
                      <span>{{ column.label }}</span>
                      <small>{{ column.key }}</small>
                    </button>
                  </div>
                </div>
                <div class="filter-dialog-body" *ngIf="filterBuilderStep() === 'values'">
                  <div class="filter-value-grid filter-dialog-value-grid">
                    <label class="filter-combo-field" *ngFor="let column of selectedFilterColumns()" [class.menu-open]="activeFilterValueKey() === column.key">
                      <span>{{ column.label }}</span>
                      <div class="filter-combo-control">
                        <input
                          autocomplete="off"
                          [value]="selectedFilters()[column.key] || ''"
                          (focus)="openFilterValueMenu(column.key)"
                          (input)="setFilter(column.key, $any($event.target).value); openFilterValueMenu(column.key)"
                          (keydown.escape)="activeFilterValueKey.set('')"
                          placeholder="All"
                        />
                        <button type="button" aria-label="Show filter suggestions" (click)="toggleFilterValueMenu(column.key)">
                          <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      </div>
                      <div class="filter-suggestion-menu" *ngIf="activeFilterValueKey() === column.key && filterSuggestions(column.key).length">
                        <button
                          type="button"
                          *ngFor="let value of filterSuggestions(column.key)"
                          [class.selected]="(selectedFilters()[column.key] || 'All') === value"
                          (mousedown)="$event.preventDefault()"
                          (click)="chooseFilterSuggestion(column.key, value)"
                        >
                          {{ value }}
                        </button>
                      </div>
                    </label>
                  </div>
                </div>
                <div class="dialog-actions">
                  <button type="button" class="secondary-action" (click)="closeFilterBuilder()">Cancel</button>
                  <button type="button" class="secondary-action" *ngIf="filterBuilderStep() === 'values'" (click)="filterBuilderStep.set('fields')">Back</button>
                  <button type="submit" class="primary-action" [disabled]="filterBuilderStep() === 'fields' && !selectedFilterFields().length">
                    {{ filterBuilderStep() === 'fields' ? 'Next' : 'Apply Filter' }}
                  </button>
                </div>
              </form>
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
                  <label *ngFor="let column of recordFormColumns()">
                    <span>{{ formColumnLabel(column) }}</span>
                    <input
                      *ngIf="selectOptions(activeSection(), column.key).length > 0 && allowsCustomOption(activeSection(), column.key); else projectDraftSelect"
                      [attr.list]="'project-draft-' + activeSection() + '-' + column.key"
                      [type]="column.type || 'text'"
                      [value]="draftRow()[column.key] || ''"
                      (input)="updateDraftField(column.key, $any($event.target).value)"
                    />
                    <datalist [id]="'project-draft-' + activeSection() + '-' + column.key">
                      <option *ngFor="let option of selectOptions(activeSection(), column.key)" [value]="option"></option>
                    </datalist>
                    <ng-template #projectDraftSelect>
                      <select
                        *ngIf="selectOptions(activeSection(), column.key).length > 0; else projectDraftInput"
                        [value]="draftRow()[column.key] || ''"
                        (change)="updateDraftField(column.key, $any($event.target).value)"
                      >
                        <option *ngFor="let option of selectOptions(activeSection(), column.key)" [value]="option">{{ option }}</option>
                      </select>
                    </ng-template>
                    <ng-template #projectDraftInput>
                      <input
                        [type]="column.type || 'text'"
                        [value]="draftRow()[column.key] || ''"
                        (input)="updateDraftField(column.key, $any($event.target).value)"
                      />
                    </ng-template>
                  </label>
                  <ng-container *ngIf="showSiteMaterialDetails()">
                    <div class="material-detail-heading span-2">
                      <strong>Material details</strong>
                      <span>These fields create the linked Material Requests row for this site purchase.</span>
                    </div>
                    <label *ngFor="let field of siteMaterialDetailFields">
                      <span>{{ field.label }}</span>
                      <input
                        *ngIf="selectOptions('materials', field.key).length > 0 && allowsCustomOption('materials', field.key); else projectMaterialSelect"
                        [attr.list]="'project-site-material-' + field.key"
                        [type]="field.type || 'text'"
                        [value]="draftRow()[field.key] || ''"
                        (input)="updateDraftField(field.key, $any($event.target).value)"
                      />
                      <datalist [id]="'project-site-material-' + field.key">
                        <option *ngFor="let option of selectOptions('materials', field.key)" [value]="option"></option>
                      </datalist>
                      <ng-template #projectMaterialSelect>
                        <select
                          *ngIf="selectOptions('materials', field.key).length > 0; else projectMaterialInput"
                          [value]="draftRow()[field.key] || ''"
                          (change)="updateDraftField(field.key, $any($event.target).value)"
                        >
                          <option *ngFor="let option of selectOptions('materials', field.key)" [value]="option">{{ option }}</option>
                        </select>
                      </ng-template>
                      <ng-template #projectMaterialInput>
                        <input
                          [type]="field.type || 'text'"
                          [value]="draftRow()[field.key] || ''"
                          (input)="updateDraftField(field.key, $any($event.target).value)"
                        />
                      </ng-template>
                    </label>
                  </ng-container>
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
                    <p *ngIf="newFieldAfterLabel()">Inserted after {{ newFieldAfterLabel() }}.</p>
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

            <section class="form-overlay" *ngIf="labourTypeDialogOpen()">
              <form class="erp-dialog labour-type-dialog" (submit)="saveLabourType($event)">
                <div class="dialog-head">
                  <div>
                    <span>Labour</span>
                    <h2>Add Labor Type</h2>
                  </div>
                  <button type="button" class="icon-button" (click)="closeLabourTypeDialog()">
                    <ion-icon name="close-outline"></ion-icon>
                  </button>
                </div>
                <div class="erp-form">
                  <label>
                    <span>Labor Type</span>
                    <input
                      list="project-labour-type-options"
                      [value]="labourTypeName()"
                      (input)="updateLabourTypeName($any($event.target).value)"
                      placeholder="Type or choose labor type"
                    />
                    <datalist id="project-labour-type-options">
                      <option *ngFor="let option of labourTypeDialogOptions()" [value]="option"></option>
                    </datalist>
                    <div class="labour-type-suggestion-row" *ngIf="labourTypeDialogOptions().length">
                      <button
                        *ngFor="let option of labourTypeDialogOptions()"
                        type="button"
                        [class.selected]="labourTypeName().toLowerCase() === option.toLowerCase()"
                        (mousedown)="$event.preventDefault()"
                        (click)="selectLabourTypeSuggestion(option)"
                      >
                        {{ option }}
                      </button>
                    </div>
                  </label>
                  <label>
                    <span>Staff Count</span>
                    <input
                      type="number"
                      min="0"
                      [value]="labourTypeCount()"
                      (input)="labourTypeCount.set($any($event.target).value)"
                    />
                  </label>
                  <label>
                    <span>Daily Wage</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      [value]="labourTypeDailyWage()"
                      (input)="labourTypeDailyWage.set($any($event.target).value)"
                      placeholder="950"
                    />
                  </label>
                </div>
                <div class="dialog-actions">
                  <button type="button" class="secondary-action" (click)="closeLabourTypeDialog()">Cancel</button>
                  <button type="submit" class="primary-action">Add Labor Type</button>
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
              (cancel)="closeProjectForm()"
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
  readonly queryParamMap = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;
  readonly showProjectForm = signal(false);
  readonly editingProject = signal<Project | null>(null);
  readonly sections = sectionConfigs;
  readonly activeSection = signal<ModuleKey>(this.normalizeSection(this.route.snapshot.paramMap.get("section")));
  readonly selectedRowKey = signal("");
  readonly selectedRowKeys = signal<string[]>([]);
  readonly editingRowKey = signal("");
  readonly editingRowKeys = signal<string[]>([]);
  readonly rowToolbarPosition = signal({ x: 160, y: 120 });
  readonly tableSearch = signal("");
  readonly selectedFilters = signal<Record<string, string>>({});
  readonly selectedFilterFields = signal<string[]>([]);
  readonly filterBuilderOpen = signal(false);
  readonly filterBuilderStep = signal<FilterBuilderStep>("fields");
  readonly activeFilterValueKey = signal("");
  readonly dateFilterOpen = signal(false);
  readonly dateRange = signal({ start: "", end: "" });
  readonly datePickerTarget = signal<"start" | "end">("start");
  readonly calendarCursor = signal(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  readonly calendarWeekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  readonly tableViewExpanded = signal(false);
  readonly recordDialogOpen = signal(false);
  readonly fieldDialogOpen = signal(false);
  readonly newFieldLabel = signal("");
  readonly newFieldAfterKey = signal<string | null>(null);
  readonly draftRow = signal<TableRow>({});
  readonly activeSite = signal("All");
  readonly siteDraftOpen = signal(false);
  readonly siteDraftName = signal("");
  readonly openSelectKey = signal("");
  readonly selectCustomValue = signal("");
  readonly labourTypeDialogOpen = signal(false);
  readonly labourTypeRowId = signal("");
  readonly labourTypeName = signal("Mason");
  readonly labourTypeCount = signal("1");
  readonly labourTypeDailyWage = signal("");
  readonly expenseOpeningEdit = signal(false);
  readonly handledEditProjectQuery = signal("");
  readonly siteMaterialDetailFields = siteMaterialDetailFields;
  readonly tableRows = computed<Record<ModuleKey, TableRow[]>>(() => this.buildInitialRows(this.projectId()));
  readonly tableState = computed(() => ({
    rows: this.visibleRows(this.activeSection()),
    columns: this.columnsFor(this.activeSection()),
  }));

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

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (projectId) this.data.touchProject(projectId);
    });
    effect(() => {
      if (this.queryParamMap().get("editProject") !== "1") return;
      const project = this.project();
      if (!project || this.showProjectForm()) return;
      if (this.handledEditProjectQuery() === project.id) return;
      this.handledEditProjectQuery.set(project.id);
      this.editingProject.set(project);
      this.showProjectForm.set(true);
    });
  }

  switchSection(section: ModuleKey) {
    this.activeSection.set(section);
    this.tableSearch.set("");
    this.resetFilterState();
    this.closeDropdowns();
    this.clearRowSelection();
    void this.router.navigate(["/clients", this.clientId(), "projects", this.projectId(), section]);
  }

  rowKey(row: TableRow): string {
    return `${this.activeSection()}:${this.rowIdentity(row)}`;
  }

  private rowIdentity(row: TableRow): string {
    const explicitId = String(row["__rowId"] || "").trim();
    if (explicitId) return explicitId;

    const values = [
      row["clientId"],
      row["projectId"],
      row["__projectId"],
      row["site"],
      row["materialName"],
      row["staffName"],
      row["labourTypes"],
      row["expenseDate"],
      row["paymentDate"],
      row["requestDate"],
      row["vendorName"],
      row["subcontractorName"],
      row["reportName"],
      row["description"],
      row["amount"],
    ]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);

    return values.length ? values.join("|") : JSON.stringify(row);
  }

  trackRow = (_index: number, row: TableRow): string => this.rowKey(row);

  trackColumn = (_index: number, column: FieldSchema): string => column.key;

  selectRow(row: TableRow, event?: MouseEvent) {
    this.positionRowToolbar(event);
    const key = this.rowKey(row);
    if (this.selectedRowKey() !== key) {
      this.editingRowKey.set("");
      this.editingRowKeys.set([]);
      this.openSelectKey.set("");
    }
    this.selectedRowKey.set(key);
    if (event?.ctrlKey || event?.metaKey || event?.shiftKey) {
      this.selectedRowKeys.update((keys) => (keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]));
      if (!this.selectedRowKeys().length) this.selectedRowKey.set("");
      return;
    }
    this.selectedRowKeys.set([key]);
  }

  private positionRowToolbar(event?: MouseEvent) {
    const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
    const toolbarWidth = 126;
    const toolbarHeight = 44;
    const margin = 12;
    const rawX = event ? event.clientX + 12 : viewportWidth - toolbarWidth - 32;
    const rawY = event ? event.clientY - toolbarHeight - 10 : 132;
    this.rowToolbarPosition.set({
      x: Math.min(Math.max(rawX, margin), viewportWidth - toolbarWidth - margin),
      y: Math.min(Math.max(rawY, margin), viewportHeight - toolbarHeight - margin),
    });
  }

  isRowSelected(row: TableRow): boolean {
    const key = this.rowKey(row);
    return this.selectedRowKey() === key || this.selectedRowKeys().includes(key);
  }

  isRowEditing(row: TableRow): boolean {
    const key = this.rowKey(row);
    return this.editingRowKey() === key || this.editingRowKeys().includes(key);
  }

  selectedRowCount(): number {
    return this.selectedRowKeys().length;
  }

  hasSelectedRows(): boolean {
    return this.selectedRowCount() > 0;
  }

  isRowChecked(row: TableRow): boolean {
    return this.selectedRowKeys().includes(this.rowKey(row));
  }

  toggleRowSelection(row: TableRow, event?: Event) {
    event?.stopPropagation();
    const key = this.rowKey(row);
    this.selectedRowKeys.update((keys) => (keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]));
    const nextKeys = this.selectedRowKeys();
    this.selectedRowKey.set(nextKeys.includes(key) ? key : nextKeys.at(-1) ?? "");
    this.editingRowKey.set("");
    this.editingRowKeys.set([]);
    this.openSelectKey.set("");
  }

  allVisibleRowsSelected(): boolean {
    const rows = this.visibleRows(this.activeSection());
    if (!rows.length) return false;
    const selected = new Set(this.selectedRowKeys());
    return rows.every((row) => selected.has(this.rowKey(row)));
  }

  toggleVisibleRowsSelection(event?: Event) {
    event?.stopPropagation();
    const rows = this.visibleRows(this.activeSection());
    if (this.allVisibleRowsSelected()) {
      this.clearRowSelection();
      return;
    }
    const keys = rows.map((row) => this.rowKey(row));
    this.selectedRowKeys.set(keys);
    this.selectedRowKey.set(keys.at(-1) ?? "");
    this.editingRowKey.set("");
    this.editingRowKeys.set([]);
    this.openSelectKey.set("");
  }

  private selectedRows(): TableRow[] {
    const selected = new Set(this.selectedRowKeys());
    return this.visibleRows(this.activeSection()).filter((row) => selected.has(this.rowKey(row)));
  }

  editSelectedRows() {
    const rows = this.selectedRows();
    if (!rows.length) {
      this.openRecordDialog();
      return;
    }
    const keys = rows.map((row) => this.rowKey(row));
    this.selectedRowKeys.set(keys);
    this.selectedRowKey.set(keys[0] ?? "");
    this.editingRowKey.set(keys[0] ?? "");
    this.editingRowKeys.set(keys);
  }

  deleteSelectedRows() {
    const rows = this.selectedRows();
    if (!rows.length) return;
    const label = rows.length === 1 ? "this row" : `${rows.length} rows`;
    if (!window.confirm(`Delete ${label}?`)) return;
    for (const row of rows) this.data.deleteSharedRow(String(row["__rowId"] || ""));
    this.clearRowSelection();
  }

  startRowEdit(row: TableRow, event?: Event) {
    event?.stopPropagation();
    const key = this.rowKey(row);
    this.selectedRowKey.set(key);
    this.selectedRowKeys.set([key]);
    this.editingRowKey.set(key);
    this.editingRowKeys.set([key]);
  }

  @HostListener("document:pointerdown", ["$event"])
  closeTransientTableUi(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (!target.closest(".selectable-data-row, .row-hover-toolbar, .table-actions, .universal-filter-bar, .filter-dialog, .date-filter-panel, .site-workbench")) {
      this.clearRowSelection();
    }

    if (!target.closest(".erp-select-menu, .custom-select-entry, .filter-combo-field, .date-filter-panel")) {
      this.closeDropdowns();
    }
  }

  private clearRowSelection() {
    this.selectedRowKey.set("");
    this.selectedRowKeys.set([]);
    this.editingRowKey.set("");
    this.editingRowKeys.set([]);
  }

  private closeDropdowns() {
    this.openSelectKey.set("");
    this.activeFilterValueKey.set("");
    this.selectCustomValue.set("");
  }

  columnsFor(section: ModuleKey): FieldSchema[] {
    const base = sectionConfigs.find((config) => config.key === section)?.columns ?? [];
    const custom = this.data.customFieldsFor(section);
    const hidden = new Set(this.data.hiddenFieldsFor(section));
    const columns = section === "labour" ? this.withLabourWageColumns(base, custom) : this.data.composeTableColumns(base, custom);
    return columns.filter((column) => !hidden.has(column.key));
  }

  hiddenFieldCount(section: ModuleKey): number {
    return this.data.hiddenFieldsFor(section).length;
  }

  hideField(section: ModuleKey, key: string, event?: Event) {
    event?.stopPropagation();
    const label = this.columnsFor(section).find((column) => column.key === key)?.label ?? key;
    if (!window.confirm(`Delete the "${label}" column from this table view?`)) return;
    this.data.hideTableField(section, key);
  }

  resetFields(section: ModuleKey) {
    this.data.resetTableFields(section);
  }

  private withLabourWageColumns(base: FieldSchema[], custom: FieldSchema[]): FieldSchema[] {
    const wageFields = custom.filter((field) => this.isLabourWageField(field) && !field.afterKey);
    const otherFields = custom.filter((field) => !this.isLabourWageField(field) || field.afterKey);
    const orderedBase = base.flatMap((field) => (field.key === "staffCount" ? [...wageFields, field] : [field]));
    return this.data.composeTableColumns(orderedBase, otherFields);
  }

  private isLabourWageField(field: FieldSchema): boolean {
    return field.label.toLowerCase().includes("daily wage");
  }

  visibleRows(section: ModuleKey): TableRow[] {
    const query = this.tableSearch().trim().toLowerCase();
    let rows = this.data.tableRowsFor(section, this.tableRows()[section] ?? [], (row) => this.rowBelongsToProject(row));
    const site = this.activeSiteFilter();
    if (this.isSiteAware(section) && site !== "All") {
      rows = rows.filter((row) => String(row["site"] ?? "").toLowerCase() === site.toLowerCase());
    }
    rows = this.withComputedRows(section, rows);
    const filters = this.selectedFilters();
    const dateKey = this.dateFilterKey(section);
    const range = this.dateRange();
    if (query) rows = rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query)));
    rows = rows.filter((row) => {
      const matchesFilters = Object.entries(filters).every(
        ([key, value]) => !value || String(row[key] ?? "").toLowerCase().includes(value.trim().toLowerCase()),
      );
      const matchesDate =
        !dateKey ||
        (!range.start && !range.end) ||
        this.dateInRange(this.normalizedDateValue(row[dateKey]), range.start, range.end);
      return matchesFilters && matchesDate;
    });
    return rows;
  }

  selectedFilterCount(): number {
    return this.activeFieldFilterCount() + (this.hasDateFilter() ? 1 : 0);
  }

  activeFieldFilterCount(): number {
    return Object.values(this.selectedFilters()).filter((value) => value.trim()).length;
  }

  setFilter(key: string, value: string) {
    const cleanValue = value.trim();
    this.selectedFilters.update((filters) => {
      const next = { ...filters };
      if (cleanValue) next[key] = cleanValue;
      else delete next[key];
      return next;
    });
  }

  clearFilters() {
    this.resetFilterState();
    this.tableSearch.set("");
    this.closeDropdowns();
    this.clearRowSelection();
  }

  private resetFilterState() {
    this.selectedFilters.set({});
    this.selectedFilterFields.set([]);
    this.filterBuilderOpen.set(false);
    this.filterBuilderStep.set("fields");
    this.dateFilterOpen.set(false);
    this.dateRange.set({ start: "", end: "" });
  }

  toggleFilterBuilder() {
    this.filterBuilderOpen.update((open) => !open);
    this.dateFilterOpen.set(false);
    if (!this.selectedFilterFields().length) this.filterBuilderStep.set("fields");
  }

  closeFilterBuilder() {
    this.filterBuilderOpen.set(false);
    this.activeFilterValueKey.set("");
  }

  submitFilterBuilder(event: Event) {
    event.preventDefault();
    if (this.filterBuilderStep() === "fields") {
      this.goToFilterValues();
      return;
    }
    this.closeFilterBuilder();
  }

  filterableColumns(): FieldSchema[] {
    return this.columnsFor(this.activeSection());
  }

  isFilterFieldSelected(key: string): boolean {
    return this.selectedFilterFields().includes(key);
  }

  toggleFilterField(key: string) {
    this.selectedFilterFields.update((fields) => {
      if (fields.includes(key)) {
        this.selectedFilters.update((filters) => {
          const next = { ...filters };
          delete next[key];
          return next;
        });
        return fields.filter((field) => field !== key);
      }
      return [...fields, key];
    });
  }

  selectedFilterColumns(): FieldSchema[] {
    const selected = new Set(this.selectedFilterFields());
    return this.filterableColumns().filter((column) => selected.has(column.key));
  }

  goToFilterValues() {
    if (!this.selectedFilterFields().length) return;
    this.filterBuilderStep.set("values");
  }

  clearFieldFilters() {
    this.selectedFilters.set({});
    this.activeFilterValueKey.set("");
  }

  filterValues(key: string): string[] {
    const values = new Set<string>();
    for (const option of this.selectOptions(this.activeSection(), key)) {
      if (option) values.add(option);
    }
    for (const row of this.withComputedRows(this.activeSection(), this.data.tableRowsFor(this.activeSection(), this.tableRows()[this.activeSection()] ?? [], (entry) => this.rowBelongsToProject(entry)))) {
      const value = row[key];
      if (value !== undefined && value !== "") values.add(String(value));
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }

  openFilterValueMenu(key: string) {
    this.activeFilterValueKey.set(key);
  }

  toggleFilterValueMenu(key: string) {
    this.activeFilterValueKey.update((activeKey) => (activeKey === key ? "" : key));
  }

  chooseFilterSuggestion(key: string, value: string) {
    if (value === "All") {
      this.setFilter(key, "");
      this.activeFilterValueKey.set("");
      return;
    }
    this.setFilter(key, value);
    this.activeFilterValueKey.set("");
  }

  filterSuggestions(key: string): string[] {
    const query = String(this.selectedFilters()[key] || "").trim().toLowerCase();
    const values = this.filterValues(key);
    const matches = query ? values.filter((value) => value.toLowerCase().includes(query)) : values;
    const options = query && !"all".includes(query) ? matches : ["All", ...matches];
    return [...new Set(options)].slice(0, 14);
  }

  toggleDateFilter() {
    this.dateFilterOpen.update((open) => {
      const next = !open;
      if (next) this.syncCalendarCursor();
      return next;
    });
    this.filterBuilderOpen.set(false);
    this.activeFilterValueKey.set("");
  }

  setDateRange(key: "start" | "end", value: string) {
    this.dateRange.update((range) => ({ ...range, [key]: value }));
  }

  clearDateFilter() {
    this.dateRange.set({ start: "", end: "" });
    this.datePickerTarget.set("start");
    this.syncCalendarCursor();
  }

  hasDateFilter(): boolean {
    const range = this.dateRange();
    return Boolean(range.start || range.end);
  }

  dateRangeLabel(): string {
    const range = this.dateRange();
    if (!range.start && !range.end) return "";
    const start = range.start || "Start";
    const end = range.end || "Today";
    return `${start} 12:00 AM - ${end} 11:59 PM`;
  }

  dateDisplay(value: string): string {
    if (!value) return "dd/mm/yyyy";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  calendarTitle(): string {
    const [year, month] = this.calendarCursor().split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  calendarDays(): Array<{ key: string; label: number; inMonth: boolean; today: boolean; selected: boolean; inRange: boolean; disabled: boolean }> {
    const [year, month] = this.calendarCursor().split("-").map(Number);
    const monthIndex = month - 1;
    const firstDay = new Date(year, monthIndex, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const range = this.dateRange();
    const today = this.localDateKey(new Date());
    const days = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(year, monthIndex, index - mondayOffset + 1);
      const key = this.localDateKey(date);
      const hasRange = Boolean(range.start && range.end);
      days.push({
        key,
        label: date.getDate(),
        inMonth: date.getMonth() === monthIndex,
        today: key === today,
        selected: key === range.start || key === range.end,
        inRange: hasRange && key > range.start && key < range.end,
        disabled: key > today,
      });
    }
    return days;
  }

  selectCalendarDate(key: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (key > this.localDateKey(new Date())) return;
    const range = this.dateRange();
    if (this.datePickerTarget() === "start") {
      this.dateRange.set({ start: key, end: range.end && key <= range.end ? range.end : "" });
      this.datePickerTarget.set("end");
      return;
    }

    if (!range.start) {
      this.dateRange.set({ start: key, end: key });
      this.datePickerTarget.set("start");
      return;
    }

    if (key < range.start) this.dateRange.set({ start: key, end: range.start });
    else this.dateRange.set({ ...range, end: key });
    this.datePickerTarget.set("start");
  }

  shiftCalendarMonth(direction: number) {
    const [year, month] = this.calendarCursor().split("-").map(Number);
    const date = new Date(year, month - 1 + direction, 1);
    this.calendarCursor.set(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  private syncCalendarCursor() {
    const key = this.dateRange().start || this.dateRange().end || this.localDateKey(new Date());
    this.calendarCursor.set(key.slice(0, 7));
  }

  private localDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  openTableView() {
    this.tableViewExpanded.set(true);
    this.filterBuilderOpen.set(false);
    this.dateFilterOpen.set(false);
    this.activeFilterValueKey.set("");
    this.clearRowSelection();
  }

  closeTableView() {
    this.tableViewExpanded.set(false);
  }

  dateFilterEnabled(): boolean {
    return Boolean(this.dateFilterKey(this.activeSection()));
  }

  activeFilterSummary(): string[] {
    const summary: string[] = [];
    for (const column of this.selectedFilterColumns()) {
      const value = this.selectedFilters()[column.key];
      if (value) summary.push(`${column.label}: ${value}`);
    }
    if (this.dateRangeLabel()) summary.push(`Date: ${this.dateRangeLabel()}`);
    return summary;
  }

  private dateFilterKey(section: ModuleKey): string {
    if (section === "materials") return "requestDate";
    if (section === "labour") return "attendanceDate";
    if (section === "expenses") return "expenseDate";
    if (section === "payments") return "paymentDate";
    return "";
  }

  private normalizedDateValue(value: unknown): string {
    const text = String(value || "").trim();
    if (!text) return "";
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const dayFirstMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dayFirstMatch) return `${dayFirstMatch[3]}-${dayFirstMatch[2].padStart(2, "0")}-${dayFirstMatch[1].padStart(2, "0")}`;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }

  private dateInRange(value: string, start: string, end: string): boolean {
    if (!value) return false;
    if (start && value < start) return false;
    if (end && value > end) return false;
    return true;
  }

  addInlineRow(event?: MouseEvent) {
    this.positionRowToolbar(event);
    const section = this.activeSection();
    const currentProject = this.project();
    const row = this.data.addCustomRow(section, {
      ...this.defaultRowFor(section),
      __projectId: this.projectId(),
      projectId: this.projectId(),
      client: currentProject?.client ?? "",
      project: currentProject?.name ?? "",
      expenseScope: section === "expenses" ? "Site" : undefined,
    });
    const key = `${section}:${row["__rowId"]}`;
    this.selectedRowKey.set(key);
    this.selectedRowKeys.set([key]);
    this.editingRowKey.set(key);
    this.editingRowKeys.set([key]);
  }

  openRecordDialog() {
    const row: TableRow = { ...this.defaultRowFor(this.activeSection()) };
    this.draftRow.set(row);
    for (const column of this.recordFormColumns()) {
      const options = this.selectOptions(this.activeSection(), column.key);
      row[column.key] = column.key === "site" && this.activeSiteFilter() !== "All" ? this.activeSiteFilter() : row[column.key] || options[0] || "";
    }
    this.draftRow.set(row);
    this.recordDialogOpen.set(true);
  }

  recordFormColumns(): FieldSchema[] {
    const hiddenInExpenseForm = new Set(["approvalStatus", "openingBalance", "runningBalance"]);
    return this.columnsFor(this.activeSection()).filter((column) => {
      if (this.activeSection() === "expenses" && hiddenInExpenseForm.has(column.key)) return false;
      if (this.activeSection() === "expenses" && column.key === "siteMaterial" && this.normalizedExpenseTransactionType(String(this.draftRow()["transactionType"] || "Purchase")) !== "Purchase") {
        return false;
      }
      return !this.isReadonlyColumn(column.key);
    });
  }

  updateDraftField(key: string, value: string) {
    this.draftRow.update((row) => {
      const nextRow = { ...row, [key]: value };
      if (this.activeSection() === "expenses" && key === "transactionType" && this.normalizedExpenseTransactionType(value) !== "Purchase") {
        nextRow["siteMaterial"] = "No";
      }
      if (this.activeSection() === "expenses" && key === "siteMaterial" && this.normalizeYesNo(value) === "Yes") {
        nextRow["requestDate"] ||= nextRow["expenseDate"] || new Date().toISOString().slice(0, 10);
        nextRow["materialName"] ||= nextRow["description"] || "";
        nextRow["unit"] ||= "Item";
        nextRow["requestedQuantity"] ||= "1";
        nextRow["remainingStock"] ||= `${nextRow["requestedQuantity"] || "1"} ${nextRow["unit"] || "Item"}`;
      }
      if (this.activeSection() === "expenses" && (key === "requestedQuantity" || key === "approvedQuantity" || key === "unit")) {
        const quantity = nextRow["requestedQuantity"] || "0";
        const unit = nextRow["unit"] || "Item";
        nextRow["remainingStock"] = `${quantity} ${unit}`;
      }
      return nextRow;
    });
  }

  showSiteMaterialDetails(): boolean {
    if (this.activeSection() !== "expenses") return false;
    const row = this.draftRow();
    return this.normalizedExpenseTransactionType(String(row["transactionType"] || "")) === "Purchase" && this.normalizeYesNo(row["siteMaterial"]) === "Yes";
  }

  formColumnLabel(column: FieldSchema): string {
    return this.activeSection() === "expenses" && column.key === "amount" ? "Total Amount" : column.label;
  }

  saveRecord(event: Event) {
    event.preventDefault();
    const section = this.activeSection();
    const currentProject = this.project();
    const selectedSite = this.activeSiteFilter();
    const draft = section === "expenses" ? this.normalizedExpenseInputRow(this.draftRow()) : this.draftRow();
    if (section === "expenses") this.ensureExpenseOpeningForInput(draft);
    const savedRow = this.data.addCustomRow(section, {
      ...draft,
      ...(this.isSiteAware(section) && selectedSite !== "All" ? { site: this.draftRow()["site"] || selectedSite } : {}),
      __projectId: this.projectId(),
      projectId: this.projectId(),
      clientId: this.clientId(),
      client: currentProject?.client ?? "",
      project: currentProject?.name ?? "",
      expenseScope: section === "expenses" ? "Site" : undefined,
    });
    if (section === "expenses") this.createMaterialFromSiteExpense(savedRow);
    this.recordDialogOpen.set(false);
  }

  private createMaterialFromSiteExpense(row: TableRow) {
    const isSiteMaterial = String(row["siteMaterial"] || "").trim().toLowerCase() === "yes";
    if (!isSiteMaterial) return;
    const sourceExpenseRowId = String(row["__rowId"] || "");
    if (!sourceExpenseRowId) return;
    const existing = this.data
      .tableRowsFor("materials", this.tableRows().materials, (entry) => this.rowBelongsToProject(entry))
      .some((entry) => String(entry["sourceExpenseRowId"] || "") === sourceExpenseRowId);
    if (existing) return;
    const currentProject = this.project();
    this.data.addCustomRow("materials", {
      __projectId: this.projectId(),
      projectId: this.projectId(),
      clientId: this.clientId(),
      client: currentProject?.client ?? "",
      project: currentProject?.name ?? "",
      site: row["site"] || this.expenseEditableSite(),
      materialName: row["materialName"] || row["description"] || "Site material purchase",
      unit: row["unit"] || "Item",
      requestedQuantity: row["requestedQuantity"] || "1",
      approvedQuantity: row["approvedQuantity"] || "",
      requestDate: row["requestDate"] || row["expenseDate"] || new Date().toISOString().slice(0, 10),
      vendor: row["vendor"] || "",
      poNumber: row["poNumber"] || row["reference"] || "",
      remainingStock: row["remainingStock"] || `${row["requestedQuantity"] || "1"} ${row["unit"] || "Item"}`,
      status: row["approvalStatus"] || "Pending",
      sourceExpenseRowId,
    });
  }

  isSiteAware(section: ModuleKey): boolean {
    return section === "materials" || section === "labour" || section === "expenses" || section === "subcontractors";
  }

  selectSite(site: string) {
    this.activeSite.set(site);
    this.expenseOpeningEdit.set(false);
    this.tableSearch.set("");
    this.closeDropdowns();
    this.clearRowSelection();
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

  deleteSite(site: string, event: Event) {
    event.stopPropagation();
    const updatedProject = this.data.removeSiteFromProject(this.projectId(), site);
    if (updatedProject && this.activeSite() === site) this.activeSite.set("All");
  }

  openFieldDialog(afterKey?: string, event?: Event) {
    event?.stopPropagation();
    this.newFieldLabel.set("");
    this.newFieldAfterKey.set(afterKey ?? null);
    this.fieldDialogOpen.set(true);
  }

  saveField(event: Event) {
    event.preventDefault();
    const label = this.newFieldLabel().trim();
    if (!label) return;
    if (this.isGeneratedClientIdField(label)) {
      window.alert("Client ID is generated automatically and cannot be created manually.");
      return;
    }
    const section = this.activeSection();
    this.data.addCustomFieldAfter(section, label, this.newFieldAfterKey(), this.columnsFor(section));
    this.newFieldAfterKey.set(null);
    this.fieldDialogOpen.set(false);
  }

  private isGeneratedClientIdField(label: string): boolean {
    const normalized = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return normalized === "client-id";
  }

  newFieldAfterLabel(): string {
    const afterKey = this.newFieldAfterKey();
    if (!afterKey) return "";
    return this.columnsFor(this.activeSection()).find((column) => column.key === afterKey)?.label ?? "";
  }

  updateCell(section: ModuleKey, visibleIndex: number, key: string, value: string) {
    if (this.isReadonlyColumn(key)) return;
    const target = this.visibleRows(section)[visibleIndex];
    if (!target) return;
    this.updateRowCell(section, target, key, value);
  }

  updateRowCell(section: ModuleKey, row: TableRow, key: string, value: string) {
    if (this.isReadonlyColumn(key)) return;
    const rowId = String(row["__rowId"] || "");
    if (!rowId) return;
    const cleanValue = value.trim();
    if (section === "expenses" && key === "amount") {
      this.data.updateSharedRowCell(rowId, key, this.positiveExpenseAmountValue(cleanValue));
      return;
    }
    this.data.updateSharedRowCell(rowId, key, cleanValue);
    if (section === "labour" && key === "labourTypes") this.data.updateSharedRowCell(rowId, "notes", cleanValue);
    if (section === "expenses" && key === "siteMaterial") this.createMaterialFromSiteExpense({ ...row, [key]: cleanValue });
  }

  deleteRow(row: TableRow) {
    const key = this.rowKey(row);
    this.data.deleteSharedRow(String(row["__rowId"] || ""));
    this.selectedRowKeys.update((keys) => keys.filter((item) => item !== key));
    if (this.selectedRowKey() === key) this.selectedRowKey.set("");
    if (this.editingRowKey() === key) this.editingRowKey.set("");
    this.editingRowKeys.update((keys) => keys.filter((item) => item !== key));
  }

  selectCellKey(row: TableRow, key: string): string {
    return `${row["__rowId"] || "row"}:${key}`;
  }

  isSelectMenuOpen(row: TableRow, key: string): boolean {
    return this.openSelectKey() === this.selectCellKey(row, key);
  }

  toggleSelectMenu(row: TableRow, key: string) {
    const nextKey = this.selectCellKey(row, key);
    this.openSelectKey.set(this.openSelectKey() === nextKey ? "" : nextKey);
    this.selectCustomValue.set("");
  }

  selectCellOption(section: ModuleKey, visibleIndex: number, key: string, value: string) {
    this.updateCell(section, visibleIndex, key, value);
    this.openSelectKey.set("");
    this.selectCustomValue.set("");
  }

  selectCellOptionForRow(section: ModuleKey, row: TableRow, key: string, value: string) {
    this.updateRowCell(section, row, key, value);
    this.openSelectKey.set("");
    this.selectCustomValue.set("");
  }

  saveCustomSelectOption(section: ModuleKey, visibleIndex: number, key: string, value: string, event?: Event) {
    event?.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    this.selectCellOption(section, visibleIndex, key, trimmedValue);
  }

  saveCustomSelectOptionForRow(section: ModuleKey, row: TableRow, key: string, value: string, event?: Event) {
    event?.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    this.selectCellOptionForRow(section, row, key, trimmedValue);
  }

  allowsCustomOption(section: ModuleKey, key: string): boolean {
    if (key === "site" || key === "siteMaterial" || key === "transactionType" || key === "approvalStatus" || key === "status" || key === "paymentStatus" || key === "attendance") return false;
    return this.selectOptions(section, key).length > 0;
  }

  selectOptionIcon(option: string): "approve" | "decline" | "" {
    const normalized = option.toLowerCase();
    if (normalized === "approve" || normalized === "approved" || normalized === "active" || normalized === "ready") return "approve";
    if (normalized === "decline" || normalized === "declined" || normalized === "rejected" || normalized === "inactive") return "decline";
    return "";
  }

  openLabourTypeDialog(row: TableRow) {
    this.labourTypeRowId.set(String(row["__rowId"] || ""));
    this.labourTypeName.set("");
    this.labourTypeCount.set("1");
    this.labourTypeDailyWage.set("");
    this.labourTypeDialogOpen.set(true);
  }

  closeLabourTypeDialog() {
    this.labourTypeDialogOpen.set(false);
    this.labourTypeRowId.set("");
  }

  updateLabourTypeName(value: string) {
    this.labourTypeName.set(value);
    const match = this.labourTypeDialogOptions().find((option) => option.toLowerCase() === value.trim().toLowerCase());
    if (match) this.applyLabourTypeSuggestion(match);
  }

  selectLabourTypeSuggestion(option: string) {
    this.labourTypeName.set(option);
    this.applyLabourTypeSuggestion(option);
  }

  saveLabourType(event: Event) {
    event.preventDefault();
    const rowId = this.labourTypeRowId();
    const type = this.labourTypeName().trim();
    const count = Math.max(0, Math.round(this.moneyNumber(this.labourTypeCount())));
    const dailyWage = Math.max(0, this.moneyNumber(this.labourTypeDailyWage()));
    if (!rowId || !type || !count) return;
    const row = this.visibleRows("labour").find((entry) => String(entry["__rowId"] || "") === rowId);
    const nextTypes = this.mergeLabourType(String(row?.["labourTypes"] || ""), type, count, dailyWage);
    const wageField = this.ensureLabourWageField(type);
    this.data.updateSharedRowCell(rowId, "labourTypes", nextTypes);
    this.data.updateSharedRowCell(rowId, "notes", nextTypes);
    if (dailyWage) this.data.updateSharedRowCell(rowId, wageField.key, formatMoney(dailyWage));
    this.closeLabourTypeDialog();
  }

  labourTypeCards(row: TableRow): Array<{ type: string; count: number; wage: number }> {
    return this.labourTypeEntriesForRow(row).filter((entry) => entry.count > 0);
  }

  labourTypeDialogOptions(): string[] {
    const row = this.labourTypeDialogRow();
    return row ? this.labourTypeOptionsForRow(row) : [];
  }

  private applyLabourTypeSuggestion(labourType: string) {
    const row = this.labourTypeDialogRow();
    const wage = row ? this.suggestedDailyWageForLabourType(row, labourType) : 0;
    this.labourTypeDailyWage.set(wage ? String(wage) : "");
  }

  private labourTypeDialogRow(): TableRow | undefined {
    const rowId = this.labourTypeRowId();
    return this.visibleRows("labour").find((entry) => String(entry["__rowId"] || "") === rowId);
  }

  removeLabourType(row: TableRow, labourType: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    const rowId = String(row["__rowId"] || "");
    if (!rowId) return;
    const remaining = this.labourTypeEntriesForRow(row).filter((entry) => entry.type.toLowerCase() !== labourType.toLowerCase());
    const nextTypes = remaining.map((entry) => `${entry.type}: ${entry.count}`).join(", ");
    const nextStaffCount = remaining.reduce((sum, entry) => sum + entry.count, 0);
    this.data.updateSharedRowCell(rowId, "labourTypes", nextTypes);
    this.data.updateSharedRowCell(rowId, "notes", nextTypes);
    this.data.updateSharedRowCell(rowId, "staffCount", nextStaffCount);
    const wageField = this.data.customFieldsFor("labour").find((field) => field.label.toLowerCase() === `${this.titleCase(labourType)} daily wage`.toLowerCase());
    if (wageField) this.data.updateSharedRowCell(rowId, wageField.key, "");
    const generatedKey = `${this.titleCase(labourType)} Daily Wage`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    this.data.updateSharedRowCell(rowId, generatedKey, "");
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
    const sourceRows = this.visibleRows(section);
    const rows = this.reportRows(section, sourceRows);
    const currentProject = this.project();
    const summary = section === "labour" ? this.labourSummaryHtml(rows) : section === "expenses" ? this.expenseSummaryHtml(sourceRows) : "";
    this.openPrintableReport({
      title: section === "labour" ? "Labour Attendance Report" : section === "expenses" ? "Expense Ledger Report" : this.activeConfig().title,
      subtitle: `${currentProject?.name ?? this.projectId()} - ${this.activeSiteFilter() === "All" ? "All Sites" : this.activeSiteFilter()}`,
      columns,
      rows,
      summary,
    });
  }

  downloadReportRow(row: TableRow) {
    const columns = this.columnsFor("reports");
    const currentProject = this.project();
    this.openPrintableReport({
      title: String(row["reportName"] || "Project Report"),
      subtitle: `${currentProject?.name ?? this.projectId()} - ${String(row["category"] || "Report")}`,
      columns,
      rows: [row],
      summary: `<section class="summary"><h2>Report Details</h2><div><strong>Owner</strong><span>${this.escapeHtml(String(row["owner"] || "-"))}</span></div><div><strong>Format</strong><span>${this.escapeHtml(String(row["exportFormat"] || "PDF / Excel"))}</span></div></section>`,
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

  closeProjectForm() {
    this.showProjectForm.set(false);
    this.editingProject.set(null);
    if (this.queryParamMap().get("editProject") === "1") {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { editProject: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    }
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
      receivedAmount: project.receivedAmount,
      openingBalance: project.expenseBalance,
      status: project.status,
    };
  }

  saveProject(value: ProjectFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.startDate || !value.supervisor || !value.totalValue) return;
    const editing = this.editingProject();
    const { openingBalance, ...projectValue } = value;
    if (editing) {
      const updated = this.data.updateProject(editing.id, { ...projectValue, expenseBalance: openingBalance });
      this.data.setExpenseOpeningBalance(editing.id, editing.sites[0] ?? "Main Site", openingBalance);
      this.editingProject.set(null);
      this.showProjectForm.set(false);
      if (updated && editing.id === this.projectId()) {
        void this.router.navigate(["/clients", currentClient.id, "projects", updated.id, this.activeSection()]);
      }
      return;
    }
    const project = this.data.addProject(currentClient, { ...projectValue, openingBalance });
    this.showProjectForm.set(false);
    setTimeout(() => void this.router.navigate(["/clients", currentClient.id, "projects", project.id, "materials"]));
  }

  updateProjectStatus(value: string, event?: Event) {
    if (!this.isProjectStatus(value)) return;
    const currentProject = this.project();
    if (!currentProject || currentProject.status === value) return;
    if ((value === "Completed" || value === "On Hold") && !window.confirm(`Mark ${currentProject.name} as ${value}?`)) {
      const select = event?.target instanceof HTMLSelectElement ? event.target : null;
      if (select) select.value = currentProject.status;
      return;
    }
    this.data.updateProject(this.projectId(), { status: value });
  }

  updateProjectReceived(value: string) {
    const amount = Number(String(value).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(amount)) return;
    this.data.updateProject(this.projectId(), { receivedAmount: amount });
  }

  projectReceivedAmount(project: Project): number {
    return this.data.projectReceivedAmount(project);
  }

  projectPendingAmount(project: Project): number {
    return this.data.projectPendingAmount(project);
  }

  updateProjectEstimatedValue(value: string) {
    const amount = Number(String(value).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(amount)) return;
    this.data.updateProject(this.projectId(), { totalValue: amount });
  }

  totalProjectExpenseLabel(): string {
    return formatMoney(this.totalProjectExpenseValue());
  }

  private totalProjectExpenseValue(): number {
    const expenseRows = this.data.tableRowsFor("expenses", this.tableRows().expenses, (row) => this.rowBelongsToProject(row));
    const expenseTotal = expenseRows.reduce((sum, row) => {
      const amount = this.expenseSignedAmount(row);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
    const labourRows = this.data.tableRowsFor("labour", this.tableRows().labour, (row) => this.rowBelongsToProject(row));
    const labourTotal = labourRows.reduce((sum, row) => sum + this.labourWeeklyPayForRow(this.withLabourPayable(row)).total, 0);
    return expenseTotal + labourTotal;
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
    const currentProject = this.data.projectById(projectId);
    const currentClient = this.data.clients().find((client) => client.projectIds.includes(projectId) || client.name === currentProject?.client);
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
      client: currentProject?.client ?? "",
      clientId: currentClient?.id ?? this.clientId(),
      attendanceDate: "2026-06-05",
      staffName: row.party,
      site: row.site,
      dailyWage: row.dailyWage,
      labourTypes: this.labourTypesFromRow(row),
      staffCount: row.presentCount,
      attendance: "Present",
      shift: this.normalizeShift(row.shift),
      overtime: `${row.overtime} hrs`,
      lateFine: formatMoney(row.lateFine),
      presentUnits: row.presentDays * row.presentCount,
      paymentMode: row.paymentMode,
      notes: row.notes,
      status: row.status,
    }));

    const expenses = this.data.expensesForProject(projectId).filter((row) => row.type === "Site Expense").map((row) => ({
        __rowId: `expense:${row.id}`,
        __projectId: row.projectId,
        projectId: row.projectId,
        expenseScope: row.type,
        expenseDate: row.date,
        transactionType: "Site Expense",
        description: row.description,
        amount: formatMoney(-row.spent),
        siteMaterial: "No",
        runningBalance: formatMoney(0),
        site: row.site,
        supervisor: row.supervisor,
        cashIssued: formatMoney(row.received),
        reference: row.reference,
        approvalStatus: row.status,
      }));

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
      materialsBought: this.materialPurchaseSummaryForVendor(vendor.name, projectId),
      phoneNumber: vendor.phone,
      address: vendor.address,
      gstNumber: vendor.gst,
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
      ["Financial", "Payment Collection Report", "Client receipt and pending receivable export", "Accountant", "PDF / Excel"],
      ["Financial", "Expense Report", "Supervisor expense and bill reference export", "Admin", "PDF / Excel"],
      ["Labour", "Attendance Report", "Site-wise attendance and wage export", "Project Manager", "Excel"],
      ["Material", "Inventory Report", "Purchased, consumed, and remaining stock export", "Project Manager", "Excel"],
      ["Subcontract", "Subcontractor Ledger", "Work package value, advance, balance, and status export", "Project Manager", "Excel"],
      ["Project", "Project Summary", "Project value, progress, sites, and status export", "Admin", "PDF"],
    ].map(([category, reportName, description, owner, exportFormat], index) => ({
      __rowId: `project-report:${projectId}:${index}`,
      __projectId: projectId,
      projectId,
      category,
      reportName,
      description,
      owner,
      exportFormat,
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
    return key === "clientId" || key === "runningBalance" || key === "weeklyPayable" || key === "weeklyPay" || key === "staffCount" || key === "balance";
  }

  selectOptions(section: ModuleKey, key: string): string[] {
    if (key === "site") return this.projectSites();
    if (key === "vendor" || key === "vendorName") return this.vendorNameOptions();
    if (section === "materials" && key === "materialName") return this.materialNameOptions();
    if (section === "materials" && key === "unit") return ["Bag", "Nos", "Kg", "Load", "Piece", "Item"];
    if (section === "labour" && key === "staffName") return this.staffNameOptionsForProject();
    if (section === "expenses" && key === "transactionType") {
      return ["Purchase", "Cash Added"];
    }
    if (section === "expenses" && key === "siteMaterial") return ["No", "Yes"];
    if (section === "labour" && key === "attendance") return ["Present", "Absent"];
    if (key === "approvalStatus" || key === "status") return ["Pending", "Approved", "Declined"];
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
        client: currentProject?.client ?? "",
        clientId: this.clientId(),
        projectId: this.projectId(),
        site,
        attendanceDate: today,
        staffName: this.staffNameOptionsForProject()[0] ?? "",
        labourTypes: "Mason: 1",
        staffCount: "1",
        attendance: "Present",
        shift: "1",
        overtime: "0",
        lateFine: "0",
        presentUnits: 1,
        paymentMode: "Cash",
        notes: "Mason: 1",
        status: "Pending",
      },
      expenses: {
        expenseDate: today,
        transactionType: "Purchase",
        description: "",
        amount: "0",
        siteMaterial: "No",
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
        materialsBought: formatNumber(0),
        phoneNumber: "",
        address: "",
        gstNumber: "",
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
      },
    };
    return defaults[section];
  }

  private withComputedRows(section: ModuleKey, rows: TableRow[]): TableRow[] {
    const normalizedRows = rows.map((row) => this.withNormalizedApprovalStatus(row));
    if (section === "expenses") return this.withExpenseBalances(normalizedRows);
    if (section === "labour") return normalizedRows.map((row) => this.withLabourPayable(row));
    if (section === "subcontractors") {
      return normalizedRows.map((row) => ({
        ...row,
        balance: formatMoney(this.moneyNumber(row["contractValue"]) - this.moneyNumber(row["advancePaid"])),
      }));
    }
    return normalizedRows;
  }

  private withNormalizedApprovalStatus(row: TableRow): TableRow {
    return {
      ...row,
      ...(row["status"] ? { status: this.normalizeApprovalStatus(row["status"]) } : {}),
      ...(row["approvalStatus"] ? { approvalStatus: this.normalizeApprovalStatus(row["approvalStatus"]) } : {}),
    };
  }

  private normalizeApprovalStatus(value: unknown): string {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "approve" || normalized === "approved") return "Approved";
    if (normalized === "decline" || normalized === "declined" || normalized === "rejected") return "Declined";
    return String(value || "");
  }

  private withExpenseBalances(rows: TableRow[]): TableRow[] {
    const balances = new Map<string, number>();
    const computedRows = this.expenseChronologicalRows(rows).map((row) => {
      const transactionType = this.normalizedExpenseTransactionType(String(row["transactionType"] || row["expenseScope"] || "Purchase"));
      const groupKey = this.expenseGroupKey(row);
      const previousBalance = balances.get(groupKey) ?? this.expenseOpeningBalanceFor(row, true, true);
      const balance = Math.max(0, previousBalance + this.expenseSignedAmount(row, transactionType));
      balances.set(groupKey, balance);
      return {
        ...row,
        transactionType,
        amount: this.expenseAmountDisplay(row),
        runningBalance: formatMoney(balance),
      };
    });
    return this.expenseDisplayRows(computedRows);
  }

  private withLabourPayable(row: TableRow): TableRow {
    const attendance = String(row["attendance"] || "Present");
    const labourTypes = this.cleanLabourTypeText(String(row["labourTypes"] || row["notes"] || "").trim());
    const enteredStaffCount = this.moneyNumber(row["staffCount"]);
    const staffCount = this.staffCountFromLabourTypes(labourTypes) || enteredStaffCount || this.moneyNumber(row["presentUnits"]) || 1;
    return {
      ...row,
      staffName: row["staffName"] || row["labourName"] || "",
      labourTypes,
      attendance,
      shift: this.normalizeShift(row["shift"]),
      staffCount,
      notes: labourTypes || row["notes"] || "",
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

  private staffNameOptionsForProject(): string[] {
    const names = new Set<string>();
    for (const row of this.data.tableRowsFor("labour", this.tableRows().labour, (entry) => this.rowBelongsToProject(entry))) {
      const name = String(row["staffName"] || row["labourName"] || "").trim();
      if (name) names.add(name);
    }
    ["Velu Mason Party", "Ganesh Plumbing", "Selvam Civil Works", "Balu Helper Team"].forEach((name) => names.add(name));
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  private materialPurchaseSummaryForVendor(vendorName: string, projectId: string): string {
    const rows = this.data
      .materialsForProject(projectId)
      .filter((row) => row.vendor.toLowerCase() === vendorName.toLowerCase());
    const purchased = rows.reduce((sum, row) => sum + row.purchased, 0);
    return rows.length ? `${formatNumber(rows.length)} records / ${formatNumber(purchased)} purchased` : "0 records";
  }

  private vendorNameOptions(): string[] {
    return [
      ...new Set([
        ...this.data.vendors().map((vendor) => vendor.name),
        ...this.data.materials().map((material) => material.vendor),
        ...this.data.tableRowsFor("materials", this.tableRows().materials, (row) => this.rowBelongsToProject(row)).map((row) => String(row["vendor"] || "")),
      ].map((value) => value.trim()).filter(Boolean)),
    ].sort((first, second) => first.localeCompare(second));
  }

  private materialNameOptions(): string[] {
    return [
      ...new Set([
        ...this.data.materials().map((material) => material.name),
        ...this.data.tableRowsFor("materials", this.tableRows().materials, (row) => this.rowBelongsToProject(row)).map((row) => String(row["materialName"] || row["name"] || "")),
      ].map((value) => value.trim()).filter(Boolean)),
    ].sort((first, second) => first.localeCompare(second));
  }

  private labourTypesFromRow(row: { category: string; notes: string; presentCount: number; dailyWage?: number }): string {
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
        const match = part.trim().match(/(?:[:x-])\s*(\d+(?:\.\d+)?)/i) ?? part.trim().match(/(\d+(?:\.\d+)?)/);
        return match ? Number(match[1]) : 0;
      })
      .filter((count) => Number.isFinite(count))
      .reduce((sum, count) => sum + count, 0);
  }

  private mergeLabourType(currentValue: string, labourType: string, count: number, dailyWage = 0): string {
    const entries = new Map<string, { count: number; wage: number }>();
    for (const part of currentValue.split(/[,;\n]+/)) {
      const entry = this.parseLabourTypeEntrySafe(part);
      if (entry) entries.set(entry.type, { count: entry.count, wage: entry.wage });
    }
    const existingKey = [...entries.keys()].find((key) => key.toLowerCase() === labourType.toLowerCase());
    const existing = existingKey ? entries.get(existingKey) : undefined;
    entries.set(existingKey ?? labourType, { count, wage: dailyWage || existing?.wage || 0 });
    return [...entries.entries()]
      .map(([type, value]) => `${type}: ${value.count}`)
      .join(", ");
  }

  private cleanLabourTypeText(value: string): string {
    const entries = value
      .split(/[,;\n]+/)
      .map((part) => this.parseLabourTypeEntrySafe(part))
      .filter((entry): entry is { type: string; count: number; wage: number } => Boolean(entry));
    return entries.length ? entries.map((entry) => `${entry.type}: ${entry.count}`).join(", ") : value;
  }

  private parseLabourTypeEntrySafe(value: string): { type: string; count: number; wage: number } | null {
    const text = value.trim();
    if (!text) return null;
    const countMatch = text.match(/^(.+?)(?:[:x-])\s*(\d+(?:\.\d+)?)/i);
    if (!countMatch) return null;
    const wageMatch = text.match(/(?:@|wage\s*[:=-]?)\s*(?:[^\d-]*)?([\d,]+(?:\.\d+)?)/i);
    return {
      type: countMatch[1].trim(),
      count: Number(countMatch[2]),
      wage: wageMatch ? this.moneyNumber(wageMatch[1]) : 0,
    };
  }

  private parseLabourTypeEntry(value: string): { type: string; count: number; wage: number } | null {
    const text = value.trim();
    if (!text) return null;
    const countMatch = text.match(/^(.+?)(?:[:x-])\s*(\d+(?:\.\d+)?)/i);
    if (!countMatch) return null;
    const wageMatch = text.match(/(?:@|wage\s*[:=-]?)\s*(?:₹|rs\.?)?\s*([\d,]+(?:\.\d+)?)/i);
    return {
      type: countMatch[1].trim(),
      count: Number(countMatch[2]),
      wage: wageMatch ? this.moneyNumber(wageMatch[1]) : 0,
    };
  }

  private ensureLabourWageField(labourType: string): FieldSchema {
    const label = `${this.titleCase(labourType)} Daily Wage`;
    const existing = this.data.customFieldsFor("labour").find((field) => field.label.toLowerCase() === label.toLowerCase());
    return existing ?? this.data.addCustomField("labour", label, this.columnsFor("labour"));
  }

  private titleCase(value: string): string {
    return value
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  expenseOpeningSiteLabel(): string {
    const site = this.activeSiteFilter();
    return site === "All" ? "Select a site to edit opening balance" : `${site} opening balance`;
  }

  expenseOpeningTitleLabel(): string {
    return this.activeSiteFilter() === "All" ? "Total Opening Balance" : "Opening Balance";
  }

  expenseOpeningBalanceInput(): string {
    return String(this.expenseOpeningBalanceFor({ projectId: this.projectId(), site: this.expenseEditableSite() }));
  }

  updateExpenseOpeningBalance(value: string) {
    this.data.setExpenseOpeningBalance(this.projectId(), this.expenseEditableSite(), this.moneyNumber(value));
  }

  toggleExpenseOpeningEdit() {
    if (this.activeSiteFilter() === "All") {
      this.expenseOpeningEdit.set(false);
      return;
    }
    this.expenseOpeningEdit.update((isEditing) => !isEditing);
  }

  expenseDraftSiteLabel(): string {
    return this.expenseDraftSite();
  }

  expenseDraftOpeningBalanceInput(): string {
    return String(this.expenseOpeningBalanceFor({ projectId: this.projectId(), site: this.expenseDraftSite() }));
  }

  updateExpenseDraftOpeningBalance(value: string) {
    this.data.setExpenseOpeningBalance(this.projectId(), this.expenseDraftSite(), this.moneyNumber(value));
  }

  expenseOpeningBalanceLabel(): string {
    const rows = this.expenseChronologicalRows(this.visibleRows("expenses"));
    if (this.activeSiteFilter() === "All") {
      if (!rows.length) {
        return formatMoney(this.expenseLedgerSites().reduce((sum, site) => sum + this.expenseOpeningBalanceFor({ projectId: this.projectId(), site }), 0));
      }
      const openingByGroup = new Map<string, number>();
      for (const row of rows) {
        const key = this.expenseGroupKey(row);
        if (!openingByGroup.has(key)) openingByGroup.set(key, this.expenseOpeningBalanceFor(row, true, true));
      }
      return formatMoney([...openingByGroup.values()].reduce((sum, amount) => sum + amount, 0));
    }
    const row = rows.find((entry) => String(entry["site"] || "").toLowerCase() === this.activeSiteFilter().toLowerCase());
    return formatMoney(row ? this.expenseOpeningBalanceFor(row, true, true) : this.expenseOpeningBalanceFor({ projectId: this.projectId(), site: this.activeSiteFilter() }));
  }

  expenseCurrentBalanceLabel(): string {
    const rows = this.expenseChronologicalRows(this.visibleRows("expenses"));
    if (!rows.length) return this.expenseOpeningBalanceLabel();
    const latestByGroup = new Map<string, number>();
    if (this.activeSiteFilter() === "All") {
      for (const site of this.expenseLedgerSites()) {
        latestByGroup.set(this.expenseGroupKey({ projectId: this.projectId(), site }), this.expenseOpeningBalanceFor({ projectId: this.projectId(), site }));
      }
    }
    for (const row of rows) latestByGroup.set(this.expenseGroupKey(row), this.moneyNumber(row["runningBalance"]));
    if (this.activeSiteFilter() !== "All") {
      return formatMoney([...latestByGroup.values()].at(-1) ?? this.expenseOpeningBalanceFor({ projectId: this.projectId(), site: this.activeSiteFilter() }));
    }
    const total = [...latestByGroup.values()].reduce((sum, balance) => sum + balance, 0);
    return formatMoney(total);
  }

  expenseCashAddedLabel(): string {
    const rows = this.visibleRows("expenses");
    const openingByGroup = new Map<string, number>();
    const cashAdded = rows.reduce((sum, row) => {
      const key = this.expenseGroupKey(row);
      if (!openingByGroup.has(key)) openingByGroup.set(key, this.expenseOpeningBalanceFor(row, true, true));
      const amount = this.expenseSignedAmount(row);
      return amount > 0 ? sum + amount : sum;
    }, 0);
    return formatMoney(cashAdded);
  }

  expenseSpentLabel(): string {
    const spent = this.visibleRows("expenses").reduce((sum, row) => {
      const amount = this.expenseSignedAmount(row);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
    return formatMoney(spent);
  }

  private expenseGroupKey(row: TableRow): string {
    const projectId = String(row["projectId"] || row["__projectId"] || this.projectId() || "project");
    const site = String(row["site"] || "Project").trim().toLowerCase();
    return `${projectId}::${site}`;
  }

  private expenseRowSortValue(row: TableRow): string {
    const date = String(row["expenseDate"] || row["date"] || "");
    return `${this.expenseGroupKey(row)}::${date}::${row["__rowId"] || ""}`;
  }

  private expenseChronologicalRows(rows: TableRow[]): TableRow[] {
    return [...rows].sort((first, second) => this.expenseRowSortValue(first).localeCompare(this.expenseRowSortValue(second)));
  }

  private expenseDisplayRows(rows: TableRow[]): TableRow[] {
    return [...rows].sort((first, second) => this.expenseRowSortValue(second).localeCompare(this.expenseRowSortValue(first)));
  }

  private expenseOpeningBalanceFor(row: TableRow, allowProjectFallback = true, allowAnySiteFallback = false): number {
    const projectId = String(row["projectId"] || row["__projectId"] || this.projectId());
    const site = String(row["site"] || this.expenseEditableSite());
    const savedOpening = this.data.expenseOpeningBalanceFor(projectId, site);
    if (savedOpening !== undefined) return savedOpening;
    const explicitOpening = this.explicitExpenseOpeningForGroup(projectId, site);
    if (explicitOpening) return explicitOpening;
    const issuedOpening = this.expenseCashIssuedOpeningForGroup(projectId, site);
    if (issuedOpening) return issuedOpening;
    if (!allowProjectFallback || (!allowAnySiteFallback && !this.isPrimaryExpenseSite(projectId, site))) return 0;
    const project = this.data.projectById(projectId);
    return project?.expenseBalance ?? 0;
  }

  private expenseSignedAmount(row: TableRow, transactionType = String(row["transactionType"] || "")): number {
    const amount = Math.abs(this.moneyNumber(row["amount"]));
    if (!amount) return 0;
    return this.isExpenseCredit(transactionType) ? amount : -amount;
  }

  private normalizedExpenseInputRow(row: TableRow): TableRow {
    const transactionType = this.normalizedExpenseTransactionType(String(row["transactionType"] || "Purchase"));
    return {
      ...row,
      transactionType,
      amount: this.positiveExpenseAmountValue(row["amount"]),
      siteMaterial: transactionType === "Purchase" ? this.normalizeYesNo(row["siteMaterial"]) : "No",
      approvalStatus: row["approvalStatus"] || "Pending",
    };
  }

  private normalizedExpenseTransactionType(value: string): string {
    return this.isExpenseCredit(value) ? "Cash Added" : "Purchase";
  }

  private positiveExpenseAmountValue(value: unknown): string {
    return String(Math.abs(this.moneyNumber(value)));
  }

  private expenseAmountDisplay(row: TableRow): string {
    return formatMoney(Math.abs(this.moneyNumber(row["amount"])));
  }

  private normalizeYesNo(value: unknown): string {
    return String(value || "").trim().toLowerCase() === "yes" ? "Yes" : "No";
  }

  private ensureExpenseOpeningForInput(row: TableRow) {
    const projectId = this.projectId();
    const site = String(row["site"] || this.expenseEditableSite()).trim();
    if (!projectId || !site || this.data.expenseOpeningBalanceFor(projectId, site) !== undefined) return;
    const projectOpening = this.project()?.expenseBalance ?? 0;
    this.data.setExpenseOpeningBalance(projectId, site, projectOpening);
  }

  private explicitExpenseOpeningForGroup(projectId: string, site: string): number {
    const normalizedSite = site.trim().toLowerCase();
    if (!normalizedSite || normalizedSite === "all") return 0;
    const rows = this.data.tableRowsFor("expenses", this.tableRows().expenses, (row) => this.rowBelongsToProject(row));
    const match = rows.find((row) => {
      const rowProjectId = String(row["projectId"] || row["__projectId"] || this.projectId());
      const rowSite = String(row["site"] || "").trim().toLowerCase();
      return rowProjectId === projectId && rowSite === normalizedSite && this.moneyNumber(row["openingBalance"]);
    });
    return match ? this.moneyNumber(match["openingBalance"]) : 0;
  }

  private expenseCashIssuedOpeningForGroup(projectId: string, site: string): number {
    const normalizedSite = site.trim().toLowerCase();
    if (!normalizedSite || normalizedSite === "all") return 0;
    const rows = this.data
      .tableRowsFor("expenses", this.tableRows().expenses, (row) => this.rowBelongsToProject(row))
      .filter((row) => {
        const rowProjectId = String(row["projectId"] || row["__projectId"] || this.projectId());
        const rowSite = String(row["site"] || "").trim().toLowerCase();
        return rowProjectId === projectId && rowSite === normalizedSite;
      })
      .sort((first, second) => this.expenseRowSortValue(first).localeCompare(this.expenseRowSortValue(second)));
    const openingRow = rows.find((row) => this.moneyNumber(row["cashIssued"]) || this.moneyNumber(row["received"]));
    return openingRow ? this.moneyNumber(openingRow["cashIssued"]) || this.moneyNumber(openingRow["received"]) : 0;
  }

  private expenseLedgerSites(): string[] {
    const sites = new Set<string>();
    for (const site of this.projectSites()) {
      const cleanSite = site.trim();
      if (cleanSite) sites.add(cleanSite);
    }
    const rows = this.data.tableRowsFor("expenses", this.tableRows().expenses, (row) => this.rowBelongsToProject(row));
    for (const row of rows) {
      const cleanSite = String(row["site"] || "").trim();
      if (cleanSite) sites.add(cleanSite);
    }
    return [...sites];
  }

  private isPrimaryExpenseSite(projectId: string, site: string): boolean {
    const project = this.data.projectById(projectId);
    const normalizedSite = site.trim().toLowerCase();
    const primarySite = String(project?.sites[0] || "").trim().toLowerCase();
    return !normalizedSite || normalizedSite === "project" || (!!primarySite && normalizedSite === primarySite);
  }

  private expenseEditableSite(): string {
    const site = this.activeSiteFilter();
    return site === "All" ? this.projectSites()[0] ?? "Project" : site;
  }

  private expenseDraftSite(): string {
    const site = String(this.draftRow()["site"] || this.expenseEditableSite()).trim();
    return site || this.expenseEditableSite();
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
      const wageFields = this.data.customFieldsFor("labour").filter((field) => this.isLabourWageField(field));
      return [
        { key: "attendanceDate", label: "Date" },
        { key: "staffName", label: "Staff Name" },
        { key: "labourTypes", label: "Labour Types" },
        ...wageFields,
        { key: "staffCount", label: "Staff Count" },
        { key: "attendance", label: "Attendance" },
        { key: "shift", label: "Shift" },
        { key: "overtimeLate", label: "Overtime / Late" },
        { key: "weeklyPayByType", label: "Weekly Pay by Labour Type" },
        { key: "weeklyPayTotal", label: "Combined Weekly Pay" },
      ];
    }
    return this.columnsFor(section);
  }

  private reportRows(section: ModuleKey, rows: TableRow[]): TableRow[] {
    if (section === "expenses") {
      const chronologicalRows = this.expenseChronologicalRows(rows);
      const openingRows: TableRow[] = [];
      const seenGroups = new Set<string>();
      for (const row of chronologicalRows) {
        const key = this.expenseGroupKey(row);
        if (seenGroups.has(key)) continue;
        seenGroups.add(key);
        const opening = this.expenseOpeningBalanceFor(row, true, true);
        openingRows.push({
          ...row,
          expenseDate: String(row["expenseDate"] || row["date"] || ""),
          transactionType: "Opening Balance",
          description: `Opening balance - ${row["site"] || "Project"}`,
          amount: formatMoney(opening),
          runningBalance: formatMoney(opening),
        });
      }
      return [...openingRows, ...chronologicalRows];
    }
    if (section !== "labour") return rows;
    return rows.map((row) => {
      const weeklyPay = this.labourWeeklyPayForRow(row);
      return {
        ...row,
        overtimeLate: `${row["overtime"] || "0"} overtime / ${row["lateFine"] || "0"} late fine`,
        weeklyPayByType: weeklyPay.breakup,
        weeklyPayTotal: formatMoney(weeklyPay.total),
      };
    });
  }

  private labourWeeklyPayForRow(row: TableRow): { breakup: string; total: number; items: Array<{ type: string; count: number; wage: number; amount: number }> } {
    if (String(row["attendance"] || "").toLowerCase() === "absent") return { breakup: "Absent", total: 0, items: [] };
    const entries = this.labourTypeEntriesForRow(row);
    const shift = this.moneyNumber(row["shift"]) || 1;
    const items = entries.map((entry) => {
      const amount = entry.count * entry.wage * shift;
      return { ...entry, amount };
    });
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return {
      breakup: items.length ? items.map((item) => `${item.type}: ${formatMoney(item.amount)}`).join(", ") : formatMoney(0),
      total,
      items,
    };
  }

  private labourTypeEntriesForRow(row: TableRow): Array<{ type: string; count: number; wage: number }> {
    const labourTypes = String(row["labourTypes"] || row["notes"] || "").trim();
    const parsed = labourTypes
      .split(/[,;\n]+/)
      .map((part) => this.parseLabourTypeEntrySafe(part))
      .filter((entry): entry is { type: string; count: number; wage: number } => Boolean(entry));
    const entries = parsed.length
      ? parsed
      : [{ type: "Labour", count: this.moneyNumber(row["staffCount"]) || this.moneyNumber(row["presentUnits"]) || 0, wage: 0 }];
    return entries.map((entry) => ({
      type: entry.type,
      count: entry.count,
      wage: this.dailyWageForLabourType(row, entry.type, entries.length) || entry.wage,
    }));
  }

  private labourTypeOptionsForRow(row: TableRow): string[] {
    const options = new Set<string>();
    const rows = this.data.tableRowsFor("labour", this.tableRows().labour, (entry) => this.rowBelongsToProject(entry));
    for (const entry of rows) {
      for (const type of this.labourTypeEntriesForRow(entry)) {
        options.add(type.type);
      }
    }
    return [...options].sort((a, b) => a.localeCompare(b));
  }

  private dailyWageForLabourType(row: TableRow, labourType: string, typeCount: number): number {
    const suggestedWage = this.suggestedDailyWageForLabourType(row, labourType);
    if (suggestedWage) return suggestedWage;
    const rowWage = this.moneyNumber(row["dailyWage"]);
    if (rowWage) return rowWage;
    return typeCount === 1 ? this.moneyNumber(row["weeklyPayable"]) : 0;
  }

  private suggestedDailyWageForLabourType(row: TableRow, labourType: string): number {
    const label = `${this.titleCase(labourType)} Daily Wage`.toLowerCase();
    const generatedKey = label.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const field = this.data.customFieldsFor("labour").find((candidate) => candidate.label.toLowerCase() === label);
    const wage = this.moneyNumber(row[field?.key ?? generatedKey]) || this.moneyNumber(row[generatedKey]);
    if (wage) return wage;
    return this.historicalDailyWageForLabourType(row, labourType);
  }

  private historicalDailyWageForLabourType(row: TableRow, labourType: string): number {
    const rowId = String(row["__rowId"] || "");
    const normalizedType = labourType.toLowerCase();
    const projectId = String(row["projectId"] || row["__projectId"] || this.projectId());
    const wageField = this.data.customFieldsFor("labour").find((field) => field.label.toLowerCase() === `${this.titleCase(labourType)} daily wage`.toLowerCase());
    const rows = this.data.tableRowsFor("labour", this.tableRows().labour, (entry) => this.rowBelongsToProject(entry));
    for (const candidate of rows) {
      if (String(candidate["__rowId"] || "") === rowId) continue;
      if (String(candidate["projectId"] || candidate["__projectId"] || projectId) !== projectId) continue;
      const hasType = String(candidate["labourTypes"] || candidate["notes"] || "")
        .split(/[,;\n]+/)
        .map((part) => this.parseLabourTypeEntrySafe(part))
        .some((entry) => entry?.type.toLowerCase() === normalizedType);
      if (!hasType) continue;
      const generatedKey = `${this.titleCase(labourType)} Daily Wage`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const wage = this.moneyNumber(candidate[wageField?.key ?? generatedKey]) || this.moneyNumber(candidate[generatedKey]) || this.moneyNumber(candidate["dailyWage"]);
      if (wage) return wage;
    }
    return 0;
  }

  private labourSummaryHtml(rows: TableRow[]): string {
    const staffSummary = new Map<string, { present: number; absent: number; staff: number }>();
    const wageSummary = new Map<string, { staff: number; payable: number }>();
    for (const row of rows) {
      const name = String(row["staffName"] || row["labourName"] || "Unnamed");
      const current = staffSummary.get(name) ?? { present: 0, absent: 0, staff: 0 };
      const isAbsent = String(row["attendance"] || "").toLowerCase() === "absent";
      if (isAbsent) current.absent += 1;
      else current.present += 1;
      const staffCount = this.moneyNumber(row["staffCount"]) || this.staffCountFromLabourTypes(String(row["labourTypes"] || ""));
      if (!isAbsent) current.staff += staffCount;
      staffSummary.set(name, current);

      const weeklyPay = this.labourWeeklyPayForRow(row);
      for (const item of weeklyPay.items) {
        const summary = wageSummary.get(item.type) ?? { staff: 0, payable: 0 };
        summary.staff += item.count;
        summary.payable += item.amount;
        wageSummary.set(item.type, summary);
      }
    }
    if (!staffSummary.size && !wageSummary.size) return "";
    const combinedPayable = [...wageSummary.values()].reduce((sum, value) => sum + value.payable, 0);
    const wageHtml = wageSummary.size
      ? `<h2>Labour Wage Summary</h2>${[...wageSummary.entries()]
          .map(
            ([type, value]) =>
              `<div><strong>${this.escapeHtml(type)}</strong><span>Staff units: ${value.staff}</span><span>Weekly pay: ${this.escapeHtml(formatMoney(value.payable))}</span></div>`,
          )
          .join("")}<div><strong>Combined Payable</strong><span>${this.escapeHtml(formatMoney(combinedPayable))}</span></div>`
      : "";
    const staffHtml = [...staffSummary.entries()]
      .map(
        ([name, value]) =>
          `<div><strong>${this.escapeHtml(name)}</strong><span>Present: ${value.present}</span><span>Absent: ${value.absent}</span><span>Staff: ${value.staff}</span></div>`,
      )
      .join("");
    return `<section class="summary">${wageHtml}<h2>Attendance Summary</h2>${staffHtml}</section>`;
  }

  private expenseSummaryHtml(rows: TableRow[]): string {
    const ledgerRows = this.expenseChronologicalRows(rows);
    const openingByGroup = new Map<string, number>();
    const closingByGroup = new Map<string, number>();
    const spent = ledgerRows.reduce((sum, row) => {
      const key = this.expenseGroupKey(row);
      if (!openingByGroup.has(key)) openingByGroup.set(key, this.expenseOpeningBalanceFor(row, true, true));
      closingByGroup.set(key, this.moneyNumber(row["runningBalance"]));
      const amount = this.expenseSignedAmount(row);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
    const received = ledgerRows.reduce((sum, row) => {
      const amount = this.expenseSignedAmount(row);
      return amount > 0 ? sum + amount : sum;
    }, [...openingByGroup.values()].reduce((sum, amount) => sum + amount, 0));
    const closing = formatMoney([...closingByGroup.values()].reduce((sum, amount) => sum + amount, 0));
    return `<section class="summary"><h2>Expense Summary</h2><div><strong>Opening / Received</strong><span>${this.escapeHtml(formatMoney(received))}</span></div><div><strong>Expenses</strong><span>${this.escapeHtml(formatMoney(spent))}</span></div><div><strong>Closing Balance</strong><span>${this.escapeHtml(closing)}</span></div></section>`;
  }

  private openPrintableReport(config: { title: string; subtitle: string; columns: FieldSchema[]; rows: TableRow[]; summary: string }) {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;
    const generatedAt = new Date().toLocaleString();
    const tableRows = config.rows
      .map((row) => `<tr>${config.columns.map((column) => `<td>${this.escapeHtml(String(row[column.key] ?? ""))}</td>`).join("")}</tr>`)
      .join("");
    reportWindow.document.write(`<!doctype html>
<html>
<head>
  <title>${this.escapeHtml(config.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 30px; color: #111827; background: #f5f7fb; font-family: Inter, Arial, sans-serif; }
    .sheet { max-width: 1180px; margin: 0 auto; padding: 28px; border: 1px solid #cbd6e6; border-radius: 14px; background: #ffffff; }
    header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: start; padding-bottom: 20px; border-bottom: 3px solid #002263; }
    .brand { color: #002263; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 8px 0 6px; color: #0f172a; font-size: 25px; line-height: 1.12; }
    p { margin: 0; color: #526070; font-size: 13px; }
    .meta { display: grid; gap: 6px; min-width: 190px; padding: 12px; border: 1px solid #d6e0ee; border-radius: 10px; background: #f8fbff; color: #334155; font-size: 12px; }
    table { width: 100%; margin-top: 22px; border-collapse: collapse; background: #fff; font-size: 12px; }
    th, td { padding: 10px 11px; border: 1px solid #cfd8e6; text-align: left; vertical-align: top; }
    th { background: #eef4ff; color: #002263; font-weight: 900; text-transform: uppercase; font-size: 10px; letter-spacing: .03em; }
    td { color: #1f2937; font-weight: 650; }
    tr:nth-child(even) td { background: #fbfcff; }
    .summary { display: grid; gap: 8px; margin-top: 18px; padding: 14px; border: 1px solid #cfd8e6; border-radius: 10px; background: #f8fafc; }
    .summary h2 { margin: 0 0 4px; color: #0f172a; font-size: 16px; }
    .summary div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e4e9f1; padding-bottom: 6px; }
    .summary div:last-child { border-bottom: 0; padding-bottom: 0; }
    footer { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 50px; color: #526070; font-size: 12px; }
    footer div { padding-top: 38px; border-top: 1px solid #94a3b8; text-align: center; }
    .print-action { margin-top: 18px; border: 0; border-radius: 8px; background: #002263; color: #fff; padding: 11px 16px; font-weight: 900; cursor: pointer; }
    @media print { body { margin: 0; background: #fff; } .sheet { max-width: none; border: 0; border-radius: 0; padding: 0; } button { display: none; } }
  </style>
</head>
<body>
  <main class="sheet">
    <header>
      <div><div class="brand">Annai Golden Builders</div><h1>${this.escapeHtml(config.title)}</h1><p>${this.escapeHtml(config.subtitle)}</p></div>
      <div class="meta"><strong>Generated</strong><span>${this.escapeHtml(generatedAt)}</span><span>Prepared for review and approval</span></div>
    </header>
    <table>
      <thead><tr>${config.columns.map((column) => `<th>${this.escapeHtml(column.label)}</th>`).join("")}</tr></thead>
      <tbody>${tableRows || `<tr><td colspan="${config.columns.length}">No records available</td></tr>`}</tbody>
    </table>
    ${config.summary}
    <button class="print-action" onclick="window.print()">Print / Save PDF</button>
    <footer><div>Prepared By</div><div>Verified By</div><div>Approved / Stamp</div></footer>
  </main>
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

  private escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
