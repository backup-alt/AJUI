import { Component, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButtons,
  IonMenuButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonButton,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonBadge,
} from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  cubeOutline,
  peopleOutline,
  walletOutline,
  checkmarkDoneCircleOutline,
  trendingUpOutline,
  timeOutline,
  calendarOutline,
  arrowForwardOutline,
  briefcaseOutline,
  cardOutline,
} from 'ionicons/icons';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonButtons,
    IonMenuButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonChip,
    IonButton,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonBadge,
    RouterLink,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar class="agb-header">
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Dashboard</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="agb-page-header">
        <h1>Welcome back</h1>
        <p>{{ greeting() }} · {{ today }}</p>
      </div>

      <div class="container">
        <!-- Stats -->
        <div class="stat-grid">
          <div class="agb-stat-card accent">
            <span class="label">Active Projects</span>
            <span class="value">{{ stats().activeProjects }}</span>
            <span class="meta">{{ projects().length }} total</span>
          </div>
          <div class="agb-stat-card">
            <span class="label">Today's Expense</span>
            <span class="value">{{ stats().todayExpense | number:'1.0-0' }}</span>
            <span class="meta">{{ stats().todayExpenseCount }} entries · INR</span>
          </div>
          <div class="agb-stat-card">
            <span class="label">Pending Approvals</span>
            <span class="value">{{ stats().pendingApprovals }}</span>
            <span class="meta">Across all modules</span>
          </div>
          <div class="agb-stat-card">
            <span class="label">Workers Today</span>
            <span class="value">{{ stats().workersToday }}</span>
            <span class="meta">{{ stats().materialsLoggedThisWeek }} materials this week</span>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="agb-section-title">Quick Actions</div>
        <div class="quick-actions">
          <a routerLink="/tabs/materials" class="qa">
            <div class="qa-icon" style="background: rgba(0,34,99,0.08); color: var(--agb-primary);">
              <ion-icon name="cube-outline"></ion-icon>
            </div>
            <div class="qa-label">Material</div>
          </a>
          <a routerLink="/tabs/labour" class="qa">
            <div class="qa-icon" style="background: rgba(31,157,106,0.12); color: var(--agb-success);">
              <ion-icon name="people-outline"></ion-icon>
            </div>
            <div class="qa-label">Labour</div>
          </a>
          <a routerLink="/tabs/expense" class="qa">
            <div class="qa-icon" style="background: rgba(201,162,39,0.16); color: var(--agb-gold);">
              <ion-icon name="wallet-outline"></ion-icon>
            </div>
            <div class="qa-label">Expense</div>
          </a>
          <a routerLink="/tabs/approvals" class="qa">
            <div class="qa-icon" style="background: rgba(216,68,58,0.12); color: var(--agb-danger);">
              <ion-icon name="checkmark-done-circle-outline"></ion-icon>
            </div>
            <div class="qa-label">Approvals</div>
          </a>
        </div>

        <!-- Today activity -->
        <div class="agb-section-title">
          <span>Today's Activity</span>
          <ion-badge class="agb-badge" color="primary">{{ activity().length }}</ion-badge>
        </div>
        <div class="agb-list-card" *ngIf="activity().length > 0; else noActivity">
          <div class="agb-list-item" *ngFor="let item of activity()">
            <div class="icon-bubble" [ngClass]="sourceClass(item.source)">
              <ion-icon [name]="sourceIcon(item.source)"></ion-icon>
            </div>
            <div class="body">
              <p class="title">{{ item.title }}</p>
              <p class="subtitle">{{ item.subtitle }}</p>
            </div>
            <div class="trailing">
              <div class="amount" *ngIf="item.amount">{{ item.amount | number:'1.0-0' }}</div>
              <ion-chip [class]="statusChipClass(item.status)">{{ item.status }}</ion-chip>
            </div>
          </div>
        </div>
        <ng-template #noActivity>
          <div class="agb-empty">
            <ion-icon name="time-outline"></ion-icon>
            <h3>No activity yet today</h3>
            <p>Your submissions will appear here.</p>
          </div>
        </ng-template>

        <!-- Recent projects -->
        <div class="agb-section-title">Recent Projects</div>
        <ion-card class="agb-card agb-card-elevated project-card" *ngFor="let project of projects().slice(0, 3)"
                  [routerLink]="['/project', project.id]" button>
          <ion-card-header>
            <div class="project-head">
              <div>
                <ion-card-title>{{ project.name }}</ion-card-title>
                <ion-card-subtitle>{{ project.client }} · {{ project.sites.length }} site(s)</ion-card-subtitle>
              </div>
              <ion-chip [class]="projectStatusClass(project.status)">{{ project.status }}</ion-chip>
            </div>
          </ion-card-header>
          <ion-card-content>
            <div class="project-meta">
              <span class="muted">Started {{ project.startDate | date:'MMM yyyy' }}</span>
              <span class="muted">INR {{ project.totalValue | number:'1.0-0' }}</span>
            </div>
            <div class="agb-progress" style="margin-top: 10px;">
              <span [style.width.%]="project.completion"></span>
            </div>
            <div class="project-meta" style="margin-top: 6px;">
              <span class="muted">{{ project.completion }}% complete</span>
              <span class="muted">Balance: INR {{ project.pendingBalance | number:'1.0-0' }}</span>
            </div>
          </ion-card-content>
        </ion-card>

        <div style="height: 80px;"></div>
      </div>
    </ion-content>
  `,
  styles: [`
    .container { padding: 18px; }
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 4px;
    }
    .quick-actions {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: var(--agb-surface);
      border: 1px solid var(--agb-border);
      border-radius: var(--agb-radius);
      padding: 14px 6px;
      box-shadow: var(--agb-shadow-sm);
    }
    .qa { display: flex; flex-direction: column; align-items: center; gap: 6px; text-decoration: none; }
    .qa-icon {
      width: 46px; height: 46px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
    }
    .qa-label { font-size: 11px; font-weight: 600; color: var(--agb-text); text-align: center; }
    .agb-section-title {
      display: flex; align-items: center; justify-content: space-between;
    }
    .agb-badge {
      font-weight: 700;
    }
    .project-card { margin-bottom: 12px; }
    .project-head {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
    }
    .project-head ion-card-title { font-size: 16px; line-height: 1.3; }
    .project-head ion-card-subtitle { font-size: 12px; margin-top: 4px; }
    .project-meta {
      display: flex; align-items: center; justify-content: space-between;
    }
    .muted { color: var(--agb-text-muted); font-size: 12px; }
    .icon-bubble.material { background: rgba(0,34,99,0.08); color: var(--agb-primary); }
    .icon-bubble.labour { background: rgba(31,157,106,0.12); color: var(--agb-success); }
    .icon-bubble.expense { background: rgba(201,162,39,0.16); color: var(--agb-gold); }
    .icon-bubble.payment { background: rgba(43,127,204,0.12); color: var(--agb-info); }
    .icon-bubble.subcontract { background: rgba(160,84,196,0.14); color: #8b4fa0; }
  `],
})
export class HomePage implements OnInit {
  today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  stats = this.api.stats;
  projects = this.api.projects;
  activity = this.api.activity;
  user = this.auth.currentUser;
  loading = this.api.loading;

  greeting = computed(() => {
    const name = this.user()?.name?.split(' ')[0] || 'Supervisor';
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  });

  constructor(
    private api: ApiService,
    private auth: AuthService,
  ) {
    addIcons({
      'cube-outline': cubeOutline,
      'people-outline': peopleOutline,
      'wallet-outline': walletOutline,
      'checkmark-done-circle-outline': checkmarkDoneCircleOutline,
      'trending-up-outline': trendingUpOutline,
      'time-outline': timeOutline,
      'calendar-outline': calendarOutline,
      'arrow-forward-outline': arrowForwardOutline,
      'briefcase-outline': briefcaseOutline,
      'card-outline': cardOutline,
    });
  }

  async ngOnInit() {
    await this.api.loadDashboard();
  }

  async handleRefresh(event: CustomEvent) {
    await this.api.loadDashboard();
    setTimeout(() => {
      (event.target as any).complete();
    }, 400);
  }

  sourceIcon(s: string) {
    return {
      material: 'cube-outline',
      labour: 'people-outline',
      expense: 'wallet-outline',
      payment: 'card-outline',
      subcontract: 'briefcase-outline',
    }[s] || 'time-outline';
  }

  sourceClass(s: string) {
    return s;
  }

  statusChipClass(s: string) {
    return {
      Pending: 'agb-chip agb-chip-warning',
      Approved: 'agb-chip agb-chip-success',
      Rejected: 'agb-chip agb-chip-danger',
    }[s] || 'agb-chip';
  }

  projectStatusClass(s: string) {
    return {
      Active: 'agb-chip agb-chip-info',
      'On Hold': 'agb-chip agb-chip-warning',
      Completed: 'agb-chip agb-chip-success',
    }[s] || 'agb-chip';
  }
}