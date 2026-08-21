import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../../core/api.service";
import { ErpDataService } from "../../data/erp-data.service";

type Role = "Admin" | "Project Manager" | "Accountant" | "Supervisor";
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

interface EmployeeInvite {
  token: string;
  inviteId: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  expiresAt: string;
  remainingMs: number;
  emailSent?: boolean;
}

type CombinedInvite = {
  type: "supervisor" | "employee";
  token: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  expiresAt: string;
  remainingMs: number;
  scanned?: boolean;
};

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

    <!-- Pending Invites table (Combined) -->
    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Pending Invites</h2>
          <p>All active invites waiting for recipients to complete setup. Supervisors scan QR codes, employees use email links.</p>
        </div>
        <button
          type="button"
          class="settings-w11-btn settings-w11-btn-ghost small"
          (click)="refreshInvites()"
          [disabled]="invitesLoading() || employeeInvitesLoading()"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.5L13 3 M13 3v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {{ invitesLoading() || employeeInvitesLoading() ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
      <div class="settings-w11-table-wrap">
        <table class="settings-w11-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Time Left</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (inv of allPendingInvites(); track inv.token + inv.type) {
              <tr [class.scanned]="inv.scanned">
                <td>
                  @if (inv.type === 'supervisor') {
                    <span class="settings-w11-role-pill" data-role="Supervisor">Supervisor</span>
                  } @else {
                    <span class="settings-w11-role-pill" [attr.data-role]="inv.role">{{ inv.role }}</span>
                  }
                </td>
                <td>
                  <div class="settings-w11-name-cell">
                    <span class="settings-w11-avatar">{{ initials(inv.name) }}</span>
                    <strong>{{ inv.name }}</strong>
                  </div>
                </td>
                <td>{{ inv.email }}</td>
                <td>{{ inv.phone || '—' }}</td>
                <td>{{ inv.role || '—' }}</td>
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
                  @if (inv.type === 'supervisor' && inv.scanned) {
                    <span class="settings-w11-status-pill" data-status="active">Scanned</span>
                  } @else if (inv.remainingMs <= 0) {
                    <span class="settings-w11-status-pill" data-status="inactive">Expired</span>
                  } @else {
                    <span class="settings-w11-status-pill" data-status="pending">{{ inv.type === 'supervisor' ? 'Waiting' : 'Pending' }}</span>
                  }
                </td>
                <td>
                  @if (inv.type === 'supervisor') {
                    <button
                      type="button"
                      class="settings-w11-btn settings-w11-btn-ghost small"
                      (click)="resendOtpByToken(inv.token)"
                      [disabled]="inv.scanned || inv.remainingMs <= 0 || resendingOtp()"
                    >
                      Resend
                    </button>
                  } @else {
                    <button
                      type="button"
                      class="settings-w11-btn settings-w11-btn-ghost small"
                      (click)="resendEmployeeInviteByToken(inv.token)"
                      [disabled]="inv.remainingMs <= 0 || employeeEmailSendingToken() === inv.token"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12v8H2z M2 4l6 4 6-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      {{ employeeEmailSendingToken() === inv.token ? 'Sending...' : 'Resend' }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="settings-w11-empty-row">No pending invites. Use "Add Supervisor" or "Invite Employee" to create one.</td>
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

          @if (drawerTab() === 'projects') {
            @if (canEditProjects()) {
              <p class="settings-w11-drawer-hint">
                Pick which projects this employee can access. Changes save immediately.
              </p>
              <div class="settings-w11-proj-picker">
                @for (p of allProjects(); track p.id) {
                  <label class="settings-w11-proj-row">
                    <input
                      type="checkbox"
                      [checked]="isDrawerProjectSelected(p.id)"
                      (change)="toggleDrawerProject(p.id)"
                    />
                    <span class="settings-w11-proj-name">{{ p.name }}</span>
                    <small class="settings-w11-proj-meta">{{ p.status }}</small>
                  </label>
                }
                @if (allProjects().length === 0) {
                  <p class="settings-w11-drawer-hint">No projects available yet.</p>
                }
              </div>
              <div class="settings-w11-drawer-actions">
                <button
                  type="button"
                  class="settings-w11-btn settings-w11-btn-primary"
                  [disabled]="savingProjects()"
                  (click)="saveDrawerProjects()"
                >
                  {{ savingProjects() ? "Saving…" : "Save project assignments" }}
                </button>
                @if (saveError()) {
                  <small class="settings-w11-error">{{ saveError() }}</small>
                }
                @if (saveOk()) {
                  <small class="settings-w11-ok">Saved.</small>
                }
              </div>
            } @else {
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

    <!-- Invite Employee modal (admin/PM/accountant) — single step -->
    @if (showInvite()) {
      <div class="settings-w11-modal-backdrop" (click)="closeInvite()" aria-hidden="true"></div>
      <div class="settings-w11-modal" role="dialog" aria-label="Invite employee">
        <header class="settings-w11-modal-head">
          <div>
            <h2>Invite Employee</h2>
            <small class="settings-w11-modal-subtitle">Send an invite email with a setup link</small>
          </div>
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
            <label>Phone <small class="settings-w11-hint-inline">(optional)</small></label>
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

    <!-- Add Supervisor modal (QR generation or Email invite) -->
    @if (showAddSupervisor()) {
      <div class="settings-w11-modal-backdrop" (click)="closeAddSupervisor()" aria-hidden="true"></div>
      <div class="settings-w11-modal settings-w11-modal-wide" role="dialog" aria-label="Add supervisor">
        <header class="settings-w11-modal-head">
          <div>
            <h2>Add Supervisor</h2>
          <small>{{ supervisorStep() === 1 ? 'Enter supervisor details and choose how to send the invite' : (supervisorStep() === 2 ? 'Select projects for this supervisor' : 'QR Code generated') }}</small>
          </div>
          <button type="button" class="settings-w11-icon-btn" (click)="closeAddSupervisor()" aria-label="Close">
            <svg viewBox="0 0 16 16"><path d="m4 4 8 8 M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </header>

        <div class="settings-w11-modal-body">
          @if (supervisorStep() < 4) {
            <div class="settings-w11-step-indicator">
              <div class="settings-w11-step" [class.active]="supervisorStep() === 1" [class.done]="supervisorStep() > 1">
                <span class="step-circle">{{ supervisorStep() > 1 ? '✓' : '1' }}</span>
                <span class="step-label">Details</span>
              </div>
              <div class="step-line" [class.done]="supervisorStep() > 1"></div>
              <div class="settings-w11-step" [class.active]="supervisorStep() === 2" [class.done]="supervisorStep() > 2">
                <span class="step-circle">{{ supervisorStep() > 2 ? '✓' : '2' }}</span>
              <span class="step-label">Projects</span>
              </div>
              <div class="step-line" [class.done]="supervisorStep() > 2"></div>
              <div class="settings-w11-step" [class.active]="supervisorStep() === 3" [class.done]="supervisorStep() > 3">
                <span class="step-circle">{{ supervisorStep() > 3 ? '✓' : '3' }}</span>
                <span class="step-label">Invite Method</span>
              </div>
              <div class="step-line" [class.done]="supervisorStep() > 3"></div>
              <div class="settings-w11-step" [class.active]="supervisorStep() === 4">
                <span class="step-circle">4</span>
                <span class="step-label">Done</span>
              </div>
            </div>
          }

          @if (supervisorStep() === 1) {
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
                (click)="nextStep()"
              >
                Next: Select Projects
              </button>
            </div>
          }

          @if (supervisorStep() === 2) {
            <div class="settings-w11-form">
              <p class="settings-w11-step-hint">Select the projects this supervisor will manage:</p>
              @if (sitesLoading()) {
                <div class="settings-w11-loading">Loading projects...</div>
              }
              @if (!sitesLoading() && availableSites().length === 0) {
                <div class="settings-w11-message info">No projects available.</div>
              }
              <div class="settings-w11-site-list">
                  @for (project of availableSites(); track project.id) {
                    <label class="settings-w11-site-item" [class.selected]="selectedSiteIds().has(project.id)">
                    <input
                      type="checkbox"
                        [checked]="selectedSiteIds().has(project.id)"
                        (change)="toggleSite(project.id)"
                    />
                    <div class="site-item-info">
                        <strong>{{ project.name }}</strong>
                        <small>{{ project.client || 'Project' }}</small>
                    </div>
                  </label>
                }
              </div>
              @if (supervisorError()) {
                <div class="settings-w11-message error">{{ supervisorError() }}</div>
              }
              <button
                type="button"
                class="settings-w11-btn settings-w11-btn-primary"
                [disabled]="supervisorLoading() || selectedSiteIds().size === 0"
                (click)="goToInviteMethod()"
              >
                {{ supervisorLoading() ? 'Loading…' : 'Next: Choose Invite Method' }}
              </button>
            </div>
          }

          @if (supervisorStep() === 3) {
            <div class="settings-w11-form">
              <div class="settings-w11-qr-generation-card">
                <div class="settings-w11-qr-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                    <line x1="5" y1="5" x2="5.01" y2="5"/>
                    <line x1="19" y1="5" x2="19.01" y2="5"/>
                    <line x1="19" y1="19" x2="19.01" y2="19"/>
                    <line x1="5" y1="19" x2="5.01" y2="19"/>
                  </svg>
                </div>
                <h3 class="settings-w11-qr-title">QR Code Invitation</h3>
                <p class="settings-w11-qr-description">
                  A time-limited QR code will be generated. The supervisor scans it from the
                  <strong>AGB Supervisor</strong> app welcome screen, then enters the verification
                  code sent to their email to activate their account.
                </p>
                <div class="settings-w11-qr-expiry">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>This invite expires in <strong>5 minutes</strong> after generation</span>
                </div>
              </div>
              @if (supervisorError()) {
                <div class="settings-w11-message error">{{ supervisorError() }}</div>
              }
              <div class="settings-w11-form-actions">
                <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="prevStep()">Back</button>
                <button
                  type="button"
                  class="settings-w11-btn settings-w11-btn-primary"
                  [disabled]="supervisorLoading()"
                  (click)="createInviteWithMethod()"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:6px;vertical-align:-3px;">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  {{ supervisorLoading() ? 'Generating…' : 'Generate QR Code' }}
                </button>
              </div>
            </div>
          }

          @if (supervisorStep() === 4 && currentInvite(); as invite) {
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

              @if (inviteMethod() === 'qr' || (inviteMethod() === 'email' && !invite.emailSent)) {
                <div class="settings-w11-qr-frame">
                  <img [src]="invite.qrDataUrl" alt="Supervisor QR Code" />
                </div>
              }

              @if (inviteMethod() === 'email') {
                <div class="settings-w11-email-sent" *ngIf="invite.emailSent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 13.07V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6"/>
                    <path d="M22 13.07L12 19.07 2 13.07"/>
                    <path d="M2 7l10 6.46 10-6.46"/>
                  </svg>
                  <strong>Invite email sent!</strong>
                  <span>A deep link has been sent to <strong>{{ invite.supervisorEmail }}</strong>. The supervisor can tap the link in their email to open the AGB app and complete their account setup.</span>
                </div>
                <div class="settings-w11-email-pending" *ngIf="!invite.emailSent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ffc107" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  <strong>Email queued</strong>
                  <span>The email is being sent. You can also share the QR code below as a backup.</span>
                </div>
              } @else {
                <p class="settings-w11-hint" *ngIf="!invite.scanned">
                  Ask the supervisor to open the <strong>AGB</strong> app, tap <strong>Scan QR</strong> on the welcome screen, and enter the OTP sent to their email.
                </p>
              }

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
                @if (inviteMethod() === 'email') {
                  <!-- Email invite: temporarily hidden (backend code preserved for future re-enable) -->
                  <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="sendSupervisorEmail(invite)" [disabled]="sendingEmail() || invite.remainingMs <= 0 || invite.emailSent" [style.display]="'none'">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12v8H2z M2 4l6 4 6-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    {{ sendingEmail() ? 'Sending…' : (invite.emailSent ? 'Email sent' : 'Resend email') }}
                  </button>
                } @else {
                  <!-- Email invite fallback: temporarily hidden (backend code preserved for future re-enable) -->
                  <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="sendSupervisorEmail(invite)" [disabled]="sendingEmail() || invite.remainingMs <= 0" [style.display]="'none'">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12v8H2z M2 4l6 4 6-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    {{ sendingEmail() ? 'Sending…' : 'Send via email' }}
                  </button>
                }
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
          @if (supervisorStep() === 2 || supervisorStep() === 3) {
            <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="prevStep()">Back</button>
          }
          <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="closeAddSupervisor()">Close</button>
        </footer>
      </div>
    }
  `,
  styles: [`
    .settings-w11-proj-picker {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 320px;
      overflow-y: auto;
      padding: 4px 0;
      border-top: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
      margin-top: 8px;
    }
    .settings-w11-proj-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 6px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .settings-w11-proj-row:hover {
      background: #f3f4f6;
    }
    .settings-w11-proj-row input[type="checkbox"] {
      accent-color: #002263;
      width: 16px;
      height: 16px;
    }
    .settings-w11-proj-name {
      flex: 1;
      color: #111827;
    }
    .settings-w11-proj-meta {
      color: #6b7280;
      font-size: 12px;
    }
    .settings-w11-drawer-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
    }
    .settings-w11-error {
      color: #b91c1c;
      font-size: 13px;
    }
    .settings-w11-ok {
      color: #047857;
      font-size: 13px;
    }
    .settings-w11-invite-method-choice {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .settings-w11-method-card {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) 24px;
      gap: 12px;
      align-items: center;
      width: 100%;
      min-height: 92px;
      padding: 14px;
      border: 1px solid #d8dee8;
      border-radius: 8px;
      background: #ffffff;
      color: #102033;
      text-align: left;
      cursor: pointer;
    }
    .settings-w11-method-card.selected {
      border-color: #002263;
      background: #f7f9ff;
    }
    .settings-w11-method-icon,
    .settings-w11-method-check {
      width: 36px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: #002263;
      background: #eef3ff;
      overflow: hidden;
    }
    .settings-w11-method-check {
      width: 22px;
      height: 22px;
      opacity: 0;
      background: #002263;
      color: #ffffff;
    }
    .settings-w11-method-check.visible { opacity: 1; }
    .settings-w11-method-icon svg,
    .settings-w11-method-check svg {
      width: 18px;
      height: 18px;
      display: block;
      flex: 0 0 auto;
    }
    .settings-w11-method-info {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .settings-w11-method-info strong {
      font-size: 14px;
      line-height: 1.2;
    }
    .settings-w11-method-info span {
      font-size: 12px;
      line-height: 1.4;
      color: #64748b;
    }

    /* QR Generation card (Step 3) */
    .settings-w11-qr-generation-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 28px 24px;
      border: 1px solid #d8dee8;
      border-radius: 12px;
      background: linear-gradient(180deg, #f7f9ff 0%, #ffffff 100%);
      text-align: center;
    }
    .settings-w11-qr-icon {
      width: 56px;
      height: 56px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: #002263;
      color: #ffffff;
    }
    .settings-w11-qr-icon svg {
      width: 28px;
      height: 28px;
      display: block;
    }
    .settings-w11-qr-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #002263;
    }
    .settings-w11-qr-description {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: #475467;
      max-width: 360px;
    }
    .settings-w11-qr-description strong {
      color: #002263;
    }
    .settings-w11-qr-expiry {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #fff7e6;
      border: 1px solid #ffd591;
      color: #874d00;
      font-size: 12px;
    }
    .settings-w11-qr-expiry svg {
      width: 14px;
      height: 14px;
      display: block;
    }
    .settings-w11-qr-expiry strong {
      color: #874d00;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsRolesComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly erp = inject(ErpDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeTab = signal<"all" | "admin" | "pm" | "accountant">("all");
  readonly search = signal("");
  readonly selected = signal<Employee | null>(null);
  readonly drawerTab = signal<"profile" | "permissions" | "projects" | "activity">("profile");

  // Drawer project picker — admins can (re)assign projects to a PM/
  // accountant here when their scope was empty at invite time.
  readonly drawerProjectIds = signal<string[]>([]);
  readonly savingProjects = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveOk = signal(false);
  readonly allProjects = computed(() => this.projects());

  // Invite Employee modal
  readonly showInvite = signal(false);
  readonly inviteName = signal("");
  readonly inviteEmail = signal("");
  readonly invitePhone = signal("");
  readonly inviteRole = signal<Role>("Project Manager");
  readonly inviteProjectIds = signal<string[]>([]);
  readonly projects = signal<{ id: string; name: string; client?: string; address?: string; status?: string }[]>([]);

  readonly activeOnHoldProjects = computed(() => {
    return this.projects().filter((p) => p.status === "Active" || p.status === "On Hold");
  });

  readonly completedProjects = computed(() => {
    return this.projects().filter((p) => p.status === "Completed");
  });

  readonly allActiveOnHoldSelected = computed(() => {
    const ids = this.activeOnHoldProjects().map((p) => p.id);
    return ids.length > 0 && ids.every((id) => this.inviteProjectIds().includes(id));
  });

  readonly allCompletedSelected = computed(() => {
    const ids = this.completedProjects().map((p) => p.id);
    return ids.length > 0 && ids.every((id) => this.inviteProjectIds().includes(id));
  });

  readonly someActiveOnHoldSelected = computed(() => {
    const ids = this.activeOnHoldProjects().map((p) => p.id);
    const selected = ids.filter((id) => this.inviteProjectIds().includes(id));
    return selected.length > 0 && selected.length < ids.length;
  });

  readonly someCompletedSelected = computed(() => {
    const ids = this.completedProjects().map((p) => p.id);
    const selected = ids.filter((id) => this.inviteProjectIds().includes(id));
    return selected.length > 0 && selected.length < ids.length;
  });

  readonly availableProjects = computed(() => {
    const apiProjects = this.projects();
    if (apiProjects.length > 0) return apiProjects;
    return this.erp.projects().map((p) => ({
      id: p.id,
      name: p.name,
      client: p.client,
      address: p.address,
      status: p.status,
    }));
  });

  isProjectSelected(id: string): boolean {
    return this.inviteProjectIds().includes(id);
  }

  toggleProject(id: string) {
    this.inviteProjectIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  toggleAllActiveOnHold() {
    const ids = this.activeOnHoldProjects().map((p) => p.id);
    const allSelected = this.allActiveOnHoldSelected();
    this.inviteProjectIds.update((current) => {
      if (allSelected) {
        return current.filter((id) => !ids.includes(id));
      } else {
        const newIds = new Set([...current, ...ids]);
        return Array.from(newIds);
      }
    });
  }

  toggleAllCompleted() {
    const ids = this.completedProjects().map((p) => p.id);
    const allSelected = this.allCompletedSelected();
    this.inviteProjectIds.update((current) => {
      if (allSelected) {
        return current.filter((id) => !ids.includes(id));
      } else {
        const newIds = new Set([...current, ...ids]);
        return Array.from(newIds);
      }
    });
  }

  private mapRoleToBackend(role: Role): "admin" | "project_manager" | "accountant" {
    switch (role) {
      case "Admin": return "admin";
      case "Project Manager": return "project_manager";
      case "Accountant": return "accountant";
      default: return "project_manager";
    }
  }

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
  readonly supervisorStep = signal(1);
  readonly availableSites = signal<any[]>([]);
  readonly selectedSiteIds = signal<Set<string>>(new Set());
  readonly sitesLoading = signal(false);
  readonly inviteMethod = signal<'email' | 'qr' | null>(null);

  // Pending invites table
  readonly pendingInvites = signal<PendingInvite[]>([]);
  readonly pendingEmployeeInvites = signal<EmployeeInvite[]>([]);
  readonly invitesLoading = signal(false);
  readonly employeeInvitesLoading = signal(false);
  readonly employeeEmailSendingToken = signal<string | null>(null);

  readonly allPendingInvites = computed<CombinedInvite[]>(() => {
    const supervisorInvites: CombinedInvite[] = this.pendingInvites().map(inv => ({
      type: "supervisor" as const,
      token: inv.token,
      name: inv.supervisorName,
      email: inv.supervisorEmail,
      phone: inv.supervisorPhone,
      role: "Supervisor",
      expiresAt: inv.expiresAt,
      remainingMs: inv.remainingMs,
      scanned: inv.scanned,
    }));
    const employeeInvites: CombinedInvite[] = this.pendingEmployeeInvites().map(inv => ({
      type: "employee" as const,
      token: inv.token,
      name: inv.name,
      email: inv.email,
      phone: inv.phone,
      role: inv.role,
      expiresAt: inv.expiresAt,
      remainingMs: inv.remainingMs,
    }));
    return [...supervisorInvites, ...employeeInvites];
  });

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  readonly approvalTypes = [
    { key: "material", label: "Material Requests", note: "Cement, steel, sand, etc." },
    { key: "labour", label: "Labour Attendance", note: "Daily attendance submissions" },
    { key: "expense", label: "Supervisor Expenses", note: "Diesel, equipment, transport" },
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
    this.loadProjects();
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
        const items = (res?.items || []).map((row: any): Employee => ({
          id: row._id ? String(row._id) : (row.id || ""),
          name: row.name || "—",
          email: row.email || "",
          phone: row.phone || "",
          role: (row.role === "admin" ? "Admin" : row.role === "project_manager" ? "Project Manager" : row.role === "accountant" ? "Accountant" : row.role === "supervisor" ? "Supervisor" : "Project Manager") as Role,
          status: (row.status || "active") as Status,
          lastLoginAt: row.lastLoginAt || "",
          createdAt: row.createdAt || "",
          projectIds: row.managedProjectIds ? row.managedProjectIds.map((id: any) => String(id)) : [],
        }));
        this.employees.set(items);
        this.employeesLoading.set(false);
        this.mergeLocalUsers();
      },
      error: () => {
        this.mergeLocalUsers();
        this.employeesLoading.set(false);
      },
    });
  }

  private mergeLocalUsers() {
    const fromErp: Employee[] = [
      ...this.erp.users().map((u): Employee => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        role: u.role as Role,
        status: u.status as Status,
        lastLoginAt: u.lastLoginAt || "",
        createdAt: u.createdAt,
        projectIds: u.projectIds || [],
      })),
      ...this.erp.supervisors().map((s): Employee => ({
        id: s.id,
        name: s.name,
        email: "",
        phone: s.phone,
        role: "Supervisor" as Role,
        status: s.status === "Active" ? "active" : s.status === "On Leave" ? "on_leave" : "inactive",
        lastLoginAt: "",
        createdAt: "",
        projectIds: [],
      })),
    ];
    this.employees.update((existing) => {
      const existingIds = new Set(existing.map((e) => e.id));
      const newItems = fromErp.filter((u) => !existingIds.has(u.id));
      return newItems.length > 0 ? [...existing, ...newItems] : existing;
    });
  }

  ngOnDestroy() {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }

  refreshInvites() {
    this.invitesLoading.set(true);
    this.employeeInvitesLoading.set(true);
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
        this.pendingInvites.set(fresh.filter((inv) => inv.remainingMs > 0));
        this.invitesLoading.set(false);
      },
      error: () => this.invitesLoading.set(false),
    });
    this.api.listActiveEmployeeInvites().subscribe({
      next: (res) => {
        const fresh = (res.invites || []).map((inv: any) => ({
          token: inv.token,
          inviteId: inv.inviteId,
          name: inv.name || inv.email,
          email: inv.email,
          phone: inv.phone,
          role: (inv.role === "admin" ? "Admin" : inv.role === "project_manager" ? "Project Manager" : "Accountant") as Role,
          expiresAt: inv.expiresAt,
          remainingMs: Math.max(0, inv.remainingMs),
          emailSent: inv.emailSent,
        }));
        this.pendingEmployeeInvites.set(fresh.filter((inv) => inv.remainingMs > 0));
        this.employeeInvitesLoading.set(false);
      },
      error: () => this.employeeInvitesLoading.set(false),
    });
  }

  loadProjects() {
    this.api.listProjects({ limit: 100 }).subscribe({
      next: (res) => {
        const items: { id: string; name: string; client?: string; address?: string; status?: string }[] = [];
        for (const row of res?.items || []) {
          const id = row._id || row.id;
          if (id) {
            items.push({
              id: String(id),
              name: row.name || "Unnamed project",
              client: row.client || "",
              address: row.address || "",
              status: row.status || "Active",
            });
          }
        }
        this.projects.set(items);
      },
      error: () => {
        this.projects.set([]);
        const fallback = this.erp.projects().map((p) => ({
          id: p.id,
          name: p.name,
          client: p.client,
          address: p.address,
          status: p.status,
        }));
        if (fallback.length > 0) {
          this.projects.set(fallback);
        }
      },
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
      }).filter((inv) => inv.scanned || inv.remainingMs > 0)
    );
    this.pendingEmployeeInvites.update((list) =>
      list.map((inv) => {
        const newRemaining = Math.max(0, inv.remainingMs - 1000);
        return { ...inv, remainingMs: newRemaining };
      }).filter((inv) => inv.remainingMs > 0)
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
    // Seed the project picker with the employee's current scope so the
    // admin can see what's there and add/remove.
    this.drawerProjectIds.set([...(e.projectIds || [])]);
    this.saveError.set(null);
    this.saveOk.set(false);
  }
  close() {
    this.selected.set(null);
    this.drawerProjectIds.set([]);
    this.saveError.set(null);
    this.saveOk.set(false);
  }

  /**
   * Only PMs and accountants have a project scope to edit. Admins are
   * unscoped (they see every project by default) and supervisors get
   * their scope via the supervisor-profile flow, not via User.
   */
  canEditProjects(): boolean {
    const e = this.selected();
    if (!e) return false;
    return e.role === "Project Manager" || e.role === "Accountant";
  }

  isDrawerProjectSelected(id: string): boolean {
    return this.drawerProjectIds().includes(id);
  }

  toggleDrawerProject(id: string) {
    this.drawerProjectIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
    this.saveOk.set(false);
    this.saveError.set(null);
  }

  saveDrawerProjects() {
    const e = this.selected();
    if (!e) return;
    this.savingProjects.set(true);
    this.saveError.set(null);
    this.saveOk.set(false);
    const ids = [...this.drawerProjectIds()];
    this.api.saveEmployeeManagedProjects(e.id, ids).subscribe({
      next: (res) => {
        const returned = res?.employee?.managedProjectIds || ids;
        this.drawerProjectIds.set(returned);
        // Keep the local Employee in sync so the chip list and the
        // employee table reflect the new scope immediately.
        this.employees.update((list) =>
          list.map((x) =>
            x.id === e.id ? { ...x, projectIds: returned.map((id: any) => String(id)) } : x
          )
        );
        this.selected.update((s) => (s ? { ...s, projectIds: returned.map((id: any) => String(id)) } : s));
        this.savingProjects.set(false);
        this.saveOk.set(true);
      },
      error: (err) => {
        this.savingProjects.set(false);
        this.saveError.set(
          err?.error?.error || err?.error?.message || err?.message || "Could not save project assignments."
        );
      },
    });
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
    this.inviteProjectIds.set([]);
    this.inviteError.set(null);
  }
  closeInvite() {
    this.showInvite.set(false);
    this.inviteError.set(null);
  }

  sendInvite() {
    const name = this.inviteName().trim();
    const email = this.inviteEmail().trim();
    const phone = this.invitePhone().trim();
    const role = this.inviteRole();
    const projectIds = this.inviteProjectIds();

    this.inviteError.set(null);

    // Validate basic fields
    if (name.length < 2) {
      this.inviteError.set("Please enter a name.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.inviteError.set("Please enter a valid email address.");
      return;
    }

    // projectIds is optional — admin can invite PM/accountant without
    // selecting projects. They can assign projects later from the
    // employee detail page. If no projects, the employee simply sees
    // no projects in their scope until projects are assigned.
    this.inviteSending.set(true);
    this.api.createEmployeeInvite({
      name,
      email,
      phone: phone || undefined,
      role: role as "Admin" | "Project Manager" | "Accountant",
      projectIds: role === "Admin" ? undefined : (projectIds.length > 0 ? projectIds : undefined),
    }).subscribe({
      next: (res) => {
        this.inviteSending.set(false);
        if (res?.emailSent) {
          alert(`Invite sent to ${email}. They will receive a link to set up their account.`);
        } else {
          alert(`Invite created for ${email}. Share the link with them manually: ${res?.inviteUrl || ""}`);
        }
        this.closeInvite();
        this.refreshEmployees();
        this.refreshInvites();
      },
      error: (err) => {
        this.inviteSending.set(false);
        if (err?.status === 409 || err?.details?.duplicate) {
          const field = err?.details?.field || "email";
          this.inviteError.set(
            `A user with this ${field} already exists. Please use a different ${field} or ask the admin to remove the existing user first.`
          );
          return;
        }
        const detail = err?.error?.error || err?.error?.message || err?.message || "Failed to send invite. Please try again.";
        this.inviteError.set(typeof detail === "string" ? detail : "Failed to send invite. Please try again.");
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
    this.supervisorStep.set(1);
    this.selectedSiteIds.set(new Set());
    this.loadAvailableSites();
  }

  loadAvailableSites() {
    this.sitesLoading.set(true);
    this.api.listProjects({ limit: 200 }).subscribe({
      next: (res) => {
        const rawSites = res.items || [];
        this.availableSites.set(
          rawSites.map((site: any, index: number) => ({
            ...site,
            id: site.id || site._id || `project-${index}`,
          }))
        );
        this.sitesLoading.set(false);
      },
      error: () => {
        this.availableSites.set([]);
        this.sitesLoading.set(false);
      },
    });
  }

  closeAddSupervisor() {
    this.showAddSupervisor.set(false);
    this.currentInvite.set(null);
    this.supervisorError.set(null);
    this.inviteMethod.set(null);
    this.refreshInvites();
  }

  generateAnother() {
    this.currentInvite.set(null);
    this.supervisorError.set(null);
    this.supervisorNameDraft.set("");
    this.supervisorEmailDraft.set("");
    this.supervisorPhoneDraft.set("");
    this.supervisorStep.set(1);
    this.selectedSiteIds.set(new Set());
    this.inviteMethod.set(null);
  }

  nextStep() {
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
    this.supervisorStep.set(2);
  }

  prevStep() {
    const currentStep = this.supervisorStep();
    if (currentStep > 1) {
      this.supervisorStep.set(currentStep - 1);
    }
    this.supervisorError.set(null);
  }

  toggleSite(siteId: string) {
    const current = new Set(this.selectedSiteIds());
    if (current.has(siteId)) {
      current.delete(siteId);
    } else {
      current.add(siteId);
    }
    this.selectedSiteIds.set(current);
  }

  goToInviteMethod() {
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
    const siteIds = Array.from(this.selectedSiteIds());
    if (siteIds.length === 0) {
      this.supervisorError.set("Please select at least one project.");
      return;
    }
    this.supervisorError.set(null);
    this.supervisorStep.set(3);
    // Email invite disabled — default to QR so admin doesn't need to
    // interact with Step 3 method chooser; future re-enable would reset
    // inviteMethod to null and surface the email/QR cards again.
    this.inviteMethod.set('qr');
  }

  setInviteMethod(method: 'email' | 'qr') {
    this.inviteMethod.set(method);
    this.supervisorError.set(null);
  }

  createInviteWithMethod() {
    const method = this.inviteMethod();
    if (!method) {
      this.supervisorError.set("Please choose an invite method.");
      return;
    }
    const name = this.supervisorNameDraft().trim();
    const email = this.supervisorEmailDraft().trim();
    const phone = this.supervisorPhoneDraft().trim();
    const projectIds = Array.from(this.selectedSiteIds());
    this.supervisorError.set(null);
    this.supervisorLoading.set(true);

    this.api.createSupervisorInvite({ 
      supervisorName: name, 
      supervisorEmail: email, 
      supervisorPhone: phone, 
      projectIds,
      sendEmail: method === 'email'
    }).subscribe({
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
        this.supervisorStep.set(4);
        this.supervisorLoading.set(false);
        this.refreshInvites();
      },
      error: (err) => {
        this.supervisorLoading.set(false);
        if (err?.status === 409 || err?.details?.duplicate) {
          const field = err?.details?.field || "email";
          this.supervisorError.set(
            `A user with this ${field} already exists. Please use a different ${field} or ask the admin to remove the existing user first.`
          );
          return;
        }
        const status = err?.status ?? err?.statusCode;
        const detail = err?.error?.error || err?.message || "Failed to create invite.";
        this.supervisorError.set(`[${status ?? "?"}] ${detail}`);
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

  resendEmployeeInvite(inv: EmployeeInvite) {
    if (inv.remainingMs <= 0) return;
    this.employeeEmailSendingToken.set(inv.token);
    this.api.sendEmployeeOtp(inv.token).subscribe({
      next: (res) => {
        this.employeeEmailSendingToken.set(null);
        if (res?.emailSent) {
          alert(`Setup email sent to ${inv.email}.`);
        } else {
          alert("Could not send the setup email. Please check the email provider logs or share the invite link manually.");
        }
        this.refreshInvites();
      },
      error: (err) => {
        this.employeeEmailSendingToken.set(null);
        const detail = err?.error?.error || err?.error?.message || err?.message || "Failed to send setup email.";
        alert(typeof detail === "string" ? detail : "Failed to send setup email.");
      },
    });
  }

  resendEmployeeInviteByToken(token: string) {
    const inv = this.pendingEmployeeInvites().find(i => i.token === token);
    if (inv) {
      this.resendEmployeeInvite(inv);
    }
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

  resendOtpByToken(token: string) {
    const inv = this.pendingInvites().find(i => i.token === token);
    if (inv) {
      this.resendOtp(inv);
    }
  }
}
