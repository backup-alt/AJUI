import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { IonContent, IonIcon, IonSplitPane, IonSpinner, ToastController } from "@ionic/angular/standalone";
import { ApiService, SubcontractorPayment } from "../core/api.service";
import { ErpDataService } from "../data/erp-data.service";
import { formatMoney } from "../shared/format";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, IonIcon, IonSplitPane, IonSpinner, EnterpriseHeaderComponent, EnterpriseSidebarComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="subcontractors"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          [title]="subcontractorName() || 'Sub-contractor'"
          eyebrow="Payment history across every project and site"
          [showTitle]="false"
        />

        <ion-content class="erp-page">
          <main class="detail-shell">
            <nav class="breadcrumb">
              <a [routerLink]="['/subcontractors']">&larr; All sub-contractors</a>
            </nav>

            @if (loading()) {
              <div class="loading-banner"><ion-spinner name="dots"></ion-spinner> Loading sub-contractor…</div>
            } @else if (loadError()) {
              <div class="error-banner">{{ loadError() }}</div>
            } @else if (!subcontractor()) {
              <div class="empty-banner">Sub-contractor not found.</div>
            } @else {
              <header class="detail-head">
                <div>
                  <h1>{{ subcontractor()!.subcontractorName }}</h1>
                  @if (subcontractor()!.address) {
                    <p class="detail-meta"><ion-icon name="location-outline"></ion-icon>{{ subcontractor()!.address }}</p>
                  }
                  @if (subcontractor()!.phone) {
                    <p class="detail-meta"><ion-icon name="call-outline"></ion-icon>{{ subcontractor()!.phone }}</p>
                  }
                  <p class="detail-status">
                    <span class="status-pill" [class.active]="subcontractor()!.status === 'active'" [class.inactive]="subcontractor()!.status === 'inactive'">
                      {{ subcontractor()!.status === 'active' ? 'Active' : 'Not Active' }}
                    </span>
                  </p>
                </div>
                <div class="detail-head-actions">
                  <a class="btn-ghost" [routerLink]="['/subcontractors']">Back</a>
                  <button type="button" class="btn-primary" (click)="openRecordPayment()" [disabled]="!canRecordPayment()">
                    <ion-icon name="add-outline"></ion-icon>
                    Record payment
                  </button>
                </div>
              </header>

              <section class="stats">
                <article class="stat-card">
                  <span>Total Paid</span>
                  <strong>{{ formatMoney(summary()?.totalPaid ?? 0) }}</strong>
                </article>
                <article class="stat-card">
                  <span>Records</span>
                  <strong>{{ summary()?.recordCount ?? 0 }}</strong>
                </article>
                <article class="stat-card">
                  <span>Projects</span>
                  <strong>{{ summary()?.projectCount ?? 0 }}</strong>
                </article>
                <article class="stat-card">
                  <span>Sites</span>
                  <strong>{{ summary()?.siteCount ?? 0 }}</strong>
                </article>
              </section>

              <section class="filters">
                <label class="filter-field">
                  <span>Project</span>
                  <select [ngModel]="filterProjectId()" (ngModelChange)="onProjectFilterChange($event)">
                    <option value="">All projects</option>
                    @for (p of availableProjects(); track p.id) {
                      <option [value]="p.id">{{ p.name }}</option>
                    }
                  </select>
                </label>
                <label class="filter-field">
                  <span>Site</span>
                  @if (!filterProjectId()) {
                    <select disabled>
                      <option>Select a project</option>
                    </select>
                  } @else {
                    <select [ngModel]="filterSiteId()" (ngModelChange)="filterSiteId.set($event)">
                      <option value="">All sites in this project</option>
                      @for (s of availableSites(); track s.id) {
                        <option [value]="s.id">{{ s.name }}</option>
                      }
                    </select>
                  }
                </label>
              </section>

              <section class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Project</th>
                      <th>Site</th>
                      <th>Description</th>
                      <th>Employees</th>
                      <th>Amount</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of filteredPayments(); track p._id) {
                      <tr>
                        <td>{{ p.date }}</td>
                        <td>{{ p.projectName }}</td>
                        <td>{{ p.siteName || '—' }}</td>
                        <td class="wrap">{{ p.description || '—' }}</td>
                        <td>{{ p.employeeCount }}</td>
                        <td>{{ formatMoney(p.amount) }}</td>
                        <td class="wrap">{{ p.notes || '—' }}</td>
                        <td class="row-actions">
                          <button type="button" class="icon-btn" aria-label="Edit" title="Edit payment" (click)="openEditPayment(p)">
                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                              <path d="M4 20h4.2l11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                              <path d="m14.8 7.2 3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                          </button>
                          <button type="button" class="icon-btn danger" aria-label="Delete" title="Delete payment" (click)="deletePayment(p)">
                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                              <path d="M5 7h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                              <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
                              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
                              <path d="M10 11v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                              <path d="M14 11v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    }
                    @if (filteredPayments().length === 0) {
                      <tr>
                        <td colspan="8" class="empty-row">No payments recorded for this sub-contractor yet.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </section>
            }
          </main>
        </ion-content>
      </div>

      @if (paymentDialogOpen()) {
        <div class="drawer-backdrop" (click)="closePaymentDialog()" aria-hidden="true"></div>
        <aside class="drawer" role="dialog" aria-label="Record sub-contractor payment">
          <header class="drawer-head">
            <h2>{{ editingPayment() ? 'Edit payment' : 'Record payment' }} — {{ subcontractorName() }}</h2>
            <button type="button" class="icon-btn" aria-label="Close" (click)="closePaymentDialog()">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </header>
          <form class="drawer-body" (submit)="$event.preventDefault(); savePayment()">
            <label>
              <span>Project *</span>
              <select
                required
                [ngModel]="paymentDraft().projectId"
                (ngModelChange)="onPaymentProjectChange($event)"
                name="projectId"
              >
                <option value="">Select a project</option>
                @for (p of allProjects(); track p.id) {
                  <option [value]="p.id">{{ p.name }}</option>
                }
              </select>
            </label>

            <label>
              <span>Site *</span>
              <select
                required
                [ngModel]="paymentDraft().siteId"
                (ngModelChange)="updatePaymentDraft('siteId', $event)"
                name="siteId"
                [disabled]="!paymentDraft().projectId"
              >
                <option value="">Select a site</option>
                @for (s of paymentDraftSites(); track s) {
                  <option [value]="s.id">{{ s.name }}</option>
                }
              </select>
            </label>

            <label>
              <span>Date *</span>
              <input
                type="date"
                required
                [ngModel]="paymentDraft().date"
                (ngModelChange)="updatePaymentDraft('date', $event)"
                name="date"
              />
            </label>

            <label>
              <span>Description *</span>
              <input
                type="text"
                required
                placeholder="e.g. Masonry work"
                [ngModel]="paymentDraft().description"
                (ngModelChange)="updatePaymentDraft('description', $event)"
                name="description"
              />
            </label>

            <div class="grid-2">
              <label>
                <span>Number of employees *</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  [ngModel]="paymentDraft().employeeCount"
                  (ngModelChange)="updatePaymentDraft('employeeCount', +$event || 1)"
                  name="employeeCount"
                />
              </label>
              <label>
                <span>Amount (₹) *</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  [ngModel]="paymentDraft().amount"
                  (ngModelChange)="updatePaymentDraft('amount', +$event || 0)"
                  name="amount"
                />
              </label>
            </div>

            <label>
              <span>Notes</span>
              <textarea
                rows="2"
                placeholder="Optional"
                [ngModel]="paymentDraft().notes"
                (ngModelChange)="updatePaymentDraft('notes', $event)"
                name="notes"
              ></textarea>
            </label>

            @if (paymentError()) {
              <p class="drawer-error">{{ paymentError() }}</p>
            }

            <footer class="drawer-foot">
              <button type="button" class="btn-ghost" (click)="closePaymentDialog()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="paymentSaving()">
                {{ paymentSaving() ? 'Saving…' : (editingPayment() ? 'Save changes' : 'Record payment') }}
              </button>
            </footer>
          </form>
        </aside>
      }
    </ion-split-pane>
  `,
  styles: [`
    .detail-shell { max-width: 1280px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 18px; }
    .breadcrumb { display: flex; gap: 8px; align-items: center; }
    .breadcrumb a { color: #002263; font-size: 13px; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; padding: 8px 0 4px; border-bottom: 1px solid #e2e8f0; }
    .detail-head h1 { margin: 0 0 6px; font-size: 26px; color: #0f172a; }
    .detail-meta { margin: 0 0 4px; color: #475569; font-size: 13px; display: flex; align-items: center; gap: 6px; }
    .detail-meta ion-icon { font-size: 16px; color: #64748b; }
    .detail-status { margin: 6px 0 0; }
    .detail-head-actions { display: flex; gap: 8px; align-items: center; }
    .status-pill { display: inline-flex; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .status-pill.active { background: rgba(16, 185, 129, 0.14); color: #047857; }
    .status-pill.inactive { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }

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
      text-decoration: none; display: inline-flex; align-items: center;
    }

    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;
    }
    .stat-card span { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .stat-card strong { font-size: 20px; color: #0f172a; }

    .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 720px; }
    .filter-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #1e293b; }
    .filter-field span { font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
    .filter-field select {
      padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 14px; color: #0f172a; background: #fff;
    }

    .table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 14px; text-align: left; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 13px; vertical-align: middle; max-width: 280px; }
    td.wrap { word-break: break-word; white-space: pre-wrap; }
    tr:last-child td { border-bottom: none; }
    .row-actions { display: flex; gap: 6px; justify-content: flex-end; }
    .icon-btn {
      width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #475569;
      cursor: pointer;
    }
    .icon-btn:hover { background: #f1f5f9; color: #1e293b; }
    .icon-btn.danger { color: #b91c1c; }
    .icon-btn.danger:hover { background: #fee2e2; }
    .empty-row { text-align: center; padding: 32px; color: #94a3b8; }
    .loading-banner, .error-banner { padding: 14px 18px; border-radius: 8px; }
    .loading-banner { background: #eef4ff; color: #002263; display: flex; align-items: center; gap: 8px; }
    .error-banner, .empty-banner { background: #fee2e2; color: #b91c1c; }

    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 100; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(440px, 100vw); background: #fff;
      box-shadow: -8px 0 30px rgba(15, 23, 42, 0.16);
      display: flex; flex-direction: column; z-index: 101;
    }
    .drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
    .drawer-head h2 { margin: 0; font-size: 16px; color: #0f172a; }
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
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    @media (max-width: 720px) {
      .stats { grid-template-columns: 1fr 1fr; }
      .filters { grid-template-columns: 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcontractorDetailsPage {
  readonly api = inject(ApiService);
  readonly erp = inject(ErpDataService);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly toastController = inject(ToastController);
  readonly formatMoney = formatMoney;

  readonly subcontractor = signal<any | null>(null);
  readonly payments = signal<SubcontractorPayment[]>([]);
  readonly summary = signal<{ totalPaid: number; recordCount: number; projectCount: number; siteCount: number } | null>(null);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly filterProjectId = signal<string>("");
  readonly filterSiteId = signal<string>("");

  readonly paymentDialogOpen = signal(false);
  readonly editingPayment = signal<SubcontractorPayment | null>(null);
  readonly paymentSaving = signal(false);
  readonly paymentError = signal<string | null>(null);
  readonly paymentDraft = signal<{
    projectId: string;
    siteId: string;
    date: string;
    description: string;
    employeeCount: number;
    amount: number;
    notes: string;
  }>(emptyPaymentDraft());

  readonly allProjects = computed(() => {
    const user = this.api.user();
    const all = this.erp.projects();
    if (!user) return all;
    if (user.role === "project_manager" || user.role === "accountant") {
      const managed = user.managedProjectIds || [];
      if (managed.length === 0) return all.filter((p) => false);
      return all.filter((p) => managed.includes(p.id));
    }
    return all;
  });

  readonly availableProjects = computed(() => this.allProjects());

  readonly availableSites = computed(() => {
    const projectId = this.filterProjectId();
    if (!projectId) return [] as { id: string; name: string }[];
    return this.sitesForProject(projectId);
  });

  readonly filteredPayments = computed(() => {
    const projectId = this.filterProjectId();
    const siteId = this.filterSiteId();
    return this.payments().filter((p) => {
      if (projectId && p.projectId !== projectId) return false;
      if (siteId && String(p.siteId || "") !== siteId) return false;
      return true;
    });
  });

  readonly subcontractorName = computed(() => this.subcontractor()?.subcontractorName || "");

  readonly canRecordPayment = computed(() => this.allProjects().length > 0);

  readonly paymentDraftSites = computed(() => this.sitesForProject(this.paymentDraft().projectId));

  /** Resolve a project's site names to { id, name } using the site entities. */
  private sitesForProject(projectId: string): { id: string; name: string }[] {
    if (!projectId) return [];
    const project = this.allProjects().find((p) => p.id === projectId);
    if (!project) return [];
    return (project.sites || []).map((s) => {
      const id = this.erp.siteEntities().find((se) => se.name === s)?._id || s;
      return { id: String(id), name: String(s) };
    });
  }

  private get subcontractorId(): string {
    return this.route.snapshot.paramMap.get("id") || "";
  }

  constructor() {
    this.load();
  }

  load() {
    const id = this.subcontractorId;
    if (!id) {
      this.loading.set(false);
      this.loadError.set("Missing sub-contractor id.");
      return;
    }
    this.loading.set(true);
    this.api.listSubcontractors({ limit: 500, page: 1 }).subscribe({
      next: (res) => {
        const found = (res.items || []).find((r: any) => String(r._id) === id);
        if (!found) {
          this.subcontractor.set(null);
          this.loading.set(false);
          this.loadError.set(null);
          return;
        }
        this.subcontractor.set(found);
        this.loading.set(false);
        this.loadError.set(null);
        this.refreshPayments();
      },
      error: (err) => {
        this.loadError.set(err?.error?.error || err?.message || "Failed to load sub-contractor.");
        this.loading.set(false);
      },
    });
  }

  refreshPayments() {
    const id = this.subcontractorId;
    if (!id) return;
    this.api.listSubcontractorPayments({ subcontractorId: id, limit: 500 }).subscribe({
      next: (res) => {
        this.payments.set(res.items || []);
        this.api.getSubcontractorPaymentSummary(id).subscribe({
          next: (s) => this.summary.set(s),
          error: () => this.summary.set({ totalPaid: 0, recordCount: 0, projectCount: 0, siteCount: 0 }),
        });
      },
      error: () => this.payments.set([]),
    });
  }

  // ---------- FILTERS ----------
  onProjectFilterChange(value: string) {
    this.filterProjectId.set(value);
    this.filterSiteId.set("");
  }

  // ---------- PAYMENT DIALOG ----------
  openRecordPayment() {
    if (!this.canRecordPayment()) return;
    this.editingPayment.set(null);
    this.paymentDraft.set(emptyPaymentDraft());
    this.paymentError.set(null);
    this.paymentDialogOpen.set(true);
  }

  openEditPayment(p: SubcontractorPayment) {
    this.editingPayment.set(p);
    this.paymentDraft.set({
      projectId: p.projectId,
      siteId: p.siteId || "",
      date: p.date,
      description: p.description,
      employeeCount: p.employeeCount,
      amount: p.amount,
      notes: p.notes || "",
    });
    this.paymentError.set(null);
    this.paymentDialogOpen.set(true);
  }

  closePaymentDialog() {
    this.paymentDialogOpen.set(false);
    this.editingPayment.set(null);
    this.paymentDraft.set(emptyPaymentDraft());
    this.paymentError.set(null);
  }

  onPaymentProjectChange(value: string) {
    this.paymentDraft.set({ ...this.paymentDraft(), projectId: value, siteId: "" });
  }

  updatePaymentDraft<K extends keyof ReturnType<typeof emptyPaymentDraft>>(key: K, value: ReturnType<typeof emptyPaymentDraft>[K]) {
    this.paymentDraft.set({ ...this.paymentDraft(), [key]: value });
  }

  async savePayment() {
    const draft = this.paymentDraft();
    const errors: string[] = [];
    if (!draft.projectId) errors.push("Project is required.");
    if (!draft.siteId) errors.push("Site is required.");
    if (!draft.date) errors.push("Date is required.");
    if (!draft.description.trim()) errors.push("Description is required.");
    if (!Number.isInteger(draft.employeeCount) || draft.employeeCount < 1) errors.push("Number of employees must be a positive whole number.");
    if (!Number.isFinite(draft.amount) || draft.amount <= 0) errors.push("Amount must be greater than zero.");
    if (errors.length) {
      this.paymentError.set(errors.join(" "));
      return;
    }
    const id = this.subcontractorId;
    if (!id) {
      this.paymentError.set("Sub-contractor id is missing.");
      return;
    }

    this.paymentSaving.set(true);
    this.paymentError.set(null);

    const payload = {
      subcontractorId: id,
      projectId: draft.projectId,
      siteId: draft.siteId,
      date: draft.date,
      description: draft.description.trim(),
      employeeCount: draft.employeeCount,
      amount: draft.amount,
      notes: draft.notes,
    };

    const editing = this.editingPayment();
    const req = editing
      ? this.api.updateSubcontractorPayment(editing._id, payload)
      : this.api.createSubcontractorPayment(payload);

    req.subscribe({
      next: () => {
        this.paymentSaving.set(false);
        this.closePaymentDialog();
        this.refreshPayments();
        this.presentToast(editing ? "Payment updated." : "Payment recorded.");
      },
      error: (err) => {
        this.paymentSaving.set(false);
        this.paymentError.set(err?.error?.error || err?.error?.message || err?.message || "Could not save payment.");
      },
    });
  }

  deletePayment(p: SubcontractorPayment) {
    if (!window.confirm(`Delete this payment of ${this.formatMoney(p.amount)}?`)) return;
    this.api.deleteSubcontractorPayment(p._id).subscribe({
      next: () => {
        this.refreshPayments();
        this.presentToast("Payment deleted.");
      },
      error: (err) => {
        this.presentToast(err?.error?.error || err?.message || "Delete failed.");
      },
    });
  }

  private async presentToast(message: string) {
    const toast = await this.toastController.create({ message, duration: 2500, position: "top" });
    await toast.present();
  }
}

function emptyPaymentDraft() {
  return {
    projectId: "",
    siteId: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    employeeCount: 1,
    amount: 0,
    notes: "",
  };
}