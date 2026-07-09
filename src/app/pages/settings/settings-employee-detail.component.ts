import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ErpDataService } from "../../data/erp-data.service";
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

type ApprovalRight = {
  key: string;
  label: string;
  note: string;
  canApprove: boolean;
  canReject: boolean;
};

@Component({
  selector: "agb-settings-employee-detail",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <a routerLink="/settings/roles">Roles and Employees</a>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>{{ employee()?.name || 'Employee' }}</strong>
      </nav>
      @if (employee()) {
        <div class="settings-w11-header-row">
          <div class="settings-w11-name-row">
            <span class="settings-w11-avatar xl">{{ initials(employee()!.name) }}</span>
            <div>
              <h1>{{ employee()!.name }}</h1>
              <p>{{ employee()!.email }} · {{ employee()!.role }}</p>
            </div>
          </div>
          <div class="settings-w11-header-actions">
            <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="goBack()">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 4-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Back to list
            </button>
            @if (employee()!.status !== 'inactive') {
              <button type="button" class="settings-w11-btn settings-w11-btn-danger-outline" (click)="deactivate()">Deactivate</button>
            } @else {
              <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="activate()">Activate</button>
            }
          </div>
        </div>
      }
    </header>

    @if (!employee()) {
      <div class="settings-w11-empty">
        <p>Employee not found.</p>
      </div>
    } @else {
      <nav class="settings-w11-detail-tabs" role="tablist">
        <button type="button" role="tab" [class.active]="activeTab() === 'profile'" (click)="activeTab.set('profile')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M1 14s0-5 7-5 7 5 7 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          Profile
        </button>
        <button type="button" role="tab" [class.active]="activeTab() === 'permissions'" (click)="activeTab.set('permissions')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M13 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M6 8c0 5 3.5 8.5 7 8.5s7-3.5 7-8.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          Permissions
        </button>
        <button type="button" role="tab" [class.active]="activeTab() === 'projects'" (click)="activeTab.set('projects')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          Projects
        </button>
        <button type="button" role="tab" [class.active]="activeTab() === 'activity'" (click)="activeTab.set('activity')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14V6l4-4 3 3 5-5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Activity
        </button>
      </nav>

      <div class="settings-w11-detail-body">
        <!-- PROFILE TAB -->
        @if (activeTab() === 'profile') {
          <section class="settings-w11-card">
            <div class="settings-w11-card-head">
              <div>
                <h2>Profile Information</h2>
                <p>Basic details about this employee.</p>
              </div>
              <button type="button" class="settings-w11-btn settings-w11-btn-ghost small">Edit</button>
            </div>
            <div class="settings-w11-card-body">
              <dl class="settings-w11-dl-grid">
                <div><dt>Full Name</dt><dd>{{ employee()!.name }}</dd></div>
                <div><dt>Email</dt><dd>{{ employee()!.email }}</dd></div>
                <div><dt>Phone</dt><dd>{{ employee()!.phone }}</dd></div>
                <div><dt>Role</dt><dd><span class="settings-w11-role-pill" [attr.data-role]="employee()!.role">{{ employee()!.role }}</span></dd></div>
                <div><dt>Status</dt><dd><span class="settings-w11-status-pill" [attr.data-status]="employee()!.status">{{ employee()!.status }}</span></dd></div>
                <div><dt>Joined</dt><dd>{{ formatDate(employee()!.createdAt) }}</dd></div>
                <div><dt>Last Login</dt><dd>{{ formatDate(employee()!.lastLoginAt) }}</dd></div>
                <div><dt>Employee ID</dt><dd class="mono">{{ employee()!.id }}</dd></div>
              </dl>
            </div>
          </section>

          <section class="settings-w11-card">
            <div class="settings-w11-card-head">
              <div>
                <h2>Assigned Projects</h2>
                <p>Projects this employee has access to.</p>
              </div>
            </div>
            <div class="settings-w11-card-body">
              @if (employee()!.projectIds.length > 0) {
                <ul class="settings-w11-proj-list">
                  @for (pid of employee()!.projectIds; track pid) {
                    <li><span class="settings-w11-proj-chip">{{ pid }}</span></li>
                  }
                </ul>
              } @else {
                <p class="settings-w11-empty-hint">No projects assigned yet.</p>
              }
            </div>
          </section>
        }

        <!-- PERMISSIONS TAB -->
        @if (activeTab() === 'permissions') {
          <section class="settings-w11-card">
            <div class="settings-w11-card-head">
              <div>
                <h2>Approval Rights</h2>
                <p>Toggle which actions this employee can approve or reject.</p>
              </div>
            </div>
            <div class="settings-w11-card-body">
              <div class="settings-w11-approval-list">
                @for (r of approvalRights(); track r.key) {
                  <div class="settings-w11-approval-row">
                    <div class="settings-w11-approval-label">
                      <strong>{{ r.label }}</strong>
                      <small>{{ r.note }}</small>
                    </div>
                    <div class="settings-w11-approval-toggles">
                      <label class="settings-w11-toggle-check" [class.on]="r.canApprove" (click)="toggleRight(r.key, 'approve')">
                        <span class="toggle-indicator"></span>
                        <span>Approve</span>
                      </label>
                      <label class="settings-w11-toggle-check" [class.on]="r.canReject" (click)="toggleRight(r.key, 'reject')">
                        <span class="toggle-indicator"></span>
                        <span>Reject</span>
                      </label>
                    </div>
                  </div>
                }
              </div>
            </div>
          </section>

          <section class="settings-w11-card">
            <div class="settings-w11-card-head">
              <div>
                <h2>Access Control</h2>
                <p>Additional access restrictions for this employee.</p>
              </div>
            </div>
            <div class="settings-w11-card-body">
              <label class="settings-w11-check-row">
                <div>
                  <strong>Can access mobile app</strong>
                  <small>Allow this employee to use the AGB mobile supervisor app.</small>
                </div>
                <input type="checkbox" [checked]="canAccessMobile()" (change)="canAccessMobile.set($any($event.target).checked)" />
              </label>
              <label class="settings-w11-check-row">
                <div>
                  <strong>Can view reports</strong>
                  <small>Access to the Reports section in the admin console.</small>
                </div>
                <input type="checkbox" [checked]="canViewReports()" (change)="canViewReports.set($any($event.target).checked)" />
              </label>
              <label class="settings-w11-check-row">
                <div>
                  <strong>Can manage workers</strong>
                  <small>Add, edit, and remove workers from sites.</small>
                </div>
                <input type="checkbox" [checked]="canManageWorkers()" (change)="canManageWorkers.set($any($event.target).checked)" />
              </label>
              <label class="settings-w11-check-row">
                <div>
                  <strong>Can approve wage overrides</strong>
                  <small>Override the default wage rates for workers.</small>
                </div>
                <input type="checkbox" [checked]="canApproveWages()" (change)="canApproveWages.set($any($event.target).checked)" />
              </label>
            </div>
          </section>
        }

        <!-- PROJECTS TAB -->
        @if (activeTab() === 'projects') {
          <section class="settings-w11-card">
            <div class="settings-w11-card-head">
              <div>
                <h2>Accessible Projects</h2>
                <p>These are the only projects this employee can access and submit data for.</p>
              </div>
              <button type="button" class="settings-w11-btn settings-w11-btn-primary small">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10 M3 8h10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
                Assign Projects
              </button>
            </div>
            <div class="settings-w11-card-body">
              @if (employee()!.projectIds.length > 0) {
                <table class="settings-w11-table">
                  <thead>
                    <tr><th>Project ID</th><th>Project Name</th><th>Role</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    @for (pid of employee()!.projectIds; track pid) {
                      <tr>
                        <td class="mono">{{ pid }}</td>
                        <td>Project Name</td>
                        <td><span class="settings-w11-role-pill" data-role="Project Manager">Project Manager</span></td>
                        <td>
                          <button type="button" class="settings-w11-btn settings-w11-btn-ghost small red" (click)="removeProject(pid)">Remove</button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <div class="settings-w11-empty-state">
                  <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="12" width="36" height="28" rx="3" fill="none" stroke="#CBD5E1" stroke-width="2"/><path d="M6 20h36M16 12V8h8v4M28 12V8h8v4" fill="none" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/></svg>
                  <strong>No projects assigned</strong>
                  <p>This employee has no projects assigned. Click "Assign Projects" to grant access.</p>
                </div>
              }
            </div>
          </section>
        }

        <!-- ACTIVITY TAB -->
        @if (activeTab() === 'activity') {
          <section class="settings-w11-card">
            <div class="settings-w11-card-head">
              <div>
                <h2>Recent Activity</h2>
                <p>Recent actions and submissions by this employee.</p>
              </div>
            </div>
            <div class="settings-w11-card-body">
              <ul class="settings-w11-activity-list">
                <li>
                  <span class="dot approve"></span>
                  <div><strong>Approved</strong> — Material request for PRJ-001 <small>2 hours ago</small></div>
                </li>
                <li>
                  <span class="dot pending"></span>
                  <div><strong>Submitted</strong> — Labour attendance for Site A <small>5 hours ago</small></div>
                </li>
                <li>
                  <span class="dot approve"></span>
                  <div><strong>Approved</strong> — Site expense diesel ₹4,200 <small>Yesterday</small></div>
                </li>
                <li>
                  <span class="dot reject"></span>
                  <div><strong>Rejected</strong> — Subcontractor payment request <small>2 days ago</small></div>
                </li>
                <li>
                  <span class="dot"></span>
                  <div><strong>Logged in</strong> from Android device <small>3 days ago</small></div>
                </li>
              </ul>
            </div>
          </section>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsEmployeeDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly data = inject(ErpDataService);
  private readonly api = inject(ApiService);

  readonly activeTab = signal<"profile" | "permissions" | "projects" | "activity">("profile");

  readonly canAccessMobile = signal(true);
  readonly canViewReports = signal(true);
  readonly canManageWorkers = signal(true);
  readonly canApproveWages = signal(false);

  readonly approvalTypes = [
    { key: "material", label: "Material Requests", note: "Cement, steel, sand, bricks, etc." },
    { key: "labour", label: "Labour Attendance", note: "Daily worker attendance entries" },
    { key: "site_expense", label: "Site Expenses", note: "Diesel, equipment, transport costs" },
    { key: "general_expense", label: "General Expenses", note: "Office supplies, miscellaneous" },
    { key: "payment", label: "Client Payments", note: "Collections from clients" },
    { key: "subcontract", label: "Subcontracts", note: "Subcontractor agreements and payments" },
    { key: "vendor", label: "Vendor Payments", note: "Payments to vendors and suppliers" },
    { key: "reports", label: "Reports", note: "Generate and download reports" },
  ];

  readonly approvalRights = computed<ApprovalRight[]>(() =>
    this.approvalTypes.map((t) => ({
      ...t,
      canApprove: this._hasRight(this.empId(), t.key, "approve"),
      canReject: this._hasRight(this.empId(), t.key, "reject"),
    }))
  );

  private _rights: Record<string, Record<string, boolean>> = {
    "E-001": {
      "material_approve": true, "material_reject": true,
      "labour_approve": true, "labour_reject": true,
      "expense_approve": true, "expense_reject": true,
      "payment_approve": true, "payment_reject": false,
      "subcontract_approve": false, "subcontract_reject": false,
      "vendor_approve": false, "vendor_reject": false,
      "reports_approve": true, "reports_reject": false,
    },
    "E-002": {
      "material_approve": true, "material_reject": true,
      "labour_approve": true, "labour_reject": true,
      "expense_approve": true, "expense_reject": true,
      "payment_approve": true, "payment_reject": false,
      "subcontract_approve": false, "subcontract_reject": false,
      "vendor_approve": false, "vendor_reject": false,
      "reports_approve": false, "reports_reject": false,
    },
  };

  readonly employees = signal<Employee[]>([
    { id: "E-001", name: "Karthik Raja", email: "karthik@agbuilders.com", phone: "+91 98765 43210", role: "Admin", status: "active", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), createdAt: "2024-01-15T00:00:00Z", projectIds: ["PRJ-001", "PRJ-002"] },
    { id: "E-002", name: "Suresh Babu", email: "suresh@agbuilders.com", phone: "+91 98765 43211", role: "Project Manager", status: "active", lastLoginAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), createdAt: "2024-02-20T00:00:00Z", projectIds: ["PRJ-001", "PRJ-002"] },
    { id: "E-003", name: "Anitha Kumari", email: "anitha@agbuilders.com", phone: "+91 98765 43212", role: "Project Manager", status: "active", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), createdAt: "2024-03-10T00:00:00Z", projectIds: ["PRJ-003"] },
    { id: "E-004", name: "Vinoth Kumar", email: "vinoth@agbuilders.com", phone: "+91 98765 43213", role: "Accountant", status: "active", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), createdAt: "2024-01-25T00:00:00Z", projectIds: [] },
    { id: "E-005", name: "Lakshmi Devi", email: "lakshmi@agbuilders.com", phone: "+91 98765 43214", role: "Accountant", status: "on_leave", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), createdAt: "2024-04-05T00:00:00Z", projectIds: [] },
    { id: "E-006", name: "Ramesh Kannan", email: "ramesh@agbuilders.com", phone: "+91 98765 43215", role: "Project Manager", status: "inactive", lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), createdAt: "2024-02-01T00:00:00Z", projectIds: [] },
  ]);

  empId = signal<string>("");

  readonly employee = computed<Employee | null>(() => {
    return this.employees().find((e) => e.id === this.empId()) || null;
  });

  ngOnInit() {
    this.empId.set(this.route.snapshot.paramMap.get("id") || "");
  }

  initials(name: string): string {
    return (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }

  formatDate(iso: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  toggleRight(key: string, type: "approve" | "reject") {
    const id = this.empId();
    if (!this._rights[id]) this._rights[id] = {};
    const k = `${key}_${type}`;
    this._rights[id][k] = !this._rights[id][k];
  }

  private _hasRight(id: string, key: string, type: "approve" | "reject"): boolean {
    return this._rights[id]?.[`${key}_${type}`] ?? false;
  }

  removeProject(pid: string) {
    if (confirm(`Remove access to ${pid}?`)) {
      this.employees.update((list) =>
        list.map((e) => e.id === this.empId() ? { ...e, projectIds: e.projectIds.filter((p) => p !== pid) } : e)
      );
    }
  }

  goBack() {
    this.router.navigateByUrl("/settings/roles");
  }

  deactivate() {
    if (confirm("Deactivate this employee? They will lose access immediately.")) {
      this.employees.update((list) =>
        list.map((e) => e.id === this.empId() ? { ...e, status: "inactive" as Status } : e)
      );
    }
  }

  activate() {
    this.employees.update((list) =>
      list.map((e) => e.id === this.empId() ? { ...e, status: "active" as Status } : e)
    );
  }
}