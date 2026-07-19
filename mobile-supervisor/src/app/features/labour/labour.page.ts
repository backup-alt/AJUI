import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import {
  IonContent, IonSegment, IonSegmentButton, IonLabel,
  IonFab, IonFabButton, IonIcon, IonSkeletonText,
  IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  addOutline, peopleOutline, timeOutline, personAddOutline,
  chevronForwardOutline, businessOutline, briefcaseOutline,
  constructOutline, hammerOutline, flashOutline, buildOutline,
  cutOutline, homeOutline, closeOutline, checkmarkOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Worker, Attendance, LabourTypeCount } from '../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { EmptyStateComponent } from '../../shared/components';

const LABOUR_TYPE_ICONS: Record<string, string> = {
  'Helper': 'hammer-outline',
  'Mason': 'construct-outline',
  'Plumber': 'build-outline',
  'Electrician': 'flash-outline',
  'Carpenter': 'cut-outline',
  'Civil': 'home-outline',
};

const ALL_LABOUR_TYPES = ['Helper', 'Mason', 'Plumber', 'Electrician', 'Carpenter', 'Civil'];

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
          <button class="add-worker-btn" (click)="createWorker()">
            <ion-icon name="person-add-outline"></ion-icon>
            Add Worker
          </button>
        </div>

        <div class="type-cards">
          @if (isLoading() && labourTypeCounts().length === 0) {
            @for (i of [1,2,3,4]; track i) {
              <div class="type-card skeleton">
                <ion-skeleton-text animated style="width: 50%; height: 16px;"></ion-skeleton-text>
                <ion-skeleton-text animated style="width: 30%; height: 24px; margin-top: 8px;"></ion-skeleton-text>
              </div>
            }
          } @else if (labourTypeCounts().length === 0 && !isLoading()) {
            <app-empty-state
              icon="people-outline"
              title="No workers yet"
              message="Add your first worker to start tracking attendance."
            ></app-empty-state>
          } @else {
            @for (type of labourTypeCounts(); track type.labourType) {
              <button class="type-card" (click)="openWorkersOfType(type.labourType)">
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

        @if (selectedLabourType()) {
          <div class="workers-sheet">
            <div class="sheet-header">
              <h3>{{ selectedLabourType() }} Workers</h3>
              <button class="close-btn" (click)="closeWorkersSheet()">
                <ion-icon name="close-outline"></ion-icon>
              </button>
            </div>
            <div class="workers-list">
              @for (worker of workersOfType(); track worker._id) {
                <div class="worker-row">
                  <div class="worker-info">
                    <span class="worker-name">{{ worker.name }}</span>
                    <span class="worker-pay">{{ worker.weeklyPay | currency:'INR':'symbol':'1.0-0' }}/week</span>
                  </div>
                  <button class="mark-btn" (click)="markAttendance(worker)">
                    Mark Present
                  </button>
                </div>
              }
            </div>
          </div>
          <div class="sheet-backdrop" (click)="closeWorkersSheet()"></div>
        }
      }

      @if (activeTab === 'attendance') {
        <div class="attendance-date">
          <ion-icon name="calendar-outline"></ion-icon>
          {{ todayDate | date:'EEEE, MMMM d, yyyy' }}
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

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="createWorker()">
          <ion-icon name="person-add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .labour-content { --background: #f5f6f8; }

    .page-head { padding: 16px 16px 0; }
    .page-head h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 2px; letter-spacing: -0.2px; }
    .page-head p { font-size: 13px; color: #64748b; margin: 0 0 12px; }

    .filter-stack { padding: 0 16px 8px; }
    .seg-wrap { padding: 4px 4px 8px; }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px 8px;
    }
    .section-header h2 { font-size: 14px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
    .add-worker-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: #002263;
      color: #fff;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      font-family: inherit;
      border: none;
      cursor: pointer;
    }
    .add-worker-btn ion-icon { font-size: 14px; }

    .type-cards {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding: 4px 16px 96px;
    }
    .type-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .type-card:active { transform: scale(0.98); }
    .type-card.skeleton { cursor: default; }
    .type-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .type-icon ion-icon { font-size: 18px; }
    .type-icon.icon-helper { background: rgba(14, 165, 233, 0.10); color: #0369a1; }
    .type-icon.icon-mason { background: rgba(168, 85, 247, 0.10); color: #7e22ce; }
    .type-icon.icon-plumber { background: rgba(34, 197, 94, 0.10); color: #15803d; }
    .type-icon.icon-electrician { background: rgba(234, 179, 8, 0.10); color: #a86c02; }
    .type-icon.icon-carpenter { background: rgba(249, 115, 22, 0.10); color: #c2410c; }
    .type-icon.icon-civil { background: rgba(156, 163, 175, 0.10); color: #4b5563; }
    .type-icon.icon-default { background: rgba(201, 162, 39, 0.10); color: #a8861f; }
    .type-info { flex: 1; min-width: 0; }
    .type-name { display: block; font-size: 14px; font-weight: 700; color: #0f172a; }
    .type-count { display: block; font-size: 11px; color: #64748b; margin-top: 2px; }
    .type-arrow { font-size: 16px; color: #94a3b8; }

    .workers-sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-height: 70vh;
      background: #ffffff;
      border-radius: 22px 22px 0 0;
      z-index: 101;
      display: flex;
      flex-direction: column;
      box-shadow: 0 -8px 40px rgba(15, 23, 42, 0.20);
    }
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.40);
      z-index: 100;
      backdrop-filter: blur(2px);
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 18px 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .sheet-header h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
    .close-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #f1f5f9;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .close-btn ion-icon { font-size: 20px; color: #64748b; }
    .workers-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0 24px;
    }
    .worker-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      border-bottom: 1px solid #f8fafc;
    }
    .worker-info { display: flex; flex-direction: column; gap: 2px; }
    .worker-name { font-size: 14px; font-weight: 600; color: #0f172a; }
    .worker-pay { font-size: 12px; color: #64748b; }
    .mark-btn {
      padding: 8px 14px;
      background: #002263;
      color: #fff;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      font-family: inherit;
      border: none;
      cursor: pointer;
    }

    .attendance-date {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px 8px;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
    }
    .attendance-date ion-icon { font-size: 16px; }

    .cards { padding: 4px 16px 96px; }
    .att-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .att-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .att-worker { display: flex; flex-direction: column; gap: 2px; }
    .att-name { font-size: 15px; font-weight: 700; color: #0f172a; }
    .att-type { font-size: 11px; color: #64748b; }
    .att-shift {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      background: rgba(14, 165, 233, 0.10);
      color: #0369a1;
      border-radius: 6px;
    }
    .att-details {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: #f8fafc;
      border-radius: 10px;
      padding: 10px 8px;
      margin-bottom: 10px;
    }
    .att-detail { text-align: center; }
    .detail-label { display: block; font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
    .detail-value { display: block; font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    .att-notes { font-size: 12px; color: #64748b; font-style: italic; margin-bottom: 10px; }
    .att-footer { display: flex; justify-content: flex-end; gap: 8px; }
    .view-history-btn, .edit-att-btn {
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      border: 0;
    }
    .view-history-btn { background: #f1f5f9; color: #475569; }
    .edit-att-btn { background: #002263; color: #fff; }

    .skeleton-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 10px;
    }

    ion-fab-button { --background: #002263; --color: #ffffff; }

    .empty-state-container {
      padding: 40px 16px;
    }
  `],
})
export class LabourPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);

  activeTab = 'workers';
  todayDate = new Date().toISOString().slice(0, 10);

  workers = signal<Worker[]>([]);
  todayAttendance = signal<Attendance[]>([]);
  labourTypeCounts = signal<LabourTypeCount[]>([]);
  selectedLabourType = signal<string | null>(null);
  isLoading = signal(true);

  workersOfType = computed<Worker[]>(() => {
    const type = this.selectedLabourType();
    if (!type) return [];
    return this.workers().filter(w => w.labourType === type);
  });

  async ngOnInit(): Promise<void> {
    addIcons({
      addOutline, peopleOutline, timeOutline, personAddOutline,
      chevronForwardOutline, businessOutline, briefcaseOutline,
      constructOutline, hammerOutline, flashOutline, buildOutline,
      cutOutline, homeOutline, closeOutline, checkmarkOutline,
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

      const [workersRes, attendanceRes, countsRes] = await Promise.all([
        this.supervisor.getWorkers({ siteId: siteId || undefined, limit: 100 }).toPromise(),
        this.supervisor.getAttendanceForDate(this.todayDate, siteId || undefined, projectId || undefined).toPromise(),
        siteId ? this.supervisor.getLabourTypeCounts(siteId, this.todayDate).toPromise() : Promise.resolve({ counts: [] }),
      ]);

      this.workers.set(workersRes?.items || []);
      this.todayAttendance.set(attendanceRes?.attendances || []);
      this.labourTypeCounts.set(countsRes?.counts || []);
      this.isLoading.set(false);
    } catch (e) {
      console.error('[Labour] failed to load', e);
      this.workers.set([]);
      this.todayAttendance.set([]);
      this.labourTypeCounts.set([]);
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
    return type.toLowerCase() || 'default';
  }

  openWorkersOfType(type: string): void {
    this.selectedLabourType.set(type);
  }

  closeWorkersSheet(): void {
    this.selectedLabourType.set(null);
  }

  createWorker(): void {
    this.router.navigate(['/tabs/labour/create-worker']);
  }

  markAttendance(worker: Worker): void {
    this.router.navigate(['/tabs/labour/mark-attendance', worker._id]);
  }

  viewHistory(att: Attendance): void {
    this.router.navigate(['/tabs/labour/worker-history', att.workerId]);
  }

  editAttendance(att: Attendance): void {
    this.router.navigate(['/tabs/labour/edit-attendance', att._id]);
  }
}