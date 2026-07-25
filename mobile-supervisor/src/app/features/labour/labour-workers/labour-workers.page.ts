import { Component, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonButton,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, timeOutline } from 'ionicons/icons';
import {
  chevronForwardOutline,
  personOutline,
  peopleOutline,
  addOutline,
  locationOutline,
  walletOutline,
  hammerOutline,
  layersOutline,
  buildOutline,
  flashOutline,
  constructOutline,
  homeOutline,
  colorPaletteOutline,
  gridOutline,
  carOutline,
  sparklesOutline,
  briefcaseOutline,
  calendarClearOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Worker } from '../../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { EmptyStateComponent } from '../../../shared/components';

const LABOUR_TYPE_ICONS: Record<string, string> = {
  'Helper': 'hammer-outline',
  'Mason': 'layers-outline',
  'Plumber': 'build-outline',
  'Electrician': 'flash-outline',
  'Carpenter': 'construct-outline',
  'Painter': 'color-palette-outline',
  'Civil': 'home-outline',
  'Tiles Worker': 'grid-outline',
  'Steel Fixer': 'car-outline',
  'Welder': 'sparkles-outline',
  'Fabricator': 'construct-outline',
  'Other': 'briefcase-outline',
};

const LABOUR_TYPE_COLORS: Record<string, string> = {
  'Helper': 'helper',
  'Mason': 'mason',
  'Plumber': 'plumber',
  'Electrician': 'electrician',
  'Carpenter': 'carpenter',
  'Painter': 'painter',
  'Civil': 'civil',
  'Tiles Worker': 'tiles',
  'Steel Fixer': 'steel',
  'Welder': 'welder',
  'Fabricator': 'fabricator',
  'Other': 'other',
};

@Component({
  selector: 'app-labour-workers',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    CurrencyPipe,
    EmptyStateComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ labourType() || 'Workers' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="workers-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="type-hero">
        <div class="type-icon" [class]="'icon-' + getTypeColor(labourType())">
          <ion-icon [name]="getTypeIcon(labourType())"></ion-icon>
        </div>
        <div class="type-meta">
          <h1 class="type-title">{{ labourType() || 'Workers' }}</h1>
          <p class="type-subtitle">
            {{ workers().length }} {{ workers().length === 1 ? 'worker' : 'workers' }}
            @if (selectedSiteName()) {
              <span class="site-pill">
                <ion-icon name="location-outline"></ion-icon>
                {{ selectedSiteName() }}
              </span>
            }
          </p>
        </div>
        <button class="add-btn" (click)="addWorker()">
          <ion-icon name="add-outline"></ion-icon>
          Add
        </button>
      </div>

      <div class="workers-list">
        @if (isLoading() && workers().length === 0) {
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton-card">
              <div class="skel-avatar"></div>
              <div class="skel-info">
                <div class="skel-line w60"></div>
                <div class="skel-line w40"></div>
              </div>
              <div class="skel-action"></div>
            </div>
          }
        } @else if (workers().length === 0) {
          <app-empty-state
            icon="person-outline"
            title="No workers yet"
            [message]="'No ' + (labourType() || '') + ' workers added for this site yet. Tap Add to create one.'"
          ></app-empty-state>
        } @else {
          @for (worker of workers(); track worker._id) {
            <div class="worker-card" (click)="viewWorker(worker)">
              <div class="worker-avatar" [class]="'avatar-' + getTypeColor(worker.labourType)">
                <span class="avatar-initials">{{ getInitials(worker.name) }}</span>
                <span class="avatar-dot"></span>
              </div>
              <div class="worker-body">
                <div class="worker-name-row">
                  <h3 class="worker-name">{{ worker.name }}</h3>
                  @if (worker.isSubcontract) {
                    <span class="subcontract-badge">Subcontract</span>
                  }
                  @if (isMarkedToday(worker)) {
                    <span class="marked-badge" title="Attendance already marked for today">
                      <ion-icon name="checkmark-circle-outline"></ion-icon> Marked
                    </span>
                  }
                </div>
                <p class="worker-meta">
                  @if (worker.isSubcontract && worker.subcontractorName) {
                    <span><ion-icon name="business-outline"></ion-icon> {{ worker.subcontractorName }}</span>
                  } @else {
                    <span><ion-icon name="person-outline"></ion-icon> Direct Employee</span>
                  }
                </p>
                <div class="worker-pay">
                  <span class="pay-primary">
                    <ion-icon name="wallet-outline"></ion-icon>
                    <span class="pay-amount">{{ getDailyWage(worker) | currency:'INR':'symbol':'1.0-0' }}</span>
                    <span class="pay-suffix">/day</span>
                  </span>
                  <span class="pay-secondary">{{ worker.weeklyPay | currency:'INR':'symbol':'1.0-0' }}/wk</span>
                </div>
              </div>
              <div class="worker-actions" (click)="$event.stopPropagation()">
                @if (!isMarkedToday(worker)) {
                  <button class="action-btn success" (click)="markAttendance(worker)" title="Mark attendance">
                    <ion-icon name="calendar-outline"></ion-icon>
                  </button>
                } @else {
                  <span class="action-btn marked-status" title="Attendance already marked">
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </span>
                }
                <button class="action-btn secondary" (click)="viewWorker(worker)" title="View details">
                  <ion-icon name="chevron-forward-outline"></ion-icon>
                </button>
              </div>
            </div>
          }
          <button class="add-another-btn" (click)="addWorker()">
            <ion-icon name="add-outline"></ion-icon>
            Add another {{ labourType() || 'worker' }}
          </button>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .workers-content { --background: var(--m3-surface); --padding-top: 0; --padding-bottom: 0; }

    .type-hero {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      padding: var(--md-space-3) var(--md-space-4);
      margin-top: 0;
      background: linear-gradient(135deg, #002263 0%, #003380 100%);
      color: #ffffff;
    }
    .type-icon {
      width: 56px;
      height: 56px;
      border-radius: var(--md-radius-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }
    .type-icon ion-icon { font-size: 26px; }
    .type-meta { flex: 1; min-width: 0; }
    .type-title {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 2px;
      letter-spacing: -0.2px;
    }
    .type-subtitle {
      font-size: 12px;
      margin: 0;
      opacity: 0.9;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .site-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(255, 255, 255, 0.18);
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .site-pill ion-icon { font-size: 12px; }
    .add-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 8px 14px;
      background: #ffffff;
      color: #002263;
      border: none;
      border-radius: var(--md-radius-pill);
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      font-family: inherit;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
    .add-btn ion-icon { font-size: 16px; font-weight: 800; }

    .workers-list {
      padding: var(--md-space-2) var(--md-space-4) 96px;
      display: flex;
      flex-direction: column;
      gap: var(--md-space-2);
    }
    .worker-card {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-3) var(--md-space-4);
      box-shadow: var(--md-elevation-1);
      cursor: pointer;
      transition: transform var(--md-motion-duration-short1);
    }
    .worker-card:active { transform: scale(0.99); }
    .worker-avatar {
      position: relative;
      width: 48px;
      height: 48px;
      border-radius: var(--md-radius-lg);
      background: var(--m3-primary-container);
      color: var(--m3-on-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .avatar-initials { position: relative; z-index: 1; }
    .avatar-dot {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #22c55e;
      border: 2px solid var(--m3-surface-bright);
      z-index: 2;
    }
    .worker-avatar.avatar-helper { background: rgba(14, 165, 233, 0.15); color: #0369a1; }
    .worker-avatar.avatar-mason { background: rgba(168, 85, 247, 0.15); color: #7e22ce; }
    .worker-avatar.avatar-plumber { background: rgba(34, 197, 94, 0.15); color: #15803d; }
    .worker-avatar.avatar-electrician { background: rgba(234, 179, 8, 0.15); color: #a86c02; }
    .worker-avatar.avatar-carpenter { background: rgba(249, 115, 22, 0.15); color: #c2410c; }
    .worker-avatar.avatar-painter { background: rgba(236, 72, 153, 0.15); color: #be185d; }
    .worker-avatar.avatar-civil { background: rgba(156, 163, 175, 0.15); color: #4b5563; }
    .worker-avatar.avatar-tiles { background: rgba(245, 158, 11, 0.15); color: #a16207; }
    .worker-avatar.avatar-steel { background: rgba(100, 116, 139, 0.15); color: #475569; }
    .worker-avatar.avatar-welder { background: rgba(239, 68, 68, 0.15); color: #b91c1c; }
    .worker-avatar.avatar-fabricator { background: rgba(99, 102, 241, 0.15); color: #4338ca; }
    .worker-avatar.avatar-other { background: rgba(107, 114, 128, 0.15); color: #374151; }
    .worker-avatar.avatar-default { background: rgba(201, 162, 39, 0.15); color: #a8861f; }
    .worker-body { flex: 1; min-width: 0; }
    .worker-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 2px;
    }
    .worker-name {
      font-size: 15px;
      font-weight: 800;
      color: var(--m3-on-surface);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .subcontract-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 2px 6px;
      background: rgba(245, 158, 11, 0.12);
      color: #a16207;
      border-radius: 999px;
    }
    .marked-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 2px 6px;
      background: rgba(34, 197, 94, 0.12);
      color: #15803d;
      border-radius: 999px;
    }
    .marked-badge ion-icon { font-size: 11px; }
    .worker-meta {
      font-size: 11px;
      color: var(--m3-on-surface-muted);
      margin: 0 0 6px;
    }
    .worker-meta ion-icon { font-size: 11px; vertical-align: -1px; margin-right: 2px; }
    .worker-pay {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .pay-primary {
      display: inline-flex;
      align-items: baseline;
      gap: 2px;
      font-size: 12px;
      color: var(--m3-on-surface-muted);
    }
    .pay-primary ion-icon { font-size: 13px; }
    .pay-amount {
      color: var(--m3-primary);
      font-weight: 800;
      font-size: 13px;
    }
    .pay-suffix { font-size: 10px; }
    .pay-secondary {
      font-size: 11px;
      color: var(--m3-on-surface-muted);
      opacity: 0.7;
    }

    .worker-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .action-btn {
      width: 40px;
      height: 40px;
      border-radius: var(--md-radius-md);
      border: none;
      cursor: pointer;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform var(--md-motion-duration-short1), box-shadow var(--md-motion-duration-short1);
    }
    .action-btn:active { transform: scale(0.95); }
    .action-btn ion-icon { font-size: 20px; }
    .action-btn.secondary {
      background: var(--m3-surface-container);
      color: var(--m3-on-surface-variant);
    }
    .action-btn.success {
      background: linear-gradient(135deg, #16a34a, #22c55e);
      color: #ffffff;
      box-shadow: 0 6px 14px -6px rgba(22, 163, 74, 0.45);
    }
    .action-btn.marked-status {
      background: rgba(22, 163, 74, 0.14);
      color: #16a34a;
      cursor: default;
    }

    .add-another-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 14px;
      background: transparent;
      border: 2px dashed var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      color: var(--m3-primary);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background var(--md-motion-duration-short1);
    }
    .add-another-btn:active { background: var(--m3-surface-container); }
    .add-another-btn ion-icon { font-size: 18px; }

    .skeleton-card {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-3) var(--md-space-4);
    }
    .skel-avatar {
      width: 48px;
      height: 48px;
      border-radius: var(--md-radius-lg);
      background: var(--m3-surface-container);
      animation: pulse 1.4s ease-in-out infinite;
    }
    .skel-info { flex: 1; }
    .skel-line {
      height: 10px;
      background: var(--m3-surface-container);
      border-radius: 4px;
      margin-bottom: 6px;
      animation: pulse 1.4s ease-in-out infinite;
    }
    .skel-line.w60 { width: 60%; }
    .skel-line.w40 { width: 40%; height: 8px; }
    .skel-action {
      width: 36px;
      height: 36px;
      border-radius: var(--md-radius-md);
      background: var(--m3-surface-container);
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `],
})
export class LabourWorkersPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supervisor = inject(SupervisorService);
  private toastCtrl = inject(ToastController);

  labourType = signal<string>('');
  workers = signal<Worker[]>([]);
  todayAttendance = signal<any[]>([]);
  todayDate = new Date().toISOString().slice(0, 10);
  isLoading = signal(true);
  selectedSiteName = signal<string>('');

  markedWorkerIds = computed(() => new Set(this.todayAttendance().map(a => a.workerId)));
  hasWorkers = computed(() => this.workers().length > 0);

  ngOnInit(): void {
    addIcons({
      chevronForwardOutline,
      personOutline,
      peopleOutline,
      addOutline,
      locationOutline,
      walletOutline,
      timeOutline,
      hammerOutline,
      layersOutline,
      buildOutline,
      flashOutline,
      constructOutline,
      homeOutline,
      colorPaletteOutline,
      gridOutline,
      carOutline,
      sparklesOutline,
      briefcaseOutline,
      calendarClearOutline,
      checkmarkCircleOutline,
    });

    this.labourType.set(decodeURIComponent(this.route.snapshot.paramMap.get('type') || ''));
    this.selectedSiteName.set(this.supervisor.selectedSiteName() || '');

    if (this.labourType()) {
      void this.loadWorkers();
    }
  }

  private async loadWorkers(): Promise<void> {
    this.isLoading.set(true);
    try {
      const siteId = this.supervisor.selectedSiteId();
      const projectId = this.supervisor.selectedProjectId();
      const [workersRes, attendanceRes] = await Promise.all([
        new Promise<{ items?: Worker[] }>((resolve) => {
          this.supervisor.getWorkers({
            siteId: siteId || undefined,
            projectId: projectId || undefined,
            labourType: this.labourType(),
            limit: 200,
          }).subscribe({
            next: (r) => resolve(r as { items?: Worker[] }),
            error: () => resolve({ items: [] }),
          });
        }),
        new Promise<{ attendances?: any[] }>((resolve) => {
          this.supervisor.getAttendanceForDate(this.todayDate, siteId || undefined, projectId || undefined).subscribe({
            next: (r) => resolve(r as { attendances?: any[] }),
            error: () => resolve({ attendances: [] }),
          });
        }),
      ]);
      this.workers.set(workersRes.items || []);
      this.todayAttendance.set(attendanceRes.attendances || []);
    } catch (e) {
      console.error('[LabourWorkers] failed to load', e);
      this.workers.set([]);
      this.todayAttendance.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.loadWorkers();
    (event.target as HTMLIonRefresherElement).complete();
  }

  viewWorker(worker: Worker): void {
    void this.router.navigate(['/tabs/labour/worker', worker._id]);
  }

  addWorker(): void {
    void this.router.navigate(['/tabs/labour/create-worker']);
  }

  async markAttendance(worker: Worker): Promise<void> {
    void this.router.navigate(['/tabs/labour/mark-attendance', worker._id]);
  }

  getInitials(name: string): string {
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getTypeIcon(type: string): string {
    return LABOUR_TYPE_ICONS[type] || 'briefcase-outline';
  }

  isMarkedToday(worker: Worker): boolean {
    const id = (worker as any).workerId || worker._id;
    return this.markedWorkerIds().has(id) || this.markedWorkerIds().has(worker._id);
  }

  getTypeColor(type: string): string {
    return LABOUR_TYPE_COLORS[type] || 'default';
  }

  getDailyWage(worker: Worker): number {
    return (worker as any).dailyWage || Math.round(((worker as any).weeklyPay || 0) / 7);
  }
}
