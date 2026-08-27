import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { IonContent, IonIcon, IonSplitPane, ToastController } from "@ionic/angular/standalone";
import type { MaterialRow, Project, ProjectStatus } from "../../data/dashboardData";
import { ErpDataService, type SharedModuleKey, type SharedTableField, type SharedTableRow, type Worker } from "../data/erp-data.service";
import { MaterialsService } from "../core/materials.service";
import { ApiService, type PurchaseOrder } from "../core/api.service";
import { WorkspaceHydrationService } from "../core/workspace-hydration.service";
import { mapProject, mapMaterial, mapLabour, mapExpense, mapGeneralExpense, mapPayment, mapVendor, mapSubcontractor, mapInventory, mapWorker } from "../core/mappers";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, formatNumber, statusClass } from "../shared/format";
import { ProjectFormDialogComponent, type ProjectFormValue } from "../shared/project-form-dialog.component";
import { VendorFormDialogComponent, type VendorFormValue } from "../shared/vendor-form-dialog.component";
import { InventoryInitDialogComponent } from "../shared/inventory-init-dialog.component";
import { WorkerFormDialogComponent, type WorkerFormValue } from "../shared/worker-form-dialog.component";
import { SubcontractorFormDialogComponent, type SubcontractorFormValue } from "../shared/subcontractor-form-dialog.component";
import { SearchableSelectComponent } from "../shared/searchable-select.component";
import { DashboardSkeletonComponent } from "../shared/dashboard-skeleton.component";
import { buildReportXlsx } from "../shared/excel-export";

type ModuleKey = Exclude<SharedModuleKey, "clients" | "purchaseOrders" | "settings" | "supervisors">;
type TableRow = SharedTableRow;
type FieldSchema = SharedTableField;
type FilterBuilderStep = "fields" | "values";
type MaterialDetails = {
  name: string;
  unit: string;
  currentStock: number;
  purchases: number;
  consumed: number;
  notes: string;
  purchaseHistory: Array<{ quantity: number; date: string; vendor: string; poNumber: string; notes: string }>;
  consumptionHistory: Array<{ quantity: number; date: string; notes: string }>;
};
type AssignmentOption = { id: string; name: string };
type InventoryMaterialCard = {
  key: string;
  name: string;
  unit: string;
  purchasedQuantity: number;
  consumedQuantity: number;
  remainingStock: number;
  sourceRow: TableRow;
};
type SectionConfig = {
  key: ModuleKey;
  label: string;
  title: string;
  columns: FieldSchema[];
};

const paymentModeOptions = ["Cash", "UPI", "Bank Transfer", "NEFT", "RTGS", "IMPS", "Cheque", "Credit Card", "Debit Card", "Net Banking", "Demand Draft", "Wallet", "Other"];
const labourTypeOptions = [
  "Mason", "Helper", "Carpenter", "Plumber", "Electrician", "Painter",
  "Bar bender", "Welder", "Tile mason", "Centring", "Fitter", "Maid",
  "Cook", "Watchman", "Cleaner", "Driver", "General Labour",
];

const PAYMENT_MODE_STORAGE_KEY = "ajui_custom_payment_modes";

const sectionConfigs: SectionConfig[] = [
  {
    key: "materials",
    label: "Materials",
    title: "Material Requests",
    columns: [
      { key: "materialName", label: "Material Name" },
      { key: "unit", label: "Unit" },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "issuedAmount", label: "Issued Amount", type: "number" },
      { key: "givenAmount", label: "Given Amount", type: "number" },
      { key: "requestDate", label: "Added Date", type: "date" },
      { key: "receivedDate", label: "Received Date", type: "date" },
      { key: "vendor", label: "Vendor" },
      { key: "poNumber", label: "PO Number" },
      { key: "reference", label: "Bill / Reference" },
      { key: "remainingStock", label: "Remaining Stock" },
      { key: "notes", label: "Notes" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    title: "Attendance Register",
    columns: [
      { key: "client", label: "Client" },
      { key: "attendanceDate", label: "Date", type: "date" },
      { key: "subcontractorName", label: "Subcontractor" },
      { key: "labourTypes", label: "Labour Types" },
      { key: "staffCount", label: "Staff Count", type: "number" },
      { key: "attendance", label: "Attendance" },
      { key: "shift", label: "Shift", type: "number" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "expenses",
    label: "Supervisor Expense",
    title: "Supervisor Expense Ledger",
    columns: [
      { key: "expenseDate", label: "Expense Date", type: "date" },
      { key: "transactionType", label: "Transaction Type" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "siteMaterial", label: "Material Purchase" },
      { key: "runningBalance", label: "Balance" },
      { key: "supervisor", label: "Supervisor" },
      { key: "reference", label: "Bill / Reference" },
      { key: "approvalStatus", label: "Approval Status" },
    ],
  },
  {
    key: "generalExpenses",
    label: "Expense",
    title: "Expense",
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    title: "Payment Ledger",
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
    columns: [
      { key: "vendorName", label: "Vendor Name" },
      { key: "projects", label: "Projects" },
      { key: "materialType", label: "Material Type" },
      { key: "materialsBought", label: "Materials Bought" },
      { key: "totalPo", label: "Total PO", type: "number" },
      { key: "totalPaid", label: "Total Paid", type: "number" },
      { key: "phoneNumber", label: "Phone Number" },
      { key: "address", label: "Address" },
      { key: "gstNumber", label: "GST Number" },
    ],
  },
  {
    key: "subcontractorsRoster",
    label: "Subcontractors",
    title: "Sub-contractor Roster",
    columns: [
      { key: "subcontractorName", label: "Subcontractor Name" },
      { key: "address", label: "Address" },
      { key: "phone", label: "Phone No." },
      { key: "gstDisplay", label: "GST" },
      { key: "note", label: "Notes" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "subcontractors",
    label: "Subcontractor Payments",
    title: "Subcontractor Payments",
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "paymentType", label: "Payment Mode" },
      { key: "subcontractorName", label: "Subcontractor" },
      { key: "labourType", label: "Labour Type" },
      { key: "description", label: "Work Description" },
      { key: "employeeCount", label: "Number of Employees", type: "number" },
      { key: "amount", label: "Total Paid", type: "number" },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    title: "Project Inventory",
    columns: [
      { key: "materialName", label: "Material Name" },
      { key: "unit", label: "Unit" },
      { key: "purchasedQuantity", label: "Purchased", type: "number" },
      { key: "consumedQuantity", label: "Consumed", type: "number" },
      { key: "remainingStock", label: "Remaining Stock" },
      { key: "vendor", label: "Vendor" },
      { key: "poNumber", label: "PO Number" },
    ],
  },
];

const siteMaterialDetailFields: FieldSchema[] = [
  { key: "materialName", label: "Material Name" },
  { key: "unit", label: "Unit" },
  { key: "requestedQuantity", label: "Requested Quantity", type: "number" },
  { key: "vendor", label: "Vendor Name" },
  { key: "requestDate", label: "Added Date", type: "date" },
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
    WorkerFormDialogComponent,
    SubcontractorFormDialogComponent,
    SearchableSelectComponent,
    DashboardSkeletonComponent,
  ],
  styles: [`
    .operations-dialog:has(.draft-select-menu.open) {
      overflow: visible;
    }
    .operations-dialog:has(.draft-select-menu.open) > .erp-form {
      overflow: visible;
    }
    .assignment-dialog {
      width: min(520px, calc(100vw - 48px));
    }
    .assignment-dialog > .erp-form {
      grid-template-columns: minmax(0, 1fr);
      padding: 18px 24px 20px;
      overflow: visible;
    }
    .assignment-dialog:has(.assignment-select-menu.open) {
      overflow: visible;
    }
    .assignment-select-menu {
      width: 100%;
      min-width: 0;
    }
    .assignment-select-menu .erp-select-trigger {
      min-height: 40px;
      font-weight: 600;
    }
    .assignment-select-menu.open .erp-select-trigger {
      border-color: var(--ui-accent, #3b82f6);
    }
    .assignment-select-panel {
      position: absolute;
      z-index: 80;
      width: 100%;
      min-width: 0;
      max-height: 248px;
      pointer-events: auto;
    }
    .assignment-select-panel > button {
      justify-content: space-between;
      min-height: 42px;
      padding: 7px 10px;
    }
    .assignment-option-copy {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .assignment-option-copy strong {
      overflow: hidden;
      color: inherit;
      font-size: 13px;
      font-weight: 720;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .assignment-option-copy small {
      color: var(--ui-muted, #64748b);
      font-size: 11px;
      font-weight: 550;
    }
    .assignment-option-check {
      display: inline-grid;
      width: 22px;
      height: 22px;
      flex: 0 0 22px;
      place-items: center;
      border-radius: 999px;
      background: #dbeafe;
      color: #174ea6;
    }
    .assignment-option-check svg {
      width: 13px;
      height: 13px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2.2;
    }
    .assignment-field { min-width: 0; }
    .assignment-field-label {
      display: block;
      margin-bottom: 7px;
      color: var(--ui-text, #172033);
      font-size: 12px;
      font-weight: 700;
    }
    .assignment-create-new {
      width: 100%;
      min-height: 40px;
      margin-top: 10px;
      border: 1px dashed var(--ui-line, #cbd5e1);
      border-radius: 9px;
      background: var(--ui-soft, #f8fafc);
      color: var(--ui-accent, #174ea6);
      font-weight: 700;
      cursor: pointer;
    }
    .assignment-select-panel > button em {
      font-style: normal;
      color: var(--ui-muted, #64748b);
    }
    .assignment-empty {
      margin: 0;
      padding: 10px 12px;
      font-size: 12px;
      color: var(--ui-muted, #64748b);
    }
    .assignment-hint {
      display: block;
      margin-top: 6px;
      font-size: 12px;
      color: var(--ui-muted, #64748b);
      line-height: 1.4;
    }
    .assignment-dialog .dialog-actions {
      padding: 14px 24px 18px;
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
    .material-bill-upload {
      border: 0;
      cursor: pointer;
    }
    .material-bill-upload:disabled {
      cursor: wait;
      opacity: 0.65;
    }
    .primary-table-action .svg-icon {
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .material-details-dialog {
      width: min(760px, calc(100vw - 32px));
      max-height: min(760px, calc(100vh - 32px));
      overflow: auto;
      padding: 0;
      border-radius: 14px;
    }
    .material-details-overlay,
    .assignment-overlay {
      z-index: 2147483000;
      background: rgba(15, 23, 42, 0.48);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    .material-details-close {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      border: 1px solid var(--ui-line, #e2e8f0);
      border-radius: 10px;
      background: var(--ui-soft, #f8fafc);
      color: var(--ui-text, #0f172a);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
    }
    .material-details-close:hover {
      background: #eef2ff;
      border-color: #c7d2fe;
      color: #1d4ed8;
      transform: translateY(-1px);
    }
    .material-details-close:focus-visible { outline: 3px solid rgba(37, 99, 235, 0.2); outline-offset: 2px; }
    .material-details-close svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
    .material-details-content { padding: 18px 24px 22px; }
    .material-detail-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 0 0 20px;
    }
    .material-detail-stat, .material-history-item {
      border: 1px solid var(--ui-line, #e2e8f0);
      border-radius: 10px;
      padding: 12px;
      background: var(--ui-panel, #fff);
    }
    .material-detail-stat span, .material-history-item span {
      display: block;
      color: var(--ui-muted, #64748b);
      font-size: 12px;
    }
    .material-detail-stat strong { display: block; margin-top: 5px; font-size: 20px; }
    .material-history { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
    .material-history h3 { margin: 0 0 9px; font-size: 15px; }
    .material-history-list { display: grid; gap: 8px; }
    .material-history-item strong { display: block; margin-bottom: 3px; }
    .material-detail-note { margin-top: 16px; }
    .material-detail-note p { white-space: pre-wrap; }
    .material-detail-error, .material-detail-empty { color: var(--ui-muted, #64748b); }
    .inventory-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
      gap: 16px;
      padding: 18px;
      background: #f6f8fc;
    }
    .inventory-material-card {
      display: grid;
      gap: 18px;
      min-width: 0;
      padding: 18px;
      border: 1px solid #dbe3ef;
      border-radius: 16px;
      background: #fff;
      color: #172033;
      text-align: left;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
      cursor: pointer;
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }
    .inventory-material-card:hover {
      transform: translateY(-2px);
      border-color: #9db5df;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
    }
    .inventory-material-card:focus-visible { outline: 3px solid rgba(37, 99, 235, 0.2); outline-offset: 2px; }
    .inventory-card-head, .inventory-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .inventory-card-title { display: grid; gap: 4px; min-width: 0; }
    .inventory-card-title strong { overflow: hidden; font-size: 17px; text-overflow: ellipsis; white-space: nowrap; }
    .inventory-card-title span { color: #64748b; font-size: 12px; font-weight: 650; }
    .inventory-card-icon {
      display: grid;
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      place-items: center;
      border-radius: 11px;
      background: #eef4ff;
      color: #174ea6;
    }
    .inventory-card-icon svg, .inventory-card-footer svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }
    .inventory-card-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .inventory-card-metric { min-width: 0; padding: 10px; border-radius: 10px; background: #f8fafc; }
    .inventory-card-metric span { display: block; color: #64748b; font-size: 10px; font-weight: 700; }
    .inventory-card-metric strong { display: block; overflow: hidden; margin-top: 5px; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
    .inventory-card-metric.stock { background: #ecfdf3; color: #166534; }
    .inventory-card-metric.stock span { color: #4b8060; }
    .inventory-card-footer { padding-top: 12px; border-top: 1px solid #edf1f6; color: #174ea6; font-size: 12px; font-weight: 750; }
    .inventory-card-empty { grid-column: 1 / -1; padding: 42px 18px; color: #64748b; text-align: center; }
    .material-history-po {
      display: inline-flex;
      width: fit-content;
      margin-top: 5px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #174ea6;
      font-size: 12px;
      font-weight: 750;
      text-decoration: underline;
      cursor: pointer;
    }
    @media (max-width: 640px) {
      .material-detail-stats, .material-history { grid-template-columns: 1fr; }
      .inventory-card-grid { grid-template-columns: 1fr; padding: 12px; }
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
          metaLabel="Project records"
          [blurred]="recordDialogOpen() || labourTypeDialogOpen() || filterBuilderOpen() || showProjectForm() || showVendorDialog() || showSubcontractorDialog() || !!assignmentDialogType() || !!editingInlineVendor() || showWorkerDialog()"
          [showTitle]="false"
          searchPlaceholder="Search"
        />

        <ion-content class="erp-page">
          <div class="project-workspace-skeleton" *ngIf="!project()">
            <agb-dashboard-skeleton
              variant="kpi"
              [kpiCount]="6"
              ariaLabel="Loading project summary"
            ></agb-dashboard-skeleton>
            <agb-dashboard-skeleton
              variant="row"
              [rowCount]="8"
              ariaLabel="Loading project records"
            ></agb-dashboard-skeleton>
            <p class="project-load-error" *ngIf="projectLoadError()">{{ projectLoadError() }}</p>
          </div>
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
                      type="text"
                      inputmode="numeric"
                      [value]="formatNumber(currentProject.totalValue)"
                      (change)="updateProjectEstimatedValue($any($event.target).value)"
                      (focus)="onMetricFocus($event)"
                      (blur)="onMetricBlur($event)"
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
                      type="text"
                      inputmode="numeric"
                      [value]="formatNumber(projectReceivedAmount(currentProject))"
                      readonly
                      (focus)="onMetricFocus($event)"
                      (blur)="onMetricBlur($event)"
                      aria-label="Project received amount from payment ledger"
                    />
                  </dd>
                </div>
                <div><dt>Pending</dt><dd>{{ formatMoney(projectPendingAmount(currentProject)) }}</dd></div>
                <div><dt>Supervisor</dt><dd>{{ currentProject.supervisor }}</dd></div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <label class="status-edit-shell" [ngClass]="statusShellClass(currentProject.status)">
                      <span class="sr-only">Project status</span>
                      <agb-searchable-select
                        [hideSearch]="true"
                        [value]="currentProject.status"
                        [options]="projectStatusOptions"
                        (valueChange)="updateProjectStatus($any($event))"
                      />
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
                  <small>{{ sectionCount(section.key) }}</small>
                </button>
              </nav>

              <div class="module-toolbar table-first-toolbar">
                <div>
                  <h2>{{ activeConfig().title }}</h2>
                </div>
                <div class="table-actions">
                  <label class="table-search" *ngIf="!tableViewExpanded()">
                    <ion-icon name="search-outline"></ion-icon>
                    <input [value]="tableSearch()" (input)="tableSearch.set($any($event.target).value)" placeholder="Search rows" />
                  </label>
                  <button
                    type="button"
                    class="primary-table-action add-row-action"
                    *ngIf="!tableViewExpanded() && activeSection() === 'subcontractorsRoster'"
                    title="Assign Subcontractor"
                    aria-label="Assign Subcontractor"
                    (click)="openAssignmentDialog('subcontractor')"
                  >
                    <ion-icon name="add-outline"></ion-icon>
                    Assign Subcontractor
                  </button>
                  <button
                    type="button"
                    class="primary-table-action add-row-action"
                    *ngIf="!tableViewExpanded() && activeSection() === 'subcontractors'"
                    title="Add Payment"
                    aria-label="Add Payment"
                    (click)="openRecordDialog()"
                  >
                    <ion-icon name="add-outline"></ion-icon>
                    Add Payment
                  </button>
                  <button
                    type="button"
                    class="primary-table-action add-row-action"
                    *ngIf="!tableViewExpanded() && !isNoCreateTab() && activeSection() !== 'vendors' && activeSection() !== 'subcontractors' && activeSection() !== 'subcontractorsRoster'"
                    [title]="activeSection() === 'materials' ? 'Add materials' : 'Add row'"
                    [attr.aria-label]="activeSection() === 'materials' ? 'Add materials' : 'Add row'"
                    (click)="openRecordDialog()"
                  >
                    <ion-icon name="add-outline"></ion-icon>
                    {{ activeSection() === 'materials' ? 'Add Materials' : 'Add Row' }}
                  </button>
                  <button
                    type="button"
                    class="primary-table-action"
                    *ngIf="!tableViewExpanded() && activeSection() === 'materials' && selectedRowCount() > 0"
                    [title]="selectedContainsExistingMaterial() ? 'Existing inventory materials cannot be ordered again' : 'Create a purchase order from selected materials'"
                    aria-label="Create purchase order from selected materials"
                    [disabled]="selectedContainsExistingMaterial()"
                    (click)="createPurchaseOrderFromSelection()"
                  >
                    <ion-icon name="document-text-outline"></ion-icon>
                    {{ selectedContainsExistingMaterial() ? 'Existing Material — PO unavailable' : 'Create PO (' + selectedRowCount() + ')' }}
                  </button>
                  <button
                    type="button"
                    class="primary-table-action"
                    *ngIf="!tableViewExpanded() && activeSection() === 'materials' && selectedRowCount() === 1"
                    title="View selected material details"
                    aria-label="View selected material details"
                    (click)="openSelectedMaterialDetails()"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="2.75" />
                    </svg>
                    View Details
                  </button>
                  <button type="button" *ngIf="!tableViewExpanded()" (click)="exportPdf()"><ion-icon name="document-text-outline"></ion-icon>PDF Report</button>
                  <button type="button" *ngIf="!tableViewExpanded()" (click)="exportExcel()"><ion-icon name="download-outline"></ion-icon>Export Excel</button>
                  <button type="button" class="view-table-action" *ngIf="!tableViewExpanded() && activeSection() !== 'inventory'" (click)="openTableView()">
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
                <span>{{ activeSection() === 'inventory' ? inventoryMaterialCards().length + ' unique materials' : tableState.rows.length + ' rows' }}</span>
                <span>{{ activeSection() === 'inventory' ? 'Card view' : tableState.columns.length + ' fields' }}</span>
                <span>{{ selectedFilterCount() }} active filters</span>
                <span *ngIf="activeSection() !== 'inventory'">Rows edit after selection</span>
                <button type="button" class="meta-reset-action" *ngIf="activeSection() !== 'inventory' && hiddenFieldCount(activeSection())" (click)="resetFields(activeSection())">
                  Reset fields
                </button>
              </div>

              <div class="expense-ledger-summary" *ngIf="!tableViewExpanded() && activeSection() === 'expenses'">
                <div><span>Cash Added</span><strong>{{ expenseCashAddedLabel() }}</strong></div>
                <div><span>Expenses</span><strong>{{ expenseSpentLabel() }}</strong></div>
                <div><span>Current Balance</span><strong>{{ expenseCurrentBalanceLabel() }}</strong></div>
              </div>

              <section class="inventory-card-grid" *ngIf="activeSection() === 'inventory'">
                <button
                  *ngFor="let card of inventoryMaterialCards(); trackBy: trackInventoryCard"
                  type="button"
                  class="inventory-material-card"
                  (click)="openInventoryMaterialDetails(card)"
                >
                  <span class="inventory-card-head">
                    <span class="inventory-card-title">
                      <strong>{{ card.name }}</strong>
                      <span>Unit · {{ card.unit || 'Not specified' }}</span>
                    </span>
                    <span class="inventory-card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" /><path d="M4 7.5V16l8 5 8-5V7.5" /><path d="M12 12v9" /></svg>
                    </span>
                  </span>
                  <span class="inventory-card-metrics">
                    <span class="inventory-card-metric">
                      <span>Purchased</span>
                      <strong>{{ formatNumber(card.purchasedQuantity) }}</strong>
                    </span>
                    <span class="inventory-card-metric">
                      <span>Consumed</span>
                      <strong>{{ formatNumber(card.consumedQuantity) }}</strong>
                    </span>
                    <span class="inventory-card-metric stock">
                      <span>Remaining</span>
                      <strong>{{ formatNumber(card.remainingStock) }}</strong>
                    </span>
                  </span>
                  <span class="inventory-card-footer">
                    <span>View purchases, consumption, PO and vendor</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                  </span>
                </button>
                <p class="inventory-card-empty" *ngIf="inventoryMaterialCards().length === 0">No inventory materials match the current filters.</p>
              </section>

              <div class="table-wrap operations-table" *ngIf="activeSection() !== 'inventory'">
                <table>
                  <thead>
                    <tr>
                      <th *ngIf="showRowCheckboxes()" class="row-check-column">
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
                      <td *ngIf="showRowCheckboxes()" class="row-check-column">
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
                        [class.labour-types-cell-host]="activeSection() === 'attendance' && column.key === 'labourTypes'"
                      >
                        <ng-container *ngIf="activeSection() === 'materials' && column.key === 'notes' && !isRowEditing(row); else nonMaterialNoteCell">
                          <div class="material-note-history" [class.open]="isMaterialNoteHistoryOpen(row)">
                            <button
                              type="button"
                              class="material-note-trigger"
                              [attr.aria-expanded]="isMaterialNoteHistoryOpen(row)"
                              (pointerdown)="$event.stopPropagation()"
                              (click)="toggleMaterialNoteHistory(row, $event)"
                            >
                              <span>{{ materialNoteHistory(row)[0]?.note || 'No notes' }}</span>
                              <small *ngIf="materialNoteHistory(row).length > 1">{{ materialNoteHistory(row).length }} notes</small>
                              <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="M5.5 7.5 10 12l4.5-4.5" /></svg>
                            </button>
                            <div class="material-note-panel" *ngIf="isMaterialNoteHistoryOpen(row)" (pointerdown)="$event.stopPropagation()">
                              <header>
                                <strong>Note history</strong>
                                <span>{{ materialNoteHistory(row).length }} {{ materialNoteHistory(row).length === 1 ? 'entry' : 'entries' }}</span>
                              </header>
                              <div class="material-note-list" *ngIf="materialNoteHistory(row).length; else noMaterialNotes">
                                <article *ngFor="let entry of materialNoteHistory(row); let first = first">
                                  <span class="material-note-date">{{ formatMaterialNoteDate(entry.date) }}</span>
                                  <p>{{ entry.note }}</p>
                                  <small *ngIf="first">Latest</small>
                                </article>
                              </div>
                              <ng-template #noMaterialNotes><p class="material-note-empty">No notes have been added.</p></ng-template>
                            </div>
                          </div>
                        </ng-container>
                        <ng-template #nonMaterialNoteCell>
                        <ng-container *ngIf="activeSection() === 'attendance' && column.key === 'labourTypes'; else standardProjectCell">
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
                            <ng-container *ngIf="(activeSection() === 'materials' || activeSection() === 'inventory') && column.key === 'poNumber' && isReadablePurchaseOrderNumber(row['poNumber']); else billOrEditableCell">
                              <button type="button" class="bill-link" (click)="openPurchaseOrder(row['poNumber'], $event)">{{ row['poNumber'] }}</button>
                            </ng-container>
                            <ng-template #billOrEditableCell>
                              <ng-container *ngIf="activeSection() === 'materials' && column.key === 'reference'; else standardBillOrEditableCell">
                                @if (row['billUrl']) {
                                  @if (isDataUrl($any(row['billUrl']))) {
                                    <button type="button" class="bill-link" (click)="$event.stopPropagation(); openImagePreview($any(row['billUrl']))">View Bill</button>
                                  } @else {
                                    <a class="bill-link" [href]="row['billUrl']" target="_blank" rel="noopener noreferrer" (click)="$event.stopPropagation()">View Bill</a>
                                  }
                                } @else {
                                  <input #materialBillInput type="file" hidden accept="image/*,application/pdf" (change)="uploadMaterialBill(row, $event)" />
                                  <button
                                    type="button"
                                    class="bill-link material-bill-upload"
                                    [disabled]="isMaterialBillUploading(row)"
                                    (click)="$event.stopPropagation(); materialBillInput.click()"
                                  >
                                    {{ isMaterialBillUploading(row) ? 'Uploading…' : 'Upload Bill' }}
                                  </button>
                                }
                              </ng-container>
                              <ng-template #standardBillOrEditableCell>
                                <ng-container *ngIf="column.key === 'reference' && row['billUrl'] && !isRowEditing(row); else normalEditableCell">
                                  @if (isDataUrl($any(row['billUrl']))) {
                                    <button type="button" class="bill-link" (click)="openImagePreview($any(row['billUrl']))">View Bill</button>
                                  } @else {
                                    <a class="bill-link" [href]="row['billUrl']" target="_blank" rel="noopener noreferrer" (click)="$event.stopPropagation()">View Bill</a>
                                  }
                                </ng-container>
                              </ng-template>
                            </ng-template>
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
                        </ng-template>
                      </td>
                    </tr>
                    <tr *ngIf="tableState.rows.length === 0">
                      <td class="empty-row" [attr.colspan]="tableState.columns.length + (showRowCheckboxes() ? 1 : 0)">
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
                    <h2>Filter By</h2>
                    <p>Fill any field below to filter this table.</p>
                  </div>
                  <button type="button" class="icon-button" (click)="closeFilterBuilder()">
                    <ion-icon name="close-outline"></ion-icon>
                  </button>
                </div>
                <div class="filter-dialog-body">
                  <div class="filter-value-grid filter-dialog-value-grid">
                    <label class="filter-combo-field" *ngFor="let column of filterableColumns()" [class.menu-open]="activeFilterValueKey() === column.key">
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
                  <button type="submit" class="primary-action">Apply Filter</button>
                </div>
              </form>
            </section>

            <section class="form-overlay" *ngIf="recordDialogOpen()">
              <form class="erp-dialog operations-dialog" (submit)="saveRecord($event)">
                <div class="dialog-head">
                  <div>
                    <span>{{ activeConfig().label }}</span>
                    <h2>{{ activeSection() === 'materials' ? 'Add Materials' : 'Add Record' }}</h2>
                  </div>
                  <button type="button" class="icon-button" (click)="recordDialogOpen.set(false)">
                    <ion-icon name="close-outline"></ion-icon>
                  </button>
                </div>
                <div class="erp-form">
                  <label *ngFor="let column of recordFormColumns()">
                    <span>{{ formColumnLabel(column) }}</span>
                    <ng-container *ngIf="isPaymentModeField(column); else standardRecordField">
                      <agb-searchable-select
                        [value]="draftRow()[column.key] || ''"
                        [options]="selectOptions(activeSection(), column.key)"
                        [allowCustom]="true"
                        (valueChange)="updateDraftField(column.key, $any($event))"
                      />
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
                            <span class="draft-select-loading" *ngIf="activeSection() === 'materials' && column.key === 'materialName' && loadingAllMaterialNames()">
                              Loading all material names…
                            </span>
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
                            <label class="custom-select-entry" *ngIf="allowsCustomOption(activeSection(), column.key)">
                              <span>Custom</span>
                              <input
                                #draftCustomValue
                                (keydown.enter)="saveCustomDraftOption(column.key, draftCustomValue.value, $event)"
                                placeholder="Type value and press Enter"
                              />
                            </label>
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
                          </div>
                        </div>
                      </ng-container>
                      <ng-template #projectDraftInput>
                        <input
                          [type]="column.type || 'text'"
                          [attr.min]="activeSection() === 'materials' && column.key === 'quantity' ? '0.01' : null"
                          [attr.step]="activeSection() === 'materials' && column.key === 'quantity' ? 'any' : null"
                          [required]="activeSection() === 'materials' && column.key === 'quantity'"
                          [value]="draftRow()[column.key] || ''"
                          (input)="updateDraftField(column.key, $any($event.target).value)"
                        />
                      </ng-template>
                    </ng-template>
                  </label>
                  <ng-container *ngIf="showSiteMaterialDetails()">
                    <div class="material-detail-heading span-2">
                      <strong>Material details</strong>
                      <span>These fields create the linked Material Requests row for this purchase.</span>
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
                        <agb-searchable-select
                          *ngIf="selectOptions('materials', field.key).length > 0; else projectMaterialInput"
                          [value]="draftRow()[field.key] || ''"
                          [options]="selectOptions('materials', field.key)"
                          [allowCustom]="true"
                          (valueChange)="updateDraftField(field.key, $any($event))"
                        />
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
                  <button type="button" class="secondary-action" (click)="recordDialogOpen.set(false)" [disabled]="recordSaving()">Cancel</button>
                  <button type="submit" class="primary-action" [disabled]="recordSaving()" [attr.aria-busy]="recordSaving() ? 'true' : null">
                    @if (recordSaving()) {
                      <span class="agb-loading-spinner" aria-hidden="true"></span>
                    }
                    {{ recordSaving() ? 'Saving…' : (activeSection() === 'materials' ? 'Add Materials' : 'Add Record') }}
                  </button>
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
                  <button type="button" class="secondary-action" (click)="closeLabourTypeDialog()" [disabled]="labourTypeSaving()">Cancel</button>
                  <button type="submit" class="primary-action" [disabled]="labourTypeSaving()" [attr.aria-busy]="labourTypeSaving() ? 'true' : null">
                    @if (labourTypeSaving()) {
                      <span class="agb-loading-spinner" aria-hidden="true"></span>
                    }
                    {{ labourTypeSaving() ? 'Saving…' : 'Add Labor Type' }}
                  </button>
                </div>
              </form>
            </section>

            <agb-project-form-dialog
              *ngIf="showProjectForm() && client() as currentClient"
              [clientName]="currentClient.name"
              [lockClient]="!editingProject()"
              [defaultSupervisor]="currentClient.supervisor"
              [clients]="data.clients()"
              [currentClientId]="currentClient._id || currentClient.id"
              [initialValue]="editingProjectValue()"
              [eyebrow]="editingProject() ? 'Project Edit' : 'Project Setup'"
              [title]="editingProject() ? 'Edit Project' : 'Create New Project'"
              [submitLabel]="editingProject() ? 'Save Project' : 'Create Project'"
              (cancel)="closeProjectForm()"
              (create)="saveProject($event)"
            ></agb-project-form-dialog>

            <agb-inventory-init-dialog
              *ngIf="showInventoryInitDialog()"
              [sites]="inventoryInitSites()"
              [materialNames]="inventoryInitMaterialNames()"
              [materialRows]="inventoryInitMaterialRows()"
              [presetSiteId]="activeSiteFilter() !== 'All' ? activeSiteId() : ''"
              [projectId]="projectId()"
              (saved)="onInventoryInitSaved()"
              (cancelled)="closeInventoryInitDialog()"
            ></agb-inventory-init-dialog>

            <agb-worker-form-dialog
              *ngIf="showWorkerDialog()"
              [eyebrow]="editingWorker() ? 'Worker Edit' : 'Worker Setup'"
              [title]="editingWorker() ? 'Edit Worker' : 'Add New Worker'"
              [description]="editingWorker() ? 'Update worker details and subcontractor assignment.' : 'Create a worker and assign them to a subcontractor.'"
              [submitLabel]="editingWorker() ? 'Save Changes' : 'Add Worker'"
              [initialValue]="editingWorker() ? workerEditValue() : null"
              [subcontractorOptions]="workerSubcontractorOptions()"
              [submitting]="workerDialogSaving()"
              (cancel)="closeWorkerDialog()"
              (create)="editingWorker() ? updateWorkerEntry($event) : createWorkerEntry($event)"
            ></agb-worker-form-dialog>

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

    <agb-vendor-form-dialog
      *ngIf="showVendorDialog()"
      [eyebrow]="editingInlineVendor() ? 'Vendor Edit' : 'New Vendor'"
      [title]="editingInlineVendor() ? 'Edit Vendor' : 'Create New Vendor'"
      [description]="editingInlineVendor() ? 'Update vendor contact, material type, GST, and address information.' : 'This name is not in the vendor list. Complete the profile to create and assign it to this project.'"
      [submitLabel]="editingInlineVendor() ? 'Save Changes' : 'Create & Assign'"
      [initialValue]="editingInlineVendor() ? inlineVendorEditValue() : pendingVendorValue()"
      [submitting]="vendorDialogSaving()"
      (cancel)="closeVendorDialog()"
      (create)="editingInlineVendor() ? updateInlineVendor($event) : createInlineVendor($event)"
    ></agb-vendor-form-dialog>

    <agb-subcontractor-form-dialog
      *ngIf="showSubcontractorDialog()"
      [eyebrow]="'Sub-contractor Roster'"
      [title]="'Create New Subcontractor'"
      [description]="'This name is not in the subcontractor list. Complete the profile to create and assign it to this project.'"
      [submitLabel]="'Create & Assign'"
      [initialValue]="pendingSubcontractorValue()"
      [submitting]="subcontractorDialogSaving()"
      (cancel)="closeSubcontractorDialog()"
      (create)="createRosterSubcontractor($event)"
    ></agb-subcontractor-form-dialog>

    <section class="form-overlay assignment-overlay" *ngIf="assignmentDialogType() as assignmentType">
      <form class="erp-dialog operations-dialog assignment-dialog" (submit)="saveAssignment($event)">
        <div class="dialog-head">
          <div>
            <span>Project Assignment</span>
            <h2>Assign {{ assignmentType === 'vendor' ? 'Vendor' : 'Subcontractor' }}</h2>
            <p>Select an existing profile, or create a new {{ assignmentType }}.</p>
          </div>
          <button type="button" class="icon-button" (click)="closeAssignmentDialog()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>
        <div class="erp-form assignment-form">
          <div class="span-2 assignment-field">
            <span class="assignment-field-label">{{ assignmentType === 'vendor' ? 'Vendor' : 'Subcontractor' }}</span>
            <div
              class="erp-select-menu assignment-select-menu"
              [class.open]="assignmentDropdownOpen()"
            >
              <button
                type="button"
                class="erp-select-trigger"
                aria-haspopup="listbox"
                [attr.aria-expanded]="assignmentDropdownOpen()"
                (click)="toggleAssignmentDropdown()"
              >
                <span>{{ assignmentTriggerLabel() }}</span>
                <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                  <path d="M5.5 7.5 10 12l4.5-4.5" />
                </svg>
              </button>
              <div
                class="erp-select-panel assignment-select-panel"
                role="listbox"
                *ngIf="assignmentDropdownOpen()"
                (pointerdown)="$event.stopPropagation()"
              >
                <input
                  type="search"
                  class="erp-select-filter"
                  placeholder="Search existing {{ assignmentType }}s"
                  aria-label="Search existing {{ assignmentType }}s"
                  autofocus
                  [value]="assignmentSelectSearch()"
                  (input)="assignmentSelectSearch.set($any($event.target).value)"
                  (keydown.escape)="closeAssignmentDropdown()"
                />
                <button
                  *ngFor="let option of filteredAssignmentOptions()"
                  type="button"
                  role="option"
                  [attr.aria-selected]="assignmentSelection() === option.id"
                  [class.selected]="assignmentSelection() === option.id"
                  (pointerdown)="selectExistingAssignment(option, $event)"
                  (click)="selectExistingAssignment(option)"
                >
                  <span class="assignment-option-copy">
                    <strong>{{ option.name }}</strong>
                    <small>Existing {{ assignmentType }} profile</small>
                  </span>
                  <span class="assignment-option-check" *ngIf="assignmentSelection() === option.id">
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
                  </span>
                </button>
                <p class="assignment-empty" *ngIf="!filteredAssignmentOptions().length">
                  No existing {{ assignmentType }} matches your search.
                </p>
              </div>
            </div>
            <button type="button" class="assignment-create-new" (click)="openNewAssignmentForm(assignmentType)">
              + Create new {{ assignmentType }}
            </button>
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary-action" (click)="closeAssignmentDialog()" [disabled]="assignmentSaving()">Cancel</button>
          <button type="submit" class="primary-action" [disabled]="assignmentSaving() || !assignmentSelection()" [attr.aria-busy]="assignmentSaving() ? 'true' : null">
            @if (assignmentSaving()) {
              <span class="agb-loading-spinner" aria-hidden="true"></span>
            }
            {{ assignmentSaving() ? 'Assigning…' : 'Assign' }}
          </button>
        </div>
      </form>
    </section>

    <section class="form-overlay material-details-overlay" *ngIf="materialDetailsOpen()" (click)="closeMaterialDetails()">
      <article class="erp-dialog operations-dialog material-details-dialog" (click)="$event.stopPropagation()">
        <div class="dialog-head">
          <div>
            <span>Material</span>
            <h2>{{ selectedMaterialDetails()?.name || 'Material Details' }}</h2>
          </div>
          <button type="button" class="material-details-close" aria-label="Close material details" title="Close" (click)="closeMaterialDetails()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div class="material-details-content">
          @if (materialDetailsLoading()) {
            <p class="material-detail-empty">Loading live inventory details…</p>
          } @else if (materialDetailsError()) {
            <p class="material-detail-error">{{ materialDetailsError() }}</p>
          } @else if (selectedMaterialDetails(); as details) {
            <div class="material-detail-stats">
              <div class="material-detail-stat"><span>Current Stock</span><strong>{{ formatNumber(details.currentStock) }} {{ details.unit }}</strong></div>
              <div class="material-detail-stat"><span>Purchases</span><strong>{{ formatNumber(details.purchases) }} {{ details.unit }}</strong></div>
              <div class="material-detail-stat"><span>Consumed</span><strong>{{ formatNumber(details.consumed) }} {{ details.unit }}</strong></div>
            </div>
            <div class="material-history">
              <section>
                <h3>Purchases</h3>
                <div class="material-history-list" *ngIf="details.purchaseHistory.length; else noPurchases">
                  <div class="material-history-item" *ngFor="let entry of details.purchaseHistory">
                    <strong>{{ formatNumber(entry.quantity) }} {{ details.unit }}</strong>
                    <span>{{ entry.date | date:'mediumDate' }} · {{ entry.vendor || 'Vendor not recorded' }}</span>
                    <button *ngIf="entry.poNumber" type="button" class="material-history-po" (click)="openPurchaseOrder(entry.poNumber, $event)">{{ entry.poNumber }}</button>
                    <span *ngIf="entry.notes">{{ entry.notes }}</span>
                  </div>
                </div>
                <ng-template #noPurchases><p class="material-detail-empty">No purchase entries recorded.</p></ng-template>
              </section>
              <section>
                <h3>Consumption Logs</h3>
                <div class="material-history-list" *ngIf="details.consumptionHistory.length; else noConsumption">
                  <div class="material-history-item" *ngFor="let entry of details.consumptionHistory">
                    <strong>{{ formatNumber(entry.quantity) }} {{ details.unit }}</strong>
                    <span>{{ entry.date | date:'mediumDate' }}</span>
                    <span *ngIf="entry.notes">{{ entry.notes }}</span>
                  </div>
                </div>
                <ng-template #noConsumption><p class="material-detail-empty">No consumption logs recorded.</p></ng-template>
              </section>
            </div>
            <section class="material-detail-note" *ngIf="details.notes">
              <h3>Notes</h3>
              <p>{{ details.notes }}</p>
            </section>
          }
        </div>
      </article>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectWorkspacePage {
  readonly projectStatusOptions = [
    { label: "Active", value: "Active" as ProjectStatus },
    { label: "On-hold", value: "On Hold" as ProjectStatus },
    { label: "Closed", value: "Completed" as ProjectStatus },
  ];
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly materialsService = inject(MaterialsService);
  readonly hydration = inject(WorkspaceHydrationService);
  private readonly toastController = inject(ToastController);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly paramMap = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly queryParamMap = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly formatMoney = formatMoney;
  readonly formatNumber = formatNumber;

  onMetricFocus(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = Number(String(input.value).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(raw)) {
      input.value = String(raw);
    }
  }

  onMetricBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = Number(String(input.value).replace(/[^\d.-]/g, ""));
    input.value = formatNumber(Number.isFinite(raw) ? raw : 0);
  }
  readonly statusClass = statusClass;
  readonly statusShellClass = (status: string) =>
    status === "Completed" ? "danger" : statusClass(status);
  readonly showProjectForm = signal(false);
  readonly editingProject = signal<Project | null>(null);
  readonly projectLoadError = signal("");
  private fetchingProjectId = "";
  readonly estimatedValueSaving = signal(false);
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
  readonly allMaterialNames = signal<string[]>([]);
  readonly loadingAllMaterialNames = signal(false);
  readonly openMaterialNoteHistoryKey = signal("");
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
  readonly recordSaving = signal(false);
  readonly uploadingMaterialBills = signal<string[]>([]);
  readonly materialDetailsOpen = signal(false);
  readonly materialDetailsLoading = signal(false);
  readonly materialDetailsError = signal("");
  readonly selectedMaterialDetails = signal<MaterialDetails | null>(null);
  readonly labourTypeSaving = signal(false);
  readonly showVendorDialog = signal(false);
  readonly vendorDialogSaving = signal(false);
  readonly showInventoryInitDialog = signal(false);
  readonly showWorkerDialog = signal(false);
  // Per-project sub-contractor roster dialog — opens when the user
  // clicks "Add Row" on the new Subcontractors tab. Distinct from the
  // universal sub-contractor editor because the roster tab also
  // creates the underlying record when a new name is entered.
  readonly showSubcontractorDialog = signal(false);
  readonly subcontractorDialogSaving = signal(false);
  readonly assignmentDialogType = signal<"vendor" | "subcontractor" | null>(null);
  readonly assignmentSelection = signal("");
  readonly assignmentSelectedLabel = signal("");
  readonly assignmentCustomName = signal("");
  readonly assignmentSaving = signal(false);
  // The custom-styled vendor/subcontractor dropdown inside the assignment
  // dialog — `assignmentDropdownOpen` controls the panel, `assignmentSelectSearch`
  // powers the live filter inside the panel. Both are reset every time the
  // dialog opens or closes.
  readonly assignmentDropdownOpen = signal(false);
  readonly assignmentSelectSearch = signal("");
  readonly pendingVendorName = signal("");
  readonly pendingSubcontractorName = signal("");
  readonly editingInlineVendor = signal<{ id: string; vendorName: string; materialType: string; phoneNumber: string; address: string; gstNumber: string } | null>(null);
  readonly editingWorker = signal<Worker | null>(null);
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
    rows: this.activeSection() === "attendance" ? this.groupLabourRows(this.visibleRows("attendance")) : this.visibleRows(this.activeSection()),
    columns: this.columnsFor(this.activeSection()),
  }));
  readonly inventoryMaterialCards = computed((): InventoryMaterialCard[] => {
    const cards = new Map<string, InventoryMaterialCard>();
    for (const row of this.visibleRows("inventory")) {
      const name = String(row["materialName"] || "").trim().replace(/\s+/g, " ");
      if (!name) continue;
      const key = name.toLowerCase();
      const purchasedQuantity = this.moneyNumber(row["purchasedQuantity"]);
      const consumedQuantity = this.moneyNumber(row["consumedQuantity"]);
      const remainingStock = this.moneyNumber(row["remainingStock"]);
      const existing = cards.get(key);
      if (existing) {
        existing.purchasedQuantity += purchasedQuantity;
        existing.consumedQuantity += consumedQuantity;
        existing.remainingStock += remainingStock;
        if (!existing.unit) existing.unit = String(row["unit"] || "").trim();
        continue;
      }
      cards.set(key, {
        key,
        name,
        unit: String(row["unit"] || "").trim(),
        purchasedQuantity,
        consumedQuantity,
        remainingStock,
        sourceRow: row,
      });
    }
    return [...cards.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
  readonly inventoryUniqueMaterialCount = computed(() => {
    const projectId = this.projectId();
    const names = new Set<string>();
    for (const row of this.data.inventory()) {
      if (String(row.projectId || "") !== projectId) continue;
      const name = String(row.name || "").trim().replace(/\s+/g, " ").toLowerCase();
      if (name) names.add(name);
    }
    return names.size;
  });

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
      if (!projectId) return;
      this.data.touchProject(projectId);
      if (!this.data.projectById(projectId)) {
        void this.loadMissingProject(projectId);
      }
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
    // Legacy redirect: the "Labour" workspace tab was renamed "Attendance"
    // in this iteration. Anyone with a bookmarked URL like
    // /clients/:c/projects/:p/labour should land on the new tab.
    effect(() => {
      const raw = this.paramMap().get("section");
      if (raw === "labour") {
        const projectId = this.projectId();
        const clientId = this.clientId();
        if (projectId && clientId) {
          void this.router.navigate(
            ["/clients", clientId, "projects", projectId, "attendance"],
            { replaceUrl: true },
          );
        }
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
      // The "Attendance" tab is backed by the legacy /labour endpoint
      // (party-level wage lines) plus the Attendance collection (mobile
      // worker attendance). Both are merged in the table by
      // fetchAttendanceData; the mapper below normalises them.
      labour: () => this.api.listLabour({ limit: 200, projectId: this.projectId() }),
      attendance: () => this.api.listLabour({ limit: 200, projectId: this.projectId() }),
      expenses: () => this.api.listExpenses({ limit: 200, projectId: this.projectId() }),
      generalExpenses: () => this.api.listGeneralExpenses({ limit: 200, projectId: this.projectId() }),
      payments: () => this.api.listPayments({ limit: 200, projectId: this.projectId() }),
      vendors: () => this.api.listVendors({ limit: 200 }),
      // Subcontractors are universal across projects on the backend — never
      // filter by projectId here, or the dropdown will be empty when the
      // current project doesn't own the subs the user wants to pick.
      subcontractors: () => this.api.listSubcontractors({ limit: 200 }),
      // Subcontractor roster — same upstream call, but routed to the
      // per-project roster signal (not the universal subcontractors
      // signal). The roster view filters client-side by projectId.
      subcontractorsRoster: () => this.api.listSubcontractors({ limit: 200 }),
      inventory: () => this.api.listInventory({ limit: 200, projectId: this.projectId() }),
      workers: () => this.api.listWorkers({ limit: 200, projectId: this.projectId() }),
    };
    const mapperMap: Record<string, (x: any) => any> = {
      materials: mapMaterial,
      labour: mapLabour,
      attendance: mapLabour,
      expenses: mapExpense,
      generalExpenses: mapGeneralExpense,
      payments: mapPayment,
      vendors: mapVendor,
      subcontractors: mapSubcontractor,
      // Subcontractor roster — same upstream mapper as the universal
      // subcontractors table (the records are the same shape); the
      // per-project filter happens at render time in
      // `subcontractorRosterRows()`.
      subcontractorsRoster: mapSubcontractor,
      inventory: mapInventory,
      workers: mapWorker,
    };
    const storageMap: Record<string, string> = {
      materials: "agb-erp:materials",
      labour: "agb-erp:labour",
      attendance: "agb-erp:attendance",
      expenses: "agb-erp:expenses",
      generalExpenses: "agb-erp:generalExpenses",
      payments: "agb-erp:payments",
      vendors: "agb-erp:vendors",
      subcontractors: "agb-erp:subcontractors",
      // Reuses the universal subcontractors storage key — the roster
      // is a per-project filtered view of the same upstream data.
      subcontractorsRoster: "agb-erp:subcontractors",
      inventory: "agb-erp:inventory",
      workers: "agb-erp:workers",
    };
    const dataMap: Record<string, any> = {
      materials: this.data.materials,
      labour: this.data.labour,
      attendance: this.data.labour,
      expenses: this.data.expenses,
      generalExpenses: this.data.generalExpenses,
      payments: this.data.payments,
      vendors: this.data.vendors,
      subcontractors: this.data.subcontractors,
      // Roster reads from the same hydrated signal as the universal
      // subcontractors table; the project filter is applied at render
      // time so all workspaces share the cached list.
      subcontractorsRoster: this.data.subcontractors,
      inventory: this.data.inventory,
      workers: this.data.workers,
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

  trackInventoryCard = (_index: number, card: InventoryMaterialCard): string => card.key;

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

  selectedContainsExistingMaterial(): boolean {
    return this.activeSection() === "materials" && this.selectedRows().some((row) => row["isExistingMaterial"] === "Yes");
  }

  showRowCheckboxes(): boolean {
    return this.hasSelectedRows();
  }

  isRowChecked(row: TableRow): boolean {
    return this.selectedRowKeys().includes(this.rowKey(row));
  }

  toggleRowSelection(row: TableRow, event?: Event) {
    event?.stopPropagation();
    const key = this.rowKey(row);
    if (this.activeSection() === "materials") {
      this.selectedRowKeys.update((keys) => keys.includes(key)
        ? keys.filter((selectedKey) => selectedKey !== key)
        : [...keys, key]);
      this.selectedRowKey.set(this.selectedRowKeys()[0] ?? "");
      this.editingRowKey.set("");
      this.editingRowKeys.set([]);
      this.openSelectKey.set("");
      return;
    }
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
    if (this.activeSection() === "materials") {
      const rows = this.visibleRows("materials");
      if (this.allVisibleRowsSelected()) {
        this.clearRowSelection();
      } else {
        const keys = rows.map((row) => this.rowKey(row));
        this.selectedRowKeys.set(keys);
        this.selectedRowKey.set(keys[0] ?? "");
      }
      return;
    }
    if (this.hasSelectedRows()) {
      this.clearRowSelection();
    }
  }

  private selectedRows(): TableRow[] {
    const selected = new Set(this.selectedRowKeys());
    return this.visibleRows(this.activeSection()).filter((row) => selected.has(this.rowKey(row)));
  }

  async openSelectedMaterialDetails() {
    const [row] = this.selectedRows();
    if (!row || this.selectedRowCount() !== 1 || this.activeSection() !== "materials") return;
    await this.openMaterialDetails(row);
  }

  async openInventoryMaterialDetails(card: InventoryMaterialCard) {
    await this.openMaterialDetails({
      ...card.sourceRow,
      materialName: card.name,
      unit: card.unit,
    });
  }

  private async openMaterialDetails(row: TableRow) {
    this.materialDetailsOpen.set(true);
    this.materialDetailsLoading.set(true);
    this.materialDetailsError.set("");
    this.selectedMaterialDetails.set(null);

    try {
      const [materialsResponse, inventoryResponse] = await Promise.all([
        firstValueFrom(this.api.listMaterials({ projectId: this.projectId(), limit: 200 })),
        firstValueFrom(this.api.listInventory({ projectId: this.projectId(), limit: 200 })),
      ]);
      const normalizedName = String(row["materialName"] || "").trim().replace(/\s+/g, " ").toLowerCase();
      const matchingMaterials = (materialsResponse.items || []).filter((item: any) =>
        String(item.name || "").trim().replace(/\s+/g, " ").toLowerCase() === normalizedName,
      );
      const inventories = (inventoryResponse.items || []).filter((item: any) => {
        const inventoryName = String(item.name || "").trim().replace(/\s+/g, " ").toLowerCase();
        return inventoryName === normalizedName;
      });
      if (!matchingMaterials.length && !inventories.length) throw new Error("The selected material could not be found.");
      const material = [...matchingMaterials].sort((a: any, b: any) =>
        Date.parse(String(b.createdAt || b.requestDate || "")) - Date.parse(String(a.createdAt || a.requestDate || "")),
      )[0] || inventories[0] || {};

      let purchaseHistory = inventories.flatMap((item: any) =>
        (Array.isArray(item.purchaseHistory) ? item.purchaseHistory : [])
          .map((entry: any) => ({
            quantity: Number(entry.quantity) || 0,
            date: String(entry.date || ""),
            vendor: String(entry.vendor || item.vendor || material.vendor || ""),
            poNumber: String(entry.poNumber || item.poNumber || material.poNumber || ""),
            notes: String(entry.notes || ""),
          })),
      ).sort((a: any, b: any) => Date.parse(b.date) - Date.parse(a.date));
      if (!purchaseHistory.length) {
        purchaseHistory = inventories
          .map((item: any) => ({
            quantity: Number(item.purchasedQuantity) || 0,
            date: String(item.updatedAt || item.createdAt || ""),
            vendor: String(item.vendor || ""),
            poNumber: String(item.poNumber || ""),
            notes: String(item.notes || ""),
          }))
          .filter((entry: any) => entry.quantity > 0)
          .sort((a: any, b: any) => Date.parse(b.date) - Date.parse(a.date));
      }
      if (!purchaseHistory.length) {
        purchaseHistory = matchingMaterials
          .map((item: any) => ({
            quantity: Number(item.purchasedQuantity) || Number(item.approvedQuantity) || Number(item.requestedQuantity) || 0,
            date: String(item.orderedDate || item.requestDate || item.createdAt || ""),
            vendor: String(item.vendor || ""),
            poNumber: String(item.poNumber || ""),
            notes: String(item.notes || ""),
          }))
          .filter((entry: any) => entry.quantity > 0)
          .sort((a: any, b: any) => Date.parse(b.date) - Date.parse(a.date));
      }
      let consumptionHistory = inventories.flatMap((item: any) =>
        (Array.isArray(item.consumptionHistory) ? item.consumptionHistory : []).map((entry: any) => ({
          quantity: Number(entry.quantity) || 0,
          date: String(entry.date || ""),
          notes: String(entry.notes || ""),
        })),
      ).sort((a: any, b: any) => Date.parse(b.date) - Date.parse(a.date));
      if (!consumptionHistory.length) {
        consumptionHistory = inventories
          .map((item: any) => ({
            quantity: Number(item.consumedQuantity) || 0,
            date: String(item.updatedAt || item.createdAt || ""),
            notes: Number(item.consumedQuantity) > 0 ? "Recorded inventory consumption total" : "",
          }))
          .filter((entry: any) => entry.quantity > 0)
          .sort((a: any, b: any) => Date.parse(b.date) - Date.parse(a.date));
      }

      const inventoryHasActivity = inventories.some((item: any) =>
        (Number(item.remainingStock) || 0) > 0
        || (Number(item.purchasedQuantity) || 0) > 0
        || (Number(item.consumedQuantity) || 0) > 0
        || (Array.isArray(item.purchaseHistory) && item.purchaseHistory.length > 0)
        || (Array.isArray(item.consumptionHistory) && item.consumptionHistory.length > 0),
      );
      const materialPurchased = matchingMaterials.reduce((sum: number, item: any) => sum + (Number(item.purchasedQuantity) || 0), 0);
      const materialApproved = matchingMaterials.reduce((sum: number, item: any) => sum + (Number(item.approvedQuantity) || 0), 0);
      const materialRequested = matchingMaterials.reduce((sum: number, item: any) => sum + (Number(item.requestedQuantity) || 0), 0);
      const materialConsumed = matchingMaterials.reduce((sum: number, item: any) => sum + (Number(item.consumedQuantity) || 0), 0);
      const materialRemaining = matchingMaterials.reduce((sum: number, item: any) => sum + (Number(item.remainingStock) || 0), 0);
      const inventoryPurchased = inventories.reduce((sum: number, item: any) => sum + (Number(item.purchasedQuantity) || 0), 0);
      const inventoryConsumed = inventories.reduce((sum: number, item: any) => sum + (Number(item.consumedQuantity) || 0), 0);
      const inventoryRemaining = inventories.reduce((sum: number, item: any) => sum + (Number(item.remainingStock) || 0), 0);
      const fallbackPurchases = materialPurchased || materialApproved || materialRequested;
      const fallbackStock = materialRemaining || Math.max(0, fallbackPurchases - materialConsumed);

      this.selectedMaterialDetails.set({
        name: String(material.name || row["materialName"] || "Material"),
        unit: String(material.unit || row["unit"] || ""),
        currentStock: inventoryHasActivity ? inventoryRemaining : fallbackStock,
        // Prefer the Material record's purchasedQuantity (the "quantity"
        // the user typed when adding the material) since that is the
        // actual figure. Inventory's purchaseHistory can carry stale
        // entries from the older initialization flow, so we only fall
        // back to it when the Material record has no purchase figure.
        purchases: fallbackPurchases > 0
          ? fallbackPurchases
          : (purchaseHistory.length
            ? purchaseHistory.reduce((sum: number, entry: any) => sum + entry.quantity, 0)
            : (inventoryHasActivity ? inventoryPurchased : 0)),
        consumed: inventoryHasActivity ? inventoryConsumed : materialConsumed,
        notes: String(material.notes || inventories.find((item: any) => item.notes)?.notes || ""),
        purchaseHistory,
        consumptionHistory,
      });
    } catch (err: any) {
      this.materialDetailsError.set(err?.error?.message || err?.message || "Could not load the material details.");
    } finally {
      this.materialDetailsLoading.set(false);
    }
  }

  closeMaterialDetails() {
    this.materialDetailsOpen.set(false);
    this.materialDetailsLoading.set(false);
    this.materialDetailsError.set("");
    this.selectedMaterialDetails.set(null);
  }

  async createPurchaseOrderFromSelection() {
    const rows = this.selectedRows();
    if (!rows.length) return;
    let backendMaterials: any[] = [];
    try {
      const response = await firstValueFrom(this.api.listMaterials({ projectId: this.projectId(), limit: 200 }));
      backendMaterials = response.items || [];
    } catch {
      await this.presentToast("Could not verify the selected materials. Please try again.", "danger");
      return;
    }
    const resolved = rows.map((row) => {
      const mongoId = String(row["_id"] || "").trim();
      const materialId = String(row["materialId"] || row["id"] || "").trim();
      return backendMaterials.find((material) =>
        (mongoId && String(material._id) === mongoId)
        || (materialId && String(material.materialId) === materialId));
    });
    const unavailable = resolved.filter((material) => {
      if (!material?._id) return true;
      const poNumber = String(material.poNumber || "").trim();
      return poNumber !== "" && poNumber !== "Pending";
    });
    if (resolved.some((material) => Boolean(material?.isExistingMaterial))) {
      await this.presentToast(
        "Existing inventory materials cannot be added to a purchase order. Select only materials that still need to be ordered.",
        "warning",
      );
      return;
    }
    if (unavailable.length || resolved.some((material) => !material)) {
      await this.presentToast(
        "One or more selected materials are already assigned to a purchase order or could not be found.",
        "danger",
      );
      return;
    }
    const materialIds = resolved.map((material) => String(material._id));
    void this.router.navigate(["/purchase-orders"], {
      queryParams: {
        create: "1",
        projectId: this.projectId(),
        projectName: this.project()?.name || "",
        materials: materialIds.join(","),
      },
    });
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
      generalExpenses: (id) => this.api.deleteGeneralExpense(id),
      payments: (id) => this.api.deletePayment(id),
      vendors: (id) => this.api.deleteVendor(id),
      subcontractors: (id) => this.api.deleteSubcontractor(id),
      // Roster deletes target the same sub-contractor record — the
      // roster is just a per-project filtered view of the same data.
      subcontractorsRoster: (id) => this.api.deleteSubcontractor(id),
      workers: (id) => this.api.deleteWorker(id),
    };
    const dataMap: Record<string, any> = {
      materials: this.data.materials,
      labour: this.data.labour,
      expenses: this.data.expenses,
      generalExpenses: this.data.generalExpenses,
      payments: this.data.payments,
      vendors: this.data.vendors,
      subcontractors: this.data.subcontractors,
      // Roster deletes target the same global signal.
      subcontractorsRoster: this.data.subcontractors,
      workers: this.data.workers,
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
      attendance: (opts: any) => this.api.listLabour(opts),
      expenses: (opts: any) => this.api.listExpenses(opts),
      payments: (opts: any) => this.api.listPayments(opts),
      vendors: (opts: any) => this.api.listVendors(opts),
      subcontractors: (opts: any) => this.api.listSubcontractors(opts),
      // Subcontractor roster — pulls the same upstream list as the
      // universal subcontractors table; the per-project filter is
      // applied client-side in `subcontractorRosterRows()`.
      subcontractorsRoster: (opts: any) => this.api.listSubcontractors(opts),
      inventory: (opts: any) => this.api.listInventory(opts),
      workers: (opts: any) => this.api.listWorkers(opts),
    };
    const mapperMap: Record<string, (x: any) => any> = {
      materials: mapMaterial,
      labour: mapLabour,
      attendance: mapLabour,
      expenses: mapExpense,
      generalExpenses: mapGeneralExpense,
      payments: mapPayment,
      vendors: mapVendor,
      subcontractors: mapSubcontractor,
      // Subcontractor roster — same upstream mapper as the universal
      // subcontractors table (the records are the same shape); the
      // per-project filter happens at render time in
      // `subcontractorRosterRows()`.
      subcontractorsRoster: mapSubcontractor,
      inventory: mapInventory,
      workers: mapWorker,
    };
    const storageMap: Record<string, string> = {
      materials: "agb-erp:materials",
      labour: "agb-erp:labour",
      attendance: "agb-erp:attendance",
      expenses: "agb-erp:expenses",
      generalExpenses: "agb-erp:generalExpenses",
      payments: "agb-erp:payments",
      vendors: "agb-erp:vendors",
      subcontractors: "agb-erp:subcontractors",
      // Reuses the universal subcontractors storage key — the roster
      // is a per-project filtered view of the same upstream data.
      subcontractorsRoster: "agb-erp:subcontractors",
      inventory: "agb-erp:inventory",
      workers: "agb-erp:workers",
    };
    const dataMap: Record<string, any> = {
      materials: this.data.materials,
      labour: this.data.labour,
      attendance: this.data.labour,
      expenses: this.data.expenses,
      generalExpenses: this.data.generalExpenses,
      payments: this.data.payments,
      vendors: this.data.vendors,
      subcontractors: this.data.subcontractors,
      // Roster reads from the same hydrated signal as the universal
      // subcontractors table; the project filter is applied at render
      // time so all workspaces share the cached list.
      subcontractorsRoster: this.data.subcontractors,
      inventory: this.data.inventory,
      workers: this.data.workers,
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
    if (!target.closest(".material-note-history")) {
      this.openMaterialNoteHistoryKey.set("");
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
    this.assignmentDropdownOpen.set(false);
    this.assignmentSelectSearch.set("");
  }

  columnsFor(section: ModuleKey): FieldSchema[] {
    const base = sectionConfigs.find((config) => config.key === section)?.columns ?? [];
    const custom = this.data.customFieldsFor(section);
    const hidden = new Set(this.data.hiddenFieldsFor(section));
    const columns = section === "attendance" ? this.withLabourWageColumns(base, custom) : this.data.composeTableColumns(base, custom);
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
    if (section === "attendance") {
      // The bulk roster (subcontractor-attendance) is a single row per
      // (sub, date) with all labour types embedded — that's the
      // authoritative record the supervisor mobile app submits. The
      // legacy /labour rows still flow into `rows` (one row per
      // labourType); drop the legacy duplicates so the table doesn't
      // show a fake "3 entries" badge for what's actually one muster.
      const bulk = this.attendanceRows();
      const bulkKeys = new Set(
        bulk
          .filter((row) => row["__source"] === "subcontractor-attendance")
          .map((row) => `${String(row["subcontractorName"] || "").trim()}||${String(row["attendanceDate"] || "").trim()}`)
      );
      rows = rows.filter(
        (row) =>
          !row["subcontractorName"] ||
          !row["attendanceDate"] ||
          !bulkKeys.has(`${String(row["subcontractorName"] || "").trim()}||${String(row["attendanceDate"] || "").trim()}`)
      );
      rows = [...rows, ...bulk];
    }
    if (section === "materials") {
      rows = this.consolidateMaterialRows(rows);
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
        ([key, value]) => !value || this.matchesFilterValue(row[key], value),
      );
      const matchesDate =
        !dateKey ||
        (!range.start && !range.end) ||
        this.dateInRange(this.normalizedDateValue(row[dateKey]), range.start, range.end);
      return matchesFilters && matchesDate;
    });
    if (section === "materials") {
      rows = [...rows].sort((a, b) => {
        const byCreated = this.materialSortValue(b) - this.materialSortValue(a);
        if (byCreated !== 0) return byCreated;
        return String(b["_id"] || b["materialId"] || "").localeCompare(String(a["_id"] || a["materialId"] || ""));
      });
    }
    return rows;
  }

  private consolidateMaterialRows(rows: TableRow[]): TableRow[] {
    const groups = new Map<string, TableRow[]>();
    for (const row of rows) {
      const key = String(row["materialName"] || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
      if (!key) continue;
      groups.set(key, [...(groups.get(key) || []), row]);
    }

    return [...groups.entries()].map(([key, group]) => {
      const sorted = [...group].sort((a, b) => this.materialSortValue(b) - this.materialSortValue(a));
      const newest = sorted[0];
      const sum = (field: string) => group.reduce((total, row) => total + this.moneyNumber(row[field]), 0);
      const existingCount = group.filter((row) => row["isExistingMaterial"] === "Yes").length;
      const issuedAmount = sum("issuedAmount");
      const givenAmount = sum("givenAmount");
      return {
        ...newest,
        __rowId: `material-group:${key}`,
        quantity: formatNumber(sum("quantity")),
        issuedAmount: existingCount === group.length ? "Existing material" : issuedAmount,
        givenAmount: existingCount === group.length ? "Existing material" : givenAmount,
        isExistingMaterial: existingCount === group.length ? "Yes" : "",
        vendor: [...new Set(group.map((row) => String(row["vendor"] || "").trim()).filter(Boolean))].join(", "),
        poNumber: [...new Set(group.map((row) => String(row["poNumber"] || "").trim()).filter(Boolean))].join(", "),
        __noteHistoryJson: JSON.stringify(this.consolidatedMaterialNoteHistory(group)),
      };
    });
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
    this.selectedFilterFields.set(this.filterableColumns().map((column) => column.key));
    this.filterBuilderStep.set("values");
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

  private matchesFilterValue(raw: unknown, query: string): boolean {
    const haystack = String(raw ?? "").toLowerCase();
    const needle = query.trim().toLowerCase();
    if (haystack.includes(needle)) return true;
    const numericNeedle = needle.replace(/[^0-9.+-]/g, "");
    return Boolean(numericNeedle && /\d/.test(numericNeedle) && haystack.replace(/[^0-9.+-]/g, "").includes(numericNeedle));
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
    const section = this.activeSection();
    const values = new Set<string>();
    for (const option of this.selectOptions(section, key)) {
      if (option) values.add(option);
    }
    const baseRows = this.data.tableRowsFor(section, this.tableRows()[section] ?? [], (entry) => this.rowBelongsToProject(entry));
    // The Attendance tab is also fed by the dedicated subcontractor
    // bulk-muster collection (see `fetchAttendanceData`). Merge those rows
    // in here so the filter dropdowns see the same data the table shows —
    // otherwise the bulk muster's subcontractor / date / staff values are
    // invisible to the filter UI.
    const rows = section === "attendance"
      ? this.withComputedRows(section, [...baseRows, ...this.attendanceRows()])
      : this.withComputedRows(section, baseRows);
    for (const row of rows) {
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
    for (const column of this.filterableColumns()) {
      const value = this.selectedFilters()[column.key];
      if (value) summary.push(`${column.label}: ${value}`);
    }
    if (this.dateRangeLabel()) summary.push(`Date: ${this.dateRangeLabel()}`);
    return summary;
  }

  private dateFilterKey(section: ModuleKey): string {
    if (section === "materials") return "requestDate";
    if (section === "attendance") return "attendanceDate";
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
    if (this.activeSection() === "workers") {
      // Workers have their own dialog (Name / Phone / Role / Address / Notes /
      // Site) — distinct from the generic column-driven record form used by
      // materials, expenses, etc.
      this.editingWorker.set(null);
      this.refreshSectionFromBackend("subcontractors");
      this.showWorkerDialog.set(true);
      return;
    }
    if (this.activeSection() === "subcontractorsRoster") {
      // Per-project sub-contractor roster uses a dedicated dialog
      // (Name / Address / Phone / Notes / Status). The form either
      // reuses an existing record (by name) or creates a new one —
      // either way the record appears on this project's roster AND on
      // the universal sub-contractors page.
      this.showSubcontractorDialog.set(true);
      return;
    }
    const row: TableRow = { ...this.defaultRowFor(this.activeSection()) };
    this.draftRow.set(row);
    for (const column of this.recordFormColumns()) {
      const options = this.selectOptions(this.activeSection(), column.key);
      // A new material must start blank. Auto-selecting the first known
      // material made every dialog appear as "Bricks" and could save the
      // wrong material when the user only intended to open the form.
      if (this.activeSection() === "materials" && (column.key === "materialName" || column.key === "unit")) {
        row[column.key] = "";
        continue;
      }
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
    // Load only subcontractors assigned to this project for payments.
    if (this.activeSection() === "subcontractors") {
      void this.loadAllSubcontractorNames();
    }
    if (this.activeSection() === "materials") {
      void this.loadAllMaterialNames();
    }
  }

  closeInventoryInitDialog() {
    this.showInventoryInitDialog.set(false);
  }

  // ---- Worker roster dialog state ----
  readonly workerDialogSaving = signal(false);

  workerEditValue(): WorkerFormValue | null {
    const editing = this.editingWorker();
    if (!editing) return null;
    return {
      name: editing.name,
      phone: editing.phone,
      labourType: editing.labourType,
      address: editing.address,
      notes: editing.notes,
      subcontractorId: String(editing.subcontractorId || ""),
      subcontractorName: editing.subcontractorName || "",
    };
  }

  workerSubcontractorOptions(): Array<{ id: string; name: string }> {
    const projectId = this.projectId();
    return this.data.subcontractors()
      .filter((row) => row.status !== "inactive" && (!row.projectId || String(row.projectId) === projectId))
      .map((row) => ({
        id: String(row._id || row.id || ""),
        name: String(row.subcontractorName || "").trim(),
      }))
      .filter((row) => Boolean(row.id && row.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  closeWorkerDialog() {
    this.showWorkerDialog.set(false);
    this.editingWorker.set(null);
  }

  async createWorkerEntry(value: WorkerFormValue) {
    if (this.workerDialogSaving()) return;
    if (!this.projectId()) {
      await this.presentToast("Select a project before adding a worker.", "warning");
      return;
    }
    this.workerDialogSaving.set(true);
    this.api
      .createWorker({
        projectId: this.projectId(),
        name: value.name,
        phone: value.phone || undefined,
        address: value.address || undefined,
        notes: value.notes || undefined,
        labourType: value.labourType,
        isSubcontract: true,
        subcontractorId: value.subcontractorId,
        subcontractorName: value.subcontractorName,
      })
      .subscribe({
        next: () => {
          this.workerDialogSaving.set(false);
          this.closeWorkerDialog();
          this.refreshFromBackend();
        },
        error: async (err) => {
          this.workerDialogSaving.set(false);
          await this.presentToast(
            err?.error?.message || err?.message || "Could not save the worker.",
            "danger",
          );
        },
      });
  }

  async updateWorkerEntry(value: WorkerFormValue) {
    const editing = this.editingWorker();
    if (!editing) return;
    const mongoId = String(editing._id || editing.id || "").trim();
    if (!mongoId) return;
    if (this.workerDialogSaving()) return;
    this.workerDialogSaving.set(true);
    this.api
      .patchWorker(mongoId, {
        name: value.name,
        phone: value.phone || undefined,
        address: value.address || undefined,
        notes: value.notes || undefined,
        labourType: value.labourType,
        subcontractorId: value.subcontractorId,
        subcontractorName: value.subcontractorName,
      })
      .subscribe({
        next: () => {
          this.workerDialogSaving.set(false);
          this.closeWorkerDialog();
          this.refreshFromBackend();
        },
        error: async (err) => {
          this.workerDialogSaving.set(false);
          await this.presentToast(
            err?.error?.message || err?.message || "Could not save the worker.",
            "danger",
          );
        },
      });
  }

  /** Edit trigger — wired to the row-action toolbar in the workers tab. */
  openWorkerEdit(row: TableRow) {
    const worker = this.data.workers().find((entry) =>
      String(entry._id || entry.id) === String(row["_id"] || row["id"] || ""),
    );
    if (!worker) return;
    this.editingWorker.set(worker);
    this.showWorkerDialog.set(true);
  }

  onInventoryInitSaved() {
    const pid = this.projectId();
    this.api.listMaterials({ limit: 200, projectId: pid }).subscribe({
      next: (r: any) => {
        try {
          const items = ((r as any).items || []).map(mapMaterial);
          this.data.materials.set(items);
          this.materialsService.materials.set(items);
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

  openAssignmentDialog(type: "vendor" | "subcontractor") {
    this.assignmentDialogType.set(type);
    this.assignmentSelection.set("");
    this.assignmentSelectedLabel.set("");
    this.assignmentCustomName.set("");
    this.assignmentSaving.set(false);
    this.assignmentDropdownOpen.set(false);
    this.assignmentSelectSearch.set("");
    if (type === "vendor") {
      this.refreshSectionFromBackend("vendors");
    } else {
      // Load the complete accessible roster without a project/status filter.
      // The picker itself removes profiles already assigned to this project.
      this.api.listSubcontractors({ limit: 500 }).subscribe({
        next: (response) => this.data.subcontractors.set((response.items || []).map(mapSubcontractor)),
        error: () => this.refreshSectionFromBackend("subcontractors"),
      });
    }
  }

  openNewAssignmentForm(type: "vendor" | "subcontractor") {
    this.closeAssignmentDialog();
    if (type === "vendor") {
      this.pendingVendorName.set("");
      this.editingInlineVendor.set(null);
      this.showVendorDialog.set(true);
      return;
    }
    this.pendingSubcontractorName.set("");
    this.showSubcontractorDialog.set(true);
  }

  closeAssignmentDialog() {
    this.assignmentDialogType.set(null);
    this.assignmentSelection.set("");
    this.assignmentSelectedLabel.set("");
    this.assignmentCustomName.set("");
    this.assignmentSaving.set(false);
    this.assignmentDropdownOpen.set(false);
    this.assignmentSelectSearch.set("");
  }

  toggleAssignmentDropdown() {
    this.assignmentDropdownOpen.update((current) => !current);
    if (!this.assignmentDropdownOpen()) this.assignmentSelectSearch.set("");
  }

  closeAssignmentDropdown() {
    this.assignmentDropdownOpen.set(false);
    this.assignmentSelectSearch.set("");
  }

  /**
   * Resolve the label that should appear in the assignment trigger.
   * Falls back to "Custom — create new" when the user is typing a new
   * name, otherwise shows the picked vendor/subcontractor name.
   */
  assignmentTriggerLabel(): string {
    const selection = this.assignmentSelection();
    if (selection === "__custom__") {
      const custom = this.assignmentCustomName().trim();
      return custom ? `${custom} (new)` : "Custom — create new";
    }
    if (!selection) return "Select an existing profile";
    return this.assignmentSelectedLabel() || "Select an existing profile";
  }

  /**
   * Filter the assignment dropdown by the live search input. When the
   * search box is empty the full list is returned so the panel behaves
   * the same way as the other dropdowns in the project.
   */
  filteredAssignmentOptions(): AssignmentOption[] {
    const query = this.assignmentSelectSearch().trim().toLowerCase();
    return this.assignmentOptions().filter((option) =>
      !query || option.name.toLowerCase().includes(query),
    );
  }

  /**
   * Persist the user's pick from the dropdown, then close the panel.
   * When the user picks the Custom option we also focus the new-name
   * input so they can start typing immediately.
   */
  selectAssignmentOption(value: string, customInput?: HTMLInputElement, label = "") {
    this.assignmentSelection.set(value);
    this.assignmentSelectedLabel.set(value === "__custom__" ? "Custom — create new" : label);
    this.assignmentDropdownOpen.set(false);
    this.assignmentSelectSearch.set("");
    if (value === "__custom__") {
      // Defer to the next tick so the input has rendered before we focus it.
      setTimeout(() => customInput?.focus(), 0);
    }
  }

  selectExistingAssignment(option: AssignmentOption, event?: PointerEvent) {
    // Select on pointerdown so the document-level transient UI handler cannot
    // remove the option button before its later click event is dispatched.
    // Preventing the default also keeps focus in the search field and avoids a
    // second synthetic activation; the click binding remains for keyboard use.
    event?.preventDefault();
    event?.stopPropagation();
    this.selectAssignmentOption(option.id, undefined, option.name);
  }

  assignmentOptions(): AssignmentOption[] {
    const type = this.assignmentDialogType();
    const projectId = this.projectId();
    const byId = new Map<string, AssignmentOption>();
    if (type === "vendor") {
      for (const vendor of this.data.vendors()) {
        const name = String(vendor.name || "").trim();
        const id = String(vendor._id || "").trim();
        if (!name || !id) continue;
        const assigned = (vendor.projectIds || []).some((value) => String(value) === projectId);
        if (assigned || byId.has(id)) continue;
        byId.set(id, { id, name });
      }
    }
    if (type === "subcontractor") {
      for (const subcontractor of this.data.subcontractors()) {
        const name = String(subcontractor.subcontractorName || "").trim();
        const id = String(subcontractor._id || subcontractor.id || "").trim();
        if (!name || !id) continue;
        const assigned = String(subcontractor.projectId || "") === projectId
          || (subcontractor.projectIds || []).some((value) => String(value) === projectId);
        if (assigned || byId.has(id)) continue;
        byId.set(id, { id, name });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  pendingVendorValue(): VendorFormValue | null {
    const name = this.pendingVendorName();
    return name ? { name, materialType: "", phone: "", address: "", gst: "", gstType: "Non-GST" } : null;
  }

  pendingSubcontractorValue(): SubcontractorFormValue | null {
    const subcontractorName = this.pendingSubcontractorName();
    return subcontractorName
      ? { subcontractorName, address: "", phone: "", gstType: "Non-GST", gstNumber: "", notes: "", status: "active" }
      : null;
  }

  async saveAssignment(event: Event) {
    event.preventDefault();
    if (this.assignmentSaving()) return;
    const type = this.assignmentDialogType();
    const selection = this.assignmentSelection();
    const projectId = this.projectId();
    if (!type || !selection || !projectId) return;

    if (selection === "__custom__") {
      const name = this.assignmentCustomName().trim();
      if (!name) {
        await this.presentToast(`Enter the new ${type} name.`, "warning");
        return;
      }
      this.closeAssignmentDialog();
      if (type === "vendor") {
        this.pendingVendorName.set(name);
        this.editingInlineVendor.set(null);
        this.showVendorDialog.set(true);
      } else {
        this.pendingSubcontractorName.set(name);
        this.showSubcontractorDialog.set(true);
      }
      return;
    }

    this.assignmentSaving.set(true);
    try {
      if (type === "vendor") {
        const vendor = this.data.vendors().find((item) => String(item._id || "") === selection);
        if (!vendor) throw new Error("Vendor not found");
        const projectIds = [...new Set([...(vendor.projectIds || []), projectId])];
        await firstValueFrom(this.api.patchVendor(selection, { projectIds }));
        this.refreshSectionFromBackend("vendors");
      } else {
        const subcontractor = this.data.subcontractors().find((item) => String(item._id || item.id || "") === selection);
        if (!subcontractor) throw new Error("Subcontractor not found");
        const projectIds = [...new Set([...(subcontractor.projectIds || []), subcontractor.projectId, projectId].filter(Boolean))];
        const response = await firstValueFrom(this.api.patchSubcontractor(selection, { projectIds }));
        const saved = response?.subcontractor ? mapSubcontractor(response.subcontractor) : null;
        this.data.subcontractors.update((items) => items.map((item) => {
          const itemId = String(item._id || item.id || "");
          if (itemId !== selection) return item;
          return saved || { ...item, projectIds };
        }));
        this.refreshSectionFromBackend("subcontractors");
        this.refreshSectionFromBackend("subcontractorsRoster");
      }
      this.closeAssignmentDialog();
      await this.presentToast(`${type === "vendor" ? "Vendor" : "Subcontractor"} assigned to this project.`);
    } catch (err: any) {
      this.assignmentSaving.set(false);
      await this.presentToast(err?.error?.message || err?.message || "Could not save the assignment.", "danger");
    }
  }

  closeVendorDialog() {
    this.showVendorDialog.set(false);
    this.vendorDialogSaving.set(false);
    this.editingInlineVendor.set(null);
    this.pendingVendorName.set("");
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
      gstType: v.gstNumber ? "GST" : "Non-GST",
    };
  }

  createInlineVendor(value: VendorFormValue) {
    if (this.vendorDialogSaving()) return;
    const name = value.name?.trim() || "";
    const materialType = value.materialType?.trim() || "";
    const phone = value.phone?.trim() || "";
    const gst = value.gst?.trim() || "";
    const address = value.address?.trim() || "";
    if (!name || !materialType || !phone || !address) {
      this.presentToast(
        "Fill the vendor name, material type, phone, and address before saving. GST is optional.",
        "warning",
      );
      return;
    }
    const projectId = this.projectId();
    if (!projectId) {
      this.presentToast("Select a project before adding a vendor.", "warning");
      return;
    }
    const existing = this.data.vendors().find((vendor) => vendor.name.trim().toLowerCase() === name.toLowerCase());
    this.vendorDialogSaving.set(true);
    if (existing?._id) {
      const projectIds = [...new Set([...(existing.projectIds || []), projectId].filter(Boolean))];
      this.api.patchVendor(existing._id, { projectIds }).subscribe({
        next: () => {
          this.closeVendorDialog();
          this.refreshSectionFromBackend("vendors");
          this.presentToast(`${name} assigned to this project.`);
        },
        error: (err) => {
          this.vendorDialogSaving.set(false);
          console.error("Failed to assign existing vendor", err);
          this.presentToast("Could not assign the existing vendor. Please try again.", "danger");
        },
      });
      return;
    }
    const payload = {
      name,
      materialType,
      phone,
      address,
      gstNumber: gst,
      gstType: value.gstType,
      status: "Active",
      siteIds: [],
      projectIds: [projectId],
    };
    this.api.createVendor(payload).subscribe({
      next: () => {
        this.closeVendorDialog();
        this.refreshSectionFromBackend("vendors");
        this.presentToast(`${name} created and assigned to this project.`);
      },
      error: (err) => {
        this.vendorDialogSaving.set(false);
        console.error("Failed to create vendor", err);
        this.presentToast(
          err?.error?.message || "Could not create the vendor. Please try again.",
          "danger",
        );
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
      gstType: value.gstType,
      status: "Active",
      siteIds: [],
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
          gstType: value.gstType,
          status: "Active",
        });
      },
      error: (err) => {
        console.error("Failed to update vendor", err);
      },
    });
  }

  closeSubcontractorDialog() {
    this.showSubcontractorDialog.set(false);
    this.subcontractorDialogSaving.set(false);
    this.pendingSubcontractorName.set("");
  }

  /**
   * Create (or upsert) a sub-contractor from the per-project roster
   * dialog. If a record with the same name already exists on this
   * project we patch it with the new fields instead of creating a
   * duplicate; otherwise we POST a new sub-contractor. Either way the
   * record ends up in `data.subcontractors`, which is the source the
   * roster view filters against — so the new row appears on the
   * project workspace AND on the universal sub-contractors page.
   */
  createRosterSubcontractor(value: SubcontractorFormValue) {
    if (this.subcontractorDialogSaving()) return;
    const projectId = this.projectId();
    if (!projectId) {
      this.presentToast("Select a project before adding a sub-contractor.", "warning");
      return;
    }
    const name = String(value.subcontractorName || "").trim();
    if (!name) {
      this.presentToast("Sub-contractor name is required.", "warning");
      return;
    }
    this.subcontractorDialogSaving.set(true);
    const payload = {
      projectId,
      subcontractorName: name,
      address: String(value.address || "").trim() || undefined,
      phone: String(value.phone || "").trim() || undefined,
      gstType: value.gstType,
      gstNumber: value.gstType === "GST" ? value.gstNumber.trim().toUpperCase() : "",
      note: String(value.notes || "").trim() || undefined,
      status: (value.status === "inactive" ? "inactive" : "active") as
        | "active"
        | "inactive",
    };
    const existing = this.data.subcontractors().find(
      (s) => String(s.subcontractorName || "").trim().toLowerCase() === name.toLowerCase(),
    );
    const finalize = () => {
      this.showSubcontractorDialog.set(false);
      this.subcontractorDialogSaving.set(false);
      this.pendingSubcontractorName.set("");
      try {
        // Refresh the global subcontractors signal from the backend so
        // the new/updated record is reflected in both this roster view
        // AND the universal sub-contractors page.
        this.refreshSectionFromBackend("subcontractors");
        this.refreshSectionFromBackend("subcontractorsRoster");
      } catch {}
      this.presentToast(
        existing && existing.id
          ? `${name} assigned to this project.`
          : `${name} created and assigned to this project.`,
      );
    };
    const onError = (err: unknown) => {
      this.subcontractorDialogSaving.set(false);
      console.error("Failed to save sub-contractor from roster", err);
      this.presentToast("Could not save sub-contractor. Please try again.", "danger");
    };
    if (existing && existing.id) {
      const projectIds = [...new Set([...(existing.projectIds || []), existing.projectId, projectId].filter(Boolean))];
      this.api.patchSubcontractor(existing.id, { ...payload, projectIds }).subscribe({
        next: finalize,
        error: onError,
      });
    } else {
      this.api.createSubcontractor(payload).subscribe({
        next: finalize,
        error: onError,
      });
    }
  }

  recordFormColumns(): FieldSchema[] {
    const hiddenInExpenseForm = new Set(["approvalStatus", "openingBalance", "runningBalance"]);
    const hiddenInMaterialForm = new Set([
      "requestedQuantity",
      "approvedQuantity",
      "poNumber",
      "reference",
      "remainingStock",
      "status",
      "vendor",
      "receivedDate",
    ]);
    const cashAddedFields = new Set(["expenseDate", "transactionType", "description", "amount", "site", "supervisor", "reference"]);
    return this.columnsFor(this.activeSection()).filter((column) => {
      if (this.activeSection() === "expenses" && hiddenInExpenseForm.has(column.key)) return false;
      if (this.activeSection() === "materials" && hiddenInMaterialForm.has(column.key)) return false;
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
      // Materials: when the user picks an existing material name, auto-fill
      // (or refresh) the Unit from the same-named row so they don't have
      // to re-type it. We always overwrite so a stale Unit from a prior
      // selection doesn't bleed into the new one. The user can still
      // override Unit manually after this.
      if (this.activeSection() === "materials" && key === "materialName") {
        const matchedUnit = this.preferredUnitForMaterialName(String(value || ""));
        if (matchedUnit) {
          nextRow["unit"] = matchedUnit;
        }
      }
      return nextRow;
    });
  }

  private preferredUnitForMaterialName(name: string): string {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) return "";
    const candidates: { unit: string }[] = [];
    for (const material of this.materialsService.materials()) {
      if (
        String(material.name || "").trim().toLowerCase() === normalized
        && String(material.unit || "").trim()
      ) {
        candidates.push({ unit: String(material.unit).trim() });
      }
    }
    if (!candidates.length) {
      for (const row of this.data.tableRowsFor("materials", this.tableRows().materials ?? [], (entry) => this.rowBelongsToProject(entry))) {
        const rowName = String(row["materialName"] || row["name"] || "").trim().toLowerCase();
        const rowUnit = String(row["unit"] || "").trim();
        if (rowName === normalized && rowUnit) {
          candidates.push({ unit: rowUnit });
        }
      }
    }
    return candidates[0]?.unit || "";
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
    if (this.activeSection() === "subcontractors" && column.key === "description") {
      return "Work Description (optional)";
    }
    return this.activeSection() === "expenses" && column.key === "amount" ? "Total Amount" : column.label;
  }

  async saveRecord(event: Event) {
    event.preventDefault();
    if (this.recordSaving()) return; // guard against double-submit
    const section = this.activeSection();
    const currentProject = this.project();
    const selectedSite = this.activeSiteFilter();
    const draft = section === "expenses" ? this.normalizedExpenseInputRow(this.draftRow()) : this.draftRow();
    if (section === "payments") this.registerPaymentMode(String(draft["mode"] || ""));
    if (section === "expenses") this.ensureExpenseOpeningForInput(draft);

    this.recordSaving.set(true);
    try {
      await this.performSaveRecord(section, currentProject, selectedSite, draft);
    } finally {
      this.recordSaving.set(false);
    }
  }

  private async performSaveRecord(
    section: ModuleKey,
    currentProject: any,
    selectedSite: string,
    draft: any
  ): Promise<void> {

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
        await this.presentToast("Select a project before saving a cash entry.", "warning");
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
      } catch (err: any) {
        console.error("[ProjectWorkspace] Failed to create Cash Added expense", err);
        await this.presentToast(
          err?.error?.message || err?.message || "Could not save the cash entry.",
          "danger",
        );
        return;
      }
    }

    if (section === "subcontractors") {
      await this.saveSubcontractorPaymentDraft(draft, selectedSite);
      return;
    }

    if (section === "generalExpenses") {
      await this.saveGeneralExpenseDraft(draft, selectedSite);
      return;
    }

    if (section === "materials") {
      const quantity = Number(draft["quantity"]);
      const materialInput: Partial<MaterialRow> = {
        projectId: this.projectId() || undefined,
        site: String(draft["site"] || selectedSite || ""),
        name: String(draft["materialName"] || draft["description"] || ""),
        unit: String(draft["unit"] || ""),
        requested: quantity,
        quantity,
        approved: quantity,
        purchased: quantity,
        requestDate: String(draft["requestDate"] || new Date().toISOString().slice(0, 10)),
        issuedAmount: Math.max(0, Number(draft["issuedAmount"]) || 0),
        givenAmount: Math.max(0, Number(draft["givenAmount"]) || 0),
        notes: String(draft["notes"] || ""),
      };
      if (!materialInput.name) {
        console.warn("[ProjectWorkspace] Cannot save material: no material name");
        await this.presentToast("Material name is required.", "warning");
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        await this.presentToast("Material quantity must be greater than zero.", "warning");
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
          _id: result._id,
          materialId: result.id,
        });
        this.recordDialogOpen.set(false);
        this.clearRowSelection();
        this.refreshSectionFromBackend("materials");
        return;
      } catch (err: any) {
        console.error("[ProjectWorkspace] Failed to create material", err);
        await this.presentToast(
          err?.error?.message || err?.message || "Could not save the material request.",
          "danger",
        );
        return;
      }
    }

    if (section === "payments") {
      const projectId = this.projectId();
      const clientObjectId = String(currentProject?.clientId || this.client()?._id || "").trim();
      const date = String(draft["paymentDate"] || draft["date"] || new Date().toISOString().slice(0, 10));
      const amount = Math.abs(this.moneyNumber(draft["amount"]));
      const mode = String(draft["mode"] || "").trim();
      const collectedBy = String(draft["collectedBy"] || "").trim();

      if (!projectId || !clientObjectId) {
        await this.presentToast("Select a project before recording a payment.", "warning");
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        await this.presentToast("Payment amount must be greater than zero.", "warning");
        return;
      }
      if (!mode) {
        await this.presentToast("Select a payment mode.", "warning");
        return;
      }
      if (!collectedBy) {
        await this.presentToast("Collected By is required.", "warning");
        return;
      }

      try {
        const result = await firstValueFrom(this.api.createPayment({
          projectId,
          clientId: clientObjectId,
          date,
          amount,
          mode,
          transactionReference: String(draft["transactionReference"] || "").trim() || undefined,
          receiptNumber: String(draft["receiptNumber"] || "").trim() || undefined,
          collectedBy,
        }));
        const savedPayment = mapPayment(result.payment);
        this.data.payments.update((rows) => [
          savedPayment,
          ...rows.filter((row) => String(row._id || "") !== String(savedPayment._id || "")),
        ]);

        // Pull the recomputed project ledger immediately so the workspace
        // totals and any subsequent dashboard navigation use server truth.
        try {
          const projectResult = await firstValueFrom(this.api.getProject(projectId));
          const refreshedProject = mapProject(projectResult.project);
          this.data.projects.update((rows) => rows.map((row) =>
            String(row.id || (row as any)._id || "") === projectId ? refreshedProject : row));
        } catch {
          // The payment is already persisted; the normal workspace refresh
          // will retry the project read if this secondary request fails.
        }

        this.recordDialogOpen.set(false);
        this.clearRowSelection();
        this.refreshSectionFromBackend("payments");
        await this.presentToast("Payment recorded successfully.");
        return;
      } catch (err: any) {
        console.error("[ProjectWorkspace] Failed to create payment", err);
        await this.presentToast(
          err?.error?.message || err?.message || "Could not save the payment.",
          "danger",
        );
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

  private async presentToast(message: string, color: "success" | "warning" | "danger" = "success") {
    try {
      const toast = await this.toastController.create({
        message,
        duration: color === "danger" ? 4000 : 2500,
        color,
        position: "top",
      });
      await toast.present();
    } catch (err) {
      console.warn("[ProjectWorkspace] Failed to present toast:", err);
    }
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
      .find((s) =>
        (String(s.projectId) === this.projectId() || (s.projectIds || []).includes(this.projectId()))
        && String(s.subcontractorName || "").trim().toLowerCase() === subcontractorName.toLowerCase()
      );
    if (!subcontractor?._id) {
      window.alert("Please select a subcontractor.");
      return;
    }
    const date = String(draft["date"] || new Date().toISOString().slice(0, 10));
    const labourType = String(draft["labourType"] || "").trim();
    if (!labourType) {
      window.alert("Please select a labour type.");
      return;
    }
    const description = String(draft["description"] || "").trim();
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
    const payload = {
      subcontractorId: subcontractor._id,
      projectId,
      date,
      paymentType: String(draft["paymentType"] || "Bank Transfer"),
      labourType,
      description,
      employeeCount,
      amount,
      notes: "",
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
   * Persist a project-level "Expense" row. Distinct from the legacy
   * Site Expense tab — these are admin / general entries (rent, fuel,
   * software, office overhead) recorded against the project and rolled
   * into the project Total Expense KPI.
   */
  private async saveGeneralExpenseDraft(draft: TableRow, selectedSite: string) {
    const projectId = this.projectId();
    if (!projectId) {
      await this.presentToast("Select a project before saving an expense entry.", "warning");
      return;
    }
    const description = String(draft["description"] || "").trim();
    if (!description) {
      await this.presentToast("Description is required.", "warning");
      return;
    }
    const amount = Math.abs(this.moneyNumber(draft["amount"]));
    if (!Number.isFinite(amount) || amount <= 0) {
      await this.presentToast("Amount must be a number greater than zero.", "warning");
      return;
    }
    const date = String(draft["date"] || new Date().toISOString().slice(0, 10));
    const payload: Record<string, unknown> = {
      origin: String(draft["origin"] || "manual"),
      category: String(draft["category"] || "").trim() || undefined,
      amount,
      date,
      description,
      projectId,
      projectName: this.project()?.name,
      ...(this.isMongoObjectId(this.clientId()) ? { clientId: this.clientId() } : {}),
      notes: String(draft["notes"] || "").trim() || undefined,
      status: "Approved",
      createdBy: this.api.user()?.name || this.api.user()?.email || "",
    };
    try {
      const created = await new Promise<any>((resolve, reject) => {
        this.api.createGeneralExpense(payload).subscribe({ next: resolve, error: reject });
      });
      const createdExpense = created?.expense ? mapGeneralExpense(created.expense) : null;
      if (createdExpense) {
        this.data.generalExpenses.update((rows) => [
          createdExpense,
          ...rows.filter((row) => String(row._id || row.id || "") !== String(createdExpense._id || createdExpense.id || "")),
        ]);
      }
      this.recordDialogOpen.set(false);
      this.clearRowSelection();
      this.api.listGeneralExpenses({ limit: 200, projectId }).subscribe({
        next: (result) => {
          const mapped = (result.items || []).map(mapGeneralExpense);
          this.data.setGeneralExpenses(mapped);
          this.loadProjectExpenseRollup(projectId);
          void this.hydration.loadModule("generalExpenses");
        },
        error: () => {
          // Even if the list call fails the create succeeded; the next page
          // load will reconcile.
          this.loadProjectExpenseRollup(projectId);
        },
      });
    } catch (err: any) {
      console.error("[ProjectWorkspace] Failed to save general expense", err);
      await this.presentToast(
        err?.error?.message || err?.error?.error || err?.message || "Could not save the expense.",
        "danger",
      );
    }
  }

  private isMongoObjectId(value: unknown): boolean {
    return /^[a-f\d]{24}$/i.test(String(value || ""));
  }

  isReadablePurchaseOrderNumber(value: unknown): boolean {
    return /^PO-\d{4}-\d{4,}$/.test(String(value || "").trim());
  }

  openPurchaseOrder(value: unknown, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    const poNumber = String(value || "").trim();
    if (!poNumber) return;
    void this.router.navigate(["/purchase-orders"], { queryParams: { open: poNumber } });
  }

  isMaterialBillUploading(row: TableRow): boolean {
    return this.uploadingMaterialBills().includes(this.rowKey(row));
  }

  async uploadMaterialBill(row: TableRow, event: Event) {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      await this.presentToast("Choose an image or PDF bill.", "warning");
      input.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      await this.presentToast("The bill file must be 10 MB or smaller.", "warning");
      input.value = "";
      return;
    }

    const uploadKey = this.rowKey(row);
    this.uploadingMaterialBills.update((keys) => [...new Set([...keys, uploadKey])]);
    try {
      const mongoId = await this.resolveMaterialMongoId(row);
      if (!mongoId) throw new Error("Material record could not be found.");
      const data = await this.fileAsBase64(file);
      const response = await firstValueFrom(this.api.uploadMaterialReceipt(mongoId, {
        data,
        mimeType: file.type,
        fileName: file.name,
      }));
      const billUrl = String(response.material?.billUrl || "");
      const materialId = String(response.material?.materialId || row["materialId"] || "");
      this.data.materials.update((materials) => materials.map((material) =>
        String(material._id || "") === mongoId || String(material.id) === materialId
          ? { ...material, billUrl }
          : material));
      this.materialsService.materials.update((materials) => materials.map((material) =>
        String(material._id || "") === mongoId || String(material.id) === materialId
          ? { ...material, billUrl }
          : material));
      const rowId = String(row["__rowId"] || "");
      if (rowId) this.data.updateSharedRowCell(rowId, "billUrl", billUrl);
      await this.presentToast("Bill uploaded successfully.");
    } catch (err: any) {
      await this.presentToast(
        err?.error?.message || err?.error?.error || err?.message || "Could not upload the bill.",
        "danger",
      );
    } finally {
      this.uploadingMaterialBills.update((keys) => keys.filter((key) => key !== uploadKey));
      input.value = "";
    }
  }

  private async resolveMaterialMongoId(row: TableRow): Promise<string> {
    const directId = String(row["_id"] || "").trim();
    if (this.isMongoObjectId(directId)) return directId;
    const materialId = String(row["materialId"] || row["id"] || "").trim();
    if (!materialId) return "";
    const response = await firstValueFrom(this.api.listMaterials({ projectId: this.projectId(), limit: 200 }));
    const material = (response.items || []).find((item: any) => String(item.materialId) === materialId);
    return String(material?._id || "");
  }

  private fileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        if (comma < 0) reject(new Error("The selected bill could not be read."));
        else resolve(result.slice(comma + 1));
      };
      reader.onerror = () => reject(reader.error || new Error("The selected bill could not be read."));
      reader.readAsDataURL(file);
    });
  }

  sectionCount(section: ModuleKey): number {
    if (section === "inventory") return this.inventoryUniqueMaterialCount();
    return this.visibleRows(section).length;
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
          .find((s) =>
            (String(s.projectId) === this.projectId() || (s.projectIds || []).includes(this.projectId()))
            && String(s.subcontractorName || "").trim().toLowerCase() === value.toLowerCase()
          );
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
      case "labourType":
        patch.labourType = value;
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

  /**
   * Per-project sub-contractor roster cell edits. PATCH the
   * underlying Subcontractor record (which is also visible on the
   * universal sub-contractors page), so changes stay in sync across
   * both views.
   */
  private updateSubcontractorRosterRow(row: TableRow, key: string, value: string) {
    const mongoId = String(row["_id"] || "").trim();
    if (!mongoId) return;
    const patch: Record<string, unknown> = {};
    switch (key) {
      case "subcontractorName":
        patch.subcontractorName = value;
        break;
      case "address":
        patch.address = value;
        break;
      case "phone":
        patch.phone = value;
        break;
      case "notes":
        patch.note = value;
        break;
      case "status":
        patch.status = value === "inactive" ? "inactive" : "active";
        break;
      default:
        return;
    }
    // Optimistic local update so the cell reflects the change
    // immediately.
    this.data.subcontractors.update((list) =>
      list.map((s) => (String(s._id) === mongoId ? { ...s, ...patch } : s)),
    );
    this.api.patchSubcontractor(mongoId, patch).subscribe({
      next: () => {
        // Backend is source of truth — refresh from server to pick up
        // any server-side normalisation (e.g. trimmed fields, status
        // coercion).
        try {
          this.refreshSectionFromBackend("subcontractors");
        } catch {}
      },
      error: (err) => {
        console.warn("[ProjectWorkspace] Failed to update sub-contractor from roster", err);
        try {
          this.refreshSectionFromBackend("subcontractors");
        } catch {}
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
      materialName: row["materialName"] || row["description"] || "Material purchase",
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
    return section === "materials" || section === "attendance" || section === "expenses" || section === "subcontractors";
  }

  isNoCreateTab(): boolean {
    const s = this.activeSection();
    // Attendance is the supervisors' domain (mobile app). The web
    // admin dashboard is read-only on attendance — supervisors own
    // those records. Hide the Add Row button on that tab.
    // `vendors` opens its own Assign Vendor dialog from a dedicated
    // toolbar button, so the generic Add Row button is hidden there too.
    return s === "expenses" || s === "vendors" || s === "attendance" || s === "inventory";
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
    if (section === "subcontractorsRoster") {
      // Per-project roster cell edits PATCH the underlying
      // sub-contractor record (the same one the universal page shows),
      // so changes are visible in both views.
      this.updateSubcontractorRosterRow(row, key, cleanValue);
      return;
    }
    if (section === "workers") {
      // Worker cells PATCH the worker record directly through the API.
      // Optimistic local update so the cell reflects the new value
      // before the network round-trip completes.
      this.updateWorkerCellRow(row, key, cleanValue);
      return;
    }
    if (section === "materials" && key === "quantity") {
      const quantity = Math.max(0, this.moneyNumber(cleanValue));
      this.data.updateSharedRowCell(rowId, key, quantity);
      this.data.materials.update((materials) => materials.map((material) =>
        String(material._id || "") === String(row["_id"] || "") || String(material.id) === String(row["materialId"] || "")
          ? {
              ...material,
              requested: quantity,
              quantity,
              purchased: quantity,
              remainingStock: Math.max(0, quantity - Number(material.consumed || 0)),
            }
          : material));
      void this.resolveMaterialMongoId(row).then((mongoId) => {
        if (!mongoId) throw new Error("Material record could not be found.");
        // Mirrors the Add Materials dialog: Quantity typed into the
        // table is the amount actually purchased, so we keep the
        // backend's Material.purchasedQuantity in sync. The pre-save
        // hook on the Material model recomputes remainingStock from
        // purchasedQuantity - consumedQuantity.
        return firstValueFrom(this.api.patchMaterial(mongoId, {
          requestedQuantity: quantity,
          purchasedQuantity: quantity,
        }));
      }).then(() => {
        this.refreshSectionFromBackend("materials");
        this.refreshSectionFromBackend("inventory");
      }).catch(() => {
        this.refreshSectionFromBackend("materials");
        this.refreshSectionFromBackend("inventory");
      });
      return;
    }
    if (section === "materials" && key === "notes") {
      this.data.updateSharedRowCell(rowId, key, cleanValue);
      void this.resolveMaterialMongoId(row).then((mongoId) => {
        if (!mongoId) throw new Error("Material record could not be found.");
        return firstValueFrom(this.api.patchMaterial(mongoId, { notes: cleanValue }));
      }).then(() => this.refreshSectionFromBackend("materials"))
        .catch(() => this.refreshSectionFromBackend("materials"));
      return;
    }
    if (section === "expenses" && key === "amount") {
      this.data.updateSharedRowCell(rowId, key, this.positiveExpenseAmountValue(cleanValue));
      return;
    }
    this.data.updateSharedRowCell(rowId, key, cleanValue);
    if (section === "attendance" && key === "labourTypes") this.data.updateSharedRowCell(rowId, "notes", cleanValue);
    if (section === "expenses" && key === "siteMaterial") this.createMaterialFromSiteExpense({ ...row, [key]: cleanValue });
  }

  private updateWorkerCellRow(row: TableRow, key: string, value: string) {
    const mongoId = String(row["_id"] || "").trim();
    if (!mongoId) return;
    const payload: Record<string, string | number | undefined> = {};
    if (key === "name") payload.name = value;
    else if (key === "phone") payload.phone = value;
    else if (key === "labourType") payload.labourType = value;
    else if (key === "address") payload.address = value;
    else if (key === "notes") payload.notes = value;
    else if (key === "site") payload.site = value;
    else return; // unknown column — leave alone
    // Optimistic local update.
    this.data.workers.update((list) =>
      list.map((entry) => (String(entry._id || entry.id || "") === mongoId ? { ...entry, [key]: value } : entry)),
    );
    this.api.patchWorker(mongoId, payload).subscribe({
      error: () => {
        // On failure, re-pull the page so the cell reflects truth.
        try { this.refreshFromBackend(); } catch {}
      },
    });
  }

  async deleteRow(row: TableRow) {
    const key = this.rowKey(row);
    const section = this.activeSection();
    const group = (row as TableRow & { __labourGroup?: TableRow[] })["__labourGroup"];
    const isGroup = section === "attendance" && Array.isArray(group) && group.length > 0;
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
      generalExpenses: (id) => this.api.deleteGeneralExpense(id),
      payments: (id) => this.api.deletePayment(id),
      vendors: (id) => this.api.deleteVendor(id),
      subcontractors: (id) => this.api.deleteSubcontractor(id),
      // Roster deletes target the same sub-contractor record — the
      // roster is just a per-project filtered view of the same data.
      subcontractorsRoster: (id) => this.api.deleteSubcontractor(id),
      workers: (id) => this.api.deleteWorker(id),
    };
    const dataMap: Record<string, any> = {
      materials: this.data.materials,
      labour: this.data.labour,
      expenses: this.data.expenses,
      generalExpenses: this.data.generalExpenses,
      payments: this.data.payments,
      vendors: this.data.vendors,
      subcontractors: this.data.subcontractors,
      // Roster deletes target the same global signal.
      subcontractorsRoster: this.data.subcontractors,
      workers: this.data.workers,
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
    if (this.labourTypeSaving()) return; // guard against double-submit
    const rowId = this.labourTypeRowId();
    const type = this.labourTypeName().trim();
    const count = Math.max(0, Math.round(this.moneyNumber(this.labourTypeCount())));
    const dailyWage = Math.max(0, this.moneyNumber(this.labourTypeDailyWage()));
    if (!rowId || !type || !count) return;
    this.labourTypeSaving.set(true);
    try {
      const row = this.visibleRows("labour").find((entry) => String(entry["__rowId"] || "") === rowId);
      const nextTypes = this.mergeLabourType(String(row?.["labourTypes"] || ""), type, count, dailyWage);
      const wageField = this.ensureLabourWageField(type);
      this.data.updateSharedRowCell(rowId, "labourTypes", nextTypes);
      this.data.updateSharedRowCell(rowId, "notes", nextTypes);
      if (dailyWage) this.data.updateSharedRowCell(rowId, wageField.key, formatMoney(dailyWage));
      this.closeLabourTypeDialog();
    } finally {
      this.labourTypeSaving.set(false);
    }
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

  async exportExcel() {
    const section = this.activeSection();
    // Attendance export needs the bulk-roster columns (project, site,
    // total workers, status, etc.) — not the legacy labour-table
    // columns that the on-screen CRUD table uses.
    const columns = section === "attendance" ? this.reportColumns(section) : this.columnsFor(section);
    const rows = this.visibleRows(section);
    await buildReportXlsx({
      title: section === "attendance" ? "Labour Attendance Report" : this.activeConfig().title,
      subtitle: this.project()?.name || this.projectId(),
      columns,
      rows,
      fileName: `annai-${this.projectId()}-${section}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  }

  exportPdf() {
    const section = this.activeSection();
    const columns = this.reportColumns(section);
    const sourceRows = this.visibleRows(section);
    const rows = this.reportRows(section, sourceRows);
    const currentProject = this.project();
    const summary = section === "attendance" ? this.labourSummaryHtml(rows) : section === "expenses" ? this.expenseSummaryHtml(sourceRows) : "";
    this.openPrintableReport({
      title: section === "attendance" ? "Labour Attendance Report" : section === "expenses" ? "Expense Ledger Report" : this.activeConfig().title,
      subtitle: `${currentProject?.name ?? this.projectId()}`,
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
      status: project.status,
      clientId: this.client()?._id || this.client()?.id,
    };
  }

  async saveProject(value: ProjectFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.startDate || !value.supervisor || !value.totalValue) return;
    const editing = this.editingProject();
    if (editing) {
      const updated = this.data.updateProject(editing.id, { ...value });
      // Persist supervisor/site changes to the backend so the supervisor mobile
      // app receives the updated site assignments.
      await this.data.persistProjectEdit(editing.id, {
        clientId: value.clientId,
        name: value.name,
        sites: value.sites,
        startDate: value.startDate,
        supervisor: value.supervisor,
        supervisorId: value.supervisorId,
        status: value.status,
        totalValue: value.totalValue,
      });
      this.editingProject.set(null);
      this.showProjectForm.set(false);
      const targetClient = value.clientId
        ? this.data.clients().find((client) => client._id === value.clientId || client.id === value.clientId)
        : undefined;
      if (targetClient && targetClient.id !== currentClient.id) {
        void this.router.navigate(["/clients", targetClient.id, "projects", editing.id, this.activeSection()]);
        return;
      }
      if (updated && editing.id === this.projectId()) {
        void this.router.navigate(["/clients", currentClient.id, "projects", updated.id, this.activeSection()]);
      }
      return;
    }
    try {
      const project = await this.data.addProject(currentClient, { ...value });
      this.showProjectForm.set(false);
      await Promise.resolve();
      await this.router.navigate(["/clients", currentClient.id, "projects", project.id, "materials"]);
    } catch (err) {
      console.error("[ProjectWorkspace] Failed to create project:", (err as any)?.message ?? err);
    }
  }

  updateProjectStatus(value: string, event?: Event) {
    if (!this.isProjectStatus(value)) return;
    const currentProject = this.project();
    if (!currentProject || currentProject.status === value) return;
    const displayLabel = this.projectStatusOptions.find((option) => option.value === value)?.label ?? value;
    if ((value === "Completed" || value === "On Hold") && !window.confirm(`Mark ${currentProject.name} as ${displayLabel}?`)) {
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

  async updateProjectEstimatedValue(value: string) {
    const amount = Number(String(value).replace(/[^\d.-]/g, ""));
    const projectId = this.projectId();
    const currentProject = this.project();
    if (!Number.isFinite(amount) || amount < 0 || !projectId || !currentProject || this.estimatedValueSaving()) return;
    if (amount === Number(currentProject.totalValue)) return;

    const previousValue = Number(currentProject.totalValue) || 0;
    this.data.updateProject(projectId, { totalValue: amount });
    this.estimatedValueSaving.set(true);
    try {
      const response = await firstValueFrom(this.api.updateProject(projectId, { totalValue: amount }));
      const saved = mapProject((response as any)?.project || response);
      this.data.projects.update((projects) => projects.map((project) =>
        project.id === projectId ? { ...project, ...saved, id: project.id } : project
      ));
      await this.presentToast("Estimated project value updated.");
    } catch (err: any) {
      this.data.updateProject(projectId, { totalValue: previousValue });
      await this.presentToast(
        err?.error?.message || err?.message || "Could not update the estimated project value.",
        "danger",
      );
    } finally {
      this.estimatedValueSaving.set(false);
    }
  }

  private async loadMissingProject(projectId: string): Promise<void> {
    if (!projectId || this.fetchingProjectId === projectId || this.data.projectById(projectId)) return;
    this.fetchingProjectId = projectId;
    this.projectLoadError.set("");
    try {
      const response = await firstValueFrom(this.api.getProject(projectId));
      const loaded = mapProject(response.project);
      this.data.projects.update((projects) => {
        const withoutDuplicate = projects.filter((project) => project.id !== loaded.id);
        return [loaded, ...withoutDuplicate];
      });
      const matchingClient = this.data.clients().find((client) =>
        client.id === this.clientId() || client._id === String((loaded as any).clientId || "")
      );
      if (matchingClient && !matchingClient.projectIds.includes(loaded.id)) {
        this.data.clients.update((clients) => clients.map((client) =>
          client.id === matchingClient.id
            ? { ...client, projectIds: [loaded.id, ...client.projectIds] }
            : client
        ));
      }
    } catch (err: any) {
      console.error("[ProjectWorkspace] Failed to load routed project:", err);
      this.projectLoadError.set(
        err?.status === 404
          ? "This project could not be found. Return to the project list and try again."
          : "The project could not be loaded. Please try again.",
      );
    } finally {
      this.fetchingProjectId = "";
    }
  }

  private subcontractorSpend = signal<number>(0);
  private subcontractorPayments = signal<any[]>([]);
  /**
   * Sub-contractor profiles (one row per sub) assigned to the current
   * project. Distinct from `subcontractorPayments`, which holds the
   * payment ledger. Populated by `loadProjectExpenseRollup`.
   */
  private subcontractorRoster = signal<any[]>([]);
  private projectPurchaseOrders = signal<PurchaseOrder[]>([]);

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
      paymentType: p.paymentType || "Bank Transfer",
      labourType: p.labourType || "General Labour",
      subcontractorId: p.subcontractorId,
      subcontractorName: p.subcontractorName,
      projectId: p.projectId,
      siteId: p.siteId || "",
      siteName: p.siteName || "",
      description: p.description || "",
      employeeCount: p.employeeCount,
      amount: formatMoney(p.amount),
    }));
  }

  /**
   * Map the project's subcontractor profile roster (one row per
   * sub-contractor assigned to this project) to the table shape the
   * generic column-driven workspace CRUD table expects. Reads from
   * the shared `data.subcontractors` signal so the roster stays in
   * sync with the universal sub-contractors page (and the
   * workspace hydration cache).
   */
  private subcontractorRosterRows(): TableRow[] {
    const projectId = this.projectId();
    return this.data.subcontractors()
      .filter((row) => String(row.projectId) === projectId || (row.projectIds || []).includes(projectId))
      .map((row) => ({
        __rowId: `sub-roster:${row._id || row.id}`,
        // This row represents the assignment in the current workspace. Using
        // the subcontractor's original projectId here caused the generic table
        // filter to hide profiles assigned later through projectIds.
        __projectId: projectId,
        _id: row._id || row.id,
        projectId: row.projectId || projectId,
        subcontractorId: row._id || row.id,
        subcontractorName: row.subcontractorName || "",
        address: row.address || "",
        phone: row.phone || "",
        gstDisplay: row.gstType === "GST" ? (row.gstNumber || "—") : "No GST",
        note: row.note || "",
        status: row.status === "inactive" ? "inactive" : "active",
      }));
  }

  /**
   * Fetch the subcontractor spend rollup for this project so the
   * workspace "Total expense" line includes subcontractor payments
   * (per spec) and the new Sub-contractors page total stays in sync.
   * Also loads the project's sub-contractor profile roster so the new
   * Subcontractors tab can render immediately.
   */
  private loadProjectExpenseRollup(projectId: string | null) {
    if (!projectId) {
      this.subcontractorSpend.set(0);
      this.subcontractorPayments.set([]);
      this.subcontractorRoster.set([]);
      this.projectPurchaseOrders.set([]);
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
    // Load sub-contractor profiles for the roster tab. Backend doesn't
    // expose a project filter on /subcontractors, so we filter client-side.
    this.api.listSubcontractors({ limit: 500, page: 1 }).subscribe({
      next: (res) => {
        const items = (res.items || []).map(mapSubcontractor);
        this.subcontractorRoster.set(items);
        this.data.subcontractors.set(items);
      },
      error: () => this.subcontractorRoster.set([]),
    });
    void this.loadProjectPurchaseOrders(projectId);
  }

  private async loadProjectPurchaseOrders(projectId: string) {
    const orders: PurchaseOrder[] = [];
    try {
      let page = 1;
      let totalPages = 1;
      do {
        const response = await firstValueFrom(this.api.listPurchaseOrders({ projectId, page, limit: 200 }));
        orders.push(...(response.items || []));
        totalPages = Math.max(1, Number(response.pages) || 1);
        page += 1;
      } while (page <= totalPages);
      if (this.projectId() === projectId) this.projectPurchaseOrders.set(orders);
    } catch {
      if (this.projectId() === projectId) this.projectPurchaseOrders.set([]);
    }
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
    const generalExpenseRows = this.data.tableRowsFor(
      "generalExpenses",
      this.tableRows().generalExpenses,
      (row) => this.rowBelongsToProject(row)
    );
    const generalExpenseTotal = generalExpenseRows.reduce(
      (sum, row) => sum + Math.abs(this.moneyNumber(row["amount"])),
      0
    );
    const labourRows = this.data.tableRowsFor("labour", this.tableRows().labour, (row) => this.rowBelongsToProject(row));
    const labourTotal = labourRows.reduce((sum, row) => sum + this.labourWeeklyPayForRow(this.withLabourPayable(row)).total, 0);
    const subcontractorTotal = this.subcontractorSpend();
    const materialRows = this.data.tableRowsFor("materials", this.tableRows().materials, (row) => this.rowBelongsToProject(row));
    const materialsGivenTotal = materialRows.reduce(
      (sum, row) => sum + this.moneyNumber(row["givenAmount"]),
      0
    );
    return expenseTotal + generalExpenseTotal + labourTotal + subcontractorTotal + materialsGivenTotal;
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

      // Pull both sources in parallel — the legacy worker-level
      // attendance (older supervisor app) and the new bulk-headcount
      // muster the mobile app writes to. They use different
      // collections and a single merge keeps the Attendance tab
      // honest about what's on file.
      const [groupedResult, bulkResult] = await Promise.all([
        firstValueFrom(this.api.listGroupedAttendance({
          projectId,
          from: fromDate,
          to: toDate,
          limit: 25,
        })).catch(() => ({ items: [], total: 0 })),
        firstValueFrom(this.api.listSubcontractorAttendance({
          projectId,
          dateFrom: fromDate,
          dateTo: toDate,
          limit: 200,
        })).catch(() => ({ items: [], total: 0, page: 1, limit: 0, pages: 0 })),
      ]);

      const bulkRows: TableRow[] = (bulkResult.items || []).map((item: any) => {
        // Each SubcontractorAttendance record is already a single row
        // — entries is a list of {labourType, count}. Flatten it into
        // a "Civil: 1, Mason: 1, Plumber: 1" string so the existing
        // labour-type chip rendering and PDF export show every type.
        const entries = Array.isArray(item.entries) ? item.entries : [];
        const labourTypeBreakup = entries
          .filter((e: any) => e && (Number(e.count) || 0) > 0)
          .map((e: any) => `${e.labourType}: ${e.count}`)
          .join(", ");
        const totalCount = Number(item.totalCount) || entries.reduce((sum: number, e: any) => sum + (Number(e.count) || 0), 0);
        const entryPayload = JSON.stringify(entries);
        return {
          __rowId: `attendance-bulk:${item._id}`,
          __projectId: item.projectId || projectId,
          __source: "subcontractor-attendance",
          projectId: item.projectId || projectId,
          projectName: item.projectName || currentProject?.name || "",
          client: currentProject?.client || "",
          clientId: this.clientId(),
          site: item.siteName || "",
          siteId: item.siteId || "",
          subcontractorId: item.subcontractorId || "",
          subcontractorName: item.subcontractorName || "",
          staffName: "",
          attendanceDate: item.attendanceDate,
          labourTypes: labourTypeBreakup,
          labourTypeEntries: entryPayload,
          staffCount: totalCount,
          attendance: totalCount > 0 ? "Present" : "Absent",
          shift: item.shifts ?? 2,
          lateFine: "",
          paymentMode: "",
          notes: item.notes || "",
          status: "Active",
          submittedBy: item.submittedBy || "",
          updatedAt: item.updatedAt || item.createdAt || "",
        };
      });

      const groupedRows: TableRow[] = (groupedResult.items || []).flatMap((group: any) =>
        (group.workers || []).map((w: any, idx: number) => ({
          __rowId: `attendance:${group.date}:${group.shift}:${w.workerId}:${idx}`,
          __projectId: group.projectId || projectId,
          __source: "attendance-grouped",
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

      // Bulk records take precedence — when the same (sub, project,
      // date) tuple is on file in both, the bulk record represents
      // the latest muster. Legacy grouped rows for the same tuple are
      // dropped to avoid duplicate counts.
      const bulkKey = new Set(
        bulkRows.map((row) => `${row.subcontractorName}||${row.attendanceDate}`)
      );
      const filteredGrouped = groupedRows.filter(
        (row) => !bulkKey.has(`${row.subcontractorName}||${row.attendanceDate}`)
      );

      this.attendanceRows.set([...bulkRows, ...filteredGrouped]);
    } catch (err) {
      console.error("[ProjectWorkspace] failed to fetch attendance data", err);
      this.attendanceRows.set([]);
    }
  }

  private buildInitialRows(projectId: string): Record<ModuleKey, TableRow[]> {
    void this.data.vendors();
    const currentProject = this.data.projectById(projectId);
    const currentClient = this.data.clients().find((client) => client.projectIds.includes(projectId) || client.name === currentProject?.client);
    const inventoryRows = this.data.inventory();
    const materials = this.data.materials().filter((row) => row.projectId === projectId).map((row) => {
      const inventory = inventoryRows.find((item) =>
        String(item.projectId || "") === String(row.projectId || "")
        && String(item.name || "").trim().toLowerCase() === String(row.name || "").trim().toLowerCase()
        && String(item.unit || "").trim().toLowerCase() === String(row.unit || "").trim().toLowerCase()
        && String(item.site || "").trim().toLowerCase() === String(row.site || "").trim().toLowerCase());
      return {
      __rowId: `material:${row.id}`,
      __projectId: row.projectId,
      _id: (row as any)._id,
      createdAt: (row as any).createdAt,
      updatedAt: (row as any).updatedAt,
      materialId: row.id,
      projectId: row.projectId,
      site: row.site,
      materialName: row.name,
      unit: row.unit,
      quantity: formatNumber(row.requested || row.quantity || row.approved),
      isExistingMaterial: row.isExistingMaterial ? "Yes" : "",
      issuedAmount: row.isExistingMaterial ? "Existing material" : (row.issuedAmount ?? ""),
      givenAmount: row.isExistingMaterial ? "Existing material" : (row.givenAmount ?? ""),
      requestDate: row.requestDate || (row as any).createdAt || "",
      receivedDate: this.dateOnly(row.receivedDate || (String(row.status).toLowerCase() === "received" ? ((row as any).updatedAt || "") : "")),
      vendor: row.vendor,
      poNumber: row.poNumber,
      billUrl: row.billUrl || (row.receiptImage ? `data:${row.receiptImageMimeType || 'image/jpeg'};base64,${row.receiptImage}` : undefined),
      remainingStock: `${formatNumber(inventory?.remainingStock ?? row.remainingStock)} ${row.unit}`,
      status: row.status,
      notes: row.notes,
      __noteHistoryJson: JSON.stringify((row as any).noteHistory || []),
      };
    });

    const labour = this.data.labourForProject(projectId).map((row) => ({
      __rowId: `labour:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      client: currentProject?.client ?? "",
      clientId: currentClient?.id ?? this.clientId(),
      attendanceDate: (row as any).attendanceDate || "2026-06-05",
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
        transactionType: row.transactionType || "Purchase",
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

    const generalExpenses = this.data.generalExpensesForProject(projectId).map((row) => ({
      __rowId: `general-expense:${row.id}`,
      __projectId: row.projectId || projectId,
      projectId: row.projectId || projectId,
      date: row.date,
      category: row.category || "",
      description: row.description,
      amount: formatMoney(Number(row.amount) || 0),
      origin: row.origin || "manual",
      site: row.site || "",
      notes: row.notes || "",
      status: row.status,
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
    const ordersByVendor = new Map<string, PurchaseOrder[]>();
    for (const order of this.projectPurchaseOrders()) {
      const vendorId = String(order.vendorId || "").trim();
      const vendorName = String(order.vendorName || "").trim().toLowerCase();
      const key = vendorId || `name:${vendorName}`;
      if (!key || key === "name:") continue;
      ordersByVendor.set(key, [...(ordersByVendor.get(key) || []), order]);
    }

    // A vendor belongs in this project table only after an actual PO exists.
    // The PO itself carries vendorId/name, so the row remains available even
    // when the vendor was never manually assigned to the project.
    const vendors = [...ordersByVendor.entries()].map(([vendorKey, purchaseOrders]) => {
      const firstOrder = purchaseOrders[0];
      const orderVendorId = String(firstOrder.vendorId || "").trim();
      const orderVendorName = String(firstOrder.vendorName || "").trim();
      const vendor = this.data.vendors().find((item) =>
        (orderVendorId && String(item._id || "") === orderVendorId)
        || item.name.trim().toLowerCase() === orderVendorName.toLowerCase(),
      );
      const vendorName = vendor?.name || orderVendorName || "Vendor";
      const normalizedName = vendorName.trim().toLowerCase();
      const totalPaid = projectMaterials
        .filter((material) => {
          const materialVendorId = String((material as any).vendorId || "").trim();
          return (orderVendorId && materialVendorId === orderVendorId)
            || String(material.vendor || "").trim().toLowerCase() === normalizedName;
        })
        .reduce((sum, material) => sum + (Number(material.givenAmount) || 0), 0);
      const poCount = new Set(
        purchaseOrders
          .map((order) => String(order.poNumber || "").trim())
          .filter(Boolean),
      ).size;
      return {
        __rowId: `vendor-po:${vendorKey}`,
        __projectId: projectId,
        projectId,
        vendorName,
        projects: this.project()?.name || "",
        materialType: vendor?.materialType || "",
        materialsBought: this.materialPurchaseSummaryForVendor(vendorName, projectId),
        totalPo: poCount,
        totalPaid: formatMoney(totalPaid),
        phoneNumber: vendor?.phone || "",
        address: vendor?.address || "",
        gstNumber: vendor?.gst || "",
      };
    });

    const subcontractors = this.subcontractorPaymentRows();

    const inventory = this.data.inventory()
      .map((row) => {
        const history = row.purchaseHistory || [];
        const receivedQuantity = history.length > 0
          ? history
            .filter((entry) => entry.received === true)
            .reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0)
          : (row.received === true ? Number(row.purchasedQuantity) || 0 : 0);
        return { row, receivedQuantity };
      })
      .filter(({ row, receivedQuantity }) => String(row.projectId) === projectId && receivedQuantity > 0)
      .map(({ row, receivedQuantity }) => ({
      __rowId: `inventory:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      site: row.site,
      materialName: row.name,
      unit: row.unit,
      purchasedQuantity: formatNumber(receivedQuantity),
      consumedQuantity: formatNumber(row.consumedQuantity),
      remainingStock: `${formatNumber(Math.max(0, receivedQuantity - row.consumedQuantity))} ${row.unit}`,
      vendor: row.vendor,
      poNumber: row.poNumber,
    }));

    // The Attendance tab is backed by the same labour/wage lines that the
    // legacy Labour tab uses, but renders them as attendance-register rows.
    // Sharing the source keeps the surface area one source of truth.
    const attendance = labour.map((row) => ({ ...row, __rowId: `attendance:${row.__rowId?.toString().replace(/^labour:/, "") ?? ""}` }));

    // Workers tab — roster scoped to the current project. Each worker is a
    // row of its own; the column set (name, phone, role, address, notes,
    // site) is what the column-driven inline editor renders/edits.
    const workers = this.data.workersForProject(projectId).map((row) => ({
      __rowId: `worker:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      _id: row._id,
      name: row.name,
      phone: row.phone || "",
      labourType: row.labourType || "",
      subcontractorId: row.subcontractorId || "",
      subcontractorName: row.subcontractorName || "",
      address: row.address || "",
      notes: row.notes || "",
    }));

    return {
      materials,
      labour,
      attendance,
      expenses,
      generalExpenses,
      payments,
      vendors,
      subcontractors,
      subcontractorsRoster: this.subcontractorRosterRows(),
      inventory,
      workers,
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
    return key === "clientId" || key === "runningBalance" || key === "weeklyPayable" || key === "weeklyPay" || key === "staffCount" || key === "balance" || key === "subtotal" || key === "totalGst" || key === "grandTotal" || key === "materialId" || key === "receivedStatus" || key === "totalPo" || key === "totalPaid";
  }

  /**
   * Display value for a cell. Maps the stored "Cash Added" transaction
   * type to the user-facing "Add Cash" label. The raw value is preserved
   * on the row so it can be sent back to the backend.
   */
  displayCell(row: TableRow, key: string): string {
    const raw = row[key];
    if (this.activeSection() === "materials" && key === "poNumber" && raw && !this.isReadablePurchaseOrderNumber(raw)) return "";
    if (this.activeSection() === "materials" && row["isExistingMaterial"] === "Yes" && (key === "issuedAmount" || key === "givenAmount")) return "Existing material";
    if ((key === "requestDate" || key === "receivedDate") && raw) return this.dateOnly(raw);
    if (key === "transactionType" && raw === "Cash Added") return "Add Cash";
    return raw == null ? "" : String(raw);
  }

  private dateOnly(value: unknown): string {
    const text = String(value || "").trim();
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
    return match?.[1] || text;
  }

  private materialSortValue(row: TableRow): number {
    const createdAt = Date.parse(String(row["createdAt"] || ""));
    if (Number.isFinite(createdAt)) return createdAt;
    const mongoId = String(row["_id"] || "");
    if (/^[a-f\d]{24}$/i.test(mongoId)) return parseInt(mongoId.slice(0, 8), 16) * 1000;
    const requestDate = Date.parse(String(row["requestDate"] || ""));
    return Number.isFinite(requestDate) ? requestDate : 0;
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
        const res = await firstValueFrom(this.api.listSubcontractors({
          limit: pageSize,
          page,
          projectId: this.projectId(),
        }));
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
    if (section === "attendance" && key === "staffName") return this.staffNameOptionsForProject();
    if (section === "expenses" && key === "transactionType") {
      return ["Purchase", "Add Cash"];
    }
    if (section === "expenses" && key === "siteMaterial") return ["No", "Yes"];
    if (section === "attendance" && key === "attendance") return ["Present", "Absent"];
    if (section === "attendance" && key === "shift") return ["1", "2"];
    if (section === "attendance" && key === "client") return this.data.clients().map((c) => c.name).filter(Boolean);
    if (section === "attendance" && key === "subcontractorName") {
      const fromData = this.data.subcontractors()
        .filter((s) => String(s.projectId) === this.projectId() || (s.projectIds || []).includes(this.projectId()))
        .map((s) => s.subcontractorName)
        .filter((name): name is string => Boolean(name && name.trim()));
      return [...new Set(fromData)].sort((a, b) => a.localeCompare(b));
    }
    // Supervisor payments only offer subcontractors assigned to the current
    // project. The backend query handles both projectId and projectIds.
    if (section === "subcontractors" && (key === "subcontractorName" || key === "subcontractor")) {
      const full = this.allSubcontractorNames();
      if (full.length > 0) return full;
      // Fallback while the full list is still loading: merge the
      // hydration's first page with anything already in memory so the
      // dropdown is never empty.
      return [...new Set(
        this.data.subcontractors()
          .filter((s) => String(s.projectId) === this.projectId() || (s.projectIds || []).includes(this.projectId()))
          .map((s) => s.subcontractorName)
          .filter((name): name is string => Boolean(name && name.trim()))
      )].sort((a, b) => a.localeCompare(b));
    }
    if (key === "approvalStatus" || key === "status") {
      if (section === "materials") {
        return ["Pending", "Approved", "Declined", "Completed", "Received", "Not Received"];
      }
      // Sub-contractor roster uses a simple Active / Inactive toggle
      // (matches the universal Sub-contractors page status field).
      if (section === "subcontractorsRoster") {
        return ["active", "inactive"];
      }
      return ["Pending", "Approved", "Declined"];
    }
    if (key === "paymentMode") return ["Cash", "NEFT", "UPI", "Bank Transfer", "Cheque"];
    if (section === "payments" && key === "mode") {
      const custom = this.customPaymentModes().filter((mode) => !paymentModeOptions.includes(mode));
      return [...paymentModeOptions, ...custom];
    }
    if (key === "paymentStatus") return ["Not Started", "Part Paid", "Paid"];
    if (key === "paymentType") return ["Bank Transfer", "Cash", "UPI", "Cheque", "NEFT", "RTGS"];
    if (section === "subcontractors" && key === "labourType") {
      const fromWorkers = this.data.workers()
        .map((row) => String(row.labourType || "").trim())
        .filter(Boolean);
      return [...new Set([...labourTypeOptions, ...fromWorkers])].sort((a, b) => a.localeCompare(b));
    }
    // Workers — offer a select dropdown for the Role column with the
    // union of preset labour types plus any custom roles the user has
    // already created (deduplicated, case-insensitive).
    if (section === "workers" && key === "labourType") {
      const fromData = this.data.workers()
        .map((row) => (row.labourType || "").trim())
        .filter((value): value is string => Boolean(value));
      return [...new Set([...labourTypeOptions, ...fromData])].sort((a, b) => a.localeCompare(b));
    }
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
        quantity: "",
        issuedAmount: "",
        givenAmount: "",
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
      generalExpenses: {
        date: today,
        category: "",
        description: "",
        amount: "0",
        origin: "manual",
        site,
        notes: "",
        status: "Approved",
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
        totalPo: 0,
        totalPaid: formatMoney(0),
        materialType: "",
        materialsBought: formatNumber(0),
        phoneNumber: "",
        address: "",
        gstNumber: "",
      },
      subcontractors: {
        date: today,
        paymentType: "Bank Transfer",
        subcontractorName: "",
        labourType: "General Labour",
        siteName: site,
        description: "",
        employeeCount: 1,
        amount: 0,
      },
      subcontractorsRoster: {
        subcontractorName: "",
        address: "",
        phone: "",
        note: "",
        status: "active",
      },
      inventory: {
        materialName: "",
        totalQty: 0,
        unit: "",
        siteCount: 0,
        lastUpdated: "",
      },
      attendance: {
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
      workers: {
        name: "",
        phone: "",
        labourType: "",
        subcontractorName: "",
        address: "",
        notes: "",
      },
    };
    return defaults[section];
  }

  private withComputedRows(section: ModuleKey, rows: TableRow[]): TableRow[] {
    const normalizedRows = rows.map((row) => this.withNormalizedApprovalStatus(row));
    if (section === "expenses") return this.withExpenseBalances(normalizedRows);
    if (section === "attendance") return normalizedRows.map((row) => this.withLabourPayable(row));
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

  private projectNamesForVendor(vendorName: string): string {
    const names = this.data.materials()
      .filter((row) => (row.vendor || "").toLowerCase() === vendorName.toLowerCase())
      .map((row) => this.data.projectById(row.projectId)?.name || String((row as any).projectName || ""))
      .filter(Boolean);
    const vendor = this.data.vendors().find((row) => row.name.toLowerCase() === vendorName.toLowerCase());
    for (const projectId of vendor?.projectIds || []) {
      const projectName = this.data.projectById(projectId)?.name;
      if (projectName) names.push(projectName);
    }
    return [...new Set(names)].sort((a, b) => a.localeCompare(b)).join(", ");
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
        ...this.allMaterialNames(),
        ...this.data.tableRowsFor("materials", this.tableRows().materials, (row) => this.rowBelongsToProject(row)).map((row) => String(row["materialName"] || row["name"] || "")),
      ].map((value) => value.trim()).filter(Boolean)),
    ].sort((first, second) => first.localeCompare(second));
  }

  private async loadAllMaterialNames(): Promise<void> {
    if (this.loadingAllMaterialNames()) return;
    this.loadingAllMaterialNames.set(true);
    const names = new Map<string, string>();
    try {
      let page = 1;
      let totalPages = 1;
      do {
        const response = await firstValueFrom(this.api.listMaterials({ limit: 200, page }));
        const items = response.items || [];
        for (const material of items) {
          const name = String(material?.name || "").trim();
          if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
        }
        totalPages = Math.max(1, Number(response.pages) || Math.ceil(Number(response.total || 0) / 200));
        page += 1;
        if (!items.length) break;
      } while (page <= totalPages);
      this.allMaterialNames.set([...names.values()].sort((a, b) => a.localeCompare(b)));
    } catch {
      // Keep the already hydrated material-name options if pagination fails.
    } finally {
      this.loadingAllMaterialNames.set(false);
    }
  }

  materialNoteHistory(row: TableRow): Array<{ note: string; date: string }> {
    try {
      const history = JSON.parse(String(row["__noteHistoryJson"] || "[]"));
      if (Array.isArray(history) && history.length) return history;
    } catch {
      // Fall through to the current note for legacy rows.
    }
    const note = String(row["notes"] || "").trim();
    return note ? [{ note, date: String(row["updatedAt"] || row["requestDate"] || row["createdAt"] || "") }] : [];
  }

  toggleMaterialNoteHistory(row: TableRow, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const key = this.rowKey(row);
    this.openMaterialNoteHistoryKey.update((current) => current === key ? "" : key);
  }

  isMaterialNoteHistoryOpen(row: TableRow): boolean {
    return this.openMaterialNoteHistoryKey() === this.rowKey(row);
  }

  formatMaterialNoteDate(value: string): string {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  private consolidatedMaterialNoteHistory(group: TableRow[]): Array<{ note: string; date: string }> {
    const entries: Array<{ note: string; date: string }> = [];
    for (const row of group) {
      let storedHistory: any[] = [];
      try {
        const parsed = JSON.parse(String(row["__noteHistoryJson"] || "[]"));
        if (Array.isArray(parsed)) storedHistory = parsed;
      } catch {
        storedHistory = [];
      }
      if (Array.isArray(storedHistory) && storedHistory.length) {
        for (const entry of storedHistory) {
          const note = String(entry?.note || "").trim();
          if (note) entries.push({ note, date: String(entry?.date || "") });
        }
      } else {
        const note = String(row["notes"] || "").trim();
        if (note) {
          entries.push({
            note,
            date: String(row["updatedAt"] || row["requestDate"] || row["createdAt"] || ""),
          });
        }
      }
    }
    const unique = new Map<string, { note: string; date: string }>();
    for (const entry of entries) unique.set(`${entry.date}|${entry.note}`, entry);
    return [...unique.values()].sort((a, b) => {
      const aTime = new Date(a.date).getTime() || 0;
      const bTime = new Date(b.date).getTime() || 0;
      return bTime - aTime;
    });
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
    if (section === "attendance") {
      // Render every field the supervisor's bulk roster captured so the
      // PDF / Excel mirrors what was submitted on the mobile app — site,
      // total count, labour-type breakup, project, and notes all flow
      // through. The legacy wage columns (lateFine, paymentMode, status)
      // remain dropped because the bulk roster doesn't track payroll.
      return [
        { key: "client", label: "Client" },
        { key: "projectName", label: "Project" },
        { key: "site", label: "Site" },
        { key: "attendanceDate", label: "Date", type: "date" },
        { key: "subcontractorName", label: "Subcontractor" },
        { key: "labourTypes", label: "Labour Types" },
        { key: "staffCount", label: "Total Workers", type: "number" },
        { key: "attendance", label: "Status" },
        { key: "shift", label: "Shift", type: "number" },
        { key: "notes", label: "Notes" },
        { key: "updatedAt", label: "Last Updated", type: "date" },
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
      description: "Opening balance",
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
    const staffSummary = new Map<string, { present: number; absent: number; staff: number; sub: string }>();
    for (const row of rows) {
      // Bulk subcontractor attendance rows don't carry a worker name —
      // fall back to the subcontractor so the summary aggregates the
      // supervisor's mobile-app submissions under the right party.
      const fallback = String(row["subcontractorName"] || "").trim() || "Unnamed";
      const name = String(row["staffName"] || row["labourName"] || fallback);
      const sub = String(row["subcontractorName"] || "").trim();
      const current = staffSummary.get(name) ?? { present: 0, absent: 0, staff: 0, sub };
      const isAbsent = String(row["attendance"] || "").toLowerCase() === "absent";
      if (isAbsent) current.absent += 1;
      else current.present += 1;
      const staffCount = this.moneyNumber(row["staffCount"]) || this.staffCountFromLabourTypes(String(row["labourTypes"] || ""));
      if (!isAbsent) current.staff += staffCount;
      if (!current.sub && sub) current.sub = sub;
      staffSummary.set(name, current);
    }
    if (!staffSummary.size) return "";
    const staffHtml = [...staffSummary.entries()]
      .map(
        ([name, value]) => {
          const subLine = value.sub ? ` <span class="summary-sub">(${this.escapeHtml(value.sub)})</span>` : "";
          return `<div><strong>${this.escapeHtml(name)}</strong>${subLine}<span>Present: ${value.present}</span><span>Absent: ${value.absent}</span><span>Staff: ${value.staff}</span></div>`;
        },
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
    .sheet { display: flex; min-height: calc(100vh - 60px); max-width: 1180px; margin: 0 auto; padding: 28px; flex-direction: column; border: 1px solid #cbd6e6; border-radius: 14px; background: #ffffff; }
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
    footer { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; width: 100%; margin-top: auto; padding-top: 64px; color: #526070; font-size: 12px; }
    footer div { min-height: 58px; padding-top: 12px; border-top: 1px solid #94a3b8; text-align: center; }
    .print-action { margin-top: 18px; border: 0; border-radius: 8px; background: #002263; color: #fff; padding: 11px 16px; font-weight: 900; cursor: pointer; }
    @page { margin: 12mm; }
    @media print { body { margin: 0; background: #fff; } .sheet { min-height: calc(100vh - 24mm); max-width: none; border: 0; border-radius: 0; padding: 0; } footer { break-inside: avoid; } button { display: none; } }
  </style>
</head>
<body>
  <main class="sheet">
    <header>
      <div><div class="brand">Annai Golden Builders PVT LTD</div><h1>${this.escapeHtml(config.title)}</h1><p>${this.escapeHtml(config.subtitle)}</p></div>
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
