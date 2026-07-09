import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

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

@Component({
  selector: "agb-settings-roles",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
          <a
            routerLink="/settings/roles/add-supervisor"
            class="settings-w11-btn settings-w11-btn-ghost"
            title="Add a new supervisor via QR code"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h3v8H3zM10 4h3v8h-3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 8h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            Add Supervisor
          </a>
          <input
            type="text"
            class="settings-w11-search-input"
            placeholder="Search by name or email"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
          />
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="openInvite()">
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
              <tr (click)="select(e)" class="settings-w11-row-clickable">
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

    <!-- Invite modal -->
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
        </div>
        <footer class="settings-w11-modal-foot">
          <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="closeInvite()">Cancel</button>
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="sendInvite()">Send invite</button>
        </footer>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsRolesComponent {
  readonly activeTab = signal<"all" | "admin" | "pm" | "accountant">("all");
  readonly search = signal("");
  readonly selected = signal<Employee | null>(null);
  readonly drawerTab = signal<"profile" | "permissions" | "projects" | "activity">("profile");

  readonly showInvite = signal(false);
  readonly inviteName = signal("");
  readonly inviteEmail = signal("");
  readonly invitePhone = signal("");
  readonly inviteRole = signal<Role>("Project Manager");

  readonly approvalTypes = [
    { key: "material", label: "Material Requests", note: "Cement, steel, sand, etc." },
    { key: "labour", label: "Labour Attendance", note: "Daily attendance submissions" },
    { key: "expense", label: "Site Expenses", note: "Diesel, equipment, transport" },
    { key: "payment", label: "Client Payments", note: "Collections from clients" },
    { key: "subcontract", label: "Subcontracts", note: "Subcontractor agreements" },
  ];

  readonly permissions = signal<Record<string, Record<string, { approve: boolean; reject: boolean }>>>({});

  readonly employees = signal<Employee[]>([
    { id: "E-001", name: "Karthik Raja", email: "karthik@agbuilders.com", phone: "+91 98765 43210", role: "Admin", status: "active", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), createdAt: "2024-01-15T00:00:00Z", projectIds: [] },
    { id: "E-002", name: "Suresh Babu", email: "suresh@agbuilders.com", phone: "+91 98765 43211", role: "Project Manager", status: "active", lastLoginAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), createdAt: "2024-02-20T00:00:00Z", projectIds: ["PRJ-001", "PRJ-002"] },
    { id: "E-003", name: "Anitha Kumari", email: "anitha@agbuilders.com", phone: "+91 98765 43212", role: "Project Manager", status: "active", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), createdAt: "2024-03-10T00:00:00Z", projectIds: ["PRJ-003"] },
    { id: "E-004", name: "Vinoth Kumar", email: "vinoth@agbuilders.com", phone: "+91 98765 43213", role: "Accountant", status: "active", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), createdAt: "2024-01-25T00:00:00Z", projectIds: [] },
    { id: "E-005", name: "Lakshmi Devi", email: "lakshmi@agbuilders.com", phone: "+91 98765 43214", role: "Accountant", status: "on_leave", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), createdAt: "2024-04-05T00:00:00Z", projectIds: [] },
    { id: "E-006", name: "Ramesh Kannan", email: "ramesh@agbuilders.com", phone: "+91 98765 43215", role: "Project Manager", status: "inactive", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), createdAt: "2024-02-01T00:00:00Z", projectIds: [] },
  ]);

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

  countByRole(role: Role): number {
    return this.employees().filter((e) => e.role === role).length;
  }

  initials(name: string): string {
    return name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
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
    alert("Invite sent. (UI placeholder — wire to backend in next step.)");
    this.closeInvite();
  }
}
