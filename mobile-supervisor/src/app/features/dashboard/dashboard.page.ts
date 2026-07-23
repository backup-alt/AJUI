import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonContent,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  cubeOutline,
  peopleOutline,
  walletOutline,
  arrowForwardOutline,
  timeOutline,
  locationOutline,
  constructOutline,
  cashOutline,
  documentTextOutline,
  chevronForwardOutline,
  trendingUpOutline,
  calendarOutline,
  trendingDownOutline,
  homeOutline,
  businessOutline,
  bodyOutline,
  warningOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardData, Site } from '../../shared/models';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import {
  EmptyStateComponent,
} from '../../shared/components';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    DatePipe,
    CurrencyPipe,
    TitleCasePipe,
    EmptyStateComponent,
  ],
  template: `
    <ion-content class="dashboard-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshDashboard($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="dashboard-container">
        <!-- Compact header -->
        <div class="hero">
          <div class="hero-decor"></div>
          <div class="hero-content">
            <div class="greeting-line">
              <span class="greeting-text">{{ greeting() }}, {{ userName() }}</span>
            </div>
            <div class="hero-meta">
              <span class="meta-item">
                <ion-icon name="calendar-outline"></ion-icon>
                {{ currentDate }}
              </span>
              @if (currentSiteName()) {
                <span class="meta-divider"></span>
                <span class="meta-item">
                  <ion-icon name="location-outline"></ion-icon>
                  {{ currentSiteName() }}
                </span>
              }
            </div>
          </div>
        </div>

        <div class="content-stack">
          <!-- Stat chips - horizontal scroll -->
          <div class="stat-chips">
            <button class="stat-chip" (click)="navigateTo('/tabs/sites')">
              <div class="chip-icon blue">
                <ion-icon name="location-outline"></ion-icon>
              </div>
              <div class="chip-content">
                <span class="chip-value">{{ dashboard()?.counts?.sites || 0 }}</span>
                <span class="chip-label">Sites</span>
              </div>
            </button>
            <button class="stat-chip" (click)="navigateTo('/tabs/materials')">
              <div class="chip-icon red">
                <ion-icon name="cube-outline"></ion-icon>
              </div>
              <div class="chip-content">
                <span class="chip-value">{{ dashboard()?.counts?.pendingMaterials || 0 }}</span>
                <span class="chip-label">Materials</span>
              </div>
            </button>
            <button class="stat-chip" (click)="navigateTo('/tabs/labour')">
              <div class="chip-icon purple">
                <ion-icon name="people-outline"></ion-icon>
              </div>
              <div class="chip-content">
                <span class="chip-value">{{ dashboard()?.counts?.pendingLabour || 0 }}</span>
                <span class="chip-label">Labour</span>
              </div>
            </button>
            <button class="stat-chip" (click)="navigateTo('/tabs/expenses')">
              <div class="chip-icon amber">
                <ion-icon name="wallet-outline"></ion-icon>
              </div>
              <div class="chip-content">
                <span class="chip-value">{{ dashboard()?.counts?.pendingExpenses || 0 }}</span>
                <span class="chip-label">Expenses</span>
              </div>
            </button>
          </div>

          <!-- Expense card -->
          <div class="expense-card" (click)="navigateTo('/tabs/expenses')">
            <div class="expense-left">
              <div class="expense-label">Today's expenses</div>
              <div class="expense-amount">
                {{ dashboard()?.todayExpense?.total | currency:'INR':'symbol':'1.0-0' }}
              </div>
              <div class="expense-trend">
                <ion-icon name="trending-up-outline"></ion-icon>
                <span>Live from site ledger</span>
              </div>
            </div>
            <div class="expense-right">
              @if ((dashboard()?.todayExpense?.count || 0) > 0) {
                <div class="expense-mini-chart">
                  <svg viewBox="0 0 56 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 20 L8 16 L16 18 L24 10 L32 12 L40 4 L48 8 L56 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              } @else {
                <div class="expense-zero-state">
                  <ion-icon name="time-outline"></ion-icon>
                  <span>No transactions yet</span>
                </div>
              }
            </div>
          </div>

          <!-- Sites section -->
          <div class="section">
            <div class="section-head">
              <h2 class="section-title">Your active sites</h2>
              <button class="section-link" (click)="navigateTo('/tabs/sites')">
                View all
                <ion-icon name="chevron-forward-outline"></ion-icon>
              </button>
            </div>

            @if (sites().length === 0) {
              <app-empty-state
                icon="location-outline"
                title="No active sites"
                message="You have not been assigned to any site yet. Please contact your admin."
              ></app-empty-state>
            } @else {
              @for (site of sites().slice(0, 3); track site.id) {
                <button class="site-card" (click)="navigateTo('/tabs/sites')">
                  <span class="site-icon-tile" [style.background]="getSiteStatusBg(site.status)">
                    <ion-icon [name]="getSiteIcon(site.name)"></ion-icon>
                  </span>
                  <div class="site-info">
                    <h3 class="site-name">{{ site.name }}</h3>
                    <p class="site-meta">
                      @if (site.employeeCount !== undefined && site.employeeCount > 0) {
                        <span class="meta-worker">{{ site.employeeCount }} worker{{ site.employeeCount !== 1 ? 's' : '' }}</span>
                      } @else {
                        <span class="meta-worker meta-empty">0 workers</span>
                      }
                      @if (site.daysActive !== undefined) {
                        <span class="meta-sep">·</span>
                        <span>{{ site.daysActive }} day{{ site.daysActive !== 1 ? 's' : '' }}</span>
                      }
                    </p>
                  </div>
                  <div class="site-status-dot-wrap">
                    <span class="site-status-dot" [class.dot-on-hold]="site.status === 'On Hold'" [class.dot-active]="site.status !== 'On Hold'"></span>
                    <span class="site-status-text" [class.status-muted]="site.status === 'On Hold'">{{ site.status || 'Active' }}</span>
                  </div>
                </button>
              }
            }
          </div>

          <div class="bottom-spacer"></div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .dashboard-content { --background: var(--m3-surface); }
    .dashboard-container { padding: 0; }

    .hero {
      position: relative;
      background: var(--m3-primary);
      background-image: linear-gradient(135deg, var(--m3-primary) 0%, #003380 100%);
      color: var(--m3-on-primary);
      padding: 16px 20px 18px;
      overflow: hidden;
    }
    .hero-decor {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 100% 0%, rgba(255,255,255,0.12), transparent 40%),
                  radial-gradient(circle at 0% 100%, rgba(201, 162, 39, 0.18), transparent 50%);
      pointer-events: none;
    }
    .hero-content { position: relative; }
    .greeting-line { display: flex; align-items: baseline; gap: 6px; }
    .greeting-text {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: #fff;
    }
    .hero-meta {
      display: flex;
      align-items: center;
      gap: var(--md-space-2);
      flex-wrap: wrap;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      margin-top: 4px;
    }
    .hero-meta ion-icon { font-size: 13px; color: var(--m3-secondary); }
    .meta-item { display: inline-flex; align-items: center; gap: 4px; }
    .meta-divider {
      width: 3px; height: 3px;
      background: rgba(255, 255, 255, 0.35);
      border-radius: 50%;
    }

    .content-stack {
      padding: 0 var(--md-space-4);
      margin-top: -4px;
      position: relative;
      z-index: 2;
    }

    /* ---- Stat chips ---- */
    .stat-chips {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      padding: 14px 0 16px;
      scrollbar-width: none;
    }
    .stat-chips::-webkit-scrollbar { display: none; }
    .stat-chip {
      flex: 0 0 auto;
      scroll-snap-align: start;
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: 14px;
      padding: 12px 16px;
      min-width: 130px;
      cursor: pointer;
      font-family: inherit;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .stat-chip:active { transform: scale(0.97); }
    .chip-icon {
      width: 34px; height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .chip-icon ion-icon { font-size: 18px; }
    .chip-icon.blue { background: var(--m3-primary-container); color: var(--m3-on-primary-container); }
    .chip-icon.red { background: var(--m3-error-container); color: var(--m3-on-error-container); }
    .chip-icon.purple { background: var(--m3-tertiary-container); color: var(--m3-on-tertiary-container); }
    .chip-icon.amber { background: var(--m3-secondary-container); color: var(--m3-on-secondary-container); }
    .chip-content { display: flex; flex-direction: column; min-width: 0; }
    .chip-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--m3-on-surface);
      line-height: 1.1;
    }
    .chip-label {
      font-size: 11px;
      color: var(--m3-on-surface-muted);
      font-weight: 500;
      margin-top: 1px;
    }

    /* ---- Expense card ---- */
    .expense-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--m3-primary);
      background-image: linear-gradient(135deg, var(--m3-primary) 0%, #003380 100%);
      color: var(--m3-on-primary);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-4);
      box-shadow: var(--md-elevation-3);
      cursor: pointer;
      transition: transform 120ms ease;
    }
    .expense-card:active { transform: scale(0.99); }
    .expense-label {
      font-size: 11px;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 600;
    }
    .expense-amount {
      font-size: 26px;
      font-weight: 800;
      line-height: 1.1;
      margin-top: var(--md-space-1);
    }
    .expense-trend {
      display: inline-flex;
      align-items: center;
      gap: var(--md-space-1);
      font-size: 11px;
      opacity: 0.8;
      margin-top: var(--md-space-2);
    }
    .expense-trend ion-icon { font-size: 14px; color: var(--m3-secondary); }
    .expense-right { text-align: right; flex-shrink: 0; }
    .expense-mini-chart {
      width: 56px; height: 24px;
      color: var(--m3-secondary);
      opacity: 0.9;
    }
    .expense-mini-chart svg { width: 100%; height: 100%; }
    .expense-zero-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      opacity: 0.5;
    }
    .expense-zero-state ion-icon { font-size: 16px; }
    .expense-zero-state span { font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; }

    /* ---- Sites section ---- */
    .section {
      margin-top: var(--md-space-1);
      margin-bottom: var(--md-space-2);
    }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0 var(--md-space-3);
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0;
      letter-spacing: -0.1px;
    }
    .section-link {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: transparent;
      border: 0;
      padding: 0;
      color: var(--m3-primary);
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
    }
    .section-link ion-icon { font-size: 14px; }

    /* ---- Site card ---- */
    .site-card {
      width: 100%;
      text-align: left;
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-3);
      margin-bottom: var(--md-space-2);
      box-shadow: var(--md-elevation-1);
      cursor: pointer;
      font-family: inherit;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .site-card:active { transform: scale(0.99); }

    .site-icon-tile {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #fff;
    }
    .site-icon-tile ion-icon { font-size: 20px; }

    .site-info { flex: 1; min-width: 0; }
    .site-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 2px;
    }
    .site-meta {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .meta-sep { opacity: 0.4; }
    .meta-empty { opacity: 0.5; font-style: italic; }

    .site-status-dot-wrap {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-shrink: 0;
    }
    .site-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot-active { background: #16a34a; }
    .dot-on-hold { background: #d97706; }
    .site-status-text {
      font-size: 11px;
      font-weight: 600;
      color: var(--m3-on-surface);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .status-muted { color: var(--m3-on-surface-muted); }

    .bottom-spacer { height: var(--md-space-8); }
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

  get currentDate(): string {
    return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
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
    if (n.includes('hospital') || n.includes('clinic')) return 'medkit-outline';
    if (n.includes('school') || n.includes('college')) return 'school-outline';
    return 'construct-outline';
  }

  getSiteStatusBg(status?: string): string {
    if (status === 'On Hold') return '#d97706';
    if (status === 'Completed') return '#6366f1';
    return '#16a34a';
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      cubeOutline, peopleOutline, walletOutline,
      arrowForwardOutline, timeOutline,
      locationOutline, constructOutline, cashOutline,
      documentTextOutline, chevronForwardOutline, trendingUpOutline,
      calendarOutline, trendingDownOutline, homeOutline,
      businessOutline, bodyOutline, warningOutline,
      'git-branch-outline': 'git-branch-outline' as any,
      'boat-outline': 'boat-outline' as any,
      'train-outline': 'train-outline' as any,
      'leaf-outline': 'leaf-outline' as any,
      'storefront-outline': 'storefront-outline' as any,
      'medkit-outline': 'medkit-outline' as any,
      'school-outline': 'school-outline' as any,
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

  getSiteTone(status?: string): 'success' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'Active': return 'success';
      case 'On Hold': return 'warning';
      case 'Completed': return 'info';
      default: return 'neutral';
    }
  }
}
