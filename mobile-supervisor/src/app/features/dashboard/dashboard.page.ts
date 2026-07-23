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
  businessOutline,
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
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardData, Site } from '../../shared/models';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import {
  StatCardComponent,
  StatusPillComponent,
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
    StatCardComponent,
    StatusPillComponent,
    EmptyStateComponent,
  ],
  template: `
    <ion-content class="dashboard-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshDashboard($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="dashboard-container">
        <div class="hero">
          <div class="hero-decor"></div>
          <div class="hero-content">
            <div class="greeting">
              <span class="greeting-pre">{{ greeting() }},</span>
              <h1 class="greeting-name">{{ userName() }}</h1>
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
          <div class="stats-grid">
            <app-stat-card
              icon="location-outline"
              iconBg="var(--m3-primary-container)"
              iconColor="var(--m3-on-primary-container)"
              [value]="dashboard()?.counts?.sites || 0"
              label="Active sites"
              (click)="navigateTo('/tabs/sites')"
            ></app-stat-card>
            <app-stat-card
              icon="cube-outline"
              iconBg="var(--m3-error-container)"
              iconColor="var(--m3-on-error-container)"
              [value]="dashboard()?.counts?.pendingMaterials || 0"
              label="Materials"
              (click)="navigateTo('/tabs/materials')"
            ></app-stat-card>
            <app-stat-card
              icon="people-outline"
              iconBg="var(--m3-tertiary-container)"
              iconColor="var(--m3-on-tertiary-container)"
              [value]="dashboard()?.counts?.pendingLabour || 0"
              label="Labour"
              (click)="navigateTo('/tabs/labour')"
            ></app-stat-card>
          </div>

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
              <div class="expense-count">{{ dashboard()?.todayExpense?.count || 0 }}</div>
              <div class="expense-count-label">Transactions</div>
            </div>
          </div>

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
                  <span class="site-tile-icon">
                    <ion-icon name="construct-outline"></ion-icon>
                  </span>
                  <div class="site-info">
                    <h3 class="site-name">{{ site.name }}</h3>
                    <p class="site-stats">
                      @if (site.employeeCount !== undefined) {
                        <span>{{ site.employeeCount }} worker{{ site.employeeCount !== 1 ? 's' : '' }}</span>
                      }
                      @if (site.employeeCount !== undefined && site.daysActive !== undefined) {
                        <span class="dot">·</span>
                      }
                      @if (site.daysActive !== undefined) {
                        <span>{{ site.daysActive }} day{{ site.daysActive !== 1 ? 's' : '' }} active</span>
                      }
                    </p>
                  </div>
                  <app-status-pill [tone]="getSiteTone(site.status)">{{ site.status || 'Active' }}</app-status-pill>
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
      padding: 28px 20px 48px;
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
    .greeting { margin-bottom: var(--md-space-3); }
    .greeting-pre {
      display: block;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.78);
      letter-spacing: 0.4px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .greeting-name {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.4px;
      margin: var(--md-space-1) 0 0;
    }
    .hero-meta {
      display: flex;
      align-items: center;
      gap: var(--md-space-2);
      flex-wrap: wrap;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.85);
    }
    .hero-meta ion-icon { font-size: 14px; color: var(--m3-secondary); }
    .meta-item { display: inline-flex; align-items: center; gap: var(--md-space-1); }
    .meta-divider {
      width: 4px; height: 4px;
      background: rgba(255, 255, 255, 0.4);
      border-radius: 50%;
    }

    .content-stack {
      padding: 0 var(--md-space-4);
      margin-top: -28px;
      position: relative;
      z-index: 2;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--md-space-3);
      margin-bottom: var(--md-space-4);
    }

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
      transition: transform var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  box-shadow var(--md-motion-duration-short1) var(--md-motion-easing-standard);
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
    .expense-right { text-align: right; }
    .expense-count {
      font-size: 26px;
      font-weight: 800;
      color: var(--m3-secondary);
      line-height: 1.1;
    }
    .expense-count-label {
      font-size: 10px;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: var(--md-space-1);
    }

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
      transition: transform var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  box-shadow var(--md-motion-duration-short1) var(--md-motion-easing-standard);
    }
    .site-card:active { transform: scale(0.99); }
    .site-tile-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--md-radius-md);
      background: var(--m3-secondary-container);
      color: var(--m3-on-secondary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .site-tile-icon ion-icon { font-size: 20px; }
    .site-info { flex: 1; min-width: 0; }
    .site-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 2px;
    }
    .site-stats { font-size: 12px; color: var(--m3-on-surface-muted); margin: 0; }
    .site-stats .dot { margin: 0 4px; color: var(--m3-on-surface-muted); opacity: 0.5; }

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

  async ngOnInit(): Promise<void> {
    addIcons({
      businessOutline, cubeOutline, peopleOutline, walletOutline,
      arrowForwardOutline, timeOutline,
      locationOutline, constructOutline, cashOutline,
      documentTextOutline, chevronForwardOutline, trendingUpOutline,
      calendarOutline, trendingDownOutline,
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
