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
  chevronDownOutline,
  locationOutline,
  constructOutline,
  trendingUpOutline,
  calendarOutline,
  homeOutline,
  businessOutline,
  receiptOutline,
  settingsOutline,
  personOutline,
  addOutline,
  alertCircleOutline,
  timeOutline,
  analyticsOutline,
  gitBranchOutline,
  boatOutline,
  trainOutline,
  leafOutline,
  storefrontOutline,
  medkitOutline,
  schoolOutline,
  ribbonOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardData, Site } from '../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { EmptyStateComponent } from '../../shared/components';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    DatePipe,
    CurrencyPipe,
    EmptyStateComponent,
  ],
  template: `
    <ion-content class="dashboard-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshDashboard($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="dash-wrap">
        <!-- ═══ HEADER BAR ═══ -->
        <header class="d-header">
          <div class="d-header-left">
            <div class="avatar-ring">
              <div class="avatar">
                <ion-icon name="person-outline"></ion-icon>
              </div>
            </div>
          </div>
          <div class="d-header-center">
            <span class="greeting">{{ greeting() }}, {{ userName() }}</span>
            <button class="location-pill" id="loc-pill">
              <ion-icon name="location-outline"></ion-icon>
              <span>{{ currentSiteName() || 'Select site' }}</span>
              <ion-icon name="chevron-down-outline" class="pill-chev"></ion-icon>
            </button>
          </div>
          <div class="d-header-right">
            <button class="bell-btn" (click)="navigateTo('/tabs/requests')">
              <ion-icon name="notifications-outline"></ion-icon>
              <span class="bell-dot"></span>
            </button>
          </div>
        </header>

        <!-- ═══ SUMMARY METRICS ═══ -->
        <section class="metrics-strip">
          <button class="metric-card" (click)="navigateTo('/tabs/sites')">
            <div class="metric-icon-glass blue">
              <ion-icon name="location-outline"></ion-icon>
            </div>
            <span class="metric-val">{{ dashboard()?.counts?.sites || 0 }}</span>
            <span class="metric-lbl">Sites</span>
          </button>
          <button class="metric-card" (click)="navigateTo('/tabs/materials')">
            <div class="metric-icon-glass emerald">
              <ion-icon name="cube-outline"></ion-icon>
            </div>
            <span class="metric-val">{{ dashboard()?.counts?.pendingMaterials || 0 }}</span>
            <span class="metric-lbl">Materials</span>
          </button>
          <button class="metric-card" (click)="navigateTo('/tabs/labour')">
            <div class="metric-icon-glass purple">
              <ion-icon name="people-outline"></ion-icon>
            </div>
            <span class="metric-val">{{ dashboard()?.counts?.pendingLabour || 0 }}</span>
            <span class="metric-lbl">Active Workers</span>
          </button>
        </section>

        <!-- ═══ TODAY'S EXPENSES ═══ -->
        <section class="expense-card" (click)="navigateTo('/tabs/expenses')">
          <svg class="expense-sparkline" viewBox="0 0 300 80" fill="none" preserveAspectRatio="none">
            <path d="M0 60 Q30 55 60 48 T120 35 T180 22 T240 18 T300 10" stroke="rgba(255,255,255,0.08)" stroke-width="2" fill="none"/>
            <path d="M0 70 Q40 62 80 55 T160 40 T240 30 T300 20" stroke="rgba(255,255,255,0.05)" stroke-width="1.5" fill="none"/>
          </svg>
          <div class="expense-body">
            <div class="expense-top">
              <div>
                <span class="expense-label">Today's Expenses</span>
                <div class="expense-amount">{{ dashboard()?.todayExpense?.total | currency:'INR':'symbol':'1.0-0' }}</div>
              </div>
              <button class="add-btn" (click)="navigateTo('/tabs/expenses/create'); $event.stopPropagation()">
                <ion-icon name="add-outline"></ion-icon>
                <span>Add</span>
              </button>
            </div>
            <div class="expense-bottom">
              <span class="expense-txn-count">
                <ion-icon name="receipt-outline"></ion-icon>
                {{ dashboard()?.todayExpense?.count || 0 }} transactions today
              </span>
            </div>
          </div>
        </section>

        <!-- ═══ ACTIVE SITES ═══ -->
        <section class="sites-section">
          <div class="sites-head">
            <h2 class="sites-title">Active Sites</h2>
            <button class="view-all-btn" (click)="navigateTo('/tabs/sites')">View All</button>
          </div>

          @if (sites().length === 0) {
            <app-empty-state
              icon="location-outline"
              title="No active sites"
              message="You have not been assigned to any site yet."
            ></app-empty-state>
          } @else {
            @for (site of sites().slice(0, 4); track site.id) {
              <button class="site-row" (click)="navigateTo('/tabs/sites')">
                <div class="site-icon-box" [style.background]="getIconBg(site.status)">
                  <ion-icon [name]="getSiteIcon(site.name)"></ion-icon>
                </div>
                <div class="site-details">
                  <h3 class="site-name">{{ site.name }}</h3>
                  <p class="site-sub">
                    @if (site.employeeCount !== undefined && site.employeeCount > 0) {
                      {{ site.employeeCount }} worker{{ site.employeeCount !== 1 ? 's' : '' }}
                    } @else {
                      0 workers
                    }
                    <span class="sub-dot">·</span>
                    Updated {{ getUpdatedAgo(site.daysActive) }}
                  </p>
                </div>
                <span class="status-pill"
                  [class.pill-active]="site.status === 'Active'"
                  [class.pill-hold]="site.status === 'On Hold'"
                  [class.pill-done]="site.status === 'Completed'">
                  {{ site.status || 'Active' }}
                </span>
              </button>
            }
          }
        </section>

        <div class="bottom-spacer"></div>
      </div>

      <!-- ═══ FLOATING BOTTOM NAV ═══ -->
      <nav class="floating-nav">
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
       DESIGN TOKENS (local overrides)
       ───────────────────────────────────────────── */
    :host {
      --c-bg: #F8FAFC;
      --c-navy: #0F172A;
      --c-navy-mid: #1E293B;
      --c-navy-light: #334155;
      --c-emerald: #10B981;
      --c-emerald-bg: rgba(16, 185, 129, 0.10);
      --c-amber: #F59E0B;
      --c-amber-bg: rgba(245, 158, 11, 0.10);
      --c-blue: #3B82F6;
      --c-blue-bg: rgba(59, 130, 246, 0.10);
      --c-purple: #8B5CF6;
      --c-purple-bg: rgba(139, 92, 246, 0.10);
      --c-text: #0F172A;
      --c-text-secondary: #64748B;
      --c-text-tertiary: #94A3B8;
      --c-surface: #FFFFFF;
      --c-border: #E2E8F0;
      --c-radius: 16px;
      --c-radius-sm: 12px;
      --c-radius-xs: 10px;
      --c-shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.06);
      --c-shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);
      --c-shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.12);
      --c-shadow-nav: 0 8px 32px rgba(15, 23, 42, 0.18);
    }

    /* ─────────────────────────────────────────────
       BASE
       ───────────────────────────────────────────── */
    .dashboard-content {
      --background: var(--c-bg);
      --color: var(--c-text);
    }
    .dash-wrap {
      padding: 0 20px;
      padding-top: env(safe-area-inset-top);
    }

    /* ─────────────────────────────────────────────
       HEADER BAR
       ───────────────────────────────────────────── */
    .d-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 0 12px;
    }
    .d-header-left { flex-shrink: 0; }
    .avatar-ring {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--c-blue), var(--c-purple));
      padding: 2px;
    }
    .avatar {
      width: 100%; height: 100%;
      border-radius: 50%;
      background: var(--c-surface);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar ion-icon {
      font-size: 22px;
      color: var(--c-navy);
    }

    .d-header-center {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .greeting {
      font-size: 13px;
      font-weight: 500;
      color: var(--c-text-secondary);
      letter-spacing: -0.1px;
    }
    .location-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: 20px;
      padding: 5px 10px 5px 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--c-text);
      cursor: pointer;
      font-family: inherit;
      width: fit-content;
      max-width: 100%;
      transition: background 150ms ease;
    }
    .location-pill:active { background: #F1F5F9; }
    .location-pill ion-icon:first-child {
      font-size: 14px;
      color: var(--c-blue);
    }
    .location-pill span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }
    .pill-chev {
      font-size: 12px;
      color: var(--c-text-tertiary);
      flex-shrink: 0;
    }

    .d-header-right { flex-shrink: 0; }
    .bell-btn {
      position: relative;
      width: 40px; height: 40px;
      border-radius: 50%;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .bell-btn:active { background: #F1F5F9; }
    .bell-btn ion-icon { font-size: 20px; color: var(--c-navy); }
    .bell-dot {
      position: absolute;
      top: 8px; right: 9px;
      width: 8px; height: 8px;
      background: #EF4444;
      border-radius: 50%;
      border: 2px solid var(--c-surface);
    }

    /* ─────────────────────────────────────────────
       METRICS STRIP — horizontal scroll
       ───────────────────────────────────────────── */
    .metrics-strip {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      padding: 4px 0 20px;
      scrollbar-width: none;
      margin: 0 -20px;
      padding-left: 20px;
      padding-right: 20px;
    }
    .metrics-strip::-webkit-scrollbar { display: none; }

    .metric-card {
      flex: 0 0 auto;
      scroll-snap-align: start;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: var(--c-radius);
      padding: 16px;
      min-width: 140px;
      cursor: pointer;
      font-family: inherit;
      box-shadow: var(--c-shadow-sm);
      transition: transform 150ms ease, box-shadow 150ms ease;
    }
    .metric-card:active {
      transform: scale(0.97);
      box-shadow: var(--c-shadow-md);
    }

    .metric-icon-glass {
      width: 42px; height: 42px;
      border-radius: var(--c-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .metric-icon-glass ion-icon { font-size: 20px; }
    .metric-icon-glass.blue {
      background: var(--c-blue-bg);
      color: var(--c-blue);
    }
    .metric-icon-glass.emerald {
      background: var(--c-emerald-bg);
      color: var(--c-emerald);
    }
    .metric-icon-glass.purple {
      background: var(--c-purple-bg);
      color: var(--c-purple);
    }

    .metric-val {
      font-size: 24px;
      font-weight: 700;
      color: var(--c-text);
      line-height: 1;
      letter-spacing: -0.5px;
    }
    .metric-lbl {
      font-size: 12px;
      font-weight: 500;
      color: var(--c-text-secondary);
    }

    /* ─────────────────────────────────────────────
       EXPENSE CARD
       ───────────────────────────────────────────── */
    .expense-card {
      position: relative;
      background: linear-gradient(145deg, #0F172A 0%, #1E293B 50%, #0F172A 100%);
      border-radius: var(--c-radius);
      padding: 22px;
      margin-bottom: 24px;
      overflow: hidden;
      cursor: pointer;
      box-shadow: var(--c-shadow-lg);
      transition: transform 150ms ease;
    }
    .expense-card:active { transform: scale(0.985); }

    .expense-sparkline {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .expense-body { position: relative; z-index: 1; }
    .expense-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .expense-label {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .expense-amount {
      font-size: 32px;
      font-weight: 700;
      color: #FFFFFF;
      line-height: 1.15;
      margin-top: 4px;
      letter-spacing: -0.5px;
    }

    .add-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 8px 14px;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      flex-shrink: 0;
      transition: background 150ms ease;
    }
    .add-btn:active { background: rgba(255, 255, 255, 0.22); }
    .add-btn ion-icon { font-size: 18px; }

    .expense-bottom {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .expense-txn-count {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 500;
    }
    .expense-txn-count ion-icon { font-size: 14px; }

    /* ─────────────────────────────────────────────
       ACTIVE SITES
       ───────────────────────────────────────────── */
    .sites-section { margin-bottom: 8px; }
    .sites-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .sites-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--c-text);
      margin: 0;
      letter-spacing: -0.3px;
    }
    .view-all-btn {
      background: none;
      border: 0;
      padding: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--c-blue);
      cursor: pointer;
      font-family: inherit;
    }

    .site-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: var(--c-radius);
      padding: 14px 16px;
      margin-bottom: 10px;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      box-shadow: var(--c-shadow-sm);
      transition: transform 150ms ease, box-shadow 150ms ease;
    }
    .site-row:active {
      transform: scale(0.985);
      box-shadow: var(--c-shadow-md);
    }

    .site-icon-box {
      width: 44px; height: 44px;
      border-radius: var(--c-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .site-icon-box ion-icon { font-size: 22px; color: #fff; }

    .site-details { flex: 1; min-width: 0; }
    .site-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--c-text);
      margin: 0 0 2px;
      letter-spacing: -0.1px;
    }
    .site-sub {
      font-size: 13px;
      color: var(--c-text-secondary);
      margin: 0;
    }
    .sub-dot { margin: 0 4px; opacity: 0.4; }

    .status-pill {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 5px 10px;
      border-radius: 8px;
    }
    .pill-active {
      background: var(--c-emerald-bg);
      color: var(--c-emerald);
    }
    .pill-hold {
      background: var(--c-amber-bg);
      color: var(--c-amber);
    }
    .pill-done {
      background: rgba(99, 102, 241, 0.10);
      color: #6366F1;
    }

    .bottom-spacer { height: 100px; }

    /* ─────────────────────────────────────────────
       FLOATING BOTTOM NAV
       ───────────────────────────────────────────── */
    .floating-nav {
      position: fixed;
      bottom: calc(16px + env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--c-navy);
      border-radius: 28px;
      padding: 8px 12px;
      box-shadow: var(--c-shadow-nav);
      z-index: 100;
      width: auto;
      min-width: 280px;
    }
    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      background: none;
      border: 0;
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      font-family: inherit;
      transition: background 150ms ease;
      min-width: 60px;
    }
    .nav-item:active { background: rgba(255, 255, 255, 0.08); }
    .nav-item ion-icon {
      font-size: 22px;
      color: rgba(255, 255, 255, 0.45);
      transition: color 150ms ease;
    }
    .nav-item span {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.45);
      letter-spacing: 0.2px;
      transition: color 150ms ease;
    }
    .nav-item.active ion-icon { color: #FFFFFF; }
    .nav-item.active span { color: #FFFFFF; }
    .nav-item.active {
      background: rgba(255, 255, 255, 0.12);
    }
  `],
})
export class DashboardPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private auth = inject(AuthService);
  private router = inject(Router);

  dashboard = signal<DashboardData | null>(null);
  sites = signal<Site[]>([]);
  currentSiteName = signal<string | null>(null);
  userName = signal<string>('Supervisor');

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
    if (n.includes('hospital') || n.includes('clinic')) return 'medkit-outline';
    if (n.includes('school') || n.includes('college')) return 'school-outline';
    if (n.includes('terrace') || n.includes('block') || n.includes('mep')) return 'ribbon-outline';
    if (n.includes('stock') || n.includes('yard') || n.includes('godown')) return 'analytics-outline';
    return 'construct-outline';
  }

  getIconBg(status?: string): string {
    if (status === 'On Hold') return 'linear-gradient(135deg, #F59E0B, #D97706)';
    if (status === 'Completed') return 'linear-gradient(135deg, #6366F1, #4F46E5)';
    return 'linear-gradient(135deg, #10B981, #059669)';
  }

  getUpdatedAgo(daysActive?: number): string {
    if (daysActive === undefined || daysActive === null) return 'today';
    if (daysActive <= 1) return 'today';
    if (daysActive <= 2) return '2d ago';
    if (daysActive <= 7) return `${daysActive}d ago`;
    return `${Math.floor(daysActive / 7)}w ago`;
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      cubeOutline, peopleOutline, walletOutline,
      chevronDownOutline, locationOutline, constructOutline,
      trendingUpOutline, calendarOutline, homeOutline,
      businessOutline, receiptOutline, settingsOutline,
      personOutline, addOutline, alertCircleOutline,
      timeOutline, analyticsOutline, gitBranchOutline,
      boatOutline, trainOutline, leafOutline,
      storefrontOutline, medkitOutline, schoolOutline,
      ribbonOutline,
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
      await this.loadUserAndSites();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  }

  private async loadUserAndSites(): Promise<void> {
    try {
      this.supervisor.getProfile().subscribe({
        next: (res) => {
          const name = (res as { user?: { name?: string } }).user?.name;
          if (name) this.userName.set(name);
        },
        error: () => undefined,
      });

      this.supervisor.getSites().subscribe({
        next: (res) => {
          this.sites.set(res.sites || []);
          const savedName = this.supervisor.selectedSiteName();
          if (savedName) this.currentSiteName.set(savedName);
          else if (res.sites?.[0]?.name) this.currentSiteName.set(res.sites[0].name);
        },
        error: () => undefined,
      });
    } catch (e) {
      console.warn('User/sites load failed', e);
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
