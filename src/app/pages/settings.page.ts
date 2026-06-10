import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { IonContent, IonSplitPane } from "@ionic/angular/standalone";
import {
  ErpDataService,
  managedRoleNames,
  type ManagedRole,
  type RolePermissionLevel,
  type SharedModuleKey,
} from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";

type PermissionModuleKey = Exclude<SharedModuleKey, "settings">;
type PermissionField = { key: string; label: string };
type PermissionGroup = { key: PermissionModuleKey; label: string; fields: PermissionField[] };

const permissionLevels: Array<{ key: RolePermissionLevel; label: string; note: string }> = [
  { key: "hidden", label: "Hidden", note: "Cannot view" },
  { key: "read", label: "Read", note: "View only" },
  { key: "write", label: "Write", note: "Add records" },
  { key: "edit", label: "Edit", note: "Full changes" },
];

const permissionGroups: PermissionGroup[] = [
  {
    key: "clients",
    label: "Clients",
    fields: [
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
  },
  {
    key: "materials",
    label: "Materials",
    fields: [
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
  },
  {
    key: "labour",
    label: "Labour",
    fields: [
      { key: "client", label: "Client" },
      { key: "clientId", label: "Client ID" },
      { key: "projectId", label: "Project ID" },
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "attendanceDate", label: "Date" },
      { key: "staffName", label: "Staff Name" },
      { key: "labourTypes", label: "Labour Types" },
      { key: "staffCount", label: "Staff Count" },
      { key: "attendance", label: "Attendance" },
      { key: "shift", label: "Shift" },
      { key: "weeklyPayTotal", label: "Weekly Pay Total" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "expenses",
    label: "Site Expenses",
    fields: [
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
  },
  {
    key: "payments",
    label: "Payments",
    fields: [
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
  },
  {
    key: "vendors",
    label: "Vendors",
    fields: [
      { key: "vendorId", label: "Vendor ID" },
      { key: "vendorName", label: "Vendor Name" },
      { key: "materialType", label: "Material Type" },
      { key: "materialsBought", label: "Materials Bought" },
      { key: "phoneNumber", label: "Phone Number" },
      { key: "address", label: "Address" },
      { key: "gstNumber", label: "GST Number" },
    ],
  },
  {
    key: "supervisors",
    label: "Supervisors",
    fields: [
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
  },
  {
    key: "subcontractors",
    label: "Subcontracts",
    fields: [
      { key: "subcontractId", label: "Subcontract ID" },
      { key: "client", label: "Client" },
      { key: "project", label: "Project" },
      { key: "site", label: "Site" },
      { key: "subcontractorName", label: "Subcontractor Name" },
      { key: "workPackage", label: "Work Package" },
      { key: "contractValue", label: "Contract Value" },
      { key: "advancePaid", label: "Advance Paid" },
      { key: "balance", label: "Balance" },
      { key: "approvalStatus", label: "Approval Status" },
      { key: "paymentStatus", label: "Payment Status" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    fields: [
      { key: "category", label: "Category" },
      { key: "reportName", label: "Report Name" },
      { key: "scope", label: "Scope" },
      { key: "owner", label: "Owner" },
      { key: "exportFormat", label: "Export Format" },
    ],
  },
];

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="settings"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header title="Settings" eyebrow="Administration" metaLabel="System preferences" [showTitle]="false" searchPlaceholder="Search settings..." />

        <ion-content class="erp-page">
          <main class="workspace-shell settings-shell">
            <section class="settings-hero">
              <div>
                <span>System settings</span>
                <h1>Company Preferences</h1>
                <p>Configure the defaults that shape client projects, approval flows, exports, and workspace access.</p>
              </div>
              <div class="settings-status">
                <strong>Active</strong>
                <span>Last updated today</span>
              </div>
            </section>

            <section class="settings-grid">
              <article class="settings-card">
                <div>
                  <span>Projects</span>
                  <h2>Project Defaults</h2>
                  <p>Applied when a client is created or a new project is opened.</p>
                </div>
                <label>
                  <span>Default Site Name</span>
                  <input value="Main Site" />
                </label>
                <label>
                  <span>Default Project Status</span>
                  <select>
                    <option>Active</option>
                    <option>On Hold</option>
                    <option>Completed</option>
                  </select>
                </label>
                <div class="settings-toggle">
                  <div>
                    <strong>Auto-create project</strong>
                    <span>Create a starter project when a new client is saved.</span>
                  </div>
                  <input type="checkbox" checked />
                </div>
              </article>

              <article class="settings-card settings-site-profile">
                <div>
                  <span>Profile</span>
                  <h2>Site Directory</h2>
                  <p>Reusable site names for project forms, labour entries, and site expense filters.</p>
                </div>
                <div class="settings-site-chips" aria-label="Saved site names">
                  <span class="settings-site-chip" *ngFor="let site of profileSites()">
                    {{ site }}
                    <button type="button" aria-label="Remove site" (click)="removeProfileSite(site)">
                      <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                        <path d="m5.5 5.5 9 9" />
                        <path d="m14.5 5.5-9 9" />
                      </svg>
                    </button>
                  </span>
                </div>
                <label>
                  <span>Add Site</span>
                  <input
                    list="profile-site-options"
                    [value]="siteDraft()"
                    (input)="siteDraft.set($any($event.target).value)"
                    (keydown.enter)="addProfileSite($event)"
                    placeholder="Type or choose a site"
                  />
                  <datalist id="profile-site-options">
                    <option *ngFor="let site of allKnownSites()" [value]="site"></option>
                  </datalist>
                </label>
                <button type="button" class="settings-inline-action" (click)="addProfileSite()">Add site</button>
              </article>

              <article class="settings-card settings-role-card">
                <div class="settings-role-card-head">
                  <div>
                    <span>Access Control</span>
                    <h2>Roles & Responsibilities</h2>
                    <p>Admin can create responsibility options and decide which fields each role can read, write, or edit.</p>
                  </div>
                  <div class="settings-role-admin-note">
                    <strong>Admin</strong>
                    <span>Full access</span>
                  </div>
                </div>

                <div class="settings-role-tabs" role="tablist" aria-label="Role selector">
                  <button
                    type="button"
                    *ngFor="let role of roles"
                    [class.active]="activeRole() === role"
                    (click)="selectRole(role)"
                  >
                    {{ role }}
                  </button>
                </div>

                <div class="settings-role-layout">
                  <aside class="settings-role-panel">
                    <div>
                      <span>Current Role</span>
                      <h3>{{ activeRole() }}</h3>
                      <p>{{ roleHelpText(activeRole()) }}</p>
                    </div>

                    <form class="settings-role-option-form" (submit)="addRoleOption($event)">
                      <label>
                        <span>Add Responsibility Option</span>
                        <input
                          [value]="roleOptionDraft()"
                          (input)="roleOptionDraft.set($any($event.target).value)"
                          placeholder="Example: Site expense approval"
                        />
                      </label>
                      <button type="submit">Add option</button>
                    </form>

                    <div class="settings-role-options" aria-label="Role responsibility options">
                      <span class="settings-role-option" *ngFor="let option of roleOptions()">
                        {{ option.label }}
                        <button type="button" aria-label="Remove responsibility option" (click)="deleteRoleOption(option.id)">
                          <svg viewBox="0 0 20 20" class="svg-icon" aria-hidden="true">
                            <path d="m5.5 5.5 9 9" />
                            <path d="m14.5 5.5-9 9" />
                          </svg>
                        </button>
                      </span>
                    </div>

                    <div class="settings-permission-legend">
                      <div *ngFor="let level of permissionLevels">
                        <strong>{{ level.label }}</strong>
                        <span>{{ level.note }}</span>
                      </div>
                    </div>
                  </aside>

                  <div class="settings-permission-matrix">
                    <div class="settings-permission-heading">
                      <strong>Field Access</strong>
                      <span>Changes save automatically for {{ activeRole() }}.</span>
                    </div>

                    <section class="settings-permission-group" *ngFor="let group of permissionGroups()">
                      <h3>{{ group.label }}</h3>
                      <div class="settings-permission-row" *ngFor="let field of group.fields">
                        <div class="settings-permission-field">
                          <strong>{{ field.label }}</strong>
                          <span>{{ group.key }}.{{ field.key }}</span>
                        </div>
                        <div class="settings-radio-grid" role="radiogroup" [attr.aria-label]="group.label + ' ' + field.label + ' access'">
                          <label *ngFor="let level of permissionLevels">
                            <input
                              type="radio"
                              [name]="permissionId(group.key, field.key) + '-' + activeRole()"
                              [checked]="permissionValue(group.key, field.key) === level.key"
                              (change)="setPermission(group.key, field.key, level.key)"
                            />
                            <span>{{ level.label }}</span>
                          </label>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </article>

              <article class="settings-card">
                <div>
                  <span>Review</span>
                  <h2>Approval Controls</h2>
                  <p>Keep pending work visible without adding extra navigation steps.</p>
                </div>
                <div class="settings-check-row">
                  <div>
                    <strong>Expense review queue</strong>
                    <span>Site and general expenses appear in Pending Approvals.</span>
                  </div>
                  <span class="settings-check-mark" aria-hidden="true">
                    <svg viewBox="0 0 20 20" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
                  </span>
                </div>
                <div class="settings-check-row">
                  <div>
                    <strong>Payment verification</strong>
                    <span>Collections require accountant confirmation.</span>
                  </div>
                  <span class="settings-check-mark" aria-hidden="true">
                    <svg viewBox="0 0 20 20" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
                  </span>
                </div>
                <div class="settings-check-row">
                  <div>
                    <strong>Material quantity approval</strong>
                    <span>Project managers enter approved quantity before approval.</span>
                  </div>
                  <span class="settings-check-mark" aria-hidden="true">
                    <svg viewBox="0 0 20 20" class="svg-icon"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
                  </span>
                </div>
                <label class="settings-toggle">
                  <div>
                    <strong>Single approve for Site Expense and Materials</strong>
                    <span>When a site expense creates a material row, approving either linked item clears the pair.</span>
                  </div>
                  <input
                    type="checkbox"
                    [checked]="data.settings().singleApprovalForSiteExpenseMaterials"
                    (change)="updateSingleApproval($any($event.target).checked)"
                  />
                </label>
              </article>

              <article class="settings-card">
                <div>
                  <span>Exports</span>
                  <h2>Report Preferences</h2>
                  <p>Control file naming and export defaults.</p>
                </div>
                <label>
                  <span>Default Export Format</span>
                  <select>
                    <option>Excel</option>
                    <option>PDF</option>
                  </select>
                </label>
                <label>
                  <span>Export Prefix</span>
                  <input value="AGB" />
                </label>
                <div class="settings-toggle">
                  <div>
                    <strong>Include project ID</strong>
                    <span>Append project IDs to exported records.</span>
                  </div>
                  <input type="checkbox" checked />
                </div>
              </article>

              <article class="settings-card">
                <div>
                  <span>Appearance</span>
                  <h2>Workspace Theme</h2>
                  <p>Use a calm professional palette in light mode and a purpose-built navy dark mode.</p>
                </div>
                <div class="settings-mode-row">
                  <button type="button" class="active">Light</button>
                  <button type="button">Dark</button>
                  <button type="button">System</button>
                </div>
                <div class="settings-theme-chip">
                  <span aria-hidden="true"></span>
                  <div>
                    <strong>Primary accent</strong>
                    <small>#002263</small>
                  </div>
                </div>
              </article>
            </section>
          </main>
        </ion-content>
      </div>
    </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  readonly data = inject(ErpDataService);

  readonly roles = managedRoleNames;
  readonly permissionLevels = permissionLevels;
  readonly activeRole = signal<ManagedRole>("Project Manager");
  readonly roleOptionDraft = signal("");
  readonly profileSites = signal(this.allKnownSites());
  readonly siteDraft = signal("");

  allKnownSites(): string[] {
    return [...new Set(this.data.projects().flatMap((project) => project.sites).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  addProfileSite(event?: Event) {
    event?.preventDefault();
    const site = this.siteDraft().trim();
    if (!site) return;
    this.profileSites.update((sites) => (sites.some((value) => value.toLowerCase() === site.toLowerCase()) ? sites : [...sites, site].sort((a, b) => a.localeCompare(b))));
    this.siteDraft.set("");
  }

  removeProfileSite(site: string) {
    this.profileSites.update((sites) => sites.filter((value) => value !== site));
  }

  updateSingleApproval(enabled: boolean) {
    this.data.updateSettings({ singleApprovalForSiteExpenseMaterials: enabled });
  }

  selectRole(role: ManagedRole) {
    this.activeRole.set(role);
    this.roleOptionDraft.set("");
  }

  roleOptions() {
    return this.data.roleOptionsFor(this.activeRole());
  }

  addRoleOption(event?: Event) {
    event?.preventDefault();
    const option = this.data.addRoleOption(this.activeRole(), this.roleOptionDraft());
    if (option) this.roleOptionDraft.set("");
  }

  deleteRoleOption(optionId: string) {
    this.data.deleteRoleOption(optionId);
  }

  permissionGroups(): PermissionGroup[] {
    return permissionGroups.map((group) => {
      const customFields = this.data.customFieldsFor(group.key).map((field) => ({ key: field.key, label: field.label }));
      const knownKeys = new Set(group.fields.map((field) => field.key));
      return {
        ...group,
        fields: [...group.fields, ...customFields.filter((field) => !knownKeys.has(field.key))],
      };
    });
  }

  permissionId(module: PermissionModuleKey, field: string): string {
    return `${module}.${field}`;
  }

  permissionValue(module: PermissionModuleKey, field: string): RolePermissionLevel {
    return this.data.rolePermission(this.activeRole(), this.permissionId(module, field));
  }

  setPermission(module: PermissionModuleKey, field: string, level: RolePermissionLevel) {
    this.data.setRolePermission(this.activeRole(), this.permissionId(module, field), level);
  }

  roleHelpText(role: ManagedRole): string {
    if (role === "Project Manager") return "Project managers usually review approvals, project progress, site records, and subcontract work.";
    if (role === "Accountant") return "Accountants usually manage payment collections, ledgers, expenses, exports, and verification.";
    return "Supervisors usually enter field-level material, labour, attendance, and site expense records.";
  }
}
