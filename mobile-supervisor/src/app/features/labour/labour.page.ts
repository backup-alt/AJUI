import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import {
  IonContent, IonSegment, IonSegmentButton, IonLabel,
  IonFab, IonFabButton, IonIcon, IonSkeletonText,
  IonRefresher, IonRefresherContent, ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  addOutline, peopleOutline, timeOutline, personAddOutline,
  chevronForwardOutline, closeOutline, checkmarkOutline,
  constructOutline, buildOutline, flashOutline, cutOutline,
  homeOutline, colorPaletteOutline, hammerOutline, gridOutline,
  layersOutline, carOutline, sparklesOutline,
  calendarOutline, checkmarkDoneOutline, ellipsisHorizontalOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Worker, Attendance, LabourTypeCount } from '../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { EmptyStateComponent } from '../../shared/components';
import { WorkerListModalComponent } from './worker-list-modal/worker-list-modal.component';

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
};

@Component({
  selector: 'app-labour',
  standalone: true,
  imports: [
    IonContent, IonSegment, IonSegmentButton, IonLabel,
    IonFab, IonFabButton, IonIcon, IonSkeletonText,
    IonRefresher, IonRefresherContent, FormsModule, DatePipe, CurrencyPipe,
    EmptyStateComponent,
  ],
  template: `
    <ion-content class="labour-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshAll($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="page-head">
        <h1>Labour</h1>
        <p>Manage workers and daily attendance.</p>
      </div>

      <div class="filter-stack">
        <div class="seg-wrap">
          <ion-segment [(ngModel)]="activeTab" (ionChange)="onTabChange()" [value]="'workers'">
            <ion-segment-button value="workers">
              <ion-label>Workers</ion-label>
            </ion-segment-button>
            <ion-segment-button value="attendance">
              <ion-label>Today's Attendance</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>
      </div>

      @if (activeTab === 'workers') {
        <div class="section-header">
          <h2>Labour Types</h2>
          <div class="section-actions">
            <button class="mark-att-btn" (click)="openMarkAttendancePicker()">
              <ion-icon name="checkmark-done-outline"></ion-icon>
              Mark Attendance
            </button>
            <button class="add-worker-btn" (click)="createWorker()">
              <ion-icon name="person-add-outline"></ion-icon>
              Add Worker
            </button>
          </div>
        </div>

        <div class="type-cards">
          @if (isLoading() && workerTypeCounts().length === 0 && workers().length === 0) {
            @for (i of [1,2,3,4]; track i) {
              <div class="type-card skeleton">
                <ion-skeleton-text animated style="width: 50%; height: 16px;"></ion-skeleton-text>
                <ion-skeleton-text animated style="width: 30%; height: 24px; margin-top: 8px;"></ion-skeleton-text>
              </div>
            }
          } @else if (workerTypeCounts().length === 0 && !isLoading()) {
            <app-empty-state
              icon="people-outline"
              title="No workers yet"
              message="Add your first worker to start tracking attendance."
            ></app-empty-state>
          } @else {
            @for (type of workerTypeCounts(); track type.labourType) {
              <button type="button" class="type-card" (click)="openWorkersOfType(type.labourType)">
                <div class="type-icon" [class]="'icon-' + getTypeColor(type.labourType)">
                  <ion-icon [name]="getTypeIcon(type.labourType)"></ion-icon>
                </div>
                <div class="type-info">
                  <span class="type-name">{{ type.labourType }}</span>
                  <span class="type-count">{{ type.count }} {{ type.count === 1 ? 'worker' : 'workers' }}</span>
                </div>
                <ion-icon name="chevron-forward-outline" class="type-arrow"></ion-icon>
              </button>
            }
          }
        </div>
      }

      @if (activeTab === 'attendance') {
        <div class="section-header attendance-section-header">
          <h2>
            <ion-icon name="calendar-outline"></ion-icon>
            {{ todayDate | date:'EEEE, MMMM d, yyyy' }}
          </h2>
          <button class="mark-att-btn" (click)="openMarkAttendancePicker()">
            <ion-icon name="checkmark-done-outline"></ion-icon>
            Mark New
          </button>
        </div>

        <div class="cards">
          @if (isLoading() && todayAttendance().length === 0) {
            @for (i of [1,2,3]; track i) {
              <div class="skeleton-card">
                <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
                <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              </div>
            }
          } @else if (todayAttendance().length === 0) {
            <app-empty-state
              icon="time-outline"
              title="No attendance for today"
              message="Select a worker type and mark attendance to get started."
            ></app-empty-state>
          } @else {
            @for (att of todayAttendance(); track att._id) {
              <div class="att-card">
                <div class="att-header">
                  <div class="att-worker">
                    <span class="att-name">{{ att.workerName }}</span>
                    <span class="att-type">{{ att.labourType }}</span>
                  </div>
                  <span class="att-shift">Shift {{ att.shiftCount }}</span>
                </div>
                <div class="att-details">
                  <div class="att-detail">
                    <span class="detail-label">OT Hours</span>
                    <span class="detail-value">{{ att.overtimeHours }}h</span>
                  </div>
                  <div class="att-detail">
                    <span class="detail-label">OT Amount</span>
                    <span class="detail-value">{{ att.overtimeAmount | currency:'INR':'symbol':'1.0-0' }}</span>
                  </div>
                  <div class="att-detail">
                    <span class="detail-label">Late Fine</span>
                    <span class="detail-value">{{ att.lateFine | currency:'INR':'symbol':'1.0-0' }}</span>
                  </div>
                  <div class="att-detail">
                    <span class="detail-label">Payment</span>
                    <span class="detail-value">{{ att.paymentMode }}</span>
                  </div>
                </div>
                @if (att.notes) {
                  <div class="att-notes">Note: {{ att.notes }}</div>
                }
                <div class="att-footer">
                  <button class="view-history-btn" (click)="viewHistory(att)">
                    View History
                  </button>
                  <button class="edit-att-btn" (click)="editAttendance(att)">
                    Edit
                  </button>
                </div>
              </div>
            }
          }
        </div>
      }

      @if (!showWorkerSheet()) {
        @if (activeTab === 'workers') {
          <ion-fab slot="fixed" vertical="bottom" horizontal="end">
            <ion-fab-button (click)="createWorker()">
              <ion-icon name="person-add-outline"></ion-icon>
            </ion-fab-button>
          </ion-fab>
        } @else {
          <ion-fab slot="fixed" vertical="bottom" horizontal="end">
            <ion-fab-button (click)="openMarkAttendancePicker()">
              <ion-icon name="checkmark-done-outline"></ion-icon>
            </ion-fab-button>
          </ion-fab>
        }
      }
    </ion-content>
  `,
  styles: [`
    .labour-content { --background: var(--m3-surface); }

    .page-head { padding: var(--md-space-4) var(--md-space-4) 0; }
    .page-head h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 2px;
      letter-spacing: -0.2px;
    }
    .page-head p { font-size: 13px; color: var(--m3-on-surface-muted); margin: 0 0 12px; }

    .filter-stack { padding: 0 var(--md-space-4) var(--md-space-2); }
    .seg-wrap { padding: 4px 4px 8px; }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px var(--md-space-4) 8px;
    }
    .section-header h2 {
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin: 0;
    }
    .section-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .attendance-section-header h2 {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--m3-on-surface-muted);
      text-transform: none;
      letter-spacing: 0;
    }
    .attendance-section-header h2 ion-icon { font-size: 16px; }
    .mark-att-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: var(--m3-primary);
      color: var(--m3-on-primary);
      border-radius: var(--md-radius-lg);
      font-size: 12px;
      font-weight: 700;
      font-family: inherit;
      border: none;
      cursor: pointer;
    }
    .mark-att-btn ion-icon { font-size: 14px; }
    .add-worker-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: var(--m3-primary);
      color: var(--m3-on-primary);
      border-radius: var(--md-radius-lg);
      font-size: 12px;
      font-weight: 700;
      font-family: inherit;
      border: none;
      cursor: pointer;
    }
    .add-worker-btn ion-icon { font-size: 14px; }

    .type-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--md-space-3);
      padding: 4px var(--md-space-4) 96px;
    }
    .type-card {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      padding: var(--md-space-4);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      box-shadow: var(--md-elevation-1);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: transform var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  box-shadow var(--md-motion-duration-short1) var(--md-motion-easing-standard);
    }
    .type-card:active { transform: scale(0.98); }
    .type-card.skeleton { cursor: default; }
    .type-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--md-radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .type-icon ion-icon { font-size: 20px; }

    .type-icon.icon-helper { background: rgba(14, 165, 233, 0.12); color: #0369a1; }
    .type-icon.icon-mason { background: rgba(168, 85, 247, 0.12); color: #7e22ce; }
    .type-icon.icon-plumber { background: rgba(34, 197, 94, 0.12); color: #15803d; }
    .type-icon.icon-electrician { background: rgba(234, 179, 8, 0.12); color: #a86c02; }
    .type-icon.icon-carpenter { background: rgba(249, 115, 22, 0.12); color: #c2410c; }
    .type-icon.icon-painter { background: rgba(236, 72, 153, 0.12); color: #be185d; }
    .type-icon.icon-civil { background: rgba(156, 163, 175, 0.12); color: #4b5563; }
    .type-icon.icon-tiles { background: rgba(245, 158, 11, 0.12); color: #a16207; }
    .type-icon.icon-steel { background: rgba(100, 116, 139, 0.12); color: #475569; }
    .type-icon.icon-welder { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
    .type-icon.icon-fabricator { background: rgba(99, 102, 241, 0.12); color: #4338ca; }
    .type-icon.icon-default { background: rgba(201, 162, 39, 0.12); color: #a8861f; }

    .type-info { flex: 1; min-width: 0; }
    .type-name { display: block; font-size: 14px; font-weight: 700; color: var(--m3-on-surface); }
    .type-count { display: block; font-size: 11px; color: var(--m3-on-surface-muted); margin-top: 2px; }
    .type-arrow { font-size: 16px; color: var(--m3-on-surface-muted); }

    .attendance-date {
      display: flex;
      align-items: center;
      gap: var(--md-space-2);
      padding: var(--md-space-3) var(--md-space-4) var(--md-space-2);
      font-size: 13px;
      font-weight: 600;
      color: var(--m3-on-surface-muted);
    }
    .attendance-date ion-icon { font-size: 16px; }

    .cards { padding: 4px var(--md-space-4) 96px; }
    .att-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-3);
      box-shadow: var(--md-elevation-1);
    }
    .att-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--md-space-3);
    }
    .att-worker { display: flex; flex-direction: column; gap: 2px; }
    .att-name { font-size: 15px; font-weight: 700; color: var(--m3-on-surface); }
    .att-type { font-size: 11px; color: var(--m3-on-surface-muted); }
    .att-shift {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      background: rgba(14, 165, 233, 0.10);
      color: #0369a1;
      border-radius: var(--md-radius-sm);
    }
    .att-details {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--md-space-2);
      background: var(--m3-surface-container);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-3) var(--md-space-2);
      margin-bottom: var(--md-space-3);
    }
    .att-detail { text-align: center; }
    .detail-label {
      display: block;
      font-size: 9px;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .detail-value { display: block; font-size: 13px; font-weight: 700; color: var(--m3-on-surface); margin-top: 3px; }
    .att-notes {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      font-style: italic;
      margin-bottom: var(--md-space-3);
    }
    .att-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--md-space-2);
    }
    .view-history-btn, .edit-att-btn {
      padding: 6px 12px;
      border-radius: var(--md-radius-md);
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      border: 0;
    }
    .view-history-btn { background: var(--m3-surface-container); color: var(--m3-on-surface-variant); }
    .edit-att-btn { background: var(--m3-primary); color: var(--m3-on-primary); }

    .skeleton-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-3);
    }

    ion-fab-button { --background: var(--m3-primary); --color: var(--m3-on-primary); }
  `],
})
export class LabourPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private modalCtrl = inject(ModalController);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  activeTab = 'workers';
  todayDate = new Date().toISOString().slice(0, 10);

  workers = signal<Worker[]>([]);
  todayAttendance = signal<Attendance[]>([]);
  labourTypeCounts = signal<LabourTypeCount[]>([]);
  showWorkerSheet = signal(false);
  isLoading = signal(true);

  workersOfType = computed<Worker[]>(() => {
    const type = this.selectedLabourType();
    if (!type) return [];
    return this.workers().filter(w => w.labourType === type);
  });

  selectedLabourType = signal<string | null>(null);

  workerTypeCounts = computed<LabourTypeCount[]>(() => {
    const counts = new Map<string, number>();
    for (const w of this.workers()) {
      const t = (w.labourType || '').trim();
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([labourType, count]) => ({ labourType, count }))
      .sort((a, b) => a.labourType.localeCompare(b.labourType));
  });

  async ngOnInit(): Promise<void> {
    addIcons({
      addOutline, peopleOutline, timeOutline, personAddOutline,
      chevronForwardOutline, closeOutline, checkmarkOutline,
      constructOutline, buildOutline, flashOutline, cutOutline,
      homeOutline, colorPaletteOutline, hammerOutline, gridOutline,
      layersOutline, carOutline, sparklesOutline,
      calendarOutline, checkmarkDoneOutline, ellipsisHorizontalOutline,
    });
    await this.loadData();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:site-changed', this.handleSiteChange);
      window.addEventListener('agb:labour-changed', this.handleSiteChange);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:site-changed', this.handleSiteChange);
      window.removeEventListener('agb:labour-changed', this.handleSiteChange);
    }
  }

  private handleSiteChange = (): void => {
    void this.loadData();
  };

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const siteId = this.supervisor.selectedSiteId();
      const projectId = this.supervisor.selectedProjectId();

      const [workersRes, attendanceRes] = await Promise.all([
        this.supervisor.getWorkers({ siteId: siteId || undefined, limit: 200 }).toPromise(),
        this.supervisor.getAttendanceForDate(this.todayDate, siteId || undefined, projectId || undefined).toPromise(),
      ]);

      this.workers.set(workersRes?.items || []);
      this.todayAttendance.set(attendanceRes?.attendances || []);
      this.isLoading.set(false);
    } catch (e) {
      console.error('[Labour] failed to load', e);
      this.isLoading.set(false);
    }
  }

  async refreshAll(event: CustomEvent): Promise<void> {
    await this.loadData();
    (event.target as HTMLIonRefresherElement).complete();
  }

  onTabChange() {
    if (this.activeTab === 'attendance') {
      void this.loadAttendance();
    }
  }

  async loadAttendance(): Promise<void> {
    const siteId = this.supervisor.selectedSiteId();
    const projectId = this.supervisor.selectedProjectId();
    this.supervisor.getAttendanceForDate(this.todayDate, siteId || undefined, projectId || undefined)
      .subscribe({
        next: (res) => this.todayAttendance.set(res.attendances || []),
        error: (err) => console.error('[Labour] failed to load attendance', err),
      });
  }

  getTypeIcon(type: string): string {
    return LABOUR_TYPE_ICONS[type] || 'briefcase-outline';
  }

  getTypeColor(type: string): string {
    const t = type.toLowerCase().replace(/\s+/g, '');
    return LABOUR_TYPE_COLORS[type] || 'default';
  }

  openWorkersOfType(type: string): void {
    this.selectedLabourType.set(type);
    void this.router.navigate(['/tabs/labour/type', type]);
  }

  closeWorkersSheet(): void {
    this.showWorkerSheet.set(false);
    this.selectedLabourType.set(null);
  }

  createWorker(): void {
    this.router.navigate(['/tabs/labour/create-worker']);
  }

  markAttendance(worker: Worker): void {
    this.router.navigate(['/tabs/labour/mark-attendance', worker._id]);
  }

  async openMarkAttendancePicker(): Promise<void> {
    const ws = this.workers();
    if (ws.length === 0) {
      const toast = await this.toastCtrl.create({
        message: 'Add a worker first to mark attendance.',
        duration: 2200,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }
    if (ws.length === 1) {
      this.markAttendance(ws[0]);
      return;
    }
    const modal = await this.modalCtrl.create({
      component: WorkerListModalComponent,
      componentProps: {
        workers: ws,
        labourType: 'Select worker to mark attendance',
        action: 'mark-attendance',
      },
      breakpoints: [0, 0.6, 0.9],
      initialBreakpoint: 0.9,
    });
    await modal.present();
  }

  viewHistory(att: Attendance): void {
    this.router.navigate(['/tabs/labour/worker-history', att.workerId]);
  }

  editAttendance(att: Attendance): void {
    this.router.navigate(['/tabs/labour/edit-attendance', att._id]);
  }
}
