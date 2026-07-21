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
          <div>
            <h2>Invite Employee</h2>
            <small class="settings-w11-step-label">Step {{ inviteStep() }} of 2</small>
          </div>
          <button type="button" class="settings-w11-icon-btn" (click)="closeInvite()" aria-label="Close">
            <svg viewBox="0 0 16 16"><path d="m4 4 8 8 M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </header>
        <div class="settings-w11-modal-body">

          @if (inviteStep() === 1) {
            <!-- Step 1: Basic details -->
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
          }

          @if (inviteStep() === 2) {
            <!-- Step 2: Project allocation -->
            <div class="settings-w11-field">
              <label>
                Allocate projects
                <small class="settings-w11-hint-inline">Choose which projects this person can access once they sign up</small>
              </label>

              <!-- Active / On Hold Section -->
              <div class="settings-w11-project-group">
                <div class="settings-w11-project-group-header">
                  <label class="settings-w11-select-all">
                    <input
                      type="checkbox"
                      [checked]="allActiveOnHoldSelected()"
                      [indeterminate]="someActiveOnHoldSelected()"
                      (change)="toggleAllActiveOnHold()"
                    />
                    <span>Active / On Hold</span>
                    <strong>({{ activeOnHoldProjects().length }})</strong>
                  </label>
                </div>
                <div class="settings-w11-project-grid">
                  @for (p of activeOnHoldProjects(); track p.id) {
                    <label class="settings-w11-project-card" [class.checked]="isProjectSelected(p.id)">
                      <input
                        type="checkbox"
                        [checked]="isProjectSelected(p.id)"
                        (change)="toggleProject(p.id)"
                      />
                      <div class="settings-w11-project-card-inner">
                        <span class="settings-w11-project-name">{{ p.name }}</span>
                        <small class="settings-w11-project-meta">{{ p.client || p.address || '—' }}</small>
                      </div>
                    </label>
                  } @empty {
                    <div class="settings-w11-empty-inline">No active/on-hold projects.</div>
                  }
                </div>
              </div>

              <!-- Completed Section -->
              <div class="settings-w11-project-group">
                <div class="settings-w11-project-group-header">
                  <label class="settings-w11-select-all">
                    <input
                      type="checkbox"
                      [checked]="allCompletedSelected()"
                      [indeterminate]="someCompletedSelected()"
                      (change)="toggleAllCompleted()"
                    />
                    <span>Completed</span>
                    <strong>({{ completedProjects().length }})</strong>
                  </label>
                </div>
                <div class="settings-w11-project-grid">
                  @for (p of completedProjects(); track p.id) {
                    <label class="settings-w11-project-card" [class.checked]="isProjectSelected(p.id)">
                      <input
                        type="checkbox"
                        [checked]="isProjectSelected(p.id)"
                        (change)="toggleProject(p.id)"
                      />
                      <div class="settings-w11-project-card-inner">
                        <span class="settings-w11-project-name">{{ p.name }}</span>
                        <small class="settings-w11-project-meta">{{ p.client || p.address || '—' }}</small>
                      </div>
                    </label>
                  } @empty {
                    <div class="settings-w11-empty-inline">No completed projects.</div>
                  }
                </div>
              </div>
            </div>
          }

          @if (inviteError()) {
            <div class="settings-w11-message error">{{ inviteError() }}</div>
          }
        </div>
        <footer class="settings-w11-modal-foot">
          @if (inviteStep() === 1) {
            <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="closeInvite()">Cancel</button>
            <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="nextInviteStep()">
              Next
            </button>
          }
          @if (inviteStep() === 2) {
            <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="backInviteStep()">Back</button>
            <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="sendInvite()" [disabled]="inviteSending()">
              {{ inviteSending() ? 'Sending…' : 'Send invite' }}
            </button>
          }
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
          @if (supervisorStep() < 3) {
            <div class="settings-w11-step-indicator">
              <div class="settings-w11-step" [class.active]="supervisorStep() === 1" [class.done]="supervisorStep() > 1">
                <span class="step-circle">{{ supervisorStep() > 1 ? '✓' : '1' }}</span>
                <span class="step-label">Details</span>
              </div>
              <div class="step-line" [class.done]="supervisorStep() > 1"></div>
              <div class="settings-w11-step" [class.active]="supervisorStep() === 2" [class.done]="supervisorStep() > 2">
                <span class="step-circle">{{ supervisorStep() > 2 ? '✓' : '2' }}</span>
                <span class="step-label">Sites</span>
              </div>
              <div class="step-line" [class.done]="supervisorStep() > 2"></div>
              <div class="settings-w11-step" [class.active]="supervisorStep() === 3">
                <span class="step-circle">3</span>
                <span class="step-label">QR</span>
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
                Next: Select Sites
              </button>
            </div>
          }

          @if (supervisorStep() === 2) {
            <div class="settings-w11-form">
              <p class="settings-w11-step-hint">Select the sites this supervisor will manage:</p>
              @if (sitesLoading()) {
                <div class="settings-w11-loading">Loading sites...</div>
              }
              @if (!sitesLoading() && availableSites().length === 0) {
                <div class="settings-w11-message info">No sites available.</div>
              }
              <div class="settings-w11-site-list">
                @for (site of availableSites(); track site.id) {
                  <label class="settings-w11-site-item" [class.selected]="selectedSiteIds().has(site.id)">
                    <input
                      type="checkbox"
                      [checked]="selectedSiteIds().has(site.id)"
                      (change)="toggleSite(site.id)"
                    />
                    <div class="site-item-info">
                      <strong>{{ site.name }}</strong>
                      <small>{{ site.projectName || 'No project' }}</small>
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
                <!-- Send via email: temporarily hidden (backend code preserved for future re-enable) -->
                <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="sendSupervisorEmail(invite)" [disabled]="sendingEmail() || invite.remainingMs <= 0" [style.display]="'none'">
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
          @if (supervisorStep() === 2) {
            <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="prevStep()">Back</button>
          }
          <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="closeAddSupervisor()">Close</button>
        </footer>
      </div>
    }
  `,
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

  // Invite Employee modal
  readonly showInvite = signal(false);
  readonly inviteName = signal("");
  readonly inviteEmail = signal("");
  readonly invitePhone = signal("");
  readonly inviteRole = signal<Role>("Project Manager");
  readonly inviteProjectIds = signal<string[]>([]);
  readonly inviteStep = signal<1 | 2>(1);
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
    this.inviteProjectIds.set([]);
    this.inviteStep.set(1);
    this.inviteError.set(null);
  }
  closeInvite() {
    this.showInvite.set(false);
    this.inviteError.set(null);
  }

  nextInviteStep() {
    const name = this.inviteName().trim();
    const email = this.inviteEmail().trim();
    const phone = this.invitePhone().trim();

    this.inviteError.set(null);
    if (name.length < 2) {
      this.inviteError.set("Please enter a name.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.inviteError.set("Please enter a valid email address.");
      return;
    }
    if (this.inviteRole() === "Admin") {
      this.sendInvite();
      return;
    }
    this.inviteStep.set(2);
  }

  backInviteStep() {
    this.inviteStep.set(1);
    this.inviteError.set(null);
  }
  sendInvite() {
    const name = this.inviteName().trim();
    const email = this.inviteEmail().trim();
    const phone = this.invitePhone().trim();
    const role = this.inviteRole();
    const projectIds = this.inviteProjectIds();

    this.inviteError.set(null);
    if (role !== "Admin" && projectIds.length === 0) {
      this.inviteError.set("Please select at least one project for this employee.");
      return;
    }
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
    this.api.listSitesAdmin().subscribe({
      next: (res) => {
        this.availableSites.set(res.sites || []);
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
    this.supervisorStep.set(1);
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
    const siteIds = Array.from(this.selectedSiteIds());
    if (siteIds.length === 0) {
      this.supervisorError.set("Please select at least one site.");
      return;
    }
    this.supervisorError.set(null);
    this.supervisorLoading.set(true);

    this.api.createSupervisorInvite({ supervisorName: name, supervisorEmail: email, supervisorPhone: phone, siteIds }).subscribe({
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
        this.supervisorStep.set(3);
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
