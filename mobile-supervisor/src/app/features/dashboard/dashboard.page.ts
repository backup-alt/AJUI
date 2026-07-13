import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonSpinner,
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
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { DashboardData, Project, Site, ApprovalSummary } from '../../shared/models';
import { DecimalPipe, DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonIcon,
    IonBadge,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonButton,
    IonSpinner,
    DecimalPipe,
    DatePipe,
    CurrencyPipe,
    TitleCasePipe,
  ],
  template: `
    <ion-content class="dashboard-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshDashboard($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="dashboard-container">
        <!-- Greeting Header -->
        <div class="greeting-bar">
          <div class="greeting-text">
            <h1 class="greeting-title">{{ greeting() }},</h1>
            <p class="greeting-name">{{ userName() }}</p>
            <p class="greeting-subtitle">{{ currentDate }}</p>
          </div>
        </div>

        <!-- Site Strip (current site) -->
        @if (currentSiteName()) {
          <div class="site-strip">
            <ion-icon name="location-outline"></ion-icon>
            <div class="site-strip-info">
              <div class="site-strip-label">Active Site</div>
              <div class="site-strip-value">{{ currentSiteName() }}</div>
            </div>
          </div>
        }

        <!-- Stats Grid -->
        <div class="stats-section">
          <div class="section-heading">
            <h2 class="section-title">Overview</h2>
          </div>
          <div class="stats-grid">
            <div class="stat-card" (click)="navigateTo('/tabs/sites')">
              <div class="stat-icon stat-icon-navy">
                <ion-icon name="location-outline"></ion-icon>
              </div>
              <div class="stat-content">
                <span class="stat-value">{{ dashboard()?.counts?.sites || 0 }}</span>
                <span class="stat-label">Active Sites</span>
              </div>
            </div>

            <div class="stat-card" (click)="navigateTo('/tabs/approvals')">
              <div class="stat-icon stat-icon-warning">
                <ion-icon name="checkmark-done-circle-outline"></ion-icon>
              </div>
              <div class="stat-content">
                <span class="stat-value">{{ dashboard()?.counts?.pendingApprovals || 0 }}</span>
                <span class="stat-label">Pending Approvals</span>
              </div>
            </div>

            <div class="stat-card" (click)="navigateTo('/tabs/materials')">
              <div class="stat-icon stat-icon-danger">
                <ion-icon name="cube-outline"></ion-icon>
              </div>
              <div class="stat-content">
                <span class="stat-value">{{ dashboard()?.counts?.pendingMaterials || 0 }}</span>
                <span class="stat-label">Material Requests</span>
              </div>
            </div>

            <div class="stat-card" (click)="navigateTo('/tabs/labour')">
              <div class="stat-icon stat-icon-info">
                <ion-icon name="people-outline"></ion-icon>
              </div>
              <div class="stat-content">
                <span class="stat-value">{{ dashboard()?.counts?.pendingLabour || 0 }}</span>
                <span class="stat-label">Labour Entries</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Today's Expense (sharp card) -->
        <div class="expense-block">
          <div class="expense-row">
            <div class="expense-left">
              <div class="expense-label">Today's Expenses</div>
              <div class="expense-amount">
                {{ dashboard()?.todayExpense?.total | currency:'INR':'symbol':'1.0-0' }}
              </div>
            </div>
            <div class="expense-right">
              <div class="expense-count">{{ dashboard()?.todayExpense?.count || 0 }}</div>
              <div class="expense-count-label">Transactions</div>
            </div>
          </div>
        </div>

        <!-- Pending Approvals -->
        <div class="section-block">
          <div class="section-heading">
            <h2 class="section-title">Pending Approvals</h2>
            <ion-button fill="clear" size="small" (click)="navigateTo('/tabs/approvals')">
              View All
              <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            </ion-button>
          </div>

          @if (isLoading()) {
            @for (i of [1, 2, 3]; track i) {
              <div class="approval-card skeleton-card">
                <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
                <ion-skeleton-text animated style="width: 40%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              </div>
            }
          } @else if (pendingApprovals().length === 0) {
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <p>No pending approvals. All caught up.</p>
            </div>
          } @else {
            @for (approval of pendingApprovals().slice(0, 5); track approval.approvalId) {
              <div class="approval-card" (click)="navigateToApproval(approval)">
                <div class="approval-top">
                  <div class="approval-type" [class]="approval.type">
                    {{ approval.type | titlecase }}
                  </div>
                  <ion-badge [color]="getStatusColor(approval.status)">
                    {{ approval.status }}
                  </ion-badge>
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
              </div>
            }
          }
        </div>

        <!-- Active Sites -->
        <div class="section-block">
          <div class="section-heading">
            <h2 class="section-title">Your Active Sites</h2>
            <ion-button fill="clear" size="small" (click)="navigateTo('/tabs/sites')">
              View All
              <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            </ion-button>
          </div>

          @if (isLoading()) {
            @for (i of [1, 2]; track i) {
              <div class="site-card skeleton-card">
                <ion-skeleton-text animated style="width: 70%; height: 18px;"></ion-skeleton-text>
                <ion-skeleton-text animated style="width: 50%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              </div>
            }
          } @else if (sites().length === 0) {
            <div class="empty-state">
              <ion-icon name="location-outline"></ion-icon>
              <p>No active sites assigned.</p>
            </div>
          } @else {
            @for (site of sites().slice(0, 5); track site.id) {
              <div class="site-card" (click)="selectSite(site)">
                <div class="site-row">
                  <div class="site-info">
                    <h3 class="site-name">{{ site.name }}</h3>
                    <p class="site-meta">Site ID: {{ site.siteId }}</p>
                    @if (site.employeeCount !== undefined || site.daysActive !== undefined) {
                      <p class="site-stats">
                        @if (site.employeeCount !== undefined) {
                          <span>{{ site.employeeCount }} worker{{ site.employeeCount !== 1 ? 's' : '' }}</span>
                        }
                        @if (site.employeeCount !== undefined && site.daysActive !== undefined) {
                          <span class="stat-sep">·</span>
                        }
                        @if (site.daysActive !== undefined) {
                          <span>{{ site.daysActive }} day{{ site.daysActive !== 1 ? 's' : '' }} active</span>
                        }
                      </p>
                    }
                  </div>
                  <ion-badge [color]="getSiteStatusColor(site.status)">
                    {{ site.status }}
                  </ion-badge>
                </div>
              </div>
            }
          }
        </div>

        <div class="bottom-spacer"></div>
      </div>
    </ion-content>
  `,
  styles: [`
    .dashboard-content {
      --background: #f5f6f8;
    }
    .dashboard-container {
      padding: 0;
    }

    /* Greeting bar */
    .greeting-bar {
      background: linear-gradient(135deg, #002263 0%, #003380 100%);
      color: #ffffff;
      padding: 18px 16px 22px;
    }
    .greeting-text {
      display: flex;
      flex-direction: column;
    }
    .greeting-title {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
      margin: 0 0 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .greeting-name {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 4px;
    }
    .greeting-subtitle {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin: 0;
    }

    /* Active site strip */
    .site-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      padding: 12px 16px;
    }
    .site-strip ion-icon {
      font-size: 20px;
      color: #c9a227;
    }
    .site-strip-info {
      flex: 1;
    }
    .site-strip-label {
      font-size: 10px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .site-strip-value {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
    }

    /* Stats */
    .stats-section {
      padding: 16px;
    }
    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .section-block {
      padding: 0 16px 16px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .stat-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stat-card:active {
      background: #f9fafb;
    }
    .stat-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .stat-icon ion-icon {
      font-size: 22px;
    }
    .stat-icon-navy { background: rgba(0, 34, 99, 0.08); color: #002263; }
    .stat-icon-warning { background: rgba(217, 119, 6, 0.1); color: #d97706; }
    .stat-icon-danger { background: rgba(220, 53, 69, 0.08); color: #dc3545; }
    .stat-icon-info { background: rgba(13, 202, 240, 0.1); color: #0891b2; }
    .stat-content {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      line-height: 1;
    }
    .stat-label {
      font-size: 11px;
      color: #6b7280;
      margin-top: 4px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* Expense block */
    .expense-block {
      margin: 0 16px 16px;
      background: linear-gradient(135deg, #002263 0%, #003380 100%);
      padding: 16px;
      border: 1px solid #002263;
    }
    .expense-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .expense-label {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .expense-amount {
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1;
    }
    .expense-right {
      text-align: right;
    }
    .expense-count {
      font-size: 26px;
      font-weight: 700;
      color: #c9a227;
      line-height: 1;
    }
    .expense-count-label {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.7);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }

    /* Approval card */
    .approval-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      padding: 14px 16px;
      margin-bottom: 8px;
    }
    .approval-card:active {
      background: #f9fafb;
    }
    .approval-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .approval-type {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 8px;
      background: #f1f3f5;
      color: #374151;
    }
    .approval-type.material { background: rgba(220, 53, 69, 0.1); color: #dc3545; }
    .approval-type.labour { background: rgba(13, 202, 240, 0.1); color: #0891b2; }
    .approval-type.expense { background: rgba(217, 119, 6, 0.1); color: #d97706; }
    .approval-type.payment { background: rgba(25, 135, 84, 0.1); color: #198754; }
    .approval-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 6px;
    }
    .approval-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #6b7280;
    }
    .meta-item ion-icon {
      font-size: 13px;
    }
    .amount {
      font-size: 14px;
      font-weight: 700;
      color: #002263;
    }
    .approval-time {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #9ca3af;
    }
    .approval-time ion-icon {
      font-size: 12px;
    }

    /* Site card */
    .site-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      padding: 14px 16px;
      margin-bottom: 8px;
    }
    .site-card:active {
      background: #f9fafb;
    }
    .site-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .site-info {
      flex: 1;
      min-width: 0;
    }
    .site-name {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 4px;
    }
    .site-meta {
      font-size: 11px;
      color: #6b7280;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .site-stats {
      font-size: 11px;
      color: #c9a227;
      margin: 3px 0 0;
      font-weight: 500;
    }
    .stat-sep {
      margin: 0 3px;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: #6b7280;
      background: #ffffff;
      border: 1px dashed #d1d5db;
    }
    .empty-state ion-icon {
      font-size: 36px;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    .empty-state p {
      font-size: 13px;
      margin: 0;
    }
    .skeleton-card {
      padding: 14px 16px;
      margin-bottom: 8px;
    }
    .bottom-spacer {
      height: 24px;
    }
  `],
})
export class DashboardPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);

  dashboard = signal<DashboardData | null>(null);
  sites = signal<Site[]>([]);
  pendingApprovals = signal<ApprovalSummary[]>([]);
  isLoading = signal(true);
  currentSiteName = signal<string | null>(null);
  userName = signal<string>('Supervisor');

  get currentDate(): string {
    return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  }

  greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  async ngOnInit(): Promise<void> {
    addIcons({
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
    });

    await this.loadDashboard();
  }

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

  async selectSite(site: Site): Promise<void> {
    await this.supervisor.setSelectedSite(
      site.id,
      site.projectId || '',
      site.projectName || site.name,
      site.name
    );
    this.currentSiteName.set(site.name);
  }

  getStatusColor(status?: string): string {
    switch (status) {
      case 'Pending': return 'warning';
      case 'Approved': return 'success';
      case 'Rejected': return 'danger';
      default: return 'medium';
    }
  }

  getSiteStatusColor(status?: string): string {
    switch (status) {
      case 'Active': return 'success';
      case 'On Hold': return 'warning';
      case 'Completed': return 'primary';
      default: return 'medium';
    }
  }
}
