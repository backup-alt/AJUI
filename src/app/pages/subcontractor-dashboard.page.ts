import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { IonContent, IonIcon, IonSplitPane, ToastController } from "@ionic/angular/standalone";
import { ApiService } from "../core/api.service";
import { ErpDataService } from "../data/erp-data.service";
import { formatMoney } from "../shared/format";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { SearchableSelectComponent } from "../shared/searchable-select.component";

interface SubcontractorRow {
  id: string;
  projectId: string;
  projectIds: string[];
  projectName: string;
  subcontractorName: string;
  description: string;
  employeeCount?: number;
  note: string;
  address: string;
  phone: string;
  gstType: "GST" | "Non-GST";
  gstNumber: string;
  status: "active" | "inactive";
  totalPaid: number;
  paymentCount: number;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, SearchableSelectComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="subcontractors"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Sub contractors"
          eyebrow="Sub-contractor roster · Worker assignments"
          [showTitle]="false"
          searchPlaceholder="Search by name, note"
        />

        <ion-content class="erp-page">
          <main class="subcontractors-shell">
            <section class="subcontractors-head">
              <div>
                <h1>Sub-contractors</h1>
                <p>Click a name to open its full payment history across every project. Payments recorded here are automatically reflected in the project workspace.</p>
              </div>
              <div class="subcontractors-actions">
                <button type="button" class="btn-primary" (click)="openCreate()">
                  <ion-icon name="add-outline"></ion-icon>
                  New Sub-contractor
                </button>
              </div>
            </section>

            <div class="page-search-bar">
              <input
                type="search"
                class="seamless-search"
                placeholder="Search sub-contractors by name, phone, or note..."
                [value]="search()"
                (input)="search.set($any($event.target).value)"
              />
              <svg viewBox="0 0 24 24" class="search-icon" aria-hidden="true">
                <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>

            <section class="subcontractors-stats">
              <article class="stat-card">
                <span>Sub-contractors</span>
                <strong>{{ filteredRows().length }}</strong>
              </article>
              <article class="stat-card">
                <span>Active</span>
                <strong>{{ activeCount() }}</strong>
              </article>
              <article class="stat-card">
                <span>Total paid (workspace)</span>
                <strong>{{ formatMoney(totalPaid()) }}</strong>
              </article>
            </section>

            <section class="table-wrap">
              <div class="table-toolbar">
                <div class="table-toolbar-copy">
                  <strong>Sub-contractor directory</strong>
                  <span>{{ filteredRows().length }} {{ filteredRows().length === 1 ? 'record' : 'records' }} shown</span>
                </div>
                <div class="project-filter-wrap">
                  @if (projectFilterOpen()) {
                    <button type="button" class="filter-dismiss" aria-label="Close project filter" (click)="projectFilterOpen.set(false)"></button>
                  }
                  <button
                    type="button"
                    class="project-filter-trigger"
                    [class.open]="projectFilterOpen()"
                    [attr.aria-expanded]="projectFilterOpen()"
                    aria-haspopup="listbox"
                    (click)="projectFilterOpen.set(!projectFilterOpen())"
                  >
                    <span class="filter-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M7 12h10M10 19h4"/></svg>
                    </span>
                    <span class="filter-copy"><small>Filter by project</small><strong>{{ selectedProjectName() }}</strong></span>
                    <svg class="filter-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
                  </button>
                  @if (projectFilterOpen()) {
                    <div class="project-filter-menu" role="listbox" aria-label="Filter sub-contractors by project">
                      <button type="button" role="option" [attr.aria-selected]="!selectedProjectId()" [class.selected]="!selectedProjectId()" (click)="selectProject('')">
                        <span class="project-option-icon">A</span>
                        <span><strong>All projects</strong><small>Show the complete directory</small></span>
                        @if (!selectedProjectId()) { <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg> }
                      </button>
                      @for (project of projectOptions(); track project.id) {
                        <button type="button" role="option" [attr.aria-selected]="selectedProjectId() === project.id" [class.selected]="selectedProjectId() === project.id" (click)="selectProject(project.id)">
                          <span class="project-option-icon">{{ project.name.slice(0, 1).toUpperCase() }}</span>
                          <span><strong>{{ project.name }}</strong><small>Show assigned sub-contractors</small></span>
                          @if (selectedProjectId() === project.id) { <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg> }
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
              <div class="table-scroll">
                <table>
                <thead>
                  <tr>
                    <th>Subcontractor Name</th>
                    <th>Address</th>
                    <th>Phone No.</th>
                    <th>GST</th>
                    <th>Total Paid</th>
                    <th>Note</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredRows(); track row.id) {
                    <tr [class.inactive]="row.status === 'inactive'" (click)="openDetails(row)" style="cursor:pointer;">
                      <td>
                        <a class="name-link" [routerLink]="['/subcontractors', row.id]" (click)="$event.stopPropagation()">{{ row.subcontractorName }}</a>
                      </td>
                      <td>{{ row.address || '—' }}</td>
                      <td>{{ row.phone || '—' }}</td>
                      <td>{{ row.gstType === 'GST' ? (row.gstNumber || '—') : 'No GST' }}</td>
                      <td>{{ formatMoney(row.totalPaid) }}</td>
                      <td>{{ row.note || '—' }}</td>
                      <td>
                        <span class="status-pill" [class.active]="row.status === 'active'" [class.inactive]="row.status === 'inactive'">
                          {{ row.status === 'active' ? 'Active' : 'Not Active' }}
                        </span>
                      </td>
                      <td class="row-actions">
                        <button type="button" class="icon-btn" aria-label="Edit" title="Edit sub-contractor" (click)="openEdit(row, $event)">
                          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path d="M4 20h4.2l11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="m14.8 7.2 3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  }
                  @if (filteredRows().length === 0) {
                    <tr>
                      <td colspan="8" class="empty-row">{{ selectedProjectId() ? 'No sub-contractors are assigned to this project.' : 'No sub-contractors yet. Click "New Sub-contractor" to add one.' }}</td>
                    </tr>
                  }
                </tbody>
                </table>
              </div>
            </section>
          </main>
        </ion-content>
      </div>

      @if (drawerOpen()) {
        <div class="drawer-backdrop" (click)="closeDrawer()" aria-hidden="true"></div>
        <aside class="drawer" role="dialog" aria-label="Sub-contractor form">
          <header class="drawer-head">
            <h2>{{ editing() ? 'Edit sub-contractor' : 'New sub-contractor' }}</h2>
            <button type="button" class="icon-btn" aria-label="Close" (click)="closeDrawer()">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </header>
          <form class="drawer-body" (submit)="$event.preventDefault(); saveDrawer()">
            <label>
              <span>Subcontractor's name *</span>
              <input
                type="text"
                required
                [value]="draft().subcontractorName"
                (input)="patchDraft('subcontractorName', $any($event.target).value)"
                placeholder="e.g. Lakshmi Electricals"
              />
            </label>
            <label>
              <span>Address</span>
              <textarea
                rows="2"
                [value]="draft().address"
                (input)="patchDraft('address', $any($event.target).value)"
                placeholder="Office address"
              ></textarea>
            </label>
            <label>
              <span>Phone no</span>
              <input
                type="tel"
                [value]="draft().phone"
                (input)="patchDraft('phone', $any($event.target).value)"
                placeholder="+91 90000 00000"
              />
            </label>
            <label>
              <span>Notes</span>
              <textarea
                rows="3"
                [value]="draft().note"
                (input)="patchDraft('note', $any($event.target).value)"
                placeholder="Any extra detail about this sub-contractor (work scope, terms, contacts, etc.)"
              ></textarea>
            </label>
            <label>
              <span>GST Registration</span>
              <span class="gst-toggle" role="group" aria-label="GST registration">
                <button type="button" [class.active]="draft().gstType === 'GST'" (click)="patchDraft('gstType', 'GST')">GST</button>
                <button type="button" [class.active]="draft().gstType === 'Non-GST'" (click)="patchDraft('gstType', 'Non-GST'); patchDraft('gstNumber', '')">Non-GST</button>
              </span>
            </label>
            @if (draft().gstType === 'GST') {
              <label>
                <span>GST Number</span>
                <input [value]="draft().gstNumber" (input)="patchDraft('gstNumber', $any($event.target).value)" placeholder="33AABCS1402P1Z8" />
              </label>
            }
            <label>
              <span>Status</span>
              <agb-searchable-select [value]="draft().status" [options]="statusOptions" (valueChange)="patchDraft('status', $any($event))" />
            </label>

            @if (drawerError()) {
              <p class="drawer-error">{{ drawerError() }}</p>
            }

            <footer class="drawer-foot">
              <button type="button" class="btn-ghost" (click)="closeDrawer()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="saving()">
                {{ saving() ? 'Saving…' : (editing() ? 'Save changes' : 'Create sub-contractor') }}
              </button>
            </footer>
          </form>
        </aside>
      }
    </ion-split-pane>
  `,
  styles: [`
    .page-search-bar {
      position: relative;
      max-width: 600px;
      margin: 0 auto 16px;
    }
    .seamless-search {
      width: 100%;
      padding: 12px 16px 12px 44px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      font-size: 15px;
      background: #fff;
      transition: all 0.2s ease;
    }
    .seamless-search:focus {
      outline: none;
      border-color: #002263;
      box-shadow: 0 0 0 3px rgba(0, 34, 99, 0.1);
    }
    .search-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      color: #9ca3af;
      pointer-events: none;
    }
    .subcontractors-shell { max-width: 1280px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 18px; }
    .subcontractors-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    .subcontractors-head h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; color: #0f172a; }
    .subcontractors-head p { margin: 0; color: #475569; font-size: 14px; max-width: 640px; }
    .subcontractors-actions { display: flex; align-items: flex-end; gap: 10px; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 16px; background: #002263; color: #fff;
      border: none; border-radius: 8px; font-weight: 700; cursor: pointer;
    }
    .btn-primary:hover { background: #001a4d; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-ghost {
      padding: 9px 16px; background: #f1f5f9; color: #1e293b;
      border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 600; cursor: pointer;
    }
    .subcontractors-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .stat-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;
    }
    .stat-card span { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .stat-card strong { font-size: 20px; color: #0f172a; }
    .table-wrap { background: #fff; border: 1px solid #dbe3ef; border-radius: 14px; overflow: visible; box-shadow: 0 4px 16px rgba(15, 23, 42, .035); }
    .table-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 72px; padding: 12px 14px 12px 16px; border-bottom: 1px solid #e2e8f0; border-radius: 14px 14px 0 0; background: linear-gradient(180deg, #fff 0%, #fbfdff 100%); }
    .table-toolbar-copy { display: grid; gap: 3px; }
    .table-toolbar-copy strong { color: #0f172a; font-size: 14px; }
    .table-toolbar-copy span { color: #64748b; font-size: 11px; }
    .project-filter-wrap { position: relative; z-index: 12; width: min(310px, 100%); }
    .filter-dismiss { position: fixed; z-index: 1; inset: 0; padding: 0; border: 0; background: transparent; cursor: default; }
    .project-filter-trigger { position: relative; z-index: 2; display: grid; grid-template-columns: 34px minmax(0, 1fr) 16px; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 11px 6px 8px; border: 1px solid #cbd5e1; border-radius: 11px; background: #fff; color: #1e293b; text-align: left; cursor: pointer; transition: border-color .16s ease, box-shadow .16s ease, background .16s ease; }
    .project-filter-trigger:hover { border-color: #94a3b8; background: #f8fafc; }
    .project-filter-trigger.open { border-color: #174ea6; box-shadow: 0 0 0 3px rgba(23, 78, 166, .11); }
    .filter-icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9px; background: #eef4ff; color: #174ea6; }
    .filter-icon svg, .filter-chevron, .project-filter-menu svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .filter-copy { display: grid; min-width: 0; gap: 2px; }
    .filter-copy small { color: #64748b; font-size: 9px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
    .filter-copy strong { overflow: hidden; color: #0f172a; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .filter-chevron { color: #64748b; transition: transform .16s ease; }
    .project-filter-trigger.open .filter-chevron { transform: rotate(180deg); }
    .project-filter-menu { position: absolute; z-index: 3; top: calc(100% + 7px); right: 0; width: 100%; max-height: 310px; overflow-y: auto; padding: 6px; border: 1px solid #dbe3ef; border-radius: 12px; background: #fff; box-shadow: 0 18px 45px rgba(15, 23, 42, .17); animation: filter-menu-in .14s ease-out; }
    @keyframes filter-menu-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .project-filter-menu button { display: grid; grid-template-columns: 32px minmax(0, 1fr) 16px; align-items: center; gap: 9px; width: 100%; min-height: 48px; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: #334155; text-align: left; cursor: pointer; }
    .project-filter-menu button:hover { background: #f8fafc; }
    .project-filter-menu button.selected { background: #eef4ff; color: #174ea6; }
    .project-filter-menu button > span:nth-child(2) { display: grid; min-width: 0; gap: 2px; }
    .project-filter-menu button strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .project-filter-menu button small { color: #64748b; font-size: 9px; }
    .project-option-icon { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 800; }
    .project-filter-menu button.selected .project-option-icon { background: #dbe8ff; color: #174ea6; }
    .table-scroll { overflow-x: auto; border-radius: 0 0 14px 14px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 14px; text-align: left; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 13px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr.inactive td { color: #94a3b8; }
    .status-pill { display: inline-flex; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .status-pill.active { background: rgba(16, 185, 129, 0.14); color: #047857; }
    .status-pill.inactive { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
    .row-actions { display: flex; gap: 6px; justify-content: center; }
    .name-link { color: #002263; font-weight: 700; text-decoration: none; }
    .name-link:hover { text-decoration: underline; }
    .icon-btn {
      width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #475569;
      cursor: pointer;
    }
    .icon-btn:hover { background: #f1f5f9; color: #1e293b; }
    .icon-btn.danger { color: #b91c1c; }
    .icon-btn.danger:hover { background: #fee2e2; }
    .empty-row { text-align: center; padding: 32px; color: #94a3b8; }

    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 100; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(440px, 100vw); background: #fff;
      box-shadow: -8px 0 30px rgba(15, 23, 42, 0.16);
      display: flex; flex-direction: column; z-index: 101;
    }
    .drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
    .drawer-head h2 { margin: 0; font-size: 18px; color: #0f172a; }
    .drawer-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1; }
    .drawer-body label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #1e293b; }
    .drawer-body label > span { font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .drawer-body input, .drawer-body textarea, .drawer-body select {
      padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 14px; color: #0f172a; background: #fff;
    }
    .drawer-body input:focus, .drawer-body textarea:focus, .drawer-body select:focus {
      outline: none; border-color: #002263; box-shadow: 0 0 0 3px rgba(0, 34, 99, 0.12);
    }
    .drawer-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
    .drawer-error { color: #b91c1c; font-size: 13px; margin: 0; }
    .gst-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 3px; border: 1px solid #cbd5e1; border-radius: 9px; background: #f8fafc; }
    .gst-toggle button { min-height: 34px; border: 0; border-radius: 6px; background: transparent; color: #64748b; font: inherit; font-weight: 700; cursor: pointer; }
    .gst-toggle button.active { background: #0f3b82; color: #fff; box-shadow: 0 1px 3px rgba(15, 23, 42, .16); }

    @media (max-width: 720px) {
      .subcontractors-stats { grid-template-columns: 1fr; }
      .table-toolbar { align-items: stretch; flex-direction: column; }
      .project-filter-wrap { width: 100%; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcontractorDashboardPage {
  readonly statusOptions = [
    { label: "Active", value: "active" },
    { label: "Not Active", value: "inactive" },
  ];
  readonly erp = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  readonly toastController = inject(ToastController);
  readonly formatMoney = formatMoney;

  readonly rows = signal<SubcontractorRow[]>([]);
  readonly loading = signal(false);
  readonly search = signal("");
  readonly selectedProjectId = signal("");
  readonly projectFilterOpen = signal(false);

  readonly projectOptions = computed(() => {
    const options = new Map<string, string>();
    for (const project of this.erp.projects()) {
      const id = String((project as any).id || (project as any)._id || "");
      if (id) options.set(id, project.name || "Unnamed project");
    }
    for (const row of this.rows()) {
      if (!row.projectId) continue;
      const hydratedName = this.erp.projects().find((project) => String(project.id) === row.projectId)?.name;
      if (!options.has(row.projectId)) options.set(row.projectId, row.projectName || hydratedName || "Unnamed project");
    }
    return [...options.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredRows = computed(() => {
    const projectId = this.selectedProjectId();
    const searchTerm = this.search().toLowerCase().trim();

    let filtered = projectId
      ? this.rows().filter((row) => row.projectId === projectId || row.projectIds.includes(projectId))
      : this.rows();

    if (searchTerm) {
      filtered = filtered.filter(row =>
        row.subcontractorName.toLowerCase().includes(searchTerm) ||
        row.phone.toLowerCase().includes(searchTerm) ||
        row.note.toLowerCase().includes(searchTerm) ||
        row.address.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  });

  readonly selectedProjectName = computed(() => {
    const projectId = this.selectedProjectId();
    return projectId
      ? this.projectOptions().find((project) => project.id === projectId)?.name || "Selected project"
      : "All projects";
  });

  readonly drawerOpen = signal(false);
  readonly editing = signal<SubcontractorRow | null>(null);
  readonly saving = signal(false);
  readonly drawerError = signal<string | null>(null);

  readonly draft = signal<SubcontractorRow>(emptyDraft());

  readonly activeCount = computed(() => this.filteredRows().filter((r) => r.status === "active").length);
  readonly totalPaid = computed(() => this.filteredRows().reduce((sum, r) => sum + r.totalPaid, 0));

  selectProject(projectId: string) {
    this.selectedProjectId.set(projectId);
    this.projectFilterOpen.set(false);
  }

  constructor() {
    this.refresh();
  }

  refresh() {
    if (this.loading()) return;
    this.loading.set(true);
    // Fire two parallel requests: list of sub-contractors + workspace
    // total paid (sum of every payment across every project).
    this.api.listSubcontractors({ limit: 500, page: 1 }).subscribe({
      next: (res) => {
        const rows = (res.items || []).map((r: any) => normalizeRow(r));
        this.rows.set(rows);
        this.loading.set(false);
        this.hydrateTotals(rows);
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * Fetch the workspace-wide payment total once, then per-sub-contractor
   * totals in parallel. We don't get per-sub totals from the rollup
   * endpoint, so we ask each sub for its own summary.
   */
  private hydrateTotals(rows: SubcontractorRow[]) {
    if (!rows.length) return;
    for (const row of rows) {
      this.api.getSubcontractorPaymentSummary(row.id).subscribe({
        next: (s) => {
          this.rows.update((current) =>
            current.map((r) =>
              r.id === row.id
                ? { ...r, totalPaid: Number(s?.totalPaid) || 0, paymentCount: Number(s?.recordCount) || 0 }
                : r
            )
          );
        },
      });
    }
  }

  // ---------- ROUTING ----------
  openDetails(row: SubcontractorRow) {
    void this.router.navigate(["/subcontractors", row.id]);
  }

  // ---------- DRAWER (create/edit) ----------
  openCreate() {
    this.editing.set(null);
    const firstProject = this.erp.projects()[0]?.id ?? "";
    this.draft.set({
      ...emptyDraft(),
      projectId: firstProject,
    });
    this.drawerError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(row: SubcontractorRow, event?: Event) {
    event?.stopPropagation();
    this.editing.set(row);
    this.draft.set({ ...row });
    this.drawerError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.editing.set(null);
    this.draft.set(emptyDraft());
    this.drawerError.set(null);
  }

  patchDraft<K extends keyof SubcontractorRow>(key: K, value: SubcontractorRow[K] | undefined) {
    const next = { ...this.draft() };
    if (value === undefined) {
      delete (next as any)[key];
    } else {
      (next as any)[key] = value;
    }
    this.draft.set(next);
  }

  async saveDrawer() {
    const d = this.draft();
    if (!d.subcontractorName.trim()) {
      this.drawerError.set("Subcontractor's name is required.");
      return;
    }
    if (!d.projectId) {
      this.drawerError.set("Pick a project for this sub-contractor.");
      return;
    }
    const gstNumber = d.gstNumber.trim().toUpperCase();
    if (d.gstType === "GST" && !gstNumber) {
      this.drawerError.set("GST number is required when GST is selected.");
      return;
    }
    this.saving.set(true);
    this.drawerError.set(null);
    const payload = {
      projectId: d.projectId,
      subcontractorName: d.subcontractorName.trim(),
      description: d.description,
      employeeCount: d.employeeCount,
      note: d.note,
      address: d.address,
      phone: d.phone,
      gstType: d.gstType,
      gstNumber: d.gstType === "GST" ? gstNumber : "",
      status: d.status,
    };
    const editing = this.editing();
    const req = editing
      ? this.api.patchSubcontractor(editing.id, payload)
      : this.api.createSubcontractor(payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDrawer();
        this.refresh();
        this.presentToast(editing ? "Sub-contractor updated." : "Sub-contractor created.");
      },
      error: (err) => {
        this.saving.set(false);
        this.drawerError.set(err?.error?.error || err?.error?.message || err?.message || "Could not save.");
      },
    });
  }

  private async presentToast(message: string) {
    const toast = await this.toastController.create({ message, duration: 2500, position: "top" });
    await toast.present();
  }
}

function emptyDraft(): SubcontractorRow {
  return {
    id: "",
    projectId: "",
    projectIds: [],
    projectName: "",
    subcontractorName: "",
    description: "",
    employeeCount: undefined,
    note: "",
    address: "",
    phone: "",
    gstType: "Non-GST",
    gstNumber: "",
    status: "active",
    totalPaid: 0,
    paymentCount: 0,
  };
}

function normalizeRow(input: any): SubcontractorRow {
  return {
    id: String(input._id || input.id || ""),
    projectId: input.projectId ? String(input.projectId) : "",
    projectIds: Array.isArray(input.projectIds)
      ? input.projectIds.map((projectId: unknown) => String(projectId))
      : (input.projectId ? [String(input.projectId)] : []),
    projectName: input.projectName || "",
    subcontractorName: input.subcontractorName || input.name || "",
    description: input.description || "",
    employeeCount: input.employeeCount !== undefined && input.employeeCount !== null ? Number(input.employeeCount) : undefined,
    note: input.note || "",
    address: input.address || "",
    phone: input.phone || "",
    gstType: input.gstType === "GST" ? "GST" : "Non-GST",
    gstNumber: input.gstType === "GST" ? (input.gstNumber || "") : "",
    status: input.status === "inactive" ? "inactive" : "active",
    totalPaid: 0,
    paymentCount: 0,
  };
}
