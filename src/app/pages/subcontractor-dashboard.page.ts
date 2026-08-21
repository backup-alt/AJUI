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

interface SubcontractorRow {
  id: string;
  projectId: string;
  projectName: string;
  subcontractorName: string;
  description: string;
  employeeCount?: number;
  note: string;
  address: string;
  phone: string;
  paymentMode: string;
  status: "active" | "inactive";
  totalPaid: number;
  paymentCount: number;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent],
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
                <label class="project-filter">
                  <span>Project</span>
                  <select [value]="selectedProjectId()" (change)="selectedProjectId.set($any($event.target).value)">
                    <option value="">All projects</option>
                    @for (project of projectOptions(); track project.id) {
                      <option [value]="project.id">{{ project.name }}</option>
                    }
                  </select>
                </label>
                <button type="button" class="btn-primary" (click)="openCreate()">
                  <ion-icon name="add-outline"></ion-icon>
                  New Sub-contractor
                </button>
              </div>
            </section>

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
              <table>
                <thead>
                  <tr>
                    <th>Subcontractor Name</th>
                    <th>Address</th>
                    <th>Phone No.</th>
                    <th>Payment Mode</th>
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
                      <td>{{ row.paymentMode || 'Bank Transfer' }}</td>
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
              <span>Payment Mode</span>
              <select [value]="draft().paymentMode" (change)="patchDraft('paymentMode', $any($event.target).value)" required>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="IMPS">IMPS</option>
                <option value="Cheque">Cheque</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Demand Draft">Demand Draft</option>
                <option value="Wallet">Wallet</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                [value]="draft().status"
                (change)="patchDraft('status', $any($event.target).value)"
              >
                <option value="active">Active</option>
                <option value="inactive">Not Active</option>
              </select>
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
    .subcontractors-shell { max-width: 1280px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 18px; }
    .subcontractors-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    .subcontractors-head h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; color: #0f172a; }
    .subcontractors-head p { margin: 0; color: #475569; font-size: 14px; max-width: 640px; }
    .subcontractors-actions { display: flex; align-items: flex-end; gap: 10px; }
    .project-filter { display: flex; flex-direction: column; gap: 4px; }
    .project-filter span { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .project-filter select { min-width: 210px; padding: 9px 34px 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1e293b; font-size: 13px; }
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
    .table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; }
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

    @media (max-width: 720px) {
      .subcontractors-stats { grid-template-columns: 1fr; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcontractorDashboardPage {
  readonly erp = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  readonly toastController = inject(ToastController);
  readonly formatMoney = formatMoney;

  readonly rows = signal<SubcontractorRow[]>([]);
  readonly loading = signal(false);
  readonly selectedProjectId = signal("");

  readonly projectOptions = computed(() => {
    const options = new Map<string, string>();
    for (const row of this.rows()) {
      if (!row.projectId) continue;
      const hydratedName = this.erp.projects().find((project) => String(project.id) === row.projectId)?.name;
      options.set(row.projectId, row.projectName || hydratedName || "Unnamed project");
    }
    return [...options.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredRows = computed(() => {
    const projectId = this.selectedProjectId();
    return projectId ? this.rows().filter((row) => row.projectId === projectId) : this.rows();
  });

  readonly drawerOpen = signal(false);
  readonly editing = signal<SubcontractorRow | null>(null);
  readonly saving = signal(false);
  readonly drawerError = signal<string | null>(null);

  readonly draft = signal<SubcontractorRow>(emptyDraft());

  readonly activeCount = computed(() => this.filteredRows().filter((r) => r.status === "active").length);
  readonly totalPaid = computed(() => this.filteredRows().reduce((sum, r) => sum + r.totalPaid, 0));

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
      paymentMode: d.paymentMode,
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
    projectName: "",
    subcontractorName: "",
    description: "",
    employeeCount: undefined,
    note: "",
    address: "",
    phone: "",
    paymentMode: "Bank Transfer",
    status: "active",
    totalPaid: 0,
    paymentCount: 0,
  };
}

function normalizeRow(input: any): SubcontractorRow {
  return {
    id: String(input._id || input.id || ""),
    projectId: input.projectId ? String(input.projectId) : "",
    projectName: input.projectName || "",
    subcontractorName: input.subcontractorName || input.name || "",
    description: input.description || "",
    employeeCount: input.employeeCount !== undefined && input.employeeCount !== null ? Number(input.employeeCount) : undefined,
    note: input.note || "",
    address: input.address || "",
    phone: input.phone || "",
    paymentMode: input.paymentMode || "Bank Transfer",
    status: input.status === "inactive" ? "inactive" : "active",
    totalPaid: 0,
    paymentCount: 0,
  };
}
