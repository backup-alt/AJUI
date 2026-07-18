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
  supervisorId?: string;
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
                <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="openSitePicker()">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  Manage Sites
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
                <h3>Manage Assigned Sites</h3>
                <button type="button" class="settings-w11-chip-remove" (click)="showSitePicker.set(false)">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
              </div>
              <div class="settings-w11-picker-body">
                @if (allSitesForPicker().length === 0) {
                  <p class="settings-w11-empty-hint">No sites found.</p>
                } @else {
                  <div class="settings-w11-picker-list">
                    @for (site of allSitesForPicker(); track site.id) {
                      <label class="settings-w11-site-checkbox" [class.checked]="pendingSiteIds().has(site.id)">
                        <input type="checkbox" [checked]="pendingSiteIds().has(site.id)" (change)="togglePickerSite(site.id)" />
                        <span class="cb-box">
                          @if (pendingSiteIds().has(site.id)) {
                            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          }
                        </span>
                        <span class="cb-label">{{ site.name }}</span>
                      </label>
                    }
                  </div>
                }
              </div>
              <div class="settings-w11-picker-footer">
                <span class="settings-w11-picker-count">{{ pendingSiteIds().size }} site(s) selected</span>
                <div class="settings-w11-picker-actions">
                  <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="showSitePicker.set(false)">Cancel</button>
                  <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="saveSiteSelection()" [disabled]="siteSaving()">{{ siteSaving() ? 'Saving…' : 'Save' }}</button>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .settings-w11-site-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .settings-w11-site-chip {
      display: inline-flex;
      align-items: center;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 4px 8px 4px 12px;
      font-size: 13px;
      color: #374151;
      gap: 6px;
    }
    .settings-w11-chip-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: #9ca3af;
      padding: 0;
      border-radius: 50%;
      transition: background 0.2s, color 0.2s;
    }
    .settings-w11-chip-remove:hover {
      background: #e5e7eb;
      color: #ef4444;
    }
    .settings-w11-chip-remove svg {
      width: 14px;
      height: 14px;
    }
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
      border-radius: 14px;
      width: 440px;
      max-width: 92vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,0.18);
    }
    .settings-w11-picker-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 22px;
      border-bottom: 1px solid #e5e7eb;
    }
    .settings-w11-picker-head h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: #111827;
    }
    .settings-w11-picker-body {
      padding: 14px 18px;
      overflow-y: auto;
      flex: 1;
    }
    .settings-w11-picker-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 22px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      border-radius: 0 0 14px 14px;
    }
    .settings-w11-picker-count {
      font-size: 13px;
      color: #6b7280;
    }
    .settings-w11-picker-actions {
      display: flex;
      gap: 8px;
    }
    .settings-w11-picker-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .settings-w11-site-checkbox {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
      user-select: none;
    }
    .settings-w11-site-checkbox:hover {
      background: #f3f4f6;
    }
    .settings-w11-site-checkbox.checked {
      background: #eef2ff;
    }
    .settings-w11-site-checkbox input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    .settings-w11-site-checkbox .cb-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: 2px solid #d1d5db;
      border-radius: 5px;
      background: #fff;
      flex-shrink: 0;
      transition: all 0.15s;
    }
    .settings-w11-site-checkbox.checked .cb-box {
      background: #4f46e5;
      border-color: #4f46e5;
    }
    .settings-w11-site-checkbox .cb-box svg {
      width: 14px;
      height: 14px;
      color: #fff;
    }
    .settings-w11-site-checkbox .cb-label {
      font-size: 14px;
      color: #374151;
      line-height: 1.4;
    }
    .settings-w11-site-checkbox.checked .cb-label {
      color: #312e81;
      font-weight: 500;
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
  readonly pendingSiteIds = signal<Set<string>>(new Set());
  readonly siteSaving = signal(false);

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

  private annotateProject(site: any): { id: string; name: string } {
    const siteAny = site as any;
    const idStr = String(siteAny._id || siteAny.id || site.id || "");
    const projectIds: string[] = siteAny.projectIds || (siteAny.projectId ? [siteAny.projectId] : []);
    const projects = this.erp.projects();
    const projectNames = projectIds
      .map((pid: string) => projects.find((p) => p.id === pid)?.name)
      .filter(Boolean) as string[];
    const baseName = site.name || "Unnamed Site";
    const displayName = projectNames.length > 0 ? `${baseName} (${projectNames.join(", ")})` : baseName;
    return { id: idStr, name: displayName };
  }

  /** All sites for the checkbox picker — each with an id and annotated display name */
  readonly allSitesForPicker = computed<Array<{ id: string; name: string }>>(() => {
    const allSites = this.erp.siteEntities();
    return allSites.map((s) => this.annotateProject(s));
  });

  readonly supervisorAssignedSiteNames = computed<Array<{ id: string; name: string }>>(() => {
    const emp = this.employee();
    if (!emp || emp.role !== "Supervisor") return [];
    const allAssignedIds = (emp.assignedSiteIds || []).map(id => String(id));
    const uniqueIds = [...new Set(allAssignedIds)];
    const siteEntities = this.erp.siteEntities();
    const matched: Array<{ id: string; name: string }> = [];
    const matchedIds = new Set<string>();

    // Match by ObjectId/_id/siteId from assignedSiteIds
    for (const id of uniqueIds) {
      const site = siteEntities.find(s => {
        const siteAny = s as any;
        return String(s.id) === id ||
          String(siteAny._id) === id ||
          String(siteAny.siteId) === id;
      });
      if (!site) continue;
      const annotated = this.annotateProject(site);
      if (matchedIds.has(annotated.id)) continue;
      matchedIds.add(annotated.id);
      matched.push(annotated);
    }

    // For each value in assignedSites, try resolving as ObjectId first, then as name.
    const assignedSitesValues = (emp.assignedSites || []).map(s => String(s).trim()).filter(Boolean);
    for (const value of assignedSitesValues) {
      let candidates: any[] = [];
      const byId = siteEntities.find(s => {
        const siteAny = s as any;
        return String(s.id) === value ||
          String(siteAny._id) === value ||
          String(siteAny.siteId) === value;
      });
      if (byId) candidates.push(byId);
      else candidates = siteEntities.filter(s => s.name && s.name.toLowerCase() === value.toLowerCase());

      for (const site of candidates) {
        const annotated = this.annotateProject(site);
        if (matchedIds.has(annotated.id)) continue;
        matchedIds.add(annotated.id);
        matched.push(annotated);
      }
    }

    return matched;
  });

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

    // Try the admin endpoint first (returns all sites), fall back to scoped endpoint for non-admin users
    this.api.listSitesAdmin().subscribe({
      next: (res) => {
        this.populateSiteEntities(res?.sites);
        // Now load the employee after sites are ready
        this.loadEmployeeAfterSites(id);
      },
      error: () => {
        // Admin endpoint failed (likely not an admin) - try scoped endpoint
        this.api.listSites().subscribe({
          next: (res2: any) => {
            const sites = res2?.items || res2?.sites || [];
            this.populateSiteEntities(sites);
            this.loadEmployeeAfterSites(id);
          },
          error: () => {
            // Both failed - continue anyway, sites may be loaded from cache
            this.loadEmployeeAfterSites(id);
          },
        });
      },
    });
  }

  private populateSiteEntities(sites: any[]) {
    this.erp.siteEntities.update(() => (sites || []).map((s: any) => {
      const projectIds = Array.isArray(s.projectIds) ? s.projectIds : (s.projectId ? [s.projectId] : []);
      return {
        id: String(s._id || s.id),
        name: s.name || "Unnamed Site",
        status: s.status || "Active",
        projectId: projectIds[0] || "",
        projectIds,
        siteId: s.siteId,
      };
    }));
  }

  private loadEmployeeAfterSites(id: string) {
    // Try loading as regular employee first
    this.api.getEmployee(id).subscribe({
      next: (res) => {
        const row: any = res?.employee || res;
        const mappedRole = (row.role === "admin" ? "Admin" : row.role === "project_manager" ? "Project Manager" : row.role === "accountant" ? "Accountant" : row.role === "supervisor" ? "Supervisor" : "Project Manager") as Role;
        this.employee.set({
          id: row._id ? String(row._id) : (row.id || id),
          name: row.name || "—",
          email: row.email || "",
          phone: row.phone || "",
          role: mappedRole,
          status: (row.status || "active") as Status,
          lastLoginAt: row.lastLoginAt || "",
          createdAt: row.createdAt || "",
          projectIds: row.managedProjectIds ? row.managedProjectIds.map((id: any) => String(id)) : [],
        });
        this.loading.set(false);
        this.loadPermissions(id);
        this.loadActivity(id);

        // If this user is a supervisor, also fetch supervisor data to get assigned sites
        if (mappedRole === "Supervisor") {
          this.loadSupervisorSiteData(id);
        }
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

  /**
   * Fetches supervisor records and finds the one whose userId matches the given
   * User _id, then merges assignedSiteIds/assignedSites into the employee signal.
   */
  private loadSupervisorSiteData(userId: string) {
    this.api.listSupervisors({ limit: 100 }).subscribe({
      next: (res) => {
        const supervisors: any[] = res?.items || (res as any)?.supervisors || [];
        // Find the supervisor whose userId matches the current employee's User _id
        const match = supervisors.find((s: any) => {
          const supUserId = s.userId ? String(s.userId._id || s.userId) : '';
          return supUserId === userId;
        });
        if (!match) return;

        const assignedSiteIds: string[] = match.assignedSiteIds
          ? match.assignedSiteIds.map((sid: any) => this.toStringId(sid))
          : [];
        const assignedSitesRaw: string[] = (match.assignedSites || [])
          .map((s: any) => String(s))
          .filter(Boolean);

        this.employee.update((e) => e ? {
          ...e,
          supervisorId: String(match._id || match.id),
          assignedSiteIds,
          assignedSites: assignedSitesRaw,
          assignedProjectIds: match.assignedProjects
            ? match.assignedProjects.map((pid: any) => String(pid))
            : [],
        } : e);
      },
      error: () => {
        // Silently fail - sites just won't show
      },
    });
  }

  private toStringId(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val.$oid) return val.$oid;
    return String(val);
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

        const assignedSiteIds: string[] = row.assignedSiteIds ? row.assignedSiteIds.map((sid: any) => this.toStringId(sid)) : [];
        // assignedSites from the backend may contain either ObjectId strings or site names (legacy data).
        // Keep the raw values so the supervisorAssignedSiteNames computed can resolve them later
        // against siteEntities (which may not have been populated at the time of this call).
        const assignedSitesRaw: string[] = (row.assignedSites || []).map((s: any) => String(s)).filter(Boolean);

        // Try to resolve to names now if siteEntities is available; if not, the computed will handle it.
        const siteEntities = this.erp.siteEntities();
        const resolvedAssignedSites: string[] = [];
        if (siteEntities.length > 0) {
          for (const raw of assignedSitesRaw) {
            const matchByName = siteEntities.find((s: any) => s.name && s.name.toLowerCase() === raw.toLowerCase());
            if (matchByName) {
              resolvedAssignedSites.push(matchByName.name);
              continue;
            }
            const matchById = siteEntities.find((s: any) => String(s.id) === raw || String(s._id) === raw);
            if (matchById) {
              resolvedAssignedSites.push(matchById.name);
            } else {
              // Not resolvable - keep as-is (might be a name not in entities yet)
              resolvedAssignedSites.push(raw);
            }
          }
        } else {
          // siteEntities not loaded - pass through, the computed will resolve later
          resolvedAssignedSites.push(...assignedSitesRaw);
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
          supervisorId: row._id ? String(row._id) : id,
          assignedSiteIds,
          assignedSites: resolvedAssignedSites,
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

  /** Opens the site picker and initializes checkboxes from current assignments */
  openSitePicker() {
    const emp = this.employee();
    if (!emp) return;
    // Collect all currently assigned site IDs into a Set for the checkboxes
    const currentIds = new Set(
      (emp.assignedSiteIds || []).map((id: any) => this.toStringId(id))
    );
    this.pendingSiteIds.set(currentIds);
    this.showSitePicker.set(true);
  }

  /** Toggle a site's checked state in the picker */
  togglePickerSite(siteId: string) {
    this.pendingSiteIds.update(set => {
      const next = new Set(set);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  }

  /** Save the full site selection to the backend in one PATCH */
  saveSiteSelection() {
    const emp = this.employee();
    if (!emp || emp.role !== "Supervisor" || !emp.supervisorId) {
      console.warn("[EmployeeDetail] saveSiteSelection: no supervisor ID found", {
        role: emp?.role,
        supervisorId: emp?.supervisorId,
      });
      return;
    }

    const rawSiteIds = [...this.pendingSiteIds()];
    const newSiteIds = rawSiteIds.filter(id => /^[a-f0-9]{24}$/i.test(id));

    this.siteSaving.set(true);

    console.log("[EmployeeDetail] Saving site selection:", {
      supervisorId: emp.supervisorId,
      rawPendingIds: rawSiteIds,
      assignedSiteIds: newSiteIds,
    });

    this.api.updateSupervisor(emp.supervisorId, {
      assignedSiteIds: newSiteIds,
    }).subscribe({
      next: (res) => {
        console.log("[EmployeeDetail] Site update response:", res);
        const row = res?.supervisor;
        if (row) {
          const assignedSiteIds = row.assignedSiteIds
            ? row.assignedSiteIds.map((sid: any) => this.toStringId(sid))
            : [];
          const assignedSites = row.assignedSites
            ? row.assignedSites.map((s: any) => String(s))
            : [];
          this.employee.update((e) => e ? { ...e, assignedSiteIds, assignedSites } : e);
        }
        this.siteSaving.set(false);
        this.showSitePicker.set(false);
      },
      error: (err) => {
        console.error("[EmployeeDetail] saveSiteSelection FAILED:", err);
        this.siteSaving.set(false);
        alert("Failed to update sites. Check browser console for details.");
      },
    });
  }

  /** Remove a single site (convenience from the chip X button) */
  removeSupervisorSite(siteId: string) {
    const emp = this.employee();
    if (!emp || emp.role !== "Supervisor" || !emp.supervisorId) return;

    const currentSiteIds = (emp.assignedSiteIds || []).map((id: any) => this.toStringId(id));
    const newSiteIds = currentSiteIds.filter((id) => id !== siteId);

    this.api.updateSupervisor(emp.supervisorId, {
      assignedSiteIds: newSiteIds,
    }).subscribe({
      next: (res) => {
        const row = res?.supervisor;
        if (row) {
          const assignedSiteIds = row.assignedSiteIds
            ? row.assignedSiteIds.map((sid: any) => this.toStringId(sid))
            : [];
          const assignedSites = row.assignedSites
            ? row.assignedSites.map((s: any) => String(s))
            : [];
          this.employee.update((e) => e ? { ...e, assignedSiteIds, assignedSites } : e);
        }
      },
      error: (err) => console.error("[EmployeeDetail] removeSupervisorSite failed:", err),
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
