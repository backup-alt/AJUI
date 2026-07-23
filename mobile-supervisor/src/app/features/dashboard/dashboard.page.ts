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
  checkmarkCircleOutline,
  cashOutline,
  documentTextOutline,
  chevronForwardOutline,
  locationOutline,
  gitBranchOutline,
  boatOutline,
  trainOutline,
  leafOutline,
  storefrontOutline,
  ribbonOutline,
  analyticsOutline,
  clipboardOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardData, Site } from '../../shared/models';
import { Expense } from '../../shared/models/expense.model';
import { CurrencyPipe, DatePipe } from '@angular/common';

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
  ],
  template: `
    <ion-content class="dashboard-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshDashboard($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="dash-wrap">

        <!-- ═══ GREETING ═══ -->
        <div class="greeting-row">
          <div class="greeting-avatar">{{ userInitial() }}</div>
          <span class="greeting-text">{{ greeting() }}, {{ userName() }}</span>
        </div>

        <!-- ═══ STAT CARDS — 2×2 GRID ═══ -->
        <section class="stat-grid">
          <button class="stat-card" (click)="navigateTo('/tabs/sites')">
            <div class="stat-icon si-navy">
              <ion-icon name="location-outline"></ion-icon>
            </div>
            <span class="stat-val">{{ dashboard()?.counts?.sites || 0 }}</span>
            <span class="stat-label">Sites</span>
          </button>
          <button class="stat-card" (click)="navigateTo('/tabs/materials')">
            <div class="stat-icon si-gold">
              <ion-icon name="cube-outline"></ion-icon>
            </div>
            <span class="stat-val">{{ dashboard()?.counts?.pendingMaterials || 0 }}</span>
            <span class="stat-label">Materials</span>
          </button>
          <button class="stat-card" (click)="navigateTo('/tabs/labour')">
            <div class="stat-icon si-navy">
              <ion-icon name="people-outline"></ion-icon>
            </div>
            <span class="stat-val">{{ dashboard()?.counts?.pendingLabour || 0 }}</span>
            <span class="stat-label">Labour</span>
          </button>
          <button class="stat-card" (click)="navigateTo('/tabs/requests')">
            <div class="stat-icon si-gold">
              <ion-icon name="clipboard-outline"></ion-icon>
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
              <div class="expense-header-row">
                <span class="expense-total">{{ dashboard()?.todayExpense?.total | currency:'INR':'symbol':'1.0-0' }}</span>
                <span class="expense-count">{{ dashboard()?.todayExpense?.count || 0 }} txn</span>
              </div>
            </div>
            <button class="expense-add" (click)="navigateTo('/tabs/expenses/create')">
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
                    <span class="expense-row-meta">{{ expense.materialVendor || expense.type }}</span>
                  </div>
                  <div class="expense-row-right">
                    <span class="expense-row-amt">{{ expense.amount | currency:'INR':'symbol':'1.0-0' }}</span>
                    <span class="expense-row-time">{{ expense.createdAt | date:'shortTime' }}</span>
                  </div>
                </div>
              }
              @if (todayExpenses().length > 4) {
                <button class="expense-viewall" (click)="navigateTo('/tabs/expenses')">
                  View all {{ todayExpenses().length }}
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
            <button class="viewall-btn" (click)="navigateTo('/tabs/sites')">View All</button>
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
                <div class="site-icon-box"
                  [class.si-active]="site.status === 'Active'"
                  [class.si-hold]="site.status === 'On Hold'"
                  [class.si-done]="site.status === 'Completed'">
                  <ion-icon [name]="getSiteIcon(site.name)"></ion-icon>
                </div>
                <div class="site-info">
                  <span class="site-name">{{ site.name }}</span>
                  <span class="site-meta">
                    {{ site.employeeCount || 0 }} worker{{ (site.employeeCount || 0) !== 1 ? 's' : '' }}
                  </span>
                </div>
                <span class="site-status">
                  <span class="status-dot"
                    [class.dot-active]="site.status === 'Active'"
                    [class.dot-hold]="site.status === 'On Hold'"
                    [class.dot-done]="site.status === 'Completed'"></span>
                  {{ site.status || 'Active' }}
                </span>
                <ion-icon name="chevron-forward-outline" class="site-arrow"></ion-icon>
              </button>
            }
          }
        </section>

        <div class="bottom-spacer"></div>
      </div>

      <!-- ═══ BOTTOM NAV — fixed full-width ═══ -->
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
      --gold-bg: rgba(201, 150, 43, 0.08);
      --cream: #F5F3EE;
      --white: #FFFFFF;
      --slate: #5B6472;
      --slate-light: #8A929E;
      --green: #22C55E;
      --green-bg: rgba(34, 197, 94, 0.08);
      --amber: #F59E0B;
      --amber-bg: rgba(245, 158, 11, 0.08);
      --border: #E8E5DF;
      --r: 4px;
      --shadow: 0 1px 2px rgba(11, 30, 77, 0.06);
    }

    /* ─────────────────────────────────────────────
       BASE
       ───────────────────────────────────────────── */
    .dashboard-content {
      --background: var(--cream);
      --color: #1A1A1A;
    }
    .dash-wrap {
      padding: 0 16px;
      padding-top: env(safe-area-inset-top);
    }

    /* ─────────────────────────────────────────────
       GREETING — single compact line
       ───────────────────────────────────────────── */
    .greeting-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 0 16px;
    }
    .greeting-avatar {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      background: var(--navy);
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      letter-spacing: 0;
    }
    .greeting-text {
      font-size: 14px;
      font-weight: 500;
      color: var(--slate);
    }

    /* ─────────────────────────────────────────────
       STAT CARDS — 2×2 GRID
       ───────────────────────────────────────────── */
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: 12px;
      cursor: pointer;
      font-family: inherit;
      box-shadow: var(--shadow);
      transition: transform 100ms ease;
    }
    .stat-card:active {
      transform: scale(0.97);
    }

    .stat-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--r);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stat-icon ion-icon {
      font-size: 17px;
    }
    .si-navy {
      background: rgba(11, 30, 77, 0.06);
      color: var(--navy);
    }
    .si-gold {
      background: var(--gold-bg);
      color: var(--gold);
    }

    .stat-val {
      font-size: 22px;
      font-weight: 700;
      color: #1A1A1A;
      line-height: 1;
    }
    .stat-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--slate);
    }

    /* ─────────────────────────────────────────────
       EXPENSE CARD
       ───────────────────────────────────────────── */
    .expense-card {
      background: var(--navy);
      border-radius: var(--r);
      margin-bottom: 16px;
      overflow: hidden;
    }

    .expense-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 16px 16px 12px;
    }
    .expense-header-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .expense-title {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.45);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .expense-header-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .expense-total {
      font-size: 24px;
      font-weight: 700;
      color: #FFFFFF;
      line-height: 1.2;
    }
    .expense-count {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.35);
    }

    .expense-add {
      width: 32px;
      height: 32px;
      border-radius: var(--r);
      background: var(--gold);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .expense-add:active {
      opacity: 0.85;
    }
    .expense-add ion-icon {
      font-size: 20px;
      color: #FFFFFF;
    }

    .expense-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.07);
      margin: 0 16px;
    }

    .expense-list {
      padding: 0;
    }

    .expense-empty {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px;
      color: rgba(255, 255, 255, 0.3);
      font-size: 13px;
    }
    .expense-empty ion-icon {
      font-size: 16px;
    }

    .expense-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .expense-row:last-of-type {
      border-bottom: none;
    }

    .expense-row-icon {
      width: 30px;
      height: 30px;
      border-radius: var(--r);
      background: rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .expense-row-icon ion-icon {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.45);
    }

    .expense-row-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .expense-row-desc {
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .expense-row-meta {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.3);
    }

    .expense-row-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 1px;
      flex-shrink: 0;
    }
    .expense-row-amt {
      font-size: 13px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.85);
    }
    .expense-row-time {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.25);
    }

    .expense-viewall {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
      padding: 10px;
      background: none;
      border: none;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      color: var(--gold);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .expense-viewall:active {
      background: rgba(255, 255, 255, 0.03);
    }
    .expense-viewall ion-icon {
      font-size: 13px;
    }

    /* ─────────────────────────────────────────────
       ACTIVE SITES
       ───────────────────────────────────────────── */
    .sites-section {
      margin-bottom: 0;
    }
    .sites-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .sites-title {
      font-size: 15px;
      font-weight: 700;
      color: #1A1A1A;
      margin: 0;
    }
    .viewall-btn {
      background: none;
      border: 0;
      padding: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--gold);
      cursor: pointer;
      font-family: inherit;
    }

    .site-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: 12px;
      margin-bottom: 6px;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      box-shadow: var(--shadow);
      transition: transform 100ms ease;
    }
    .site-row:active {
      transform: scale(0.985);
    }

    .site-icon-box {
      width: 36px;
      height: 36px;
      border-radius: var(--r);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .site-icon-box ion-icon {
      font-size: 18px;
    }
    .si-active {
      background: var(--green-bg);
      color: #15803D;
    }
    .si-hold {
      background: var(--amber-bg);
      color: #B45309;
    }
    .si-done {
      background: rgba(107, 114, 128, 0.08);
      color: var(--slate);
    }

    .site-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .site-name {
      font-size: 14px;
      font-weight: 600;
      color: #1A1A1A;
    }
    .site-meta {
      font-size: 12px;
      color: var(--slate);
    }

    .site-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--slate);
      flex-shrink: 0;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--slate-light);
    }
    .dot-active {
      background: var(--green);
    }
    .dot-hold {
      background: var(--amber);
    }
    .dot-done {
      background: var(--slate-light);
    }

    .site-arrow {
      font-size: 14px;
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
      gap: 8px;
      padding: 24px 16px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--r);
      box-shadow: var(--shadow);
    }
    .sites-empty-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--r);
      background: var(--gold-bg);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sites-empty-icon ion-icon {
      font-size: 20px;
      color: var(--gold);
    }
    .sites-empty-text {
      font-size: 13px;
      color: var(--slate);
      font-weight: 500;
    }
    .sites-empty-cta {
      background: var(--navy);
      color: #FFFFFF;
      border: none;
      border-radius: var(--r);
      padding: 6px 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      margin-top: 4px;
    }
    .sites-empty-cta:active {
      background: var(--navy-dark);
    }

    .bottom-spacer { height: 16px; }

    /* ─────────────────────────────────────────────
       BOTTOM NAV — fixed full-width
       ───────────────────────────────────────────── */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: stretch;
      background: var(--white);
      border-top: 1px solid var(--border);
      padding-bottom: env(safe-area-inset-bottom);
      z-index: 100;
    }
    .nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      background: none;
      border: 0;
      padding: 8px 0;
      cursor: pointer;
      font-family: inherit;
    }
    .nav-item ion-icon {
      font-size: 20px;
      color: var(--slate-light);
    }
    .nav-item span {
      font-size: 10px;
      font-weight: 600;
      color: var(--slate-light);
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
  userName = signal<string>('Supervisor');

  userInitial(): string {
    return this.userName().charAt(0).toUpperCase();
  }

  greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  getSiteIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('road') || n.includes('highway') || n.includes('flyover')) return 'git-branch-outline';
    if (n.includes('bridge')) return 'boat-outline';
    if (n.includes('metro') || n.includes('rail')) return 'train-outline';
    if (n.includes('house') || n.includes('villa') || n.includes('home')) return 'home-outline';
    if (n.includes('tower') || n.includes('sky')) return 'business-outline';
    if (n.includes('park') || n.includes('garden')) return 'leaf-outline';
    if (n.includes('commercial') || n.includes('mall') || n.includes('office')) return 'storefront-outline';
    if (n.includes('terrace') || n.includes('block') || n.includes('mep')) return 'ribbon-outline';
    if (n.includes('stock') || n.includes('yard') || n.includes('godown')) return 'analytics-outline';
    return 'construct-outline';
  }

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
      checkmarkCircleOutline, cashOutline,
      documentTextOutline, chevronForwardOutline, locationOutline,
      gitBranchOutline, boatOutline, trainOutline,
      leafOutline, storefrontOutline, ribbonOutline,
      analyticsOutline, clipboardOutline,
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

      this.supervisor.getProfile().subscribe({
        next: (res) => {
          const name = (res as { user?: { name?: string } }).user?.name;
          if (name) this.userName.set(name);
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
