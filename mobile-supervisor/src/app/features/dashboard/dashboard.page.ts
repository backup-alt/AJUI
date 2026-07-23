import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  cubeOutline,
  peopleOutline,
  walletOutline,
  constructOutline,
  homeOutline,
  businessOutline,
  receiptOutline,
  settingsOutline,
  personOutline,
  alertCircleOutline,
  timeOutline,
  cashOutline,
  documentTextOutline,
  chevronForwardOutline,
  locationOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardData, Site } from '../../shared/models';
import { Expense } from '../../shared/models/expense.model';
import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    CurrencyPipe,
    DatePipe,
    CurrencyPipe,
    TitleCasePipe,
  ],
  template: `
    <ion-content class="dashboard-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshDashboard($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="dash-wrap">

        <!-- ═══ STAT CARDS — 2×2 GRID ═══ -->
        <section class="stat-grid">
          <button class="stat-card" (click)="navigateTo('/tabs/sites')">
            <div class="stat-icon stat-icon--navy">
              <ion-icon name="location-outline"></ion-icon>
            </div>
            <span class="stat-val">{{ dashboard()?.counts?.sites || 0 }}</span>
            <span class="stat-label">Sites</span>
          </button>
          <button class="stat-card" (click)="navigateTo('/tabs/materials')">
            <div class="stat-icon stat-icon--gold">
              <ion-icon name="cube-outline"></ion-icon>
            </div>
            <span class="stat-val">{{ dashboard()?.counts?.pendingMaterials || 0 }}</span>
            <span class="stat-label">Materials</span>
          </button>
          <button class="stat-card" (click)="navigateTo('/tabs/labour')">
            <div class="stat-icon stat-icon--navy">
              <ion-icon name="people-outline"></ion-icon>
            </div>
            <span class="stat-val">{{ dashboard()?.counts?.pendingLabour || 0 }}</span>
            <span class="stat-label">Labour</span>
          </button>
          <button class="stat-card" (click)="navigateTo('/tabs/requests')">
            <div class="stat-icon stat-icon--gold">
              <ion-icon name="alert-circle-outline"></ion-icon>
            </div>
            <span class="stat-val">{{ dashboard()?.counts?.pendingApprovals || 0 }}</span>
            <span class="stat-label">Approvals</span>
          </button>
        </section>

        <!-- ═══ TODAY'S EXPENSES ═══ -->
        <section class="expense-card">
          <div class="expense-header">
            <div class="expense-header-left">
              <span class="expense-title">Today's Expenses</span>
              <span class="expense-total">{{ dashboard()?.todayExpense?.total | currency:'INR':'symbol':'1.0-0' }}</span>
              <span class="expense-count">{{ dashboard()?.todayExpense?.count || 0 }} transactions</span>
            </div>
            <button class="expense-add-btn" (click)="navigateTo('/tabs/expenses/create')">
              <ion-icon name="add-outline"></ion-icon>
            </button>
          </div>

          <div class="expense-divider"></div>

          <div class="expense-list">
            @if (todayExpenses().length === 0) {
              <div class="expense-empty">
                <ion-icon name="receipt-outline"></ion-icon>
                <span>No expenses logged today</span>
              </div>
            } @else {
              @for (expense of todayExpenses().slice(0, 4); track expense._id) {
                <div class="expense-row">
                  <div class="expense-row-icon">
                    <ion-icon [name]="getExpenseIcon(expense)"></ion-icon>
                  </div>
                  <div class="expense-row-details">
                    <span class="expense-row-desc">{{ expense.description }}</span>
                    <span class="expense-row-meta">{{ expense.materialVendor || expense.type | titlecase }}</span>
                  </div>
                  <div class="expense-row-right">
                    <span class="expense-row-amount">{{ expense.amount | currency:'INR':'symbol':'1.0-0' }}</span>
                    <span class="expense-row-time">{{ expense.createdAt | date:'shortTime' }}</span>
                  </div>
                </div>
              }
              @if (todayExpenses().length > 4) {
                <button class="expense-view-all" (click)="navigateTo('/tabs/expenses')">
                  View all {{ todayExpenses().length }} expenses
                  <ion-icon name="chevron-forward-outline"></ion-icon>
                </button>
              }
            }
          </div>
        </section>

        <!-- ═══ ACTIVE SITES ═══ -->
        <section class="sites-section">
          <div class="sites-head">
            <h2 class="sites-title">Active Sites</h2>
            <button class="view-all-btn" (click)="navigateTo('/tabs/sites')">View All</button>
          </div>

          @if (sites().length === 0) {
            <div class="sites-empty">
              <div class="sites-empty-icon">
                <ion-icon name="location-outline"></ion-icon>
              </div>
              <span class="sites-empty-text">No active sites assigned</span>
              <button class="sites-empty-cta" (click)="navigateTo('/tabs/sites')">Add a site</button>
            </div>
          } @else {
            @for (site of sites().slice(0, 5); track site.id) {
              <button class="site-row" (click)="navigateToSite(site)">
                <div class="site-icon-box">
                  <ion-icon name="construct-outline"></ion-icon>
                </div>
                <div class="site-info">
                  <span class="site-name">{{ site.name }}</span>
                  <span class="site-meta">
                    {{ site.employeeCount || 0 }} worker{{ (site.employeeCount || 0) !== 1 ? 's' : '' }}
                  </span>
                </div>
                <span class="site-status"
                  [class.status-active]="site.status === 'Active'"
                  [class.status-hold]="site.status === 'On Hold'"
                  [class.status-done]="site.status === 'Completed'">
                  <span class="status-dot"></span>
                  {{ site.status || 'Active' }}
                </span>
                <ion-icon name="chevron-forward-outline" class="site-arrow"></ion-icon>
              </button>
            }
          }
        </section>

        <div class="bottom-spacer"></div>
      </div>

      <!-- ═══ FLOATING BOTTOM NAV ═══ -->
      <nav class="bottom-nav">
        <button class="nav-item active" (click)="navigateTo('/tabs/dashboard')">
          <ion-icon name="home-outline"></ion-icon>
          <span>Home</span>
        </button>
        <button class="nav-item" (click)="navigateTo('/tabs/sites')">
          <ion-icon name="location-outline"></ion-icon>
          <span>Sites</span>
        </button>
        <button class="nav-item" (click)="navigateTo('/tabs/expenses')">
          <ion-icon name="receipt-outline"></ion-icon>
          <span>Ledger</span>
        </button>
        <button class="nav-item" (click)="navigateTo('/tabs/profile')">
          <ion-icon name="settings-outline"></ion-icon>
          <span>Settings</span>
        </button>
      </nav>
    </ion-content>
  `,
  styles: [`
    /* ─────────────────────────────────────────────
       BRAND TOKENS
       ───────────────────────────────────────────── */
    :host {
      --navy: #0B1E4D;
      --navy-dark: #071538;
      --gold: #C9962B;
      --gold-light: #D4A94E;
      --gold-bg: rgba(201, 150, 43, 0.08);
      --cream: #F5F3EE;
      --white: #FFFFFF;
      --slate: #5B6472;
      --slate-light: #8A929E;
      --green: #22C55E;
      --green-bg: rgba(34, 197, 94, 0.10);
      --amber: #F59E0B;
      --amber-bg: rgba(245, 158, 11, 0.10);
      --red: #EF4444;
      --border: #E8E5DF;
      --radius: 14px;
      --radius-sm: 10px;
      --shadow-sm: 0 1px 3px rgba(11, 30, 77, 0.06);
      --shadow-md: 0 4px 12px rgba(11, 30, 77, 0.08);
    }

    /* ─────────────────────────────────────────────
       BASE
       ───────────────────────────────────────────── */
    .dashboard-content {
      --background: var(--cream);
      --color: #1A1A1A;
    }
    .dash-wrap {
      padding: 4px 20px 0;
      padding-top: env(safe-area-inset-top);
    }

    /* ─────────────────────────────────────────────
       STAT CARDS — 2×2 GRID
       ───────────────────────────────────────────── */
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      cursor: pointer;
      font-family: inherit;
      box-shadow: var(--shadow-sm);
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .stat-card:active {
      transform: scale(0.97);
      box-shadow: var(--shadow-md);
    }

    .stat-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stat-icon ion-icon {
      font-size: 20px;
    }
    .stat-icon--navy {
      background: rgba(11, 30, 77, 0.07);
      color: var(--navy);
    }
    .stat-icon--gold {
      background: var(--gold-bg);
      color: var(--gold);
    }

    .stat-val {
      font-size: 26px;
      font-weight: 700;
      color: #1A1A1A;
      line-height: 1;
      letter-spacing: -0.5px;
    }
    .stat-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--slate);
    }

    /* ─────────────────────────────────────────────
       EXPENSE CARD
       ───────────────────────────────────────────── */
    .expense-card {
      background: var(--navy);
      border-radius: var(--radius);
      margin-bottom: 24px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(11, 30, 77, 0.18);
    }

    .expense-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 20px 20px 14px;
    }
    .expense-header-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .expense-title {
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.55);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .expense-total {
      font-size: 28px;
      font-weight: 700;
      color: #FFFFFF;
      line-height: 1.2;
      letter-spacing: -0.3px;
    }
    .expense-count {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 2px;
    }

    .expense-add-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--gold);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      margin-top: 2px;
      transition: background 120ms ease;
    }
    .expense-add-btn:active {
      background: var(--gold-light);
    }
    .expense-add-btn ion-icon {
      font-size: 22px;
      color: #FFFFFF;
    }

    .expense-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 0 20px;
    }

    .expense-list {
      padding: 4px 0;
    }

    .expense-empty {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 20px;
      color: rgba(255, 255, 255, 0.35);
      font-size: 13px;
    }
    .expense-empty ion-icon {
      font-size: 18px;
    }

    .expense-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .expense-row:last-of-type {
      border-bottom: none;
    }

    .expense-row-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .expense-row-icon ion-icon {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.5);
    }

    .expense-row-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .expense-row-desc {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.85);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .expense-row-meta {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.35);
    }

    .expense-row-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 1px;
      flex-shrink: 0;
    }
    .expense-row-amount {
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }
    .expense-row-time {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.3);
    }

    .expense-view-all {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
      padding: 12px;
      background: none;
      border: none;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      color: var(--gold);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 120ms ease;
    }
    .expense-view-all:active {
      background: rgba(255, 255, 255, 0.04);
    }
    .expense-view-all ion-icon {
      font-size: 14px;
    }

    /* ─────────────────────────────────────────────
       ACTIVE SITES
       ───────────────────────────────────────────── */
    .sites-section {
      margin-bottom: 8px;
    }
    .sites-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .sites-title {
      font-size: 18px;
      font-weight: 700;
      color: #1A1A1A;
      margin: 0;
      letter-spacing: -0.2px;
    }
    .view-all-btn {
      background: none;
      border: 0;
      padding: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--gold);
      cursor: pointer;
      font-family: inherit;
    }

    .site-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px 16px;
      margin-bottom: 10px;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      box-shadow: var(--shadow-sm);
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .site-row:active {
      transform: scale(0.985);
      box-shadow: var(--shadow-md);
    }

    .site-icon-box {
      width: 42px;
      height: 42px;
      border-radius: var(--radius-sm);
      background: rgba(11, 30, 77, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .site-icon-box ion-icon {
      font-size: 20px;
      color: var(--navy);
    }

    .site-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .site-name {
      font-size: 15px;
      font-weight: 600;
      color: #1A1A1A;
      letter-spacing: -0.1px;
    }
    .site-meta {
      font-size: 13px;
      color: var(--slate);
    }

    .site-status {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
      flex-shrink: 0;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .status-active {
      background: var(--green-bg);
      color: #15803D;
    }
    .status-active .status-dot {
      background: var(--green);
    }
    .status-hold {
      background: var(--amber-bg);
      color: #B45309;
    }
    .status-hold .status-dot {
      background: var(--amber);
    }
    .status-done {
      background: rgba(107, 114, 128, 0.10);
      color: var(--slate);
    }
    .status-done .status-dot {
      background: var(--slate-light);
    }

    .site-arrow {
      font-size: 16px;
      color: var(--slate-light);
      flex-shrink: 0;
    }

    /* ─────────────────────────────────────────────
       SITES EMPTY STATE
       ───────────────────────────────────────────── */
    .sites-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 32px 20px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
    }
    .sites-empty-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--gold-bg);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sites-empty-icon ion-icon {
      font-size: 24px;
      color: var(--gold);
    }
    .sites-empty-text {
      font-size: 14px;
      color: var(--slate);
      font-weight: 500;
    }
    .sites-empty-cta {
      background: var(--navy);
      color: #FFFFFF;
      border: none;
      border-radius: 8px;
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      margin-top: 4px;
    }
    .sites-empty-cta:active {
      background: var(--navy-dark);
    }

    .bottom-spacer { height: 100px; }

    /* ─────────────────────────────────────────────
       FLOATING BOTTOM NAV — navy/gold
       ───────────────────────────────────────────── */
    .bottom-nav {
      position: fixed;
      bottom: calc(14px + env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 2px;
      background: var(--navy);
      border-radius: 24px;
      padding: 6px 10px;
      box-shadow: 0 8px 28px rgba(11, 30, 77, 0.25);
      z-index: 100;
    }
    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      background: none;
      border: 0;
      padding: 7px 16px;
      border-radius: 16px;
      cursor: pointer;
      font-family: inherit;
      transition: background 120ms ease;
    }
    .nav-item:active {
      background: rgba(255, 255, 255, 0.06);
    }
    .nav-item ion-icon {
      font-size: 21px;
      color: rgba(255, 255, 255, 0.4);
      transition: color 120ms ease;
    }
    .nav-item span {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.4);
      letter-spacing: 0.2px;
      transition: color 120ms ease;
    }
    .nav-item.active {
      background: rgba(201, 150, 43, 0.15);
    }
    .nav-item.active ion-icon {
      color: var(--gold);
    }
    .nav-item.active span {
      color: var(--gold);
    }
  `],
})
export class DashboardPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private auth = inject(AuthService);
  private router = inject(Router);

  dashboard = signal<DashboardData | null>(null);
  sites = signal<Site[]>([]);
  todayExpenses = signal<Expense[]>([]);

  getExpenseIcon(expense: Expense): string {
    if (expense.isSiteMaterial) return 'cube-outline';
    if (expense.transactionType === 'Cash Added') return 'cash-outline';
    if (expense.description?.toLowerCase().includes('labour') || expense.description?.toLowerCase().includes('worker')) return 'people-outline';
    if (expense.description?.toLowerCase().includes('transport') || expense.description?.toLowerCase().includes('vehicle')) return 'construct-outline';
    return 'document-text-outline';
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      cubeOutline, peopleOutline, walletOutline,
      constructOutline, homeOutline, businessOutline,
      receiptOutline, settingsOutline, personOutline,
      alertCircleOutline, timeOutline, cashOutline,
      documentTextOutline, chevronForwardOutline, locationOutline,
    });

    await this.auth.initAfterLogin();
    await this.loadDashboard();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:site-changed', this.handleSiteChange);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:site-changed', this.handleSiteChange);
    }
  }

  private handleSiteChange = (): void => {
    void this.loadDashboard();
  };

  async refreshDashboard(event: CustomEvent): Promise<void> {
    await this.loadDashboard();
    (event.target as HTMLIonRefresherElement).complete();
  }

  async loadDashboard(): Promise<void> {
    try {
      this.supervisor.getDashboard().subscribe({
        next: (response) => {
          this.dashboard.set(response.dashboard);
        },
        error: (err) => {
          console.error('[Dashboard] failed to load', err);
        },
      });

      this.supervisor.getSites().subscribe({
        next: (res) => {
          this.sites.set(res.sites || []);
        },
        error: () => undefined,
      });

      this.loadTodayExpenses();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  }

  private loadTodayExpenses(): void {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    this.supervisor.getExpenses({
      dateFrom: todayStr,
      dateTo: todayStr,
      limit: 5,
    }).subscribe({
      next: (res) => {
        this.todayExpenses.set(res.expenses || []);
      },
      error: () => undefined,
    });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  navigateToSite(site: Site): void {
    this.supervisor.setSelectedSite(
      site.siteId,
      site.projectId || '',
      site.projectName || '',
      site.name,
    );
    this.router.navigate(['/tabs/sites']);
  }
}
