import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonIcon,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import { locationOutline, peopleOutline, checkmarkCircleOutline, timeOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Worker, LabourPaymentMode } from '../../../shared/models';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-labour-mark-attendance',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonIcon,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    FormsModule,
    CurrencyPipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour"></ion-back-button>
        </ion-buttons>
        <ion-title>Mark Attendance</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="create-content">
      <div class="form-container">
        <div class="page-header">
          <div class="page-icon">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </div>
          <div>
            <h1 class="page-title">Mark Attendance</h1>
            <p class="page-subtitle">Record today's attendance for the worker</p>
          </div>
        </div>

        @if (worker()) {
          <div class="worker-banner">
            <div class="worker-info">
              <span class="worker-name">{{ worker()!.name }}</span>
              <span class="worker-type">{{ worker()!.labourType }}</span>
            </div>
            <div class="worker-pay">
              <span class="pay-label">Weekly Pay</span>
              <span class="pay-value">{{ worker()!.weeklyPay | currency:'INR':'symbol':'1.0-0' }}</span>
            </div>
          </div>
        }

        <ion-list lines="none" class="form-list">
          <ion-item class="form-item">
            <ion-label position="stacked">Date *</ion-label>
            <ion-input
              type="date"
              [(ngModel)]="attendanceDate"
            ></ion-input>
          </ion-item>

          <ion-item class="form-item shift-item">
            <ion-label position="stacked">Shift Count *</ion-label>
            <ion-segment [(ngModel)]="shiftCount" mode="ios">
              <ion-segment-button value="1">
                <ion-label>1 Shift</ion-label>
              </ion-segment-button>
              <ion-segment-button value="2">
                <ion-label>2 Shifts</ion-label>
              </ion-segment-button>
            </ion-segment>
          </ion-item>

          <div class="form-row">
            <ion-item class="form-item form-item-half">
              <ion-label position="stacked">Overtime Hours</ion-label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="overtimeHours"
                [clearInput]="true"
              ></ion-input>
            </ion-item>

            <ion-item class="form-item form-item-half">
              <ion-label position="stacked">Overtime Amount (INR)</ion-label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="overtimeAmount"
                [clearInput]="true"
              ></ion-input>
            </ion-item>
          </div>

          <ion-item class="form-item">
            <ion-label position="stacked">Late Fine (INR)</ion-label>
            <ion-input
              type="number"
              placeholder="0"
              [(ngModel)]="lateFine"
              [clearInput]="true"
            ></ion-input>
          </ion-item>

          <ion-item class="form-item">
            <ion-label position="stacked">Payment Mode</ion-label>
            <ion-select
              placeholder="Select"
              [(ngModel)]="paymentMode"
              interface="popover"
            >
              <ion-select-option value="Cash">Cash</ion-select-option>
              <ion-select-option value="NEFT">NEFT</ion-select-option>
              <ion-select-option value="UPI">UPI</ion-select-option>
              <ion-select-option value="Cheque">Cheque</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item class="form-item form-item-last">
            <ion-label position="stacked">Notes</ion-label>
            <ion-textarea
              placeholder="Additional notes (optional)"
              [(ngModel)]="notes"
              [rows]="3"
              [autoGrow]="true"
            ></ion-textarea>
          </ion-item>
        </ion-list>

        <div class="form-actions">
          <ion-button
            expand="block"
            [disabled]="!isValid() || isSubmitting()"
            (click)="submit()"
          >
            @if (isSubmitting()) {
              <ion-spinner name="crescent" slot="start"></ion-spinner>
              Submitting...
            } @else {
              Mark Present
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .create-content { --background: #f5f6f8; }
    .form-container { padding: 16px; }
    .page-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .page-icon {
      width: 48px;
      height: 48px;
      background: rgba(34, 197, 94, 0.1);
      color: #15803d;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .page-icon ion-icon { font-size: 24px; }
    .page-title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 2px; }
    .page-subtitle { font-size: 12px; color: #6b7280; margin: 0; }
    .worker-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-left: 3px solid #22c55e;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .worker-info { display: flex; flex-direction: column; gap: 2px; }
    .worker-name { font-size: 15px; font-weight: 700; color: #111827; }
    .worker-type { font-size: 12px; color: #64748b; }
    .worker-pay { text-align: right; }
    .pay-label { display: block; font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; }
    .pay-value { display: block; font-size: 14px; font-weight: 700; color: #111827; }
    .form-list { background: transparent; }
    .form-item {
      --background: #ffffff;
      --border-radius: 0 !important;
      --inner-border-radius: 0 !important;
      --padding-start: 14px;
      --padding-end: 14px;
      --min-height: 64px;
      border: 1px solid #e5e7eb;
      border-bottom: none;
    }
    .form-item.form-item-last { border-bottom: 1px solid #e5e7eb; }
    .form-item-half { width: 100%; }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 0;
    }
    .form-row .form-item { border-right: 1px solid #e5e7eb; }
    .form-row .form-item:last-of-type { border-right: none; }
    .shift-item { min-height: 80px; }
    .form-actions { padding: 20px 0; }
  `],
})
export class LabourMarkAttendancePage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastCtrl = inject(ToastController);

  worker = signal<Worker | null>(null);

  workerId = '';
  attendanceDate = new Date().toISOString().slice(0, 10);
  shiftCount = 1;
  overtimeHours = 0;
  overtimeAmount = 0;
  lateFine = 0;
  paymentMode: LabourPaymentMode = 'Cash';
  notes = '';

  isSubmitting = signal(false);
  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  siteProjectId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    addIcons({ locationOutline, peopleOutline, checkmarkCircleOutline, timeOutline });
    await this.supervisor.init();
    this.selectedSiteId.set(this.supervisor.selectedSiteId());
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    this.siteProjectId.set(this.supervisor.selectedProjectId());

    this.workerId = this.route.snapshot.paramMap.get('workerId') || '';
    if (this.workerId) {
      this.loadWorker();
    }
  }

  async loadWorker(): Promise<void> {
    this.supervisor.getWorkerDetail(this.workerId).subscribe({
      next: (res) => this.worker.set(res.worker),
      error: (err) => {
        console.error('[MarkAttendance] failed to load worker', err);
      },
    });
  }

  isValid(): boolean {
    const sc = Number(this.shiftCount);
    return !!(
      this.workerId &&
      this.attendanceDate &&
      sc >= 1 &&
      sc <= 2
    );
  }

  async submit(): Promise<void> {
    if (!this.isValid()) return;

    const siteId = this.selectedSiteId();
    const siteName = this.selectedSiteName();
    const projectId = this.siteProjectId();

    if (!siteId || !siteName || !projectId) {
      const toast = await this.toastCtrl.create({
        message: 'Please select a site first',
        duration: 2500,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      workerId: this.workerId,
      projectId,
      siteId,
      site: siteName,
      attendanceDate: this.attendanceDate,
      shiftCount: Number(this.shiftCount),
      overtimeHours: Number(this.overtimeHours),
      overtimeAmount: Number(this.overtimeAmount),
      lateFine: Number(this.lateFine),
      paymentMode: this.paymentMode,
      notes: this.notes || undefined,
    };

    this.supervisor.markAttendance(payload).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: 'Attendance marked successfully',
          duration: 2500,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agb:labour-changed'));
        }
        this.router.navigate(['/tabs/labour']);
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.error?.error || err?.message || 'Failed to mark attendance',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}