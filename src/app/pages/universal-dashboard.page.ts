import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from "@angular/core";
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
    description: "Every staff attendance row across sites with labour types, staff count, shift, overtime, and fine.",
    columns: [
      { key: "client", label: "Client" },
      { key: "clientId", label: "Client ID" },
      { key: "projectId", label: "Project ID" },
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
    ],
    filters: [
      { key: "category", label: "Category" },
      { key: "owner", label: "Owner" },
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
          [blurred]="recordDialogOpen() || fieldDialogOpen() || labourTypeDialogOpen()"
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
                <div><span>Active Projects</span><strong>{{ activeProjectsCount() }}</strong></div>
                <div><span>Projects On Hold</span><strong>{{ projectsOnHoldCount() }}</strong></div>
                <div><span>Completed Projects</span><strong>{{ completedProjectsCount() }}</strong></div>
                <div><span>Pending Approval</span><strong>{{ pendingApprovalCount() }}</strong></div>
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
                  <button
                    type="button"
                    class="primary-table-action add-row-action"
                    [title]="selectedRowCount() ? 'Edit selected row' : 'Add row'"
                    [attr.aria-label]="selectedRowCount() ? 'Edit selected row' : 'Add row'"
                    (click)="selectedRowCount() ? editSelectedRows() : openRecordDialog()"
                  >
                    <ion-icon [name]="selectedRowCount() ? 'create-outline' : 'add-outline'"></ion-icon>
                    {{ selectedRowCount() ? 'Edit Row' : 'Add Row' }}
                  </button>
                  <button
                    *ngIf="selectedRowCount()"
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
                  <button type="button" (click)="openFieldDialog()">Add Field</button>
                  <button type="button" (click)="exportPdf()"><ion-icon name="document-text-outline"></ion-icon>PDF Report</button>
                  <button type="button" (click)="exportExcel()"><ion-icon name="download-outline"></ion-icon>Export Excel</button>
                </div>
              </div>

              <div class="universal-filter-bar">
                <label *ngFor="let filter of activeConfig().filters" class="filter-select-shell">
                  <span>{{ filter.label }}</span>
                  <div class="erp-select-menu filter-select-menu" [class.open]="isFilterMenuOpen(filter.key)">
                    <button type="button" class="erp-select-trigger" (click)="toggleFilterMenu(filter.key)">
                      <span>{{ selectedFilters()[filter.key] || 'All' }}</span>
                      <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                        <path d="M5.5 7.5 10 12l4.5-4.5" />
                      </svg>
                    </button>
                    <div class="erp-select-panel" *ngIf="isFilterMenuOpen(filter.key)">
                      <button type="button" [class.selected]="!selectedFilters()[filter.key]" (click)="setFilter(filter.key, '')">All</button>
                      <button
                        *ngFor="let value of filterValues(filter.key)"
                        type="button"
                        [class.selected]="selectedFilters()[filter.key] === value"
                        (click)="setFilter(filter.key, value)"
                      >
                        {{ value }}
                      </button>
                    </div>
                  </div>
                </label>
                <button type="button" (click)="clearFilters()">Clear filters</button>
              </div>

              <div class="expense-ledger-summary universal-expense-summary" *ngIf="activeModule() === 'expenses' && expenseFilterBalanceVisible()">
                <div><span>Project</span><strong>{{ selectedFilters()['project'] }}</strong></div>
                <div><span>Site</span><strong>{{ selectedFilters()['site'] }}</strong></div>
                <div><span>Opening Balance</span><strong>{{ expenseFilterOpeningLabel() }}</strong></div>
                <div><span>Current Balance</span><strong>{{ expenseFilterCurrentLabel() }}</strong></div>
              </div>

              <ng-container *ngIf="tableState() as tableState">
              <div class="table-meta-strip">
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
                              <span>{{ row[column.key] || 'Select' }}</span>
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
                    <span>{{ column.label }}</span>
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
  readonly selectedRowKey = signal("");
  readonly selectedRowKeys = signal<string[]>([]);
  readonly editingRowKey = signal("");
  readonly editingRowKeys = signal<string[]>([]);
  readonly rowToolbarPosition = signal({ x: 160, y: 120 });
  readonly searchText = signal("");
  readonly selectedFilters = signal<Record<string, string>>({});
  readonly recordDialogOpen = signal(false);
  readonly fieldDialogOpen = signal(false);
  readonly draftRow = signal<TableRow>({});
  readonly newFieldLabel = signal("");
  readonly newFieldAfterKey = signal<string | null>(null);
  readonly openSelectKey = signal("");
  readonly openFilterKey = signal("");
  readonly selectCustomValue = signal("");
  readonly labourTypeDialogOpen = signal(false);
  readonly labourTypeRowId = signal("");
  readonly labourTypeName = signal("Mason");
  readonly labourTypeCount = signal("1");
  readonly labourTypeDailyWage = signal("");
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
    this.selectedFilters.set({});
    this.closeDropdowns();
    this.clearRowSelection();
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
    for (const row of rows) {
      if (this.activeModule() === "clients") this.data.deleteClient(String(row["clientId"] || ""));
      else this.data.deleteSharedRow(String(row["__rowId"] || ""));
    }
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

    if (!target.closest(".selectable-data-row, .row-hover-toolbar, .table-actions")) {
      this.clearRowSelection();
    }

    if (!target.closest(".erp-select-menu, .filter-select-shell, .custom-select-entry")) {
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
    const rows = this.rowsFor(this.activeModule()).filter((row) => {
      const matchesSearch = !query || Object.values(row).some((value) => String(value).toLowerCase().includes(query));
      const matchesFilters = Object.entries(filters).every(([key, value]) => !value || String(row[key]) === value);
      return matchesSearch && matchesFilters;
    });
    return this.withComputedRows(this.activeModule(), rows);
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

  isFilterMenuOpen(key: string): boolean {
    return this.openFilterKey() === key;
  }

  toggleFilterMenu(key: string) {
    this.openFilterKey.set(this.openFilterKey() === key ? "" : key);
  }

  expenseFilterBalanceVisible(): boolean {
    const filters = this.selectedFilters();
    return Boolean(filters["project"] && filters["site"]);
  }

  expenseFilterOpeningLabel(): string {
    const row = this.visibleRows().find((entry) => this.activeModule() === "expenses" && entry["project"] === this.selectedFilters()["project"] && entry["site"] === this.selectedFilters()["site"]);
    return row ? formatMoney(this.expenseOpeningBalanceFor(row)) : formatMoney(0);
  }

  expenseFilterCurrentLabel(): string {
    const rows = this.visibleRows().filter((entry) => entry["project"] === this.selectedFilters()["project"] && entry["site"] === this.selectedFilters()["site"]);
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
    return Object.values(this.selectedFilters()).filter(Boolean).length;
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

  setFilter(key: string, value: string) {
    this.selectedFilters.update((filters) => ({ ...filters, [key]: value }));
    this.openFilterKey.set("");
  }

  clearFilters() {
    this.selectedFilters.set({});
    this.searchText.set("");
    this.closeDropdowns();
    this.clearRowSelection();
  }

  openRecordDialog() {
    const row: TableRow = { ...this.defaultRowFor(this.activeModule()) };
    for (const column of this.recordFormColumns()) {
      const options = this.selectOptions(this.activeModule(), column.key);
      row[column.key] = row[column.key] || options[0] || "";
    }
    this.draftRow.set(row);
    this.recordDialogOpen.set(true);
  }

  recordFormColumns(): FieldSchema[] {
    const hiddenInExpenseForm = new Set(["approvalStatus", "openingBalance", "runningBalance"]);
    return this.columnsForActive().filter((column) => {
      if (this.activeModule() === "expenses" && hiddenInExpenseForm.has(column.key)) return false;
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
    const row = this.data.addCustomRow(module, this.defaultRowFor(module));
    const key = `${module}:${row["__rowId"]}`;
    this.selectedRowKey.set(key);
    this.selectedRowKeys.set([key]);
    this.editingRowKey.set(key);
    this.editingRowKeys.set([key]);
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
      const savedRow = this.data.addCustomRow(module, this.withGeneratedReferences(module === "expenses" ? this.normalizedExpenseInputRow(row) : row));
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
    this.data.addCustomRow("materials", {
      __projectId: project.id,
      projectId: project.id,
      clientId: client?.id ?? "",
      client: project.client,
      project: project.name,
      site: row["site"] || project.sites[0] || "",
      materialName: row["description"] || "Site material purchase",
      unit: "Item",
      requestedQuantity: "1",
      approvedQuantity: "1",
      requestDate: row["expenseDate"] || new Date().toISOString().slice(0, 10),
      vendor: row["vendor"] || "",
      poNumber: row["reference"] || "",
      remainingStock: "1 Item",
      status: row["approvalStatus"] || "Pending",
      sourceExpenseRowId,
    });
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
    const module = this.activeModule();
    this.data.addCustomFieldAfter(module, label, this.newFieldAfterKey(), this.columnsForActive());
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
      transactionType: "Site Expense",
      description: row.description,
      amount: formatMoney(-row.spent),
      siteMaterial: "No",
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

    return { materials, clients, labour, expenses, generalExpenses, payments, vendors, supervisors, subcontractors, reports };
  }

  private rowsFor(module: DashboardModule): TableRow[] {
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
    if (module === "expenses" && key === "transactionType") {
      return ["Purchase", "Cash Added"];
    }
    if (module === "expenses" && key === "siteMaterial") return ["No", "Yes"];
    if (module === "labour" && key === "attendance") return ["Present", "Absent"];
    if (key === "approvalStatus") return ["Pending", "Approved", "Declined"];
    if (key === "status") {
      if (module === "clients") return ["Active", "On Hold", "Completed"];
      if (module === "supervisors") return ["Active", "On Leave", "Inactive"];
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
        transactionType: "Purchase",
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
    return [...rows].sort((first, second) => this.expenseRowSortValue(first).localeCompare(this.expenseRowSortValue(second))).map((row) => {
      const transactionType = this.normalizedExpenseTransactionType(String(row["transactionType"] || "Purchase"));
      const groupKey = this.expenseGroupKey(row);
      const previousBalance = balances.get(groupKey) ?? this.expenseOpeningBalanceFor(row);
      const balance = Math.max(0, previousBalance + this.expenseSignedAmount(row, transactionType));
      balances.set(groupKey, balance);
      return {
        ...row,
        transactionType,
        amount: this.expenseAmountDisplay(row),
        runningBalance: formatMoney(balance),
      };
    });
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
    const rows = this.data.materials().filter((row) => row.vendor.toLowerCase() === vendorName.toLowerCase());
    const purchased = rows.reduce((sum, row) => sum + row.purchased, 0);
    return rows.length ? `${formatNumber(rows.length)} records / ${formatNumber(purchased)} purchased` : "0 records";
  }

  private vendorNameOptions(): string[] {
    return this.sortedUnique([
      ...this.data.vendors().map((vendor) => vendor.name),
      ...this.data.materials().map((material) => material.vendor),
      ...this.rowsFor("materials").map((row) => String(row["vendor"] || "")),
    ]);
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

  private expenseOpeningBalanceFor(row: TableRow, allowProjectFallback = true): number {
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
    if (!allowProjectFallback || !this.isPrimaryExpenseSite(project, site)) return 0;
    return project?.expenseBalance ?? 0;
  }

  private expenseSignedAmount(row: TableRow, transactionType = String(row["transactionType"] || "")): number {
    const amount = Math.abs(this.moneyNumber(row["amount"]));
    if (!amount) return 0;
    return this.isExpenseCredit(transactionType) ? amount : -amount;
  }

  private normalizedExpenseInputRow(row: TableRow): TableRow {
    return {
      ...row,
      transactionType: this.normalizedExpenseTransactionType(String(row["transactionType"] || "Purchase")),
      amount: this.positiveExpenseAmountValue(row["amount"]),
      siteMaterial: this.normalizeYesNo(row["siteMaterial"]),
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

  private explicitExpenseOpeningForGroup(projectId: string, projectName: string, site: string): number {
    const normalizedSite = site.trim().toLowerCase();
    if (!normalizedSite) return 0;
    const rows = this.rowsFor("expenses");
    const match = rows.find((row) => {
      const rowProjectId = String(row["projectId"] || row["__projectId"] || "");
      const rowProjectName = String(row["project"] || "");
      const rowSite = String(row["site"] || "").trim().toLowerCase();
      const sameProject = projectId ? rowProjectId === projectId : rowProjectName === projectName;
      return sameProject && rowSite === normalizedSite && this.moneyNumber(row["openingBalance"]);
    });
    return match ? this.moneyNumber(match["openingBalance"]) : 0;
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
      })
      .sort((first, second) => this.expenseRowSortValue(first).localeCompare(this.expenseRowSortValue(second)));
    const openingRow = rows.find((row) => this.moneyNumber(row["cashIssued"]) || this.moneyNumber(row["received"]));
    return openingRow ? this.moneyNumber(openingRow["cashIssued"]) || this.moneyNumber(openingRow["received"]) : 0;
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
    const openingByGroup = new Map<string, number>();
    const closingByGroup = new Map<string, number>();
    const spent = rows.reduce((sum, row) => {
      const key = this.expenseGroupKey(row);
      if (!openingByGroup.has(key)) {
        openingByGroup.set(key, this.expenseOpeningBalanceFor(row, Boolean(this.selectedFilters()["project"] && this.selectedFilters()["site"])));
      }
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
