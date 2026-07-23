import { CommonModule, DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import { ErpDataService, type SharedModuleKey, type SharedTableField, type SharedTableRow } from "../data/erp-data.service";
import { MaterialsService } from "../core/materials.service";
import { ApiService } from "../core/api.service";
import { mapClient, mapProject, mapSite, mapVendor, mapSupervisor, mapMaterial, mapLabour, mapExpense, mapPayment, mapSubcontractor } from "../core/mappers";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, formatNumber, statusClass } from "../shared/format";
import { VendorFormDialogComponent, type VendorFormValue } from "../shared/vendor-form-dialog.component";

type DashboardModule =
  | "materials"
  | "clients"
  | "labour"
  | "expenses"
  | "generalExpenses"
  | "payments"
  | "vendors"
  | "subcontractors"
  | "inventory"
  | "reports";
type TableRow = SharedTableRow;
type FieldSchema = SharedTableField;
type FilterSchema = { key: string; label: string };
type FilterBuilderStep = "fields" | "values";
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
      { key: "clientName", label: "Client Name" },
      { key: "mobile", label: "Mobile Number" },
      { key: "address", label: "Address" },
      { key: "projectCount", label: "Project Count" },
      { key: "activeSites", label: "Active Sites" },
      { key: "totalProjectValue", label: "Total Project Value" },
      { key: "amountReceived", label: "Amount Received" },
      { key: "pendingBalance", label: "Pending Balance" },
      { key: "status", label: "Status" },
    ],
    filters: [
      { key: "status", label: "Status" },
      { key: "projectCount", label: "Project Count" },
    ],
  },
  {
    key: "labour",
    label: "Labour",
    title: "All Labour Attendance",
    description: "Every staff attendance row across sites with labour types, staff count, shift, overtime, and fine.",
    columns: [
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "attendanceDate", label: "Date" },
      { key: "staffName", label: "Staff Name" },
      { key: "labourTypes", label: "Labour Types" },
      { key: "notes", label: "Notes" },
      { key: "staffCount", label: "Staff Count" },
      { key: "attendance", label: "Attendance" },
      { key: "shift", label: "Shift" },
      { key: "overtime", label: "Overtime" },
      { key: "lateFine", label: "Late Fine" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "status", label: "Status" },
    ],
    filters: [
      { key: "project", label: "Project" },
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
      { key: "siteMaterial", label: "Site Material" },
      { key: "runningBalance", label: "Balance" },
      { key: "poNumber", label: "PO Number" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
    filters: [
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
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
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
    filters: [
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
    key: "subcontractors",
    label: "Subcontracts",
    title: "Subcontractor Register",
    description: "Subcontractor work packages with contract value, advances, balance, supervisor, and payment status.",
    columns: [
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
    key: "inventory",
    label: "Inventory",
    title: "Inventory Summary",
    description: "Aggregated material stock by type across all sites with site-wise breakdown.",
    columns: [
      { key: "materialName", label: "Material" },
      { key: "totalQty", label: "Total Qty", type: "number" },
      { key: "unit", label: "Unit" },
      { key: "siteCount", label: "Sites", type: "number" },
      { key: "lastUpdated", label: "Last Updated" },
    ],
    filters: [
      { key: "materialName", label: "Material" },
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
    ],
    filters: [
      { key: "category", label: "Category" },
      { key: "owner", label: "Owner" },
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
  imports: [CommonModule, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, VendorFormDialogComponent, DatePipe],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="dashboard"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        @if (backendSyncMessage()) {
          <div class="backend-sync-banner" role="status">
            <span class="spinner" [class.spinning]="backendSyncing()"></span>
            <span>{{ backendSyncMessage() }}</span>
            @if (!backendSyncing()) {
              <button type="button" class="banner-btn" (click)="refreshFromBackend()">Refresh now</button>
            }
          </div>
        }
        <agb-enterprise-header
          title="Dashboard"
          eyebrow="Universal Records · Backend source of truth"
          metaLabel=""
          [blurred]="recordDialogOpen() || fieldDialogOpen() || labourTypeDialogOpen() || filterBuilderOpen() || showVendorDialog() || !!editingInlineVendor()"
          [showTitle]="false"
          searchPlaceholder="Search"
          />

        <ion-content class="erp-page">
          <main class="workspace-shell" [class.table-view-expanded]="tableViewExpanded()">
            <section class="dashboard-modern-hero" *ngIf="!tableViewExpanded()">
              <div class="hero-header">
                <h1>Dashboard</h1>
                <span class="hero-subtitle">Overview of all operations</span>
              </div>
              <div class="hero-kpi-strip">
                <div class="kpi-card">
                  <div class="kpi-icon active"><ion-icon name="folder-open-outline"></ion-icon></div>
                  <div class="kpi-content">
                    <span class="kpi-label">Active Projects</span>
                    <strong class="kpi-value">{{ activeProjectsCount() }}</strong>
                    <span class="kpi-badge active">Active</span>
                  </div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-icon onhold"><ion-icon name="pause-circle-outline"></ion-icon></div>
                  <div class="kpi-content">
                    <span class="kpi-label">Projects On Hold</span>
                    <strong class="kpi-value">{{ projectsOnHoldCount() }}</strong>
                    <span class="kpi-badge onhold">On Hold</span>
                  </div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-icon completed"><ion-icon name="checkmark-circle-outline"></ion-icon></div>
                  <div class="kpi-content">
                    <span class="kpi-label">Completed Projects</span>
                    <strong class="kpi-value">{{ completedProjectsCount() }}</strong>
                    <span class="kpi-badge completed">Done</span>
                  </div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-icon approval"><ion-icon name="time-outline"></ion-icon></div>
                  <div class="kpi-content">
                    <span class="kpi-label">Pending Approval</span>
                    <strong class="kpi-value">{{ pendingApprovalCount() }}</strong>
                    <span class="kpi-badge approval">Review</span>
                  </div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-icon clients"><ion-icon name="people-outline"></ion-icon></div>
                  <div class="kpi-content">
                    <span class="kpi-label">Active Clients</span>
                    <strong class="kpi-value">{{ data.activeClients() }}</strong>
                    <span class="kpi-badge clients">Ongoing</span>
                  </div>
                </div>
              </div>
            </section>

            <section class="operations-workbench universal-workbench" [class.table-expanded]="tableViewExpanded()">
              <nav class="operations-tabs" aria-label="Universal dashboard modules" *ngIf="!tableViewExpanded()">
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

              <div class="site-workbench universal-site-workbench" *ngIf="!tableViewExpanded() && isUniversalSiteAware(activeModule())">
                <div class="site-switch-row">
                  <span>Site</span>
                  <div class="site-chip-strip">
                    <button type="button" [class.active]="activeSiteFilter() === 'All'" (click)="selectUniversalSite('All')">All Sites</button>
                    <button
                      *ngFor="let site of universalSiteOptions()"
                      type="button"
                      [class.active]="activeSiteFilter() === site.id"
                      (click)="selectUniversalSite(site.id)"
                    >
                      {{ site.name }}
                    </button>
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
                    <input [value]="searchText()" (input)="searchText.set($any($event.target).value)" placeholder="Search rows" />
                  </label>
                  <button
                    type="button"
                    class="primary-table-action add-row-action"
                    *ngIf="!tableViewExpanded() && activeModule() !== 'vendors' && (selectedRowCount() > 0 || !isNoCreateModule())"
                    [title]="selectedRowCount() ? 'Edit ' + selectedRowCount() + ' selected row(s)' : 'Add row'"
                    [attr.aria-label]="selectedRowCount() ? 'Edit ' + selectedRowCount() + ' selected row(s)' : 'Add row'"
                    (click)="selectedRowCount() ? editSelectedRows() : openRecordDialog()"
                  >
                    <ion-icon [name]="selectedRowCount() ? 'create-outline' : 'add-outline'"></ion-icon>
                    {{ selectedRowCount() ? 'Edit ' + selectedRowCount() + ' Row(s)' : 'Add Row' }}
                  </button>
                  <button
                    *ngIf="!tableViewExpanded() && selectedRowCount()"
                    type="button"
                    class="danger-table-action"
                    [attr.aria-label]="'Delete ' + selectedRowCount() + ' selected row(s)'"
                    (click)="deleteSelectedRows()"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                      <path d="M4 7h14" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M6 7l1 14h10l1-14" />
                      <path d="M9 7V4h6v3" />
                    </svg>
                    Delete {{ selectedRowCount() }} Row(s)
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

              <div class="universal-filter-bar compact-filter-bar" *ngIf="!tableViewExpanded()">
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

              <div class="expense-ledger-summary universal-expense-summary" *ngIf="!tableViewExpanded() && activeModule() === 'expenses' && expenseFilterBalanceVisible()">
                <div><span>Project</span><strong>{{ selectedFilters()['project'] }}</strong></div>
                <div><span>Site</span><strong>{{ activeExpenseSiteFilter() }}</strong></div>
                <div><span>Opening Balance</span><strong>{{ expenseFilterOpeningLabel() }}</strong></div>
                <div><span>Current Balance</span><strong>{{ expenseFilterCurrentLabel() }}</strong></div>
              </div>

              <section class="inventory-cards-section" *ngIf="!tableViewExpanded() && activeModule() === 'inventory'">
                <div class="inventory-grid">
                  @for (card of inventoryCards(); track card.materialName) {
                    <article class="inventory-card" role="button" tabindex="0" (click)="openInventoryBreakdown(card)" (keydown.enter)="openInventoryBreakdown(card)">
                      <div class="inventory-card-head">
                        <div class="inventory-material-icon">
                          <ion-icon name="cube-outline"></ion-icon>
                        </div>
                        <div class="inventory-material-info">
                          <h3>{{ card.materialName }}</h3>
                          <span class="inventory-unit">{{ card.unit }}</span>
                        </div>
                        <span class="inventory-site-count">{{ card.siteCount }} site{{ card.siteCount !== 1 ? 's' : '' }}</span>
                      </div>
                      <div class="inventory-card-body">
                        <div class="inventory-qty">
                          <span class="qty-label">Total Stock</span>
                          <strong class="qty-value">{{ card.totalQty }} <small>{{ card.unit }}</small></strong>
                        </div>
                        <div class="inventory-meta">
                          <span class="meta-label">Last Updated</span>
                          <span class="meta-value">{{ card.lastUpdated || 'N/A' }}</span>
                        </div>
                        @if (card.vendorHistory.length > 0) {
                          <div class="inventory-vendor-history">
                            @for (entry of card.vendorHistory.slice(0, 2); track entry.vendor) {
                              <div class="vendor-history-row">
                                <span class="vendor-name">{{ entry.vendor }}</span>
                                <span class="vendor-qty">{{ entry.qty }} {{ card.unit }}</span>
                                @if (entry.lastDate) {
                                  <span class="vendor-date">{{ entry.lastDate | date:'d MMM yyyy' }}</span>
                                }
                              </div>
                            }
                          </div>
                        }
                      </div>
                    </article>
                  }
                  @if (inventoryCards().length === 0) {
                    <div class="inventory-empty">
                      <ion-icon name="cube-outline"></ion-icon>
                      <p>No materials found. Add materials to see inventory summary.</p>
                    </div>
                  }
                </div>
              </section>

              <ng-container *ngIf="activeModule() !== 'inventory'">
                <ng-container *ngIf="tableState() as tableState">
                <div class="table-meta-strip" *ngIf="!tableViewExpanded()">
                <span>{{ tableState.rows.length }} rows</span>
                <span>{{ tableState.columns.length }} fields</span>
                <span>{{ selectedFilterCount() }} active filters</span>
                <span *ngIf="activeModule() === 'clients'">Customer records synced</span>
                <span *ngIf="activeModule() === 'expenses'">Balances grouped by Project + Site</span>
                <button type="button" class="meta-reset-action" *ngIf="hiddenFieldCount(activeModule())" (click)="resetFields(activeModule())">
                  Reset fields
                </button>
              </div>

              <div class="table-wrap operations-table universal-table">
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
                          <button type="button" class="column-hide-action" aria-label="Hide column" title="Hide column" (click)="hideField(activeModule(), column.key, $event)">
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
                        [class.select-cell]="isRowEditing(row) && !isReadonlyColumn(column.key) && selectOptions(activeModule(), column.key).length > 0"
                        [class.labour-types-cell-host]="activeModule() === 'labour' && column.key === 'labourTypes'"
                        spellcheck="false"
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
                            *ngIf="activeModule() === 'reports'"
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
                        <ng-container *ngIf="activeModule() === 'labour' && column.key === 'labourTypes'; else standardDashboardCell">
                          <div class="labour-types-cell">
                            <div class="labour-type-chip-row" *ngIf="labourTypeCards(row).length; else emptyUniversalLabourTypes">
                              <span class="labour-type-chip" *ngFor="let type of labourTypeCards(row)">
                                <span>{{ type.type }}</span>
                                <strong>{{ type.count }}</strong>
                                <button *ngIf="isRowEditing(row)" type="button" aria-label="Remove labor type" title="Remove labor type" (click)="removeLabourType(row, type.type, $event)">
                                  <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                                    <path d="m5.5 5.5 9 9" />
                                    <path d="m14.5 5.5-9 9" />
                                  </svg>
                                </button>
                              </span>
                            </div>
                            <ng-template #emptyUniversalLabourTypes>
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
                        <ng-template #standardDashboardCell>
                          <div
                            *ngIf="isRowEditing(row) && !isReadonlyColumn(column.key) && selectOptions(activeModule(), column.key).length > 0; else editableDashboardCell"
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
                                *ngFor="let option of selectOptions(activeModule(), column.key)"
                                type="button"
                                [class.selected]="option === row[column.key]"
                                (click)="selectCellOptionForRow(row, column.key, option)"
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
                              <label class="custom-select-entry" *ngIf="allowsCustomOption(activeModule(), column.key)">
                                <span>Custom</span>
                                <input
                                  #dashboardCustomValue
                                  (keydown.enter)="saveCustomSelectOptionForRow(row, column.key, dashboardCustomValue.value, $event)"
                                  placeholder="Type value and press Enter"
                                />
                              </label>
                            </div>
                          </div>
                          <ng-template #editableDashboardCell>
                            <span
                              class="editable-cell"
                              [class.cell-readonly]="!isRowEditing(row) || isReadonlyColumn(column.key)"
                              [attr.contenteditable]="isRowEditing(row) && !isReadonlyColumn(column.key) ? 'true' : null"
                              spellcheck="false"
                              (blur)="isRowEditing(row) && !isReadonlyColumn(column.key) && updateRowCell(row, column.key, $any($event.target).textContent || '')"
                            >
                              {{ displayCell(row, column.key) }}
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
                          ? 'Choose any table fields to filter. Custom fields are included.'
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
                      *ngIf="selectOptions(activeModule(), column.key).length > 0 && allowsCustomOption(activeModule(), column.key); else dashboardDraftSelect"
                      [attr.list]="'dashboard-draft-' + activeModule() + '-' + column.key"
                      [type]="column.type || 'text'"
                      [value]="draftRow()[column.key] || ''"
                      (input)="updateDraftField(column.key, $any($event.target).value)"
                    />
                    <datalist [id]="'dashboard-draft-' + activeModule() + '-' + column.key">
                      <option *ngFor="let option of selectOptions(activeModule(), column.key)" [value]="option"></option>
                    </datalist>
                    <ng-template #dashboardDraftSelect>
                      <select
                        *ngIf="selectOptions(activeModule(), column.key).length > 0; else dashboardDraftInput"
                        [value]="draftRow()[column.key] || ''"
                        (change)="updateDraftField(column.key, $any($event.target).value)"
                      >
                        <option *ngFor="let option of selectOptions(activeModule(), column.key)" [value]="option">{{ option }}</option>
                      </select>
                    </ng-template>
                    <ng-template #dashboardDraftInput>
                      <input [type]="column.type || 'text'" [value]="draftRow()[column.key] || ''" (input)="updateDraftField(column.key, $any($event.target).value)" />
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
                        *ngIf="selectOptions('materials', field.key).length > 0 && allowsCustomOption('materials', field.key); else dashboardMaterialSelect"
                        [attr.list]="'dashboard-site-material-' + field.key"
                        [type]="field.type || 'text'"
                        [value]="draftRow()[field.key] || ''"
                        (input)="updateDraftField(field.key, $any($event.target).value)"
                      />
                      <datalist [id]="'dashboard-site-material-' + field.key">
                        <option *ngFor="let option of selectOptions('materials', field.key)" [value]="option"></option>
                      </datalist>
                      <ng-template #dashboardMaterialSelect>
                        <select
                          *ngIf="selectOptions('materials', field.key).length > 0; else dashboardMaterialInput"
                          [value]="draftRow()[field.key] || ''"
                          (change)="updateDraftField(field.key, $any($event.target).value)"
                        >
                          <option *ngFor="let option of selectOptions('materials', field.key)" [value]="option">{{ option }}</option>
                        </select>
                      </ng-template>
                      <ng-template #dashboardMaterialInput>
                        <input [type]="field.type || 'text'" [value]="draftRow()[field.key] || ''" (input)="updateDraftField(field.key, $any($event.target).value)" />
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
                    <input [value]="newFieldLabel()" (input)="newFieldLabel.set($any($event.target).value)" placeholder="Example: Verified By" />
                  </label>
                  <label>
                    <span>Field Type</span>
                    <select [value]="newFieldType()" (change)="newFieldType.set($any($event.target).value)">
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Yes / No</option>
                    </select>
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" [checked]="newFieldAskSupervisor()" (change)="newFieldAskSupervisor.set($any($event.target).checked)" />
                    <span>Ask supervisor to fill this when creating a request</span>
                  </label>
                  <p class="hint" *ngIf="newFieldAskSupervisor()">
                    The field will be saved to MongoDB and appear in the supervisor's mobile form
                    for the {{ activeSiteFilter() === 'All' ? 'currently selected site' : 'selected site' }}.
                  </p>
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
                      list="universal-labour-type-options"
                      [value]="labourTypeName()"
                      (input)="updateLabourTypeName($any($event.target).value)"
                      placeholder="Type or choose labor type"
                    />
                    <datalist id="universal-labour-type-options">
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
                    <input type="number" min="0" [value]="labourTypeCount()" (input)="labourTypeCount.set($any($event.target).value)" />
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

            <agb-vendor-form-dialog
              *ngIf="showVendorDialog()"
              [eyebrow]="editingInlineVendor() ? 'Vendor Edit' : 'Vendor Setup'"
              [title]="editingInlineVendor() ? 'Edit Vendor' : 'Add New Vendor'"
              [description]="editingInlineVendor() ? 'Update vendor contact, material type, GST, and address information.' : 'Create the vendor record to track material purchases and GST.'"
              [submitLabel]="editingInlineVendor() ? 'Save Changes' : 'Create Vendor'"
              [initialValue]="editingInlineVendor() ? inlineVendorEditValue() : null"
              (cancel)="closeVendorDialog()"
              (create)="editingInlineVendor() ? updateInlineVendor($event) : createInlineVendor($event)"
            ></agb-vendor-form-dialog>
          </main>
        </ion-content>

        @if (showInventoryBreakdown() && selectedInventoryCard()) {
          <section class="form-overlay" role="presentation">
            <section class="erp-dialog inventory-breakdown-dialog" role="dialog" aria-modal="true" aria-labelledby="inv-breakdown-title">
              <div class="dialog-head">
                <div>
                  <span>Inventory Breakdown</span>
                  <h2 id="inv-breakdown-title">{{ selectedInventoryCard()!.materialName }}</h2>
                  <p>Site-wise stock distribution for this material</p>
                </div>
                <button type="button" class="icon-button" aria-label="Close breakdown" (click)="closeInventoryBreakdown()">
                  <ion-icon name="close-outline"></ion-icon>
                </button>
              </div>
              <div class="inventory-breakdown-summary">
                <div class="breakdown-stat">
                  <span class="stat-label">Total Qty</span>
                  <strong class="stat-value">{{ selectedInventoryCard()!.totalQty }} {{ selectedInventoryCard()!.unit }}</strong>
                </div>
                <div class="breakdown-stat">
                  <span class="stat-label">Sites</span>
                  <strong class="stat-value">{{ selectedInventoryCard()!.siteCount }}</strong>
                </div>
                <div class="breakdown-stat">
                  <span class="stat-label">Last Updated</span>
                  <strong class="stat-value">{{ selectedInventoryCard()!.lastUpdated || 'N/A' }}</strong>
                </div>
              </div>
              @if (selectedInventoryCard()!.vendorHistory && selectedInventoryCard()!.vendorHistory.length > 0) {
                <div class="breakdown-vendor-history">
                  <h3 class="vendor-history-title">Vendor Purchase History</h3>
                  <div class="vendor-history-list">
                    @for (entry of selectedInventoryCard()!.vendorHistory; track entry.vendor) {
                      <div class="vendor-history-entry">
                        <div class="vendor-entry-info">
                          <ion-icon name="storefront-outline"></ion-icon>
                          <span class="vendor-entry-name">{{ entry.vendor }}</span>
                        </div>
                        <div class="vendor-entry-stats">
                          <span class="vendor-entry-qty">{{ entry.qty }} {{ selectedInventoryCard()!.unit }}</span>
                          @if (entry.lastDate) {
                            <span class="vendor-entry-date">{{ entry.lastDate | date:'d MMM yyyy' }}</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
              <div class="inventory-breakdown-table">
                <div class="breakdown-table-head">
                  <span>Site</span>
                  <span>Qty</span>
                  <span>Unit</span>
                  <span>Quality / Grade</span>
                  <span>Last Updated</span>
                </div>
                @for (row of inventoryBreakdownRows(); track row.id) {
                  <div class="breakdown-table-row">
                    <span>{{ row.site || 'Unknown Site' }}</span>
                    <strong>{{ row.quantity ?? 0 }}</strong>
                    <span>{{ row.unit }}</span>
                    <span>-</span>
                    <span>{{ row.requestDate || 'N/A' }}</span>
                  </div>
                }
              </div>
              <div class="dialog-actions">
                <button type="button" class="secondary-action" (click)="closeInventoryBreakdown()">Close</button>
              </div>
            </section>
          </section>
        }
      </div>
    </ion-split-pane>
  `,
  styles: [`
    .backend-sync-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      background: #1a2540;
      color: #fff;
      font-size: 13px;
      border-bottom: 1px solid #2c3760;
    }
    .backend-sync-banner .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #4a5780;
      border-top-color: #6fffb0;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .backend-sync-banner .spinner.spinning {
      animation: banner-spin 0.8s linear infinite;
    }
    @keyframes banner-spin { to { transform: rotate(360deg); } }
    .backend-sync-banner .banner-btn {
      margin-left: auto;
      background: #2c5cff;
      color: #fff;
      border: none;
      padding: 5px 12px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #1a2540;
      cursor: pointer;
      grid-column: span 2;
    }
    .checkbox-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    .hint {
      grid-column: span 2;
      font-size: 12px;
      color: #4a5578;
      background: #f3f6ff;
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid #2c5cff;
      margin: 0;
    }
    .inventory-cards-section {
      padding: 20px 24px;
    }
    .inventory-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
    .inventory-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 160ms ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .inventory-card:hover {
      border-color: #cbd5e1;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      transform: translateY(-1px);
    }
    .inventory-card-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .inventory-material-icon {
      width: 40px;
      height: 40px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .inventory-material-icon ion-icon {
      font-size: 20px;
      color: #64748b;
    }
    .inventory-material-info {
      flex: 1;
      min-width: 0;
    }
    .inventory-material-info h3 {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .inventory-unit {
      font-size: 12px;
      color: #64748b;
    }
    .inventory-site-count {
      font-size: 11px;
      font-weight: 700;
      background: #f8fafc;
      color: #64748b;
      border: 1px solid #f1f5f9;
      border-radius: 999px;
      padding: 3px 10px;
      white-space: nowrap;
    }
    .inventory-card-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 10px;
      padding: 12px;
    }
    .inventory-qty {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .qty-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .qty-value {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .qty-value small {
      font-size: 11px;
      font-weight: 400;
      color: #64748b;
    }
    .inventory-meta {
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .meta-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .meta-value {
      font-size: 12px;
      color: #0f172a;
      font-weight: 500;
    }
    .inventory-empty {
      grid-column: 1 / -1;
      text-align: center;
      padding: 48px;
      color: #94a3b8;
    }
    .inventory-empty ion-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }
    .inventory-vendor-history {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 4px;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
    }
    .vendor-history-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    .vendor-history-row .vendor-name {
      color: #475569;
      font-weight: 600;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .vendor-history-row .vendor-qty {
      color: #0f172a;
      font-weight: 700;
    }
    .vendor-history-row .vendor-date {
      color: #94a3b8;
      font-size: 10px;
    }
    .inventory-breakdown-dialog {
      max-width: 680px;
      width: 95%;
    }
    .inventory-breakdown-summary {
      display: flex;
      gap: 24px;
      padding: 16px 24px;
      background: #f8faff;
      border-bottom: 1px solid #e5eaf1;
      margin: -20px -24px 0;
      border-radius: 12px 12px 0 0;
    }
    .breakdown-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: #1a2540;
    }
    .inventory-breakdown-table {
      margin-top: 16px;
      max-height: 360px;
      overflow-y: auto;
    }
    .breakdown-vendor-history {
      padding: 16px 24px;
      border-bottom: 1px solid #e5eaf1;
    }
    .vendor-history-title {
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 10px;
    }
    .vendor-history-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .vendor-history-entry {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 10px;
    }
    .vendor-entry-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .vendor-entry-info ion-icon {
      font-size: 16px;
      color: #64748b;
    }
    .vendor-entry-name {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }
    .vendor-entry-stats {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .vendor-entry-qty {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .vendor-entry-date {
      font-size: 11px;
      color: #94a3b8;
    }
    .breakdown-table-head {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr;
      gap: 8px;
      padding: 8px 12px;
      background: #f3f6ff;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .breakdown-table-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid #f0f4ff;
      font-size: 13px;
      align-items: center;
    }
    .breakdown-table-row:last-child {
      border-bottom: none;
    }
    .breakdown-table-row span {
      color: #4a5578;
    }
    .breakdown-table-row strong {
      color: #1a2540;
      font-weight: 600;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniversalDashboardPage {
  readonly data = inject(ErpDataService);
  readonly materialsService = inject(MaterialsService);
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  readonly modules = dashboardModules;
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;
  readonly activeModule = signal<DashboardModule>("clients");
  readonly selectedRowKey = signal("");
  readonly selectedRowKeys = signal<string[]>([]);
  readonly editingRowKey = signal("");
  readonly editingRowKeys = signal<string[]>([]);
  readonly rowToolbarPosition = signal({ x: 160, y: 120 });
  readonly searchText = signal("");
  readonly activeSite = signal<string>(localStorage.getItem("agb-erp:universal-active-site") || "All");
  readonly selectedFilters = signal<Record<string, string>>({});
  readonly selectedFilterFields = signal<string[]>([]);
  readonly filterBuilderOpen = signal(false);
  readonly filterBuilderStep = signal<FilterBuilderStep>("fields");
  readonly activeFilterValueKey = signal("");
  readonly dateFilterOpen = signal(false);
  readonly dateRange = signal({ start: "", end: "" });
  readonly datePickerTarget = signal<"start" | "end">("start");
  readonly calendarCursor = signal(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);  // Backend refresh state (data source of truth)
  readonly backendSyncing = signal(false);
  readonly backendSyncMessage = signal<string | null>(null);
  readonly backendSource = signal<string | null>(null);

  readonly calendarWeekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  readonly tableViewExpanded = signal(false);
  readonly recordDialogOpen = signal(false);
  readonly showVendorDialog = signal(false);
  readonly editingInlineVendor = signal<{ id: string; vendorName: string; materialType: string; phoneNumber: string; address: string; gstNumber: string } | null>(null);
  readonly fieldDialogOpen = signal(false);
  readonly draftRow = signal<TableRow>({});
  readonly newFieldLabel = signal("");
  readonly newFieldAfterKey = signal<string | null>(null);
  readonly newFieldType = signal<"text" | "number" | "date" | "boolean">("text");
  readonly newFieldAskSupervisor = signal(true);
  readonly openSelectKey = signal("");
  readonly openFilterKey = signal("");
  readonly selectCustomValue = signal("");
  readonly labourTypeDialogOpen = signal(false);
  readonly labourTypeRowId = signal("");
  readonly labourTypeName = signal("Mason");
  readonly labourTypeCount = signal("1");
  readonly labourTypeDailyWage = signal("");
  readonly siteMaterialDetailFields = siteMaterialDetailFields;
  readonly inventoryCards = computed(() => this.aggregateInventory(this.data.materials()));
  readonly selectedInventoryCard = signal<{ materialName: string; totalQty: number; unit: string; siteCount: number; lastUpdated: string; vendorHistory: Array<{ vendor: string; qty: number; lastDate: string }> } | null>(null);
  readonly inventoryBreakdownRows = computed(() => {
    const card = this.selectedInventoryCard();
    if (!card) return [] as import("../../data/dashboardData").MaterialRow[];
    return this.data.materials().filter((m) => m.name === card.materialName);
  });
  readonly showInventoryBreakdown = signal(false);
  readonly activeConfig = computed(() => dashboardModules.find((module) => module.key === this.activeModule()) ?? dashboardModules[0]);
  readonly dashboardRows = computed(() => this.buildRows());
  readonly tableState = computed(() => ({
    rows: this.visibleRows(),
    columns: this.columnsForActive(),
  }));

  activeProjectsCount() {
    return this.data.projects().filter((project) => project.status === "Active").length;
  }

  projectsOnHoldCount() {
    return this.data.projects().filter((project) => project.status === "On Hold").length;
  }

  completedProjectsCount() {
    return this.data.projects().filter((project) => project.status === "Completed").length;
  }

  pendingApprovalCount() {
    return this.pendingApprovalRows().length;
  }

  switchModule(module: DashboardModule) {
    this.activeModule.set(module);
    this.searchText.set("");
    this.resetFilterState();
    this.closeDropdowns();
    this.clearRowSelection();

    // Inventory is derived from the materials collection. If we have no
    // materials yet, kick off a backend fetch so the inventory cards
    // populate immediately when the user opens the section.
    if (module === "inventory" && this.data.materials().length === 0) {
      this.refreshFromBackend();
    }
  }

  private aggregateInventory(materials: import("../../data/dashboardData").MaterialRow[]) {
    const map = new Map<string, { qty: number; unit: string; sites: Set<string>; lastUpdated: string; vendorHistory: Map<string, { qty: number; lastDate: string }> }>();
    for (const m of materials) {
      if (!m.name) continue;
      const key = m.name;
      const existing = map.get(key) || { qty: 0, unit: m.unit || "", sites: new Set<string>(), lastUpdated: "", vendorHistory: new Map() };
      existing.qty += m.quantity ?? 0;
      if (m.site) existing.sites.add(m.site);
      if (m.requestDate && m.requestDate > existing.lastUpdated) existing.lastUpdated = m.requestDate;
      if (m.vendor) {
        const vh = existing.vendorHistory.get(m.vendor) || { qty: 0, lastDate: "" };
        vh.qty += m.quantity ?? 0;
        if (m.purchasedDate && m.purchasedDate > vh.lastDate) vh.lastDate = m.purchasedDate;
        existing.vendorHistory.set(m.vendor, vh);
      }
      map.set(key, existing);
    }
    return [...map.entries()].map(([materialName, v]) => ({
      materialName,
      totalQty: v.qty,
      unit: v.unit,
      siteCount: v.sites.size,
      lastUpdated: v.lastUpdated,
      vendorHistory: [...v.vendorHistory.entries()].map(([vendor, h]) => ({ vendor, qty: h.qty, lastDate: h.lastDate })),
    })).sort((a, b) => a.materialName.localeCompare(b.materialName));
  }

  openInventoryBreakdown(card: { materialName: string; totalQty: number; unit: string; siteCount: number; lastUpdated: string; vendorHistory: Array<{ vendor: string; qty: number; lastDate: string }> }) {
    this.selectedInventoryCard.set(card);
    this.showInventoryBreakdown.set(true);
  }

  closeInventoryBreakdown() {
    this.showInventoryBreakdown.set(false);
    this.selectedInventoryCard.set(null);
  }

  rowKey(row: TableRow): string {
    return `${this.activeModule()}:${this.rowIdentity(row)}`;
  }

  private rowIdentity(row: TableRow): string {
    const explicitId = String(row["__rowId"] || "").trim();
    if (explicitId) return explicitId;

    const values = [
      row["clientId"],
      row["projectId"],
      row["__projectId"],
      row["vendorId"],
      row["supervisorId"],
      row["subcontractId"],
      row["project"],
      row["site"],
      row["materialName"],
      row["staffName"],
      row["labourTypes"],
      row["expenseDate"],
      row["paymentDate"],
      row["requestDate"],
      row["vendorName"],
      row["supervisorName"],
      row["subcontractorName"],
      row["reportName"],
      row["description"],
      row["amount"],
      row["phoneNumber"],
      row["gstNumber"],
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
    // Default behavior: toggle row in selection (additive).
    // User can hold Ctrl/Cmd/Shift to add without toggling.
    const wasSelected = this.selectedRowKeys().includes(key);
    let nextKeys: string[];
    if (event?.shiftKey) {
      // Range select from last primary to this row
      const visible = this.visibleRows().map((r) => this.rowKey(r));
      const lastKey = this.selectedRowKey();
      const startIdx = lastKey ? visible.indexOf(lastKey) : -1;
      const endIdx = visible.indexOf(key);
      if (startIdx >= 0 && endIdx >= 0) {
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        nextKeys = visible.slice(lo, hi + 1);
      } else {
        nextKeys = [key];
      }
    } else {
      // Toggle: if already selected and not adding, leave it; otherwise add
      const adding = event?.ctrlKey || event?.metaKey;
      if (adding) {
        nextKeys = wasSelected
          ? this.selectedRowKeys().filter((k) => k !== key)
          : [...this.selectedRowKeys(), key];
      } else {
        // Plain click on a non-selected row: add to selection (additive)
        if (wasSelected && this.selectedRowKey() === key) {
          // Plain click on the current primary → leave selection
          nextKeys = this.selectedRowKeys();
        } else if (wasSelected) {
          nextKeys = this.selectedRowKeys();
        } else {
          nextKeys = [...this.selectedRowKeys(), key];
        }
      }
    }
    this.selectedRowKeys.set(nextKeys);
    this.selectedRowKey.set(key);
    if (this.selectedRowKey() !== key || wasSelected === false) {
      this.editingRowKey.set("");
      this.editingRowKeys.set([]);
      this.openSelectKey.set("");
    }
    if (!nextKeys.length) this.selectedRowKey.set("");
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
    const rows = this.visibleRows();
    if (!rows.length) return false;
    const selected = new Set(this.selectedRowKeys());
    return rows.every((row) => selected.has(this.rowKey(row)));
  }

  toggleVisibleRowsSelection(event?: Event) {
    event?.stopPropagation();
    const rows = this.visibleRows();
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
    return this.visibleRows().filter((row) => selected.has(this.rowKey(row)));
  }

  editSelectedRows() {
    const rows = this.selectedRows();
    if (!rows.length) {
      this.openRecordDialog();
      return;
    }
    const keys = rows.map((row) => this.rowKey(row));
    // Sync single-key state with multi-key
    this.selectedRowKeys.set(keys);
    this.selectedRowKey.set(keys[0] ?? "");
    // Enable inline editing on ALL selected rows simultaneously.
    // The template uses [attr.contenteditable] bound to isRowEditing(row),
    // which checks editingRowKeys.includes(key). Setting it here makes every
    // selected cell editable in-place.
    this.editingRowKey.set(keys[0] ?? "");
    this.editingRowKeys.set(keys);
    // When exactly one row is selected we still open the standard dialog
    // (single-row create/edit flow). For 2+ rows we rely on inline editing.
    if (rows.length === 1) {
      this.openRecordEditDialog(keys[0]);
    }
    // For bulk: nothing else to open — the inline editors are now active.
  }

  async deleteSelectedRows() {
    const rows = this.selectedRows();
    if (!rows.length) return;
    const label = rows.length === 1 ? "this row" : `${rows.length} rows`;
    if (!window.confirm(`Delete ${label}? This will permanently delete them from the backend.`)) return;
    const module = this.activeModule();

    // Map of module → API delete function
    const apiDeleters: Record<string, ((id: string) => any) | null> = {
      clients: (id) => this.api.deleteClient(id),
      materials: (id) => this.api.deleteMaterial(id),
      labour: (id) => this.api.deleteLabour(id),
      expenses: (id) => this.api.deleteExpense(id),
      payments: (id) => this.api.deletePayment(id),
      vendors: (id) => this.api.deleteVendor(id),
      subcontractors: (id) => this.api.deleteSubcontractor(id),
    };

    // Map of module → localStorage key
    const localStorageKeys: Record<string, string> = {
      clients: "agb-erp:clients",
      materials: "agb-erp:materials",
      labour: "agb-erp:labour",
      expenses: "agb-erp:expenses",
      generalExpenses: "agb-erp:expenses",
      payments: "agb-erp:payments",
      vendors: "agb-erp:vendors",
      subcontractors: "agb-erp:subcontractors",
    };

    // Map of module → ID field used as business key in localStorage / UI
    const idFields: Record<string, string> = {
      clients: "id",
      materials: "id",
      labour: "id",
      expenses: "id",
      generalExpenses: "id",
      payments: "id",
      vendors: "id",
      subcontractors: "id",
    };

    const apiDelete = apiDeleters[module];
    const storageKey = localStorageKeys[module];
    const idField = idFields[module];
    const failed: string[] = [];
    let deleted = 0;

    for (const row of rows) {
      const mongoId = String(row["_id"] || "").trim();
      const bizId = String(row[idField] || "").trim();
      if (!mongoId && !bizId) {
        failed.push("(no id)");
        continue;
      }
      try {
        if (apiDelete && mongoId) {
          // Await backend delete using MongoDB _id (matches route param)
          await firstValueFrom(apiDelete(mongoId));
        }
        // Optimistic localStorage removal by business ID
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const arr = JSON.parse(raw);
            const filtered = arr.filter((r: any) => String(r[idField] || "") !== bizId);
            localStorage.setItem(storageKey, JSON.stringify(filtered));
          }
        } catch {}
        deleted++;
      } catch (e: any) {
        console.warn(`[Delete] Backend delete failed for ${bizId} (_id=${mongoId}):`, e?.error?.message || e?.message || e);
        failed.push(bizId);
      }
    }

    console.log(`[Delete] Removed ${deleted}/${rows.length} rows from ${module}`, failed.length ? `(failed: ${failed.join(", ")})` : "");

    if (failed.length) {
      this.backendSyncMessage.set(`Deleted ${deleted}, failed ${failed.length}: ${failed[0]}${failed.length > 1 ? "…" : ""}`);
      setTimeout(() => this.backendSyncMessage.set(null), 5000);
    }

    this.clearRowSelection();

    // Refresh from backend so the table re-renders without the deleted rows
    if (deleted > 0) {
      try { this.refreshFromBackend(); } catch {}
    }
  }

  /** Open edit dialog for a single row (used by editSelectedRows) */
  openRecordEditDialog(_key: string) {
    // For a single-row edit, open the standard record dialog.
    // The dialog is wired up to update the row on save.
    this.openRecordDialog();
  }

  /** Open bulk-edit dialog for multiple selected rows */
  openBulkEditDialog() {
    // Bulk editing is handled inline via contenteditable cells.
    // This method exists for future expansion (e.g., a modal for batch field updates).
    // Currently a no-op so callers don't break.
  }

  startRowEdit(row: TableRow, event?: Event) {
    event?.stopPropagation();
    const key = this.rowKey(row);
    this.selectedRowKey.set(key);
    this.selectedRowKeys.set([key]);
    this.editingRowKey.set(key);
    this.editingRowKeys.set([key]);
  }

  // ============ Backend sync (data source of truth) ============
  refreshFromBackend() {
    if (this.backendSyncing()) return;
    this.backendSyncing.set(true);
    this.backendSyncMessage.set("Refreshing from backend…");

    const siteFilter = this.activeSiteFilter();
    const siteParam = siteFilter !== "All" ? siteFilter : undefined;

    let done = 0;
    const total = 9;
    const finishOne = () => {
      done++;
      if (done >= total) {
        this.backendSyncing.set(false);
        this.backendSyncMessage.set(`Synced ${total} collections`);
        setTimeout(() => this.backendSyncMessage.set(null), 3000);
      }
    };

    // Clients: pipe through mapper so row.id (=clientId) is set
    this.api.listClients({ limit: 100 }).subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map(mapClient);
          localStorage.setItem("agb-erp:clients", JSON.stringify(items));
          this.data.clients.set(items);
        } catch {}
        finishOne();
      },
      error: finishOne,
    });
    // Projects: pipe through mapper
    this.api.listProjects({ limit: 100 }).subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map(mapProject);
          localStorage.setItem("agb-erp:projects", JSON.stringify(items));
          this.data.projects.set(items);
        } catch {}
        finishOne();
      },
      error: finishOne,
    });
    // Sites: pipe through mapper
    this.api.listSites().subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map(mapSite);
          localStorage.setItem("agb-erp:sites", JSON.stringify(items));
          this.data.siteEntities.set(items);
        } catch {}
        finishOne();
      },
      error: finishOne,
    });
    // Materials: pipe through mapper (sets id from materialId) — filter by site when selected
    this.api.listMaterials({ limit: 100, site: siteParam }).subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map(mapMaterial);
          localStorage.setItem("agb-erp:materials", JSON.stringify(items));
          this.data.materials.set(items);
        } catch {}
        finishOne();
      },
      error: finishOne,
    });
    // Labour: pipe through mapper — filter by site when selected
    this.api.listLabour({ limit: 100, site: siteParam }).subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map(mapLabour);
          localStorage.setItem("agb-erp:labour", JSON.stringify(items));
          this.data.labour.set(items);
        } catch {}
        finishOne();
      },
      error: finishOne,
    });
    // Expenses: pipe through mapper — filter by site when selected
    this.api.listExpenses({ limit: 100, site: siteParam }).subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map(mapExpense);
          localStorage.setItem("agb-erp:expenses", JSON.stringify(items));
          this.data.expenses.set(items);
        } catch {}
        finishOne();
      },
      error: finishOne,
    });
    // Payments: pipe through mapper
    this.api.listPayments({ limit: 100 }).subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map(mapPayment);
          localStorage.setItem("agb-erp:payments", JSON.stringify(items));
          this.data.payments.set(items);
        } catch {}
        finishOne();
      },
      error: finishOne,
    });
    // Vendors: pipe through mapper
    this.api.listVendors({ limit: 100 }).subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map(mapVendor);
          localStorage.setItem("agb-erp:vendors", JSON.stringify(items));
          this.data.vendors.set(items);
        } catch {}
        finishOne();
      },
      error: finishOne,
    });
    // Subcontractors: pipe through mapper — filter by site when selected
    this.api.listSubcontractors({ limit: 100, site: siteParam }).subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map(mapSubcontractor);
          localStorage.setItem("agb-erp:subcontractors", JSON.stringify(items));
          this.data.subcontractors.set(items);
        } catch {}
        finishOne();
      },
      error: finishOne,
    });
  }

  @HostListener("document:pointerdown", ["$event"])
  closeTransientTableUi(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (!target.closest(".selectable-data-row, .row-hover-toolbar, .table-actions, .universal-filter-bar, .filter-dialog, .date-filter-panel, .site-workbench")) {
      this.clearRowSelection();
    }

    if (!target.closest(".erp-select-menu, .filter-select-shell, .custom-select-entry, .filter-combo-field, .date-filter-panel")) {
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
    this.openFilterKey.set("");
    this.activeFilterValueKey.set("");
    this.selectCustomValue.set("");
  }

  columnsForActive(): FieldSchema[] {
    const base = this.activeConfig().columns;
    const custom = this.data.customFieldsFor(this.activeModule());
    const hidden = new Set(this.data.hiddenFieldsFor(this.activeModule()));
    const columns = this.activeModule() === "labour" ? this.withLabourWageColumns(base, custom) : this.data.composeTableColumns(base, custom);
    return columns.filter((column) => !hidden.has(column.key));
  }

  hiddenFieldCount(module: DashboardModule): number {
    return this.data.hiddenFieldsFor(module).length;
  }

  hideField(module: DashboardModule, key: string, event?: Event) {
    event?.stopPropagation();
    const label = this.columnsForActive().find((column) => column.key === key)?.label ?? key;
    if (!window.confirm(`Delete the "${label}" column from this table view?`)) return;
    this.data.hideTableField(module, key);
  }

  resetFields(module: DashboardModule) {
    this.data.resetTableFields(module);
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

visibleRows(): TableRow[] {
    const query = this.searchText().trim().toLowerCase();
    const filters = this.selectedFilters();
    const module = this.activeModule();
    const activeSite = this.activeSiteFilter();
    const dateKey = this.dateFilterKey(module);
    const range = this.dateRange();
    const siteOptions = this.universalSiteOptions();
    const activeSiteOption = siteOptions.find((o) => o.id === activeSite);
    const activeSiteName = activeSiteOption?.name ?? "";
    const rows = this.withComputedRows(module, this.rowsFor(module)).filter((row) => {
      const rowSiteName = String(row[this.siteFieldForModule(module)] || "").trim();
      const rowProjectId = String(row["projectId"] || row["__projectId"] || "").trim();
      let matchesSite =
        !this.isUniversalSiteAware(module) ||
        activeSite === "All" ||
        rowSiteName.toLowerCase() === activeSiteName.toLowerCase();
      if (this.isUniversalSiteAware(module) && activeSite !== "All" && rowProjectId && rowSiteName) {
        const project = this.data.projectById(rowProjectId);
        const projectSites = project?.sites ?? [];
        const siteIndex = projectSites.findIndex((s) => s.toLowerCase() === rowSiteName.toLowerCase());
        if (siteIndex >= 0) {
          // activeSite is now the display name (set in universalSiteOptions()).
          // Compare names directly so selection survives data refreshes.
          matchesSite = rowSiteName.toLowerCase() === activeSiteName.toLowerCase();
        }
      }
      const matchesSearch = !query || Object.values(row).some((value) => String(value).toLowerCase().includes(query));
      const matchesFilters = Object.entries(filters).every(
        ([key, value]) => !value || String(row[key] ?? "").toLowerCase().includes(value.trim().toLowerCase()),
      );
      const matchesDate =
        !dateKey ||
        (!range.start && !range.end) ||
        this.dateInRange(this.normalizedDateValue(row[dateKey]), range.start, range.end);
      return matchesSite && matchesSearch && matchesFilters && matchesDate;
    });
    return rows;
  }

  filterValues(key: string): string[] {
    const values = new Set<string>();
    for (const option of this.selectOptions(this.activeModule(), key)) {
      if (option) values.add(option);
    }
    for (const row of this.withComputedRows(this.activeModule(), this.rowsFor(this.activeModule()))) {
      const value = row[key];
      if (value !== undefined && value !== "") values.add(String(value));
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }

  isUniversalSiteAware(module: DashboardModule): boolean {
    return module === "materials" || module === "labour" || module === "expenses" || module === "subcontractors";
  }

  siteFieldForModule(module: DashboardModule): string {
    return "site";
  }

  universalSiteOptions(): { id: string; name: string }[] {
    // Dedupe by name so the chip selection stays stable even when the
    // underlying projects() / siteEntities() lists change. We use the
    // display name as both id and name so selectedSite name comparison
    // works in visibleRows() without needing a composite key.
    const raw = this.data.sites();
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    for (const r of raw) {
      const name = (r.name || r.id || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: name, name });
    }
    return out;
  }

  activeSiteFilter(): string {
    const site = this.activeSite();
    const options = this.universalSiteOptions();
    return site === "All" || options.some((o) => o.id === site) ? site : "All";
  }

  selectUniversalSite(siteId: string) {
    this.activeSite.set(siteId);
    localStorage.setItem("agb-erp:universal-active-site", siteId);
    this.closeDropdowns();
    this.clearRowSelection();
    this.refreshFromBackend();
  }

  isFilterMenuOpen(key: string): boolean {
    return this.openFilterKey() === key;
  }

  toggleFilterMenu(key: string) {
    this.openFilterKey.set(this.openFilterKey() === key ? "" : key);
  }

  expenseFilterBalanceVisible(): boolean {
    const filters = this.selectedFilters();
    return Boolean(filters["project"] && this.activeExpenseSiteFilter() !== "All");
  }

  activeExpenseSiteFilter(): string {
    return this.activeSiteFilter() !== "All" ? this.activeSiteFilter() : this.selectedFilters()["site"] || "All";
  }

  expenseFilterOpeningLabel(): string {
    const site = this.activeExpenseSiteFilter();
    const row = this.expenseChronologicalRows(this.visibleRows()).find((entry) => this.activeModule() === "expenses" && entry["project"] === this.selectedFilters()["project"] && entry["site"] === site);
    return row ? formatMoney(this.expenseOpeningBalanceFor(row, true, true)) : formatMoney(0);
  }

  expenseFilterCurrentLabel(): string {
    const site = this.activeExpenseSiteFilter();
    const rows = this.expenseChronologicalRows(this.visibleRows()).filter((entry) => entry["project"] === this.selectedFilters()["project"] && entry["site"] === site);
    const latest = rows.at(-1);
    return latest ? String(latest["runningBalance"] || formatMoney(0)) : formatMoney(0);
  }

  rowCountFor(module: DashboardModule): number {
    return this.rowsFor(module).length;
  }

  pendingApprovalRows(): TableRow[] {
    const modules: DashboardModule[] = ["materials", "labour", "expenses", "generalExpenses", "payments", "subcontractors"];
    return modules.flatMap((module) =>
      this.rowsFor(module)
        .filter((row) => this.isPendingApproval(row))
        .map((row) => ({ ...row, sourceModule: module, approvalField: row["approvalStatus"] !== undefined ? "approvalStatus" : "status" })),
    );
  }

  private isPendingApproval(row: TableRow): boolean {
    const value = String(row["approvalStatus"] || row["status"] || "").toLowerCase();
    return value === "pending";
  }

  selectedFilterCount(): number {
    return this.activeFieldFilterCount() + (this.hasDateFilter() ? 1 : 0) + (this.isUniversalSiteAware(this.activeModule()) && this.activeSiteFilter() !== "All" ? 1 : 0);
  }

  activeFieldFilterCount(): number {
    return Object.values(this.selectedFilters()).filter((value) => value.trim()).length;
  }

  isReadonlyColumn(key: string): boolean {
    return (
      key === "clientId" ||
      key === "vendorId" ||
      key === "supervisorId" ||
      key === "subcontractId" ||
      key === "projectCount" ||
      key === "activeSites" ||
      key === "totalValue" ||
      key === "amountReceived" ||
      key === "pendingBalance" ||
      key === "runningBalance" ||
      key === "weeklyPayable" ||
      key === "weeklyPay" ||
      key === "staffCount" ||
      key === "balance"
    );
  }

  /**
   * Display value for a cell. Currently maps the stored "Cash Added"
   * transaction type to the user-facing "Add Cash" label. The raw value
   * is preserved on the row so it can be sent back to the backend.
   */
  displayCell(row: TableRow, key: string): string {
    const raw = row[key];
    if (key === "transactionType" && raw === "Cash Added") return "Add Cash";
    return raw == null ? "" : String(raw);
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
    this.searchText.set("");
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
    this.activeSite.set("All");
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
    return this.columnsForActive();
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
    return Boolean(this.dateFilterKey(this.activeModule()));
  }

  activeFilterSummary(): string[] {
    const summary: string[] = [];
    if (this.isUniversalSiteAware(this.activeModule()) && this.activeSiteFilter() !== "All") summary.push(`Site: ${this.activeSiteFilter()}`);
    for (const column of this.selectedFilterColumns()) {
      const value = this.selectedFilters()[column.key];
      if (value) summary.push(`${column.label}: ${value}`);
    }
    if (this.dateRangeLabel()) summary.push(`Date: ${this.dateRangeLabel()}`);
    return summary;
  }

  private dateFilterKey(module: DashboardModule): string {
    if (module === "materials") return "requestDate";
    if (module === "labour") return "attendanceDate";
    if (module === "expenses" || module === "generalExpenses") return "expenseDate";
    if (module === "payments") return "paymentDate";
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

  openRecordDialog() {
    if (this.activeModule() === "vendors") {
      this.editingInlineVendor.set(null);
      this.showVendorDialog.set(true);
      return;
    }
    const row: TableRow = { ...this.defaultRowFor(this.activeModule()) };
    this.draftRow.set(row);
    for (const column of this.recordFormColumns()) {
      const options = this.selectOptions(this.activeModule(), column.key);
      row[column.key] = row[column.key] || options[0] || "";
    }
    this.draftRow.set(row);
    this.recordDialogOpen.set(true);
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
    const cashAddedFields = new Set(["expenseDate", "transactionType", "description", "amount", "site", "supervisor"]);
    return this.columnsForActive().filter((column) => {
      if (this.activeModule() === "expenses" && hiddenInExpenseForm.has(column.key)) return false;
      const isCashAdded = this.normalizedExpenseTransactionType(String(this.draftRow()["transactionType"] || "Add Cash")) === "Add Cash";
      if (this.activeModule() === "expenses" && isCashAdded && !cashAddedFields.has(column.key)) return false;
      if (
        this.activeModule() === "expenses" &&
        column.key === "siteMaterial" &&
        this.normalizedExpenseTransactionType(String(this.draftRow()["transactionType"] || "Add Cash")) !== "Purchase"
      ) {
        return false;
      }
      if (
        this.activeModule() === "expenses" &&
        (column.key === "materialName" || column.key === "unit" || column.key === "requestedQuantity" || column.key === "approvedQuantity" || column.key === "vendor")
      ) {
        return false;
      }
      return !this.isReadonlyColumn(column.key);
    });
  }

  addInlineRow(event?: MouseEvent) {
    this.positionRowToolbar(event);
    const module = this.activeModule();
    if (module === "clients") {
      const client = this.data.addClient({ name: "New Client", mobile: "", address: "", supervisor: "Unassigned" });
      const key = `${module}:client:${client.id}`;
      this.selectedRowKey.set(key);
      this.selectedRowKeys.set([key]);
      this.editingRowKey.set(key);
      this.editingRowKeys.set([key]);
      return;
    }
    if (module === "vendors") {
      this.editingInlineVendor.set(null);
      this.showVendorDialog.set(true);
      return;
    }
    const row = this.data.addCustomRow(module, this.defaultRowFor(module));
    const key = `${module}:${row["__rowId"]}`;
    this.selectedRowKey.set(key);
    this.selectedRowKeys.set([key]);
    this.editingRowKey.set(key);
    this.editingRowKeys.set([key]);
  }

  updateDraftField(key: string, value: string) {
    this.draftRow.update((row) => {
      const next = { ...row, [key]: value };
      if (this.activeModule() === "expenses") {
        const transactionType = this.normalizedExpenseTransactionType(String(key === "transactionType" ? value : next["transactionType"] || "Purchase"));
        next["transactionType"] = transactionType;
        if (transactionType !== "Purchase") {
          next["siteMaterial"] = "No";
          for (const field of siteMaterialDetailFields) delete next[field.key];
        }
        if ((key === "siteMaterial" || next["siteMaterial"] === "Yes") && transactionType === "Purchase" && this.normalizeYesNo(next["siteMaterial"]) === "Yes") {
          const requestedQuantity = String(next["requestedQuantity"] || "1");
          const unit = String(next["unit"] || "Item");
          next["requestDate"] = next["requestDate"] || next["expenseDate"] || new Date().toISOString().slice(0, 10);
          next["materialName"] = next["materialName"] || next["description"] || "Site material purchase";
          next["unit"] = unit;
          next["requestedQuantity"] = requestedQuantity;
          next["remainingStock"] = next["remainingStock"] || `${requestedQuantity} ${unit}`.trim();
        }
        if ((key === "requestedQuantity" || key === "unit") && this.normalizeYesNo(next["siteMaterial"]) === "Yes") {
          next["remainingStock"] = `${next["requestedQuantity"] || "1"} ${next["unit"] || "Item"}`.trim();
        }
      }
      return next;
    });
  }

  showSiteMaterialDetails(): boolean {
    if (this.activeModule() !== "expenses") return false;
    const row = this.draftRow();
    return this.normalizedExpenseTransactionType(String(row["transactionType"] || "")) === "Purchase" && this.normalizeYesNo(row["siteMaterial"]) === "Yes";
  }

  formColumnLabel(column: FieldSchema): string {
    return this.activeModule() === "expenses" && column.key === "amount" ? "Total Amount" : column.label;
  }

  async saveRecord(event: Event) {
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
      const preparedRow = this.withGeneratedReferences(module === "expenses" ? this.normalizedExpenseInputRow(row) : row);
      if (module === "expenses") this.ensureExpenseOpeningForInput(preparedRow);

      const isCashAdded = module === "expenses" && preparedRow["transactionType"] === "Add Cash";

      if (isCashAdded) {
        const projectId = String(preparedRow["projectId"] || preparedRow["__projectId"] || "");
        const site = String(preparedRow["site"] || "");
        const date = String(preparedRow["expenseDate"] || new Date().toISOString().slice(0, 10));
        const description = String(preparedRow["description"] || "Add Cash");
        const amount = Math.abs(Number(preparedRow["amount"]) || 0);

        if (!projectId) {
          console.warn("[UniversalDashboard] Cannot save Add Cash: no project selected");
          return;
        }

        try {
          const result = await new Promise<{ expense: any }>((resolve, reject) => {
            this.api.createExpense({
              type: "site",
              projectId,
              siteId: undefined,
              site: site || undefined,
              transactionType: "Cash Added",
              amount,
              date,
              description,
              submittedBy: "admin",
            }).subscribe({ next: resolve, error: reject });
          });

          const apiExpense = result.expense;
          const savedRow = this.data.addCustomRow(module, {
            ...preparedRow,
            __rowId: `expense:${apiExpense._id}`,
            __projectId: projectId,
            projectId,
            expenseScope: "Site",
            runningBalance: apiExpense.runningBalance,
            id: apiExpense.expenseId,
            status: "Approved",
          });
          this.recordDialogOpen.set(false);
          return;
        } catch (err) {
          console.error("[UniversalDashboard] Failed to create Add Cash expense", err);
          return;
        }
      }

      const savedRow = this.data.addCustomRow(module, preparedRow);
      if (module === "expenses") this.createMaterialFromSiteExpense(savedRow);
    }
    this.recordDialogOpen.set(false);
  }

  private withGeneratedReferences(row: TableRow): TableRow {
    const projectId = String(row["projectId"] || row["__projectId"] || "").trim();
    const project = projectId ? this.data.projectById(projectId) : undefined;
    const client = project
      ? this.data.clients().find((entry) => entry.projectIds.includes(project.id) || entry.name === project.client)
      : this.data.clients().find((entry) => entry.name === row["client"] || entry.name === row["clientName"]);
    return {
      ...row,
      ...(project ? { projectId: project.id, project: project.name, __projectId: project.id, client: project.client } : {}),
      ...(client ? { clientId: client.id } : {}),
    };
  }

  private createMaterialFromSiteExpense(row: TableRow) {
    const isSiteMaterial = String(row["siteMaterial"] || "").trim().toLowerCase() === "yes";
    if (!isSiteMaterial) return;
    const sourceExpenseRowId = String(row["__rowId"] || "");
    if (!sourceExpenseRowId) return;
    const project =
      this.data.projectById(String(row["projectId"] || row["__projectId"] || "")) ??
      this.data.projects().find((projectRow) => projectRow.name === row["project"] || projectRow.id === row["project"]);
    if (!project) return;
    const existing = this.rowsFor("materials").some((entry) => String(entry["sourceExpenseRowId"] || "") === sourceExpenseRowId);
    if (existing) return;
    const client = this.data.clients().find((entry) => entry.projectIds.includes(project.id) || entry.name === project.client);
    const requestedQuantity = String(row["requestedQuantity"] || "1");
    const unit = String(row["unit"] || "Item");
    this.data.addCustomRow("materials", {
      __projectId: project.id,
      projectId: project.id,
      clientId: client?.id ?? "",
      client: project.client,
      project: project.name,
      site: row["site"] || project.sites[0] || "",
      materialName: row["materialName"] || row["description"] || "Site material purchase",
      unit,
      requestedQuantity,
      approvedQuantity: row["approvedQuantity"] || "",
      requestDate: row["requestDate"] || row["expenseDate"] || new Date().toISOString().slice(0, 10),
      vendor: row["vendor"] || "",
      poNumber: row["reference"] || "",
      remainingStock: row["remainingStock"] || `${requestedQuantity} ${unit}`.trim(),
      status: row["approvalStatus"] || "Pending",
      sourceExpenseRowId,
    });
  }

  openFieldDialog(afterKey?: string, event?: Event) {
    event?.stopPropagation();
    this.newFieldLabel.set("");
    this.newFieldAfterKey.set(afterKey ?? null);
    this.newFieldType.set("text");
    this.newFieldAskSupervisor.set(true);
    this.fieldDialogOpen.set(true);
  }

  async saveField(event: Event) {
    event.preventDefault();
    const label = this.newFieldLabel().trim();
    if (!label) return;
    if (this.isGeneratedClientIdField(label)) {
      window.alert("Client ID is generated automatically and cannot be created manually.");
      return;
    }
    const module = this.activeModule();
    const fieldType = this.newFieldType();
    const askSupervisor = this.newFieldAskSupervisor();
    this.data.addCustomFieldAfter(module, label, this.newFieldAfterKey(), this.columnsForActive());
    if (askSupervisor) {
      const siteId = this.resolveEntityIdForModule(module);
      if (siteId) {
        try {
          await this.data.persistCustomField(module, label, siteId, fieldType, askSupervisor);
        } catch (err) {
          console.warn("[UniversalDashboard] failed to persist custom field", err);
        }
      } else {
        window.alert("Select a specific site first to enable supervisor input for this field.");
      }
    }
    this.newFieldAfterKey.set(null);
    this.fieldDialogOpen.set(false);
  }

  private resolveEntityIdForModule(module: SharedModuleKey): string | null {
    const activeSite = this.activeSiteFilter();
    if (activeSite && activeSite !== "All") return activeSite;
    const sites = this.data.sites();
    return sites[0]?.id ?? null;
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
    return this.columnsForActive().find((column) => column.key === afterKey)?.label ?? "";
  }

  updateCell(visibleIndex: number, key: string, value: string) {
    if (this.isReadonlyColumn(key)) return;
    const target = this.visibleRows()[visibleIndex];
    if (!target) return;
    this.updateRowCell(target, key, value);
  }

  updateRowCell(row: TableRow, key: string, value: string) {
    if (this.isReadonlyColumn(key)) return;
    const module = this.activeModule();
    const trimmedValue = value.trim();

    if (module === "clients") {
      this.updateClientCell(row, key, trimmedValue);
      // Also call backend PATCH for clients
      this.patchClientRow(row, key, trimmedValue);
    }

    const rowId = String(row["__rowId"] || "");
    if (!rowId) return;
    if (module === "expenses" && key === "amount") {
      this.data.updateSharedRowCell(rowId, key, this.positiveExpenseAmountValue(trimmedValue));
      return;
    }
    this.data.updateSharedRowCell(rowId, key, trimmedValue);
    if (module === "labour" && key === "labourTypes") this.data.updateSharedRowCell(rowId, "notes", trimmedValue);
    if (module === "expenses" && key === "siteMaterial") this.createMaterialFromSiteExpense({ ...row, [key]: trimmedValue });

    // Persist the change to the backend + localStorage for the relevant module.
    this.persistRowEditToBackend(module, row, key, trimmedValue);
  }

  /** Map a UI column key → backend field name + persist via PATCH. */
  private persistRowEditToBackend(module: string, row: TableRow, columnKey: string, value: string) {
    // localStorage keys by module
    const storageKey: Record<string, string> = {
      materials: "agb-erp:materials",
      labour: "agb-erp:labour",
      expenses: "agb-erp:expenses",
      generalExpenses: "agb-erp:expenses",
      payments: "agb-erp:payments",
      vendors: "agb-erp:vendors",
      subcontractors: "agb-erp:subcontractors",
    };

    // Map of UI key → backend field per module. Most map 1:1 with columnKey.
    const backendPayload: Record<string, unknown> = { [columnKey]: value };

    // For labour, labour types are nested → send notes/partyName depending on column.
    // For now, send the raw value; backend accepts most fields as-is.
    const mongoId = String(row["_id"] || "").trim();
    const bizId = String(row["id"] || row["clientId"] || row["materialId"] || row["labourId"] || row["expenseId"] || row["paymentId"] || row["vendorId"] || row["subcontractId"] || "").trim();
    if (!bizId) return;
    const storageKeyForModule = storageKey[module];
    if (!storageKeyForModule) return;

    // Optimistic localStorage update
    try {
      const raw = localStorage.getItem(storageKeyForModule);
      if (raw) {
        const arr = JSON.parse(raw);
        const updated = arr.map((r: any) =>
          String(r["id"] || "") === bizId ? { ...r, [columnKey]: value, ...(module === "labour" && columnKey === "labourTypes" ? { notes: value } : {}) } : r
        );
        localStorage.setItem(storageKeyForModule, JSON.stringify(updated));
      }
    } catch {}

    // Background backend PATCH — must use MongoDB _id, not business id
    const apiCall = (() => {
      if (!mongoId) return null;
      switch (module) {
        case "materials": return this.api["patchMaterial"]?.(mongoId, backendPayload) || null;
        case "labour":    return this.api["patchLabour"]?.(mongoId, backendPayload) || null;
        case "expenses":  return this.api["patchExpense"]?.(mongoId, backendPayload) || null;
        case "generalExpenses": return this.api["patchExpense"]?.(mongoId, backendPayload) || null;
        case "payments":  return this.api["patchPayment"]?.(mongoId, backendPayload) || null;
        case "vendors":   return this.api["patchVendor"]?.(mongoId, backendPayload) || null;
        case "subcontractors": return this.api["patchSubcontractor"]?.(mongoId, backendPayload) || null;
        default: return null;
      }
    })();
    if (apiCall && typeof apiCall.subscribe === "function") {
      apiCall.subscribe({
        next: () => {},
        error: (err: any) => console.warn(`[Patch] ${module}/${bizId} (${mongoId}) ${columnKey}=${value}:`, err?.error?.message || err?.message || err),
      });
    }
  }

  /** Patch a single client field via the backend + local ErpDataService. */
  private patchClientRow(row: TableRow, columnKey: string, value: string) {
    const mongoId = String(row["_id"] || "").trim();
    const bizId = String(row["id"] || row["clientId"] || "").trim();
    if (!bizId) return;
    // Map UI key → backend payload
    const keyMap: Record<string, string> = {
      clientName: "name",
      mobile: "mobile",
      address: "address",
      supervisor: "supervisor",
      status: "status",
    };
    const backendKey = keyMap[columnKey] || columnKey;
    const payload: Record<string, unknown> = { [backendKey]: value };

    // Persist locally
    try {
      const raw = localStorage.getItem("agb-erp:clients");
      if (raw) {
        const arr = JSON.parse(raw);
        const updated = arr.map((c: any) =>
          String(c["id"] || c["clientId"] || "") === bizId ? { ...c, [columnKey]: value, [backendKey]: value } : c
        );
        localStorage.setItem("agb-erp:clients", JSON.stringify(updated));
      }
    } catch {}

    // Backend PATCH — use MongoDB _id
    if (mongoId && this.api["patchClient"]) {
      this.api["patchClient"](mongoId, payload).subscribe({
        next: () => {},
        error: (err: any) => console.warn(`[PatchClient] ${bizId} (${mongoId}) ${columnKey}=${value}:`, err?.error?.message || err?.message || err),
      });
    }
  }

  selectCellKey(row: TableRow, key: string): string {
    return `${row["__rowId"] || row["clientId"] || "row"}:${key}`;
  }

  isSelectMenuOpen(row: TableRow, key: string): boolean {
    return this.openSelectKey() === this.selectCellKey(row, key);
  }

  toggleSelectMenu(row: TableRow, key: string) {
    const nextKey = this.selectCellKey(row, key);
    this.openSelectKey.set(this.openSelectKey() === nextKey ? "" : nextKey);
    this.selectCustomValue.set("");
  }

  selectCellOptionForRow(row: TableRow, key: string, value: string) {
    this.updateRowCell(row, key, value);
    this.openSelectKey.set("");
    this.selectCustomValue.set("");
  }

  saveCustomSelectOptionForRow(row: TableRow, key: string, value: string, event?: Event) {
    event?.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    this.selectCellOptionForRow(row, key, trimmedValue);
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
    const row = this.rowsFor("labour").find((entry) => String(entry["__rowId"] || "") === rowId);
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
    return this.rowsFor("labour").find((entry) => String(entry["__rowId"] || "") === rowId);
  }

  removeLabourType(row: TableRow, labourType: string, event?: Event) {
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
  }

  deleteRow(row: TableRow) {
    const key = this.rowKey(row);
    const module = this.activeModule();
    const rowId = String(row["__rowId"] || "");
    if (module === "clients") {
      this.data.deleteClient(String(row["clientId"] || ""));
      this.selectedRowKeys.update((keys) => keys.filter((item) => item !== key));
      if (this.selectedRowKey() === key) this.selectedRowKey.set("");
      if (this.editingRowKey() === key) this.editingRowKey.set("");
      this.editingRowKeys.update((keys) => keys.filter((item) => item !== key));
      return;
    }
    this.data.deleteSharedRow(rowId);
    this.selectedRowKeys.update((keys) => keys.filter((item) => item !== key));
    if (this.selectedRowKey() === key) this.selectedRowKey.set("");
    if (this.editingRowKey() === key) this.editingRowKey.set("");
    this.editingRowKeys.update((keys) => keys.filter((item) => item !== key));
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
    const sourceRows = this.visibleRows();
    const rows = this.reportRows(module, sourceRows);
    const summary = module === "labour" ? this.labourSummaryHtml(rows) : module === "expenses" ? this.expenseSummaryHtml(sourceRows) : "";
    this.openPrintableReport({
      title: module === "labour" ? "Labour Attendance Report" : module === "expenses" ? "Expense Ledger Report" : this.activeConfig().title,
      subtitle: "Annai Golden Builders - Universal Dashboard",
      columns,
      rows,
      summary,
    });
  }

  downloadReportRow(row: TableRow) {
    const columns = this.columnsForModule("reports");
    this.openPrintableReport({
      title: String(row["reportName"] || "Dashboard Report"),
      subtitle: `Annai Golden Builders - ${String(row["scope"] || "Universal Dashboard")}`,
      columns,
      rows: [row],
      summary: `<section class="summary"><h2>Report Details</h2><div><strong>Owner</strong><span>${this.escapeHtml(String(row["owner"] || "-"))}</span></div><div><strong>Format</strong><span>${this.escapeHtml(String(row["exportFormat"] || "PDF / Excel"))}</span></div></section>`,
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
      project: projectName(row.projectId),
      site: row.site,
      attendanceDate: "2026-06-05",
      staffName: row.party,
      dailyWage: row.dailyWage,
      labourTypes: this.labourTypesFromRow(row),
      staffCount: row.presentCount,
      attendance: "Present",
      shift: this.normalizeShift(row.shift),
      overtime: `${row.overtime} hrs`,
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
      transactionType: row.transactionType || "Site Expense",
      description: row.description,
      amount: formatMoney(-row.spent),
      siteMaterial: row.isSiteMaterial ? "Yes" : "No",
      runningBalance: formatMoney(0),
      supervisor: row.supervisor,
      cashIssued: formatMoney(row.cashIssued || row.received || 0),
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
      ["Financial", "Payment Collection Report", "All projects", "Accountant", "Excel"],
      ["Financial", "Expense Report", "All sites", "Admin", "Excel"],
      ["Labour", "Attendance Report", "All labour", "Project Manager", "Excel"],
      ["Material", "Inventory Report", "All materials", "Project Manager", "Excel"],
      ["Vendor", "Vendor Purchase Report", "All vendors", "Admin", "Excel"],
      ["Subcontract", "Subcontractor Ledger", "All subcontractors", "Project Manager", "Excel"],
      ["Project", "Project Summary", "All clients", "Admin", "Excel"],
    ].map(([category, reportName, scope, owner, exportFormat], index) => ({
      __rowId: `report:${index}`,
      category,
      reportName,
      scope,
      owner,
      exportFormat,
    }));

return { materials, clients, labour, expenses, generalExpenses, payments, vendors, subcontractors, inventory: [], reports };
  }

  private rowsFor(module: DashboardModule): TableRow[] {
    if (module === "inventory") {
      return this.inventoryCards().map((card) => ({
        materialName: card.materialName,
        totalQty: card.totalQty,
        unit: card.unit,
        siteCount: card.siteCount,
        lastUpdated: card.lastUpdated,
      })) as TableRow[];
    }
    return this.data.tableRowsFor(module, this.dashboardRows()[module]);
  }

  selectOptions(module: DashboardModule, key: string): string[] {
    if (key === "site" || key === "assignedSite") return this.siteOptionsForModule(module);
    if (key === "vendor" || key === "vendorName") return this.vendorNameOptions();
    if (key === "project") return this.projectNameOptions();
    if (key === "projectId") return this.projectIdOptions();
    if (key === "client" || key === "clientName") return this.clientNameOptions();
    if (key === "address") return this.clientAddressOptions();
    if (key === "supervisor" || key === "supervisorName" || key === "collectedBy" || key === "paidBy") return this.supervisorNameOptions();
    if (module === "labour" && key === "staffName") return this.staffNameOptions();
    if (module === "materials" && key === "materialName") return this.materialNameOptions();
    if (module === "materials" && key === "unit") return ["Bag", "Nos", "Kg", "Load", "Piece", "Item"];
    if (module === "expenses" && key === "transactionType") {
      return ["Purchase", "Add Cash"];
    }
    if (module === "expenses" && key === "siteMaterial") return ["No", "Yes"];
    if (module === "labour" && key === "attendance") return ["Present", "Absent"];
    if (key === "approvalStatus") return ["Pending", "Approved", "Declined"];
    if (key === "status") {
      if (module === "clients") return ["Active", "On Hold", "Completed"];
      if (module === "reports") return ["Ready", "Scheduled", "Archived"];
      return ["Pending", "Approved", "Declined"];
    }
    if (key === "paymentMode") return ["Cash", "NEFT", "UPI", "Bank Transfer", "Cheque"];
    if (key === "paymentStatus") return ["Not Started", "Part Paid", "Paid"];
    return [];
  }

  allowsCustomOption(module: DashboardModule, key: string): boolean {
    if (key === "site" || key === "siteMaterial" || key === "transactionType" || key === "approvalStatus" || key === "status" || key === "paymentStatus" || key === "attendance") return false;
    return this.selectOptions(module, key).length > 0;
  }

  selectOptionIcon(option: string): "approve" | "decline" | "" {
    const normalized = option.toLowerCase();
    if (normalized === "approve" || normalized === "approved" || normalized === "active" || normalized === "ready") return "approve";
    if (normalized === "decline" || normalized === "declined" || normalized === "rejected" || normalized === "inactive") return "decline";
    return "";
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
        transactionType: "Add Cash",
        description: "",
        amount: "0",
        siteMaterial: "No",
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
        scope: "",
        owner: "",
        exportFormat: "PDF / Excel",
      },
    };
    return defaults[module];
  }

  private withComputedRows(module: DashboardModule, rows: TableRow[]): TableRow[] {
    const normalizedRows = rows.map((row) => this.withNormalizedApprovalStatus(row));
    if (module === "expenses") return this.withExpenseBalances(normalizedRows);
    if (module === "labour") return normalizedRows.map((row) => this.withLabourPayable(row));
    if (module === "subcontractors") {
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
      const transactionType = this.normalizedExpenseTransactionType(String(row["transactionType"] || "Purchase"));
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
      notes: labourTypes || row["notes"] || "",
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
      normalized.includes("add cash") ||
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

  private projectNameOptions(): string[] {
    return this.sortedUnique(this.data.projects().map((project) => project.name));
  }

  private projectIdOptions(): string[] {
    return this.sortedUnique(this.data.projects().map((project) => project.id));
  }

  private clientNameOptions(): string[] {
    return this.sortedUnique(this.data.clients().map((client) => client.name));
  }

  private clientAddressOptions(): string[] {
    return this.sortedUnique(this.data.clients().map((client) => client.address));
  }

  private supervisorNameOptions(): string[] {
    return this.sortedUnique([
      ...this.data.supervisors().map((supervisor) => supervisor.name),
      ...this.data.clients().map((client) => client.supervisor),
      ...this.data.projects().map((project) => project.supervisor),
    ]);
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

  private sortedUnique(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  private materialPurchaseSummaryForVendor(vendorName: string): string {
    const rows = this.materialsService.materials().filter((row) => (row.vendor || "").toLowerCase() === vendorName.toLowerCase());
    const purchased = rows.reduce((sum, row) => sum + row.purchased, 0);
    return rows.length ? `${formatNumber(rows.length)} records / ${formatNumber(purchased)} purchased` : "0 records";
  }

  private vendorNameOptions(): string[] {
    return this.sortedUnique([
      ...this.data.vendors().map((vendor) => vendor.name),
      ...this.materialsService.materials().map((material) => material.vendor),
      ...this.rowsFor("materials").map((row) => String(row["vendor"] || "")),
    ]);
  }

  private materialNameOptions(): string[] {
    return this.sortedUnique([
      ...this.materialsService.materials().map((material) => material.name),
      ...this.rowsFor("materials").map((row) => String(row["materialName"] || row["name"] || "")),
    ]);
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
    return existing ?? this.data.addCustomField("labour", label, this.columnsForModule("labour"));
  }

  private columnsForModule(module: DashboardModule): FieldSchema[] {
    const base = dashboardModules.find((config) => config.key === module)?.columns ?? [];
    return this.data.composeTableColumns(base, this.data.customFieldsFor(module));
  }

  private titleCase(value: string): string {
    return value
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  private expenseGroupKey(row: TableRow): string {
    const projectId = String(row["projectId"] || row["__projectId"] || row["project"] || "project");
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
    const explicitProjectId = String(row["projectId"] || row["__projectId"] || "");
    const site = String(row["site"] || "Project");
    const project =
      this.data.projectById(explicitProjectId) ??
      this.data.projects().find((projectRow) => projectRow.name === row["project"] || projectRow.id === row["project"]);
    const projectId = explicitProjectId || project?.id || "";
    const savedOpening = projectId ? this.data.expenseOpeningBalanceFor(projectId, site) : undefined;
    if (savedOpening !== undefined) return savedOpening;
    const explicitOpening = this.explicitExpenseOpeningForGroup(projectId, String(row["project"] || ""), String(row["site"] || ""));
    if (explicitOpening) return explicitOpening;
    const issuedOpening = this.expenseCashIssuedOpeningForGroup(projectId, String(row["project"] || ""), String(row["site"] || ""));
    if (issuedOpening) return issuedOpening;
    if (!allowProjectFallback || (!allowAnySiteFallback && !this.isPrimaryExpenseSite(project, site))) return 0;
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
    return this.isExpenseCredit(value) ? "Add Cash" : "Purchase";
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

  isNoCreateModule(): boolean {
    const m = this.activeModule();
    return m === "expenses" || m === "materials" || m === "generalExpenses" || m === "inventory";
  }

  private ensureExpenseOpeningForInput(row: TableRow) {
    const project =
      this.data.projectById(String(row["projectId"] || row["__projectId"] || "")) ??
      this.data.projects().find((projectRow) => projectRow.name === row["project"] || projectRow.id === row["project"]);
    const site = String(row["site"] || project?.sites[0] || "").trim();
    if (!project?.id || !site || this.data.expenseOpeningBalanceFor(project.id, site) !== undefined) return;
    this.data.setExpenseOpeningBalance(project.id, site, project.expenseBalance ?? 0);
  }

  private explicitExpenseOpeningForGroup(projectId: string, projectName: string, site: string): number {
    const normalizedSite = site.trim().toLowerCase();
    if (!normalizedSite) return 0;
    const rows = this.rowsFor("expenses");
    const cashAddedRows = rows.filter((row) => {
      const rowProjectId = String(row["projectId"] || row["__projectId"] || "");
      const rowProjectName = String(row["project"] || "");
      const rowSite = String(row["site"] || "").trim().toLowerCase();
      const sameProject = projectId ? rowProjectId === projectId : rowProjectName === projectName;
      return sameProject && rowSite === normalizedSite &&
        this.normalizedExpenseTransactionType(String(row["transactionType"] || "")) === "Add Cash";
    });
    if (cashAddedRows.length === 0) return 0;
    const earliest = cashAddedRows.reduce((prev, curr) =>
      this.expenseRowSortValue(prev) < this.expenseRowSortValue(curr) ? prev : curr
    );
    return Math.abs(this.moneyNumber(earliest["amount"]));
  }

  private expenseCashIssuedOpeningForGroup(projectId: string, projectName: string, site: string): number {
    const normalizedSite = site.trim().toLowerCase();
    if (!normalizedSite || normalizedSite === "all") return 0;
    const rows = this.rowsFor("expenses")
      .filter((row) => {
        const rowProjectId = String(row["projectId"] || row["__projectId"] || "");
        const rowProjectName = String(row["project"] || "");
        const rowSite = String(row["site"] || "").trim().toLowerCase();
        const sameProject = projectId ? rowProjectId === projectId : rowProjectName === projectName;
        return sameProject && rowSite === normalizedSite;
      });
    const cashAddedRows = rows.filter((row) =>
      this.normalizedExpenseTransactionType(String(row["transactionType"] || "")) === "Add Cash"
    );
    return cashAddedRows.reduce((sum, row) => sum + Math.abs(this.moneyNumber(row["amount"])), 0);
  }

  private isPrimaryExpenseSite(project: { sites: string[] } | undefined, site: string): boolean {
    const normalizedSite = site.trim().toLowerCase();
    const primarySite = String(project?.sites[0] || "").trim().toLowerCase();
    return !normalizedSite || normalizedSite === "project" || (!!primarySite && normalizedSite === primarySite);
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
    return this.columnsForActive();
  }

  private reportRows(module: DashboardModule, rows: TableRow[]): TableRow[] {
    if (module === "expenses") {
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
    if (module !== "labour") return rows;
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
    const projectId = String(row["projectId"] || row["__projectId"] || "");
    const options = new Set<string>();
    for (const entry of this.rowsFor("labour")) {
      if (projectId && String(entry["projectId"] || entry["__projectId"] || "") !== projectId) continue;
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
    const projectId = String(row["projectId"] || row["__projectId"] || "");
    const wageField = this.data.customFieldsFor("labour").find((field) => field.label.toLowerCase() === `${this.titleCase(labourType)} daily wage`.toLowerCase());
    for (const candidate of this.rowsFor("labour")) {
      if (String(candidate["__rowId"] || "") === rowId) continue;
      if (projectId && String(candidate["projectId"] || candidate["__projectId"] || "") !== projectId) continue;
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
      if (!openingByGroup.has(key)) {
        openingByGroup.set(key, this.expenseOpeningBalanceFor(row, true, true));
      }
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
