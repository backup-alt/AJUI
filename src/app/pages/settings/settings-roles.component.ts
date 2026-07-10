import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../../core/api.service";

type Role = "Admin" | "Project Manager" | "Accountant";
type Status = "active" | "inactive" | "on_leave";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: Status;
  lastLoginAt: string;
  createdAt: string;
  projectIds: string[];
}

interface PendingInvite {
  token: string;
  inviteId: string;
  supervisorName: string;
  supervisorEmail: string;
  supervisorPhone?: string;
  expiresAt: string;
  remainingMs: number;
  qrDataUrl?: string;
  scanned: boolean;
  otp?: string;
  emailSent?: boolean;
}

@Component({
  selector: "agb-settings-roles",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Roles and Employees</strong>
      </nav>
      <h1>Roles and Employees</h1>
      <p>Manage who can access the admin console and what they can approve.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-toolbar">
        <div class="settings-w11-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            [class.active]="activeTab() === 'all'"
            (click)="activeTab.set('all')"
          >
            All <span class="settings-w11-tab-count">{{ employees().length }}</span>
          </button>
          <button
            type="button"
            role="tab"
            [class.active]="activeTab() === 'admin'"
            (click)="activeTab.set('admin')"
          >
            Admins <span class="settings-w11-tab-count">{{ countByRole('Admin') }}</span>
          </button>
          <button
            type="button"
            role="tab"
            [class.active]="activeTab() === 'pm'"
            (click)="activeTab.set('pm')"
          >
            Project Managers <span class="settings-w11-tab-count">{{ countByRole('Project Manager') }}</span>
          </button>
          <button
            type="button"
            role="tab"
            [class.active]="activeTab() === 'accountant'"
            (click)="activeTab.set('accountant')"
          >
            Accountants <span class="settings-w11-tab-count">{{ countByRole('Accountant') }}</span>
          </button>
        </div>
        <div class="settings-w11-toolbar-right">
          <button
            type="button"
            class="settings-w11-btn settings-w11-btn-ghost"
            (click)="openAddSupervisor()"
            title="Generate a QR code for a new supervisor"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="2" width="5" height="5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="9" width="5" height="5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="10.5" y="10.5" width="3" height="3" rx="0.3" fill="currentColor"/></svg>
            Add Supervisor
          </button>
          <input
            type="text"
            class="settings-w11-search-input"
            placeholder="Search by name or email"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
          />
          <button type="button" class="settings-w11-btn settings-w11-btn-invite" (click)="openInvite()">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10 M3 8h10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
            Invite Employee
          </button>
        </div>
      </div>

      <div class="settings-w11-table-wrap">
        <table class="settings-w11-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (e of filteredEmployees(); track e.id) {
              <tr (click)="viewEmployee(e)" class="settings-w11-row-clickable">
                <td>
                  <div class="settings-w11-name-cell">
                    <span class="settings-w11-avatar">{{ initials(e.name) }}</span>
                    <strong>{{ e.name }}</strong>
                  </div>
                </td>
                <td>{{ e.email }}</td>
                <td>{{ e.phone }}</td>
                <td><span class="settings-w11-role-pill" [attr.data-role]="e.role">{{ e.role }}</span></td>
                <td><span class="settings-w11-status-pill" [attr.data-status]="e.status">{{ e.status }}</span></td>
                <td>{{ formatDate(e.lastLoginAt) }}</td>
                <td class="settings-w11-actions-cell">
                  <button type="button" class="settings-w11-icon-btn" (click)="select(e); $event.stopPropagation()" aria-label="Open details">
                    <svg viewBox="0 0 16 16"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="settings-w11-empty-row">No employees match your search.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <!-- Pending Invites table -->
    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Pending Supervisor Invites</h2>
          <p>Active QR codes waiting for the supervisor to scan and complete setup.</p>
        </div>
        <button
          type="button"
          class="settings-w11-btn settings-w11-btn-ghost small"
          (click)="refreshInvites()"
          [disabled]="invitesLoading()"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.5L13 3 M13 3v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {{ invitesLoading() ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
      <div class="settings-w11-table-wrap">
        <table class="settings-w11-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Created</th>
              <th>Time Left</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (inv of pendingInvites(); track inv.token) {
              <tr [class.scanned]="inv.scanned">
                <td>
                  <div class="settings-w11-name-cell">
                    <span class="settings-w11-avatar">{{ initials(inv.supervisorName) }}</span>
                    <strong>{{ inv.supervisorName }}</strong>
                  </div>
                </td>
                <td>{{ inv.supervisorEmail }}</td>
                <td>{{ inv.supervisorPhone || '—' }}</td>
                <td>{{ formatInviteDate(inv.expiresAt) }}</td>
                <td>
                  @if (inv.scanned) {
                    <span class="settings-w11-timer-text">—</span>
                  } @else if (inv.remainingMs <= 0) {
                    <span class="settings-w11-timer-text expired">Expired</span>
                  } @else {
                    <span class="settings-w11-timer-text" [class.warning]="inv.remainingMs < 60000">
                      <svg viewBox="0 0 16 16" aria-hidden="true" class="settings-w11-timer-icon"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3l2 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                      {{ formatCountdown(inv.remainingMs) }}
                    </span>
                  }
                </td>
                <td>
                  @if (inv.scanned) {
                    <span class="settings-w11-status-pill" data-status="active">Scanned</span>
                  } @else if (inv.remainingMs <= 0) {
                    <span class="settings-w11-status-pill" data-status="inactive">Expired</span>
                  } @else {
                    <span class="settings-w11-status-pill" data-status="pending">Waiting</span>
                  }
                </td>
                <td class="settings-w11-actions-cell">
                  <button
                    type="button"
                    class="settings-w11-btn settings-w11-btn-ghost small"
                    (click)="resendOtp(inv)"
                    [disabled]="inv.scanned || inv.remainingMs <= 0 || resendingOtp()"
                  >
                    Resend
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="settings-w11-empty-row">No pending supervisor invites. Click "Add Supervisor" to create one.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <!-- Drawer -->
    @if (selected()) {
      <div class="settings-w11-drawer-backdrop" (click)="close()" aria-hidden="true"></div>
      <aside class="settings-w11-drawer" role="dialog" aria-label="Employee details">
        <header class="settings-w11-drawer-head">
          <div class="settings-w11-drawer-id">
            <span class="settings-w11-avatar large">{{ initials(selected()!.name) }}</span>
            <div>
              <h2>{{ selected()!.name }}</h2>
              <div class="settings-w11-drawer-meta">
                <span class="settings-w11-role-pill" [attr.data-role]="selected()!.role">{{ selected()!.role }}</span>
                <span class="settings-w11-status-pill" [attr.data-status]="selected()!.status">{{ selected()!.status }}</span>
              </div>
            </div>
          </div>
          <button type="button" class="settings-w11-icon-btn" (click)="close()" aria-label="Close">
            <svg viewBox="0 0 16 16"><path d="m4 4 8 8 M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </header>

        <nav class="settings-w11-drawer-tabs" role="tablist">
          <button type="button" role="tab" [class.active]="drawerTab() === 'profile'" (click)="drawerTab.set('profile')">Profile</button>
          <button type="button" role="tab" [class.active]="drawerTab() === 'permissions'" (click)="drawerTab.set('permissions')">Permissions</button>
          <button type="button" role="tab" [class.active]="drawerTab() === 'projects'" (click)="drawerTab.set('projects')">Projects</button>
          <button type="button" role="tab" [class.active]="drawerTab() === 'activity'" (click)="drawerTab.set('activity')">Activity</button>
        </nav>

        <div class="settings-w11-drawer-body">
          @if (drawerTab() === 'profile') {
            <dl class="settings-w11-dl">
              <div><dt>Email</dt><dd>{{ selected()!.email }}</dd></div>
              <div><dt>Phone</dt><dd>{{ selected()!.phone }}</dd></div>
              <div><dt>Role</dt><dd>{{ selected()!.role }}</dd></div>
              <div><dt>Status</dt><dd>{{ selected()!.status }}</dd></div>
              <div><dt>Joined</dt><dd>{{ formatDate(selected()!.createdAt) }}</dd></div>
              <div><dt>Last Login</dt><dd>{{ formatDate(selected()!.lastLoginAt) }}</dd></div>
            </dl>
          }

          @if (drawerTab() === 'permissions') {
            <h3 class="settings-w11-drawer-h3">Approval rights</h3>
            <p class="settings-w11-drawer-hint">Toggle which approval types this employee can approve or reject.</p>
            <div class="settings-w11-perm-list">
              @for (p of approvalTypes; track p.key) {
                <div class="settings-w11-perm-row">
                  <div class="settings-w11-perm-label">
                    <strong>{{ p.label }}</strong>
                    <small>{{ p.note }}</small>
                  </div>
                  <div class="settings-w11-perm-toggles">
                    <label class="settings-w11-mini-toggle">
                      <input type="checkbox" [checked]="permFor(selected()!.id, p.key, 'approve')" (change)="togglePerm(selected()!.id, p.key, 'approve', $any($event.target).checked)" />
                      <span>Approve</span>
                    </label>
                    <label class="settings-w11-mini-toggle">
                      <input type="checkbox" [checked]="permFor(selected()!.id, p.key, 'reject')" (change)="togglePerm(selected()!.id, p.key, 'reject', $any($event.target).checked)" />
                      <span>Reject</span>
                    </label>
                  </div>
                </div>
              }
            </div>
          }

          @if (drawerTab() === 'projects') {
            <h3 class="settings-w11-drawer-h3">Assigned Projects</h3>
            @if (selected()!.projectIds.length > 0) {
              <ul class="settings-w11-proj-list">
                @for (pid of selected()!.projectIds; track pid) {
                  <li><span class="settings-w11-proj-chip">{{ pid }}</span></li>
                }
              </ul>
            } @else {
              <p class="settings-w11-drawer-hint">No projects assigned yet.</p>
            }
          }

          @if (drawerTab() === 'activity') {
            <h3 class="settings-w11-drawer-h3">Recent Activity</h3>
            <ul class="settings-w11-activity-list">
              <li><span class="dot approve"></span>Approved material request MR-1042 <small>2h ago</small></li>
              <li><span class="dot reject"></span>Rejected expense EXP-883 <small>5h ago</small></li>
              <li><span class="dot login"></span>Signed in <small>yesterday at 9:14 AM</small></li>
              <li><span class="dot approve"></span>Approved payment PMT-220 <small>2 days ago</small></li>
            </ul>
          }
        </div>

        <footer class="settings-w11-drawer-foot">
          <button type="button" class="settings-w11-btn settings-w11-btn-danger-outline" (click)="deactivate()">Deactivate</button>
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="close()">Save changes</button>
        </footer>
      </aside>
    }

    <!-- Invite Employee modal (admin/PM/accountant) -->
    @if (showInvite()) {
      <div class="settings-w11-modal-backdrop" (click)="closeInvite()" aria-hidden="true"></div>
      <div class="settings-w11-modal" role="dialog" aria-label="Invite employee">
        <header class="settings-w11-modal-head">
          <h2>Invite Employee</h2>
          <button type="button" class="settings-w11-icon-btn" (click)="closeInvite()" aria-label="Close">
            <svg viewBox="0 0 16 16"><path d="m4 4 8 8 M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </header>
        <div class="settings-w11-modal-body">
          <div class="settings-w11-field">
            <label>Name</label>
            <input type="text" placeholder="Full name" [value]="inviteName()" (input)="inviteName.set($any($event.target).value)" />
          </div>
          <div class="settings-w11-field">
            <label>Email</label>
            <input type="email" placeholder="email@agbuilders.com" [value]="inviteEmail()" (input)="inviteEmail.set($any($event.target).value)" />
          </div>
          <div class="settings-w11-field">
            <label>Phone</label>
            <input type="tel" placeholder="+91 98765 43210" [value]="invitePhone()" (input)="invitePhone.set($any($event.target).value)" />
          </div>
          <div class="settings-w11-field">
            <label>Role</label>
            <select [value]="inviteRole()" (change)="inviteRole.set($any($event.target).value)">
              <option value="Admin">Admin</option>
              <option value="Project Manager">Project Manager</option>
              <option value="Accountant">Accountant</option>
            </select>
          </div>
          @if (inviteError()) {
            <div class="settings-w11-message error">{{ inviteError() }}</div>
          }
        </div>
        <footer class="settings-w11-modal-foot">
          <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="closeInvite()">Cancel</button>
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="sendInvite()" [disabled]="inviteSending()">
            {{ inviteSending() ? 'Sending…' : 'Send invite' }}
          </button>
        </footer>
      </div>
    }

    <!-- Add Supervisor modal (QR generation) -->
    @if (showAddSupervisor()) {
      <div class="settings-w11-modal-backdrop" (click)="closeAddSupervisor()" aria-hidden="true"></div>
      <div class="settings-w11-modal settings-w11-modal-wide" role="dialog" aria-label="Add supervisor">
        <header class="settings-w11-modal-head">
          <div>
            <h2>Add Supervisor</h2>
            <small>Generate a time-limited QR code the supervisor scans from the AGB mobile app.</small>
          </div>
          <button type="button" class="settings-w11-icon-btn" (click)="closeAddSupervisor()" aria-label="Close">
            <svg viewBox="0 0 16 16"><path d="m4 4 8 8 M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </header>

        <div class="settings-w11-modal-body">
          @if (!currentInvite()) {
            <div class="settings-w11-form">
              <div class="settings-w11-field">
                <label>Supervisor name</label>
                <input
                  type="text"
                  [value]="supervisorNameDraft()"
                  (input)="supervisorNameDraft.set($any($event.target).value)"
                  placeholder="e.g. Rajesh Kumar"
                  maxlength="80"
                />
              </div>
              <div class="settings-w11-field">
                <label>Email</label>
                <input
                  type="email"
                  [value]="supervisorEmailDraft()"
                  (input)="supervisorEmailDraft.set($any($event.target).value)"
                  placeholder="e.g. rajesh@agbuilders.com"
                />
              </div>
              <div class="settings-w11-field">
                <label>Phone</label>
                <input
                  type="tel"
                  [value]="supervisorPhoneDraft()"
                  (input)="supervisorPhoneDraft.set($any($event.target).value)"
                  placeholder="e.g. +91 98765 43210"
                />
              </div>
              @if (supervisorError()) {
                <div class="settings-w11-message error">{{ supervisorError() }}</div>
              }
              <button
                type="button"
                class="settings-w11-btn settings-w11-btn-primary"
                [disabled]="supervisorLoading()"
                (click)="generateSupervisorQr()"
              >
                {{ supervisorLoading() ? 'Generating…' : 'Generate QR Code' }}
              </button>
            </div>
          }

          @if (currentInvite(); as invite) {
            <div class="settings-w11-qr-popup" [class.scanned]="invite.scanned">
              <header class="settings-w11-qr-popup-head">
                <div>
                  <strong>{{ invite.supervisorName }}</strong>
                  <small>{{ invite.supervisorEmail }}</small>
                </div>
                <div class="settings-w11-qr-timer" [class.expired]="invite.remainingMs <= 0">
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" fill="none"
                      [style.stroke-dasharray]="countdownCircle(invite.remainingMs)"
                      stroke-dashoffset="0"
                      transform="rotate(-90 10 10)"
                    />
                    <text x="10" y="14" text-anchor="middle" font-size="7" fill="currentColor">{{ formatCountdown(invite.remainingMs) }}</text>
                  </svg>
                  <span *ngIf="invite.remainingMs > 0">{{ formatCountdown(invite.remainingMs) }}</span>
                  <span *ngIf="invite.remainingMs <= 0" class="settings-w11-expired-label">Expired</span>
                </div>
              </header>

              <div class="settings-w11-qr-frame">
                <img [src]="invite.qrDataUrl" alt="Supervisor QR Code" />
              </div>

              <p class="settings-w11-hint" *ngIf="!invite.scanned">
                Ask the supervisor to open the <strong>AGB</strong> app, tap <strong>Scan QR</strong> on the welcome screen, and enter the OTP sent to their email.
              </p>

              <div class="settings-w11-otp-block" *ngIf="!invite.scanned && invite.otp && invite.emailSent === false">
                <span class="settings-w11-otp-label">Email delivery failed — share this code verbally</span>
                <strong class="settings-w11-otp-code">{{ invite.otp }}</strong>
              </div>

              <div class="settings-w11-scan-success" *ngIf="invite.scanned">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="10" cy="10" r="8" fill="#d4edda" stroke="#28a745" stroke-width="1.5"/>
                  <path d="m6 10.5 2.5 2.5 5-5" stroke="#28a745" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
                <span>Supervisor scanned! They can now set up their password.</span>
              </div>

              <div class="settings-w11-qr-actions">
                <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="sendSupervisorEmail(invite)" [disabled]="sendingEmail() || invite.remainingMs <= 0">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12v8H2z M2 4l6 4 6-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  {{ sendingEmail() ? 'Sending…' : 'Send via email' }}
                </button>
                <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="resendCurrentOtp()" [disabled]="resendingOtp()">
                  {{ resendingOtp() ? 'Sending…' : 'Resend OTP' }}
                </button>
                <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="generateAnother()">
                  Generate another
                </button>
              </div>
            </div>
          }
        </div>

        <footer class="settings-w11-modal-foot">
          <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="closeAddSupervisor()">Close</button>
        </footer>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsRolesComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeTab = signal<"all" | "admin" | "pm" | "accountant">("all");
  readonly search = signal("");
  readonly selected = signal<Employee | null>(null);
  readonly drawerTab = signal<"profile" | "permissions" | "projects" | "activity">("profile");

  // Invite Employee modal
  readonly showInvite = signal(false);
  readonly inviteName = signal("");
  readonly inviteEmail = signal("");
  readonly invitePhone = signal("");
  readonly inviteRole = signal<Role>("Project Manager");

  // Add Supervisor modal
  readonly showAddSupervisor = signal(false);
  readonly supervisorNameDraft = signal("");
  readonly supervisorEmailDraft = signal("");
  readonly supervisorPhoneDraft = signal("");
  readonly supervisorLoading = signal(false);
  readonly supervisorError = signal<string | null>(null);
  readonly currentInvite = signal<PendingInvite | null>(null);
  readonly resendingOtp = signal(false);
  readonly sendingEmail = signal(false);

  // Pending invites table
  readonly pendingInvites = signal<PendingInvite[]>([]);
  readonly invitesLoading = signal(false);

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  readonly approvalTypes = [
    { key: "material", label: "Material Requests", note: "Cement, steel, sand, etc." },
    { key: "labour", label: "Labour Attendance", note: "Daily attendance submissions" },
    { key: "expense", label: "Site Expenses", note: "Diesel, equipment, transport" },
    { key: "payment", label: "Client Payments", note: "Collections from clients" },
    { key: "subcontract", label: "Subcontracts", note: "Subcontractor agreements" },
  ];

  readonly permissions = signal<Record<string, Record<string, { approve: boolean; reject: boolean }>>>({});

  readonly employees = signal<Employee[]>([]);
  readonly employeesLoading = signal(false);
  readonly inviteSending = signal(false);
  readonly inviteError = signal<string | null>(null);

  readonly filteredEmployees = computed<Employee[]>(() => {
    const tab = this.activeTab();
    const q = this.search().trim().toLowerCase();
    return this.employees().filter((e) => {
      if (tab === "admin" && e.role !== "Admin") return false;
      if (tab === "pm" && e.role !== "Project Manager") return false;
      if (tab === "accountant" && e.role !== "Accountant") return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    });
  });

  ngOnInit() {
    this.refreshInvites();
    this.refreshEmployees();
    this.pollInterval = setInterval(() => this.tickInvites(), 1000);
    if (this.route.snapshot.queryParamMap.get("addSupervisor") === "true") {
      this.openAddSupervisor();
      this.router.navigate([], { queryParams: { addSupervisor: null }, queryParamsHandling: "merge", replaceUrl: true });
    }
  }

  refreshEmployees() {
    this.employeesLoading.set(true);
    this.api.listEmployees({ limit: 100 }).subscribe({
      next: (res) => {
        const items = (res?.items || []).map((row: any) => ({
          id: row.id || row._id,
          name: row.name || "—",
          email: row.email || "",
          phone: row.phone || "",
          role: (row.role || "Project Manager") as Role,
          status: (row.status || "active") as Status,
          lastLoginAt: row.lastLoginAt || "",
          createdAt: row.createdAt || "",
          projectIds: row.projectIds || [],
        }));
        this.employees.set(items);
        this.employeesLoading.set(false);
      },
      error: () => {
        // Fallback: show empty list
        this.employees.set([]);
        this.employeesLoading.set(false);
      },
    });
  }

  ngOnDestroy() {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }

  refreshInvites() {
    this.invitesLoading.set(true);
    this.api.listActiveInvites().subscribe({
      next: (res) => {
        const fresh = res.invites.map((inv) => ({
          token: inv.token,
          inviteId: inv.inviteId,
          supervisorName: inv.supervisorName,
          supervisorEmail: inv.supervisorEmail,
          expiresAt: inv.expiresAt,
          remainingMs: Math.max(0, inv.remainingMs),
          scanned: false,
        }));
        this.pendingInvites.set(fresh);
        this.invitesLoading.set(false);
      },
      error: () => this.invitesLoading.set(false),
    });
  }

  viewEmployee(e: Employee) {
    this.router.navigateByUrl(`/settings/roles/employee/${e.id}`);
  }

  private tickInvites() {
    this.pendingInvites.update((list) =>
      list.map((inv) => {
        if (inv.scanned) return inv;
        const newRemaining = Math.max(0, inv.remainingMs - 1000);
        return { ...inv, remainingMs: newRemaining };
      })
    );

    // Tick current invite if modal is open
    const current = this.currentInvite();
    if (current && !current.scanned) {
      const newRemaining = Math.max(0, current.remainingMs - 1000);
      this.currentInvite.set({ ...current, remainingMs: newRemaining });
    }
  }

  countByRole(role: Role): number {
    return this.employees().filter((e) => e.role === role).length;
  }

  initials(name: string): string {
    return (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }

  formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  formatInviteDate(iso: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  formatCountdown(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  countdownCircle(ms: number): string {
    const total = 5 * 60 * 1000;
    const remaining = Math.max(0, Math.min(total, ms));
    const ratio = remaining / total;
    const circumference = 2 * Math.PI * 8;
    return `${(circumference * ratio).toFixed(2)} ${circumference.toFixed(2)}`;
  }

  select(e: Employee) {
    this.selected.set(e);
    this.drawerTab.set("profile");
  }
  close() {
    this.selected.set(null);
  }
  deactivate() {
    const e = this.selected();
    if (!e) return;
    this.employees.update((list) => list.map((x) => (x.id === e.id ? { ...x, status: "inactive" as Status } : x)));
    this.close();
  }

  permFor(employeeId: string, type: string, action: "approve" | "reject"): boolean {
    const all = this.permissions();
    return !!all[employeeId]?.[type]?.[action];
  }
  togglePerm(employeeId: string, type: string, action: "approve" | "reject", value: boolean) {
    this.permissions.update((p) => {
      const next = { ...p };
      next[employeeId] = { ...(next[employeeId] || {}) };
      next[employeeId][type] = { ...(next[employeeId][type] || { approve: false, reject: false }), [action]: value };
      return next;
    });
  }

  // Invite Employee modal
  openInvite() {
    this.showInvite.set(true);
    this.inviteName.set("");
    this.inviteEmail.set("");
    this.invitePhone.set("");
    this.inviteRole.set("Project Manager");
  }
  closeInvite() {
    this.showInvite.set(false);
  }
  sendInvite() {
    const name = this.inviteName().trim();
    const email = this.inviteEmail().trim();
    const phone = this.invitePhone().trim();
    const role = this.inviteRole();

    this.inviteError.set(null);

    if (name.length < 2) {
      this.inviteError.set("Please enter a name.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.inviteError.set("Please enter a valid email address.");
      return;
    }

    this.inviteSending.set(true);
    this.api.createEmployeeInvite({ name, email, phone: phone || undefined, role }).subscribe({
      next: (res) => {
        this.inviteSending.set(false);
        if (res?.emailSent) {
          alert(`Invite sent to ${email}. They will receive a link to set up their account.`);
        } else {
          alert(`Invite created for ${email}. Share the link with them manually: ${res?.inviteUrl || ""}`);
        }
        this.closeInvite();
        this.refreshEmployees();
      },
      error: (err) => {
        this.inviteSending.set(false);
        this.inviteError.set(err?.message || "Failed to send invite. Please try again.");
      },
    });
  }

  // Add Supervisor modal
  openAddSupervisor() {
    this.showAddSupervisor.set(true);
    this.currentInvite.set(null);
    this.supervisorError.set(null);
    this.supervisorNameDraft.set("");
    this.supervisorEmailDraft.set("");
    this.supervisorPhoneDraft.set("");
  }

  closeAddSupervisor() {
    this.showAddSupervisor.set(false);
    this.currentInvite.set(null);
    this.supervisorError.set(null);
    this.refreshInvites();
  }

  generateAnother() {
    this.currentInvite.set(null);
    this.supervisorError.set(null);
    this.supervisorNameDraft.set("");
    this.supervisorEmailDraft.set("");
    this.supervisorPhoneDraft.set("");
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
          supervisorPhone: phone,
          expiresAt: invite.expiresAt,
          remainingMs: fiveMinMs,
          scanned: false,
          otp: invite.otp,
          emailSent: invite.emailSent,
        });
        this.supervisorLoading.set(false);
        this.refreshInvites();
      },
      error: (err) => {
        const status = err?.status ?? err?.statusCode;
        const detail = err?.error?.error || err?.message || "Failed to generate QR.";
        this.supervisorError.set(`[${status ?? "?"}] ${detail}`);
        this.supervisorLoading.set(false);
      },
    });
  }

  resendCurrentOtp() {
    const inv = this.currentInvite();
    if (!inv) return;
    this.resendingOtp.set(true);
    this.api.resendInviteOtp(inv.token).subscribe({
      next: () => {
        this.resendingOtp.set(false);
        alert("OTP resent.");
      },
      error: () => {
        this.resendingOtp.set(false);
        alert("Failed to resend OTP.");
      },
    });
  }

  sendSupervisorEmail(inv: PendingInvite) {
    this.sendingEmail.set(true);
    this.api.sendSupervisorEmail(inv.token).subscribe({
      next: (res) => {
        this.sendingEmail.set(false);
        if (res?.emailSent) {
          alert(`Invite link sent to ${inv.supervisorEmail}.`);
        } else {
          alert("Could not send the email. Please try again or share the QR code directly.");
        }
      },
      error: () => {
        this.sendingEmail.set(false);
        alert("Failed to send email. Please try again.");
      },
    });
  }

  resendOtp(inv: PendingInvite) {
    if (inv.remainingMs <= 0 || inv.scanned) return;
    this.resendingOtp.set(true);
    this.api.resendInviteOtp(inv.token).subscribe({
      next: () => {
        this.resendingOtp.set(false);
        // refresh remaining time
        this.api.listActiveInvites().subscribe({
          next: (res) => {
            const found = res.invites.find((x) => x.token === inv.token);
            if (found) {
              this.pendingInvites.update((list) =>
                list.map((p) => (p.token === inv.token ? { ...p, remainingMs: Math.max(0, found.remainingMs) } : p))
              );
            }
          },
        });
      },
      error: () => {
        this.resendingOtp.set(false);
      },
    });
  }
}
