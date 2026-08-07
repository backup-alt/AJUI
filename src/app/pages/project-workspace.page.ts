import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import type { MaterialRow, Project, ProjectStatus } from "../../data/dashboardData";
import { ErpDataService, type SharedModuleKey, type SharedTableField, type SharedTableRow } from "../data/erp-data.service";
import { MaterialsService } from "../core/materials.service";
import { ApiService } from "../core/api.service";
import { WorkspaceHydrationService } from "../core/workspace-hydration.service";
import { mapMaterial, mapLabour, mapExpense, mapPayment, mapVendor, mapSubcontractor, mapInventory } from "../core/mappers";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, formatNumber, statusClass } from "../shared/format";
import { ProjectFormDialogComponent, type ProjectFormValue } from "../shared/project-form-dialog.component";
import { VendorFormDialogComponent, type VendorFormValue } from "../shared/vendor-form-dialog.component";
import { InventoryInitDialogComponent } from "../shared/inventory-init-dialog.component";

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

const paymentModeOptions = ["Cash", "UPI", "Bank Transfer", "NEFT", "RTGS", "IMPS", "Cheque", "Credit Card", "Debit Card", "Net Banking", "Demand Draft", "Wallet", "Other"];

const PAYMENT_MODE_STORAGE_KEY = "ajui_custom_payment_modes";

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
      { key: "issuedAmount", label: "Issued Amount", type: "number" },
      { key: "givenAmount", label: "Given Amount", type: "number" },
      { key: "requestedQuantity", label: "Requested Quantity", type: "number" },
      { key: "approvedQuantity", label: "Approved Quantity", type: "number" },
      { key: "requestDate", label: "Request Date", type: "date" },
      { key: "vendor", label: "Vendor" },
      { key: "poNumber", label: "PO Number" },
      { key: "reference", label: "Bill / Reference" },
      { key: "remainingStock", label: "Remaining Stock" },
      { key: "notes", label: "Notes" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "labour",
    label: "Labour",
    title: "Labour Attendance",
    description: "Staff attendance with site, date, supervisor name, labour types, staff count, shift count, overtime, and fine.",
    columns: [
      { key: "client", label: "Client" },
      { key: "site", label: "Site" },
      { key: "attendanceDate", label: "Date", type: "date" },
      { key: "subcontractorName", label: "Subcontractor" },
      { key: "labourTypes", label: "Labour Types" },
      { key: "staffCount", label: "Staff Count", type: "number" },
      { key: "attendance", label: "Attendance" },
      { key: "shift", label: "Shift", type: "number" },
      { key: "overtime", label: "Overtime" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "expenses",
    label: "Expenses",
    title: "Site Expense Ledger",
    description: "Supervisor cash ledger and site expense fields with PO number, receipt, and approval status.",
    columns: [
      { key: "expenseDate", label: "Expense Date", type: "date" },
      { key: "transactionType", label: "Transaction Type" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "siteMaterial", label: "Site Material" },
      { key: "runningBalance", label: "Balance" },
      { key: "site", label: "Site" },
      { key: "supervisor", label: "Supervisor" },
      { key: "poNumber", label: "PO Number" },
      { key: "reference", label: "Bill / Reference" },
      { key: "notes", label: "Notes" },
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
    label: "Subcontractor Payments",
    title: "Subcontractor Payments",
    description: "Every payment recorded against sub-contractors for this project. Each row is a separate record and folds into the project total expense.",
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "subcontractorName", label: "Subcontractor" },
      { key: "siteName", label: "Site" },
      { key: "description", label: "Work Description" },
      { key: "employeeCount", label: "Number of Employees", type: "number" },
      { key: "amount", label: "Total Paid", type: "number" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    title: "Inventory by Site",
    description: "Approved materials, purchased/consumed quantities, and remaining stock per site.",
    columns: [
      { key: "site", label: "Site" },
      { key: "materialName", label: "Material Name" },
      { key: "unit", label: "Unit" },
      { key: "requestedQuantity", label: "Requested", type: "number" },
      { key: "approvedQuantity", label: "Approved", type: "number" },
      { key: "purchasedQuantity", label: "Purchased", type: "number" },
      { key: "consumedQuantity", label: "Consumed", type: "number" },
      { key: "remainingStock", label: "Remaining Stock" },
      { key: "minimumQuantity", label: "Min Qty", type: "number" },
      { key: "vendor", label: "Vendor" },
      { key: "poNumber", label: "PO Number" },
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
    VendorFormDialogComponent,
    InventoryInitDialogComponent,
  ],
  styles: [`
    .operations-dialog:has(.draft-select-menu.open) {
      overflow: visible;
    }
    .operations-dialog:has(.draft-select-menu.open) > .erp-form {
      overflow: visible;
    }
    .draft-select-menu .erp-select-panel {
      width: 100%;
      min-width: 220px;
      max-height: 240px;
      overflow-y: auto;
    }
    .erp-select-filter {
      width: 100%;
      padding: 8px 10px;
      margin: 0 0 6px;
      border: 1px solid var(--ui-line);
      border-radius: 6px;
      background: var(--ui-panel, #fff);
      color: var(--ui-text);
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
    }
    .erp-select-filter:focus {
      border-color: var(--ui-accent, #3b82f6);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
    }
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
    .custom-mode-row {
      margin-top: 6px;
    }
    .custom-mode-input {
      width: 100%;
    }
  `],
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
          [blurred]="recordDialogOpen() || labourTypeDialogOpen() || filterBuilderOpen() || showProjectForm() || showVendorDialog() || !!editingInlineVendor()"
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
                    <span class="site-chip-unit" *ngFor="let site of displaySites()">
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
                    @if (data.siteError()) {
                      <div class="site-toast" (click)="data.siteError.set(null)">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z"/></svg>
                        <span>{{ data.siteError() }}</span>
                      </div>
                    }
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
                    *ngIf="!tableViewExpanded() && !isNoCreateTab()"
                    title="Add row"
                    aria-label="Add row"
                    (click)="openRecordDialog()"
                  >
                    <ion-icon name="add-outline"></ion-icon>
                    Add Row
                  </button>
                  <button
                    type="button"
                    class="primary-table-action"
                    *ngIf="!tableViewExpanded() && selectedRowCount() > 0"
                    title="Edit selected row"
                    aria-label="Edit selected row"
                    (click)="editSelectedRows()"
                  >
                    <ion-icon name="create-outline"></ion-icon>
                    Edit Row
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
                          <button *ngIf="!isLabourGroupRow(row)" type="button" class="icon-row-action" aria-label="Edit row" title="Edit row" (click)="startRowEdit(row, $event)">
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
                            <span class="labour-group-badge" *ngIf="isLabourGroupRow(row)">{{ labourGroupCount(row) }} entries</span>
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
                              <span>{{ displayCell(row, column.key) || 'Select' }}</span>
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
                            <ng-container *ngIf="column.key === 'reference' && row['billUrl'] && !isRowEditing(row); else normalEditableCell">
                              @if (isDataUrl($any(row['billUrl']))) {
                                <button type="button" class="bill-link" (click)="openImagePreview($any(row['billUrl']))">View Bill</button>
                              } @else {
                                <a class="bill-link" [href]="row['billUrl']" target="_blank" rel="noopener noreferrer" (click)="$event.stopPropagation()">View Bill</a>
                              }
                            </ng-container>
                            <ng-template #normalEditableCell>
                              <span
                                class="editable-cell"
                                [class.cell-readonly]="!isRowEditing(row) || isReadonlyColumn(column.key)"
                                [attr.contenteditable]="isRowEditing(row) && !isReadonlyColumn(column.key) ? 'true' : null"
                                spellcheck="false"
                                (blur)="isRowEditing(row) && !isReadonlyColumn(column.key) && updateRowCell(activeSection(), row, column.key, $any($event.target).textContent || '')"
                              >
                                {{ displayCell(row, column.key) }}
                              </span>
                            </ng-template>
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
                    <ng-container *ngIf="isPaymentModeField(column); else standardRecordField">
                      <select
                        [value]="draftRow()[column.key] || ''"
                        (change)="updateDraftField(column.key, $any($event.target).value)"
                      >
                        <option *ngFor="let option of selectOptions(activeSection(), column.key)" [value]="option">{{ option }}</option>
                      </select>
                      <div class="custom-mode-row">
                        <input
                          class="custom-mode-input"
                          placeholder="Type a new mode & press Enter"
                          (keydown.enter)="addCustomPaymentModeFromInput($any($event.target).value, $event)"
                        />
                      </div>
                    </ng-container>
                    <ng-template #standardRecordField>
                      <ng-container *ngIf="isRecordSelectField(column); else projectDraftInput">
                        <div
                          class="erp-select-menu draft-select-menu"
                          [class.open]="isDraftSelectOpen(column.key)"
                        >
                          <button type="button" class="erp-select-trigger" (click)="toggleDraftSelect(column.key)">
                            <span>{{ draftRow()[column.key] || 'Select' }}</span>
                            <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                              <path d="M5.5 7.5 10 12l4.5-4.5" />
                            </svg>
                          </button>
                          <div class="erp-select-panel" *ngIf="isDraftSelectOpen(column.key)">
                            <input
                              #draftSelectSearchInput
                              type="text"
                              class="erp-select-filter"
                              placeholder="Type to filter"
                              autofocus
                              [value]="draftSelectSearch()"
                              (input)="draftSelectSearch.set($any($event.target).value)"
                              (keydown.escape)="closeDraftSelect()"
                            />
                            <button
                              *ngFor="let option of filteredSelectOptions(activeSection(), column.key)"
                              type="button"
                              [class.selected]="option === draftRow()[column.key]"
                              (click)="selectDraftOption(column.key, option)"
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
                                #draftCustomValue
                                (keydown.enter)="saveCustomDraftOption(column.key, draftCustomValue.value, $event)"
                                placeholder="Type value and press Enter"
                              />
                            </label>
                          </div>
                        </div>
                      </ng-container>
                      <ng-template #projectDraftInput>
                        <input
                          [type]="column.type || 'text'"
                          [value]="draftRow()[column.key] || ''"
                          (input)="updateDraftField(column.key, $any($event.target).value)"
                        />
                      </ng-template>
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

            <agb-vendor-form-dialog
              *ngIf="showVendorDialog()"
              [eyebrow]="editingInlineVendor() ? 'Vendor Edit' : 'Vendor Setup'"
              [title]="editingInlineVendor() ? 'Edit Vendor' : 'Add New Vendor'"
              [description]="editingInlineVendor() ? 'Update vendor contact, material type, GST, and address information.' : 'Create the vendor record to track material purchases and GST.'"
              [submitLabel]="editingInlineVendor() ? 'Save Changes' : 'Create Vendor'"
              [initialValue]="editingInlineVendor() ? inlineVendorEditValue() : null"
              [showSiteAssignment]="false"
              (cancel)="closeVendorDialog()"
              (create)="editingInlineVendor() ? updateInlineVendor($event) : createInlineVendor($event)"
            ></agb-vendor-form-dialog>

            <agb-inventory-init-dialog
              *ngIf="showInventoryInitDialog()"
              [sites]="inventoryInitSites()"
              [materialNames]="inventoryInitMaterialNames()"
              [materialRows]="inventoryInitMaterialRows()"
              [presetSiteId]="activeSiteFilter() !== 'All' ? activeSiteId() : ''"
              (saved)="onInventoryInitSaved()"
              (cancelled)="closeInventoryInitDialog()"
            ></agb-inventory-init-dialog>
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
export class ProjectWorkspacePage {
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly materialsService = inject(MaterialsService);
  readonly hydration = inject(WorkspaceHydrationService);
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
  readonly openDraftSelect = signal("");
  readonly draftSelectSearch = signal("");
  /** Full list of subcontractor names for the record-form dropdown.
   *  Populated on demand from /api/subcontractors so it always matches the
   *  /subcontractors page, not just the hydration's first page. */
  readonly allSubcontractorNames = signal<string[]>([]);
  readonly loadingAllSubcontractors = signal(false);
  readonly dateFilterOpen = signal(false);
  readonly dateRange = signal({ start: "", end: "" });
  readonly datePickerTarget = signal<"start" | "end">("start");
  readonly calendarCursor = signal(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  readonly calendarWeekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  readonly tableViewExpanded = signal(false);
  readonly recordDialogOpen = signal(false);
  readonly showVendorDialog = signal(false);
  readonly showInventoryInitDialog = signal(false);
  readonly editingInlineVendor = signal<{ id: string; vendorName: string; materialType: string; phoneNumber: string; address: string; gstNumber: string } | null>(null);
  readonly draftRow = signal<TableRow>({});
  readonly activeSite = signal("All");
  readonly siteDraftOpen = signal(false);
  readonly siteDraftName = signal("");
  readonly openSelectKey = signal("");
  readonly selectCustomValue = signal("");
  readonly customPaymentModes = signal<string[]>(this.loadStoredPaymentModes());
  readonly labourTypeDialogOpen = signal(false);
  readonly labourTypeRowId = signal("");
  readonly labourTypeName = signal("Carpenter");
  readonly labourTypeCount = signal("1");
  readonly labourTypeDailyWage = signal("");
  readonly handledEditProjectQuery = signal("");
  readonly siteMaterialDetailFields = siteMaterialDetailFields;
  readonly previewImageUrl = signal<string | null>(null);
  readonly tableRows = computed<Record<ModuleKey, TableRow[]>>(() => this.buildInitialRows(this.projectId()));
  readonly attendanceRows = signal<TableRow[]>([]);
  readonly tableState = computed(() => ({
    rows: this.activeSection() === "labour" ? this.groupLabourRows(this.visibleRows("labour")) : this.visibleRows(this.activeSection()),
    columns: this.columnsFor(this.activeSection()),
  }));

  readonly clientId = computed(() => this.paramMap().get("clientId") ?? "");
  readonly projectId = computed(() => this.paramMap().get("projectId") ?? "");
  readonly client = computed(() => this.data.clientById(this.clientId()));
  readonly project = computed(() => this.data.projectById(this.projectId()));
  readonly projectSites = computed(() => this.project()?.sites ?? []);
  readonly displaySites = computed(() =>
    this.projectSites().filter((site) => site.trim().toLowerCase() !== "main site")
  );
  readonly inventoryInitSites = computed((): Array<{ id: string; name: string }> => {
    const projectId = this.projectId();
    const seen = new Map<string, { id: string; name: string }>();
    for (const r of this.data.siteEntities()) {
      const name = ((r as any).name || "").trim();
      const id = (r as any)._id || (r as any).id;
      if (!id || !name) continue;
      const belongs = !projectId
        || String((r as any).projectId || "") === projectId
        || (Array.isArray((r as any).projectIds) && ((r as any).projectIds as any[]).some((p) => String(p) === projectId));
      if (!belongs) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, { id: String(id), name });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
  readonly inventoryInitMaterialNames = computed((): string[] => {
    const projectId = this.projectId();
    const set = new Set<string>();
    for (const m of [...this.data.materials(), ...this.data.inventory()]) {
      if (projectId && String((m as any).projectId || "") !== projectId) continue;
      const n = (m as any).name;
      if (n) set.add(String(n).trim());
    }
    return [...set].filter(Boolean).sort();
  });
  readonly inventoryInitMaterialRows = computed(() => {
    const projectId = this.projectId();
    const rows: Array<{ name?: string; unit?: string; site?: string; siteId?: string }> = [];
    for (const m of this.data.materials()) {
      if (projectId && String((m as any).projectId || "") !== projectId) continue;
      rows.push({ name: (m as any).name, unit: (m as any).unit, site: (m as any).site, siteId: (m as any).siteId });
    }
    for (const i of this.data.inventory()) {
      if (projectId && String((i as any).projectId || "") !== projectId) continue;
      rows.push({ name: (i as any).name, unit: (i as any).unit, site: (i as any).site, siteId: (i as any).siteId });
    }
    return rows;
  });
  readonly activeSiteId = computed(() => {
    const site = this.activeSiteFilter();
    if (!site || site === "All") return "";
    return this.data.resolveSiteNameToId(site) ?? "";
  });
  readonly activeSiteFilter = computed(() => {
    const site = this.activeSite();
    return site === "All" || this.projectSites().includes(site) ? site : "All";
  });
  readonly activeConfig = computed(() => sectionConfigs.find((section) => section.key === this.activeSection()) ?? sectionConfigs[0]);

  constructor() {
    // Custom fields have a loaded guard — won't re-fetch if already loaded.
    void this.data.loadCustomFieldsFromBackend();
    // Don't refreshFromBackend here — data is already loaded by the
    // hydration service on boot. This was causing duplicate API calls
    // on every project workspace navigation.
    effect(() => {
      const projectId = this.projectId();
      if (projectId) this.data.touchProject(projectId);
    });
    // Keep the active section in sync with the URL param so browser
    // back/forward or direct navigation doesn't leave the previous
    // section's table on screen.
    effect(() => {
      const urlSection = this.normalizeSection(this.paramMap().get("section"));
      if (urlSection !== this.activeSection()) {
        this.activeSection.set(urlSection);
      }
    });
    effect(() => {
      const projectId = this.projectId();
      if (projectId) this.fetchAttendanceData(projectId);
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
    // Subcontractor spend rollup — re-fetched every time the active
    // project changes. The total expense line below folds this in.
    effect(() => {
      const projectId = this.projectId();
      this.loadProjectExpenseRollup(projectId);
    });
  }

  switchSection(section: ModuleKey) {
    this.activeSection.set(section);
    this.tableSearch.set("");
    this.resetFilterState();
    this.closeDropdowns();
    // Make sure the sub-contractor roster is available for the Add
    // Record dropdown even if the boot-time hydration missed it.
    if (section === "subcontractors") void this.hydration.loadModule("subcontractors");
    this.clearRowSelection();
    void this.router.navigate(["/clients", this.clientId(), "projects", this.projectId(), section]);

    // Always hit the backend directly for the section the user is about to
    // view. Bypasses refreshFromBackend's debounce so the Material, Site
    // Expense, General Expense, and Inventory tables always show fresh
    // MongoDB data. Pattern mirrors commit b754d2f.
    this.refreshSectionFromBackend(section);
  }

  /**
   * Dedicated per-section refresh — hits the matching backend endpoint
   * and updates the data signal + localStorage. Runs in addition to the
   * generic refreshFromBackend() so the active section is guaranteed
   * to have current data without waiting for the next debounce window.
   */
  private refreshSectionFromBackend(section: ModuleKey) {
    const apiMap: Record<string, () => any> = {
      materials: () => this.api.listMaterials({ limit: 200, projectId: this.projectId() }),
      labour: () => this.api.listLabour({ limit: 200, projectId: this.projectId() }),
      expenses: () => this.api.listExpenses({ limit: 200, projectId: this.projectId() }),
      payments: () => this.api.listPayments({ limit: 200, projectId: this.projectId() }),
      vendors: () => this.api.listVendors({ limit: 200 }),
      // Subcontractors are universal across projects on the backend — never
      // filter by projectId here, or the dropdown will be empty when the
      // current project doesn't own the subs the user wants to pick.
      subcontractors: () => this.api.listSubcontractors({ limit: 200 }),
      inventory: () => this.api.listInventory({ limit: 200, projectId: this.projectId() }),
    };
    const mapperMap: Record<string, (x: any) => any> = {
      materials: mapMaterial,
      labour: mapLabour,
      expenses: mapExpense,
      payments: mapPayment,
      vendors: mapVendor,
      subcontractors: mapSubcontractor,
      inventory: mapInventory,
    };
    const storageMap: Record<string, string> = {
      materials: "agb-erp:materials",
      labour: "agb-erp:labour",
      expenses: "agb-erp:expenses",
      payments: "agb-erp:payments",
      vendors: "agb-erp:vendors",
      subcontractors: "agb-erp:subcontractors",
      inventory: "agb-erp:inventory",
    };
    const dataMap: Record<string, any> = {
      materials: this.data.materials,
      labour: this.data.labour,
      expenses: this.data.expenses,
      payments: this.data.payments,
      vendors: this.data.vendors,
      subcontractors: this.data.subcontractors,
      inventory: this.data.inventory,
    };
    const apiCall = apiMap[section];
    const mapper = mapperMap[section];
    const storageKey = storageMap[section];
    const dataSignal = dataMap[section];
    if (!apiCall || !mapper || !dataSignal) return;
    apiCall().subscribe({
      next: (r: any) => {
        try {
          const items = (r.items || []).map(mapper);
          // Backend is the source of truth — always overwrite, even with [].
          // No localStorage write — the dashboard no longer caches data tables.
          dataSignal.set(items);
        } catch {}
      },
      error: () => {},
    });
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
    const wasSelected = this.selectedRowKeys().includes(key);
    if (wasSelected && this.selectedRowKey() === key) {
      this.clearRowSelection();
      return;
    }
    this.selectedRowKeys.set([key]);
    this.selectedRowKey.set(key);
    if (this.selectedRowKey() !== key || !wasSelected) {
      this.editingRowKey.set("");
      this.editingRowKeys.set([]);
      this.openSelectKey.set("");
    }
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
    if (this.selectedRowKeys().includes(key)) {
      this.clearRowSelection();
    } else {
      this.selectedRowKeys.set([key]);
      this.selectedRowKey.set(key);
    }
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
    if (this.hasSelectedRows()) {
      this.clearRowSelection();
    }
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

  async deleteSelectedRows() {
    const rows = this.selectedRows();
    if (!rows.length) return;
    if (!window.confirm("Delete this row? This will permanently delete it from the backend.")) return;
    const section = this.activeSection();

    if (section === "subcontractors") {
      for (const row of rows) {
        const paymentId = String(row["_id"] || "").trim();
        if (!paymentId) continue;
        try {
          await firstValueFrom(this.api.deleteSubcontractorPayment(paymentId));
        } catch {}
      }
      this.subcontractorPayments.set([]);
      if (this.projectId()) this.loadProjectExpenseRollup(this.projectId());
      this.clearRowSelection();
      return;
    }

    const apiDeleters: Record<string, ((id: string) => any) | null> = {
      materials: (id) => this.api.deleteMaterial(id),
      labour: (id) => this.api.deleteLabour(id),
      expenses: (id) => this.api.deleteExpense(id),
      payments: (id) => this.api.deletePayment(id),
      vendors: (id) => this.api.deleteVendor(id),
      subcontractors: (id) => this.api.deleteSubcontractor(id),
    };
    const dataMap: Record<string, any> = {
      materials: this.data.materials,
      labour: this.data.labour,
      expenses: this.data.expenses,
      payments: this.data.payments,
      vendors: this.data.vendors,
      subcontractors: this.data.subcontractors,
    };
    const idField = "id";
    const apiDelete = apiDeleters[section];
    const dataSignal = dataMap[section];

    for (const row of rows) {
      let mongoId = String(row["_id"] || "").trim();
      const bizId = String(row[idField] || "").trim();
      if (!mongoId && bizId && dataSignal) {
        try {
          const match = dataSignal().find((r: any) => String(r[idField] || "") === bizId);
          if (match?._id) mongoId = String(match._id);
        } catch {}
      }
      try {
        if (apiDelete && mongoId) await firstValueFrom(apiDelete(mongoId));
        if (dataSignal && bizId) {
          dataSignal.update((arr: any[]) => arr.filter((r: any) => String(r[idField] || "") !== bizId));
        }
      } catch {}
    }

    this.clearRowSelection();
    try { this.refreshFromBackend(); } catch {}
  }

  startRowEdit(row: TableRow, event?: Event) {
    event?.stopPropagation();
    const key = this.rowKey(row);
    this.selectedRowKey.set(key);
    this.selectedRowKeys.set([key]);
    this.editingRowKey.set(key);
    this.editingRowKeys.set([key]);
  }

  refreshFromBackend() {
    this.hydration.invalidateCache();
    const section = this.activeSection();
    const apiMap: Record<string, (opts: any) => any> = {
      materials: (opts: any) => this.api.listMaterials(opts),
      labour: (opts: any) => this.api.listLabour(opts),
      expenses: (opts: any) => this.api.listExpenses(opts),
      payments: (opts: any) => this.api.listPayments(opts),
      vendors: (opts: any) => this.api.listVendors(opts),
      subcontractors: (opts: any) => this.api.listSubcontractors(opts),
      inventory: (opts: any) => this.api.listInventory(opts),
    };
    const mapperMap: Record<string, (x: any) => any> = {
      materials: mapMaterial,
      labour: mapLabour,
      expenses: mapExpense,
      payments: mapPayment,
      vendors: mapVendor,
      subcontractors: mapSubcontractor,
      inventory: mapInventory,
    };
    const storageMap: Record<string, string> = {
      materials: "agb-erp:materials",
      labour: "agb-erp:labour",
      expenses: "agb-erp:expenses",
      payments: "agb-erp:payments",
      vendors: "agb-erp:vendors",
      subcontractors: "agb-erp:subcontractors",
      inventory: "agb-erp:inventory",
    };
    const dataMap: Record<string, any> = {
      materials: this.data.materials,
      labour: this.data.labour,
      expenses: this.data.expenses,
      payments: this.data.payments,
      vendors: this.data.vendors,
      subcontractors: this.data.subcontractors,
      inventory: this.data.inventory,
    };
    const apiCall = apiMap[section];
    const mapper = mapperMap[section];
    const storageKey = storageMap[section];
    const dataSignal = dataMap[section];
    if (!apiCall || !mapper || !dataSignal) return;
    apiCall({ limit: 200, page: 1, projectId: this.projectId() }).subscribe({
      next: (r: any) => {
        try {
          const items = (r.items || []).map(mapper);
          // Backend is the source of truth — always overwrite, even with [].
          // No localStorage write — the dashboard no longer caches data tables.
          dataSignal.set(items);
        } catch {}
      },
      error: () => {},
    });
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
    this.openDraftSelect.set("");
    this.draftSelectSearch.set("");
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
    // Subcontractor section reads from the dedicated payment collection
    // — it's no longer coupled to the Subcontractor list. The generic
    // CRUD table renders those rows through the same dropdown-driven
    // UI (subcontractor + site are select fields).
    let rows: TableRow[];
    if (section === "subcontractors") {
      rows = this.subcontractorPaymentRows();
    } else {
      rows = this.data.tableRowsFor(section, this.tableRows()[section] ?? [], (row) => this.rowBelongsToProject(row));
    }
    if (section === "labour") {
      rows = [...rows, ...this.attendanceRows()];
    }
    const site = this.activeSiteFilter();
    if (this.isSiteAware(section) && site !== "All") {
      const siteKey = section === "subcontractors" ? "siteName" : "site";
      rows = rows.filter((row) => String(row[siteKey] ?? "").toLowerCase() === site.toLowerCase());
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

  /**
   * Labour rows are grouped by subcontractor + attendance date so a single
   * day shows every labour entry (and every attendance row) for that
   * sub-contractor in one row. Single-record groups pass through unchanged
   * so inline editing keeps working; multi-record groups become read-only
   * aggregate rows carrying their source records in `__labourGroup`.
   *
   * Rows with no sub-contractor name are kept as their own group so the
   * "Subcontractor" column displays a clear "(No sub-contractor)" label
   * instead of an empty cell — that way the column is never blank and the
   * grouping remains consistent across every page that shows labour.
   */
  groupLabourRows(rows: TableRow[]): TableRow[] {
    const NO_SUB = "(No sub-contractor)";
    const byKey = new Map<string, TableRow[]>();
    for (const row of rows) {
      const date = String(row["attendanceDate"] || "").trim();
      const rawSub = String(row["subcontractorName"] || "").trim();
      const sub = rawSub || NO_SUB;
      const key = date ? `${sub}||${date}` : `__no-date__:${sub}:${row["__rowId"] || "?"}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(row);
    }
    const grouped: TableRow[] = [];
    for (const [key, groupRows] of byKey) {
      if (key.startsWith("__no-date__") || groupRows.length === 1) {
        grouped.push(...groupRows);
        continue;
      }
      const first = groupRows[0];
      const typeMap = new Map<string, number>();
      for (const row of groupRows) {
        for (const entry of this.labourTypeEntriesForRow(row)) {
          typeMap.set(entry.type, (typeMap.get(entry.type) || 0) + entry.count);
        }
      }
      const distinctValues = (field: string): string => {
        const values = [...new Set(groupRows.map((row) => String(row[field] ?? "").trim()).filter(Boolean))];
        return values.join(", ");
      };
      const totalOvertime = groupRows.reduce(
        (sum, row) => sum + this.moneyNumber(String(row["overtime"] || "").replace(/[^0-9.]/g, "")),
        0
      );
      const groupedRow = Object.assign(
        {
          ...first,
          __rowId: `labour-group:${key}`,
          labourTypes: [...typeMap.entries()].map(([type, count]) => `${type}: ${count}`).join("\n"),
          staffCount: String(groupRows.reduce((sum, row) => sum + this.moneyNumber(row["staffCount"]), 0)),
          client: distinctValues("client"),
          site: distinctValues("site"),
          subcontractorName: distinctValues("subcontractorName") || NO_SUB,
          attendance: this.formatGroupedAttendance(groupRows),
          shift: String(groupRows.reduce((sum, row) => sum + this.moneyNumber(row["shift"]), 0)),
          overtime: totalOvertime ? String(totalOvertime) : distinctValues("overtime"),
          notes: distinctValues("notes"),
        } as TableRow,
        { __labourGroup: groupRows }
      );
      grouped.push(groupedRow);
    }
    return grouped;
  }

  /**
   * Renders a grouped labour row's attendance as "Present(N)" / "Absent(N)".
   * Mixed days render as "Present(P)/Absent(A)" with separate counts so the
   * total worker count is still visible at a glance.
   */
  private formatGroupedAttendance(groupRows: TableRow[]): string {
    let present = 0;
    let absent = 0;
    for (const row of groupRows) {
      const label = String(row["attendance"] || "").trim().toLowerCase();
      const count = this.moneyNumber(row["staffCount"]);
      if (label === "absent") absent += count;
      else present += count;
    }
    if (absent > 0 && present > 0) return `Present(${present})/Absent(${absent})`;
    if (absent > 0) return `Absent(${absent})`;
    return `Present(${present})`;
  }

  labourGroupCount(row: TableRow): number {
    const group = (row as TableRow & { __labourGroup?: TableRow[] })["__labourGroup"];
    return Array.isArray(group) ? group.length : 0;
  }

  isLabourGroupRow(row: TableRow): boolean {
    return this.labourGroupCount(row) > 1;
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
    if (section === "subcontractors") return "date";
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
    if (section === "vendors") {
      this.editingInlineVendor.set(null);
      this.showVendorDialog.set(true);
      return;
    }
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
    if (this.activeSection() === "vendors") {
      this.editingInlineVendor.set(null);
      this.showVendorDialog.set(true);
      return;
    }
    if (this.activeSection() === "inventory") {
      this.showInventoryInitDialog.set(true);
      return;
    }
    const row: TableRow = { ...this.defaultRowFor(this.activeSection()) };
    this.draftRow.set(row);
    for (const column of this.recordFormColumns()) {
      const options = this.selectOptions(this.activeSection(), column.key);
      // Subcontractor payments must be explicitly chosen — never
      // silently default to the first option (the reported "only the
      // first subcontractor can receive payments" bug).
      if (this.activeSection() === "subcontractors" && column.key === "subcontractorName") {
        row[column.key] = "";
        continue;
      }
      const activeSite = this.activeSiteFilter();
      const isSiteColumn = column.key === "site" || (this.activeSection() === "subcontractors" && column.key === "siteName");
      row[column.key] = isSiteColumn && activeSite !== "All" ? activeSite : row[column.key] || options[0] || "";
    }
    this.draftRow.set(row);
    this.recordDialogOpen.set(true);
    // Ensure the sub-contractor dropdown lists every record from the
    // /subcontractors page (not just the hydration's first page).
    if (this.activeSection() === "subcontractors") {
      void this.loadAllSubcontractorNames();
    }
  }

  closeInventoryInitDialog() {
    this.showInventoryInitDialog.set(false);
  }

  onInventoryInitSaved() {
    const pid = this.projectId();
    this.api.listMaterials({ limit: 200, projectId: pid }).subscribe({
      next: (r: any) => {
        try {
          const items = ((r as any).items || []).map(mapMaterial);
          this.data.materials.set(items);
        } catch {}
      },
      error: () => {},
    });
    this.api.listInventory({ limit: 200, projectId: pid }).subscribe({
      next: (r: any) => {
        try {
          const items = ((r as any).items || []).map(mapInventory);
          this.data.inventory.set(items);
        } catch {}
      },
      error: () => {},
    });
  }

  closeVendorDialog() {
    this.showVendorDialog.set(false);
    this.editingInlineVendor.set(null);
  }

  inlineVendorEditValue(): VendorFormValue | null {
    const v = this.editingInlineVendor();
    if (!v) return null;
    return {
      name: v.vendorName,
      materialType: v.materialType,
      phone: v.phoneNumber,
      address: v.address,
      gst: v.gstNumber,
      status: "Active",
      siteIds: [],
    };
  }

  createInlineVendor(value: VendorFormValue) {
    if (!value.name || !value.materialType || !value.phone || !value.gst || !value.address) return;
    const payload = {
      name: value.name,
      materialType: value.materialType,
      phone: value.phone,
      address: value.address,
      gstNumber: value.gst,
      status: "Active",
      siteIds: value.siteIds || [],
    };
    this.api.createVendor(payload).subscribe({
      next: () => {
        this.showVendorDialog.set(false);
        this.editingInlineVendor.set(null);
        this.data.addVendor({
          name: value.name,
          materialType: value.materialType,
          phone: value.phone,
          address: value.address,
          gst: value.gst,
          status: "Active",
          siteIds: value.siteIds || [],
        });
      },
      error: (err) => {
        console.error("Failed to create vendor", err);
      },
    });
  }

  updateInlineVendor(value: VendorFormValue) {
    const inline = this.editingInlineVendor();
    if (!inline) return;
    const payload = {
      name: value.name,
      materialType: value.materialType,
      phone: value.phone,
      address: value.address,
      gstNumber: value.gst,
      status: "Active",
      siteIds: value.siteIds || [],
    };
    this.api.patchVendor(inline.id, payload).subscribe({
      next: () => {
        this.showVendorDialog.set(false);
        this.editingInlineVendor.set(null);
        this.data.updateVendor(inline.id, {
          name: value.name,
          materialType: value.materialType,
          phone: value.phone,
          address: value.address,
          gst: value.gst,
          status: "Active",
        });
      },
      error: (err) => {
        console.error("Failed to update vendor", err);
      },
    });
  }

  recordFormColumns(): FieldSchema[] {
    const hiddenInExpenseForm = new Set(["approvalStatus", "openingBalance", "runningBalance"]);
    const cashAddedFields = new Set(["expenseDate", "transactionType", "description", "amount", "site", "supervisor", "reference"]);
    return this.columnsFor(this.activeSection()).filter((column) => {
      if (this.activeSection() === "expenses" && hiddenInExpenseForm.has(column.key)) return false;
      const isCashAdded = this.normalizedExpenseTransactionType(String(this.draftRow()["transactionType"] || "Cash Added")) === "Cash Added";
      if (this.activeSection() === "expenses" && isCashAdded && !cashAddedFields.has(column.key)) return false;
      if (this.activeSection() === "expenses" && column.key === "siteMaterial" && this.normalizedExpenseTransactionType(String(this.draftRow()["transactionType"] || "Cash Added")) !== "Purchase") {
        return false;
      }
      if (this.activeSection() === "expenses" && (column.key === "materialName" || column.key === "unit" || column.key === "requestedQuantity" || column.key === "approvedQuantity" || column.key === "vendor")) {
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

  toggleDraftSelect(key: string) {
    this.openDraftSelect.update((current) => (current === key ? "" : key));
    this.draftSelectSearch.set("");
    // When the user opens the sub-contractor dropdown, make sure the
    // full list from /api/subcontractors is loaded so it matches the
    // /subcontractors page exactly.
    if (this.openDraftSelect() === key && this.activeSection() === "subcontractors" && (key === "subcontractorName" || key === "subcontractor")) {
      void this.loadAllSubcontractorNames();
    }
  }

  closeDraftSelect() {
    this.openDraftSelect.set("");
    this.draftSelectSearch.set("");
  }

  isDraftSelectOpen(key: string): boolean {
    return this.openDraftSelect() === key;
  }

  filteredSelectOptions(section: ModuleKey, key: string): string[] {
    const query = this.draftSelectSearch().trim().toLowerCase();
    const options = this.selectOptions(section, key);
    if (!query) return options;
    return options.filter((option) => String(option).toLowerCase().includes(query));
  }

  selectDraftOption(key: string, value: string) {
    this.updateDraftField(key, value);
    this.openDraftSelect.set("");
    this.draftSelectSearch.set("");
  }

  saveCustomDraftOption(key: string, value: string, event?: Event) {
    event?.preventDefault();
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    this.selectDraftOption(key, trimmed);
  }

  showSiteMaterialDetails(): boolean {
    if (this.activeSection() !== "expenses") return false;
    const row = this.draftRow();
    return this.normalizedExpenseTransactionType(String(row["transactionType"] || "")) === "Purchase" && this.normalizeYesNo(row["siteMaterial"]) === "Yes";
  }

  formColumnLabel(column: FieldSchema): string {
    return this.activeSection() === "expenses" && column.key === "amount" ? "Total Amount" : column.label;
  }

  async saveRecord(event: Event) {
    event.preventDefault();
    const section = this.activeSection();
    const currentProject = this.project();
    const selectedSite = this.activeSiteFilter();
    const draft = section === "expenses" ? this.normalizedExpenseInputRow(this.draftRow()) : this.draftRow();
    if (section === "payments") this.registerPaymentMode(String(draft["mode"] || ""));
    if (section === "expenses") this.ensureExpenseOpeningForInput(draft);

    const isCashAdded = section === "expenses" && draft["transactionType"] === "Cash Added";

    if (isCashAdded) {
      const siteId = this.resolveEntityIdForSection(section);
      const site = String(draft["site"] || selectedSite || "");
      const date = String(draft["expenseDate"] || new Date().toISOString().slice(0, 10));
      const description = String(draft["description"] || "Cash Added");
      const amount = Math.abs(Number(draft["amount"]) || 0);
      const reference = String(draft["reference"] || "");

      if (!this.projectId()) {
        console.warn("[ProjectWorkspace] Cannot save Cash Added: no project selected");
        return;
      }

      try {
        const result = await new Promise<{ expense: any }>((resolve, reject) => {
          this.api.createExpense({
            type: "site",
            projectId: this.projectId(),
            siteId: siteId || undefined,
            site: site || undefined,
            transactionType: "Cash Added",
            amount,
            date,
            description,
            reference: reference || undefined,
            submittedBy: "admin",
          }).subscribe({ next: resolve, error: reject });
        });

        const apiExpense = result.expense;
        const savedRow = this.data.addCustomRow(section, {
          ...draft,
          __rowId: `expense:${apiExpense._id}`,
          __projectId: this.projectId(),
          projectId: this.projectId(),
          clientId: this.clientId(),
          client: currentProject?.client ?? "",
          project: currentProject?.name ?? "",
          expenseScope: "Site",
          runningBalance: apiExpense.runningBalance,
          id: apiExpense.expenseId,
          status: "Approved",
        });
        this.recordDialogOpen.set(false);
        return;
      } catch (err) {
        console.error("[ProjectWorkspace] Failed to create Cash Added expense", err);
        return;
      }
    }

    if (section === "subcontractors") {
      await this.saveSubcontractorPaymentDraft(draft, selectedSite);
      return;
    }

    if (section === "materials") {
      const materialInput: Partial<MaterialRow> = {
        projectId: this.projectId() || undefined,
        site: String(draft["site"] || selectedSite || ""),
        name: String(draft["materialName"] || draft["description"] || ""),
        unit: String(draft["unit"] || ""),
        requested: Number(draft["requestedQuantity"]) || 0,
        approved: Number(draft["approvedQuantity"]) || 0,
        purchased: 0,
        notes: String(draft["notes"] || ""),
      };
      if (!materialInput.name) {
        console.warn("[ProjectWorkspace] Cannot save material: no material name");
        return;
      }
      try {
        const result = await new Promise<MaterialRow>((resolve, reject) => {
          this.materialsService.createMaterial(materialInput).subscribe({
            next: (material) => resolve(material),
            error: reject,
          });
        });
        Object.assign(draft, {
          __rowId: `material:${result.id}`,
          materialId: result.id,
        });
      } catch (err) {
        console.error("[ProjectWorkspace] Failed to create material", err);
        return;
      }
    }

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

  /**
   * Subcontractor payments live in their own backend collection, so the
   * generic addCustomRow fallback (local-only) is not used. Resolves the
   * chosen subcontractor + site by name/id and persists a real payment
   * record, then reloads the project expense rollup so the hero total
   * stays in sync.
   */
  private async saveSubcontractorPaymentDraft(draft: TableRow, selectedSite: string) {
    const projectId = this.projectId();
    if (!projectId) {
      window.alert("Please select a project first.");
      return;
    }
    const subcontractorName = String(draft["subcontractorName"] || "").trim();
    const subcontractor = this.data
      .subcontractors()
      .find((s) => String(s.subcontractorName || "").trim().toLowerCase() === subcontractorName.toLowerCase());
    if (!subcontractor?._id) {
      window.alert("Please select a subcontractor.");
      return;
    }
    const siteName = String(draft["siteName"] || draft["site"] || selectedSite || "").trim();
    const siteId = this.data.resolveSiteNameToId(siteName);
    if (!siteId) {
      window.alert("Please select a valid site for this project.");
      return;
    }
    const date = String(draft["date"] || new Date().toISOString().slice(0, 10));
    const description = String(draft["description"] || "").trim();
    if (!description) {
      window.alert("Work description is required.");
      return;
    }
    const employeeCount = Math.round(Number(draft["employeeCount"]) || 0);
    if (!Number.isInteger(employeeCount) || employeeCount < 1) {
      window.alert("Number of employees must be a positive whole number.");
      return;
    }
    const amount = Math.abs(this.moneyNumber(draft["amount"]));
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Amount must be a number greater than zero.");
      return;
    }
    const notes = String(draft["notes"] || "").trim();
    const payload = {
      subcontractorId: subcontractor._id,
      projectId,
      siteId,
      date,
      description,
      employeeCount,
      amount,
      notes,
    };
    const paymentId = String(draft["__paymentId"] || "").trim();
    try {
      if (paymentId) {
        await firstValueFrom(this.api.updateSubcontractorPayment(paymentId, payload));
      } else {
        await firstValueFrom(this.api.createSubcontractorPayment(payload));
      }
      this.recordDialogOpen.set(false);
      this.clearRowSelection();
      this.loadProjectExpenseRollup(projectId);
    } catch (err: any) {
      console.error("[ProjectWorkspace] Failed to save subcontractor payment", err);
      window.alert(err?.error?.error || err?.error?.message || err?.message || "Could not save the payment.");
    }
  }

  /**
   * Persist a single cell edit on a subcontractor payment row. Column
   * names (subcontractor/site) are re-resolved to ids before the PATCH;
   * the backend re-derives the denormalized display fields.
   */
  private updateSubcontractorPaymentRow(row: TableRow, key: string, value: string) {
    const paymentId = String(row["_id"] || "").trim();
    if (!paymentId) return;
    const current = this.subcontractorPayments().find((p) => String(p._id) === paymentId);
    const patch: Record<string, unknown> = {};
    switch (key) {
      case "date":
        patch.date = value;
        break;
      case "subcontractorName": {
        const match = this.data
          .subcontractors()
          .find((s) => String(s.subcontractorName || "").trim().toLowerCase() === value.toLowerCase());
        if (!match?._id) return;
        patch.subcontractorId = match._id;
        break;
      }
      case "siteName": {
        const siteId = this.data.resolveSiteNameToId(value);
        if (!siteId) return;
        patch.siteId = siteId;
        break;
      }
      case "description":
        patch.description = value;
        break;
      case "employeeCount":
        patch.employeeCount = Math.round(Number(value) || 0);
        break;
      case "amount": {
        const newAmount = Math.abs(this.moneyNumber(value));
        patch.amount = newAmount;
        if (current) {
          const oldAmount = Number(current.amount) || 0;
          this.subcontractorSpend.update((total) => Math.max(0, total - oldAmount + newAmount));
        }
        break;
      }
      case "notes":
        patch.notes = value;
        break;
      default:
        return;
    }
    if (current) {
      this.subcontractorPayments.update((list) =>
        list.map((p) => (String(p._id) === paymentId ? { ...p, ...patch } : p))
      );
    }
    this.api.updateSubcontractorPayment(paymentId, patch).subscribe({
      next: () => {
        if (this.projectId()) this.loadProjectExpenseRollup(this.projectId());
      },
      error: (err) => {
        console.warn("[ProjectWorkspace] Failed to update subcontractor payment", err);
        if (this.projectId()) this.loadProjectExpenseRollup(this.projectId());
      },
    });
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

  isNoCreateTab(): boolean {
    const s = this.activeSection();
    return s === "materials" || s === "labour" || s === "expenses" || s === "vendors";
  }

  selectSite(site: string) {
    this.activeSite.set(site);
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

  private resolveEntityIdForSection(_section: ModuleKey): string | null {
    const activeSite = this.activeSiteFilter();
    if (activeSite && activeSite !== "All") {
      return this.data.resolveSiteNameToId(activeSite);
    }
    const firstSite = this.data.siteEntities()[0];
    return firstSite?._id ?? null;
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
    if (section === "subcontractors") {
      // Subcontractor payment rows map 1:1 to the backend collection.
      // Cell edits PATCH the payment record directly (names re-resolve
      // to ids) instead of being stashed locally.
      this.updateSubcontractorPaymentRow(row, key, cleanValue);
      return;
    }
    if (section === "expenses" && key === "amount") {
      this.data.updateSharedRowCell(rowId, key, this.positiveExpenseAmountValue(cleanValue));
      return;
    }
    this.data.updateSharedRowCell(rowId, key, cleanValue);
    if (section === "labour" && key === "labourTypes") this.data.updateSharedRowCell(rowId, "notes", cleanValue);
    if (section === "expenses" && key === "siteMaterial") this.createMaterialFromSiteExpense({ ...row, [key]: cleanValue });
  }

  async deleteRow(row: TableRow) {
    const key = this.rowKey(row);
    const section = this.activeSection();
    const group = (row as TableRow & { __labourGroup?: TableRow[] })["__labourGroup"];
    const isGroup = section === "labour" && Array.isArray(group) && group.length > 0;
    const targets = isGroup ? (group as TableRow[]) : [row];
    const confirmMessage = isGroup
      ? `Delete ${targets.length} labour records on this date? This will permanently delete them from the backend.`
      : "Delete this row? This will permanently delete it from the backend.";
    if (!window.confirm(confirmMessage)) return;

    for (const target of targets) {
      await this.deleteRowRecord(section, target);
    }

    this.selectedRowKeys.update((keys) => keys.filter((item) => item !== key));
    if (this.selectedRowKey() === key) this.selectedRowKey.set("");
    if (this.editingRowKey() === key) this.editingRowKey.set("");
    this.editingRowKeys.update((keys) => keys.filter((item) => item !== key));

    try { this.refreshFromBackend(); } catch {}
  }

  private async deleteRowRecord(section: ModuleKey, row: TableRow) {
    // Subcontractor payments are stored in their own collection —
    // dispatch through the dedicated endpoint.
    if (section === "subcontractors") {
      const id = String(row["_id"] || "").trim();
      if (!id) return;
      try {
        await firstValueFrom(this.api.deleteSubcontractorPayment(id));
        this.subcontractorPayments.update((list) => list.filter((p) => String(p._id) !== id));
        this.subcontractorSpend.update((total) => Math.max(0, total - Number(row["amount"] || 0)));
      } catch {}
      return;
    }

    const apiDeleters: Record<string, ((id: string) => any) | null> = {
      materials: (id) => this.api.deleteMaterial(id),
      labour: (id) => this.api.deleteLabour(id),
      expenses: (id) => this.api.deleteExpense(id),
      payments: (id) => this.api.deletePayment(id),
      vendors: (id) => this.api.deleteVendor(id),
      subcontractors: (id) => this.api.deleteSubcontractor(id),
    };
    const dataMap: Record<string, any> = {
      materials: this.data.materials,
      labour: this.data.labour,
      expenses: this.data.expenses,
      payments: this.data.payments,
      vendors: this.data.vendors,
      subcontractors: this.data.subcontractors,
    };
    const idField = "id";
    const apiDelete = apiDeleters[section];
    const dataSignal = dataMap[section];
    const bizId = String(row[idField] || "").trim();
    let mongoId = String(row["_id"] || "").trim();

    if (!mongoId && bizId && dataSignal) {
      try {
        const match = dataSignal().find((r: any) => String(r[idField] || "") === bizId);
        if (match?._id) mongoId = String(match._id);
      } catch {}
    }

    try {
      if (apiDelete && mongoId) await firstValueFrom(apiDelete(mongoId));
      if (dataSignal && bizId) {
        dataSignal.update((arr: any[]) => arr.filter((r: any) => String(r[idField] || "") !== bizId));
      }
    } catch {}
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
    if (section === "payments" && key === "mode") this.registerPaymentMode(trimmedValue);
    this.selectCellOptionForRow(section, row, key, trimmedValue);
  }

  allowsCustomOption(section: ModuleKey, key: string): boolean {
    if (key === "site" || key === "siteMaterial" || key === "transactionType" || key === "approvalStatus" || key === "status" || key === "paymentStatus" || key === "attendance") return false;
    // Subcontractor payments must reference an existing sub-contractor
    // and a real site — the backend resolves ids by name, so free-text
    // entries would be rejected. Selection only.
    if (section === "subcontractors" && (key === "subcontractorName" || key === "subcontractor" || key === "siteName")) return false;
    return this.selectOptions(section, key).length > 0;
  }

  /**
   * Whether the Add Record dialog should render the select dropdown for
   * this column. Subcontractor/site columns in the subcontractor section
   * ALWAYS render the dropdown (even while names are still loading) so
   * the user can never fall back to typing a free-text name.
   */
  isRecordSelectField(column: FieldSchema): boolean {
    if (this.activeSection() === "subcontractors" && (column.key === "subcontractorName" || column.key === "subcontractor" || column.key === "siteName")) return true;
    return this.selectOptions(this.activeSection(), column.key).length > 0;
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
      openingBalance: project.expenseBalance,
      status: project.status,
    };
  }

  async saveProject(value: ProjectFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.startDate || !value.supervisor || !value.totalValue) return;
    const editing = this.editingProject();
    const { openingBalance, ...projectValue } = value;
    if (editing) {
      const updated = this.data.updateProject(editing.id, { ...projectValue, expenseBalance: openingBalance });
      if (editing.sites[0]) {
        this.data.persistSiteOpeningBalance(editing.id, editing.sites[0], openingBalance);
      } else {
        this.data.setExpenseOpeningBalance(editing.id, "Main Site", openingBalance);
      }
      // Persist supervisor/site changes to the backend so the supervisor mobile
      // app receives the updated site assignments.
      void this.data.persistProjectEdit(editing.id, {
        name: value.name,
        sites: value.sites,
        startDate: value.startDate,
        supervisor: value.supervisor,
        supervisorId: value.supervisorId,
        status: value.status,
        totalValue: value.totalValue,
        advanceAmount: value.advanceAmount,
        expenseBalance: openingBalance,
      });
      this.editingProject.set(null);
      this.showProjectForm.set(false);
      if (updated && editing.id === this.projectId()) {
        void this.router.navigate(["/clients", currentClient.id, "projects", updated.id, this.activeSection()]);
      }
      return;
    }
    try {
      const project = await this.data.addProject(currentClient, { ...projectValue, openingBalance });
      this.showProjectForm.set(false);
      setTimeout(() => void this.router.navigate(["/clients", currentClient.id, "projects", project.id, "materials"]));
    } catch (err) {
      console.error("[ProjectWorkspace] Failed to create project:", (err as any)?.message ?? err);
    }
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

  private subcontractorSpend = signal<number>(0);
  private subcontractorPayments = signal<any[]>([]);

  /**
   * Map SubcontractorPayment rows to the table shape the generic
   * workspace CRUD table expects (it looks at column keys directly).
   * Renamed `site` -> `siteName` so the column config matches.
   */
  private subcontractorPaymentRows(): TableRow[] {
    return this.subcontractorPayments().map((p) => ({
      __rowId: `sub-payment:${p._id}`,
      __projectId: p.projectId,
      _id: p._id,
      date: p.date,
      subcontractorId: p.subcontractorId,
      subcontractorName: p.subcontractorName,
      projectId: p.projectId,
      siteId: p.siteId || "",
      siteName: p.siteName || "",
      description: p.description || "",
      employeeCount: p.employeeCount,
      amount: formatMoney(p.amount),
      notes: p.notes || "",
    }));
  }

  /**
   * Fetch the subcontractor spend rollup for this project so the
   * workspace "Total expense" line includes subcontractor payments
   * (per spec) and the new Sub-contractors page total stays in sync.
   */
  private loadProjectExpenseRollup(projectId: string | null) {
    if (!projectId) {
      this.subcontractorSpend.set(0);
      this.subcontractorPayments.set([]);
      return;
    }
    this.api.getSubcontractorSpendRollup(projectId).subscribe({
      next: (res) => this.subcontractorSpend.set(Number(res?.totalPaid) || 0),
      error: () => this.subcontractorSpend.set(0),
    });
    // Load payments so the table renders the actual records.
    this.api.listSubcontractorPayments({ projectId, limit: 500 }).subscribe({
      next: (res) => this.subcontractorPayments.set(res.items || []),
      error: () => this.subcontractorPayments.set([]),
    });
  }

  totalProjectExpenseLabel(): string {
    return formatMoney(this.totalProjectExpenseValue());
  }

  vendorTotalSpendLabel(): string {
    return formatMoney(this.vendorSpendValue());
  }

  subcontractorTotalSpendLabel(): string {
    return formatMoney(this.subcontractorSpend());
  }

  /**
   * Subcontractor payments AND materials-given amounts are folded
   * into the project total expense (per spec) so the workspace hero
   * matches what the admin sees elsewhere on the dashboard.
   *
   * Composition:
   *   - expenseRows : sum of |amount| for expense records (expense
   *     entries are sign-flipped so debits come through as negative
   *     in the signed-amount helper — we absolute-value here).
   *   - labourRows  : sum of weekly pay across labour rows for the
   *     project (covers directly-hired + subcontractor-led labour).
   *   - subcontractorSpend : server-computed total of all
   *     SubcontractorPayment records.
   *   - materialsGivenTotal : sum of `givenAmount` (cash disbursed
   *     for materials) across every material row belonging to the
   *     project. The materials section's own totals card uses
   *     `issuedAmount + givenAmount`; we mirror that here so the
   *     project-wide hero stays consistent with the materials view.
   *     Issued amounts are NOT double-counted (they already appear
   *     inside expense rows when the material was purchased through
   *     the expense ledger).
   */
  private totalProjectExpenseValue(): number {
    const expenseRows = this.data.tableRowsFor("expenses", this.tableRows().expenses, (row) => this.rowBelongsToProject(row));
    const expenseTotal = expenseRows.reduce((sum, row) => {
      const amount = this.expenseSignedAmount(row);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
    const labourRows = this.data.tableRowsFor("labour", this.tableRows().labour, (row) => this.rowBelongsToProject(row));
    const labourTotal = labourRows.reduce((sum, row) => sum + this.labourWeeklyPayForRow(this.withLabourPayable(row)).total, 0);
    const subcontractorTotal = this.subcontractorSpend();
    const materialRows = this.data.tableRowsFor("materials", this.tableRows().materials, (row) => this.rowBelongsToProject(row));
    const materialsGivenTotal = materialRows.reduce(
      (sum, row) => sum + this.moneyNumber(row["givenAmount"]),
      0
    );
    return expenseTotal + labourTotal + subcontractorTotal + materialsGivenTotal;
  }

  /**
   * Vendor section "Total spend" = sum of issuedAmount across all
   * materials belonging to this project (regardless of vendor).
   * Recomputed reactively whenever the materials list changes.
   */
  private vendorSpendValue(): number {
    const materials = this.data.tableRowsFor("materials", this.tableRows().materials, (row) => this.rowBelongsToProject(row));
    return materials.reduce((sum, row) => sum + this.moneyNumber(row["issuedAmount"]) + this.moneyNumber(row["givenAmount"]), 0);
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

  private async fetchAttendanceData(projectId: string): Promise<void> {
    try {
      const currentProject = this.project();
      const currentClient = this.client();
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const fromDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const toDate = today.toISOString().slice(0, 10);

      const result = await firstValueFrom(this.api.listGroupedAttendance({
        projectId,
        from: fromDate,
        to: toDate,
        limit: 25,
      }));

      const rows: TableRow[] = (result.items || []).flatMap((group: any) =>
        (group.workers || []).map((w: any, idx: number) => ({
          __rowId: `attendance:${group.date}:${group.shift}:${w.workerId}:${idx}`,
          __projectId: group.projectId || projectId,
          projectId: group.projectId || projectId,
          client: group.clientName || currentProject?.client || "",
          clientId: group.clientId || currentClient?.id || this.clientId(),
          site: group.site || "",
          attendanceDate: group.date,
          subcontractorName: group.subcontractorName || "",
          staffName: group.supervisorName || w.workerName,
          labourTypes: group.labourType || "",
          staffCount: 1,
          attendance: "Present",
          shift: group.shift,
          overtime: `${w.overtimeHours || 0} hrs`,
          lateFine: formatMoney(w.lateFine || 0),
          paymentMode: group.paymentMode || "Cash",
          notes: "",
          status: "Active",
          dailyPay: w.dailyPay,
        }))
      );

      this.attendanceRows.set(rows);
    } catch (err) {
      console.error("[ProjectWorkspace] failed to fetch attendance data", err);
      this.attendanceRows.set([]);
    }
  }

  private buildInitialRows(projectId: string): Record<ModuleKey, TableRow[]> {
    void this.data.vendors();
    const currentProject = this.data.projectById(projectId);
    const currentClient = this.data.clients().find((client) => client.projectIds.includes(projectId) || client.name === currentProject?.client);
    const materials = this.data.materials().filter((row) => row.projectId === projectId).map((row) => ({
      __rowId: `material:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      site: row.site,
      materialName: row.name,
      unit: row.unit,
      issuedAmount: row.issuedAmount ?? "",
      givenAmount: row.givenAmount ?? "",
      requestedQuantity: formatNumber(row.requested),
      approvedQuantity: formatNumber(row.approved),
      requestDate: row.requestDate || "2026-06-05",
      vendor: row.vendor,
      poNumber: row.poNumber,
      billUrl: row.billUrl || (row.receiptImage ? `data:${row.receiptImageMimeType || 'image/jpeg'};base64,${row.receiptImage}` : undefined),
      remainingStock: `${formatNumber(row.approved || (row.purchased - row.consumed))} ${row.unit}`,
      status: row.status,
      notes: row.notes,
    }));

    const labour = this.data.labourForProject(projectId).map((row) => ({
      __rowId: `labour:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      client: currentProject?.client ?? "",
      clientId: currentClient?.id ?? this.clientId(),
      attendanceDate: row.attendanceDate || "2026-06-05",
      subcontractorName: (row as any).subcontractorName || "",
      staffName: row["supervisorName"] || (row as any)["partyName"] || row.party,
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
        transactionType: row.transactionType || "Site Expense",
        description: row.description,
        amount: formatMoney(-row.spent),
        siteMaterial: row.isSiteMaterial ? "Yes" : "No",
        runningBalance: formatMoney(0),
        site: row.site,
        supervisor: row.supervisor,
        cashIssued: formatMoney(row.cashIssued || row.received || 0),
        reference: row.reference,
        billUrl: row.billUrl || (row.receiptImage ? `data:${row.receiptImageMimeType || 'image/jpeg'};base64,${row.receiptImage}` : undefined),
        approvalStatus: row.status,
        notes: (row as any).notes,
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
    }));

    const projectMaterials = this.data.materials().filter((row) => row.projectId === projectId);
    const vendorNamesInProject = new Set(projectMaterials.map((m) => m.vendor).filter(Boolean));

    const projectSiteIds = new Set<string>();
    for (const site of this.data.siteEntities()) {
      if ((site as any).projectIds?.includes(projectId)) {
        projectSiteIds.add(site.id);
        if ((site as any)._id) projectSiteIds.add((site as any)._id);
      }
    }
    for (const vendor of this.data.vendors()) {
      if (vendor.siteIds?.some((sid) => projectSiteIds.has(sid))) {
        vendorNamesInProject.add(vendor.name);
      }
    }

    const vendors = this.data.vendors()
      .filter((vendor) => vendorNamesInProject.has(vendor.name))
      .map((vendor) => ({
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

    const subcontractors = this.subcontractorPayments().map((p) => ({
      __rowId: `sub-payment:${p._id}`,
      __projectId: p.projectId,
      projectId: p.projectId,
      subcontractorName: p.subcontractorName,
      projectName: p.projectName,
      siteName: p.siteName || "",
      description: p.description || "",
      employeeCount: p.employeeCount,
      amount: formatMoney(p.amount),
      notes: p.notes || "",
      date: p.date,
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

    const inventory = this.data.inventory().filter((row) => String(row.projectId) === projectId).map((row) => ({
      __rowId: `inventory:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      site: row.site,
      materialName: row.name,
      unit: row.unit,
      requestedQuantity: formatNumber(row.requestedQuantity),
      approvedQuantity: formatNumber(row.approvedQuantity),
      purchasedQuantity: formatNumber(row.purchasedQuantity),
      consumedQuantity: formatNumber(row.consumedQuantity),
      remainingStock: `${formatNumber(row.remainingStock)} ${row.unit}`,
      minimumQuantity: formatNumber(row.minimumQuantity),
      vendor: row.vendor,
      poNumber: row.poNumber,
    }));

    return {
      materials,
      labour,
      expenses,
      payments,
      vendors,
      subcontractors,
      inventory,
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

  /**
   * Display value for a cell. Maps the stored "Cash Added" transaction
   * type to the user-facing "Add Cash" label. The raw value is preserved
   * on the row so it can be sent back to the backend.
   */
  displayCell(row: TableRow, key: string): string {
    const raw = row[key];
    if (key === "transactionType" && raw === "Cash Added") return "Add Cash";
    return raw == null ? "" : String(raw);
  }

  /**
   * Fetch every sub-contractor from the backend (paginating up to the
   * page size the /subcontractors page uses) so the record-form dropdown
   * matches the /subcontractors list exactly. Triggered when the user
   * opens the Add Record dialog or the sub-contractor dropdown.
   */
  private async loadAllSubcontractorNames(): Promise<void> {
    if (this.loadingAllSubcontractors()) return;
    this.loadingAllSubcontractors.set(true);
    const pageSize = 500;
    const collected: string[] = [];
    const seen = new Set<string>();
    try {
      let page = 1;
      let totalPages = 1;
      do {
        const res = await firstValueFrom(this.api.listSubcontractors({ limit: pageSize, page }));
        const items: any[] = (res as any)?.items || [];
        for (const row of items) {
          const name = String(row?.subcontractorName || row?.name || "").trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            collected.push(name);
          }
        }
        const total = Number((res as any)?.total ?? 0);
        const pages = Number((res as any)?.pages ?? Math.ceil(total / pageSize));
        totalPages = pages > 0 ? pages : 1;
        page += 1;
        if (items.length === 0) break;
      } while (page <= totalPages);
      this.allSubcontractorNames.set(collected.sort((a, b) => a.localeCompare(b)));
    } catch {
      // Fall back to whatever the hydration already has.
    } finally {
      this.loadingAllSubcontractors.set(false);
    }
  }

  selectOptions(section: ModuleKey, key: string): string[] {
    if (key === "site" || key === "siteName") return this.projectSites();
    if (key === "vendor" || key === "vendorName") return this.vendorNameOptions();
    if (section === "materials" && key === "materialName") return this.materialNameOptions();
    if (section === "materials" && key === "unit") return ["Bag", "Nos", "Kg", "Load", "Piece", "Item"];
    if (section === "labour" && key === "staffName") return this.staffNameOptionsForProject();
    if (section === "expenses" && key === "transactionType") {
      return ["Purchase", "Add Cash"];
    }
    if (section === "expenses" && key === "siteMaterial") return ["No", "Yes"];
    if (section === "labour" && key === "attendance") return ["Present", "Absent"];
    // Subcontractor section — dropdowns are sourced from the live
    // /api/subcontractors and the project's site list. Every
    // sub-contractor (active or not) is offered so existing records
    // can always be matched; on save we re-resolve to the matching
    // subcontractorId to avoid matching on name alone.
    if (section === "subcontractors" && (key === "subcontractorName" || key === "subcontractor")) {
      const full = this.allSubcontractorNames();
      if (full.length > 0) return full;
      // Fallback while the full list is still loading: merge the
      // hydration's first page with anything already in memory so the
      // dropdown is never empty.
      return [...new Set(
        this.data.subcontractors()
          .map((s) => s.subcontractorName)
          .filter((name): name is string => Boolean(name && name.trim()))
      )].sort((a, b) => a.localeCompare(b));
    }
    if (key === "approvalStatus" || key === "status") {
      if (section === "materials") {
        return ["Pending", "Approved", "Declined", "Completed", "Received", "Not Received"];
      }
      return ["Pending", "Approved", "Declined"];
    }
    if (key === "paymentMode") return ["Cash", "NEFT", "UPI", "Bank Transfer", "Cheque"];
    if (section === "payments" && key === "mode") {
      const custom = this.customPaymentModes().filter((mode) => !paymentModeOptions.includes(mode));
      return [...paymentModeOptions, ...custom];
    }
    if (key === "paymentStatus") return ["Not Started", "Part Paid", "Paid"];
    return [];
  }

  private loadStoredPaymentModes(): string[] {
    try { return JSON.parse(localStorage.getItem(PAYMENT_MODE_STORAGE_KEY) || "[]"); } catch { return []; }
  }

  private persistPaymentModes(modes: string[]) {
    try { localStorage.setItem(PAYMENT_MODE_STORAGE_KEY, JSON.stringify(modes)); } catch { /* ignore storage errors */ }
  }

  registerPaymentMode(mode: string) {
    const value = mode.trim();
    if (!value || paymentModeOptions.includes(value)) return;
    if (this.customPaymentModes().some((existing) => existing.toLowerCase() === value.toLowerCase())) return;
    const next = [...this.customPaymentModes(), value];
    this.customPaymentModes.set(next);
    this.persistPaymentModes(next);
  }

  isPaymentModeField(column: FieldSchema): boolean {
    return this.activeSection() === "payments" && column.key === "mode";
  }

  addCustomPaymentModeFromInput(value: string, event?: Event) {
    event?.preventDefault();
    const mode = value.trim();
    if (!mode) return;
    this.registerPaymentMode(mode);
    this.updateDraftField("mode", mode);
    if (event?.target instanceof HTMLInputElement) event.target.value = "";
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
        labourTypes: "Carpenter: 1",
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
        transactionType: "Add Cash",
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
        date: today,
        subcontractorName: "",
        siteName: site,
        description: "",
        employeeCount: 1,
        amount: 0,
        notes: "",
      },
      inventory: {
        materialName: "",
        totalQty: 0,
        unit: "",
        siteCount: 0,
        lastUpdated: "",
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
      normalized.includes("add cash") ||
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
    const rows = this.materialsService
      .materials()
      .filter((row) => row.projectId === projectId)
      .filter((row) => (row.vendor || "").toLowerCase() === vendorName.toLowerCase());
    const purchased = rows.reduce((sum, row) => sum + row.purchased, 0);
    return rows.length ? `${formatNumber(rows.length)} records / ${formatNumber(purchased)} purchased` : "0 records";
  }

  private vendorNameOptions(): string[] {
    const projectId = this.projectId();
    if (!projectId) return [];

    const projectMaterials = this.materialsService.materials().filter((m) => m.projectId === projectId);
    const vendorNamesInProject = new Set(projectMaterials.map((m) => m.vendor).filter(Boolean));

    const projectTableMaterials = this.data.tableRowsFor("materials", this.tableRows().materials, (row) => this.rowBelongsToProject(row));
    projectTableMaterials.forEach((row) => {
      const v = String(row["vendor"] || "").trim();
      if (v) vendorNamesInProject.add(v);
    });

    return [
      ...Array.from(vendorNamesInProject).sort((a, b) => a.localeCompare(b)),
    ];
  }

  private materialNameOptions(): string[] {
    return [
      ...new Set([
        ...this.materialsService.materials().map((material) => material.name),
        ...this.data.tableRowsFor("materials", this.tableRows().materials, (row) => this.rowBelongsToProject(row)).map((row) => String(row["materialName"] || row["name"] || "")),
      ].map((value) => value.trim()).filter(Boolean)),
    ].sort((first, second) => first.localeCompare(second));
  }

  private labourTypesFromRow(row: { category: string; notes: string; presentCount: number; dailyWage?: number }): string {
    const notes = (row.notes || '').trim();
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
    if (countMatch) {
      const wageMatch = text.match(/(?:@|wage\s*[:=-]?)\s*(?:[^\d-]*)?([\d,]+(?:\.\d+)?)/i);
      return {
        type: countMatch[1].trim(),
        count: Number(countMatch[2]),
        wage: wageMatch ? this.moneyNumber(wageMatch[1]) : 0,
      };
    }
    const plainType = text.replace(/\s+/g, ' ').trim();
    if (/^[a-z\s.&]+$/i.test(plainType) && plainType.length < 50) {
      return { type: plainType, count: 1, wage: 0 };
    }
    return null;
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

  isNoCreateSection(): boolean {
    const s = this.activeSection();
    return s === "expenses" || s === "materials";
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
      // Mirror the labour table exactly — no synthetic pay totals, no
      // late-fine amount. Payment mode, status, notes, and staff count are
      // dropped from the report along with the table. The PDF is an
      // attendance report, not a payroll summary.
      const labourTableColumns = this.columnsFor("labour");
      return labourTableColumns.filter(
        (column) => column.key !== "lateFine" && column.key !== "paymentMode" && column.key !== "status" && column.key !== "notes" && column.key !== "staffCount"
      );
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
    const groups = new Map<string, TableRow[]>();
    for (const row of rows) {
      const sub = String(row["subcontractorName"] || "").trim();
      const date = String(row["attendanceDate"] || row["notes"] || "").trim();
      const key = date ? `${sub}||${date}` : `__no-date__:${sub}:${row["__rowId"] || "?"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    const groupedRows: TableRow[] = [];
    for (const groupRows of groups.values()) {
      const first = groupRows[0];
      const typeMap = new Map<string, { count: number; wage: number }>();
      let totalOvertimeHrs = 0;
      let totalLateFine = 0;
      for (const row of groupRows) {
        const entries = this.labourTypeEntriesForRow(row);
        for (const entry of entries) {
          const existing = typeMap.get(entry.type) || { count: 0, wage: entry.wage };
          existing.count += entry.count;
          existing.wage = existing.wage || entry.wage;
          typeMap.set(entry.type, existing);
        }
        totalOvertimeHrs += this.moneyNumber(String(row["overtime"] || "").replace(/[^0-9.]/g, ""));
        totalLateFine += this.moneyNumber(String(row["lateFine"] || ""));
      }
      const typeBreakup = [...typeMap.entries()]
        .map(([type, v]) => `${type}: ${v.count}`)
        .join(", ");
      const distinctValues = (field: string): string => {
        const values = [...new Set(groupRows.map((row) => String(row[field] ?? "").trim()).filter(Boolean))];
        return values.join(", ");
      };
      groupedRows.push({
        ...first,
        subcontractorName: distinctValues("subcontractorName"),
        labourTypes: typeBreakup || String(first["labourTypes"] || ""),
        staffCount: [...typeMap.values()].reduce((sum, v) => sum + v.count, 0),
        attendance: this.formatGroupedAttendance(groupRows),
        // PDF keeps overtime hours but drops the late-fine amount. The
        // wage custom fields flow through unchanged from the source row.
        overtime: totalOvertimeHrs ? String(totalOvertimeHrs) : String(first["overtime"] || ""),
        lateFine: "",
      });
      // Suppress unused warnings while preserving the pre-existing
      // behaviour for any caller still reading lateFine.
      void totalLateFine;
    }
    return groupedRows;
  }

  private labourWeeklyPayForRow(row: TableRow): { breakup: string; total: number; items: Array<{ type: string; count: number; wage: number; amount: number }> } {
    if (String(row["attendance"] || "").toLowerCase() === "absent") return { breakup: "Absent", total: 0, items: [] };
    const entries = this.labourTypeEntriesForRow(row);
    const shift = this.moneyNumber(row["shift"]) || 1;
    const shiftMultiplier = shift / 2;
    const items = entries.map((entry) => {
      const amount = entry.count * entry.wage * shiftMultiplier;
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
    const dailyPay = this.moneyNumber(row["dailyPay"]);
    if (dailyPay) {
      const shift = this.moneyNumber(row["shift"]) || 1;
      return Math.round((dailyPay / (shift / 2)) * 100) / 100;
    }
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
    for (const row of rows) {
      const name = String(row["staffName"] || row["labourName"] || "Unnamed");
      const current = staffSummary.get(name) ?? { present: 0, absent: 0, staff: 0 };
      const isAbsent = String(row["attendance"] || "").toLowerCase() === "absent";
      if (isAbsent) current.absent += 1;
      else current.present += 1;
      const staffCount = this.moneyNumber(row["staffCount"]) || this.staffCountFromLabourTypes(String(row["labourTypes"] || ""));
      if (!isAbsent) current.staff += staffCount;
      staffSummary.set(name, current);
    }
    if (!staffSummary.size) return "";
    const staffHtml = [...staffSummary.entries()]
      .map(
        ([name, value]) =>
          `<div><strong>${this.escapeHtml(name)}</strong><span>Present: ${value.present}</span><span>Absent: ${value.absent}</span><span>Staff: ${value.staff}</span></div>`,
      )
      .join("");
    return `<section class="summary"><h2>Attendance Summary</h2>${staffHtml}</section>`;
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
