import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { Router, ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import { timeOutline, chevronForwardOutline, calendarOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Attendance, Worker } from '../../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { EmptyStateComponent } from '../../../shared/components';

@Component({
  selector: 'app-labour-worker-history',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonIcon,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    DatePipe,
    CurrencyPipe,
    EmptyStateComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour"></ion-back-button>
        </ion-buttons>
        <ion-title>Attendance History</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="history-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshAll($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (worker()) {
        <div class="worker-header">
          <div class="worker-info">
            <h2 class="worker-name">{{ worker()!.name }}</h2>
            <p class="worker-meta">{{ worker()!.labourType }} &bull; {{ worker()!.weeklyPay | currency:'INR':'symbol':'1.0-0' }}/week</p>
          </div>
        </div>
      }

      <div class="history-list">
        @if (isLoading() && attendances().length === 0) {
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width: 60%; height: 16px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </div>
          }
        } @else if (attendances().length === 0) {
          <app-empty-state
            icon="time-outline"
            title="No attendance records"
            message="This worker has no attendance history yet."
          ></app-empty-state>
        } @else {
          @for (att of attendances(); track att._id) {
            <div class="history-card">
              <div class="history-date">
                <ion-icon name="calendar-outline"></ion-icon>
                {{ att.attendanceDate | date:'EEE, MMM d, yyyy' }}
              </div>

              <div class="history-stats">
                <div class="stat">
                  <span class="stat-label">Shifts</span>
                  <span class="stat-value">{{ att.shiftCount }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">OT Hours</span>
                  <span class="stat-value">{{ att.overtimeHours }}h</span>
                </div>
                <div class="stat">
                  <span class="stat-label">OT Amount</span>
                  <span class="stat-value">{{ att.overtimeAmount | currency:'INR':'symbol':'1.0-0' }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Late Fine</span>
                  <span class="stat-value">{{ att.lateFine | currency:'INR':'symbol':'1.0-0' }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Payment</span>
                  <span class="stat-value">{{ att.paymentMode }}</span>
                </div>
              </div>

              @if (att.notes) {
                <div class="history-notes">Note: {{ att.notes }}</div>
              }

              <div class="history-footer">
                <button class="edit-btn" (click)="editAttendance(att)">
                  Edit
                </button>
              </div>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .history-content { --background: #f5f6f8; }

    .worker-header {
      padding: 16px;
      background: #ffffff;
      border-bottom: 1px solid #f1f5f9;
    }
    .worker-name { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .worker-meta { font-size: 13px; color: #64748b; margin: 0; }

    .history-list { padding: 12px 16px 24px; }

    .history-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .history-date {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 10px;
    }
    .history-date ion-icon { font-size: 14px; color: #64748b; }

    .history-stats {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;
      background: #f8fafc;
      border-radius: 10px;
      padding: 10px 8px;
      margin-bottom: 10px;
    }
    .stat { text-align: center; }
    .stat-label { display: block; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.2px; }
    .stat-value { display: block; font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 3px; }

    .history-notes {
      font-size: 12px;
      color: #64748b;
      font-style: italic;
      margin-bottom: 10px;
    }

    .history-footer { display: flex; justify-content: flex-end; }
    .edit-btn {
      padding: 6px 14px;
      background: #002263;
      color: #fff;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      border: none;
      cursor: pointer;
    }

    .skeleton-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 10px;
    }
  `],
})
export class LabourWorkerHistoryPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  worker = signal<Worker | null>(null);
  attendances = signal<Attendance[]>([]);
  isLoading = signal(true);

  workerId = '';

  async ngOnInit(): Promise<void> {
    addIcons({ timeOutline, chevronForwardOutline, calendarOutline });
    this.workerId = this.route.snapshot.paramMap.get('workerId') || '';
    if (this.workerId) {
      await this.loadData();
    }
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [workerRes, attendanceRes] = await Promise.all([
        this.supervisor.getWorkerDetail(this.workerId).toPromise(),
        this.supervisor.getAttendanceForWorker(this.workerId, 1, 100).toPromise(),
      ]);
      this.worker.set(workerRes?.worker || null);
      this.attendances.set(attendanceRes?.items || []);
    } catch (e) {
      console.error('[WorkerHistory] failed to load', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshAll(event: CustomEvent): Promise<void> {
    await this.loadData();
    (event.target as HTMLIonRefresherElement).complete();
  }

  editAttendance(att: Attendance): void {
    this.router.navigate(['/tabs/labour/edit-attendance', att._id]);
  }
}