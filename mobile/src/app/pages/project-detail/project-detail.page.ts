import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  locationOutline,
  callOutline,
  calendarOutline,
  cubeOutline,
  peopleOutline,
  walletOutline,
  cardOutline,
  briefcaseOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonSegment,
    IonSegmentButton,
    IonLabel,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar class="agb-header">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/projects"></ion-back-button>
        </ion-buttons>
        <ion-title>Project</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true" *ngIf="project() as p">
      <!-- Hero -->
      <div class="project-hero">
        <div class="project-id">{{ p.projectId }}</div>
        <h1>{{ p.name }}</h1>
        <div class="client">{{ p.client }}</div>
        <ion-chip [class]="statusClass(p.status)">{{ p.status }}</ion-chip>

        <div class="hero-stats">
          <div class="hero-stat">
            <span class="label">Total Value</span>
            <span class="value">₹ {{ p.totalValue | number:'1.0-0' }}</span>
          </div>
          <div class="hero-stat">
            <span class="label">Received</span>
            <span class="value">₹ {{ p.receivedAmount | number:'1.0-0' }}</span>
          </div>
          <div class="hero-stat">
            <span class="label">Balance</span>
            <span class="value">₹ {{ p.pendingBalance | number:'1.0-0' }}</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="container">
        <ion-segment [(ngModel)]="tab" mode="ios">
          <ion-segment-button value="overview">
            <ion-label>Overview</ion-label>
          </ion-segment-button>
          <ion-segment-button value="sites">
            <ion-label>Sites</ion-label>
          </ion-segment-button>
          <ion-segment-button value="financials">
            <ion-label>Financials</ion-label>
          </ion-segment-button>
        </ion-segment>

        <!-- Overview -->
        <div *ngIf="tab === 'overview'" class="tab-content">
          <div class="agb-list-card">
            <div class="agb-list-item">
              <div class="icon-bubble"><ion-icon name="call-outline"></ion-icon></div>
              <div class="body">
                <p class="title">Client Contact</p>
                <p class="subtitle">{{ p.mobile }}</p>
              </div>
            </div>
            <div class="agb-list-item">
              <div class="icon-bubble"><ion-icon name="location-outline"></ion-icon></div>
              <div class="body">
                <p class="title">Site Address</p>
                <p class="subtitle">{{ p.address }}</p>
              </div>
            </div>
            <div class="agb-list-item">
              <div class="icon-bubble"><ion-icon name="calendar-outline"></ion-icon></div>
              <div class="body">
                <p class="title">Started</p>
                <p class="subtitle">{{ p.startDate | date:'fullDate' }}</p>
              </div>
            </div>
          </div>

          <div class="agb-section-title">Progress</div>
          <ion-card class="agb-card agb-card-elevated">
            <ion-card-content>
              <div class="progress-head">
                <span class="muted">Overall completion</span>
                <span class="pct">{{ p.completion }}%</span>
              </div>
              <div class="agb-progress" style="margin-top: 10px;">
                <span [style.width.%]="p.completion"></span>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Sites -->
        <div *ngIf="tab === 'sites'" class="tab-content">
          <div class="agb-list-card" *ngIf="p.sites.length > 0; else noSites">
            <div class="agb-list-item" *ngFor="let s of p.sites">
              <div class="icon-bubble"><ion-icon name="location-outline"></ion-icon></div>
              <div class="body">
                <p class="title">{{ s.name }}</p>
                <p class="subtitle">Site ID: {{ s.id }}</p>
              </div>
              <div class="trailing">
                <ion-chip class="agb-chip agb-chip-{{ s.status === 'Active' ? 'success' : 'info' }}">{{ s.status }}</ion-chip>
              </div>
            </div>
          </div>
          <ng-template #noSites>
            <div class="agb-empty">
              <ion-icon name="location-outline"></ion-icon>
              <h3>No sites configured</h3>
              <p>Add sites to start logging material, labour, and expenses.</p>
            </div>
          </ng-template>
        </div>

        <!-- Financials -->
        <div *ngIf="tab === 'financials'" class="tab-content">
          <div class="finance-grid">
            <div class="finance-tile">
              <div class="ft-icon" style="background: rgba(0,34,99,0.08); color: var(--agb-primary);">
                <ion-icon name="cube-outline"></ion-icon>
              </div>
              <div>
                <span class="ft-label">Material Spend</span>
                <span class="ft-value">₹ {{ p.materialSpend | number:'1.0-0' }}</span>
              </div>
            </div>
            <div class="finance-tile">
              <div class="ft-icon" style="background: rgba(31,157,106,0.12); color: var(--agb-success);">
                <ion-icon name="people-outline"></ion-icon>
              </div>
              <div>
                <span class="ft-label">Labour Payable</span>
                <span class="ft-value">₹ {{ p.labourPayable | number:'1.0-0' }}</span>
              </div>
            </div>
            <div class="finance-tile">
              <div class="ft-icon" style="background: rgba(201,162,39,0.16); color: var(--agb-gold);">
                <ion-icon name="wallet-outline"></ion-icon>
              </div>
              <div>
                <span class="ft-label">Expense Balance</span>
                <span class="ft-value">₹ {{ p.expenseBalance | number:'1.0-0' }}</span>
              </div>
            </div>
            <div class="finance-tile">
              <div class="ft-icon" style="background: rgba(43,127,204,0.12); color: var(--agb-info);">
                <ion-icon name="card-outline"></ion-icon>
              </div>
              <div>
                <span class="ft-label">Received</span>
                <span class="ft-value">₹ {{ p.receivedAmount | number:'1.0-0' }}</span>
              </div>
            </div>
          </div>

          <div class="agb-section-title">Recent Activity</div>
          <div class="agb-list-card">
            <div class="agb-list-item" *ngFor="let item of projectActivity()">
              <div class="icon-bubble"><ion-icon [name]="item.icon"></ion-icon></div>
              <div class="body">
                <p class="title">{{ item.title }}</p>
                <p class="subtitle">{{ item.subtitle }}</p>
              </div>
              <div class="trailing">
                <span class="amount" *ngIf="item.amount">₹ {{ item.amount | number:'1.0-0' }}</span>
                <ion-chip [class]="item.chipClass">{{ item.status }}</ion-chip>
              </div>
            </div>
          </div>
        </div>

        <div style="height: 80px;"></div>
      </div>
    </ion-content>
  `,
  styles: [`
    .project-hero {
      background: var(--agb-gradient-primary);
      color: #ffffff;
      padding: 22px 18px 28px;
      border-radius: 0 0 24px 24px;
      margin-bottom: -8px;
    }
    .project-id {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.6px;
      color: var(--agb-gold-light);
    }
    .project-hero h1 {
      margin: 6px 0 4px;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.3;
    }
    .client {
      font-size: 13px;
      opacity: 0.9;
      margin-bottom: 10px;
    }
    .project-hero ion-chip {
      --background: rgba(255,255,255,0.18);
      --color: #ffffff;
    }
    .hero-stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-top: 16px;
      padding: 12px;
      background: rgba(255,255,255,0.10);
      border-radius: 12px;
      backdrop-filter: blur(6px);
    }
    .hero-stat { text-align: center; }
    .hero-stat .label {
      display: block;
      font-size: 10px;
      opacity: 0.8;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .hero-stat .value {
      display: block;
      font-size: 13px;
      font-weight: 800;
      margin-top: 4px;
    }
    .container { padding: 18px; }
    ion-segment {
      --background: #ffffff;
      border: 1px solid var(--agb-border);
      border-radius: 12px;
      margin-bottom: 14px;
    }
    ion-segment-button {
      --color: var(--agb-text-muted);
      --color-checked: #ffffff;
      --indicator-color: var(--agb-primary);
      --border-radius: 10px;
      text-transform: none;
      font-weight: 600;
      min-height: 36px;
    }
    .tab-content { padding-top: 4px; }
    .finance-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }
    .finance-tile {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 14px;
      background: var(--agb-surface);
      border: 1px solid var(--agb-border);
      border-radius: 12px;
      box-shadow: var(--agb-shadow-sm);
    }
    .ft-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    .ft-label {
      display: block;
      font-size: 10px;
      color: var(--agb-text-muted);
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .ft-value {
      display: block;
      font-size: 14px;
      font-weight: 800;
      color: var(--agb-primary);
      margin-top: 2px;
    }
    .progress-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .muted { color: var(--agb-text-muted); font-size: 12px; }
    .pct { font-weight: 800; color: var(--agb-primary); font-size: 18px; }
    .agb-chip-success { --background: rgba(31,157,106,0.14); --color: var(--agb-success); }
    .agb-chip-info { --background: rgba(43,127,204,0.12); --color: var(--agb-info); }
  `],
})
export class ProjectDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  projectId = signal<string>('');
  tab: 'overview' | 'sites' | 'financials' = 'overview';

  project = computed(() => {
    const id = this.projectId();
    return id ? this.api.getProjectById(id) : undefined;
  });

  projectActivity = computed(() => {
    const p = this.project();
    if (!p) return [];
    const items: any[] = [];
    this.api.materials().filter((m) => m.projectId === p.id).forEach((m) =>
      items.push({ icon: 'cube-outline', title: m.name, subtitle: `${m.requestedQuantity} ${m.unit} · ${m.site}`, status: m.status, chipClass: this.statusChip(m.status) })
    );
    this.api.labour().filter((l) => l.projectId === p.id).forEach((l) =>
      items.push({ icon: 'people-outline', title: `Labour: ${l.totalWorkers} workers`, subtitle: `${l.site} · ${l.attendanceDate}`, status: l.status, chipClass: this.statusChip(l.status), amount: l.totalWages })
    );
    this.api.expenses().filter((e) => e.projectId === p.id).forEach((e) =>
      items.push({ icon: 'wallet-outline', title: e.category, subtitle: `${e.site} · ${e.expenseDate}`, status: e.status, chipClass: this.statusChip(e.status), amount: e.amount })
    );
    return items.slice(0, 8);
  });

  constructor() {
    addIcons({
      'location-outline': locationOutline,
      'call-outline': callOutline,
      'calendar-outline': calendarOutline,
      'cube-outline': cubeOutline,
      'people-outline': peopleOutline,
      'wallet-outline': walletOutline,
      'card-outline': cardOutline,
      'briefcase-outline': briefcaseOutline,
      'chevron-forward-outline': chevronForwardOutline,
    });
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.projectId.set(id);
      await this.api.loadProject(id);
    }
  }

  statusClass(s: string) {
    return {
      Active: 'agb-chip agb-chip-info',
      'On Hold': 'agb-chip agb-chip-warning',
      Completed: 'agb-chip agb-chip-success',
    }[s] || 'agb-chip';
  }

  statusChip(s: string) {
    return {
      Pending: 'agb-chip agb-chip-warning',
      Approved: 'agb-chip agb-chip-success',
      Rejected: 'agb-chip agb-chip-danger',
    }[s] || 'agb-chip';
  }
}