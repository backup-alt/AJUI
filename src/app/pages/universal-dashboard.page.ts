import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonContent, IonSplitPane } from "@ionic/angular/standalone";
import { ApiService } from "../core/api.service";
import { ApprovalsService } from "../core/approvals.service";
import { ErpDataService } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { ClientFormDialogComponent } from "../shared/client-form-dialog.component";
import { ProjectFormDialogComponent } from "../shared/project-form-dialog.component";
import { VendorFormDialogComponent } from "../shared/vendor-form-dialog.component";
import { InventoryInitDialogComponent } from "../shared/inventory-init-dialog.component";
import { DashboardKpiCardComponent } from "../shared/dashboard-kpi-card.component";
import { DashboardSectionCardComponent } from "../shared/dashboard-section-card.component";
import { DashboardBarChartComponent, type BarChartSeries } from "../shared/dashboard-bar-chart.component";
import { DashboardDonutChartComponent, type DonutSegment } from "../shared/dashboard-donut-chart.component";
import { DataDetailDialogComponent, type DetailCardItem, type DetailColumn } from "../shared/data-detail-dialog.component";
import { formatMoney, formatNumber } from "../shared/format";

type PeriodKey = "today" | "week" | "month" | "3m" | "6m" | "year" | "custom";

interface DashboardKpis {
  counts: {
    clients: { total: number; active: number };
    projects: { total: number; active: number; onHold: number; completed: number };
    sites: { total: number; active: number };
    supervisors: { total: number; active: number; onLeave: number };
    vendors: { total: number; active: number };
    approvals: { pending: number; approved: number; rejected: number };
  };
  financials: {
    totalProjectValue: number;
    totalReceived: number;
    totalPending: number;
    totalMaterialSpend: number;
    totalLabourPayable: number;
    totalExpenseReceived: number;
    totalSubcontractorSpend: number;
    outstandingSubcontractValue: number;
  };
  recentActivity: {
    pendingApprovals: number;
    pendingMaterials: number;
    pendingExpenses: number;
    pendingPayments: number;
    pendingSubcontracts: number;
  };
}

interface ApprovalRow {
  rowId?: string;
  _id?: string;
  id?: string;
  module?: string;
  type?: string;
  status?: string;
  projectId?: string;
  projectName?: string;
  requestedBy?: string;
  createdAt?: string;
  requestedDate?: string;
  date?: string;
  amount?: number;
  materialName?: string;
  description?: string;
}

@Component({
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
    InventoryInitDialogComponent,
    DashboardKpiCardComponent,
    DashboardSectionCardComponent,
    DashboardBarChartComponent,
    DashboardDonutChartComponent,
    DataDetailDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="dashboard"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Dashboard"
          eyebrow="Operations Overview"
          metaLabel=""
          [blurred]="!!showClientDialog() || !!showProjectDialog() || !!showVendorDialog() || !!showInventoryInitDialog() || !!detailDialogType()"
          [showTitle]="false"
          searchPlaceholder="Search"
        />

        <ion-content class="erp-page">
          <main class="erp-overview-shell">
            <header class="erp-overview-hero">
              <div class="erp-overview-hero-text">
                <span class="erp-overview-eyebrow">Operations Overview</span>
                <h1 class="erp-overview-title">{{ greeting() }}, {{ userName() }}</h1>
                <p class="erp-overview-subtitle">{{ todayLabel() }} · {{ heroSubtitle() }}</p>
              </div>
              <div class="erp-overview-hero-meta">
                <span class="erp-overview-role-pill">{{ userRole() }}</span>
              </div>
            </header>

            <section class="erp-overview-filters" aria-label="Dashboard filters">
              <label class="erp-overview-filter">
                <span class="erp-overview-filter-label">Project</span>
                <select [value]="selectedProjectId()" (change)="onProjectChange($any($event.target).value)">
                  <option value="">All Projects</option>
                  @for (project of projects(); track project.id) {
                    <option [value]="project.id">{{ project.name }}</option>
                  }
                </select>
              </label>
              <label class="erp-overview-filter">
                <span class="erp-overview-filter-label">Site</span>
                <select [value]="selectedSiteId()" (change)="onSiteChange($any($event.target).value)" [disabled]="!selectedProjectId()">
                  <option value="">All Sites</option>
                  @for (site of availableSites(); track site.id) {
                    <option [value]="site.id">{{ site.name }}</option>
                  }
                </select>
              </label>
              <label class="erp-overview-filter">
                <span class="erp-overview-filter-label">Period</span>
                <select [value]="periodKey()" (change)="onPeriodChange($any($event.target).value)">
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="3m">Last 3 Months</option>
                  <option value="6m">Last 6 Months</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </label>
              @if (periodKey() === 'custom') {
                <label class="erp-overview-filter">
                  <span class="erp-overview-filter-label">From</span>
                  <input type="date" [value]="customFrom()" (change)="onCustomFromChange($any($event.target).value)" />
                </label>
                <label class="erp-overview-filter">
                  <span class="erp-overview-filter-label">To</span>
                  <input type="date" [value]="customTo()" (change)="onCustomToChange($any($event.target).value)" />
                </label>
              }
              @if (hasActiveFilters()) {
                <button type="button" class="erp-overview-clear" (click)="clearFilters()">Clear filters</button>
              }
            </section>

            <section class="erp-overview-row three-col" aria-label="Data summary">
              <button type="button" class="erp-summary-card" (click)="openDetailDialog('materials')">
                <span class="erp-summary-icon" data-accent="primary">
                  <svg viewBox="0 0 24 24" class="svg-icon"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </span>
                <div class="erp-summary-text">
                  <strong>{{ allMaterials().length }}</strong>
                  <span>Materials</span>
                </div>
                <small class="erp-summary-secondary">{{ formatMaterialSummary() }}</small>
              </button>
              <button type="button" class="erp-summary-card" (click)="openDetailDialog('inventory')">
                <span class="erp-summary-icon" data-accent="warning">
                  <svg viewBox="0 0 24 24" class="svg-icon"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
                </span>
                <div class="erp-summary-text">
                  <strong>{{ allInventory().length }}</strong>
                  <span>Inventory Items</span>
                </div>
                <small class="erp-summary-secondary">{{ formatInventorySummary() }}</small>
              </button>
              <button type="button" class="erp-summary-card" (click)="openDetailDialog('labour')">
                <span class="erp-summary-icon" data-accent="success">
                  <svg viewBox="0 0 24 24" class="svg-icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
                <div class="erp-summary-text">
                  <strong>{{ allLabour().length }}</strong>
                  <span>Labour Entries</span>
                </div>
                <small class="erp-summary-secondary">{{ formatLabourSummary() }}</small>
              </button>
            </section>

            <section class="erp-overview-kpi-grid" aria-label="Key metrics">
              <agb-kpi-card
                label="Total Project Value"
                [value]="filteredKpis()?.financials?.totalProjectValue ?? 0"
                [display]="money(filteredKpis()?.financials?.totalProjectValue)"
                subtitle="Across all projects"
                accent="primary"
                [loading]="loadingKpis()"
                iconPath="M3 12h18M12 3v18"
              ></agb-kpi-card>
              <agb-kpi-card
                label="Amount Received"
                [value]="filteredKpis()?.financials?.totalReceived ?? 0"
                [display]="money(filteredKpis()?.financials?.totalReceived)"
                subtitle="Total client payments"
                accent="success"
                [loading]="loadingKpis()"
                iconPath="M5 13l4 4L19 7"
              ></agb-kpi-card>
              <agb-kpi-card
                label="Outstanding Amount"
                [value]="filteredKpis()?.financials?.totalPending ?? 0"
                [display]="money(filteredKpis()?.financials?.totalPending)"
                subtitle="Pending client balance"
                accent="warning"
                [loading]="loadingKpis()"
                iconPath="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
              ></agb-kpi-card>
              <agb-kpi-card
                label="Total Expenses"
                [value]="totalExpenses()"
                [display]="money(totalExpenses())"
                subtitle="Materials + Labour + Sub + Site"
                accent="danger"
                [loading]="loadingKpis()"
                iconPath="M3 7h18M3 12h18M3 17h18"
              ></agb-kpi-card>
              <agb-kpi-card
                label="Active Projects"
                [value]="filteredKpis()?.counts?.projects?.active ?? 0"
                [display]="numberDisplay(filteredKpis()?.counts?.projects?.active ?? 0)"
                [subtitle]="(filteredKpis()?.counts?.projects?.onHold ?? 0) + ' on hold, ' + (filteredKpis()?.counts?.projects?.completed ?? 0) + ' completed'"
                accent="info"
                [loading]="loadingKpis()"
                iconPath="M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4"
              ></agb-kpi-card>
            </section>

            <section class="erp-overview-row two-col">
              <agb-section-card
                eyebrow="Financial Overview"
                title="Revenue vs Expenses"
                description="Aggregated by month within the selected period."
                actionLabel="Open Payments"
                actionRoute="/clients"
                [loading]="loadingKpis()"
                [isEmpty]="!hasFinancialTrend()"
                emptyTitle="No financial activity yet"
                emptyMessage="No payments or expenses recorded for this period."
              >
                <agb-bar-chart
                  *ngIf="hasFinancialTrend()"
                  orientation="vertical"
                  [series]="financialSeries()"
                  [labels]="financialLabels()"
                  [legend]="financialLegend()"
                ></agb-bar-chart>
              </agb-section-card>

              <agb-section-card
                eyebrow="Expense Breakdown"
                title="Where money is going"
                description="By expense type, within the selected period."
                [loading]="loadingKpis()"
                [isEmpty]="donutSegments().length === 0"
                emptyTitle="No expenses recorded"
                emptyMessage="Add expenses to see the breakdown."
              >
                <agb-donut-chart
                  [segments]="donutSegments()"
                  caption="Expenses"
                  ariaLabel="Expense breakdown by category"
                ></agb-donut-chart>
              </agb-section-card>
            </section>

            <section class="erp-overview-row two-col">
              <agb-section-card
                eyebrow="Financial Summary"
                title="Headline numbers"
                [loading]="loadingKpis()"
              >
                <ul class="erp-overview-summary">
                  <li><span>Total Project Value</span><strong>{{ money(filteredKpis()?.financials?.totalProjectValue) }}</strong></li>
                  <li><span>Amount Received</span><strong class="text-success">{{ money(filteredKpis()?.financials?.totalReceived) }}</strong></li>
                  <li><span>Outstanding Amount</span><strong class="text-warning">{{ money(filteredKpis()?.financials?.totalPending) }}</strong></li>
                  <li><span>Total Expenses</span><strong class="text-danger">{{ money(totalExpenses()) }}</strong></li>
                  <li><span>Material Spend</span><strong>{{ money(filteredKpis()?.financials?.totalMaterialSpend) }}</strong></li>
                  <li><span>Labour Payable</span><strong>{{ money(filteredKpis()?.financials?.totalLabourPayable) }}</strong></li>
                  <li><span>Subcontractor Spend</span><strong>{{ money(filteredKpis()?.financials?.totalSubcontractorSpend) }}</strong></li>
                  <li><span>Outstanding Subcontract</span><strong>{{ money(filteredKpis()?.financials?.outstandingSubcontractValue) }}</strong></li>
                </ul>
              </agb-section-card>

              <agb-section-card
                eyebrow="Needs Your Attention"
                title="Action items"
                description="Auto-detected from real data signals."
                [isEmpty]="attentionItems().length === 0"
                emptyTitle="Everything is up to date"
                emptyMessage="No alerts at the moment."
              >
                <ul class="erp-overview-attention">
                  @for (item of attentionItems(); track item.key) {
                    <li [attr.data-severity]="item.severity">
                      <span class="erp-overview-attention-icon" aria-hidden="true">{{ item.icon }}</span>
                      <div class="erp-overview-attention-text">
                        <strong>{{ item.title }}</strong>
                        <span>{{ item.description }}</span>
                      </div>
                      <a class="erp-overview-attention-action" [routerLink]="item.route">{{ item.action }}</a>
                    </li>
                  }
                </ul>
              </agb-section-card>
            </section>

            <section class="erp-overview-row">
              <agb-section-card
                eyebrow="Project Performance"
                title="Top projects by value"
                description="Sorted by total contract value."
                actionLabel="View all projects"
                actionRoute="/projects"
                [loading]="loadingKpis()"
                [isEmpty]="topProjects().length === 0"
                emptyTitle="No projects yet"
                emptyMessage="Create your first project to start tracking performance."
                emptyActionLabel="Create project"
                emptyActionRoute="/projects"
              >
                @if (topProjects().length > 0) {
                  <agb-bar-chart
                    orientation="horizontal"
                    [series]="projectPerformanceSeries()"
                    [labels]="projectPerformanceLabels()"
                    [legend]="[{ label: 'Total Value', color: '#2563eb' }]"
                  ></agb-bar-chart>
                }
              </agb-section-card>
            </section>

            <section class="erp-overview-row">
              <agb-section-card
                eyebrow="Pending Approvals"
                title="Awaiting your decision"
                description="Top 5 most recent pending items."
                actionLabel="View all approvals"
                actionRoute="/approvals"
                [loading]="loadingApprovals()"
                [isEmpty]="topApprovals().length === 0"
                emptyTitle="No pending approvals"
                emptyMessage="You're all caught up."
              >
                <table class="erp-overview-table">
                  <thead>
                    <tr><th>Type</th><th>Project</th><th>Requested</th><th>Date</th><th></th></tr>
                  </thead>
                  <tbody>
                    @for (row of topApprovals(); track row.rowId) {
                      <tr>
                        <td><span class="erp-overview-pill">{{ row.module || row.type || '—' }}</span></td>
                        <td>{{ row.projectName || '—' }}</td>
                        <td>{{ row.requestedBy || '—' }}</td>
                        <td>{{ formatDate(row.createdAt || row.requestedDate || row.date) }}</td>
                        <td><a class="erp-overview-row-action" routerLink="/approvals">Review</a></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </agb-section-card>
            </section>

            <section class="erp-overview-row">
              <agb-section-card
                eyebrow="Client Collections"
                title="Recent payments"
                description="Latest client payments within the selected period."
                actionLabel="View clients"
                actionRoute="/clients"
                [loading]="loadingKpis()"
                [isEmpty]="recentPayments().length === 0"
                emptyTitle="No payments yet"
                emptyMessage="Record your first client payment to see it here."
                emptyActionLabel="Add payment"
                emptyActionRoute="/clients"
              >
                <div class="erp-overview-client-collections">
                  <div class="erp-overview-collection-summary">
                    <div class="erp-overview-collection-card"><span>Total Received</span><strong>{{ money(filteredKpis()?.financials?.totalReceived) }}</strong></div>
                    <div class="erp-overview-collection-card"><span>Outstanding</span><strong>{{ money(filteredKpis()?.financials?.totalPending) }}</strong></div>
                    <div class="erp-overview-collection-card"><span>Payments (this period)</span><strong>{{ recentPayments().length }}</strong></div>
                  </div>
                  <table class="erp-overview-table">
                    <thead>
                      <tr><th>Client</th><th>Project</th><th>Amount</th><th>Date</th><th>Mode</th></tr>
                    </thead>
                    <tbody>
                      @for (row of recentPayments(); track row.id) {
                        <tr>
                          <td>{{ row.clientName || row.client || '—' }}</td>
                          <td>{{ row.projectName || row.project || '—' }}</td>
                          <td><strong>{{ money(row.amount) }}</strong></td>
                          <td>{{ formatDate(row.date || row.paymentDate || row.createdAt) }}</td>
                          <td>{{ row.mode || row.paymentMode || '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </agb-section-card>
            </section>

            <section class="erp-overview-row">
              <agb-section-card
                eyebrow="Inventory Alerts"
                title="Stock requiring attention"
                description="Items at or below the minimum quantity threshold."
                actionLabel="View projects"
                actionRoute="/projects"
                [loading]="loadingKpis()"
                [isEmpty]="inventoryAlerts().length === 0"
                emptyTitle="Inventory levels are healthy"
                emptyMessage="All stock is above the minimum threshold."
              >
                <table class="erp-overview-table">
                  <thead>
                    <tr><th>Material</th><th>Site</th><th>Project</th><th>Remaining</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    @for (item of inventoryAlerts(); track item.id) {
                      <tr>
                        <td>{{ item.name }}</td>
                        <td>{{ item.site || '—' }}</td>
                        <td>{{ item.projectName || item.project || '—' }}</td>
                        <td>
                          <div class="erp-overview-stock-bar">
                            <span class="erp-overview-stock-fill" [style.width.%]="item.percent" [attr.data-status]="item.status"></span>
                          </div>
                          <small>{{ item.remaining }} {{ item.unit }}</small>
                        </td>
                        <td><span class="erp-overview-stock-pill" [attr.data-status]="item.status">{{ item.statusLabel }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </agb-section-card>
            </section>

            <section class="erp-overview-row">
              <agb-section-card
                eyebrow="Recent Activity"
                title="Latest system events"
                description="Aggregated from payments, materials, clients, vendors and projects."
                [loading]="loadingKpis()"
                [isEmpty]="activityFeed().length === 0"
                emptyTitle="No recent activity"
                emptyMessage="Activity will appear here as your team uses the system."
              >
                <ul class="erp-overview-activity">
                  @for (event of activityFeed(); track $index) {
                    <li>
                      <span class="erp-overview-activity-icon" [attr.data-kind]="event.kind" aria-hidden="true">
                        <svg viewBox="0 0 24 24" class="svg-icon"><path [attr.d]="event.iconPath"/></svg>
                      </span>
                      <div class="erp-overview-activity-text">
                        <strong>{{ event.title }}</strong>
                        <span>{{ event.subtitle }}</span>
                      </div>
                      <span class="erp-overview-activity-time">{{ relativeTime(event.timestamp) }}</span>
                    </li>
                  }
                </ul>
              </agb-section-card>
            </section>
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
      @if (showInventoryInitDialog()) {
        <agb-inventory-init-dialog
          [sites]="[]"
          [materialNames]="[]"
          [materialRows]="[]"
          presetSiteId=""
          (saved)="closeInventoryInitDialog()"
          (cancelled)="closeInventoryInitDialog()"
        ></agb-inventory-init-dialog>
      }
      @if (detailDialogType()) {
        <agb-data-detail-dialog
          [eyebrow]="detailDialogEyebrow()"
          [title]="detailDialogTitle()"
          [columns]="detailDialogColumns()"
          [rows]="detailDialogRows()"
          [cardMode]="detailDialogType() === 'inventory'"
          [cardItems]="detailDialogType() === 'inventory' ? inventoryCardItems() : []"
          (close)="closeDetailDialog()"
        ></agb-data-detail-dialog>
      }
    </ion-split-pane>
  `,
  styles: [`
    :host { display: block; }
    .erp-overview-shell {
      padding: 24px 28px 60px;
      display: flex;
      flex-direction: column;
      gap: 22px;
      background: #f7f9fc;
      min-height: 100%;
    }
    .erp-overview-hero {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .erp-overview-hero-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .erp-overview-eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ui-accent-dark, #1d4ed8);
    }
    .erp-overview-title {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.01em;
    }
    .erp-overview-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .erp-overview-hero-meta {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .erp-overview-role-pill {
      padding: 6px 12px;
      border-radius: 999px;
      background: var(--ui-accent-soft, #eff6ff);
      color: var(--ui-accent-dark, #1d4ed8);
      font-size: 12px;
      font-weight: 700;
    }

    .erp-overview-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding: 14px 16px;
      background: #ffffff;
      border: 1px solid #e5eaf1;
      border-radius: 14px;
      align-items: flex-end;
    }
    .erp-overview-filter {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 160px;
      flex: 1 1 160px;
    }
    .erp-overview-filter-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748b;
    }
    .erp-overview-filter select,
    .erp-overview-filter input {
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #ffffff;
      font-size: 13px;
      color: #0f172a;
      min-width: 0;
    }
    .erp-overview-filter select:disabled { background: #f1f5f9; color: #94a3b8; }
    .erp-overview-clear {
      align-self: flex-end;
      padding: 9px 14px;
      border-radius: 8px;
      border: 1px solid #fecaca;
      background: #fef2f2;
      color: #b91c1c;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .erp-overview-kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
    }
    .erp-overview-kpi-grid agb-kpi-card ::ng-deep .kpi-card {
      padding: 14px;
      gap: 6px;
    }
    .erp-overview-kpi-grid agb-kpi-card ::ng-deep .kpi-value {
      font-size: 20px;
    }
    .erp-overview-kpi-grid agb-kpi-card ::ng-deep .kpi-label {
      font-size: 11px;
    }
    .erp-overview-kpi-grid agb-kpi-card ::ng-deep .kpi-subtitle {
      font-size: 11px;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .erp-overview-kpi-grid agb-kpi-card ::ng-deep .kpi-icon {
      width: 24px;
      height: 24px;
    }
    .erp-overview-kpi-grid agb-kpi-card ::ng-deep .kpi-icon .svg-icon {
      width: 14px;
      height: 14px;
    }
    @media (max-width: 1200px) {
      .erp-overview-kpi-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 700px) {
      .erp-overview-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 480px) {
      .erp-overview-kpi-grid { grid-template-columns: 1fr; }
    }

    .erp-overview-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .erp-overview-row.two-col {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .erp-overview-row.three-col {
      grid-template-columns: repeat(3, 1fr);
    }
    @media (max-width: 1100px) {
      .erp-overview-row.two-col { grid-template-columns: 1fr; }
    }
    @media (max-width: 900px) {
      .erp-overview-row.three-col { grid-template-columns: 1fr; }
    }

    .erp-summary-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px;
      background: #ffffff;
      border: 1px solid #e5eaf1;
      border-radius: 16px;
      cursor: pointer;
      text-align: left;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      transition: box-shadow 160ms ease, transform 160ms ease;
    }
    .erp-summary-card:hover {
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      transform: translateY(-1px);
    }
    .erp-summary-card:focus-visible {
      outline: 2px solid var(--ui-accent, #2563eb);
      outline-offset: 2px;
    }
    .erp-summary-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }
    .erp-summary-icon[data-accent="primary"] { background: var(--ui-accent-soft, #eff6ff); color: var(--ui-accent-dark, #1d4ed8); }
    .erp-summary-icon[data-accent="warning"] { background: #fffbeb; color: #b45309; }
    .erp-summary-icon[data-accent="success"] { background: #ecfdf5; color: #047857; }
    .erp-summary-icon .svg-icon { width: 22px; height: 22px; }
    .erp-summary-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .erp-summary-text strong {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
    }
    .erp-summary-text span {
      font-size: 13px;
      color: #64748b;
      font-weight: 600;
    }
    .erp-summary-secondary {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 600;
      white-space: nowrap;
    }

    .erp-overview-summary {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .erp-overview-summary li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #f1f5f9;
      font-size: 13px;
    }
    .erp-overview-summary li:last-child { border-bottom: 0; }
    .erp-overview-summary li span { color: #64748b; }
    .erp-overview-summary li strong { color: #0f172a; font-weight: 800; }
    .erp-overview-summary li strong.text-success { color: #047857; }
    .erp-overview-summary li strong.text-warning { color: #b45309; }
    .erp-overview-summary li strong.text-danger { color: #b91c1c; }

    .erp-overview-projects {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    .erp-overview-project-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid #e5eaf1;
      background: #ffffff;
      text-decoration: none;
      color: #0f172a;
      transition: box-shadow 160ms ease, transform 160ms ease;
    }
    .erp-overview-project-card:hover { box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06); transform: translateY(-1px); }
    .erp-overview-project-card header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .erp-overview-project-card header strong { font-size: 14px; font-weight: 800; }
    .erp-overview-status {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      background: #ecfdf5;
      color: #047857;
    }
    .erp-overview-status[data-status="on-hold"] { background: #fef3c7; color: #92400e; }
    .erp-overview-status[data-status="completed"] { background: #e0e7ff; color: #3730a3; }
    .erp-overview-project-client {
      margin: 0;
      font-size: 12px;
      color: #64748b;
    }
    .erp-overview-project-bar {
      width: 100%;
      height: 6px;
      background: #f1f5f9;
      border-radius: 999px;
      overflow: hidden;
    }
    .erp-overview-project-progress {
      height: 100%;
      background: var(--ui-accent, #2563eb);
      transition: width 280ms ease;
    }
    .erp-overview-project-meta {
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px 12px;
    }
    .erp-overview-project-meta li { display: flex; justify-content: space-between; font-size: 12px; }
    .erp-overview-project-meta li span { color: #64748b; }
    .erp-overview-project-meta li strong { color: #0f172a; font-weight: 700; }

    .erp-overview-attention {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .erp-overview-attention li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid #f1f5f9;
      background: #fafbfd;
    }
    .erp-overview-attention li[data-severity="danger"] { border-left: 4px solid #dc2626; }
    .erp-overview-attention li[data-severity="warning"] { border-left: 4px solid #f59e0b; }
    .erp-overview-attention li[data-severity="info"] { border-left: 4px solid #0ea5e9; }
    .erp-overview-attention-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex: 0 0 auto;
    }
    .erp-overview-attention li[data-severity="danger"] .erp-overview-attention-icon { background: #fef2f2; color: #b91c1c; }
    .erp-overview-attention li[data-severity="warning"] .erp-overview-attention-icon { background: #fffbeb; color: #b45309; }
    .erp-overview-attention li[data-severity="info"] .erp-overview-attention-icon { background: #f0f9ff; color: #0369a1; }
    .erp-overview-attention-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .erp-overview-attention-text strong { font-size: 13px; font-weight: 800; }
    .erp-overview-attention-text span { font-size: 12px; color: #64748b; }
    .erp-overview-attention-action {
      padding: 7px 12px;
      border-radius: 8px;
      background: var(--ui-accent, #2563eb);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }

    .erp-overview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .erp-overview-table thead th {
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748b;
      padding: 8px 10px;
      border-bottom: 1px solid #e5eaf1;
      background: #fafbfd;
    }
    .erp-overview-table tbody td {
      padding: 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
    }
    .erp-overview-table tbody tr:hover { background: #fafbfd; }
    .erp-overview-pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 700;
      text-transform: capitalize;
    }
    .erp-overview-row-action {
      padding: 5px 10px;
      border-radius: 8px;
      background: var(--ui-accent-soft, #eff6ff);
      color: var(--ui-accent-dark, #1d4ed8);
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
    }

    .erp-overview-client-collections {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .erp-overview-collection-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }
    .erp-overview-collection-card {
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid #e5eaf1;
      background: #fafbfd;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .erp-overview-collection-card span {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748b;
    }
    .erp-overview-collection-card strong { font-size: 18px; font-weight: 800; color: #0f172a; }

    .erp-overview-stock-bar {
      width: 80px;
      height: 6px;
      background: #f1f5f9;
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .erp-overview-stock-fill { display: block; height: 100%; background: #16a34a; }
    .erp-overview-stock-fill[data-status="low"] { background: #f59e0b; }
    .erp-overview-stock-fill[data-status="out"] { background: #dc2626; }
    .erp-overview-stock-pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #ecfdf5;
      color: #047857;
    }
    .erp-overview-stock-pill[data-status="low"] { background: #fffbeb; color: #b45309; }
    .erp-overview-stock-pill[data-status="out"] { background: #fef2f2; color: #b91c1c; }

    .erp-overview-activity {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .erp-overview-activity li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #fafbfd;
    }
    .erp-overview-activity-icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--ui-accent-soft, #eff6ff);
      color: var(--ui-accent-dark, #1d4ed8);
      flex: 0 0 auto;
    }
    .erp-overview-activity-icon .svg-icon { width: 16px; height: 16px; }
    .erp-overview-activity-icon[data-kind="client"] { background: #ecfdf5; color: #047857; }
    .erp-overview-activity-icon[data-kind="payment"] { background: #ecfdf5; color: #047857; }
    .erp-overview-activity-icon[data-kind="vendor"] { background: #fdf4ff; color: #7e22ce; }
    .erp-overview-activity-icon[data-kind="material"] { background: #fffbeb; color: #b45309; }
    .erp-overview-activity-icon[data-kind="project"] { background: #eff6ff; color: #1d4ed8; }
    .erp-overview-activity-icon[data-kind="expense"] { background: #fef2f2; color: #b91c1c; }
    .erp-overview-activity-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .erp-overview-activity-text strong { font-size: 13px; font-weight: 700; color: #0f172a; }
    .erp-overview-activity-text span { font-size: 12px; color: #64748b; }
    .erp-overview-activity-time { font-size: 11px; color: #94a3b8; font-weight: 600; white-space: nowrap; }

    @media (max-width: 720px) {
      .erp-overview-shell { padding: 16px 14px 60px; }
      .erp-overview-title { font-size: 22px; }
      .erp-overview-filters { padding: 12px; }
      .erp-overview-filter { min-width: 0; flex: 1 1 100%; }
      .erp-overview-table { display: block; overflow-x: auto; white-space: nowrap; }
    }
  `],
})
export class UniversalDashboardPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly data = inject(ErpDataService);
  private readonly approvals = inject(ApprovalsService);

  readonly kpis = signal<DashboardKpis | null>(null);
  readonly loadingKpis = signal(true);
  readonly loadingApprovals = signal(true);
  readonly refreshing = signal(false);
  readonly approvalsList = signal<ApprovalRow[]>([]);

  readonly selectedProjectId = signal<string>('');
  readonly selectedSiteId = signal<string>('');
  readonly periodKey = signal<PeriodKey>('month');
  readonly customFrom = signal<string>('');
  readonly customTo = signal<string>('');

  readonly showClientDialog = signal(false);
  readonly showProjectDialog = signal(false);
  readonly showVendorDialog = signal(false);
  readonly showInventoryInitDialog = signal(false);
  readonly detailDialogType = signal<string | null>(null);

  readonly projects = computed(() => this.data.projects());
  readonly clients = computed(() => this.data.clients());
  readonly payments = computed(() => this.data.payments());
  readonly expenses = computed(() => this.data.expenses());
  readonly inventory = computed(() => this.data.inventory());
  readonly materials = computed(() => this.data.materials());
  readonly vendors = computed(() => this.data.vendors());
  readonly subcontractors = computed(() => this.data.subcontractors());

  readonly allMaterials = computed(() => this.data.materials());
  readonly allInventory = computed(() => this.data.inventory());
  readonly allLabour = computed(() => this.data.labour());

  readonly detailDialogEyebrow = computed(() => {
    const t = this.detailDialogType();
    if (t === 'materials') return 'Materials';
    if (t === 'inventory') return 'Inventory';
    if (t === 'labour') return 'Labour';
    return '';
  });

  readonly detailDialogTitle = computed(() => {
    const t = this.detailDialogType();
    if (t === 'materials') return 'All Material Requests';
    if (t === 'inventory') return 'All Inventory Items';
    if (t === 'labour') return 'All Labour Entries';
    return '';
  });

  readonly detailDialogColumns = computed<DetailColumn[]>(() => {
    const t = this.detailDialogType();
    if (t === 'materials') return [
      { key: 'clientName', label: 'Client' },
      { key: 'projectName', label: 'Project' },
      { key: 'site', label: 'Site' },
      { key: 'materialName', label: 'Material Name' },
      { key: 'unit', label: 'Unit' },
      { key: 'issuedAmount', label: 'Issued Amount' },
      { key: 'givenAmount', label: 'Given Amount' },
      { key: 'requested', label: 'Requested Quantity' },
      { key: 'approved', label: 'Approved Quantity' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'poNumber', label: 'PO Number' },
      { key: 'remainingStock', label: 'Remaining Stock' },
      { key: 'notes', label: 'Notes' },
      { key: 'status', label: 'Status' },
    ];
    if (t === 'inventory') return [
      { key: 'site', label: 'Site' },
      { key: 'remainingStock', label: 'Qty' },
      { key: 'unit', label: 'Unit' },
      { key: 'updatedAt', label: 'Last Updated' },
    ];
    if (t === 'labour') return [
      { key: 'clientName', label: 'Client' },
      { key: 'projectName', label: 'Project' },
      { key: 'site', label: 'Site' },
      { key: 'attendanceDate', label: 'Date' },
      { key: 'subcontractorName', label: 'Subcontractor' },
      { key: 'laborTypes', label: 'Labour Types' },
      { key: 'notes', label: 'Notes' },
      { key: 'presentCount', label: 'Staff Count' },
      { key: 'presentDays', label: 'Attendance' },
      { key: 'shift', label: 'Shift' },
    ];
    return [];
  });

  readonly inventoryCardItems = computed<DetailCardItem[]>(() => {
    const groups = new Map<string, any[]>();
    for (const row of this.allInventory() as any[]) {
      const key = String(row.normalizedName || (row.name || '').toLowerCase() || row.id || '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    const items: DetailCardItem[] = [];
    for (const [key, rows] of groups) {
      const first = rows[0];
      const totalStock = rows.reduce((s: number, r: any) => s + Number(r.remainingStock || 0), 0);
      items.push({
        id: key,
        label: first.name || 'Unnamed material',
        subtitle: `${rows.length} site${rows.length === 1 ? '' : 's'}`,
        badge: `${formatNumber(totalStock)} ${first.unit || ''}`.trim(),
      });
    }
    return items.sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly detailDialogRows = computed(() => {
    const t = this.detailDialogType();
    if (t === 'materials') return (this.allMaterials() as any[]).map((m: any) => ({
      clientName: m.clientName || '—',
      projectName: m.projectName || '—',
      site: m.site || '—',
      materialName: m.name || '—',
      unit: m.unit || '—',
      issuedAmount: m.issuedAmount ? formatMoney(m.issuedAmount) : '—',
      givenAmount: m.givenAmount ? formatMoney(m.givenAmount) : '—',
      requested: m.requested ?? m.requestedQuantity ?? '—',
      approved: m.approved ?? m.approvedQuantity ?? '—',
      vendor: m.vendor || '—',
      poNumber: m.poNumber || '—',
      remainingStock: m.remainingStock ?? '—',
      notes: m.notes || '—',
      status: m.status || '—',
    }));
    if (t === 'inventory') return (this.allInventory() as any[]).map((i: any) => ({
      __group: String(i.normalizedName || (i.name || '').toLowerCase() || i.id || ''),
      site: i.site || '—',
      remainingStock: i.remainingStock ?? '—',
      unit: i.unit || '—',
      updatedAt: i.updatedAt ? new Date(i.updatedAt).toLocaleDateString('en-IN') : '—',
    }));
    if (t === 'labour') {
      const clients = (this.clients() as any[]);
      const clientById = new Map(clients.map((c: any) => [String(c.id || c._id), c.name || '']));
      return (this.allLabour() as any[]).map((l: any) => {
        const laborTypes = Array.isArray(l.laborTypes)
          ? l.laborTypes.map((lt: any) => lt.name).filter(Boolean).join(', ')
          : '';
        return {
          clientName: clientById.get(String(l.clientId || '')) || l.clientName || '—',
          projectName: l.projectName || '—',
          site: l.site || '—',
          attendanceDate: l.attendanceDate ? new Date(l.attendanceDate).toLocaleDateString('en-IN') : '—',
          subcontractorName: l.subcontractorName || l.partyName || '—',
          laborTypes: laborTypes || l.category || '—',
          notes: l.notes || '—',
          presentCount: l.presentCount ?? '—',
          presentDays: l.presentDays ?? '—',
          shift: l.shift || '—',
        };
      });
    }
    return [];
  });

  readonly filteredKpis = computed(() => {
    const raw = this.kpis();
    const pid = this.selectedProjectId();
    const sid = this.selectedSiteId();
    if (!pid && !sid) return raw;
    if (!raw) return null;

    const fp = this.filterPayments(this.payments() as any[]);
    const fe = this.filterExpenses(this.expenses() as any[]);
    const fpids = new Set(fp.map((p: any) => String(p.projectId || p.project?._id || p.project || '')));
    const uniqueClients = new Set(fp.map((p: any) => String(p.clientId || p.client?._id || p.client || '')));
    const activeProjects = pid ? 1 : this.projects().filter((p: any) => fpids.has(String(p.id || p._id || ''))).length;

    const totalReceived = fp.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const totalMaterialSpend = fe.filter((e: any) => {
      const t = (e.type || e.expenseType || e.transactionType || '').toLowerCase();
      return t.includes('material');
    }).reduce((s: number, e: any) => s + Math.abs(Number(e.amount || 0)), 0);
    const totalLabourPayable = fe.filter((e: any) => {
      const t = (e.type || e.expenseType || e.transactionType || '').toLowerCase();
      return t.includes('labour') || t.includes('labor');
    }).reduce((s: number, e: any) => s + Math.abs(Number(e.amount || 0)), 0);
    const totalSubcontractorSpend = fe.filter((e: any) => {
      const t = (e.type || e.expenseType || e.transactionType || '').toLowerCase();
      return t.includes('subcontract');
    }).reduce((s: number, e: any) => s + Math.abs(Number(e.amount || 0)), 0);
    const totalExpenseReceived = fe.reduce((s: number, e: any) => s + Math.abs(Number(e.amount || 0)), 0) - totalMaterialSpend - totalLabourPayable - totalSubcontractorSpend;
    const totalProjectValue = pid
      ? this.projects().filter((p: any) => String(p.id || p._id) === pid).reduce((s: number, p: any) => s + Number(p.totalValue || 0), 0)
      : raw.financials.totalProjectValue;
    const totalPending = totalProjectValue - totalReceived;
    const pendingApprovals = pid ? (this.approvalsList() || []).filter((a: any) => String(a.projectId || '') === pid).length : raw.counts.approvals.pending;

    return {
      ...raw,
      counts: {
        ...raw.counts,
        projects: { ...raw.counts.projects, active: activeProjects },
        clients: { ...raw.counts.clients, active: uniqueClients.size || raw.counts.clients.active },
        approvals: { ...raw.counts.approvals, pending: pendingApprovals },
      },
      financials: {
        ...raw.financials,
        totalProjectValue,
        totalReceived,
        totalPending,
        totalMaterialSpend,
        totalLabourPayable,
        totalExpenseReceived,
        totalSubcontractorSpend,
      },
    } as DashboardKpis;
  });

  readonly userName = computed(() => {
    const u = this.api.user() as any;
    return u?.name || 'Admin';
  });
  readonly userRole = computed(() => {
    const u = this.api.user() as any;
    const r = (u?.role || 'admin').toString();
    return r.charAt(0).toUpperCase() + r.slice(1);
  });

  readonly availableSites = computed<any>(() => {
    const pid = this.selectedProjectId();
    if (!pid) return [];
    return this.data.siteEntities().filter((s: any) => {
      const belongs = String(s.projectId || '') === pid ||
        (Array.isArray(s.projectIds) && s.projectIds.some((p: any) => String(p) === pid));
      const name = (s.name || '').trim().toLowerCase();
      return belongs && name && name !== 'main site';
    }).map((s: any) => ({ id: String(s._id || s.id), name: s.name }));
  });

  readonly filteredProjects = computed<any>(() => {
    const pid = this.selectedProjectId();
    if (!pid) return this.projects();
    return this.projects().filter((p: any) => String(p.id) === pid);
  });

  readonly topProjects = computed(() => {
    return [...this.filteredProjects()]
      .sort((a: any, b: any) => (b.totalValue || 0) - (a.totalValue || 0))
      .slice(0, 8)
      .map((p: any) => ({
        id: String(p.id || ""),
        name: p.name || "Unnamed project",
        client: p.client || "",
        status: p.status || "Active",
        totalValue: Number(p.totalValue || 0),
        receivedAmount: Number(p.receivedAmount || 0),
        materialSpend: Number(p.materialSpend || 0),
        labourPayable: Number(p.labourPayable || 0),
        subcontractorSpend: Number(p.subcontractorSpend || 0),
        pendingBalance: Number(p.pendingBalance || 0),
        completion: Number(p.completion || 0),
        clientId: String(p.clientId || ""),
      }));
  });

  readonly totalExpenses = computed(() => {
    const f = this.filteredKpis()?.financials;
    if (!f) return 0;
    return (f.totalMaterialSpend || 0) +
      (f.totalLabourPayable || 0) +
      (f.totalSubcontractorSpend || 0) +
      (f.totalExpenseReceived || 0);
  });

  readonly lowStockCount = computed(() => {
    return this.filterInventory(this.inventory()).filter((i: any) => this.evaluateStock(i).severity !== 'healthy').length;
  });

  readonly inventoryAlerts = computed<any>(() => {
    return this.filterInventory(this.inventory())
      .map((i: any) => {
        const ev = this.evaluateStock(i);
        const remaining = Number(i.remainingStock || 0);
        const minimum = Number(i.minimumQuantity || 0);
        const ratio = minimum > 0 ? remaining / minimum : (remaining > 0 ? 1 : 0);
        return {
          id: String(i._id || i.id),
          name: i.name || '—',
          site: i.site || '—',
          projectName: i.projectName || '',
          remaining,
          unit: i.unit || '',
          percent: Math.max(0, Math.min(100, ratio * 100)),
          status: ev.severity,
          statusLabel: ev.label,
        };
      })
      .filter((row: any) => row.status !== 'healthy')
      .sort((a: any, b: any) => a.percent - b.percent)
      .slice(0, 10);
  });

  readonly attentionItems = computed<any>(() => {
    const items: Array<{
      key: string;
      icon: string;
      title: string;
      description: string;
      severity: 'danger' | 'warning' | 'info';
      route: any[];
      action: string;
    }> = [];
    const k = this.filteredKpis();
    if (k?.recentActivity?.pendingMaterials) {
      items.push({
        key: 'pending-materials',
        icon: '🟠',
        title: `${k.recentActivity.pendingMaterials} material request${k.recentActivity.pendingMaterials === 1 ? '' : 's'} pending approval`,
        description: 'Material requests awaiting your decision.',
        severity: 'warning',
        route: ['/approvals'],
        action: 'Review',
      });
    }
    if (k?.recentActivity?.pendingPayments) {
      items.push({
        key: 'pending-payments',
        icon: '🟠',
        title: `${k.recentActivity.pendingPayments} payment${k.recentActivity.pendingPayments === 1 ? '' : 's'} pending`,
        description: 'Client payments awaiting your approval.',
        severity: 'warning',
        route: ['/approvals'],
        action: 'Review',
      });
    }
    if (k?.recentActivity?.pendingExpenses) {
      items.push({
        key: 'pending-expenses',
        icon: '🟠',
        title: `${k.recentActivity.pendingExpenses} expense${k.recentActivity.pendingExpenses === 1 ? '' : 's'} pending`,
        description: 'Expense entries awaiting approval.',
        severity: 'warning',
        route: ['/approvals'],
        action: 'Review',
      });
    }
    if (k?.recentActivity?.pendingSubcontracts) {
      items.push({
        key: 'pending-subcontracts',
        icon: '🟠',
        title: `${k.recentActivity.pendingSubcontracts} subcontract payment${k.recentActivity.pendingSubcontracts === 1 ? '' : 's'} pending`,
        description: 'Subcontractor payments awaiting approval.',
        severity: 'warning',
        route: ['/subcontractors'],
        action: 'Review',
      });
    }
    const lowStock = this.lowStockCount();
    if (lowStock > 0) {
      items.push({
        key: 'low-stock',
        icon: '🟡',
        title: `${lowStock} material${lowStock === 1 ? '' : 's'} low on stock`,
        description: 'Replenishment required to avoid site delays.',
        severity: 'warning',
        route: ['/projects'],
        action: 'View Inventory',
      });
    }
    const overdue = this.filterPayments(this.payments() as any[]).filter((p: any) => {
      const dateStr = p.date || p.paymentDate || p.createdAt;
      if (!dateStr) return false;
      const ts = new Date(dateStr).getTime();
      if (isNaN(ts)) return false;
      return ts < Date.now() - 1000 * 60 * 60 * 24 * 60;
    });
    if (overdue.length > 0) {
      items.push({
        key: 'overdue-clients',
        icon: '🔴',
        title: `${overdue.length} payment${overdue.length === 1 ? '' : 's'} older than 60 days`,
        description: 'Follow up on outstanding client payments.',
        severity: 'danger',
        route: ['/clients'],
        action: 'View Payments',
      });
    }
    const staleProjects = this.filteredProjects().filter((p: any) => {
      if (p.status !== 'Active') return false;
      const last = p.lastActivityAt ? new Date(p.lastActivityAt).getTime() : 0;
      return last < Date.now() - 1000 * 60 * 60 * 24 * 30;
    });
    if (staleProjects.length > 0) {
      items.push({
        key: 'stale-projects',
        icon: '🔵',
        title: `${staleProjects.length} active project${staleProjects.length === 1 ? '' : 's'} with no recent activity`,
        description: 'Projects with no updates in the last 30 days.',
        severity: 'info',
        route: ['/projects'],
        action: 'View Projects',
      });
    }
    return items;
  });

  readonly topApprovals = computed<any>(() => {
    const pid = this.selectedProjectId();
    let rows = (this.approvalsList() || []);
    if (pid) rows = rows.filter((a: any) => String(a.projectId || '') === pid);
    return rows.slice(0, 5).map((row: any) => ({
      ...row,
      rowId: row.rowId || row._id || row.id,
      module: row.module || row.type || '—',
      projectName: row.projectName || '—',
      requestedBy: row.requestedBy || row.submittedBy || '—',
    }));
  });

  readonly recentPayments = computed<any>(() => {
    return this.filterPayments(this.payments() as any[])
      .sort((a: any, b: any) => new Date(b.date || b.paymentDate || b.createdAt || 0).getTime() - new Date(a.date || a.paymentDate || a.createdAt || 0).getTime())
      .slice(0, 5)
      .map((p: any) => ({
        id: String(p._id || p.id),
        clientName: p.clientName || p.client?.name || p.client || '—',
        projectName: p.projectName || p.project?.name || p.project || '—',
        amount: Number(p.amount || 0),
        date: p.date || p.paymentDate || p.createdAt,
        mode: p.mode || p.paymentMode || '—',
      }));
  });

  readonly financialSeries = computed<BarChartSeries[]>(() => {
    const { from, to } = this.currentPeriodRange();
    const buckets = this.buildMonthlyBuckets(from, to);
    const paymentsByMonth = this.aggregateByMonth(this.filterPayments(this.payments() as any[]), (p: any) => Number(p.amount || 0), from, to);
    const expensesByMonth = this.aggregateByMonth(this.filterExpenses(this.expenses() as any[]), (e: any) => Number(e.amount || 0), from, to);
    return [
      {
        label: 'Received',
        values: buckets.map((b) => paymentsByMonth[b.key] || 0),
        color: '#16a34a',
      },
      {
        label: 'Expenses',
        values: buckets.map((b) => expensesByMonth[b.key] || 0),
        color: '#dc2626',
      },
    ];
  });

  readonly financialLabels = computed(() => {
    const { from, to } = this.currentPeriodRange();
    return this.buildMonthlyBuckets(from, to).map((b) => b.label);
  });

  readonly financialLegend = computed(() => ([
    { label: 'Received', color: '#16a34a' },
    { label: 'Expenses', color: '#dc2626' },
  ]));

  readonly hasFinancialTrend = computed(() => {
    const series = this.financialSeries();
    return series.some((s) => s.values.some((v) => v > 0));
  });

  readonly projectPerformanceSeries = computed<BarChartSeries[]>(() => {
    const projects = this.topProjects().slice(0, 10);
    return [{
      label: 'Total Value',
      values: projects.map((p: any) => p.totalValue),
      color: '#2563eb',
    }];
  });

  readonly projectPerformanceLabels = computed(() => {
    return this.topProjects().slice(0, 10).map((p: any) => p.name || 'Unnamed');
  });

  readonly donutSegments = computed<DonutSegment[]>(() => {
    const { from, to } = this.currentPeriodRange();
    const palette = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];
    const buckets = new Map<string, number>();
    for (const e of this.filterExpenses(this.expenses() as any[])) {
      const type = (e.type || e.expenseType || e.transactionType || 'Other').toString();
      const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const amount = Math.abs(Number(e.amount || 0));
      if (amount <= 0) continue;
      buckets.set(label, (buckets.get(label) || 0) + amount);
    }
    return [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], idx) => ({ label, value, color: palette[idx % palette.length] }));
  });

  readonly activityFeed = computed<any>(() => {
    const events: Array<{
      kind: string;
      title: string;
      subtitle: string;
      timestamp: string | null;
      iconPath: string;
    }> = [];
    for (const p of this.filterPayments(this.payments() as any[])) {
      events.push({
        kind: 'payment',
        title: `Payment received · ${formatMoney(Number(p.amount || 0))}`,
        subtitle: p.clientName || p.client?.name || p.client || 'Client payment',
        timestamp: p.date || p.paymentDate || p.createdAt,
        iconPath: 'M5 13l4 4L19 7',
      });
    }
    for (const m of this.materials() as any[]) {
      events.push({
        kind: 'material',
        title: `Material request · ${m.name || m.materialName || 'Item'}`,
        subtitle: `${m.site || ''} · ${m.projectName || m.project?.name || ''}`,
        timestamp: m.requestDate || m.createdAt,
        iconPath: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
      });
    }
    for (const c of this.clients() as any[]) {
      events.push({
        kind: 'client',
        title: `Client created · ${c.name || ''}`,
        subtitle: c.mobile || c.address || '',
        timestamp: c.createdAt,
        iconPath: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
      });
    }
    for (const v of this.vendors() as any[]) {
      events.push({
        kind: 'vendor',
        title: `Vendor created · ${v.name || ''}`,
        subtitle: v.materialType || '',
        timestamp: v.createdAt,
        iconPath: 'M3 7h18l-2 13H5L3 7z',
      });
    }
    for (const proj of this.filteredProjects() as any[]) {
      events.push({
        kind: 'project',
        title: `Project · ${proj.name || ''}`,
        subtitle: `${proj.status || ''} · ${formatMoney(Number(proj.totalValue || 0))}`,
        timestamp: proj.lastActivityAt || proj.createdAt,
        iconPath: 'M3 7l9-4 9 4-9 4-9-4z',
      });
    }
    for (const e of this.filterExpenses(this.expenses() as any[])) {
      events.push({
        kind: 'expense',
        title: `Expense · ${formatMoney(Number(e.amount || 0))}`,
        subtitle: e.description || e.siteMaterial || e.type || '',
        timestamp: e.date || e.expenseDate || e.createdAt,
        iconPath: 'M3 7h18M3 12h18M3 17h18',
      });
    }
    return events
      .filter((ev) => !!ev.timestamp)
      .sort((a, b) => new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime())
      .slice(0, 12);
  });

  readonly hasActiveFilters = computed(() => {
    return !!this.selectedProjectId() || !!this.selectedSiteId() || (this.periodKey() === 'custom' && (!!this.customFrom() || !!this.customTo()));
  });

  ngOnInit(): void {
    this.refreshAll();
  }

  refreshAll(): void {
    this.refreshing.set(true);
    this.loadingKpis.set(true);
    this.loadingApprovals.set(true);
    this.fetchKpis();
    this.fetchApprovals();
    this.refreshing.set(false);
  }

  private fetchKpis(): void {
    this.api.getKPIs().subscribe({
      next: (res: any) => {
        this.kpis.set(res?.kpis || null);
        this.loadingKpis.set(false);
      },
      error: () => this.loadingKpis.set(false),
    });
  }

  private fetchApprovals(): void {
    this.approvals.fetchApprovals({ status: 'Pending', limit: 25 }).then((rows) => {
      this.approvalsList.set((rows || []) as any);
      this.loadingApprovals.set(false);
    }).catch(() => this.loadingApprovals.set(false));
  }

  onProjectChange(value: string): void {
    this.selectedProjectId.set(value || '');
    this.selectedSiteId.set('');
  }

  onSiteChange(value: string): void {
    this.selectedSiteId.set(value || '');
  }

  onPeriodChange(value: string): void {
    const v = (value || 'month') as PeriodKey;
    this.periodKey.set(v);
    if (v !== 'custom') {
      this.customFrom.set('');
      this.customTo.set('');
    }
  }

  onCustomFromChange(value: string): void {
    this.customFrom.set(value || '');
    if (this.customFrom() && !this.customTo()) {
      this.customTo.set(new Date().toISOString().slice(0, 10));
    }
  }

  onCustomToChange(value: string): void {
    this.customTo.set(value || '');
  }

  clearFilters(): void {
    this.selectedProjectId.set('');
    this.selectedSiteId.set('');
    this.periodKey.set('month');
    this.customFrom.set('');
    this.customTo.set('');
  }

  private matchesProject(row: any): boolean {
    const pid = this.selectedProjectId();
    if (!pid) return true;
    return String(row.projectId || row.project?._id || row.project || '') === pid;
  }

  private matchesSite(row: any): boolean {
    const sid = this.selectedSiteId();
    if (!sid) return true;
    return String(row.siteId || row.site?._id || row.site || '') === sid;
  }

  private matchesPeriod(row: any): boolean {
    const { from, to } = this.currentPeriodRange();
    return this.isInRange(row.date || row.paymentDate || row.expenseDate || row.createdAt, from, to);
  }

  private filterPayments(list: any[]): any[] {
    const { from, to } = this.currentPeriodRange();
    const pid = this.selectedProjectId();
    const sid = this.selectedSiteId();
    return list.filter((p: any) => {
      if (!this.isInRange(p.date || p.paymentDate || p.createdAt, from, to)) return false;
      if (pid && String(p.projectId || p.project?._id || p.project || '') !== pid) return false;
      if (sid && String(p.siteId || p.site?._id || p.site || '') !== sid) return false;
      return true;
    });
  }

  private filterExpenses(list: any[]): any[] {
    const { from, to } = this.currentPeriodRange();
    const pid = this.selectedProjectId();
    const sid = this.selectedSiteId();
    return list.filter((e: any) => {
      if (!this.isInRange(e.date || e.expenseDate || e.createdAt, from, to)) return false;
      if (pid && String(e.projectId || e.project?._id || e.project || '') !== pid) return false;
      if (sid && String(e.siteId || e.site || '') !== sid) return false;
      return true;
    });
  }

  private filterInventory(list: any[]): any[] {
    const pid = this.selectedProjectId();
    const sid = this.selectedSiteId();
    return list.filter((i: any) => {
      if (pid && String(i.projectId || i.project?._id || i.project || '') !== pid) return false;
      if (sid && String(i.siteId || i.site || '') !== sid) return false;
      return true;
    });
  }

  openClientDialog(): void { this.showClientDialog.set(true); }
  closeClientDialog(): void { this.showClientDialog.set(false); }
  onClientCreated(): void { this.showClientDialog.set(false); this.refreshAll(); }

  openProjectDialog(): void { this.showProjectDialog.set(true); }
  closeProjectDialog(): void { this.showProjectDialog.set(false); }
  onProjectCreated(): void { this.showProjectDialog.set(false); this.refreshAll(); }

  openVendorDialog(): void { this.showVendorDialog.set(true); }
  closeVendorDialog(): void { this.showVendorDialog.set(false); }
  onVendorCreated(): void { this.showVendorDialog.set(false); this.refreshAll(); }

  openInventoryInitDialog(): void { this.showInventoryInitDialog.set(true); }
  closeInventoryInitDialog(): void { this.showInventoryInitDialog.set(false); }

  openDetailDialog(type: string): void { this.detailDialogType.set(type); }
  closeDetailDialog(): void { this.detailDialogType.set(null); }

  formatMaterialSummary(): string {
    const total = this.allMaterials().reduce((s: number, m: any) => s + Number(m.issuedAmount || 0), 0);
    return total > 0 ? `${formatMoney(total)} issued` : 'No amounts yet';
  }

  formatInventorySummary(): string {
    const low = this.allInventory().filter((i: any) => {
      const rem = Number(i.remainingStock || 0);
      const min = Number(i.minimumQuantity || 0);
      return min > 0 && rem <= min;
    }).length;
    return low > 0 ? `${low} low stock` : 'All stocked';
  }

  formatLabourSummary(): string {
    const total = this.allLabour().reduce((s: number, l: any) => s + Number(l.presentCount || 0), 0);
    return total > 0 ? `${total} staff total` : 'No staff yet';
  }

  greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  todayLabel(): string {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  heroSubtitle(): string {
    const k = this.filteredKpis();
    if (!k) return 'Loading the latest numbers…';
    const active = k.counts.projects.active;
    const clients = k.counts.clients.active;
    return `${active} active project${active === 1 ? '' : 's'} · ${clients} active client${clients === 1 ? '' : 's'} · ${k.financials.totalPending > 0 ? formatMoney(k.financials.totalPending) + ' outstanding' : 'collections up to date'}`;
  }

  money(value: number | null | undefined): string {
    return formatMoney(value ?? 0);
  }

  numberDisplay(value: number | null | undefined): string {
    return new Intl.NumberFormat("en-IN").format(Number(value ?? 0));
  }

  statusClass(status: string): string {
    return (status || '').toLowerCase().replace(/\s+/g, '-');
  }

  projectProgress(project: any): number {
    const value = Number(project?.completion ?? 0);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  totalProjectExpenses(project: any): number {
    return Number(project?.materialSpend || 0) + Number(project?.labourPayable || 0) + Number(project?.subcontractorSpend || 0);
  }

  formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  relativeTime(value: string | Date | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    const ts = d.getTime();
    if (isNaN(ts)) return '';
    const diff = Date.now() - ts;
    const sec = Math.round(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day}d ago`;
    const month = Math.round(day / 30);
    if (month < 12) return `${month}mo ago`;
    return `${Math.round(month / 12)}y ago`;
  }

  private currentPeriodRange(): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    let from = '';
    if (this.periodKey() === 'custom' && this.customFrom()) {
      from = this.customFrom();
      return { from, to: this.customTo() || to };
    }
    switch (this.periodKey()) {
      case 'today':
        from = to;
        break;
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        from = d.toISOString().slice(0, 10);
        break;
      }
      case 'month': {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        from = d.toISOString().slice(0, 10);
        break;
      }
      case '3m': {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 2);
        d.setDate(1);
        from = d.toISOString().slice(0, 10);
        break;
      }
      case '6m': {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 5);
        d.setDate(1);
        from = d.toISOString().slice(0, 10);
        break;
      }
      case 'year': {
        const d = new Date(now.getFullYear(), 0, 1);
        from = d.toISOString().slice(0, 10);
        break;
      }
      default: {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        from = d.toISOString().slice(0, 10);
      }
    }
    return { from, to };
  }

  private isInRange(value: string | Date | null | undefined, from: string, to: string): boolean {
    if (!value) return false;
    const ts = new Date(value).getTime();
    if (isNaN(ts)) return false;
    if (from) {
      const f = new Date(from).getTime();
      if (!isNaN(f) && ts < f) return false;
    }
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      if (ts > t.getTime()) return false;
    }
    return true;
  }

  private buildMonthlyBuckets(from: string, to: string): Array<{ key: string; label: string }> {
    if (!from) return [];
    const start = new Date(from);
    const end = new Date(to);
    const buckets: Array<{ key: string; label: string }> = [];
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const label = cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      buckets.push({ key, label });
      cursor.setMonth(cursor.getMonth() + 1);
      if (buckets.length > 18) break;
    }
    return buckets;
  }

  private aggregateByMonth(rows: any[], valueFn: (row: any) => number, from: string, to: string): Record<string, number> {
    const result: Record<string, number> = {};
    for (const row of rows) {
      const dateStr = row.date || row.paymentDate || row.expenseDate || row.createdAt;
      if (!this.isInRange(dateStr, from, to)) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result[key] = (result[key] || 0) + valueFn(row);
    }
    return result;
  }

  private evaluateStock(item: any): { severity: 'healthy' | 'low' | 'out'; label: string } {
    const remaining = Number(item?.remainingStock || 0);
    const minimum = Number(item?.minimumQuantity || 0);
    if (remaining <= 0) return { severity: 'out', label: 'Out of stock' };
    if (minimum > 0 && remaining <= minimum) return { severity: 'low', label: 'Low stock' };
    if (minimum > 0 && remaining <= minimum * 1.25) return { severity: 'low', label: 'Running low' };
    return { severity: 'healthy', label: 'Healthy' };
  }
}