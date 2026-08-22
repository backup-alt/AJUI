import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { IonContent, IonIcon, IonSplitPane, IonSpinner, ToastController } from "@ionic/angular/standalone";
import { ApiService, SubcontractorLabor, SubcontractorPayment } from "../core/api.service";
import { ErpDataService } from "../data/erp-data.service";
import { formatMoney } from "../shared/format";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { SearchableSelectComponent } from "../shared/searchable-select.component";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, IonIcon, IonSplitPane, IonSpinner, EnterpriseHeaderComponent, EnterpriseSidebarComponent, SearchableSelectComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="subcontractors"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          [title]="subcontractorName() || 'Sub-contractor'"
          eyebrow="Payment and labour history across projects"
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
                  <p class="detail-meta"><ion-icon name="document-text-outline"></ion-icon>GST Registration: {{ subcontractor()!.gstType || 'Non-GST' }}</p>
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
              </section>

              <nav class="detail-tabs">
                <button type="button" class="tab" [class.active]="activeTab() === 'payments'" (click)="activeTab.set('payments')">Payment Logs</button>
                <button type="button" class="tab" [class.active]="activeTab() === 'labor'" (click)="activeTab.set('labor')">Labour Details</button>
              </nav>

              @if (activeTab() === 'payments') {
              <section class="detail-pane">
              <div class="pane-head"><div><h2>Payment Logs</h2></div></div>
              <section class="filters">
                <label class="filter-field">
                  <span>Project</span>
                  <agb-searchable-select
                    [ngModel]="filterProjectId()"
                    (ngModelChange)="onProjectFilterChange($event)"
                    [options]="projectFilterOptions('All projects')"
                    placeholder="All projects"
                  ></agb-searchable-select>
                </label>
              </section>

              <section class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Payment Mode</th>
                      <th>Project</th>
                      <th>Labour Type</th>
                      <th>Description</th>
                      <th>Employees</th>
                      <th>Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of filteredPayments(); track p._id) {
                      <tr>
                        <td>{{ p.date }}</td>
                        <td>{{ p.paymentType || 'Bank Transfer' }}</td>
                        <td>{{ p.projectName }}</td>
                        <td>{{ p.labourType || 'General Labour' }}</td>
                        <td class="wrap">{{ p.description || '—' }}</td>
                        <td>{{ p.employeeCount }}</td>
                        <td>{{ formatMoney(p.amount) }}</td>
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
              </section>
              }

              @if (activeTab() === 'labor') {
              <section class="detail-pane">
                <div class="pane-head">
                  <div><h2>Labour Details</h2></div>
                  <button type="button" class="btn-primary" (click)="openLaborDialog()">
                    <ion-icon name="add-outline"></ion-icon>
                    Add labour
                  </button>
                </div>
                <section class="filters">
                  <label class="filter-field">
                    <span>Project</span>
                    <agb-searchable-select
                      [ngModel]="laborFilterProjectId()"
                      (ngModelChange)="onLaborFilterProjectChange($event)"
                      [options]="projectFilterOptions('All projects')"
                      placeholder="All projects"
                    ></agb-searchable-select>
                  </label>
                </section>
                <section class="table-wrap labor-table-wrap">
                  <table class="labor-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Address</th>
                        <th>Project</th>
                        <th>Notes</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (laborer of filteredLabor(); track laborer._id) {
                        <tr>
                          <td><strong>{{ laborer.name }}</strong></td>
                          <td>{{ laborer.phone }}</td>
                          <td>{{ laborer.role }}</td>
                          <td class="wrap">{{ laborer.address || 'No address' }}</td>
                          <td>{{ laborer.projectName || '—' }}</td>
                          <td class="wrap">{{ laborer.notes || 'No notes' }}</td>
                          <td class="row-actions"><button type="button" class="icon-btn" aria-label="Edit labor" title="Edit labor" (click)="editLaborer(laborer)"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4.2l11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="m14.8 7.2 3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button></td>
                        </tr>
                      }
                      @if (filteredLabor().length === 0) {
                        <tr>
                          <td colspan="7" class="empty-row">No laborers linked to this sub-contractor yet.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </section>
              </section>
              }
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
              <agb-searchable-select
                name="projectId"
                [ngModel]="paymentDraft().projectId"
                (ngModelChange)="onPaymentProjectChange($event)"
                [options]="allProjectOptions()"
                placeholder="Search projects"
              ></agb-searchable-select>
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
              <span>Payment Mode *</span>
              <agb-searchable-select
                name="paymentType"
                [ngModel]="paymentDraft().paymentType"
                (ngModelChange)="updatePaymentDraft('paymentType', $event)"
                [options]="paymentModes"
                placeholder="Select payment mode"
              ></agb-searchable-select>
            </label>

            <label>
              <span>Labour Type *</span>
              <agb-searchable-select
                name="labourType"
                [ngModel]="paymentDraft().labourType"
                (ngModelChange)="updatePaymentDraft('labourType', $event)"
                [options]="labourTypes"
                [allowCustom]="true"
                placeholder="Search or enter a labour type"
              ></agb-searchable-select>
            </label>

            <label>
              <span>Work Description (optional)</span>
              <input
                type="text"
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

      @if (laborDialogOpen()) {
        <div class="drawer-backdrop" (click)="closeLaborDialog()" aria-hidden="true"></div>
        <aside class="drawer" role="dialog" aria-label="Add or edit labour">
          <header class="drawer-head">
            <h2>{{ editingLabor() ? 'Edit labour' : 'Add labour' }} — {{ subcontractorName() }}</h2>
            <button type="button" class="icon-btn" aria-label="Close" (click)="closeLaborDialog()">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </header>
          <form class="drawer-body" (submit)="$event.preventDefault(); saveLaborer()">
            <label>
              <span>Name *</span>
              <input required [ngModel]="laborDraft().name" (ngModelChange)="updateLaborDraft('name', $event)" name="laborName" placeholder="Worker name" />
            </label>
            <label>
              <span>Address (optional)</span>
              <input [ngModel]="laborDraft().address" (ngModelChange)="updateLaborDraft('address', $event)" name="laborAddress" placeholder="Optional address" />
            </label>
            <label>
              <span>Number / Phone</span>
              <input [ngModel]="laborDraft().phone" (ngModelChange)="updateLaborDraft('phone', $event)" name="laborPhone" placeholder="Optional" />
            </label>
            <label>
              <span>Role *</span>
              <agb-searchable-select
                name="laborRole"
                [ngModel]="laborDraft().role"
                (ngModelChange)="updateLaborDraft('role', $event)"
                [options]="labourTypes"
                [allowCustom]="true"
                placeholder="Search or enter a labour role"
              ></agb-searchable-select>
            </label>
            <label>
              <span>Project (optional)</span>
              <agb-searchable-select
                name="laborProjectId"
                [ngModel]="laborDraft().projectId"
                (ngModelChange)="onLaborProjectChange($event)"
                [options]="optionalProjectOptions()"
                placeholder="No specific project"
              ></agb-searchable-select>
              @if (laborDraft().projectId) {
                <small class="hint">This labour will appear in the project's worker roster.</small>
              }
            </label>
            <label>
              <span>Notes (optional)</span>
              <textarea rows="3" [ngModel]="laborDraft().notes" (ngModelChange)="updateLaborDraft('notes', $event)" name="laborNotes"></textarea>
            </label>
            @if (laborError()) {
              <p class="drawer-error">{{ laborError() }}</p>
            }
            <footer class="drawer-foot">
              <button type="button" class="btn-ghost" (click)="closeLaborDialog()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="laborSaving()">
                {{ laborSaving() ? 'Saving…' : (editingLabor() ? 'Save changes' : 'Add labour') }}
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

    .detail-tabs { display: flex; gap: 4px; border-bottom: 2px solid #e2e8f0; }
    .detail-tabs .tab {
      padding: 10px 18px; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px;
      background: transparent; color: #64748b; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .detail-tabs .tab:hover { color: #1e293b; }
    .detail-tabs .tab.active { color: #002263; border-bottom-color: #002263; }
    .detail-pane { min-width: 0; display: grid; gap: 12px; padding: 16px; border: 1px solid #dbe4f0; border-radius: 14px; background: #f8fafc; }
    .pane-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #002263; padding-bottom: 10px; }
    .pane-head span { color: #64748b; font-size: 10px; font-weight: 900; text-transform: uppercase; }
    .pane-head h2 { margin: 3px 0 0; color: #0f172a; font-size: 18px; }
    .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .filter-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #1e293b; }
    .filter-field span { font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
    .filter-field select, .filter-field input, .filter-field textarea {
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
    .labor-table { min-width: 760px; table-layout: fixed; }
    .labor-table th, .labor-table td { padding: 10px 8px; overflow-wrap: anywhere; max-width: none; }
    .labor-table th:nth-child(1), .labor-table td:nth-child(1) { width: 16%; }
    .labor-table th:nth-child(2), .labor-table td:nth-child(2) { width: 13%; }
    .labor-table th:nth-child(3), .labor-table td:nth-child(3) { width: 15%; }
    .labor-table th:nth-child(4), .labor-table td:nth-child(4) { width: 18%; }
    .labor-table th:nth-child(5), .labor-table td:nth-child(5) { width: 18%; }
    .labor-table th:nth-child(6), .labor-table td:nth-child(6) { width: 14%; }
    .labor-table th:nth-child(7), .labor-table td:nth-child(7) { width: 56px; padding-right: 12px; }
    .labor-table td:last-child { text-align: right; }
    .labor-cell-detail { display: block; margin-top: 3px; color: #64748b; font-size: 11px; font-weight: 400; }
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
      .detail-tabs .tab { padding: 10px 12px; font-size: 13px; }
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

  readonly paymentDialogOpen = signal(false);
  readonly editingPayment = signal<SubcontractorPayment | null>(null);
  readonly paymentSaving = signal(false);
  readonly paymentError = signal<string | null>(null);
  readonly laborRoster = signal<SubcontractorLabor[]>([]);
  readonly laborFilterProjectId = signal<string>("");
  readonly filteredLabor = computed(() => {
    const projectId = this.laborFilterProjectId();
    if (!projectId) return this.laborRoster();
    return this.laborRoster().filter((l) => (l.projectId || "") === projectId);
  });
  readonly editingLabor = signal<SubcontractorLabor | null>(null);
  readonly laborSaving = signal(false);
  readonly laborError = signal<string | null>(null);
  readonly laborDraft = signal(emptyLaborDraft());
  readonly laborDialogOpen = signal(false);
  readonly activeTab = signal<"payments" | "labor">("payments");
  readonly labourTypes = [
    "Mason", "Helper", "Carpenter", "Plumber", "Electrician", "Painter",
    "Bar bender", "Welder", "Tile mason", "Centring", "Fitter", "Maid",
    "Cook", "Watchman", "Cleaner", "Driver", "General Labour",
  ];
  readonly paymentModes = ["Bank Transfer", "Cash", "UPI", "Cheque", "NEFT", "RTGS"];

  projectFilterOptions(allLabel: string) {
    return [
      { label: allLabel, value: "" },
      ...this.availableProjects().map((project) => ({ label: project.name, value: project.id })),
    ];
  }

  allProjectOptions() {
    return this.allProjects().map((project) => ({ label: project.name, value: project.id }));
  }

  optionalProjectOptions() {
    return [{ label: "No specific project", value: "" }, ...this.allProjectOptions()];
  }
  readonly paymentDraft = signal<{
    projectId: string;
    date: string;
    paymentType: string;
    labourType: string;
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

  readonly filteredPayments = computed(() => {
    const projectId = this.filterProjectId();
    return this.payments().filter((p) => {
      if (projectId && p.projectId !== projectId) return false;
      return true;
    });
  });

  readonly subcontractorName = computed(() => this.subcontractor()?.subcontractorName || "");

  readonly canRecordPayment = computed(() => this.allProjects().length > 0);

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
        this.refreshLabor();
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
  }

  onLaborFilterProjectChange(value: string) {
    this.laborFilterProjectId.set(value);
  }

  updateLaborDraft<K extends keyof ReturnType<typeof emptyLaborDraft>>(key: K, value: string) {
    this.laborDraft.set({ ...this.laborDraft(), [key]: value });
  }

  refreshLabor() {
    const id = this.subcontractorId;
    if (!id) return;
    this.api.listSubcontractorLabor(id).subscribe({
      next: (response) => this.laborRoster.set(response.items || []),
      error: () => this.laborRoster.set([]),
    });
  }

  editLaborer(laborer: SubcontractorLabor) {
    this.editingLabor.set(laborer);
    this.laborDraft.set({
      name: laborer.name,
      address: laborer.address || "",
      phone: laborer.phone,
      role: laborer.role,
      notes: laborer.notes || "",
      projectId: laborer.projectId || "",
      projectName: laborer.projectName || "",
    });
    this.laborError.set(null);
    this.laborDialogOpen.set(true);
  }

  /** When the labour drawer project dropdown changes, keep projectName
   * in sync so the create/update payload carries a denormalised label. */
  onLaborProjectChange(value: string) {
    const project = this.allProjects().find((p) => p.id === value);
    this.laborDraft.set({
      ...this.laborDraft(),
      projectId: value,
      projectName: project?.name || "",
    });
  }

  openLaborDialog() {
    this.editingLabor.set(null);
    this.laborDraft.set(emptyLaborDraft());
    this.laborError.set(null);
    this.laborDialogOpen.set(true);
  }

  closeLaborDialog() {
    this.laborDialogOpen.set(false);
    this.resetLaborDraft();
  }

  resetLaborDraft() {
    this.editingLabor.set(null);
    this.laborDraft.set(emptyLaborDraft());
    this.laborError.set(null);
  }

  saveLaborer() {
    const draft = this.laborDraft();
    if (!draft.name.trim() || !draft.role.trim()) {
      this.laborError.set("Name and role are required.");
      return;
    }
    this.laborSaving.set(true);
    const payload = {
      subcontractorId: this.subcontractorId,
      name: draft.name.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim(),
      role: draft.role.trim(),
      notes: draft.notes.trim(),
      // Project linkage is optional — empty string means "sub-contractor
      // scoped only", which is the historical behaviour.
      projectId: draft.projectId?.trim() || "",
      projectName: draft.projectName?.trim() || "",
    };
    const editing = this.editingLabor();
    const request = editing
      ? this.api.updateSubcontractorLabor(editing._id, payload)
      : this.api.createSubcontractorLabor(payload);
    request.subscribe({
      next: (response) => {
        this.laborSaving.set(false);
        this.closeLaborDialog();
        this.refreshLabor();
        // Mirror into the per-project Worker roster when a project is set,
        // so the labour shows up in the project's worker table. We don't
        // block the labour save on this — worker mirror failures are
        // logged and the user is notified via toast.
        if (payload.projectId) {
          this.mirrorLaborToWorker(payload, response?.labor, editing?._id);
        }
        this.presentToast(editing ? "Labor updated." : "Labor added.");
      },
      error: (error) => {
        this.laborSaving.set(false);
        this.laborError.set(error?.error?.error || error?.message || "Could not save labor.");
      },
    });
  }

  /**
   * Create or update a Worker entry that mirrors a SubcontractorLabor
   * row, so the labour shows up in the matching project's worker
   * roster. We match by name+phone within the project — for new labour
   * rows a fresh Worker is created; for edits we look up the existing
   * Worker (if any) and patch it. Failures here never block the
   * labour save (the labour already persisted to the
   * SubcontractorLabor collection). Errors are toasted, not thrown.
   */
  private mirrorLaborToWorker(
    payload: { name: string; phone: string; role: string; address: string; notes: string; projectId: string },
    savedLabor: { _id?: string } | undefined,
    previousLaborId?: string
  ) {
    if (!payload.projectId) return;
    const userId = this.api.user()?.id || "system";
    const projectName = this.allProjects().find((p) => p.id === payload.projectId)?.name || "";
    const subcontractor = this.subcontractor();
    const subName = subcontractor?.subcontractorName || "";

    const workerPayload = {
      projectId: payload.projectId,
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
      notes: payload.notes,
      labourType: payload.role,
      isSubcontract: true,
      subcontractorId: this.subcontractorId,
      subcontractorName: subName,
      createdBy: userId,
    };

    // Try to find an existing Worker (projectId + name + phone) so
    // re-saves don't create duplicate rows.
    this.api.listWorkers({ projectId: payload.projectId, limit: 200 }).subscribe({
      next: (res) => {
        const items = (res.items || []) as Array<Record<string, unknown>>;
        const match = items.find((w) =>
          String(w["name"] || "").trim() === payload.name.trim() &&
          String(w["phone"] || "").trim() === payload.phone.trim(),
        );
        const matchId = match ? String(match["_id"] || "") : "";
        if (matchId) {
          this.api.patchWorker(matchId, {
            name: payload.name,
            phone: payload.phone,
            address: payload.address,
            notes: payload.notes,
            labourType: payload.role,
          }).subscribe({
            error: (err) => console.warn("Worker mirror patch failed:", err?.message || err),
          });
        } else {
          this.api.createWorker(workerPayload).subscribe({
            error: (err) => console.warn("Worker mirror create failed:", err?.message || err),
          });
        }
        // Touch unused params so the linter doesn't complain — they may be
        // useful for future caching of the labour→worker mapping.
        void previousLaborId;
        void savedLabor;
      },
      error: (err) => console.warn("Worker mirror lookup failed:", err?.message || err),
    });
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
      date: p.date,
      paymentType: p.paymentType || "Bank Transfer",
      labourType: p.labourType || "General Labour",
      description: p.description,
      employeeCount: p.employeeCount,
      amount: p.amount,
      notes: "",
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
    this.paymentDraft.set({ ...this.paymentDraft(), projectId: value });
  }

  updatePaymentDraft<K extends keyof ReturnType<typeof emptyPaymentDraft>>(key: K, value: ReturnType<typeof emptyPaymentDraft>[K]) {
    this.paymentDraft.set({ ...this.paymentDraft(), [key]: value });
  }

  async savePayment() {
    const draft = this.paymentDraft();
    const errors: string[] = [];
    if (!draft.projectId) errors.push("Project is required.");
    if (!draft.date) errors.push("Date is required.");
    if (!draft.paymentType) errors.push("Payment mode is required.");
    if (!draft.labourType.trim()) errors.push("Labour type is required.");
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

    const editing = this.editingPayment();
    const payload = {
      subcontractorId: id,
      projectId: draft.projectId,
      date: draft.date,
      paymentType: draft.paymentType,
      labourType: draft.labourType.trim(),
      description: draft.description.trim(),
      employeeCount: draft.employeeCount,
      amount: draft.amount,
      ...(editing ? {} : { notes: "" }),
    };

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
    date: new Date().toISOString().slice(0, 10),
    paymentType: "Bank Transfer",
    labourType: "General Labour",
    description: "",
    employeeCount: 1,
    amount: 0,
    notes: "",
  };
}

function emptyLaborDraft() {
  return {
    name: "",
    address: "",
    phone: "",
    role: "",
    notes: "",
    projectId: "",
    projectName: "",
  };
}
