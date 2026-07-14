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
  checkmarkDoneCircleOutline,
  arrowForwardOutline,
  timeOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  locationOutline,
  constructOutline,
  cashOutline,
  layersOutline,
  documentTextOutline,
  chevronForwardOutline,
  trendingUpOutline,
  calendarOutline,
  trendingDownOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardData, Site, ApprovalSummary } from '../../shared/models';
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
        <!-- Hero greeting -->
        <div class="hero">
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
          <!-- Stats grid -->
          <div class="stats-grid">
            <app-stat-card
              icon="location-outline"
              iconBg="rgba(0, 34, 99, 0.10)"
              iconColor="#002263"
              [value]="dashboard()?.counts?.sites || 0"
              label="Active sites"
              (click)="navigateTo('/tabs/sites')"
            ></app-stat-card>
            <app-stat-card
              icon="checkmark-done-circle-outline"
              iconBg="rgba(245, 158, 11, 0.14)"
              iconColor="#b45309"
              [value]="dashboard()?.counts?.pendingApprovals || 0"
              label="Pending approvals"
              (click)="navigateTo('/tabs/approvals')"
            ></app-stat-card>
            <app-stat-card
              icon="cube-outline"
              iconBg="rgba(220, 38, 38, 0.10)"
              iconColor="#b91c1c"
              [value]="dashboard()?.counts?.pendingMaterials || 0"
              label="Material requests"
              (click)="navigateTo('/tabs/materials')"
            ></app-stat-card>
            <app-stat-card
              icon="people-outline"
              iconBg="rgba(14, 165, 233, 0.12)"
              iconColor="#0369a1"
              [value]="dashboard()?.counts?.pendingLabour || 0"
              label="Labour entries"
              (click)="navigateTo('/tabs/labour')"
            ></app-stat-card>
          </div>

          <!-- Today's expense -->
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

          <!-- Pending approvals -->
          <div class="section">
            <div class="section-head">
              <h2 class="section-title">Pending approvals</h2>
              <button class="section-link" (click)="navigateTo('/tabs/approvals')">
                View all
                <ion-icon name="chevron-forward-outline"></ion-icon>
              </button>
            </div>

            @if (isLoading()) {
              @for (i of [1, 2]; track i) {
                <div class="approval-card skeleton">
                  <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
                  <ion-skeleton-text animated style="width: 40%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
                  <ion-skeleton-text animated style="width: 80%; height: 12px; margin-top: 10px;"></ion-skeleton-text>
                </div>
              }
            } @else if (pendingApprovals().length === 0) {
              <app-empty-state
                icon="checkmark-done-circle-outline"
                iconBg="rgba(22, 163, 74, 0.14)"
                iconColor="#15803d"
                title="All caught up"
                message="No pending approvals. Your work is in great shape."
              ></app-empty-state>
            } @else {
              @for (approval of pendingApprovals().slice(0, 4); track approval.approvalId) {
                <button class="approval-card" (click)="navigateToApproval(approval)">
                  <div class="approval-top">
                    <app-status-pill [tone]="getTone(approval.type)" [icon]="getTypeIcon(approval.type)">
                      {{ approval.type | titlecase }}
                    </app-status-pill>
                    <app-status-pill tone="warning">Pending</app-status-pill>
                  </div>
                  <h3 class="approval-title">{{ approval.title }}</h3>
                  <div class="approval-meta">
                    <span class="meta-item">
                      <ion-icon name="business-outline"></ion-icon>
                      {{ approval.projectName }}
                    </span>
                    @if (approval.amount) {
                      <span class="amount">{{ approval.amount | currency:'INR':'symbol':'1.0-0' }}</span>
                    }
                  </div>
                  <div class="approval-time">
                    <ion-icon name="time-outline"></ion-icon>
                    {{ approval.submittedAt | date:'MMM d, h:mm a' }}
                  </div>
                </button>
              }
            }
          </div>

          <!-- Active sites -->
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
                        <span class="dot">-</span>
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
    .dashboard-content { --background: #f5f6f8; }
    .dashboard-container { padding: 0; }

    /* Hero */
    .hero {
      position: relative;
      background: var(--agb-gradient-hero);
      color: #ffffff;
      padding: 32px 20px 56px;
      overflow: hidden;
    }

    .hero-content { position: relative; }
    .greeting { margin-bottom: 16px; }
    .greeting-pre {
      display: block;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.78);
      letter-spacing: 0.4px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .greeting-name {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.4px;
      margin: 4px 0 0;
    }
    .hero-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.85);
    }
    .hero-meta ion-icon { font-size: 14px; color: #c9a227; }
    .meta-item { display: inline-flex; align-items: center; gap: 4px; }
    .meta-divider { width: 4px; height: 4px; background: rgba(255, 255, 255, 0.4); border-radius: 50%; }

    .content-stack { padding: 0 16px; margin-top: -32px; position: relative; z-index: 2; }

    /* Stats grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }

    /* Expense card */
    .expense-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--agb-gradient-primary);
      color: #ffffff;
      border-radius: 20px;
      padding: 18px 20px;
      margin-bottom: 18px;
      box-shadow: 0 12px 28px -12px rgba(0, 34, 99, 0.45);
      cursor: pointer;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .expense-card:active { transform: scale(0.99); }
    .expense-card:hover { box-shadow: 0 16px 32px -12px rgba(0, 34, 99, 0.55); }
    .expense-label { font-size: 11px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; }
    .expense-amount { font-size: 28px; font-weight: 800; line-height: 1.1; margin-top: 4px; }
    .expense-trend {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; opacity: 0.8; margin-top: 6px;
    }
    .expense-trend ion-icon { font-size: 14px; color: #c9a227; }
    .expense-right { text-align: right; }
    .expense-count { font-size: 28px; font-weight: 800; color: #c9a227; line-height: 1.1; }
    .expense-count-label { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

    /* Section */
    .section { margin-top: 8px; margin-bottom: 8px; }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 4px 10px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.1px;
    }
    .section-link {
      display: inline-flex; align-items: center; gap: 2px;
      background: transparent; border: 0; padding: 0;
      color: #002263; font-weight: 600; font-size: 12px; cursor: pointer;
      font-family: inherit;
    }
    .section-link ion-icon { font-size: 14px; }
    .section-link:hover { text-decoration: underline; }

    /* Approval card */
    .approval-card {
      width: 100%;
      text-align: left;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 8px;
      box-shadow: var(--agb-shadow-2xs);
      cursor: pointer;
      font-family: inherit;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .approval-card:active { transform: scale(0.99); }
    .approval-card:hover { box-shadow: var(--agb-shadow-sm); }
    .approval-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .approval-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .approval-meta {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      margin-bottom: 6px;
    }
    .meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .meta-item ion-icon { font-size: 13px; }
    .amount { font-size: 14px; font-weight: 700; color: #002263; }
    .approval-time { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8; }
    .approval-time ion-icon { font-size: 12px; }

    /* Site card */
    .site-card {
      width: 100%;
      text-align: left;
      display: flex; align-items: center; gap: 12px;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 8px;
      box-shadow: var(--agb-shadow-2xs);
      cursor: pointer;
      font-family: inherit;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .site-card:active { transform: scale(0.99); }
    .site-card:hover { box-shadow: var(--agb-shadow-sm); }
    .site-tile-icon {
      width: 40px; height: 40px;
      border-radius: 12px;
      background: rgba(201, 162, 39, 0.14);
      color: #a8861f;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .site-tile-icon ion-icon { font-size: 20px; }
    .site-info { flex: 1; min-width: 0; }
    .site-name { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
    .site-stats { font-size: 12px; color: #64748b; margin: 0; }
    .site-stats .dot { margin: 0 4px; color: #cbd5e1; }

    .bottom-spacer { height: 32px; }
  `],
})
export class DashboardPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private auth = inject(AuthService);
  private router = inject(Router);

  dashboard = signal<DashboardData | null>(null);
  sites = signal<Site[]>([]);
  pendingApprovals = signal<ApprovalSummary[]>([]);
  isLoading = signal(true);
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
      checkmarkDoneCircleOutline, arrowForwardOutline, timeOutline, alertCircleOutline,
      checkmarkCircleOutline, locationOutline, constructOutline, cashOutline,
      layersOutline, documentTextOutline, chevronForwardOutline, trendingUpOutline,
      calendarOutline, trendingDownOutline,
    });

    await this.auth.initAfterLogin();
    await this.loadDashboard();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:site-changed', this.handleSiteChange);
      window.addEventListener('agb:approvals-changed', this.handleApprovalsChanged);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:site-changed', this.handleSiteChange);
      window.removeEventListener('agb:approvals-changed', this.handleApprovalsChanged);
    }
  }

  private handleSiteChange = (): void => {
    void this.loadDashboard();
  };

  private handleApprovalsChanged = (): void => {
    void this.loadDashboard();
  };

  async refreshDashboard(event: CustomEvent): Promise<void> {
    await this.loadDashboard();
    (event.target as HTMLIonRefresherElement).complete();
  }

  async loadDashboard(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.supervisor.getDashboard().subscribe({
        next: (response) => {
          this.dashboard.set(response.dashboard);
          this.pendingApprovals.set(response.dashboard.pendingApprovals || []);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[Dashboard] failed to load', err);
          this.isLoading.set(false);
        },
      });
      await this.loadUserAndSites();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      this.isLoading.set(false);
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

  navigateToApproval(approval: ApprovalSummary): void {
    this.router.navigate(['/tabs/approvals', approval.approvalId]);
  }

  getTypeTone(type: string): 'info' | 'warning' | 'danger' | 'success' | 'neutral' {
    switch (type) {
      case 'material': return 'danger';
      case 'labour': return 'info';
      case 'expense': return 'warning';
      case 'payment': return 'success';
      default: return 'neutral';
    }
  }

  getTone(type: string): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (type) {
      case 'material': return 'warning';
      case 'labour': return 'neutral';
      case 'expense': return 'danger';
      case 'payment': return 'success';
      default: return 'neutral';
    }
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'material': return 'cube-outline';
      case 'labour': return 'people-outline';
      case 'expense': return 'wallet-outline';
      case 'payment': return 'card-outline';
      default: return 'checkmark-done-circle-outline';
    }
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
