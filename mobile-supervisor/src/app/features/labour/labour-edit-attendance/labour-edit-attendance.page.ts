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
import { locationOutline, peopleOutline, checkmarkCircleOutline, timeOutline, createOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Worker, Attendance, LabourPaymentMode } from '../../../shared/models';
import { CurrencyPipe } from '@angular/common';
import { EmptyStateComponent } from '../../../shared/components';

@Component({
  selector: 'app-labour-edit-attendance',
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
    EmptyStateComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour"></ion-back-button>
        </ion-buttons>
        <ion-title>Edit Attendance</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="create-content">
      <div class="form-container">
        <div class="page-header">
          <div class="page-icon">
            <ion-icon name="create-outline"></ion-icon>
          </div>
          <div>
            <h1 class="page-title">Edit Attendance</h1>
            <p class="page-subtitle">Update attendance record</p>
          </div>
        </div>

        @if (isLoading()) {
          <div class="loading-state">
            <ion-spinner name="crescent"></ion-spinner>
            <p>Loading attendance...</p>
          </div>
        } @else if (attendance()) {
          <div class="worker-banner">
            <div class="worker-info">
              <span class="worker-name">{{ attendance()!.workerName }}</span>
              <span class="worker-type">{{ attendance()!.labourType }}</span>
            </div>
            <div class="attendance-date">
              <span class="date-label">{{ attendance()!.attendanceDate }}</span>
            </div>
          </div>

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
                Updating...
              } @else {
                Update Attendance
              }
            </ion-button>

            <ion-button
              expand="block"
              color="danger"
              fill="outline"
              [disabled]="isDeleting()"
              (click)="deleteAttendance()"
            >
              @if (isDeleting()) {
                <ion-spinner name="crescent" slot="start"></ion-spinner>
                Deleting...
              } @else {
                Delete Attendance
              }
            </ion-button>
          </div>
        } @else {
          <app-empty-state
            icon="alert-circle-outline"
            title="Attendance not found"
            message="This attendance record could not be loaded."
          ></app-empty-state>
        }
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
      background: rgba(59, 130, 246, 0.1);
      color: #2563eb;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .page-icon ion-icon { font-size: 24px; }
    .page-title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 2px; }
    .page-subtitle { font-size: 12px; color: #6b7280; margin: 0; }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 0;
      color: #6b7280;
    }
    .loading-state p { margin-top: 12px; }
    .worker-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-left: 3px solid #3b82f6;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .worker-info { display: flex; flex-direction: column; gap: 2px; }
    .worker-name { font-size: 15px; font-weight: 700; color: #111827; }
    .worker-type { font-size: 12px; color: #64748b; }
    .attendance-date { text-align: right; }
    .date-label { font-size: 13px; font-weight: 600; color: #374151; }
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
    .form-actions { padding: 20px 0; display: flex; flex-direction: column; gap: 12px; }
  `],
})
export class LabourEditAttendancePage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastCtrl = inject(ToastController);

  attendance = signal<Attendance | null>(null);
  worker = signal<Worker | null>(null);

  attendanceId = '';
  attendanceDate = '';
  shiftCount = 1;
  overtimeHours = 0;
  overtimeAmount = 0;
  lateFine = 0;
  paymentMode: LabourPaymentMode = 'Cash';
  notes = '';

  isLoading = signal(true);
  isSubmitting = signal(false);
  isDeleting = signal(false);

  async ngOnInit(): Promise<void> {
    addIcons({ locationOutline, peopleOutline, checkmarkCircleOutline, timeOutline, createOutline });
    await this.supervisor.init();

    this.attendanceId = this.route.snapshot.paramMap.get('id') || '';
    if (this.attendanceId) {
      await this.loadAttendance();
    } else {
      this.isLoading.set(false);
    }
  }

  async loadAttendance(): Promise<void> {
    this.supervisor.getAttendanceDetail(this.attendanceId).subscribe({
      next: (res) => {
        const att = res.attendance;
        this.attendance.set(att);
        this.attendanceDate = att.attendanceDate;
        this.shiftCount = att.shiftCount;
        this.overtimeHours = att.overtimeHours;
        this.overtimeAmount = att.overtimeAmount;
        this.lateFine = att.lateFine;
        this.paymentMode = att.paymentMode;
        this.notes = att.notes || '';
        this.isLoading.set(false);

        if (att.workerId) {
          this.loadWorker(att.workerId);
        }
      },
      error: (err) => {
        console.error('[EditAttendance] failed to load attendance', err);
        this.isLoading.set(false);
      },
    });
  }

  loadWorker(workerId: string): void {
    this.supervisor.getWorkerDetail(workerId).subscribe({
      next: (res) => this.worker.set(res.worker),
      error: (err) => {
        console.error('[EditAttendance] failed to load worker', err);
      },
    });
  }

  isValid(): boolean {
    return !!(
      this.attendanceId &&
      this.attendanceDate &&
      this.shiftCount &&
      (this.shiftCount === 1 || this.shiftCount === 2)
    );
  }

  async submit(): Promise<void> {
    if (!this.isValid()) return;

    this.isSubmitting.set(true);

    const patch = {
      attendanceDate: this.attendanceDate,
      shiftCount: Number(this.shiftCount),
      overtimeHours: Number(this.overtimeHours),
      overtimeAmount: Number(this.overtimeAmount),
      lateFine: Number(this.lateFine),
      paymentMode: this.paymentMode,
      notes: this.notes || undefined,
    };

    this.supervisor.updateAttendance(this.attendanceId, patch).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: 'Attendance updated successfully',
          duration: 2500,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        this.router.navigate(['/tabs/labour']);
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to update attendance',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }

  async deleteAttendance(): Promise<void> {
    const confirmDelete = window.confirm('Are you sure you want to delete this attendance record?');
    if (!confirmDelete) return;

    this.isDeleting.set(true);

    this.supervisor.deleteAttendance(this.attendanceId).subscribe({
      next: async () => {
        this.isDeleting.set(false);
        const toast = await this.toastCtrl.create({
          message: 'Attendance deleted successfully',
          duration: 2500,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        this.router.navigate(['/tabs/labour']);
      },
      error: async (err) => {
        this.isDeleting.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to delete attendance',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}