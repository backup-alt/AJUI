import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonContent, IonSplitPane } from "@ionic/angular/standalone";
import { firstValueFrom } from "rxjs";
import { ApiService } from "../core/api.service";
import { ApprovalsService } from "../core/approvals.service";
import { mapProject } from "../core/mappers";
import { ErpDataService } from "../data/erp-data.service";
import { ClientFormDialogComponent } from "../shared/client-form-dialog.component";
import { DashboardBarChartComponent, type BarChartSeries } from "../shared/dashboard-bar-chart.component";
import { DashboardDonutChartComponent, type DonutSegment } from "../shared/dashboard-donut-chart.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { ProjectFormDialogComponent } from "../shared/project-form-dialog.component";
import { VendorFormDialogComponent } from "../shared/vendor-form-dialog.component";
import { formatMoney } from "../shared/format";
import { CalendarPopupComponent, type CalendarMode } from "../shared/calendar-popup.component";

type PeriodKey = "today" | "week" | "month" | "3m" | "6m" | "year" | "custom";

interface DashboardKpis {
  counts?: {
    clients?: { total?: number; active?: number };
    projects?: { total?: number; active?: number };
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
}

@Component({
  selector: "app-universal-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonSplitPane,
    EnterpriseSidebarComponent,
    ClientFormDialogComponent,
    ProjectFormDialogComponent,
    VendorFormDialogComponent,
    DashboardBarChartComponent,
    DashboardDonutChartComponent,
    CalendarPopupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="dashboard"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <ion-content class="dashboard-page">
          <main class="dashboard-shell">
            <header class="dashboard-header">
              <div>
                <h1>{{ greeting() }}, {{ userDisplayName() }}</h1>
                <p>Here's what's happening with your business today.</p>
              </div>
              <div class="header-controls">
                <div class="date-picker" (click)="$event.stopPropagation()">
                  <button type="button" class="date-control" aria-haspopup="dialog" [attr.aria-expanded]="dateMenuOpen()" (click)="toggleDateMenu()">
                    <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
                    <strong>{{ selectedDateLabel() }}</strong>
                    <svg class="chevron" [class.open]="dateMenuOpen()" viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg>
                  </button>
                  @if (dateMenuOpen()) {
                    <section class="date-menu" role="dialog" aria-label="Choose dashboard dates">
                      <div class="date-menu-heading">
                        <span><strong>Filter by date</strong><small>Choose one day or a custom range.</small></span>
                        <button type="button" aria-label="Close date filter" (click)="cancelDateFilter()"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
                      </div>
                      <agb-calendar-popup
                        [initialMode]="datePickerMode()"
                        [initialSingle]="draftSingleDate()"
                        [initialRangeFrom]="draftRangeFrom()"
                        [initialRangeTo]="draftRangeTo()"
                        [maxDate]="todayIso"
                        (cancel)="cancelDateFilter()"
                        (apply)="onCalendarApply($event)"
                      ></agb-calendar-popup>
                    </section>
                  }
                </div>
                <div class="period-picker" (click)="$event.stopPropagation()">
                  <button type="button" class="period-control" aria-haspopup="listbox" [attr.aria-expanded]="openPeriodMenu() === 'header'" (click)="togglePeriodMenu('header')">
                    <svg viewBox="0 0 24 24"><path d="M4 4h16l-6 7v6l-4 3v-9L4 4Z"/></svg>
                    <strong>{{ periodLabel() }}</strong>
                    <svg class="chevron" [class.open]="openPeriodMenu() === 'header'" viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg>
                  </button>
                  @if (openPeriodMenu() === 'header') {
                    <div class="period-menu" role="listbox" aria-label="Dashboard period">
                      @for (option of periodOptions; track option.value) {
                        <button type="button" class="period-option" [class.active]="periodKey() === option.value" [attr.aria-selected]="periodKey() === option.value" (click)="selectPeriod(option.value)">
                          <span>{{ option.label }}</span>
                          @if (periodKey() === option.value) { <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg> }
                        </button>
                      }
                    </div>
                  }
                </div>
                <button type="button" class="new-project-button" (click)="openProjectDialog()">
                  <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                  New Project
                </button>
              </div>
            </header>

            <section class="kpi-grid" aria-label="Key financial metrics">
              <article class="kpi-card green">
                <span class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M4 7h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11"/><path d="M16 12h6v4h-6a2 2 0 0 1 0-4Z"/></svg></span>
                <div class="kpi-content"><span>Amount Received</span><strong>{{ money(totalReceived()) }}</strong><small>Across all recorded payments</small></div>
                <span class="kpi-fact"><small>Payment activity</small><strong>{{ payments().length }} {{ payments().length === 1 ? 'payment' : 'payments' }}</strong></span>
              </article>
              <article class="kpi-card orange">
                <span class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M5 3h11l4 4v14H5V3Z"/><path d="M15 3v5h5M9 12h7M9 16h5"/><circle cx="18" cy="18" r="3"/></svg></span>
                <div class="kpi-content"><span>Total Expenditure</span><strong>{{ money(financials().spent) }}</strong><small>{{ periodLabel() }} total</small></div>
                <span class="kpi-fact"><small>Recorded entries</small><strong>{{ scopedExpenses().length }}</strong><em>{{ topExpense() ? topExpense()!.label : 'No expenses' }}</em></span>
              </article>
              <article class="kpi-card purple">
                <span class="kpi-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></svg></span>
                <div class="kpi-content"><span>Active Portfolio Value</span><strong>{{ money(financials().portfolio) }}</strong><small>{{ activeProjectCount() }} active {{ activeProjectCount() === 1 ? 'project' : 'projects' }}</small></div>
                <span class="kpi-fact"><small>Average active value</small><strong>{{ money(averageActiveProjectValue()) }}</strong><em>Estimated value</em></span>
              </article>
            </section>

            <section class="main-panels">
              <article class="panel cash-panel">
                <div class="panel-heading">
                  <h2>Cash Flow Overview</h2>
                </div>
                <div class="chart-wrap">
                  @if (hasFinancialTrend()) {
                    <agb-bar-chart orientation="vertical" [series]="financialSeries()" [labels]="financialLabels()" [legend]="financialLegend" [axisValueFormatter]="formatChartAxis" [tooltipValueFormatter]="formatCurrency"></agb-bar-chart>
                  } @else {
                    <div class="chart-empty"><span>No cash movement in this period</span></div>
                  }
                </div>
                <div class="cash-totals"><div><span>Total Received</span><strong>{{ money(financials().received) }}</strong></div><div><span>Total Spent</span><strong>{{ money(financials().spent) }}</strong></div></div>
              </article>

              <article class="panel spend-panel">
                <div class="panel-heading"><h2>Spending Breakdown</h2></div>
                <div class="donut-wrap">
                  @if (expenseDonut().length) {
                    <agb-donut-chart [segments]="expenseDonut()" caption="Total Spent" [valueFormatter]="formatCurrency"></agb-donut-chart>
                  } @else {
                    <div class="chart-empty"><span>No expenditure in this period</span></div>
                  }
                </div>
              </article>

              <article class="panel projects-panel">
                <div class="panel-heading"><h2>Recent Projects</h2><a routerLink="/projects">View All</a></div>
                <div class="recent-project-list">
                  @for (project of recentProjects(); track project.id) {
                    <a [routerLink]="projectRoute(project)" class="recent-project-row">
                      <span class="dashboard-project-avatar" [style.background]="project.color">{{ project.initials }}</span>
                      <span class="dashboard-project-copy"><strong>{{ project.name }}</strong><small>{{ project.status }}</small></span>
                      <span class="dashboard-project-progress"><i [style.width.%]="project.progress"></i></span>
                      <b>{{ project.progress }}%</b>
                    </a>
                  } @empty {
                    <div class="simple-empty">No projects available.</div>
                  }
                </div>
              </article>
            </section>

            <section class="lower-panels">
              <article class="panel approvals-panel">
                <div class="panel-heading"><h2>Pending Approvals</h2><a routerLink="/approvals">View All</a></div>
                <div class="approval-summary-list">
                  @for (item of pendingExpenseRows(); track item.rowId || item.id || item._id) {
                    <a routerLink="/approvals" class="approval-summary-row">
                      <span class="approval-icon expense"><svg viewBox="0 0 24 24"><path d="M7 3h10v4h3v14H4V7h3V3Z"/><path d="M9 13h6M9 17h4"/></svg></span>
                      <span><strong>{{ expenseApprovalDescription(item) }}</strong><small>{{ expenseApprovalContext(item) }}</small></span>
                      <span class="approval-amount"><strong>{{ money(item.amount) }}</strong><small>Pending expense</small></span>
                    </a>
                  } @empty {
                    <div class="simple-empty">No expense approvals waiting.</div>
                  }
                </div>
              </article>

              <article class="panel summary-panel">
                <div class="panel-heading"><h2>Workforce &amp; Partners</h2></div>
                <div class="summary-grid">
                  <a routerLink="/projects"><span class="summary-icon blue"><svg viewBox="0 0 24 24"><path d="M4 7h16v13H4V7ZM8 7V4h8v3"/></svg></span><span><small>Total Projects</small><strong>{{ totalProjectCount() }}</strong></span></a>
                  <a routerLink="/projects"><span class="summary-icon green"><svg viewBox="0 0 24 24"><path d="M4 20V8l8-5 8 5v12H4Z"/><path d="m9 14 2 2 4-5"/></svg></span><span><small>Active Projects</small><strong>{{ activeProjectCount() }}</strong><b>{{ activeProjectRate() }}%</b></span></a>
                  <a routerLink="/subcontractors"><span class="summary-icon orange"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M17 11a4 4 0 0 1 4 4v2"/></svg></span><span><small>Subcontractors</small><strong>{{ subcontractorCount() }}</strong><em>{{ activeSubcontractorCount() }} active</em></span></a>
                  <a routerLink="/vendors"><span class="summary-icon purple"><svg viewBox="0 0 24 24"><path d="M3 7h18l-2 12H5L3 7Z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/></svg></span><span><small>Vendors</small><strong>{{ vendorCount() }}</strong><em>{{ activeVendorCount() }} active</em></span></a>
                </div>
              </article>

              <article class="panel expenditure-panel">
                <div class="panel-heading"><h2>Top Expenditures</h2></div>
                <div class="expenditure-table">
                  <div class="expenditure-head"><span>Category</span><span>Amount</span><span>% of Total</span></div>
                  @for (item of expenditureRows(); track item.label) {
                    <div class="expenditure-row"><span><i [style.background]="item.color"></i>{{ item.label }}</span><strong>{{ money(item.value) }}</strong><span><span class="expenditure-bar"><i [style.width.%]="item.percent" [style.background]="item.color"></i></span><b>{{ item.percent }}%</b></span></div>
                  }
                  <div class="expenditure-total"><strong>Total</strong><strong>{{ money(financials().spent) }}</strong><strong>100%</strong></div>
                </div>
              </article>
            </section>

            <section class="insights-panel">
              <h2>Business Insights</h2>
              <div class="insight-grid">
                <article><span class="insight-icon green"><svg viewBox="0 0 24 24"><path d="M4 17 10 11l4 4 6-8M16 7h4v4"/></svg></span><span><small>{{ periodLabel() }} expenditure</small><strong>{{ money(financials().spent) }}</strong><em>{{ scopedExpenses().length }} recorded {{ scopedExpenses().length === 1 ? 'expense' : 'expenses' }}</em></span></article>
                <article><span class="insight-icon orange"><svg viewBox="0 0 24 24"><path d="M3 5h2l2 11h11l2-7H7M10 21h.01M18 21h.01"/></svg></span><span><small>Largest expense category</small><strong>{{ topExpense() ? topExpense()!.label : 'No expenses' }}</strong><em>{{ topExpense() ? money(topExpense()!.value) : money(0) }}</em></span></article>
                <article><span class="insight-icon blue"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M17 11a4 4 0 0 1 4 4v2"/></svg></span><span><small>Active projects</small><strong>{{ activeProjectCount() }}</strong><em>{{ money(financials().portfolio) }} estimated value</em></span></article>
                <article><span class="insight-icon purple"><svg viewBox="0 0 24 24"><path d="M6 3h12v18H6V3ZM9 8h6M9 12h6"/><circle cx="17" cy="18" r="3"/></svg></span><span><small>Pending expense approvals</small><strong>{{ money(pendingApprovalTotal()) }}</strong><em>{{ pendingApprovalCount() }} {{ pendingApprovalCount() === 1 ? 'request' : 'requests' }}</em></span></article>
                <article><span class="insight-icon blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 17h.01"/></svg></span><span><small>{{ periodLabel() }} cash inflow</small><strong>{{ money(financials().received) }}</strong><em>{{ scopedPayments().length }} recorded {{ scopedPayments().length === 1 ? 'payment' : 'payments' }}</em></span></article>
              </div>
            </section>
          </main>
        </ion-content>
      </div>

      @if (showClientDialog()) { <agb-client-form-dialog [initialValue]="null" (cancel)="closeClientDialog()" (create)="onClientCreated()"></agb-client-form-dialog> }
      @if (showProjectDialog()) {
        <agb-project-form-dialog
          [currentClientId]="''"
          [clients]="dashboardClients()"
          [initialValue]="null"
          (cancel)="closeProjectDialog()"
          (create)="onProjectCreated($event)"
        ></agb-project-form-dialog>
      }
      @if (showVendorDialog()) { <agb-vendor-form-dialog [initialValue]="null" (cancel)="closeVendorDialog()" (create)="onVendorCreated()"></agb-vendor-form-dialog> }
    </ion-split-pane>
  `,
  styles: [`
    :host { display: block; }
    * { box-sizing: border-box; }
    .dashboard-page { --background: #f8fafc; }
    .dashboard-shell { width: 100%; max-width: none; min-height: 100%; margin: 0; padding: 24px clamp(18px, 2vw, 32px) 44px; color: #101828; font-family: var(--ion-font-family, Inter, ui-sans-serif, system-ui, sans-serif); font-size: 14px; line-height: 1.5; }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    button, select, input { font: inherit; } a { color: inherit; text-decoration: none; }
    .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 28px; margin-bottom: 26px; }
    .dashboard-header h1 { margin: 0; color: #101828; font-size: clamp(25px, 2vw, 31px); font-weight: 750; line-height: 1.2; letter-spacing: -.03em; }
    .dashboard-header p { margin: 8px 0 0; color: #667085; font-size: 14px; line-height: 1.5; }
    .header-controls { display: flex; align-items: center; gap: 12px; }
    .date-control, .period-control, .new-project-button { position: relative; display: flex; align-items: center; gap: 9px; height: 44px; padding: 0 14px; border: 1px solid #d0d5dd; border-radius: 9px; background: #fff; color: #1d2939; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
    .date-picker { position: relative; z-index: 60; }.date-control { min-width: 176px; cursor: pointer; }.date-control strong { flex: 1; font-size: 14px; text-align: left; white-space: nowrap; }.date-control:hover { border-color: #98a2b3; background: #f9fafb; }.date-control:focus-visible { outline: 3px solid rgba(47,107,255,.18); outline-offset: 1px; }
    .date-menu { position: absolute; top: calc(100% + 8px); right: 0; left: auto; z-index: 80; display: grid; width: max-content; max-width: min(640px, calc(100vw - 32px)); gap: 14px; padding: 16px; border: 1px solid #d0d5dd; border-radius: 14px; background: #fff; box-shadow: 0 18px 40px rgba(16,24,40,.17), 0 4px 10px rgba(16,24,40,.08); }.date-menu-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }.date-menu-heading > span { display: grid; gap: 3px; }.date-menu-heading strong { color: #101828; font-size: 15px; }.date-menu-heading small { color: #667085; font-size: 12px; }.date-menu-heading > button { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; padding: 0; border: 1px solid #e4e7ec; border-radius: 7px; background: #fff; color: #667085; cursor: pointer; }.date-menu-heading > button:hover { background: #f2f4f7; color: #101828; }.date-menu-heading > button svg { width: 15px; height: 15px; }
    .period-picker { position: relative; z-index: 30; }.period-control { min-width: 160px; cursor: pointer; }.period-control strong { flex: 1; color: #1d2939; font-size: 14px; font-weight: 700; text-align: left; white-space: nowrap; }.period-control:hover { border-color: #98a2b3; background: #f9fafb; }.period-control:focus-visible, .period-option:focus-visible { outline: 3px solid rgba(47, 107, 255, .18); outline-offset: 1px; }.period-control .chevron { pointer-events: none; transition: transform 160ms ease; }
    .chevron { width: 14px; }.chevron.open { transform: rotate(180deg); }.new-project-button { border-color: #175cd3; background: #175cd3; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 8px rgba(23,92,211,.18); }
    .period-menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 40; display: grid; width: 192px; gap: 3px; padding: 6px; border: 1px solid #d0d5dd; border-radius: 11px; background: #fff; box-shadow: 0 14px 32px rgba(16,24,40,.16), 0 3px 8px rgba(16,24,40,.08); }.period-option { display: flex; width: 100%; min-height: 38px; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; border: 0; border-radius: 7px; background: transparent; color: #344054; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; }.period-option:hover { background: #f2f4f7; color: #101828; }.period-option.active { background: #eef4ff; color: #175cd3; }.period-option svg { width: 15px; height: 15px; stroke-width: 2.3; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 18px; }
    .kpi-card { position: relative; display: grid; grid-template-columns: 52px minmax(0, 1fr) minmax(128px, auto); align-items: center; column-gap: 15px; min-width: 0; min-height: 132px; padding: 18px; overflow: hidden; border: 1px solid #e4e7ec; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.04); }
    .kpi-icon { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 50%; }.kpi-icon svg { width: 24px; height: 24px; stroke-width: 1.8; }
    .green .kpi-icon { background: #eaf8f0; color: #039855; }.orange .kpi-icon { background: #fff3e8; color: #e04f16; }.blue .kpi-icon { background: #edf4ff; color: #175cd3; }.purple .kpi-icon { background: #f4f0ff; color: #6938c6; }
    .kpi-content { display: grid; min-width: 0; gap: 7px; }.kpi-content > span { color: #475467; font-size: 14px; font-weight: 650; }.kpi-content > strong { overflow: hidden; color: #101828; font-size: clamp(24px, 1.65vw, 30px); line-height: 1.08; letter-spacing: -.025em; text-overflow: ellipsis; white-space: nowrap; }.kpi-content small { color: #667085; font-size: 12px; }
    .kpi-fact { display: grid; min-width: 0; gap: 4px; align-content: center; padding-left: 15px; border-left: 1px solid #eaecf0; }.kpi-fact small, .kpi-fact em { overflow: hidden; color: #667085; font-size: 11px; font-style: normal; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }.kpi-fact strong { overflow: hidden; color: #101828; font-size: 16px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }.green .kpi-fact strong { color: #027a48; }.orange .kpi-fact strong { color: #c4320a; }.purple .kpi-fact strong { color: #5925dc; }
    .main-panels, .lower-panels { display: grid; gap: 16px; margin-bottom: 16px; }.main-panels { grid-template-columns: minmax(0, 1.28fr) minmax(0, 1fr) minmax(0, .96fr); }.lower-panels { grid-template-columns: minmax(0, .95fr) minmax(0, .9fr) minmax(0, 1.22fr); }
    .panel, .insights-panel { overflow: hidden; border: 1px solid #e4e7ec; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.035); }.main-panels .panel { min-height: 430px; }.lower-panels .panel { min-height: 270px; }
    .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 66px; padding: 18px 20px; }.cash-panel .panel-heading { position: relative; z-index: 10; }.panel-heading h2, .insights-panel h2 { margin: 0; color: #101828; font-size: 17px; font-weight: 700; line-height: 1.25; letter-spacing: -.01em; }.panel-heading > a { color: #175cd3; font-size: 13px; font-weight: 700; }
    .chart-wrap { min-height: 270px; padding: 4px 20px 0; }.chart-wrap agb-bar-chart { display: block; }.cash-panel ::ng-deep .bar-chart-x-label, .cash-panel ::ng-deep .bar-chart-tick, .cash-panel ::ng-deep .bar-chart-legend li { font-size: 12px; }.chart-empty, .simple-empty { display: flex; align-items: center; justify-content: center; min-height: 170px; color: #98a2b3; font-size: 14px; }
    .cash-totals { display: grid; grid-template-columns: 1fr 1fr; margin: 0 20px 18px; overflow: hidden; border: 1px solid #e4e7ec; border-radius: 9px; }.cash-totals div { display: grid; gap: 6px; padding: 13px 18px; }.cash-totals div:first-child { background: #f0faf5; }.cash-totals div:last-child { border-left: 1px solid #e4e7ec; background: #fff8f2; }.cash-totals span { color: #039855; font-size: 12px; font-weight: 700; }.cash-totals div:last-child span { color: #e04f16; }.cash-totals strong { color: #101828; font-size: 19px; }
    .donut-wrap { display: flex; min-height: 340px; min-width: 0; align-items: center; padding: 20px clamp(16px, 2vw, 24px); }.donut-wrap agb-donut-chart { width: 100%; min-width: 0; }.spend-panel { min-width: 0; }.spend-panel ::ng-deep .donut-chart { justify-content: center; gap: clamp(16px, 2vw, 24px); }.spend-panel ::ng-deep .donut-canvas { width: clamp(145px, 11vw, 170px); height: clamp(145px, 11vw, 170px); }.spend-panel ::ng-deep .donut-legend-label, .spend-panel ::ng-deep .donut-legend-meta strong { font-size: 14px; }.spend-panel ::ng-deep .donut-legend-meta small { font-size: 12px; }
    .recent-project-list { display: grid; padding: 4px 20px 14px; }.recent-project-row { display: grid; grid-template-columns: 40px minmax(120px, .9fr) minmax(80px, 1.25fr) 40px; align-items: center; gap: 12px; min-height: 65px; }.dashboard-project-avatar { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 8px; color: #fff; font-size: 13px; font-weight: 750; }.dashboard-project-copy { display: grid; min-width: 0; gap: 5px; }.dashboard-project-copy strong { overflow: hidden; color: #101828; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }.dashboard-project-copy small { width: fit-content; padding: 2px 6px; border-radius: 3px; background: #ecfdf3; color: #027a48; font-size: 11px; }.dashboard-project-progress { display: block; width: 100%; height: 6px; overflow: hidden; border-radius: 99px; background: #eaecf0; }.dashboard-project-progress i { display: block; height: 100%; border-radius: inherit; background: #175cd3; }.recent-project-row > b { color: #344054; font-size: 12px; text-align: right; }
    .approval-summary-list { display: grid; gap: 8px; padding: 0 14px 14px; }.approval-summary-row { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 76px; padding: 10px 11px; border: 1px solid #eaecf0; border-radius: 9px; }.approval-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 9px; }.approval-icon.expense { background: #fff0e6; color: #e04f16; }.approval-summary-row > span:nth-child(2), .approval-amount { display: grid; min-width: 0; gap: 4px; }.approval-summary-row strong { overflow: hidden; color: #101828; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }.approval-summary-row small { overflow: hidden; color: #667085; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.approval-amount { text-align: right; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 0 14px 14px; }.summary-grid a { display: grid; grid-template-columns: 47px 1fr; align-items: center; gap: 11px; min-height: 88px; padding: 11px; border: 1px solid #eaecf0; border-radius: 9px; }.summary-icon { display: inline-flex; align-items: center; justify-content: center; width: 45px; height: 45px; border-radius: 9px; }.summary-icon.blue { background: #edf4ff; color: #175cd3; }.summary-icon.green { background: #eaf8f0; color: #039855; }.summary-icon.orange { background: #fff3e8; color: #e04f16; }.summary-icon.purple { background: #f4f0ff; color: #6938c6; }.summary-grid a > span:last-child { display: grid; gap: 3px; }.summary-grid small, .summary-grid em { color: #667085; font-size: 12px; font-style: normal; }.summary-grid strong { color: #101828; font-size: 22px; }.summary-grid b { color: #039855; font-size: 12px; }
    .expenditure-table { padding: 0 22px 14px; }.expenditure-head, .expenditure-row, .expenditure-total { display: grid; grid-template-columns: 1.2fr .72fr 1fr; align-items: center; min-height: 48px; border-bottom: 1px solid #eaecf0; }.expenditure-head { color: #667085; font-size: 12px; font-weight: 600; }.expenditure-row { color: #344054; font-size: 13px; }.expenditure-row > span:first-child { display: flex; align-items: center; gap: 10px; }.expenditure-row > span:first-child i { width: 8px; height: 8px; border-radius: 50%; }.expenditure-row > span:last-child { display: grid; grid-template-columns: 1fr 42px; align-items: center; gap: 9px; }.expenditure-row b { font-size: 12px; text-align: right; }.expenditure-bar { height: 6px; overflow: hidden; border-radius: 99px; background: #f2f4f7; }.expenditure-bar i { display: block; height: 100%; border-radius: inherit; }.expenditure-total { border: 0; color: #101828; font-size: 13px; }
    .insights-panel { padding: 20px 22px 22px; }.insights-panel h2 { margin-bottom: 16px; font-size: 18px; }.insight-grid { display: grid; grid-template-columns: repeat(5, 1fr); }.insight-grid article { display: grid; grid-template-columns: 50px 1fr; align-items: center; gap: 14px; min-height: 90px; padding: 8px 18px; border-right: 1px solid #eaecf0; }.insight-grid article:first-child { padding-left: 0; }.insight-grid article:last-child { border-right: 0; }.insight-icon { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; }.insight-icon.green { background: #eaf8f0; color: #039855; }.insight-icon.orange { background: #fff3e8; color: #e04f16; }.insight-icon.blue { background: #edf4ff; color: #175cd3; }.insight-icon.purple { background: #f4f0ff; color: #6938c6; }.insight-grid article > span:last-child { display: grid; min-width: 0; gap: 5px; }.insight-grid small { color: #667085; font-size: 13px; line-height: 1.35; }.insight-grid strong { overflow: hidden; color: #101828; font-size: 19px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }.insight-grid em { overflow: hidden; color: #667085; font-size: 13px; font-style: normal; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 1250px) { .kpi-grid { grid-template-columns: 1fr 1fr; }.main-panels { grid-template-columns: 1fr 1fr; }.projects-panel { grid-column: 1 / -1; }.lower-panels { grid-template-columns: 1fr 1fr; }.expenditure-panel { grid-column: 1 / -1; }.insight-grid { grid-template-columns: 1fr 1fr 1fr; }.insight-grid article { border-bottom: 1px solid #e4e8f0; } }
    @media (max-width: 1000px) { .kpi-grid { grid-template-columns: 1fr 1fr; } .kpi-card { grid-template-columns: 52px minmax(0, 1fr) minmax(120px, auto); } }
    @media (max-width: 820px) { .dashboard-shell { padding: 20px 14px 36px; }.dashboard-header { flex-direction: column; }.header-controls { width: 100%; flex-wrap: wrap; }.date-picker, .period-picker { flex: 1; }.date-control, .period-control { width: 100%; }.main-panels, .lower-panels { grid-template-columns: 1fr; }.projects-panel, .expenditure-panel { grid-column: auto; }.insight-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 560px) { .kpi-grid { grid-template-columns: 1fr; }.kpi-card { grid-template-columns: 46px minmax(0, 1fr); }.kpi-icon { width: 46px; height: 46px; }.kpi-fact { grid-column: 2; padding: 10px 0 0; border-top: 1px solid #eaecf0; border-left: 0; }.header-controls { align-items: stretch; flex-direction: column; }.date-picker, .date-control, .period-picker, .period-control, .new-project-button { width: 100%; }.date-menu { width: min(360px, calc(100vw - 28px)); }.date-range-fields { grid-template-columns: 1fr; }.period-menu { right: auto; left: 0; width: 100%; }.summary-grid, .insight-grid { grid-template-columns: 1fr; }.insight-grid article { border-right: 0; }.recent-project-row { grid-template-columns: 38px 1fr 32px; }.dashboard-project-progress { display: none; } }
  `],
})
export class UniversalDashboardPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly data = inject(ErpDataService);
  private readonly approvals = inject(ApprovalsService);

  readonly kpis = signal<DashboardKpis | null>(null);
  readonly approvalRows = signal<any[]>([]);
  readonly loadedProjects = signal<any[] | null>(null);
  readonly loadedPayments = signal<any[] | null>(null);
  readonly loadedExpenses = signal<any[] | null>(null);
  readonly loadedGeneralExpenses = signal<any[] | null>(null);
  readonly loadedMaterials = signal<any[] | null>(null);
  readonly loadedSubcontractorPayments = signal<any[] | null>(null);
  readonly refreshing = signal(false);
  readonly periodKey = signal<PeriodKey>("month");
  readonly openPeriodMenu = signal<"header" | "chart" | null>(null);
  readonly selectedDate = signal(new Date().toISOString().slice(0, 10));
  readonly dateMenuOpen = signal(false);
  readonly datePickerMode = signal<CalendarMode>("single");
  readonly customDateFrom = signal("");
  readonly customDateTo = signal("");
  readonly draftSingleDate = signal(this.selectedDate());
  readonly draftRangeFrom = signal(this.selectedDate());
  readonly draftRangeTo = signal(this.selectedDate());
  readonly todayIso = new Date().toISOString().slice(0, 10);
  readonly showClientDialog = signal(false);
  readonly showProjectDialog = signal(false);
  readonly showVendorDialog = signal(false);
  readonly periodOptions: ReadonlyArray<{ value: PeriodKey; label: string }> = [
    { value: "today", label: "Today" },
    { value: "week", label: "Last 7 Days" },
    { value: "month", label: "This Month" },
    { value: "3m", label: "Last 3 Months" },
    { value: "6m", label: "Last 6 Months" },
    { value: "year", label: "This Year" },
  ];
  readonly chartPeriodOptions = this.periodOptions.filter((option) => option.value !== "today");

  readonly projects = computed(() => this.loadedProjects() ?? (this.data.projects() as any[]));
  readonly dashboardClients = computed(() => this.data.clients() as any[]);
  readonly activeProjects = computed(() => this.projects().filter((row) => String(row.status || "").trim().toLowerCase() === "active"));
  readonly legacyPayments = computed<any[]>(() => this.data.tableRowsFor("payments", [])
    .filter((row) => String(row["__rowId"] || "").startsWith("custom:payments:"))
    .map((row) => ({
      ...row,
      id: String(row["__rowId"] || ""),
      date: String(row["paymentDate"] || row["date"] || ""),
      status: String(row["approvalStatus"] || row["status"] || "Pending"),
    })));
  readonly payments = computed(() => {
    const backendRows = this.loadedPayments() ?? (this.data.payments() as any[]);
    const rows = [...backendRows, ...this.legacyPayments()];
    return this.dedupeRows(rows).filter((row) => this.isPostedPayment(row));
  });
  readonly expenses = computed(() => {
    const legacyRows = this.loadedExpenses() ?? (this.data.expenses() as any[]);
    const generalRows = this.loadedGeneralExpenses() ?? (this.data.generalExpenses() as any[]);
    const materialRows = (this.loadedMaterials() ?? (this.data.materials() as any[]))
      .map((row) => ({
        ...row,
        amount: Math.max(0, Number(row.givenAmount || 0)),
        date: row.requestDate || row.createdAt || "",
        dashboardSource: "Material Expense",
      }))
      .filter((row) => row.amount > 0);
    const subcontractorRows = (this.loadedSubcontractorPayments() ?? [])
      .map((row) => ({
        ...row,
        date: row.date || row.createdAt || "",
        dashboardSource: "Subcontractor Payment",
      }));
    return this.dedupeRows([
      ...legacyRows.map((row) => ({ ...row, dashboardSource: this.legacyExpenseSource(row) })),
      ...generalRows.map((row) => ({ ...row, dashboardSource: "Expense" })),
      ...materialRows,
      ...subcontractorRows,
    ]).filter((row) => this.isPostedExpense(row));
  });
  readonly userDisplayName = computed(() => {
    const user = this.api.user() as any;
    return user?.name || user?.fullName || "AGB Admin";
  });
  readonly dateRangeInvalid = computed(() => Boolean(this.draftRangeFrom() && this.draftRangeTo() && this.draftRangeFrom() > this.draftRangeTo()));
  readonly selectedDateLabel = computed(() => {
    if (this.periodKey() === "custom" && this.customDateFrom() && this.customDateTo()) {
      const from = new Date(`${this.customDateFrom()}T00:00:00`);
      const to = new Date(`${this.customDateTo()}T00:00:00`);
      if (this.customDateFrom() === this.customDateTo()) return this.displayDate(to);
      const fromLabel = from.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      return `${fromLabel} – ${this.displayDate(to)}`;
    }
    return this.displayDate(new Date(`${this.selectedDate()}T00:00:00`));
  });
  readonly periodLabel = computed(() => ({
    today: "Today",
    week: "Last 7 days",
    month: "This month",
    "3m": "Last 3 months",
    "6m": "Last 6 months",
    year: "This year",
    custom: "Custom range",
  })[this.periodKey()]);

  readonly scopedPayments = computed(() => this.payments().filter((row) => this.inCurrentPeriod(row)));
  readonly scopedExpenses = computed(() => this.expenses().filter((row) => this.inCurrentPeriod(row)));
  readonly totalReceived = computed(() => this.payments().reduce((sum, row) => sum + this.amountOf(row), 0));
  readonly financials = computed(() => {
    const received = this.scopedPayments().reduce((sum, row) => sum + this.amountOf(row), 0);
    const spent = this.scopedExpenses().reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const portfolio = this.activeProjects().reduce((sum, row) => sum + Math.max(0, Number(row.totalValue || row.estimatedValue || 0)), 0);
    return { received, spent, portfolio };
  });

  readonly totalProjectCount = computed(() => Number(this.kpis()?.counts?.projects?.total ?? this.projects().length));
  readonly activeProjectCount = computed(() => this.activeProjects().length);
  readonly activeProjectRate = computed(() => this.totalProjectCount() ? Math.round(this.activeProjectCount() / this.totalProjectCount() * 100) : 0);
  readonly averageActiveProjectValue = computed(() => this.activeProjectCount() ? this.financials().portfolio / this.activeProjectCount() : 0);
  readonly subcontractorCount = computed(() => (this.data.subcontractors() as any[]).length);
  readonly activeSubcontractorCount = computed(() => (this.data.subcontractors() as any[]).filter((row) => String(row.status || "").toLowerCase() === "active").length);
  readonly vendorCount = computed(() => (this.data.vendors() as any[]).length);
  readonly activeVendorCount = computed(() => (this.data.vendors() as any[]).filter((row) => String(row.status || "").toLowerCase() === "active").length);

  private readonly palette = ["#175cd3", "#039855", "#e04f16", "#0e9384", "#c11574", "#6938c6"];
  readonly recentProjects = computed(() => this.projects().slice(0, 5).map((row, index) => {
    const name = row.name || "Unnamed Project";
    const id = String(row.id || row._id || "");
    const collected = this.payments()
      .filter((payment) => String(payment.projectId || "") === id)
      .reduce((sum, payment) => sum + this.amountOf(payment), 0);
    const estimated = Math.max(0, Number(row.totalValue || row.estimatedValue || 0));
    const progress = estimated > 0
      ? Math.round(Math.min(100, Math.max(0, (collected / estimated) * 100)))
      : 0;
    return { id, clientId: String(row.clientId || row.client?._id || ""), name, initials: name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase(), status: row.status || "Active", progress, color: this.palette[index % this.palette.length] };
  }));

  readonly financialLabels = computed(() => this.trendBuckets().map((bucket) => bucket.label));
  readonly financialSeries = computed<BarChartSeries[]>(() => {
    const buckets = this.trendBuckets();
    return [
      { label: "Received", color: "#12b76a", values: buckets.map((bucket) => this.sumBucket(this.scopedPayments(), bucket)) },
      { label: "Spent", color: "#f97316", values: buckets.map((bucket) => this.sumBucket(this.scopedExpenses(), bucket)) },
    ];
  });
  readonly financialLegend = [{ label: "Received", color: "#12b76a" }, { label: "Spent", color: "#f97316" }];
  readonly hasFinancialTrend = computed(() => this.financialSeries().some((series) => series.values.some((value) => value > 0)));

  readonly expenseDonut = computed<DonutSegment[]>(() => {
    const categories = [
      { label: "Expense", color: "#175cd3" },
      { label: "Supervisor Expense", color: "#e5484d" },
      { label: "Material Expense", color: "#f59e0b" },
      { label: "Subcontractor Payment", color: "#6938c6" },
    ];
    const values = new Map(categories.map((category) => [category.label, 0]));
    for (const row of this.scopedExpenses()) {
      const label = this.expenseCategory(row);
      values.set(label, (values.get(label) || 0) + Math.abs(Number(row.amount || 0)));
    }
    return categories
      .map((category) => ({ ...category, value: values.get(category.label) || 0 }))
      .filter((category) => category.value > 0)
      .sort((a, b) => b.value - a.value);
  });
  readonly expenditureRows = computed(() => {
    const total = this.expenseDonut().reduce((sum, row) => sum + row.value, 0);
    return this.expenseDonut().map((row) => ({ ...row, percent: total ? Math.round(row.value / total * 1000) / 10 : 0 }));
  });
  readonly topExpense = computed(() => this.expenditureRows()[0] || null);

  readonly pendingExpenseApprovals = computed(() => this.approvalRows().filter((row) => {
    const module = String(row.module || "").replace(/[_\s-]/g, "").toLowerCase();
    return module === "expenses" || module === "expense" || module === "generalexpenses";
  }));
  readonly pendingExpenseRows = computed(() => this.pendingExpenseApprovals().slice(0, 3));
  readonly pendingApprovalCount = computed(() => this.pendingExpenseApprovals().length);
  readonly pendingApprovalTotal = computed(() => this.pendingExpenseApprovals().reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0));

  readonly formatCurrency = (value: number) => formatMoney(value);
  readonly formatChartAxis = (value: number): string => {
    const absoluteValue = Math.abs(value);
    if (absoluteValue >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
    if (absoluteValue >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
    if (absoluteValue >= 1_000) return `₹${Math.round(value / 1_000)}K`;
    return `₹${Math.round(value)}`;
  };

  ngOnInit(): void { void this.refreshAll(); }
  async refreshAll(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    try {
      const [kpis, approvals, projects, payments, expenses, generalExpenses, materials, subcontractorPayments] = await Promise.allSettled([
        firstValueFrom(this.api.getKPIs()),
        this.approvals.fetchApprovals({ status: "Pending", limit: 100 }),
        firstValueFrom(this.api.listProjects({ page: 1, limit: 200 })),
        this.loadAllPayments(),
        this.loadAllLegacyExpenses(),
        this.loadAllGeneralExpenses(),
        this.loadAllMaterials(),
        this.loadAllSubcontractorPayments(),
      ]);
      if (kpis.status === "fulfilled") this.kpis.set((kpis.value as any)?.kpis || null);
      if (approvals.status === "fulfilled") this.approvalRows.set((approvals.value || []) as any[]);
      if (projects.status === "fulfilled") this.loadedProjects.set(((projects.value as any)?.items || []).map(mapProject));
      if (payments.status === "fulfilled") this.loadedPayments.set(payments.value);
      if (expenses.status === "fulfilled") this.loadedExpenses.set(expenses.value);
      if (generalExpenses.status === "fulfilled") this.loadedGeneralExpenses.set(generalExpenses.value);
      if (materials.status === "fulfilled") this.loadedMaterials.set(materials.value);
      if (subcontractorPayments.status === "fulfilled") this.loadedSubcontractorPayments.set(subcontractorPayments.value);

      const migratedCount = await this.migrateLegacyPayments(
        payments.status === "fulfilled" ? payments.value : [],
      );
      if (migratedCount > 0) {
        const [nextPayments, nextProjects, nextKpis] = await Promise.all([
          this.loadAllPayments(),
          firstValueFrom(this.api.listProjects({ page: 1, limit: 200 })),
          firstValueFrom(this.api.getKPIs()),
        ]);
        this.loadedPayments.set(nextPayments);
        this.loadedProjects.set(((nextProjects as any)?.items || []).map(mapProject));
        this.kpis.set((nextKpis as any)?.kpis || null);
      }
    } finally { this.refreshing.set(false); }
  }

  toggleDateMenu(): void {
    const shouldOpen = !this.dateMenuOpen();
    this.openPeriodMenu.set(null);
    if (!shouldOpen) {
      this.dateMenuOpen.set(false);
      return;
    }
    this.draftSingleDate.set(this.selectedDate());
    const range = this.currentRange();
    this.draftRangeFrom.set(this.dateInputValue(range.from));
    this.draftRangeTo.set(this.dateInputValue(range.to));
    this.datePickerMode.set(this.periodKey() === "custom" ? "range" : "single");
    this.dateMenuOpen.set(true);
  }
  setDatePickerMode(mode: CalendarMode): void { this.datePickerMode.set(mode); }
  canApplyDateFilter(): boolean {
    if (this.datePickerMode() === "single") return Boolean(this.draftSingleDate());
    return Boolean(this.draftRangeFrom() && this.draftRangeTo() && !this.dateRangeInvalid());
  }
  onCalendarApply(event: { mode: CalendarMode; single?: string; from?: string; to?: string }): void {
    if (event.mode === "single" && event.single) {
      this.draftSingleDate.set(event.single);
      this.selectedDate.set(event.single);
      this.periodKey.set("today");
    } else if (event.mode === "range" && event.from && event.to) {
      this.draftRangeFrom.set(event.from);
      this.draftRangeTo.set(event.to);
      this.customDateFrom.set(event.from);
      this.customDateTo.set(event.to);
      this.selectedDate.set(event.to);
      this.periodKey.set("custom");
    } else {
      return;
    }
    this.dateMenuOpen.set(false);
  }
  cancelDateFilter(): void { this.dateMenuOpen.set(false); }
  togglePeriodMenu(menu: "header" | "chart"): void {
    this.dateMenuOpen.set(false);
    this.openPeriodMenu.update((current) => current === menu ? null : menu);
  }
  selectPeriod(value: PeriodKey): void {
    this.periodKey.set(value);
    this.dateMenuOpen.set(false);
    this.openPeriodMenu.set(null);
  }
  @HostListener("document:click")
  closePeriodMenu(): void {
    this.openPeriodMenu.set(null);
    this.dateMenuOpen.set(false);
  }
  @HostListener("document:keydown.escape")
  closePeriodMenuOnEscape(): void {
    this.openPeriodMenu.set(null);
    this.dateMenuOpen.set(false);
  }
  openClientDialog(): void { this.showClientDialog.set(true); }
  closeClientDialog(): void { this.showClientDialog.set(false); }
  onClientCreated(): void { this.closeClientDialog(); void this.refreshAll(); }
  openProjectDialog(): void {
    this.showProjectDialog.set(true);
    if (this.data.clients().length === 0) {
      firstValueFrom(this.api.listClients({ page: 1, limit: 200 })).then((res) => {
        const items = ((res as any)?.items || []) as any[];
        this.data.clients.set(items.map((c) => this.toClient(c)));
      }).catch(() => undefined);
    }
  }
  closeProjectDialog(): void { this.showProjectDialog.set(false); }
  async onProjectCreated(value: any): Promise<void> {
    const clientId = String(value?.clientId || "").trim();
    const stored = this.data.clients().find((c) => String(c._id || c.id) === clientId);
    const client = stored ?? (clientId ? this.toClient({ _id: clientId, name: "(unknown)" }) : null);
    if (!client) {
      this.closeProjectDialog();
      void this.refreshAll();
      return;
    }
    try {
      await this.data.addProject(client, {
        name: String(value.name || "").trim(),
        sites: Array.isArray(value.sites) ? value.sites : [],
        startDate: String(value.startDate || "").trim(),
        supervisor: String(value.supervisor || "").trim(),
        supervisorId: value.supervisorId || undefined,
        status: value.status || "Active",
        totalValue: Number(value.totalValue) || 0,
      });
    } catch (err) {
      console.error("[UniversalDashboard] Failed to create project:", (err as any)?.message ?? err);
    } finally {
      this.closeProjectDialog();
      void this.refreshAll();
    }
  }
  private toClient(raw: any) {
    const name = String(raw?.name || raw?.clientName || "Unnamed Client").trim();
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "C";
    return {
      id: String(raw?.id || raw?.clientId || raw?._id || ""),
      initials,
      name,
      mobile: String(raw?.mobile || ""),
      address: String(raw?.address || ""),
      gstNumber: raw?.gstNumber || raw?.gst || undefined,
      state: raw?.state || undefined,
      status: (raw?.status === "On Hold" || raw?.status === "Completed") ? raw.status : "Active",
      projectIds: Array.isArray(raw?.projectIds) ? raw.projectIds : [],
      supervisor: String(raw?.supervisor || ""),
      _id: raw?._id ? String(raw._id) : undefined,
    } as any;
  }
  openVendorDialog(): void { this.showVendorDialog.set(true); }
  closeVendorDialog(): void { this.showVendorDialog.set(false); }
  onVendorCreated(): void { this.closeVendorDialog(); void this.refreshAll(); }
  projectRoute(project: any): any[] { return project.clientId && project.id ? ["/clients", project.clientId, "projects", project.id] : ["/projects"]; }
  greeting(): string { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; }
  money(value: number | null | undefined): string { return formatMoney(Number(value || 0)); }
  expenseApprovalDescription(row: any): string {
    return String(row.description || row.notes || row.transactionType || row.category || "Expense request").trim();
  }
  expenseApprovalContext(row: any): string {
    const parts: string[] = [];
    const project = String(row.project || "").trim();
    const site = String(row.site || "").trim();
    const rawDate = String(row.expenseDate || row.date || "").trim();
    parts.push(project || "General expense");
    if (site) parts.push(site);
    if (rawDate) {
      const date = new Date(rawDate);
      parts.push(Number.isNaN(date.getTime()) ? rawDate : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));
    }
    return parts.join(" • ");
  }

  private async loadAllPayments(): Promise<any[]> {
    return this.loadCursorPages((cursor, page) => firstValueFrom(this.api.listPayments({ cursor, page, limit: 200 })));
  }

  private async migrateLegacyPayments(existingPayments: any[]): Promise<number> {
    const legacyRows = [...this.legacyPayments()];
    if (!legacyRows.length) return 0;

    const supportedModes = new Set([
      "Cash", "UPI", "Bank Transfer", "NEFT", "RTGS", "IMPS", "Cheque",
      "Credit Card", "Debit Card", "Net Banking", "Demand Draft", "Wallet", "Other",
    ]);
    const serverRows = [...existingPayments];
    let migratedCount = 0;

    for (const row of legacyRows) {
      const rowId = String(row.__rowId || row.id || "").trim();
      const migrationMarker = `Legacy workspace payment: ${rowId}`;
      if (serverRows.some((payment) => String(payment.notes || "") === migrationMarker)) {
        this.data.deleteSharedRow(rowId);
        continue;
      }

      const rowProjectId = String(row.projectId || row.__projectId || "").trim();
      const rowProjectName = String(row.project || row.projectName || "").trim().toLowerCase();
      const project = this.projects().find((candidate) => {
        const ids = [candidate.id, candidate._id, candidate.projectId].map((value) => String(value || ""));
        return ids.includes(rowProjectId) || (rowProjectName && String(candidate.name || "").toLowerCase() === rowProjectName);
      });
      const projectObjectId = String(project?.id || project?._id || "");
      const clientObjectId = String(project?.clientId || "");
      const amount = this.amountOf(row);
      if (!/^[a-f0-9]{24}$/i.test(projectObjectId) || !/^[a-f0-9]{24}$/i.test(clientObjectId) || amount <= 0) {
        continue;
      }

      const rawDate = String(row.date || row.paymentDate || "");
      const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : new Date().toISOString().slice(0, 10);
      const rawMode = String(row.mode || "Other").trim();
      const mode = supportedModes.has(rawMode) ? rawMode : "Other";

      try {
        const result = await firstValueFrom(this.api.createPayment({
          projectId: projectObjectId,
          clientId: clientObjectId,
          date,
          amount,
          mode,
          receiptNumber: String(row.receiptNumber || row.receipt || "").trim() || undefined,
          transactionReference: String(row.transactionReference || row.reference || "").trim() || undefined,
          collectedBy: String(row.collectedBy || this.userDisplayName()).trim() || "Admin",
          notes: migrationMarker,
        }));
        serverRows.push(result.payment);
        this.data.deleteSharedRow(rowId);
        migratedCount += 1;
      } catch (error) {
        console.warn("[Dashboard] Could not migrate legacy payment row", rowId, error);
      }
    }

    return migratedCount;
  }

  private async loadAllLegacyExpenses(): Promise<any[]> {
    return this.loadCursorPages((cursor, page) => firstValueFrom(this.api.listExpenses({ cursor, page, limit: 200 })));
  }

  private async loadAllGeneralExpenses(): Promise<any[]> {
    const response = await firstValueFrom(this.api.listAllGeneralExpenses());
    return this.dedupeRows((response as any)?.items || []);
  }

  private async loadAllMaterials(): Promise<any[]> {
    return this.loadCursorPages((cursor, page) => firstValueFrom(this.api.listMaterials({ cursor, page, limit: 200 })));
  }

  private async loadAllSubcontractorPayments(): Promise<any[]> {
    return this.loadCursorPages((cursor, page) => firstValueFrom(this.api.listSubcontractorPayments({ cursor, page, limit: 200 })));
  }

  private async loadCursorPages(fetchPage: (cursor: string | undefined, page: number) => Promise<any>): Promise<any[]> {
    const rows: any[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let page = 1;
    while (true) {
      const response = await fetchPage(cursor, page);
      rows.push(...((response as any)?.items || []));
      const nextCursor = String((response as any)?.nextCursor || "");
      if (!nextCursor || seenCursors.has(nextCursor)) break;
      seenCursors.add(nextCursor);
      cursor = nextCursor;
      page += 1;
    }
    return this.dedupeRows(rows);
  }

  private dedupeRows(rows: any[]): any[] {
    const unique = new Map<string, any>();
    rows.forEach((row, index) => {
      const id = String(row?.id || row?._id || row?.expenseId || row?.paymentId || "");
      const fallback = `${row?.dashboardSource || row?.type || "row"}|${row?.date || row?.createdAt || ""}|${row?.amount || 0}|${row?.description || ""}|${index}`;
      unique.set(id || fallback, row);
    });
    return [...unique.values()];
  }

  private isPostedPayment(row: any): boolean {
    const status = String(row?.status || "").toLowerCase();
    return status !== "rejected";
  }

  private amountOf(row: any): number {
    const amount = Number(String(row?.amount ?? 0).replace(/[^\d.-]/g, ""));
    return Number.isFinite(amount) ? Math.max(0, amount) : 0;
  }

  private isPostedExpense(row: any): boolean {
    if (String(row?.transactionType || "").toLowerCase() === "cash added") return false;
    const status = String(row?.status || "").toLowerCase();
    if (["Expense", "Supervisor Expense", "Material Expense", "Subcontractor Payment"].includes(String(row?.dashboardSource || ""))) return status !== "rejected";
    return !status || status === "approved" || status === "completed" || status === "paid";
  }

  private legacyExpenseSource(row: any): string {
    if (row?.isSiteMaterial || row?.materialName || row?.siteMaterialName) return "Material Expense";
    return String(row?.type || "").toLowerCase() === "site" || row?.supervisorId || row?.supervisor
      ? "Supervisor Expense"
      : "Expense";
  }

  private expenseCategory(row: any): string {
    const source = String(row?.dashboardSource || "Expense");
    return ["Expense", "Supervisor Expense", "Material Expense", "Subcontractor Payment"].includes(source)
      ? source
      : "Expense";
  }

  private displayDate(date: Date): string {
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  private dateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private dateOf(row: any): number { const raw = row.date || row.paymentDate || row.expenseDate || row.createdAt; const value = raw ? new Date(raw).getTime() : Number.NaN; return Number.isFinite(value) ? value : 0; }
  private currentRange(): { from: Date; to: Date } {
    if (this.periodKey() === "custom" && this.customDateFrom() && this.customDateTo()) {
      return {
        from: new Date(`${this.customDateFrom()}T00:00:00`),
        to: new Date(`${this.customDateTo()}T23:59:59.999`),
      };
    }
    const to = new Date(`${this.selectedDate()}T23:59:59`); let from = new Date(to);
    switch (this.periodKey()) { case "today": from.setHours(0, 0, 0, 0); break; case "week": from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0); break; case "3m": from.setMonth(from.getMonth() - 2, 1); break; case "6m": from.setMonth(from.getMonth() - 5, 1); break; case "year": from = new Date(from.getFullYear(), 0, 1); break; default: from = new Date(from.getFullYear(), from.getMonth(), 1); }
    return { from, to };
  }
  private inCurrentPeriod(row: any): boolean { const value = this.dateOf(row); const range = this.currentRange(); return value >= range.from.getTime() && value <= range.to.getTime(); }
  private trendBuckets(): Array<{ label: string; from: Date; to: Date }> {
    const range = this.currentRange(); const days = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86_400_000)); const buckets: Array<{ label: string; from: Date; to: Date }> = [];
    if (days <= 14) { const cursor = new Date(range.from); while (cursor <= range.to && buckets.length < 14) { const from = new Date(cursor); const to = new Date(cursor); to.setHours(23, 59, 59, 999); buckets.push({ label: from.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), from, to }); cursor.setDate(cursor.getDate() + 1); } return buckets; }
    if (days <= 45) { const cursor = new Date(range.from); while (cursor <= range.to && buckets.length < 6) { const from = new Date(cursor); const to = new Date(cursor); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999); buckets.push({ label: from.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), from, to }); cursor.setDate(cursor.getDate() + 7); } return buckets; }
    const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1); while (cursor <= range.to && buckets.length < 12) { const from = new Date(cursor); const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999); buckets.push({ label: from.toLocaleDateString("en-IN", { month: "short" }), from, to }); cursor.setMonth(cursor.getMonth() + 1); } return buckets;
  }
  private sumBucket(rows: any[], bucket: { from: Date; to: Date }): number { return rows.reduce((sum, row) => { const value = this.dateOf(row); return value >= bucket.from.getTime() && value <= bucket.to.getTime() ? sum + this.amountOf(row) : sum; }, 0); }
}
