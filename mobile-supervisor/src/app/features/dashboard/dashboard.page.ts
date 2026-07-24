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
  constructOutline,
  homeOutline,
  businessOutline,
  receiptOutline,
  personOutline,
  cashOutline,
  documentTextOutline,
  chevronForwardOutline,
  locationOutline,
  clipboardOutline,
  addOutline,
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
          <div class="expense-accent"></div>
          <div class="expense-body">
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
                      <span class="expense-row-meta">
                        {{ expense.materialVendor || expense.type }}
                        <span class="meta-dot">·</span>
                        {{ expense.createdAt | date:'MMM d' }}
                        <span class="meta-dot">·</span>
                        {{ expense.createdAt | date:'shortTime' }}
                      </span>
                    </div>
                    <div class="expense-row-right">
                      <span class="expense-row-amt">{{ expense.amount | currency:'INR':'symbol':'1.0-0' }}</span>
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
                <span class="status-dot"
                  [class.dot-active]="site.status === 'Active'"
                  [class.dot-hold]="site.status === 'On Hold'"
                  [class.dot-done]="site.status === 'Completed'"></span>
                <div class="site-info">
                  <span class="site-name">{{ site.name }}</span>
                  <span class="site-meta">
                    {{ site.employeeCount || 0 }} worker{{ (site.employeeCount || 0) !== 1 ? 's' : '' }}
                    @if (site.updatedAt) {
                      <span class="meta-dot">·</span> {{ timeAgo(site.updatedAt) }}
                    }
                  </span>
                </div>
                <ion-icon name="chevron-forward-outline" class="site-arrow"></ion-icon>
              </button>
            }
          }
        </section>

        <div class="bottom-spacer"></div>
      </div>
    </ion-content>
  `,
  styles: [`
    /* ─────────────────────────────────────────────
       BASE
       ───────────────────────────────────────────── */
    .dashboard-content {
      --background: var(--m3-surface);
      --color: var(--m3-on-surface);
    }
    .dash-wrap {
      padding: 0 var(--md-space-4);
      padding-top: env(safe-area-inset-top);
    }

    /* ─────────────────────────────────────────────
       GREETING
       ───────────────────────────────────────────── */
    .greeting-row {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      padding: var(--md-space-4) 0 var(--md-space-4);
    }
    .greeting-avatar {
      width: 36px;
      height: 36px;
      border-radius: var(--md-radius-md);
      background: var(--m3-primary);
      color: var(--m3-on-primary);
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .greeting-text {
      font-size: 20px;
      font-weight: 700;
      color: var(--m3-on-surface);
      letter-spacing: -0.2px;
    }

    /* ─────────────────────────────────────────────
       STAT CARDS — 2×2 GRID
       ───────────────────────────────────────────── */
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--md-space-3);
      margin-bottom: var(--md-space-5);
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--md-space-2);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-3);
      cursor: pointer;
      font-family: inherit;
      box-shadow: var(--md-elevation-1);
      transition: transform 100ms ease;
    }
    .stat-card:active {
      transform: scale(0.97);
    }

    .stat-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--md-radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stat-icon ion-icon {
      font-size: 17px;
    }
    .si-navy {
      background: var(--m3-primary-container);
      color: var(--m3-primary);
    }
    .si-gold {
      background: var(--m3-secondary-container);
      color: var(--m3-secondary);
    }

    .stat-val {
      font-size: 22px;
      font-weight: 700;
      color: var(--m3-on-surface);
      line-height: 1;
    }
    .stat-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--m3-on-surface-muted);
    }

    /* ─────────────────────────────────────────────
       EXPENSE CARD
       ───────────────────────────────────────────── */
    .expense-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      margin-bottom: var(--md-space-5);
      overflow: hidden;
      box-shadow: var(--md-elevation-1);
    }

    .expense-accent {
      height: 3px;
      background: var(--m3-primary);
    }

    .expense-body {
      padding: 0;
    }

    .expense-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: var(--md-space-3) var(--md-space-4) var(--md-space-2);
    }
    .expense-header-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .expense-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .expense-header-row {
      display: flex;
      align-items: baseline;
      gap: var(--md-space-2);
    }
    .expense-total {
      font-size: 22px;
      font-weight: 700;
      color: var(--m3-primary);
      line-height: 1.2;
    }
    .expense-count {
      font-size: 11px;
      color: var(--m3-on-surface-muted);
    }

    .expense-add {
      width: 28px;
      height: 28px;
      border-radius: var(--md-radius-md);
      background: var(--m3-primary);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      margin-top: var(--md-space-1);
    }
    .expense-add:active {
      opacity: 0.8;
    }
    .expense-add ion-icon {
      font-size: 16px;
      color: var(--m3-on-primary);
    }

    .expense-divider {
      height: 1px;
      background: var(--m3-outline-variant);
      margin: 0 var(--md-space-4);
    }

    .expense-list {
      padding: 0;
    }

    .expense-empty {
      display: flex;
      align-items: center;
      gap: var(--md-space-2);
      padding: var(--md-space-3) var(--md-space-4);
      color: var(--m3-on-surface-muted);
      font-size: 13px;
    }
    .expense-empty ion-icon {
      font-size: 16px;
    }

    .expense-row {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      padding: var(--md-space-2) var(--md-space-4);
      border-bottom: 1px solid var(--m3-outline-variant);
    }
    .expense-row:last-of-type {
      border-bottom: none;
    }

    .expense-row-icon {
      width: 30px;
      height: 30px;
      border-radius: var(--md-radius-md);
      background: var(--m3-surface-container);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .expense-row-icon ion-icon {
      font-size: 14px;
      color: var(--m3-on-surface-variant);
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
      color: var(--m3-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .expense-row-meta {
      font-size: 11px;
      color: var(--m3-on-surface-muted);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .meta-dot {
      opacity: 0.4;
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
      color: var(--m3-on-surface);
    }

    .expense-viewall {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--md-space-1);
      width: 100%;
      padding: var(--md-space-2);
      background: none;
      border: none;
      border-top: 1px solid var(--m3-outline-variant);
      color: var(--m3-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .expense-viewall:active {
      background: var(--m3-surface-container);
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
      margin-bottom: var(--md-space-3);
    }
    .sites-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0;
    }
    .viewall-btn {
      background: none;
      border: 0;
      padding: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--m3-secondary);
      cursor: pointer;
      font-family: inherit;
    }

    .site-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-3);
      margin-bottom: var(--md-space-2);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      box-shadow: var(--md-elevation-1);
      transition: transform 100ms ease;
    }
    .site-row:active {
      transform: scale(0.985);
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--m3-on-surface-muted);
      flex-shrink: 0;
    }
    .dot-active {
      background: var(--m3-success);
    }
    .dot-hold {
      background: var(--m3-warning);
    }
    .dot-done {
      background: var(--m3-on-surface-muted);
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
      color: var(--m3-on-surface);
    }
    .site-meta {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .meta-dot { opacity: 0.4; }

    .site-arrow {
      font-size: 14px;
      color: var(--m3-on-surface-muted);
      flex-shrink: 0;
    }

    /* ─────────────────────────────────────────────
       SITES EMPTY STATE
       ───────────────────────────────────────────── */
    .sites-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--md-space-2);
      padding: var(--md-space-6) var(--md-space-4);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      box-shadow: var(--md-elevation-1);
    }
    .sites-empty-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--md-radius-md);
      background: var(--m3-secondary-container);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sites-empty-icon ion-icon {
      font-size: 20px;
      color: var(--m3-secondary);
    }
    .sites-empty-text {
      font-size: 13px;
      color: var(--m3-on-surface-muted);
      font-weight: 500;
    }
    .sites-empty-cta {
      background: var(--m3-primary);
      color: var(--m3-on-primary);
      border: none;
      border-radius: var(--md-radius-md);
      padding: var(--md-space-1) var(--md-space-4);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      margin-top: var(--md-space-1);
    }
    .sites-empty-cta:active {
      opacity: 0.85;
    }

    .bottom-spacer { height: var(--md-space-4); }
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

  getExpenseIcon(expense: Expense): string {
    if (expense.isSiteMaterial) return 'cube-outline';
    if (expense.transactionType === 'Cash Added') return 'cash-outline';
    if (expense.description?.toLowerCase().includes('labour') || expense.description?.toLowerCase().includes('worker')) return 'people-outline';
    if (expense.description?.toLowerCase().includes('transport') || expense.description?.toLowerCase().includes('vehicle')) return 'construct-outline';
    return 'document-text-outline';
  }

  timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    const diffWk = Math.floor(diffDay / 7);
    if (diffWk < 4) return `${diffWk}w ago`;
    return `${Math.floor(diffDay / 30)}mo ago`;
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      cubeOutline, peopleOutline, constructOutline,
      homeOutline, businessOutline, receiptOutline,
      personOutline, cashOutline, documentTextOutline,
      chevronForwardOutline, locationOutline,
      clipboardOutline, addOutline,
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
