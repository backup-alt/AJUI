import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal, OnDestroy, DestroyRef } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonSplitPane } from "@ionic/angular/standalone";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ErpDataService,
  managedRoleNames,
  type ManagedRole,
  type RolePermissionLevel,
  type SharedModuleKey,
} from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { ApiService } from "../core/api.service";

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
      { key: "cashLimits", label: "Cash Limit" },
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

export interface ActiveInviteDisplay {
  inviteId: string;
  token: string;
  qrDataUrl: string;
  supervisorName: string;
  supervisorEmail: string;
  expiresAt: string;
  remainingMs: number;
  scanned: boolean;
  otp?: string;
  emailSent?: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="settings"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header title="Settings" eyebrow="Administration" [showTitle]="false" searchPlaceholder="Search" />

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
              <article class="settings-card settings-supervisor-card">
                <div>
                  <span>Team</span>
                  <h2>Add Supervisor</h2>
                  <p>Enter the supervisor's name and email to generate a time-limited QR code. They scan it from the AGB app to activate their account.</p>
                </div>

                <ng-container *ngIf="!currentInvite() && !scanSuccess()">
                  <div class="settings-invite-form">
                    <label>
                      <span>Supervisor Name</span>
                      <input
                        type="text"
                        [value]="supervisorNameDraft()"
                        (input)="supervisorNameDraft.set($any($event.target).value)"
                        placeholder="e.g. Rajesh Kumar"
                        maxlength="80"
                      />
                    </label>
                    <label>
                      <span>Supervisor Email</span>
                      <input
                        type="email"
                        [value]="supervisorEmailDraft()"
                        (input)="supervisorEmailDraft.set($any($event.target).value)"
                        placeholder="e.g. rajesh@annabuilders.com"
                      />
                    </label>
                    <label>
                      <span>Supervisor Mobile Number</span>
                      <input
                        type="tel"
                        [value]="supervisorPhoneDraft()"
                        (input)="supervisorPhoneDraft.set($any($event.target).value)"
                        placeholder="e.g. +91 98765 43210"
                      />
                    </label>
                    <p class="settings-error" *ngIf="supervisorError()">{{ supervisorError() }}</p>
                    <button
                      type="button"
                      class="settings-inline-action"
                      [disabled]="supervisorLoading()"
                      (click)="generateSupervisorQr()">
                      {{ supervisorLoading() ? 'Generating…' : 'Generate QR Code' }}
                    </button>
                  </div>
                </ng-container>

                <ng-container *ngIf="currentInvite() as invite">
                  <div class="settings-qr-card" [class.settings-qr-scanned]="invite.scanned">
                    <div class="settings-qr-header">
                      <div>
                        <strong>{{ invite.supervisorName }}</strong>
                        <small>{{ invite.supervisorEmail }}</small>
                      </div>
                      <div class="settings-qr-timer" [class.settings-qr-expired]="invite.remainingMs <= 0">
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" fill="none"
                            [style.stroke-dasharray]="countdownCircle(invite.remainingMs)"
                            stroke-dashoffset="0"
                            transform="rotate(-90 10 10)"
                          />
                          <text x="10" y="14" text-anchor="middle" font-size="7" fill="currentColor">{{ formatCountdown(invite.remainingMs) }}</text>
                        </svg>
                        <span *ngIf="invite.remainingMs > 0">{{ formatCountdown(invite.remainingMs) }}</span>
                        <span *ngIf="invite.remainingMs <= 0" class="settings-qr-expired-label">Expired</span>
                      </div>
                    </div>
                    <div class="settings-qr-frame">
                      <img [src]="invite.qrDataUrl" alt="Supervisor QR Code" />
                    </div>
                    <p class="settings-hint" *ngIf="!invite.scanned">
                      Ask the supervisor to open the <strong>AGB</strong> app, tap <strong>Scan QR</strong> on the welcome screen, and enter the OTP sent to their email.
                    </p>
                    <div class="settings-otp-block" *ngIf="!invite.scanned && invite.otp && invite.emailSent === false">
                      <span class="settings-otp-label">Email delivery failed — share this code verbally with the supervisor</span>
                      <strong class="settings-otp-code">{{ invite.otp }}</strong>
                    </div>
                    <div class="settings-scan-success" *ngIf="invite.scanned">
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="10" cy="10" r="8" fill="#d4edda" stroke="#28a745" stroke-width="1.5"/>
                        <path d="m6 10.5 2.5 2.5 5-5" stroke="#28a745" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                      </svg>
                      <span>Supervisor scanned! They can now set up their password.</span>
                    </div>
                    <div class="settings-qr-actions">
                      <button type="button" class="settings-resend-btn" (click)="resendOtp(invite.token)" [disabled]="resendingOtp()">
                        {{ resendingOtp() ? 'Sending…' : 'Resend OTP' }}
                      </button>
                      <button type="button" class="settings-inline-action settings-secondary-action" (click)="resetSupervisorInvite()">
                        Generate another
                      </button>
                    </div>
                  </div>
                </ng-container>

                <div class="settings-scan-success-banner" *ngIf="scanSuccess() && !currentInvite()">
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="10" cy="10" r="8" fill="#d4edda" stroke="#28a745" stroke-width="1.5"/>
                    <path d="m6 10.5 2.5 2.5 5-5" stroke="#28a745" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  </svg>
                  <span>Supervisor account activated! They can now log in with their phone and password.</span>
                  <button type="button" (click)="scanSuccess.set(false)">Dismiss</button>
                </div>

                <div class="settings-active-invites" *ngIf="activeInvites().length > 0">
                  <h3>Active QR Codes</h3>
                  <div class="settings-invite-list">
                    <div
                      class="settings-invite-row"
                      *ngFor="let inv of activeInvites()"
                      [class.settings-invite-scanned]="!isInviteInList(inv.token)"
                    >
                      <div class="settings-invite-row-info">
                        <strong>{{ inv.supervisorName }}</strong>
                        <small>{{ inv.supervisorEmail }}</small>
                      </div>
                      <div class="settings-invite-row-timer" *ngIf="isInviteInList(inv.token)">
                        <span [class.settings-qr-expired-label]="inv.remainingMs <= 0">{{ formatCountdown(inv.remainingMs) }}</span>
                      </div>
                      <div class="settings-invite-row-status" *ngIf="!isInviteInList(inv.token)">
                        <span class="settings-badge-settings settings-badge-scanned">Scanned</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <article class="settings-card settings-deactivate-card">
                <div>
                  <span>Team</span>
                  <h2>Deactivate Supervisor</h2>
                  <p>Use this to remove a supervisor's access (for example, when they have already registered with their email/phone but cannot complete setup). Enter their email or phone number to find and deactivate their account.</p>
                </div>

                <div class="settings-invite-form">
                  <label>
                    <span>Email or Phone Number</span>
                    <input
                      type="text"
                      [value]="deactivateSearch()"
                      (input)="deactivateSearch.set($any($event.target).value)"
                      placeholder="e.g. rajesh@agbuilders.com or +91 98765 43210"
                    />
                  </label>
                  <p class="settings-error" *ngIf="deactivateError()">{{ deactivateError() }}</p>
                  <p class="settings-success" *ngIf="deactivateSuccess()">{{ deactivateSuccess() }}</p>
                  <button
                    type="button"
                    class="settings-inline-action settings-danger-action"
                    [disabled]="deactivateLoading()"
                    (click)="deactivateSupervisor()">
                    {{ deactivateLoading() ? 'Deactivating…' : 'Deactivate Supervisor' }}
                  </button>
                </div>
              </article>

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

            </section>
          </main>
        </ion-content>
      </div>
    </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnDestroy {
  readonly data = inject(ErpDataService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roles = managedRoleNames;
  readonly permissionLevels = permissionLevels;
  readonly activeRole = signal<ManagedRole>("Project Manager");
  readonly roleOptionDraft = signal("");
  readonly profileSites = signal(this.allKnownSites());
  readonly siteDraft = signal("");

  readonly supervisorNameDraft = signal("");
  readonly supervisorEmailDraft = signal("");
  readonly supervisorPhoneDraft = signal("");
  readonly supervisorLoading = signal(false);
  readonly supervisorError = signal<string | null>(null);
  readonly resendingOtp = signal(false);
  readonly currentInvite = signal<ActiveInviteDisplay | null>(null);
  readonly activeInvites = signal<Array<{ token: string; supervisorName: string; supervisorEmail: string; expiresAt: string; remainingMs: number }>>([]);
  readonly scanSuccess = signal(false);

  readonly deactivateSearch = signal("");
  readonly deactivateLoading = signal(false);
  readonly deactivateError = signal<string | null>(null);
  readonly deactivateSuccess = signal<string | null>(null);

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startActiveInvitesPoll();
  }

  ngOnDestroy() {
    this.stopPolls();
  }

  private startActiveInvitesPoll() {
    this.pollActiveInvites();
    this.pollInterval = setInterval(() => this.pollActiveInvites(), 10_000);
  }

  private stopPolls() {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }

  private pollActiveInvites() {
    this.api.listActiveInvites().subscribe({
      next: (res) => {
        const fresh = res.invites.map((inv) => ({
          token: inv.token,
          supervisorName: inv.supervisorName,
          supervisorEmail: inv.supervisorEmail,
          expiresAt: inv.expiresAt,
          remainingMs: Math.max(0, inv.remainingMs),
        }));
        this.activeInvites.set(fresh);

        const current = this.currentInvite();
        if (current && !current.scanned) {
          const found = fresh.find((f) => f.token === current.token);
          if (!found) {
            this.currentInvite.set({ ...current, scanned: true });
            this.scanSuccess.set(true);
            setTimeout(() => {
              this.currentInvite.set(null);
              this.scanSuccess.set(false);
            }, 5000);
          } else {
            this.currentInvite.update((c) => c ? { ...c, remainingMs: found.remainingMs } : c);
          }
        }
      },
      error: () => {},
    });
  }

  private startCountdown() {
    this.stopPolls();
    this.countdownInterval = setInterval(() => {
      const current = this.currentInvite();
      if (!current) return;
      const newRemaining = Math.max(0, current.remainingMs - 1000);
      if (newRemaining <= 0) {
        this.currentInvite.update((c) => c ? { ...c, remainingMs: 0 } : c);
        clearInterval(this.countdownInterval!);
        return;
      }
      this.currentInvite.update((c) => c ? { ...c, remainingMs: newRemaining } : c);
    }, 1000);
    this.pollInterval = setInterval(() => this.pollActiveInvites(), 10_000);
  }

  generateSupervisorQr() {
    const name = this.supervisorNameDraft().trim();
    const email = this.supervisorEmailDraft().trim();
    const phone = this.supervisorPhoneDraft().trim();
    if (name.length < 2) {
      this.supervisorError.set("Please enter at least 2 characters for the name.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.supervisorError.set("Please enter a valid email address.");
      return;
    }
    if (!phone || phone.replace(/\D/g, "").length < 8) {
      this.supervisorError.set("Please enter a valid mobile number (at least 8 digits).");
      return;
    }
    this.supervisorError.set(null);
    this.supervisorLoading.set(true);

    this.api.createSupervisorInvite({ supervisorName: name, supervisorEmail: email, supervisorPhone: phone }).subscribe({
      next: (invite) => {
        const fiveMinMs = 5 * 60 * 1000;
        this.currentInvite.set({
          inviteId: invite.inviteId,
          token: invite.token,
          qrDataUrl: invite.qrDataUrl,
          supervisorName: invite.supervisorName,
          supervisorEmail: invite.supervisorEmail,
          expiresAt: invite.expiresAt,
          remainingMs: fiveMinMs,
          scanned: false,
          otp: invite.otp,
          emailSent: invite.emailSent,
        });
        this.supervisorLoading.set(false);
        this.startCountdown();
      },
      error: (err) => {
        const status = err?.status ?? err?.statusCode;
        const detail = err?.error?.error || err?.message || "Failed to generate QR.";
        const hint =
          status === 0 ? " (network error — is the backend running?)" :
          status === 401 ? " (session expired — sign in again)" :
          status === 403 ? " (your account isn't an admin)" : "";
        this.supervisorError.set(`[${status ?? "?"}] ${detail}${hint}`);
        this.supervisorLoading.set(false);
      },
    });
  }

  resetSupervisorInvite() {
    this.stopPolls();
    this.currentInvite.set(null);
    this.supervisorNameDraft.set("");
    this.supervisorEmailDraft.set("");
    this.supervisorPhoneDraft.set("");
    this.supervisorError.set(null);
    this.startActiveInvitesPoll();
  }

  deactivateSupervisor() {
    const search = this.deactivateSearch().trim();
    if (!search) {
      this.deactivateError.set("Please enter an email or phone number.");
      return;
    }

    const payload: { email?: string; phone?: string } = {};
    if (search.includes("@")) {
      payload.email = search;
    } else {
      payload.phone = search;
    }

    this.deactivateLoading.set(true);
    this.deactivateError.set(null);
    this.deactivateSuccess.set(null);

    this.api.deactivateSupervisor(payload).subscribe({
      next: (res) => {
        this.deactivateSuccess.set(`Supervisor "${res.supervisor.name}" (${res.supervisor.email || res.supervisor.phone}) has been deactivated.`);
        this.deactivateSearch.set("");
        this.deactivateLoading.set(false);
        setTimeout(() => this.deactivateSuccess.set(null), 5000);
      },
      error: (err) => {
        const status = err?.status ?? err?.statusCode;
        const detail = err?.error?.error || err?.message || "Failed to deactivate supervisor.";
        this.deactivateError.set(`[${status ?? "?"}] ${detail}`);
        this.deactivateLoading.set(false);
      },
    });
  }

  resendOtp(token: string) {
    this.resendingOtp.set(true);
    this.api.resendInviteOtp(token).subscribe({
      next: () => this.resendingOtp.set(false),
      error: () => this.resendingOtp.set(false),
    });
  }

  isInviteInList(token: string): boolean {
    return this.activeInvites().some((inv) => inv.token === token);
  }

  formatCountdown(ms: number): string {
    if (ms <= 0) return "Expired";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  countdownCircle(ms: number): string {
    const circumference = 2 * Math.PI * 8;
    const progress = Math.max(0, ms / (5 * 60 * 1000));
    return `${circumference * progress} ${circumference}`;
  }

  allKnownSites(): string[] {
    return [...new Set(this.data.projects().flatMap((project) => project.sites).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  addProfileSite(event?: Event) {
    event?.preventDefault();
    const site = this.siteDraft().trim();
    if (!site) return;
    this.profileSites.update((sites) =>
      sites.some((v) => v.toLowerCase() === site.toLowerCase()) ? sites : [...sites, site].sort((a, b) => a.localeCompare(b))
    );
    this.siteDraft.set("");
  }

  removeProfileSite(site: string) {
    this.profileSites.update((sites) => sites.filter((v) => v !== site));
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