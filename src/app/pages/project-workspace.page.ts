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
    description: "Staff attendance with site, date, staff name, labour types, shift count, overtime, fine, and daily pay.",
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
      { key: "dailyPay", label: "Daily Labour Pay" },
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
          [blurred]="recordDialogOpen() || fieldDialogOpen() || labourTypeDialogOpen() || showProjectForm()"
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
                    <span class="site-chip-unit" *ngFor="let site of projectSites()">
                      <button
                        type="button"
                        [class.active]="activeSiteFilter() === site"
                        (click)="selectSite(site)"
                      >
                        {{ site }}
                      </button>
                      <button
                        type="button"
                        class="site-delete-chip"
                        [disabled]="projectSites().length <= 1"
                        [attr.aria-label]="'Delete site ' + site"
                        (click)="deleteSite(site, $event)"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                          <path d="M6 6l12 12" />
                          <path d="M18 6 6 18" />
                        </svg>
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
                  <label class="table-search">
                    <ion-icon name="search-outline"></ion-icon>
                    <input [value]="tableSearch()" (input)="tableSearch.set($any($event.target).value)" placeholder="Search rows" />
                  </label>
                  <button type="button" class="primary-table-action add-row-action" title="Add row" aria-label="Add row" (click)="activeSection() === 'expenses' ? openRecordDialog() : addInlineRow()">
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

              <div class="expense-opening-editor" *ngIf="activeSection() === 'expenses'">
                <label>
                  <span>Opening Balance</span>
                  <input
                    inputmode="decimal"
                    [value]="expenseOpeningBalanceInput()"
                    (input)="updateExpenseOpeningBalance($any($event.target).value)"
                  />
                </label>
                <div>
                  <span>{{ expenseOpeningSiteLabel() }}</span>
                  <strong>Current balance {{ expenseCurrentBalanceLabel() }}</strong>
                </div>
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
                        [class.labour-types-cell-host]="activeSection() === 'labour' && column.key === 'labourTypes'"
                      >
                        <ng-container *ngIf="activeSection() === 'labour' && column.key === 'labourTypes'; else standardProjectCell">
                          <div class="labour-types-cell">
                            <span
                              class="editable-cell"
                              contenteditable="true"
                              spellcheck="false"
                              (blur)="updateCell(activeSection(), rowIndex, column.key, $any($event.target).textContent || '')"
                            >
                              {{ row[column.key] }}
                            </span>
                            <button type="button" (click)="openLabourTypeDialog(row)">Add labor type</button>
                          </div>
                        </ng-container>
                        <ng-template #standardProjectCell>
                          <div
                            *ngIf="selectOptions(activeSection(), column.key).length > 0; else editableProjectCell"
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
                                (click)="selectCellOption(activeSection(), rowIndex, column.key, option)"
                              >
                                {{ option }}
                              </button>
                              <label class="custom-select-entry" *ngIf="allowsCustomOption(activeSection(), column.key)">
                                <span>Custom</span>
                                <input
                                  [value]="selectCustomValue()"
                                  (input)="selectCustomValue.set($any($event.target).value)"
                                  (keydown.enter)="saveCustomSelectOption(activeSection(), rowIndex, column.key, $event)"
                                  placeholder="Type value"
                                />
                              </label>
                              <button
                                *ngIf="allowsCustomOption(activeSection(), column.key)"
                                type="button"
                                class="custom-select-save"
                                (click)="saveCustomSelectOption(activeSection(), rowIndex, column.key)"
                              >
                                Use custom value
                              </button>
                            </div>
                          </div>
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
                <div class="expense-opening-modal" *ngIf="activeSection() === 'expenses'">
                  <label>
                    <span>Opening Balance for {{ expenseDraftSiteLabel() }}</span>
                    <input
                      inputmode="decimal"
                      [value]="expenseDraftOpeningBalanceInput()"
                      (input)="updateExpenseDraftOpeningBalance($any($event.target).value)"
                    />
                  </label>
                </div>
                <div class="erp-form">
                  <label *ngFor="let column of columnsFor(activeSection())">
                    <span>{{ column.label }}</span>
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
                      (input)="labourTypeName.set($any($event.target).value)"
                      placeholder="Mason, Helper, Electrician"
                    />
                    <datalist id="project-labour-type-options">
                      <option value="Mason"></option>
                      <option value="Helper"></option>
                      <option value="Electrician"></option>
                      <option value="Plumber"></option>
                      <option value="Mechanic"></option>
                      <option value="Civil"></option>
                    </datalist>
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
  readonly openSelectKey = signal("");
  readonly selectCustomValue = signal("");
  readonly labourTypeDialogOpen = signal(false);
  readonly labourTypeRowId = signal("");
  readonly labourTypeName = signal("Mason");
  readonly labourTypeCount = signal("1");
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
      const options = this.selectOptions(this.activeSection(), column.key);
      row[column.key] = column.key === "site" && this.activeSiteFilter() !== "All" ? this.activeSiteFilter() : options[0] ?? "";
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

  deleteSite(site: string, event: Event) {
    event.stopPropagation();
    const updatedProject = this.data.removeSiteFromProject(this.projectId(), site);
    if (updatedProject && this.activeSite() === site) this.activeSite.set("All");
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
    if (!rowId) return;
    const cleanValue = value.trim();
    this.data.updateSharedRowCell(rowId, key, cleanValue);
    if (section === "labour" && key === "labourTypes") this.data.updateSharedRowCell(rowId, "notes", cleanValue);
  }

  deleteRow(row: TableRow) {
    this.data.deleteSharedRow(String(row["__rowId"] || ""));
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

  saveCustomSelectOption(section: ModuleKey, visibleIndex: number, key: string, event?: Event) {
    event?.preventDefault();
    const value = this.selectCustomValue().trim();
    if (!value) return;
    this.selectCellOption(section, visibleIndex, key, value);
  }

  allowsCustomOption(section: ModuleKey, key: string): boolean {
    return (section === "expenses" && key === "transactionType") || (section === "labour" && key === "staffName");
  }

  openLabourTypeDialog(row: TableRow) {
    this.labourTypeRowId.set(String(row["__rowId"] || ""));
    this.labourTypeName.set("Mason");
    this.labourTypeCount.set("1");
    this.labourTypeDialogOpen.set(true);
  }

  closeLabourTypeDialog() {
    this.labourTypeDialogOpen.set(false);
    this.labourTypeRowId.set("");
  }

  saveLabourType(event: Event) {
    event.preventDefault();
    const rowId = this.labourTypeRowId();
    const type = this.labourTypeName().trim();
    const count = Math.max(0, Math.round(this.moneyNumber(this.labourTypeCount())));
    if (!rowId || !type || !count) return;
    const row = this.visibleRows("labour").find((entry) => String(entry["__rowId"] || "") === rowId);
    const nextTypes = this.mergeLabourType(String(row?.["labourTypes"] || ""), type, count);
    this.data.updateSharedRowCell(rowId, "labourTypes", nextTypes);
    this.data.updateSharedRowCell(rowId, "notes", nextTypes);
    this.closeLabourTypeDialog();
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
      labourTypes: this.labourTypesFromRow(row),
      staffCount: row.presentCount,
      attendance: "Present",
      shift: this.normalizeShift(row.shift),
      overtime: `${row.overtime} hrs`,
      dailyPay: formatMoney(row.dailyWage),
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
    return key === "runningBalance" || key === "weeklyPayable" || key === "weeklyPay" || key === "staffCount" || key === "balance";
  }

  selectOptions(section: ModuleKey, key: string): string[] {
    if (key === "site") return this.projectSites();
    if (section === "labour" && key === "staffName") return this.staffNameOptionsForProject();
    if (section === "expenses" && key === "transactionType") {
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
    if (section === "labour" && key === "attendance") return ["Present", "Absent"];
    if (section === "labour" && key === "shift") return ["1", "2", "3"];
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
        dailyPay: "0",
        lateFine: "0",
        presentUnits: 1,
        paymentMode: "Cash",
        notes: "Mason: 1",
        status: "Pending",
      },
      expenses: {
        expenseDate: today,
        transactionType: "Site Expense",
        description: "",
        amount: "0",
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
    const balances = new Map<string, number>();
    return rows.map((row) => {
      const transactionType = String(row["transactionType"] || row["expenseScope"] || "Site Expense");
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

  private mergeLabourType(currentValue: string, labourType: string, count: number): string {
    const entries = new Map<string, number>();
    for (const part of currentValue.split(/[,;\n]+/)) {
      const [rawType, rawCount] = part.split(/[:x-]/);
      const type = rawType?.trim();
      const parsedCount = this.moneyNumber(rawCount);
      if (type && parsedCount) entries.set(type, parsedCount);
    }
    const existingKey = [...entries.keys()].find((key) => key.toLowerCase() === labourType.toLowerCase());
    entries.set(existingKey ?? labourType, count);
    return [...entries.entries()].map(([type, value]) => `${type}: ${value}`).join(", ");
  }

  expenseOpeningSiteLabel(): string {
    const site = this.activeSiteFilter();
    return site === "All" ? "Select a site to edit its opening balance" : `${site} opening balance`;
  }

  expenseOpeningBalanceInput(): string {
    return String(this.expenseOpeningBalanceFor({ projectId: this.projectId(), site: this.expenseEditableSite() }));
  }

  updateExpenseOpeningBalance(value: string) {
    this.data.setExpenseOpeningBalance(this.projectId(), this.expenseEditableSite(), this.moneyNumber(value));
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
    if (this.activeSiteFilter() === "All") {
      const rows = this.visibleRows("expenses");
      if (rows.length) {
        const openings = new Map<string, number>();
        for (const row of rows) openings.set(this.expenseGroupKey(row), this.expenseOpeningBalanceFor(row));
        return formatMoney([...openings.values()].reduce((sum, amount) => sum + amount, 0));
      }
    }
    return formatMoney(this.expenseOpeningBalanceFor({ projectId: this.projectId(), site: this.activeSiteFilter() }));
  }

  expenseCurrentBalanceLabel(): string {
    const rows = this.visibleRows("expenses");
    if (!rows.length) return this.expenseOpeningBalanceLabel();
    const latestByGroup = new Map<string, number>();
    for (const row of rows) latestByGroup.set(this.expenseGroupKey(row), this.moneyNumber(row["runningBalance"]));
    if (this.activeSiteFilter() !== "All") {
      return formatMoney([...latestByGroup.values()].at(-1) ?? this.expenseOpeningBalanceFor({ projectId: this.projectId(), site: this.activeSiteFilter() }));
    }
    const total = [...latestByGroup.values()].reduce((sum, balance) => sum + balance, 0);
    return formatMoney(total);
  }

  private expenseGroupKey(row: TableRow): string {
    const projectId = String(row["projectId"] || row["__projectId"] || this.projectId() || "project");
    const site = String(row["site"] || "Project").trim().toLowerCase();
    return `${projectId}::${site}`;
  }

  private expenseOpeningBalanceFor(row: TableRow): number {
    const projectId = String(row["projectId"] || row["__projectId"] || this.projectId());
    const site = String(row["site"] || this.expenseEditableSite());
    const savedOpening = this.data.expenseOpeningBalanceFor(projectId, site);
    if (savedOpening !== undefined) return savedOpening;
    const explicitOpening = this.explicitExpenseOpeningForGroup(projectId, site);
    if (explicitOpening) return explicitOpening;
    const project = this.data.projectById(projectId);
    return project?.expenseBalance ?? 0;
  }

  private expenseSignedAmount(row: TableRow, transactionType = String(row["transactionType"] || "")): number {
    const amountText = String(row["amount"] ?? "").trim();
    const amount = this.moneyNumber(amountText);
    if (!amount) return 0;
    if (amountText.startsWith("+") || amountText.startsWith("-")) return amount;
    return this.isExpenseCredit(transactionType) ? Math.abs(amount) : -Math.abs(amount);
  }

  private explicitExpenseOpeningForGroup(projectId: string, site: string): number {
    const normalizedSite = site.trim().toLowerCase();
    if (!normalizedSite || normalizedSite === "all") return 0;
    const rows = this.data.tableRowsFor("expenses", this.tableRows().expenses, (row) => this.rowBelongsToProject(row));
    const match = rows.find((row) => {
      const rowProjectId = String(row["projectId"] || row["__projectId"] || this.projectId());
      const rowSite = String(row["site"] || "").trim().toLowerCase();
      return rowProjectId === projectId && rowSite === normalizedSite && (this.moneyNumber(row["openingBalance"]) || this.moneyNumber(row["cashIssued"]));
    });
    return match ? this.moneyNumber(match["openingBalance"]) || this.moneyNumber(match["cashIssued"]) : 0;
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

  private escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
