import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonContent, IonSplitPane } from "@ionic/angular/standalone";
import { firstValueFrom } from "rxjs";
import { ApiService } from "../core/api.service";
import { ApprovalsService } from "../core/approvals.service";
import { ErpDataService } from "../data/erp-data.service";
import { ClientFormDialogComponent } from "../shared/client-form-dialog.component";
import { DashboardBarChartComponent, type BarChartSeries } from "../shared/dashboard-bar-chart.component";
import { DashboardDonutChartComponent, type DonutSegment } from "../shared/dashboard-donut-chart.component";
import { DashboardKpiCardComponent } from "../shared/dashboard-kpi-card.component";
import { DashboardSectionCardComponent } from "../shared/dashboard-section-card.component";
import { DashboardSkeletonComponent } from "../shared/dashboard-skeleton.component";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { ProjectFormDialogComponent } from "../shared/project-form-dialog.component";
import { VendorFormDialogComponent } from "../shared/vendor-form-dialog.component";
import { formatMoney, formatNumber } from "../shared/format";

type PeriodKey = "today" | "week" | "month" | "3m" | "6m" | "year" | "custom";

interface DashboardKpis {
  counts?: {
    clients?: { total?: number; active?: number };
    projects?: { total?: number; active?: number; onHold?: number; completed?: number };
    vendors?: { total?: number; active?: number };
    approvals?: { pending?: number };
  };
  financials?: {
    totalProjectValue?: number;
    totalReceived?: number;
    totalPending?: number;
    totalMaterialSpend?: number;
    totalLabourPayable?: number;
    totalExpenseReceived?: number;
    totalSubcontractorSpend?: number;
  };
  recentActivity?: {
    pendingMaterials?: number;
    pendingPayments?: number;
    pendingExpenses?: number;
    pendingSubcontracts?: number;
  };
}

interface ActionItem {
  id: string;
  label: string;
  detail: string;
  count: number;
  tone: "critical" | "warning" | "info";
  route: string;
  action: string;
}

interface TrendPoint {
  label: string;
  value: number;
}

@Component({
  selector: "app-universal-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonSplitPane,
    EnterpriseHeaderComponent,
    EnterpriseSidebarComponent,
    ClientFormDialogComponent,
    ProjectFormDialogComponent,
    VendorFormDialogComponent,
    DashboardBarChartComponent,
    DashboardDonutChartComponent,
    DashboardKpiCardComponent,
    DashboardSectionCardComponent,
    DashboardSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="dashboard"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header title="Dashboard"></agb-enterprise-header>

        <ion-content class="dashboard-page">
          <main class="dashboard-shell">
            <!-- ───────────────────── HERO ───────────────────── -->
            <header class="hero">
              <div class="hero-meta">
                <span class="hero-eyebrow">{{ currentDateLabel() }}</span>
                <h1 class="hero-title">
                  {{ greeting() }}, <span class="hero-name">{{ userName() }}</span>
                </h1>
                <p class="hero-sub">
                  A real-time view of
                  <strong>{{ selectedScopeLabel().toLowerCase() }}</strong>
                  for <strong>{{ periodLabel().toLowerCase() }}</strong>.
                  {{ heroSubline() }}
                </p>

                <div class="hero-pills">
                  <span class="hero-pill">
                    <i class="hero-dot" [class.loading]="refreshing()"></i>
                    <strong>{{ refreshing() ? 'Syncing live data' : 'Live data connected' }}</strong>
                    <small>{{ lastUpdatedAt() ? 'Updated ' + relativeTime(lastUpdatedAt()) : 'Loading' }}</small>
                  </span>
                  <span class="hero-pill subtle">
                    <strong>{{ activeProjectCount() }}</strong>
                    <small>active project{{ activeProjectCount() === 1 ? '' : 's' }}</small>
                  </span>
                  <span class="hero-pill subtle">
                    <strong>{{ actionQueue().length }}</strong>
                    <small>needs your attention</small>
                  </span>
                </div>
              </div>

              <div class="hero-actions">
                <button
                  type="button"
                  class="hero-button ghost"
                  [disabled]="refreshing()"
                  (click)="refreshAll()"
                  aria-label="Refresh dashboard"
                >
                  <svg viewBox="0 0 24 24" [class.spinning]="refreshing()">
                    <path d="M20 11a8 8 0 1 0 2 5M20 4v7h-7" />
                  </svg>
                  <span>{{ refreshing() ? 'Refreshing' : 'Refresh' }}</span>
                </button>
                <button type="button" class="hero-button ghost" (click)="openClientDialog()">
                  <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                  <span>New client</span>
                </button>
                <button type="button" class="hero-button primary" (click)="openProjectDialog()">
                  <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                  <span>New project</span>
                </button>
              </div>
            </header>

            <!-- ───────────────────── SCOPE BAR ───────────────────── -->
            <section class="scope-bar" aria-label="Dashboard scope">
              <div class="scope-summary">
                <span class="scope-summary-icon">
                  <svg viewBox="0 0 24 24"><path d="M3 4h18l-2 14H5L3 4Z" /><path d="M3 4 2 2M21 4l1-2" /></svg>
                </span>
                <div>
                  <span class="scope-summary-label">Viewing</span>
                  <strong>{{ selectedScopeLabel() }} · {{ periodLabel() }}</strong>
                </div>
              </div>

              <label class="scope-field">
                <span>Project</span>
                <select [value]="selectedProjectId()" (change)="onProjectChange($any($event.target).value)">
                  <option value="">All projects</option>
                  @for (project of projects(); track project.id || project._id) {
                    <option [value]="project.id || project._id">{{ project.name }}</option>
                  }
                </select>
              </label>

              <label class="scope-field">
                <span>Site</span>
                <select
                  [disabled]="!selectedProjectId()"
                  [value]="selectedSiteId()"
                  (change)="onSiteChange($any($event.target).value)"
                >
                  <option value="">All sites</option>
                  @for (site of availableSites(); track site.id) {
                    <option [value]="site.id">{{ site.name }}</option>
                  }
                </select>
              </label>

              <label class="scope-field">
                <span>Period</span>
                <select [value]="periodKey()" (change)="onPeriodChange($any($event.target).value)">
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                  <option value="3m">Last 3 months</option>
                  <option value="6m">Last 6 months</option>
                  <option value="year">This year</option>
                  <option value="custom">Custom dates</option>
                </select>
              </label>

              @if (periodKey() === 'custom') {
                <label class="scope-field scope-field-date">
                  <span>From</span>
                  <input type="date" [value]="customFrom()" (change)="onCustomFromChange($any($event.target).value)" />
                </label>
                <label class="scope-field scope-field-date">
                  <span>To</span>
                  <input type="date" [value]="customTo()" (change)="onCustomToChange($any($event.target).value)" />
                </label>
              }

              @if (hasActiveFilters()) {
                <button type="button" class="scope-reset" (click)="clearFilters()">
                  <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
                  Reset filters
                </button>
              }
            </section>

            <!-- ───────────────────── KPI STRIP ───────────────────── -->
            <section class="kpi-strip" aria-label="Key performance indicators">
              @if (loadingKpis()) {
                <agb-dashboard-skeleton variant="kpi" [kpiCount]="4"></agb-dashboard-skeleton>
              } @else {
                <agb-kpi-card
                  label="Amount received"
                  [value]="money(financials().totalReceived)"
                  subtitle="Collections this period"
                  [delta]="kpiReceivedDelta()"
                  deltaContext="vs previous period"
                  accent="success"
                  [iconPath]="'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'"
                ></agb-kpi-card>

                <agb-kpi-card
                  label="Total expenditure"
                  [value]="money(totalExpenses())"
                  subtitle="Materials · labour · subcontractors · expenses"
                  [delta]="kpiSpentDelta()"
                  deltaContext="vs previous period"
                  accent="warning"
                  [iconPath]="'M3 7h18M5 7v13h14V7M9 11h6'"
                ></agb-kpi-card>

                <agb-kpi-card
                  label="Net cash position"
                  [value]="money(netCashPosition())"
                  [subtitle]="netSubtitle()"
                  [delta]="kpiNetDelta()"
                  deltaContext="vs previous period"
                  [accent]="netCashPosition() >= 0 ? 'info' : 'danger'"
                  [iconPath]="'M4 17 10 11l4 4 6-8M16 7h4v4'"
                ></agb-kpi-card>

                <agb-kpi-card
                  label="Portfolio value"
                  [value]="money(financials().totalProjectValue)"
                  [subtitle]="collectionRate() + '% collected · ' + money(financials().totalPending) + ' pending'"
                  accent="primary"
                  [iconPath]="'M4 19V9m6 10V5m6 14v-7m4 7H2'"
                ></agb-kpi-card>
              }
            </section>

            <!-- ───────────────────── MAIN GRID ───────────────────── -->
            <div class="main-grid">
              <agb-section-card
                class="project-section"
                eyebrow="Delivery"
                title="Project health"
                description="Live status, progress and collections for every project in scope."
                actionLabel="View all"
                actionRoute="/projects"
                [loading]="loadingKpis()"
                [isEmpty]="!loadingKpis() && projectHealth().length === 0"
                emptyTitle="No projects in this scope"
                emptyMessage="Adjust your filters or create a new project to see it here."
                emptyActionLabel="Create project"
                emptyActionRoute="/projects"
              >
                <ng-content>
                  <div class="project-progress-strip" aria-label="Portfolio progress">
                    <div class="project-progress-stat">
                      <span>Active</span>
                      <strong>{{ activeProjectCount() }}</strong>
                    </div>
                    <div class="project-progress-stat">
                      <span>On hold</span>
                      <strong>{{ onHoldCount() }}</strong>
                    </div>
                    <div class="project-progress-stat">
                      <span>Completed</span>
                      <strong>{{ completedCount() }}</strong>
                    </div>
                    <div class="project-progress-stat">
                      <span>Avg progress</span>
                      <strong>{{ avgProgress() }}%</strong>
                    </div>
                  </div>

                  <div class="project-table">
                    <div class="project-table-head">
                      <span>Project</span>
                      <span>Progress</span>
                      <span>Value</span>
                      <span>Received</span>
                      <span>Spent</span>
                    </div>
                    @for (project of projectHealth(); track project.id) {
                      <a class="project-row" [routerLink]="projectRoute(project)">
                        <span class="project-cell project-cell-main">
                          <span class="project-avatar" [style.background]="project.color">
                            {{ project.initials }}
                          </span>
                          <span class="project-main">
                            <strong>{{ project.name }}</strong>
                            <small>
                              {{ project.client || 'No client' }}
                              <i class="status-badge" [class]="statusClass(project.status)">
                                {{ project.status }}
                              </i>
                            </small>
                          </span>
                        </span>
                        <span class="project-cell project-cell-progress">
                          <span class="project-progress-bar">
                            <i [style.width.%]="project.progress" [style.background]="project.color"></i>
                          </span>
                          <strong>{{ project.progress }}%</strong>
                        </span>
                        <span class="project-cell project-cell-value">
                          <strong>{{ money(project.value) }}</strong>
                        </span>
                        <span class="project-cell project-cell-value">
                          <strong class="received">{{ money(project.received) }}</strong>
                        </span>
                        <span class="project-cell project-cell-value">
                          <strong class="spent">{{ money(project.spent) }}</strong>
                        </span>
                      </a>
                    }
                  </div>
                </ng-content>
              </agb-section-card>

              <aside class="side-column">
                <agb-section-card
                  eyebrow="Action inbox"
                  title="Needs your attention"
                  description="Decisions that unblock your team."
                  [actionLabel]="actionQueue().length + ' open'"
                  [loading]="loadingKpis()"
                  [isEmpty]="!loadingKpis() && actionQueue().length === 0"
                  emptyTitle="All caught up"
                  emptyMessage="No urgent approvals, low stock or delayed activity right now."
                >
                  <ng-content>
                    <div class="action-list">
                      @for (item of actionQueue(); track item.id) {
                        <a class="action-item" [attr.data-tone]="item.tone" [routerLink]="item.route">
                          <span class="action-count">{{ item.count }}</span>
                          <span class="action-copy">
                            <strong>{{ item.label }}</strong>
                            <small>{{ item.detail }}</small>
                          </span>
                          <span class="action-link">
                            {{ item.action }}
                            <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                          </span>
                        </a>
                      }
                    </div>
                    <div class="quick-create">
                      <span class="quick-create-label">Quick create</span>
                      <div class="quick-create-row">
                        <button type="button" (click)="openClientDialog()">
                          <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                          Client
                        </button>
                        <button type="button" (click)="openVendorDialog()">
                          <svg viewBox="0 0 24 24"><path d="M3 9h18l-2-5H5L3 9Z" /><path d="M9 20v-6h6v6" /></svg>
                          Vendor
                        </button>
                        <a routerLink="/general-expenses">
                          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                          Expense
                        </a>
                        <a routerLink="/approvals">
                          <svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                          Approval
                        </a>
                      </div>
                    </div>
                  </ng-content>
                </agb-section-card>

                <agb-section-card
                  eyebrow="Inventory"
                  title="Stock at a glance"
                  description="Materials on hand across selected projects."
                  [isEmpty]="!loadingKpis() && inventoryItemCount() === 0"
                  emptyTitle="No inventory yet"
                  emptyMessage="Add materials to a project to start tracking stock."
                >
                  <ng-content>
                    <div class="stock-summary" [class.has-alerts]="lowStockCount() > 0">
                      <span class="stock-icon">
                        <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="M3.27 6.96 12 12l8.73-5.04" /><path d="M12 22V12" /></svg>
                      </span>
                      <div>
                        <strong>
                          @if (lowStockCount() > 0) {
                            {{ lowStockCount() }} {{ lowStockCount() === 1 ? 'material' : 'materials' }} below minimum
                          } @else {
                            Inventory levels are healthy
                          }
                        </strong>
                        <small>
                          {{ inventoryItemCount() }} tracked
                          @if (lowStockCount() > 0) { · replenishment recommended }
                          @else { · no action required }
                        </small>
                      </div>
                      <a routerLink="/projects">View</a>
                    </div>

                    @if (lowStockRows().length > 0) {
                      <div class="stock-list">
                        @for (item of lowStockRows(); track item.id) {
                          <div class="stock-row">
                            <span class="stock-name">{{ item.name }}</span>
                            <span class="stock-progress">
                              <i [style.width.%]="item.percent" [class.danger]="item.percent <= 25"></i>
                            </span>
                            <span class="stock-meta">
                              <strong>{{ item.remaining }}</strong>
                              <small>/ {{ item.minimum }} min</small>
                            </span>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="stock-empty">All tracked materials are above their minimum threshold.</div>
                    }
                  </ng-content>
                </agb-section-card>

                <agb-section-card
                  eyebrow="Pipeline"
                  title="Pending approvals"
                  description="Workflow requests needing a decision."
                  actionLabel="Open queue"
                  actionRoute="/approvals"
                  [loading]="loadingKpis()"
                  [isEmpty]="!loadingKpis() && topApprovals().length === 0"
                  emptyTitle="No approvals waiting"
                  emptyMessage="Everything in the queue has been actioned."
                >
                  <ng-content>
                    <div class="approval-list">
                      @for (approval of topApprovals(); track approval.id) {
                        <a routerLink="/approvals" class="approval-row">
                          <span class="approval-type" [style.background]="approval.color">{{ approval.initials }}</span>
                          <span class="approval-copy">
                            <strong>{{ approval.module }}</strong>
                            <small>{{ approval.projectName }} · {{ approval.requestedBy }}</small>
                          </span>
                          <time>{{ relativeTime(approval.createdAt) }}</time>
                        </a>
                      }
                    </div>
                  </ng-content>
                </agb-section-card>
              </aside>
            </div>

            <!-- ───────────────────── CASH TREND ───────────────────── -->
            <div class="cash-grid">
              <agb-section-card
                class="cash-section"
                eyebrow="Cash movement"
                title="Collections vs expenditure"
                [description]="periodLabel() + ' · ' + selectedScopeLabel()"
                actionLabel="Manage expenses"
                actionRoute="/general-expenses"
                [isEmpty]="!loadingKpis() && !hasFinancialTrend()"
                emptyTitle="No financial movement for this period"
                emptyMessage="Change the period or record a payment or expense to see trends."
              >
                <ng-content>
                  <agb-bar-chart
                    orientation="vertical"
                    [series]="financialSeries()"
                    [labels]="financialLabels()"
                    [legend]="financialLegend"
                  ></agb-bar-chart>
                  <div class="cash-totals">
                    <div class="cash-total">
                      <span class="cash-total-label">Total received</span>
                      <strong class="cash-total-value received">{{ money(periodTotals().received) }}</strong>
                    </div>
                    <div class="cash-total">
                      <span class="cash-total-label">Total spent</span>
                      <strong class="cash-total-value spent">{{ money(periodTotals().spent) }}</strong>
                    </div>
                    <div class="cash-total">
                      <span class="cash-total-label">Net movement</span>
                      <strong
                        class="cash-total-value"
                        [class.received]="periodTotals().net >= 0"
                        [class.spent]="periodTotals().net < 0"
                      >
                        {{ money(periodTotals().net) }}
                      </strong>
                    </div>
                  </div>
                </ng-content>
              </agb-section-card>

              <agb-section-card
                eyebrow="Spend breakdown"
                title="Where the money went"
                description="Composition of total expenditure for this period."
                [isEmpty]="!loadingKpis() && expenseDonut().length === 0"
                emptyTitle="No expenses logged"
                emptyMessage="Record materials, labour or expenses to see the split."
              >
                <ng-content>
                  <agb-donut-chart
                    [segments]="expenseDonut()"
                    caption="Total spent"
                    ariaLabel="Expense distribution"
                    [valueFormatter]="formatNumberValue"
                  ></agb-donut-chart>
                </ng-content>
              </agb-section-card>
            </div>

            <!-- ───────────────────── COLLECTIONS ───────────────────── -->
            <div class="bottom-grid">
              <agb-section-card
                eyebrow="Collections"
                title="Recent client payments"
                description="Latest money received in the selected period."
                actionLabel="View clients"
                actionRoute="/clients"
                [isEmpty]="!loadingKpis() && recentPayments().length === 0"
                emptyTitle="No payments recorded"
                emptyMessage="Payments recorded in this period will appear here."
              >
                <ng-content>
                  <div class="payment-list">
                    @for (payment of recentPayments(); track payment.id) {
                      <a
                        class="payment-row"
                        [routerLink]="payment.clientId ? ['/clients', payment.clientId] : ['/clients']"
                      >
                        <span class="payment-icon">
                          <svg viewBox="0 0 24 24"><path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        </span>
                        <span class="payment-copy">
                          <strong>{{ payment.clientName }}</strong>
                          <small>{{ payment.projectName }} · {{ formatDate(payment.date) }}</small>
                        </span>
                        <strong class="payment-amount">{{ money(payment.amount) }}</strong>
                      </a>
                    }
                  </div>
                </ng-content>
              </agb-section-card>

              <agb-section-card
                eyebrow="Operations"
                title="Live operations"
                description="Headline counts across the business."
              >
                <ng-content>
                  <div class="ops-grid">
                    <a routerLink="/projects" class="op-tile primary">
                      <span class="op-icon">
                        <svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" /></svg>
                      </span>
                      <strong>{{ activeProjectCount() }}</strong>
                      <small>Active projects</small>
                    </a>
                    <a routerLink="/clients" class="op-tile violet">
                      <span class="op-icon">
                        <svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75M22 21v-2a4 4 0 0 0-3-3.87" /></svg>
                      </span>
                      <strong>{{ activeClientCount() }}</strong>
                      <small>Active clients</small>
                    </a>
                    <a routerLink="/vendors" class="op-tile success">
                      <span class="op-icon">
                        <svg viewBox="0 0 24 24"><path d="M3 9h18l-2-5H5L3 9Z" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></svg>
                      </span>
                      <strong>{{ activeVendorCount() }}</strong>
                      <small>Active vendors</small>
                    </a>
                    <a routerLink="/projects" class="op-tile warning">
                      <span class="op-icon">
                        <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="M3.27 6.96 12 12l8.73-5.04" /><path d="M12 22V12" /></svg>
                      </span>
                      <strong>{{ inventoryItemCount() }}</strong>
                      <small>Materials in stock</small>
                    </a>
                    <a routerLink="/approvals" class="op-tile danger">
                      <span class="op-icon">
                        <svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                      </span>
                      <strong>{{ actionQueue()[0]?.count ?? 0 }}</strong>
                      <small>Approvals waiting</small>
                    </a>
                    <a routerLink="/subcontractors" class="op-tile neutral">
                      <span class="op-icon">
                        <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                      </span>
                      <strong>{{ data.subcontractors().length }}</strong>
                      <small>Subcontractors</small>
                    </a>
                  </div>
                </ng-content>
              </agb-section-card>

              <agb-section-card
                eyebrow="Activity"
                title="Top performers"
                description="Best and worst performing projects in scope."
                [isEmpty]="!loadingKpis() && topPerformers().length === 0"
                emptyTitle="No activity yet"
                emptyMessage="Projects need payments or expenses to rank."
              >
                <ng-content>
                  <div class="performer-list">
                    @for (item of topPerformers(); track item.id) {
                      <div class="performer-row" [attr.data-tone]="item.tone">
                        <span class="performer-rank">{{ $index + 1 }}</span>
                        <span class="performer-copy">
                          <strong>{{ item.name }}</strong>
                          <small>{{ item.client }}</small>
                        </span>
                        <span class="performer-bar">
                          <i [style.width.%]="item.score" [class]="item.tone"></i>
                        </span>
                        <span class="performer-score">{{ item.score }}%</span>
                      </div>
                    }
                  </div>
                </ng-content>
              </agb-section-card>
            </div>

            <!-- ───────────────────── FOOTER ───────────────────── -->
            <footer class="dashboard-footer">
              <span>
                Showing <strong>{{ selectedScopeLabel() }}</strong>
                for <strong>{{ periodLabel().toLowerCase() }}</strong>
                · {{ lastUpdatedAt() ? 'Updated ' + relativeTime(lastUpdatedAt()) : 'Loading' }}
              </span>
              <nav>
                <a routerLink="/projects">Projects</a>
                <a routerLink="/approvals">Approvals</a>
                <a routerLink="/general-expenses">Expenses</a>
                <a routerLink="/clients">Clients</a>
              </nav>
            </footer>
          </main>
        </ion-content>
      </div>

      @if (showClientDialog()) {
        <agb-client-form-dialog
          [initialValue]="null"
          (cancel)="closeClientDialog()"
          (create)="onClientCreated()"
        ></agb-client-form-dialog>
      }
      @if (showProjectDialog()) {
        <agb-project-form-dialog
          [currentClientId]="''"
          [initialValue]="null"
          (cancel)="closeProjectDialog()"
          (create)="onProjectCreated()"
        ></agb-project-form-dialog>
      }
      @if (showVendorDialog()) {
        <agb-vendor-form-dialog
          [initialValue]="null"
          (cancel)="closeVendorDialog()"
          (create)="onVendorCreated()"
        ></agb-vendor-form-dialog>
      }
    </ion-split-pane>
  `,
  styles: [`
    :host { display: block; }
    * { box-sizing: border-box; }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    button, select, input { font: inherit; }
    a { color: inherit; text-decoration: none; }

    .dashboard-page { --background: linear-gradient(180deg, #f6f8fc 0%, #eef2f8 100%); }
    .dashboard-shell {
      width: min(100%, 1640px);
      margin: 0 auto;
      padding: 28px 32px 64px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      color: #0f172a;
    }

    /* ────────── HERO ────────── */
    .hero {
      position: relative;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 28px;
      padding: 30px 34px;
      border-radius: 22px;
      background:
        radial-gradient(120% 120% at 100% 0%, rgba(99, 102, 241, 0.18) 0%, transparent 55%),
      radial-gradient(80% 80% at 0% 100%, rgba(14, 165, 233, 0.16) 0%, transparent 60%),
      linear-gradient(135deg, #0b1f4d 0%, #122b6e 60%, #1d3aa3 100%);
      color: #f8fafc;
      overflow: hidden;
      box-shadow: 0 30px 60px -32px rgba(15, 23, 42, 0.45);
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: 0;
      background-image: radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.07) 0, transparent 40%),
        radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.06) 0, transparent 45%);
      pointer-events: none;
    }
    .hero-meta { display: grid; gap: 10px; max-width: 760px; }
    .hero-eyebrow {
      display: inline-block;
      width: fit-content;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.18);
      color: #cbd5f5;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .hero-title {
      margin: 0;
      font-size: clamp(26px, 2.6vw, 38px);
      line-height: 1.1;
      letter-spacing: -0.035em;
      font-weight: 800;
      color: #fff;
    }
    .hero-name {
      background: linear-gradient(120deg, #93c5fd 0%, #c4b5fd 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .hero-sub {
      margin: 0;
      max-width: 64ch;
      color: rgba(226, 232, 240, 0.85);
      font-size: 14px;
      line-height: 1.55;
    }
    .hero-sub strong { color: #fff; font-weight: 700; }

    .hero-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }
    .hero-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 12px;
      backdrop-filter: blur(6px);
    }
    .hero-pill strong { font-weight: 700; }
    .hero-pill small { color: rgba(203, 213, 225, 0.8); font-weight: 600; }
    .hero-pill.subtle { background: rgba(255, 255, 255, 0.04); }
    .hero-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.18);
    }
    .hero-dot.loading {
      background: #fbbf24;
      box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.18);
      animation: pulseDot 1.4s ease-in-out infinite;
    }
    @keyframes pulseDot { 50% { transform: scale(1.3); } }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-self: flex-start;
      position: relative;
      z-index: 1;
    }
    .hero-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 42px;
      padding: 0 16px;
      border-radius: 11px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
      border: 1px solid transparent;
    }
    .hero-button svg { width: 16px; height: 16px; }
    .hero-button.ghost {
      background: rgba(255, 255, 255, 0.08);
      color: #f1f5f9;
      border-color: rgba(255, 255, 255, 0.18);
    }
    .hero-button.ghost:hover { background: rgba(255, 255, 255, 0.14); }
    .hero-button.primary {
      background: #fff;
      color: #0b1f4d;
      box-shadow: 0 12px 24px -10px rgba(15, 23, 42, 0.6);
    }
    .hero-button.primary:hover { transform: translateY(-1px); }
    .hero-button:disabled { cursor: wait; opacity: 0.65; }
    .spinning { animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ────────── SCOPE BAR ────────── */
    .scope-bar {
      position: sticky;
      z-index: 6;
      top: 8px;
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid #e2e8f0;
      box-shadow: 0 12px 28px -20px rgba(15, 23, 42, 0.25);
      backdrop-filter: blur(14px);
    }
    .scope-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 230px;
      margin-right: auto;
      padding: 0 6px;
    }
    .scope-summary-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, #eef2ff, #dbeafe);
      color: #1d4ed8;
    }
    .scope-summary-icon svg { width: 18px; }
    .scope-summary-label {
      display: block;
      color: #64748b;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .scope-summary strong {
      display: block;
      max-width: 280px;
      overflow: hidden;
      color: #0f172a;
      font-size: 13px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .scope-field {
      display: grid;
      gap: 5px;
      min-width: 160px;
    }
    .scope-field > span {
      color: #64748b;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .scope-field select,
    .scope-field input {
      height: 38px;
      padding: 0 12px;
      border: 1px solid #d1d9e6;
      border-radius: 10px;
      background: #fff;
      color: #0f172a;
      font-size: 12px;
      font-weight: 600;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .scope-field select:focus,
    .scope-field input:focus {
      border-color: #93c5fd;
      box-shadow: 0 0 0 4px rgba(147, 197, 253, 0.25);
    }
    .scope-field select:disabled { background: #f1f5f9; color: #94a3b8; }
    .scope-field-date { min-width: 130px; }
    .scope-reset {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 38px;
      padding: 0 14px;
      border-radius: 10px;
      border: 1px solid #fecaca;
      background: #fff1f2;
      color: #b91c1c;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .scope-reset svg { width: 14px; }

    /* ────────── KPI STRIP ────────── */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    /* ────────── MAIN GRID ────────── */
    .main-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.75fr) minmax(320px, 0.9fr);
      gap: 18px;
    }
    .side-column { display: grid; gap: 18px; min-width: 0; }

    /* ────────── PROJECT TABLE ────────── */
    .project-progress-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      margin-bottom: 14px;
      padding: 12px;
      background: #f1f5f9;
      border-radius: 12px;
    }
    .project-progress-stat {
      display: grid;
      gap: 4px;
      padding: 4px 10px;
      background: #fff;
      border-radius: 8px;
    }
    .project-progress-stat span {
      color: #64748b;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .project-progress-stat strong {
      color: #0f172a;
      font-size: 18px;
      font-weight: 800;
    }

    .project-table {
      display: grid;
      gap: 2px;
    }
    .project-table-head {
      display: grid;
      grid-template-columns: 1.8fr 1.1fr 1fr 1fr 1fr;
      gap: 12px;
      padding: 8px 14px;
      color: #64748b;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .project-row {
      display: grid;
      grid-template-columns: 1.8fr 1.1fr 1fr 1fr 1fr;
      align-items: center;
      gap: 12px;
      padding: 14px;
      border-radius: 12px;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .project-row:hover { background: #f8fafc; transform: translateY(-1px); }
    .project-cell-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .project-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, #eef2ff, #c7d2fe);
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 800;
      flex: 0 0 auto;
    }
    .project-main { display: grid; gap: 4px; min-width: 0; }
    .project-main strong {
      overflow: hidden;
      color: #0f172a;
      font-size: 13px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .project-main small {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      color: #64748b;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .status-badge.active { background: #dcfce7; color: #15803d; }
    .status-badge.on-hold { background: #fef3c7; color: #b45309; }
    .status-badge.completed { background: #e2e8f0; color: #475569; }

    .project-cell-progress {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .project-progress-bar {
      flex: 1;
      height: 6px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .project-progress-bar i {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: #1d4ed8;
      transition: width 0.4s ease;
    }
    .project-cell-progress strong {
      width: 40px;
      color: #0f172a;
      font-size: 12px;
      font-weight: 800;
      text-align: right;
    }
    .project-cell-value strong {
      display: block;
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
    }
    .project-cell-value strong.received { color: #15803d; }
    .project-cell-value strong.spent { color: #b45309; }

    /* ────────── ACTION INBOX ────────── */
    .action-list { display: grid; gap: 8px; }
    .action-item {
      display: grid;
      grid-template-columns: 44px 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 12px;
      background: #f8fafc;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .action-item:hover { background: #f1f5f9; transform: translateY(-1px); }
    .action-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #fef3c7;
      color: #b45309;
      font-size: 16px;
      font-weight: 800;
    }
    .action-item[data-tone="critical"] .action-count { background: #fee2e2; color: #b91c1c; }
    .action-item[data-tone="warning"] .action-count { background: #fef3c7; color: #b45309; }
    .action-item[data-tone="info"] .action-count { background: #dbeafe; color: #1d4ed8; }
    .action-copy { display: grid; gap: 3px; min-width: 0; }
    .action-copy strong { color: #0f172a; font-size: 13px; font-weight: 700; }
    .action-copy small {
      overflow: hidden;
      color: #64748b;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .action-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 700;
    }
    .action-link svg { width: 13px; }

    .quick-create {
      margin-top: 14px;
      padding: 14px;
      border-radius: 12px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }
    .quick-create-label {
      display: block;
      margin-bottom: 8px;
      color: #64748b;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .quick-create-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .quick-create-row button,
    .quick-create-row a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 38px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #fff;
      color: #1e293b;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .quick-create-row button:hover,
    .quick-create-row a:hover { border-color: #cbd5f5; color: #1d4ed8; }
    .quick-create-row svg { width: 14px; }

    /* ────────── STOCK ────────── */
    .stock-summary {
      display: grid;
      grid-template-columns: 44px 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid #bbf7d0;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    }
    .stock-summary.has-alerts {
      border-color: #fde68a;
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    }
    .stock-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.7);
      color: #047857;
    }
    .stock-summary.has-alerts .stock-icon { color: #b45309; }
    .stock-summary strong { color: #064e3b; font-size: 13px; font-weight: 800; }
    .stock-summary.has-alerts strong { color: #78350f; }
    .stock-summary small { color: #475569; font-size: 11px; }
    .stock-summary.has-alerts small { color: #92400e; }
    .stock-summary a {
      padding: 6px 12px;
      border-radius: 8px;
      background: #fff;
      color: #047857;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 4px 8px -4px rgba(0, 0, 0, 0.1);
    }
    .stock-summary.has-alerts a { color: #b45309; }

    .stock-list {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    .stock-row {
      display: grid;
      grid-template-columns: 1.3fr 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      border-radius: 10px;
      background: #f8fafc;
    }
    .stock-name {
      overflow: hidden;
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stock-progress {
      height: 6px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .stock-progress i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #f97316, #fbbf24);
    }
    .stock-progress i.danger { background: linear-gradient(90deg, #ef4444, #f97316); }
    .stock-meta { display: grid; gap: 1px; text-align: right; }
    .stock-meta strong { color: #b45309; font-size: 12px; font-weight: 800; }
    .stock-meta small { color: #64748b; font-size: 10px; }
    .stock-empty {
      margin-top: 12px;
      padding: 12px;
      text-align: center;
      color: #64748b;
      font-size: 11px;
      border-radius: 10px;
      background: #f8fafc;
    }

    /* ────────── APPROVALS ────────── */
    .approval-list { display: grid; gap: 4px; }
    .approval-row {
      display: grid;
      grid-template-columns: 36px 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 10px 8px;
      border-radius: 10px;
      transition: background 0.15s ease;
    }
    .approval-row:hover { background: #f8fafc; }
    .approval-type {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #fef3c7;
      color: #b45309;
      font-size: 11px;
      font-weight: 800;
    }
    .approval-copy { display: grid; gap: 2px; min-width: 0; }
    .approval-copy strong {
      overflow: hidden;
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .approval-copy small {
      overflow: hidden;
      color: #64748b;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .approval-row time {
      color: #94a3b8;
      font-size: 11px;
      font-weight: 600;
    }

    /* ────────── CASH TREND ────────── */
    .cash-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.9fr);
      gap: 18px;
    }
    .cash-section agb-bar-chart { display: block; padding-bottom: 4px; }
    .cash-totals {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      padding: 16px 22px 20px;
      border-top: 1px solid #f1f5f9;
    }
    .cash-total {
      display: grid;
      gap: 4px;
      padding: 12px;
      border-radius: 12px;
      background: #f8fafc;
    }
    .cash-total-label {
      color: #64748b;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .cash-total-value {
      color: #0f172a;
      font-size: 16px;
      font-weight: 800;
    }
    .cash-total-value.received { color: #047857; }
    .cash-total-value.spent { color: #b45309; }

    /* ────────── BOTTOM GRID ────────── */
    .bottom-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
      gap: 18px;
    }

    .payment-list { display: grid; gap: 4px; }
    .payment-row {
      display: grid;
      grid-template-columns: 36px 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 12px 8px;
      border-radius: 10px;
      transition: background 0.15s ease;
    }
    .payment-row:hover { background: #f8fafc; }
    .payment-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #dcfce7;
      color: #047857;
    }
    .payment-icon svg { width: 16px; }
    .payment-copy { display: grid; gap: 2px; min-width: 0; }
    .payment-copy strong {
      overflow: hidden;
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .payment-copy small {
      overflow: hidden;
      color: #64748b;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .payment-amount {
      color: #047857;
      font-size: 13px;
      font-weight: 800;
    }

    /* ────────── OPERATIONS TILES ────────── */
    .ops-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .op-tile {
      display: grid;
      grid-template-rows: auto auto auto;
      gap: 8px;
      padding: 16px;
      border-radius: 14px;
      background: #f8fafc;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      position: relative;
      overflow: hidden;
    }
    .op-tile:hover { transform: translateY(-2px); box-shadow: 0 12px 22px -16px rgba(15, 23, 42, 0.35); }
    .op-tile::after {
      content: "→";
      position: absolute;
      top: 14px;
      right: 14px;
      color: #94a3b8;
      font-size: 14px;
    }
    .op-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
    }
    .op-icon svg { width: 18px; }
    .op-tile.primary { background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); }
    .op-tile.primary .op-icon { background: #c7d2fe; color: #1d4ed8; }
    .op-tile.primary strong { color: #1d4ed8; }
    .op-tile.violet { background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); }
    .op-tile.violet .op-icon { background: #ddd6fe; color: #6d28d9; }
    .op-tile.violet strong { color: #6d28d9; }
    .op-tile.success { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); }
    .op-tile.success .op-icon { background: #a7f3d0; color: #047857; }
    .op-tile.success strong { color: #047857; }
    .op-tile.warning { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); }
    .op-tile.warning .op-icon { background: #fde68a; color: #b45309; }
    .op-tile.warning strong { color: #b45309; }
    .op-tile.danger { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); }
    .op-tile.danger .op-icon { background: #fecaca; color: #b91c1c; }
    .op-tile.danger strong { color: #b91c1c; }
    .op-tile.neutral { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); }
    .op-tile.neutral .op-icon { background: #cbd5f5; color: #475569; }
    .op-tile.neutral strong { color: #475569; }
    .op-tile strong {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .op-tile small {
      color: #475569;
      font-size: 11px;
      font-weight: 600;
    }

    /* ────────── PERFORMERS ────────── */
    .performer-list { display: grid; gap: 10px; }
    .performer-row {
      display: grid;
      grid-template-columns: 28px 1fr 1.4fr auto;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      border-radius: 12px;
      background: #f8fafc;
    }
    .performer-rank {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: #fff;
      color: #475569;
      font-size: 11px;
      font-weight: 800;
      border: 1px solid #e2e8f0;
    }
    .performer-copy { display: grid; gap: 1px; min-width: 0; }
    .performer-copy strong {
      overflow: hidden;
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .performer-copy small {
      overflow: hidden;
      color: #64748b;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .performer-bar {
      height: 8px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .performer-bar i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #1d4ed8, #3b82f6);
    }
    .performer-bar i.warning { background: linear-gradient(90deg, #f97316, #fbbf24); }
    .performer-bar i.danger { background: linear-gradient(90deg, #ef4444, #f97316); }
    .performer-score {
      width: 48px;
      color: #0f172a;
      font-size: 12px;
      font-weight: 800;
      text-align: right;
    }

    /* ────────── FOOTER ────────── */
    .dashboard-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 4px;
      color: #64748b;
      font-size: 11px;
    }
    .dashboard-footer strong { color: #0f172a; font-weight: 700; }
    .dashboard-footer nav { display: flex; gap: 18px; }
    .dashboard-footer a {
      color: #475569;
      font-weight: 700;
      transition: color 0.15s ease;
    }
    .dashboard-footer a:hover { color: #1d4ed8; }

    /* ────────── RESPONSIVE ────────── */
    @media (max-width: 1280px) {
      .kpi-strip { grid-template-columns: repeat(2, 1fr); }
      .main-grid, .cash-grid { grid-template-columns: 1fr; }
      .bottom-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 920px) {
      .dashboard-shell { padding: 20px 16px 48px; }
      .hero { padding: 24px; flex-direction: column; }
      .hero-actions { width: 100%; }
      .hero-actions .hero-button { flex: 1; justify-content: center; }
      .project-table-head { display: none; }
      .project-row {
        grid-template-columns: 1fr auto;
        gap: 10px;
        padding: 14px;
      }
      .project-cell-progress { grid-column: 1 / -1; }
      .project-cell-value strong { font-size: 13px; }
    }
    @media (max-width: 640px) {
      .kpi-strip { grid-template-columns: 1fr; }
      .bottom-grid { grid-template-columns: 1fr; }
      .ops-grid { grid-template-columns: 1fr 1fr; }
      .cash-totals { grid-template-columns: 1fr; }
      .project-progress-strip { grid-template-columns: 1fr 1fr; }
      .scope-bar { flex-direction: column; align-items: stretch; }
      .scope-summary { min-width: 0; margin-right: 0; }
      .scope-field, .scope-field-date { min-width: 0; width: 100%; }
    }
  `],
})
export class UniversalDashboardPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly data = inject(ErpDataService);
  private readonly approvals = inject(ApprovalsService);

  readonly kpis = signal<DashboardKpis | null>(null);
  readonly approvalRows = signal<any[]>([]);
  readonly loadingKpis = signal(true);
  readonly refreshing = signal(false);
  readonly lastUpdatedAt = signal<Date | null>(null);

  readonly selectedProjectId = signal("");
  readonly selectedSiteId = signal("");
  readonly periodKey = signal<PeriodKey>("month");
  readonly customFrom = signal("");
  readonly customTo = signal("");

  readonly showClientDialog = signal(false);
  readonly showProjectDialog = signal(false);
  readonly showVendorDialog = signal(false);

  readonly projects = computed(() => this.data.projects() as any[]);
  readonly payments = computed(() => this.data.payments() as any[]);
  readonly expenses = computed(() => [
    ...(this.data.expenses() as any[]),
    ...(this.data.generalExpenses() as any[]),
  ]);

  readonly userName = computed(() => {
    const user = this.api.user() as any;
    return user?.name?.split(" ")?.[0] || user?.fullName?.split(" ")?.[0] || "there";
  });

  readonly availableSites = computed(() => {
    const projectId = this.selectedProjectId();
    if (!projectId) return [];
    return (this.data.siteEntities() as any[])
      .filter(
        (site) =>
          String(site.projectId || "") === projectId ||
          site.projectIds?.some((id: any) => String(id) === projectId),
      )
      .filter((site) => site.name && site.name.trim().toLowerCase() !== "main site")
      .map((site) => ({ id: String(site.id || site._id), name: site.name }));
  });

  readonly selectedScopeLabel = computed(() => {
    const projectId = this.selectedProjectId();
    if (!projectId) return "All projects";
    const project = this.projects().find((item) => String(item.id || item._id) === projectId);
    const site = this.availableSites().find((item) => item.id === this.selectedSiteId());
    return site ? `${project?.name || "Project"} · ${site.name}` : project?.name || "Selected project";
  });

  readonly periodLabel = computed(() => {
    const period = this.periodKey();
    if (period === "custom") {
      return this.customFrom() && this.customTo()
        ? `${this.formatDate(this.customFrom())} – ${this.formatDate(this.customTo())}`
        : "Custom period";
    }
    return ({
      today: "Today",
      week: "Last 7 days",
      month: "This month",
      "3m": "Last 3 months",
      "6m": "Last 6 months",
      year: "This year",
    } as const)[period];
  });

  readonly currentDateLabel = computed(() =>
    new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  );

  readonly scopedProjects = computed(() => {
    const projectId = this.selectedProjectId();
    return projectId
      ? this.projects().filter((project) => String(project.id || project._id) === projectId)
      : this.projects();
  });

  readonly scopedPayments = computed(() => this.payments().filter((row) => this.matchesScope(row, true)));
  readonly scopedExpenses = computed(() => this.expenses().filter((row) => this.matchesScope(row, true)));

  readonly financials = computed(() => {
    const raw = this.kpis()?.financials || {};
    const hasScope = !!this.selectedProjectId() || !!this.selectedSiteId();
    const periodReceived = this.scopedPayments().reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const spent = this.scopedExpenses().reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const projectValueFromRows = this.scopedProjects().reduce(
      (sum, project) => sum + Number(project.totalValue || project.value || 0),
      0,
    );
    const receivedFromRows = this.scopedProjects().reduce(
      (sum, project) => sum + Number(project.receivedAmount || project.received || 0),
      0,
    );
    const projectValue = projectValueFromRows || Number(raw.totalProjectValue || 0);
    const lifetimeReceived = receivedFromRows || Number(raw.totalReceived || 0);
    return {
      totalProjectValue: projectValue,
      totalReceived: periodReceived,
      lifetimeReceived,
      totalPending: hasScope ? Math.max(0, projectValue - lifetimeReceived) : Number(raw.totalPending || 0),
      totalSpent: spent,
    };
  });

  readonly totalExpenses = computed(() => this.financials().totalSpent);
  readonly netCashPosition = computed(() => this.financials().totalReceived - this.totalExpenses());
  readonly collectionRate = computed(() => {
    const value = this.financials().totalProjectValue;
    return value > 0
      ? Math.round(Math.min(100, Math.max(0, (this.financials().lifetimeReceived / value) * 100)))
      : 0;
  });

  readonly activeProjectCount = computed(
    () => this.scopedProjects().filter((project) => String(project.status || "active").toLowerCase() === "active").length,
  );
  readonly onHoldCount = computed(
    () => this.scopedProjects().filter((project) => String(project.status || "").toLowerCase().includes("hold")).length,
  );
  readonly completedCount = computed(
    () => this.scopedProjects().filter((project) => String(project.status || "").toLowerCase().includes("complete")).length,
  );
  readonly avgProgress = computed(() => {
    const list = this.scopedProjects();
    if (!list.length) return 0;
    const total = list.reduce(
      (sum, project) =>
        sum + Math.min(100, Math.max(0, Number(project.completion || project.progress || 0))),
      0,
    );
    return Math.round(total / list.length);
  });

  readonly activeClientCount = computed(
    () => this.kpis()?.counts?.clients?.active ?? this.data.clients().length,
  );
  readonly activeVendorCount = computed(
    () => this.kpis()?.counts?.vendors?.active ?? this.data.vendors().length,
  );

  readonly inventoryItemCount = computed(
    () =>
      new Set(
        (this.data.inventory() as any[])
          .filter((row) => this.matchesScope(row, false))
          .map((row) => String(row.normalizedName || row.name || "").toLowerCase()),
      ).size,
  );

  readonly lowStockRows = computed(() => {
    const rows = (this.data.inventory() as any[]).filter((row) => {
      if (!this.matchesScope(row, false)) return false;
      const remaining = Number(row.remainingStock || 0);
      const minimum = Number(row.minimumQuantity || 0);
      return minimum > 0 && remaining <= minimum;
    });
    return rows
      .map((row) => {
        const remaining = Number(row.remainingStock || 0);
        const minimum = Number(row.minimumQuantity || 0);
        const percent = minimum > 0 ? Math.min(100, Math.round((remaining / minimum) * 100)) : 0;
        return {
          id: String(row.id || row._id || row.normalizedName || row.name),
          name: row.normalizedName || row.name || "Material",
          remaining,
          minimum,
          percent,
        };
      })
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 5);
  });
  readonly lowStockCount = computed(() =>
    (this.data.inventory() as any[]).filter((row) => {
      if (!this.matchesScope(row, false)) return false;
      const remaining = Number(row.remainingStock || 0);
      const minimum = Number(row.minimumQuantity || 0);
      return minimum > 0 && remaining <= minimum;
    }).length,
  );

  private readonly palette = ["#1d4ed8", "#7c3aed", "#0d9488", "#db2777", "#ea580c", "#0891b2", "#4f46e5", "#16a34a"];

  readonly projectHealth = computed(() => {
    const list = this.scopedProjects();
    return list
      .map((project, index) => {
        const name = project.name || "Unnamed project";
        const spent =
          Number(project.materialSpend || 0) +
          Number(project.labourPayable || 0) +
          Number(project.subcontractorSpend || 0) +
          Number(project.expenses || 0);
        return {
          id: String(project.id || project._id || ""),
          clientId: String(project.clientId || project.client?._id || ""),
          name,
          initials: name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase(),
          client: project.clientName || project.client?.name || project.client || "",
          status: project.status || "Active",
          value: Number(project.totalValue || project.value || 0),
          received: Number(project.receivedAmount || project.received || 0),
          spent,
          progress: Math.round(Math.min(100, Math.max(0, Number(project.completion || project.progress || 0)))),
          color: this.palette[index % this.palette.length],
        };
      })
      .sort(
        (a, b) =>
          (a.status === "Active" ? -1 : 1) - (b.status === "Active" ? -1 : 1) || b.value - a.value,
      )
      .slice(0, 8);
  });

  readonly actionQueue = computed<ActionItem[]>(() => {
    const activity = this.kpis()?.recentActivity || {};
    const items: ActionItem[] = [];
    const pendingApprovals = this.approvalRows().filter(
      (row) => !this.selectedProjectId() || String(row.projectId || "") === this.selectedProjectId(),
    ).length;
    const approvals = this.selectedProjectId()
      ? pendingApprovals
      : Math.max(pendingApprovals, Number(this.kpis()?.counts?.approvals?.pending || 0));
    if (approvals > 0) {
      items.push({
        id: "approvals",
        label: "Approvals waiting",
        detail: "Requests need a decision before work can continue.",
        count: approvals,
        tone: "critical",
        route: "/approvals",
        action: "Review",
      });
    }
    if (this.lowStockCount() > 0) {
      items.push({
        id: "stock",
        label: "Low-stock materials",
        detail: "Replenish inventory to prevent site delays.",
        count: this.lowStockCount(),
        tone: "warning",
        route: "/projects",
        action: "Inspect",
      });
    }
    if (Number(activity.pendingMaterials || 0) > 0) {
      items.push({
        id: "materials",
        label: "Material requests pending",
        detail: "Sites are waiting for requested materials.",
        count: Number(activity.pendingMaterials),
        tone: "warning",
        route: "/approvals",
        action: "Review",
      });
    }
    if (Number(activity.pendingPayments || 0) > 0) {
      items.push({
        id: "payments",
        label: "Payments pending",
        detail: "Payment records require confirmation.",
        count: Number(activity.pendingPayments),
        tone: "info",
        route: "/approvals",
        action: "Review",
      });
    }
    if (Number(activity.pendingExpenses || 0) > 0) {
      items.push({
        id: "expenses",
        label: "Expenses pending",
        detail: "Expense entries are awaiting review.",
        count: Number(activity.pendingExpenses),
        tone: "info",
        route: "/approvals",
        action: "Review",
      });
    }
    return items.slice(0, 5);
  });

  readonly topApprovals = computed(() => {
    const palette = ["#1d4ed8", "#7c3aed", "#0d9488", "#ea580c", "#db2777"];
    return this.approvalRows()
      .filter((row) => !this.selectedProjectId() || String(row.projectId || "") === this.selectedProjectId())
      .slice(0, 5)
      .map((row, index) => {
        const module = String(row.module || row.type || "Request").replace(/_/g, " ");
        return {
          id: String(row.rowId || row.id || row._id || `${module}-${row.createdAt || index}`),
          module,
          initials: module.slice(0, 2).toUpperCase(),
          projectName: row.projectName || "General",
          requestedBy: row.requestedBy || row.submittedBy || "Team member",
          createdAt: row.createdAt || row.requestedDate || row.date,
          color: palette[index % palette.length] + "1f",
        };
      });
  });

  readonly recentPayments = computed(() =>
    [...this.scopedPayments()]
      .sort(
        (a, b) =>
          this.dateValue(b.date || b.paymentDate || b.createdAt) -
          this.dateValue(a.date || a.paymentDate || a.createdAt),
      )
      .slice(0, 5)
      .map((row) => ({
        id: String(row.id || row._id || ""),
        clientId: String(row.clientId || row.client?._id || ""),
        clientName: row.clientName || row.client?.name || row.client || "Client",
        projectName: row.projectName || row.project?.name || row.project || "General payment",
        amount: Number(row.amount || 0),
        date: row.date || row.paymentDate || row.createdAt,
      })),
  );

  readonly financialLabels = computed(() => this.trendBuckets().map((bucket) => bucket.label));
  readonly financialSeries = computed<BarChartSeries[]>(() => {
    const buckets = this.trendBuckets();
    return [
      { label: "Received", color: "#10b981", values: buckets.map((bucket) => this.sumBucket(this.scopedPayments(), bucket)) },
      { label: "Expenses", color: "#f97316", values: buckets.map((bucket) => this.sumBucket(this.scopedExpenses(), bucket)) },
    ];
  });
  readonly financialLegend = [
    { label: "Received", color: "#10b981" },
    { label: "Expenses", color: "#f97316" },
  ];
  readonly hasFinancialTrend = computed(() => this.financialSeries().some((series) => series.values.some((value) => value > 0)));

  readonly expenseDonut = computed<DonutSegment[]>(() => {
    const totals = { materials: 0, labour: 0, subcontractors: 0, expenses: 0 };
    for (const row of this.scopedExpenses() as any[]) {
      const module = String(row.module || row.category || row.type || "").toLowerCase();
      const amount = Math.abs(Number(row.amount || 0));
      if (!amount) continue;
      if (module.includes("material")) totals.materials += amount;
      else if (module.includes("labour") || module.includes("labor")) totals.labour += amount;
      else if (module.includes("sub")) totals.subcontractors += amount;
      else totals.expenses += amount;
    }
    const segments: DonutSegment[] = [
      { label: "Materials", value: totals.materials, color: "#2563eb" },
      { label: "Labour", value: totals.labour, color: "#16a34a" },
      { label: "Subcontractors", value: totals.subcontractors, color: "#f59e0b" },
      { label: "Other expenses", value: totals.expenses, color: "#a855f7" },
    ].filter((seg) => seg.value > 0);
    return segments;
  });

  readonly periodTotals = computed(() => {
    const received = this.financials().totalReceived;
    const spent = this.financials().totalSpent;
    return { received, spent, net: received - spent };
  });

  // ────────── PERIOD-OVER-PERIOD DELTAS ──────────
  private readonly previousPeriodRange = computed(() => {
    const current = this.periodRange();
    const span = current.to.getTime() - current.from.getTime();
    const prevTo = new Date(current.from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - span);
    return { from: prevFrom, to: prevTo };
  });

  private readonly previousReceived = computed(() => {
    const range = this.previousPeriodRange();
    return this.payments()
      .filter((row) => this.matchesProject(row) && this.inRange(row, range))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  });

  private readonly previousSpent = computed(() => {
    const range = this.previousPeriodRange();
    return this.expenses()
      .filter((row) => this.matchesProject(row) && this.inRange(row, range))
      .reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
  });

  readonly kpiReceivedDelta = computed(() => this.delta(this.financials().totalReceived, this.previousReceived()));
  readonly kpiSpentDelta = computed(() => this.delta(this.totalExpenses(), this.previousSpent()));
  readonly kpiNetDelta = computed(() =>
    this.delta(this.netCashPosition(), this.previousReceived() - this.previousSpent()),
  );

  readonly topPerformers = computed(() => {
    return this.projectHealth()
      .map((project) => {
        const score = project.value > 0 ? Math.round((project.received / project.value) * 100) : 0;
        const tone = score >= 75 ? "success" : score >= 40 ? "warning" : "danger";
        return { id: project.id, name: project.name, client: project.client, score, tone };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  });

  readonly heroSubline = computed(() => {
    const projects = this.activeProjectCount();
    const pending = this.financials().totalPending;
    if (!projects && !pending) {
      return "Set up a project to start tracking revenue and spend.";
    }
    return `${projects} active project${projects === 1 ? "" : "s"} · ${this.collectionRate()}% of ${this.money(
      this.financials().totalProjectValue,
    )} collected so far.`;
  });

  readonly netSubtitle = computed(() => {
    const position = this.netCashPosition();
    return position >= 0
      ? "Positive operating cash flow this period"
      : "Spending is outpacing collections this period";
  });

  readonly hasActiveFilters = computed(
    () => !!this.selectedProjectId() || !!this.selectedSiteId() || this.periodKey() !== "month",
  );

  ngOnInit(): void {
    void this.refreshAll();
  }

  async refreshAll(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.loadingKpis.set(true);
    try {
      const [kpisResult, approvalsResult] = await Promise.allSettled([
        firstValueFrom(this.api.getKPIs()),
        this.approvals.fetchApprovals({ status: "Pending", limit: 25 }),
      ]);
      if (kpisResult.status === "fulfilled") this.kpis.set((kpisResult.value as any)?.kpis || null);
      if (approvalsResult.status === "fulfilled") this.approvalRows.set((approvalsResult.value || []) as any[]);
      this.lastUpdatedAt.set(new Date());
    } finally {
      this.loadingKpis.set(false);
      this.refreshing.set(false);
    }
  }

  onProjectChange(value: string): void {
    this.selectedProjectId.set(value || "");
    this.selectedSiteId.set("");
  }
  onSiteChange(value: string): void {
    this.selectedSiteId.set(value || "");
  }
  onPeriodChange(value: string): void {
    this.periodKey.set((value || "month") as PeriodKey);
    if (value !== "custom") {
      this.customFrom.set("");
      this.customTo.set("");
    }
  }
  onCustomFromChange(value: string): void {
    this.customFrom.set(value || "");
  }
  onCustomToChange(value: string): void {
    this.customTo.set(value || "");
  }
  clearFilters(): void {
    this.selectedProjectId.set("");
    this.selectedSiteId.set("");
    this.periodKey.set("month");
    this.customFrom.set("");
    this.customTo.set("");
  }

  openClientDialog(): void {
    this.showClientDialog.set(true);
  }
  closeClientDialog(): void {
    this.showClientDialog.set(false);
  }
  onClientCreated(): void {
    this.closeClientDialog();
    void this.refreshAll();
  }
  openProjectDialog(): void {
    this.showProjectDialog.set(true);
  }
  closeProjectDialog(): void {
    this.showProjectDialog.set(false);
  }
  onProjectCreated(): void {
    this.closeProjectDialog();
    void this.refreshAll();
  }
  openVendorDialog(): void {
    this.showVendorDialog.set(true);
  }
  closeVendorDialog(): void {
    this.showVendorDialog.set(false);
  }
  onVendorCreated(): void {
    this.closeVendorDialog();
    void this.refreshAll();
  }

  projectRoute(project: any): any[] {
    return project.clientId && project.id
      ? ["/clients", project.clientId, "projects", project.id]
      : ["/projects"];
  }

  statusClass(status: string): string {
    const value = String(status || "").toLowerCase();
    if (value.includes("hold")) return "on-hold";
    if (value.includes("complete")) return "completed";
    return "active";
  }

  greeting(): string {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }
  money(value: number | null | undefined): string {
    return formatMoney(Number(value || 0));
  }
  number(value: number | null | undefined): string {
    return formatNumber(Number(value || 0));
  }
  formatNumberValue = (value: number): string => formatMoney(value);
  formatDate(value: string | Date | null | undefined): string {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  relativeTime(value: string | Date | null | undefined): string {
    if (!value) return "";
    const difference = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(difference) || difference < 60_000) return "just now";
    if (difference < 3_600_000) return `${Math.floor(difference / 60_000)}m ago`;
    if (difference < 86_400_000) return `${Math.floor(difference / 3_600_000)}h ago`;
    return `${Math.floor(difference / 86_400_000)}d ago`;
  }

  // ────────── HELPERS ──────────
  private matchesScope(row: any, includePeriod: boolean): boolean {
    if (!this.matchesProject(row)) return false;
    if (!this.matchesSite(row)) return false;
    if (!includePeriod) return true;
    const value = row.date || row.paymentDate || row.expenseDate || row.createdAt;
    return this.isInPeriod(value);
  }

  private matchesProject(row: any): boolean {
    const projectId = this.selectedProjectId();
    if (!projectId) return true;
    return String(row.projectId || row.project?._id || row.project || "") === projectId;
  }

  private matchesSite(row: any): boolean {
    const siteId = this.selectedSiteId();
    if (!siteId) return true;
    const selectedSiteName = this.availableSites().find((site) => site.id === siteId)?.name?.toLowerCase();
    const rowSiteId = String(row.siteId || row.site?._id || "");
    const rowSiteName = String(row.siteName || row.site?.name || row.site || "").toLowerCase();
    return rowSiteId === siteId || (!!selectedSiteName && rowSiteName === selectedSiteName);
  }

  private inRange(row: any, range: { from: Date; to: Date }): boolean {
    const value = row.date || row.paymentDate || row.expenseDate || row.createdAt;
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= range.from.getTime() && timestamp <= range.to.getTime();
  }

  private delta(current: number, previous: number): number {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private isInPeriod(value: string | Date | null | undefined): boolean {
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return false;
    const range = this.periodRange();
    return timestamp >= range.from.getTime() && timestamp <= range.to.getTime();
  }

  private periodRange(): { from: Date; to: Date } {
    const to = this.customTo() ? new Date(`${this.customTo()}T23:59:59`) : new Date();
    let from = new Date(to);
    if (this.periodKey() === "custom" && this.customFrom())
      return { from: new Date(`${this.customFrom()}T00:00:00`), to };
    switch (this.periodKey()) {
      case "today":
        from.setHours(0, 0, 0, 0);
        break;
      case "week":
        from.setDate(from.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        break;
      case "3m":
        from.setMonth(from.getMonth() - 2, 1);
        from.setHours(0, 0, 0, 0);
        break;
      case "6m":
        from.setMonth(from.getMonth() - 5, 1);
        from.setHours(0, 0, 0, 0);
        break;
      case "year":
        from = new Date(from.getFullYear(), 0, 1);
        break;
      default:
        from = new Date(from.getFullYear(), from.getMonth(), 1);
    }
    return { from, to };
  }

  private trendBuckets(): Array<{ label: string; from: Date; to: Date }> {
    const range = this.periodRange();
    const spanDays = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86_400_000));
    const buckets: Array<{ label: string; from: Date; to: Date }> = [];
    if (spanDays <= 14) {
      const cursor = new Date(range.from);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= range.to && buckets.length < 14) {
        const from = new Date(cursor);
        const to = new Date(cursor);
        to.setHours(23, 59, 59, 999);
        buckets.push({
          label: from.toLocaleDateString("en-IN", { weekday: "short" }),
          from,
          to,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      return buckets;
    }
    if (spanDays <= 45) {
      const cursor = new Date(range.from);
      while (cursor <= range.to && buckets.length < 7) {
        const from = new Date(cursor);
        const to = new Date(cursor);
        to.setDate(to.getDate() + 6);
        to.setHours(23, 59, 59, 999);
        if (to > range.to) to.setTime(range.to.getTime());
        buckets.push({
          label: from.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          from,
          to,
        });
        cursor.setDate(cursor.getDate() + 7);
      }
      return buckets;
    }
    const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
    while (cursor <= range.to && buckets.length < 12) {
      const from = new Date(cursor);
      const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({
        label: cursor.toLocaleDateString("en-IN", { month: "short" }),
        from,
        to,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
  }

  private sumBucket(rows: any[], bucket: { from: Date; to: Date }): number {
    return rows.reduce((sum, row) => {
      const value = row.date || row.paymentDate || row.expenseDate || row.createdAt;
      const timestamp = value ? new Date(value).getTime() : Number.NaN;
      return Number.isFinite(timestamp) &&
        timestamp >= bucket.from.getTime() &&
        timestamp <= bucket.to.getTime()
        ? sum + Math.abs(Number(row.amount || 0))
        : sum;
    }, 0);
  }

  private dateValue(value: string | Date | null | undefined): number {
    const timestamp = value ? new Date(value).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
}