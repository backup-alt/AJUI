import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
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
  // Supervisor-specific fields
  assignedSiteIds?: string[];
  assignedSites?: string[];
  assignedProjectIds?: string[];
}

interface ApprovalRight {
  key: string;
  label: string;
  note: string;
  canApprove: boolean;
  canReject: boolean;
}

interface ActivityEntry {
  id: string;
  action: string;
  description: string;
  timestamp: string;
}

@Component({
  selector: "agb-settings-employee-detail",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <a routerLink="/settings">Settings</a>
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
          </div>
        </div>
      }
    </header>

    @if (loading()) {
      <div class="settings-w11-empty"><p>Loading employee…</p></div>
    } @else if (!employee()) {
      <div class="settings-w11-empty">
        <p>Employee not found.</p>
        <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="goBack()">Back to list</button>
      </div>
    } @else {
      <nav class="settings-w11-detail-tabs" role="tablist">
        <button type="button" role="tab" [class.active]="activeTab() === 'profile'" (click)="activeTab.set('profile')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M1 14s0-5 7-5 7 5 7 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          Profile
        </button>
        <button type="button" role="tab" [class.active]="activeTab() === 'projects'" (click)="activeTab.set('projects')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          Projects
        </button>
        <button type="button" role="tab" [class.active]="activeTab() === 'activity'" (click)="activeTab.set('activity')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3.5l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
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
            </div>
            <div class="settings-w11-card-body">
              <dl class="settings-w11-dl-grid">
                <div><dt>Full Name</dt><dd>{{ employee()!.name }}</dd></div>
                <div><dt>Email</dt><dd>{{ employee()!.email }}</dd></div>
                <div><dt>Phone</dt><dd>{{ employee()!.phone || '—' }}</dd></div>
                <div><dt>Role</dt><dd><span class="settings-w11-role-pill" [attr.data-role]="employee()!.role">{{ employee()!.role }}</span></dd></div>
                <div><dt>Status</dt><dd><span class="settings-w11-status-pill" [attr.data-status]="employee()!.status">{{ employee()!.status }}</span></dd></div>
                <div><dt>Joined</dt><dd>{{ formatDate(employee()!.createdAt) }}</dd></div>
                <div><dt>Last Login</dt><dd>{{ formatDate(employee()!.lastLoginAt) }}</dd></div>
              </dl>
            </div>
          </section>

          @if (employee()!.role === 'Supervisor') {
            <section class="settings-w11-card">
              <div class="settings-w11-card-head">
                <div>
                  <h2>Assigned Sites</h2>
                  <p>Sites that this supervisor is assigned to.</p>
                </div>
                <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="showSitePicker.set(true)">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  Add Site
                </button>
              </div>
              <div class="settings-w11-card-body">
                @if (supervisorAssignedSiteNames().length > 0) {
                  <div class="settings-w11-site-list">
                    @for (site of supervisorAssignedSiteNames(); track site.id) {
                      <div class="settings-w11-site-chip">
                        <span>{{ site.name }}</span>
                        <button type="button" class="settings-w11-chip-remove" (click)="removeSupervisorSite(site.id)" title="Remove site">
                          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                        </button>
                      </div>
                    }
                  </div>
                } @else {
                  <p class="settings-w11-empty-hint">No sites assigned yet.</p>
                }
              </div>
            </section>
          }
        }

        <!-- PERMISSIONS TAB -->
        @if (activeTab() === 'permissions') {
          <section class="settings-w11-card">
            <div class="settings-w11-card-head">
              <div>
                <h2>Approval Access</h2>
                <p>Toggle which approval types this employee can access. This overrides the role defaults.</p>
              </div>
              @if (permSaving()) {
                <span class="settings-w11-saving">Saving…</span>
              }
            </div>
            <div class="settings-w11-card-body">
              <div class="settings-w11-approval-list">
                @for (type of approvalTypes; track type.key) {
                  <div class="settings-w11-approval-row">
                    <div class="settings-w11-approval-label">
                      <strong>{{ type.label }}</strong>
                      <small>{{ type.note }}</small>
                    </div>
                    <label class="settings-w11-toggle-check" [class.on]="getPermission(type.key)" (click)="setPermission(type.key, !getPermission(type.key))">
                      <span class="toggle-indicator"></span>
                      <span>{{ getPermission(type.key) ? 'Access' : 'No Access' }}</span>
                    </label>
                  </div>
                }
              </div>
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
            </div>
            <div class="settings-w11-card-body">
              @if (employeeProjectNames().length > 0) {
                <div class="settings-w11-proj-list">
                  @for (name of employeeProjectNames(); track name) {
                    <span class="settings-w11-proj-chip">{{ name }}</span>
                  }
                </div>
              } @else {
                <p class="settings-w11-empty-hint">No projects assigned yet.</p>
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
              @if (activity().length > 0) {
                <ul class="settings-w11-activity-list">
                  @for (a of activity(); track a.id) {
                    <li>
                      <span class="dot" [class]="activityDotClass(a.action)"></span>
                      <div><strong>{{ a.description }}</strong> <small>{{ formatRelative(a.timestamp) }}</small></div>
                    </li>
                  }
                </ul>
              } @else {
                <p class="settings-w11-empty-hint">No recent activity for this employee.</p>
              }
            </div>
          </section>
        }

        @if (showSitePicker()) {
          <div class="settings-w11-picker-overlay" (click)="showSitePicker.set(false)">
            <div class="settings-w11-picker-modal" (click)="$event.stopPropagation()">
              <div class="settings-w11-picker-head">
                <h3>Assign Site</h3>
                <button type="button" class="settings-w11-chip-remove" (click)="showSitePicker.set(false)">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
              </div>
              <div class="settings-w11-picker-body">
                @if (availableSitesForSupervisor().length === 0) {
                  <p class="settings-w11-empty-hint">No sites available to assign.</p>
                } @else {
                  <div class="settings-w11-site-list">
                    @for (site of availableSitesForSupervisor(); track site.id) {
                      <button type="button" class="settings-w11-site-option" (click)="selectSiteToAssign(site)">
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5h12M2 8h12M2 11h7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                        {{ site.name }}
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .settings-w11-saving {
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 12px;
      background: #fef3c7;
      color: #92400e;
    }
    .settings-w11-picker-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .settings-w11-picker-modal {
      background: #fff;
      border-radius: 12px;
      width: 380px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    }
    .settings-w11-picker-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
    }
    .settings-w11-picker-head h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }
    .settings-w11-picker-body {
      padding: 12px;
      overflow-y: auto;
    }
    .settings-w11-site-option {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 12px;
      border: none;
      background: none;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      font-size: 14px;
      color: #374151;
      transition: background 0.15s;
    }
    .settings-w11-site-option:hover {
      background: #f3f4f6;
    }
    .settings-w11-site-option svg {
      width: 16px;
      height: 16px;
      color: #9ca3af;
      flex-shrink: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsEmployeeDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly erp = inject(ErpDataService);

  readonly activeTab = signal<"profile" | "permissions" | "projects" | "activity">("profile");
  readonly loading = signal(true);

  // Request permission control
  readonly canApproveMaterial = signal(true);
  readonly canApproveLabour = signal(true);
  readonly canApproveExpense = signal(true);
  readonly canApproveGeneral = signal(true);
  readonly canApproveSubcontract = signal(true);
  readonly canApprovePayment = signal(true);
  readonly canManageWorkers = signal(true);
  readonly canViewReports = signal(true);
  readonly permSaving = signal(false);

  // Site picker for supervisors
  readonly showSitePicker = signal(false);

  // Activity
  readonly activity = signal<ActivityEntry[]>([]);

  // Employee data
  readonly employee = signal<Employee | null>(null);

  readonly employeeProjectNames = computed<string[]>(() => {
    const emp = this.employee();
    if (!emp || !emp.projectIds.length) return [];
    const projects = this.erp.projects();
    return emp.projectIds
      .map((pid) => projects.find((p) => p.id === pid || String(p.id) === pid)?.name || pid)
      .filter(Boolean);
  });

  readonly availableSitesForSupervisor = computed<Array<{ id: string; name: string }>>(() => {
    const emp = this.employee();
    if (!emp || emp.role !== "Supervisor") return [];
    const assignedSiteIds = new Set((emp.assignedSiteIds || []).map(id => String(id)));
    const assignedSitesStr = new Set((emp.assignedSites || []).map(s => String(s)));
    const allIds = new Set([...assignedSiteIds, ...assignedSitesStr]);
    const allSites = this.erp.siteEntities();
    return allSites
      .filter((s) => {
        const siteAny = s as any;
        return !allIds.has(String(s.id)) && !allIds.has(String(siteAny._id));
      })
      .map((s) => {
        const siteAny = s as any;
        return { id: String(s.id || siteAny._id || ""), name: s.name };
      });
  });

  readonly supervisorAssignedSiteNames = computed<Array<{ id: string; name: string }>>(() => {
    const emp = this.employee();
    if (!emp || emp.role !== "Supervisor") return [];
    const allSiteIds = [
      ...(emp.assignedSiteIds || []).map(id => String(id)),
      ...(emp.assignedSites || []).map(s => String(s))
    ];
    const uniqueIds = [...new Set(allSiteIds)];
    const siteEntities = this.erp.siteEntities();
    return uniqueIds
      .map(id => {
        const site = siteEntities.find(s => {
          const siteAny = s as any;
          return String(s.id) === id ||
            String(siteAny._id) === id ||
            String(siteAny.siteId) === id;
        });
        if (!site) return null;
        const siteAny = site as any;
        return { id: String(site.id || siteAny._id || ""), name: site.name };
      })
      .filter((item): item is { id: string; name: string } => item !== null);
  });

  selectSiteToAssign(site: { id: string; name: string }) {
    const emp = this.employee();
    if (!emp || emp.role !== "Supervisor") return;

    const currentSiteIds = emp.assignedSiteIds || [];
    if (currentSiteIds.includes(site.id)) return;

    this.addSupervisorSite(site.id);
    this.showSitePicker.set(false);
  }

  readonly approvalTypes = [
    { key: "material", label: "Material Requests", note: "Cement, steel, sand, etc." },
    { key: "labour", label: "Labour Attendance", note: "Daily worker attendance entries" },
    { key: "site_expense", label: "Site Expenses", note: "Diesel, equipment, transport costs" },
    { key: "general_expense", label: "General Expenses", note: "Office supplies, miscellaneous" },
    { key: "payment", label: "Client Payments", note: "Collections from clients" },
    { key: "subcontract", label: "Subcontracts", note: "Subcontractor agreements and payments" },
  ];

  readonly approvalRights = computed<ApprovalRight[]>(() =>
    this.approvalTypes.map((t) => ({
      ...t,
      canApprove: false,
      canReject: false,
    }))
  );

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id") || "";
    this.loadSitesAndEmployee(id);
  }

  private loadSitesAndEmployee(id: string) {
    this.loading.set(true);

    // Load sites first, then load employee
    this.api.listSitesAdmin().subscribe({
      next: (res) => {
        this.erp.siteEntities.update(() => (res?.sites || []).map((s: any) => ({
          id: String(s._id || s.id),
          name: s.name || "Unnamed Site",
          status: s.status || "Active",
          projectId: s.projectId || "",
        })));
        // Now load the employee after sites are ready
        this.loadEmployeeAfterSites(id);
      },
      error: () => {
        // Continue loading employee even if sites fail
        this.loadEmployeeAfterSites(id);
      },
    });
  }

  private loadEmployeeAfterSites(id: string) {
    // Try loading as regular employee first
    this.api.getEmployee(id).subscribe({
      next: (res) => {
        const row: any = res?.employee || res;
        this.employee.set({
          id: row._id ? String(row._id) : (row.id || id),
          name: row.name || "—",
          email: row.email || "",
          phone: row.phone || "",
          role: (row.role === "admin" ? "Admin" : row.role === "project_manager" ? "Project Manager" : row.role === "accountant" ? "Accountant" : row.role === "supervisor" ? "Supervisor" : "Project Manager") as Role,
          status: (row.status || "active") as Status,
          lastLoginAt: row.lastLoginAt || "",
          createdAt: row.createdAt || "",
          projectIds: row.managedProjectIds ? row.managedProjectIds.map((id: any) => String(id)) : [],
        });
        this.loading.set(false);
        this.loadPermissions(id);
        this.loadActivity(id);
      },
      error: (err) => {
        // If regular employee not found, try loading as supervisor
        if (err?.status === 404) {
          this.loadSupervisorAfterSites(id);
        } else {
          this.employee.set(null);
          this.loading.set(false);
        }
      },
    });
  }

  private loadSupervisorAfterSites(id: string) {
    this.api.getSupervisor(id).subscribe({
      next: (res) => {
        const row = res?.supervisor;
        if (!row) {
          this.employee.set(null);
          this.loading.set(false);
          return;
        }

        const assignedSiteIds: string[] = row.assignedSiteIds ? row.assignedSiteIds.map((sid: any) => String(sid)) : [];
        const assignedSiteIdStrings: string[] = (row.assignedSites || []).map((s: any) => String(s));
        const allSiteIds = [...new Set([...assignedSiteIds, ...assignedSiteIdStrings])];

        let assignedSites: string[] = [];
        if (allSiteIds.length > 0) {
          const siteEntities = this.erp.siteEntities();
          assignedSites = allSiteIds
            .map((siteId: string) => {
              const site = siteEntities.find((s: any) =>
                String(s.id) === siteId ||
                String(s._id) === siteId ||
                String(s.siteId) === siteId
              );
              return site ? site.name : null;
            })
            .filter((name): name is string => name !== null);
        }

        this.employee.set({
          id: row._id ? String(row._id) : id,
          name: row.name || "—",
          email: row.email || "",
          phone: row.phone || "",
          role: "Supervisor",
          status: (row.status === "Active" ? "active" : row.status === "On Leave" ? "on_leave" : "inactive") as Status,
          lastLoginAt: "",
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
          projectIds: row.assignedProjectIds ? row.assignedProjectIds.map((pid: any) => String(pid)) : [],
          assignedSiteIds,
          assignedSites,
          assignedProjectIds: row.assignedProjects ? row.assignedProjects.map((pid: any) => String(pid)) : [],
        });
        this.loading.set(false);
        this.loadActivity(id);
      },
      error: () => {
        this.employee.set(null);
        this.loading.set(false);
      },
    });
  }

  addSupervisorSite(siteId: string) {
    const emp = this.employee();
    if (!emp || emp.role !== "Supervisor") return;

    const currentIds = [
      ...(emp.assignedSiteIds || []).map((id: any) => String(id)),
      ...(emp.assignedSites || []).map((s: any) => String(s))
    ];
    if (currentIds.includes(siteId)) return;

    const newSiteIds = [...new Set([...currentIds, siteId])];
    this.api.updateSupervisor(emp.id, { assignedSiteIds: newSiteIds }).subscribe({
      next: (res) => {
        const row = res?.supervisor;
        if (row) {
          const assignedSiteIds = row.assignedSiteIds ? row.assignedSiteIds.map((sid: any) => String(sid)) : [];
          const assignedSites = row.assignedSites ? row.assignedSites.map((s: any) => String(s)) : [];
          this.employee.update((e) => e ? { ...e, assignedSiteIds, assignedSites } : e);
        }
      },
      error: (err) => console.warn("[EmployeeDetail] updateSupervisor failed:", err?.message ?? err),
    });
  }

  removeSupervisorSite(siteId: string) {
    const emp = this.employee();
    if (!emp || emp.role !== "Supervisor") return;

    const currentIds = [
      ...(emp.assignedSiteIds || []).map((id: any) => String(id)),
      ...(emp.assignedSites || []).map((s: any) => String(s))
    ];
    const newSiteIds = currentIds.filter((id) => id !== siteId);

    this.api.updateSupervisor(emp.id, { assignedSiteIds: newSiteIds }).subscribe({
      next: (res) => {
        const row = res?.supervisor;
        if (row) {
          const assignedSiteIds = row.assignedSiteIds ? row.assignedSiteIds.map((sid: any) => String(sid)) : [];
          const assignedSites = row.assignedSites ? row.assignedSites.map((s: any) => String(s)) : [];
          this.employee.update((e) => e ? { ...e, assignedSiteIds, assignedSites } : e);
        }
      },
      error: (err) => console.warn("[EmployeeDetail] updateSupervisor failed:", err?.message ?? err),
    });
  }

  private loadPermissions(id: string) {
    this.api.getEmployeeRequestPermissions(id).subscribe({
      next: (prefs) => {
        this.canApproveMaterial.set(!!prefs.canApproveMaterial);
        this.canApproveLabour.set(!!prefs.canApproveLabour);
        this.canApproveExpense.set(!!prefs.canApproveExpense);
        this.canApproveGeneral.set(!!prefs.canApproveGeneral);
        this.canApproveSubcontract.set(!!prefs.canApproveSubcontract);
        this.canApprovePayment.set(!!prefs.canApprovePayment);
        this.canManageWorkers.set(!!prefs.canManageWorkers);
        this.canViewReports.set(!!prefs.canViewReports);
      },
      error: () => {
        // Fallback: keep defaults
      },
    });
  }

  private loadActivity(id: string) {
    this.api.getEmployeeActivity(id, { days: 30, limit: 30 }).subscribe({
      next: (res) => {
        this.activity.set(res?.activity || []);
      },
      error: () => {
        this.activity.set([]);
      },
    });
  }

  setPerm(key: string, value: boolean) {
    switch (key) {
      case "canApproveMaterial": this.canApproveMaterial.set(value); break;
      case "canApproveLabour": this.canApproveLabour.set(value); break;
      case "canApproveExpense": this.canApproveExpense.set(value); break;
      case "canApproveGeneral": this.canApproveGeneral.set(value); break;
      case "canApproveSubcontract": this.canApproveSubcontract.set(value); break;
      case "canApprovePayment": this.canApprovePayment.set(value); break;
      case "canManageWorkers": this.canManageWorkers.set(value); break;
      case "canViewReports": this.canViewReports.set(value); break;
    }

    const id = this.employee()?.id;
    if (!id) return;

    this.permSaving.set(true);
    this.api.saveEmployeeRequestPermissions(id, {
      canApproveMaterial: this.canApproveMaterial(),
      canApproveLabour: this.canApproveLabour(),
      canApproveExpense: this.canApproveExpense(),
      canApproveGeneral: this.canApproveGeneral(),
      canApproveSubcontract: this.canApproveSubcontract(),
      canApprovePayment: this.canApprovePayment(),
      canManageWorkers: this.canManageWorkers(),
      canViewReports: this.canViewReports(),
    }).subscribe({
      next: () => this.permSaving.set(false),
      error: () => this.permSaving.set(false),
    });
  }

  getPermission(key: string): boolean {
    switch (key) {
      case "material": return this.canApproveMaterial();
      case "labour": return this.canApproveLabour();
      case "site_expense": return this.canApproveExpense();
      case "general_expense": return this.canApproveGeneral();
      case "subcontract": return this.canApproveSubcontract();
      case "payment": return this.canApprovePayment();
      default: return false;
    }
  }

  setPermission(key: string, value: boolean) {
    switch (key) {
      case "material": this.canApproveMaterial.set(value); break;
      case "labour": this.canApproveLabour.set(value); break;
      case "site_expense": this.canApproveExpense.set(value); break;
      case "general_expense": this.canApproveGeneral.set(value); break;
      case "subcontract": this.canApproveSubcontract.set(value); break;
      case "payment": this.canApprovePayment.set(value); break;
    }

    const id = this.employee()?.id;
    if (!id) return;

    this.permSaving.set(true);
    this.api.saveEmployeeRequestPermissions(id, {
      canApproveMaterial: this.canApproveMaterial(),
      canApproveLabour: this.canApproveLabour(),
      canApproveExpense: this.canApproveExpense(),
      canApproveGeneral: this.canApproveGeneral(),
      canApproveSubcontract: this.canApproveSubcontract(),
      canApprovePayment: this.canApprovePayment(),
    }).subscribe({
      next: () => this.permSaving.set(false),
      error: () => this.permSaving.set(false),
    });
  }

  toggleRight(key: string, type: "approve" | "reject") {
    // Local toggle only (no persistence yet — backend supports it via saveEmployeePermissions)
  }

  initials(name: string): string {
    return (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }

  formatDate(iso: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  formatRelative(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const utc = d.getTime() + (5.5 * 60 * 60 * 1000);
    const istDate = new Date(utc);
    const hours = istDate.getUTCHours();
    const minutes = istDate.getUTCMinutes();
    const ampm = hours >= 12 ? "P.M" : "A.M";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes} ${ampm}`;
  }

  activityDotClass(action: string): string {
    const a = action.toLowerCase();
    if (a.includes("approve")) return "approve";
    if (a.includes("reject")) return "reject";
    if (a.includes("login") || a.includes("sign")) return "login";
    return "";
  }

  goBack() {
    this.router.navigateByUrl("/settings/roles");
  }
}
