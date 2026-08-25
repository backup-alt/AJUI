import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonBackButton, IonButtons, IonButton,
  IonIcon, IonSpinner, IonInput, IonItem, IonLabel,
  IonList, IonTextarea, IonRefresher, IonRefresherContent,
  ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  locationOutline, peopleOutline, businessOutline, checkmarkCircleOutline,
  addOutline, removeOutline, trashOutline, alertCircleOutline, timeOutline,
  calendarOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { ApiService } from '../../core/services/api.service';
import {
  Subcontractor, SubcontractorAttendance, SubcontractorAttendanceEntry,
} from '../../shared/models';
import { DatePipe } from '@angular/common';

// Fixed catalogue the supervisor can pick from. Mirrors the labour-type
// list used by the worker flow so the count chips stay consistent
// across the web + mobile UI.
const LABOUR_TYPES = [
  'Helper',
  'Mason',
  'Plumber',
  'Electrician',
  'Carpenter',
  'Painter',
  'Civil',
  'Tiles Worker',
  'Steel Fixer',
  'Welder',
  'Fabricator',
  'Other',
];

interface DraftEntry {
  labourType: string;
  count: number;
}

@Component({
  selector: 'app-attendance-mark-bulk',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons,
    IonButton, IonIcon, IonSpinner, IonInput, IonItem, IonLabel, IonList,
    IonTextarea, IonRefresher, IonRefresherContent, FormsModule, DatePipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour"></ion-back-button>
        </ion-buttons>
        <ion-title>Mark Attendance</ion-title>
        @if (existingAttendanceId()) {
          <ion-buttons slot="end">
            <ion-button (click)="confirmDelete()">
              <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
            </ion-button>
          </ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="create-content">
      <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="form-container">
        @if (subcontractor()) {
          <div class="sub-banner">
            <div class="sub-banner-icon">
              <ion-icon name="business-outline"></ion-icon>
            </div>
            <div class="sub-banner-info">
              <span class="sub-banner-label">Sub-contractor</span>
              <span class="sub-banner-value">{{ subcontractor()!.subcontractorName }}</span>
            </div>
          </div>
        }

        <div class="date-card">
          <ion-icon name="calendar-outline"></ion-icon>
          <div>
            <div class="date-label">Date</div>
            <div class="date-value">{{ attendanceDate | date:'EEEE, MMM d, y' }}</div>
          </div>
        </div>

        <div class="section-head">
          <h2>Workforce Count</h2>
          <p>Enter the number of workers on site by type. Leave at 0 to skip.</p>
        </div>

        <div class="count-grid">
          @for (type of labourTypes; track type) {
            <div class="count-card" [class.has-value]="getCount(type) > 0">
              <div class="count-card-head">
                <span class="count-type">{{ type }}</span>
                <span class="count-num-badge">{{ getCount(type) }}</span>
              </div>
              <div class="count-stepper">
                <button
                  type="button"
                  class="step-btn minus"
                  [disabled]="getCount(type) === 0"
                  (click)="adjust(type, -1)"
                >
                  <ion-icon name="remove-outline"></ion-icon>
                </button>
                <input
                  type="number"
                  class="step-input"
                  [value]="getCount(type)"
                  (input)="onCountInput(type, $event)"
                  min="0"
                  max="1000"
                  inputmode="numeric"
                />
                <button
                  type="button"
                  class="step-btn plus"
                  (click)="adjust(type, 1)"
                >
                  <ion-icon name="add-outline"></ion-icon>
                </button>
              </div>
            </div>
          }
        </div>

        <div class="summary">
          <div class="summary-row">
            <span>Total workers</span>
            <strong>{{ totalCount() }}</strong>
          </div>
          <div class="summary-row" *ngIf="draftEntries().length > 0">
            <span>Breakdown</span>
            <span class="breakdown">{{ summaryLine() }}</span>
          </div>
        </div>

        <div class="section-head">
          <h2>Shift & Overtime</h2>
          <p>Track shift count and overtime hours for payroll.</p>
        </div>

        <div class="shift-overtime-grid">
          <div class="input-card">
            <ion-label>Number of Shifts</ion-label>
            <div class="input-stepper">
              <button
                type="button"
                class="step-btn"
                [disabled]="shifts <= 1"
                (click)="adjustShifts(-1)"
              >
                <ion-icon name="remove-outline"></ion-icon>
              </button>
              <input
                type="number"
                class="step-input"
                [(ngModel)]="shifts"
                (input)="validateShifts($event)"
                min="1"
                max="2"
                inputmode="numeric"
              />
              <button
                type="button"
                class="step-btn"
                [disabled]="shifts >= 2"
                (click)="adjustShifts(1)"
              >
                <ion-icon name="add-outline"></ion-icon>
              </button>
            </div>
            <div class="input-hint">1 = Half day, 2 = Full day</div>
          </div>
        </div>

        <ion-list lines="none" class="form-list">
          <ion-item class="form-item form-item-last">
            <ion-label position="stacked">Notes (optional)</ion-label>
            <ion-textarea
              placeholder="Add a note for the office..."
              [(ngModel)]="notes"
              [rows]="2"
              [autoGrow]="true"
            ></ion-textarea>
          </ion-item>
        </ion-list>

        @if (errorMessage()) {
          <p class="form-error">{{ errorMessage() }}</p>
        }

        <div class="form-actions">
          <ion-button
            expand="block"
            [disabled]="isSubmitting()"
            (click)="submit()"
          >
            @if (isSubmitting()) {
              <ion-spinner name="crescent" slot="start"></ion-spinner>
              Saving...
            } @else if (existingAttendanceId()) {
              <ion-icon slot="start" name="checkmark-circle-outline"></ion-icon>
              Update Muster
            } @else {
              <ion-icon slot="start" name="checkmark-circle-outline"></ion-icon>
              Save Muster
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .create-content { --background: #f5f6f8; }
    .form-container { padding: 16px; }

    .sub-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-left: 3px solid #002263;
      padding: 12px 14px;
      margin-bottom: 12px;
    }
    .sub-banner-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(0, 34, 99, 0.1);
      color: #002263;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sub-banner-icon ion-icon { font-size: 20px; }
    .sub-banner-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .sub-banner-label {
      font-size: 10px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
    }
    .sub-banner-value {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .date-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      padding: 10px 14px;
      margin-bottom: 16px;
      border-radius: 8px;
    }
    .date-card ion-icon { font-size: 18px; color: #6b7280; }
    .date-label { font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; }
    .date-value { font-size: 13px; font-weight: 700; color: #111827; }

    .section-head { margin: 0 0 10px; }
    .section-head h2 {
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin: 0 0 2px;
    }
    .section-head p { font-size: 12px; color: #94a3b8; margin: 0; }

    .count-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    @media (min-width: 480px) {
      .count-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    .count-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .count-card.has-value {
      border-color: #22c55e;
      box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.18);
    }
    .count-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .count-type {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
    }
    .count-num-badge {
      font-size: 12px;
      font-weight: 800;
      color: #15803d;
      background: rgba(34, 197, 94, 0.12);
      padding: 1px 7px;
      border-radius: 10px;
      min-width: 22px;
      text-align: center;
    }
    .count-stepper {
      display: flex;
      align-items: stretch;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
      background: #f9fafb;
    }
    .step-btn {
      background: transparent;
      border: 0;
      padding: 6px 8px;
      cursor: pointer;
      color: #475569;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
    }
    .step-btn:active { background: rgba(0,0,0,0.04); }
    .step-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .step-btn ion-icon { font-size: 16px; }
    .step-input {
      flex: 1;
      min-width: 0;
      text-align: center;
      border: 0;
      background: transparent;
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      font-family: inherit;
      padding: 4px 0;
      -moz-appearance: textfield;
    }
    .step-input::-webkit-outer-spin-button,
    .step-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .step-input:focus { outline: none; }

    .summary {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: #475569;
    }
    .summary-row + .summary-row { margin-top: 6px; }
    .summary-row strong { color: #111827; font-size: 16px; font-weight: 800; }
    .summary-row .breakdown {
      font-size: 12px;
      color: #111827;
      text-align: right;
      max-width: 65%;
      line-height: 1.3;
    }

    .shift-overtime-grid {
      display: block;
      margin-bottom: 16px;
    }
    .input-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .input-card ion-label {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      margin: 0;
    }
    .input-stepper {
      display: flex;
      align-items: stretch;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
      background: #f9fafb;
    }
    .input-hint {
      font-size: 10px;
      color: #94a3b8;
      line-height: 1.3;
    }

    .form-list { background: transparent; padding: 0; margin-bottom: 4px; }
    .form-item {
      --background: #ffffff;
      --border-radius: 8px !important;
      --inner-border-radius: 8px !important;
      --padding-start: 14px;
      --padding-end: 14px;
      --min-height: 64px;
      border: 1px solid #e5e7eb;
      overflow: visible;
    }
    .form-item ion-textarea {
      --background: transparent !important;
      --border-radius: 0 !important;
      --inner-border-radius: 0 !important;
      --border-width: 0 !important;
      --padding-start: 0 !important;
      --padding-end: 0 !important;
      --padding-top: 0 !important;
      --padding-bottom: 0 !important;
    }

    .form-error { color: #b91c1c; font-size: 13px; padding: 8px 0; margin: 0; }
    .form-actions { padding: 20px 0; }
  `],
})
export class AttendanceMarkBulkPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  labourTypes = LABOUR_TYPES;

  subcontractor = signal<Subcontractor | null>(null);
  existingAttendanceId = signal<string | null>(null);
  draftEntries = signal<DraftEntry[]>([]);
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  attendanceDate = new Date().toISOString().slice(0, 10);
  notes = '';
  shifts = 2;

  subcontractorId = '';

  totalCount = computed(() =>
    this.draftEntries().reduce((sum, e) => sum + (Number(e.count) || 0), 0)
  );

  summaryLine = computed(() => {
    const items = this.draftEntries()
      .filter((e) => e.count > 0)
      .map((e) => `${e.count} ${e.labourType}`);
    if (items.length === 0) return '—';
    if (items.length <= 3) return items.join(', ');
    return `${items.slice(0, 3).join(', ')} +${items.length - 3} more`;
  });

  async ngOnInit(): Promise<void> {
    addIcons({
      locationOutline, peopleOutline, businessOutline, checkmarkCircleOutline,
      addOutline, removeOutline, trashOutline, alertCircleOutline,
      timeOutline, calendarOutline,
    });
    await this.supervisor.init().catch(() => {});

    this.subcontractorId = this.route.snapshot.paramMap.get('subcontractorId') || '';
    if (!this.subcontractorId) {
      void this.router.navigate(['/tabs/labour']);
      return;
    }
    await this.loadSubcontractor();
    await this.loadExisting();
  }

  private async loadSubcontractor(): Promise<void> {
    try {
      // Reuse the existing list call (same 500-row window the attendance
      // page shows). Bypassing the GET cache so renames or newly-added
      // sub-contractors show up immediately.
      this.api.invalidateGetCache('/supervisor/subcontractors');
      const res = await firstValueFrom(this.supervisor.getSubcontractors());
      const match = (res?.subcontractors || []).find((s) => s._id === this.subcontractorId);
      this.subcontractor.set(match || null);
    } catch (err) {
      console.error('[AttendanceMarkBulk] failed to load subcontractor', err);
      this.subcontractor.set(null);
    }
  }

  private async loadExisting(): Promise<void> {
    try {
      this.api.invalidateGetCache('/supervisor/bulk-attendance');
      const res = await firstValueFrom(
        this.supervisor.getBulkAttendanceForDate(this.attendanceDate)
      );
      const existing = (res?.attendances || []).find(
        (a) => String(a.subcontractorId) === this.subcontractorId
      );
      if (existing) {
        this.existingAttendanceId.set(existing._id);
        this.notes = existing.notes || '';
        this.shifts = existing.shifts ?? 2;
        this.draftEntries.set(
          existing.entries.map((e) => ({ labourType: e.labourType, count: e.count }))
        );
      } else {
        this.existingAttendanceId.set(null);
        this.notes = '';
        this.shifts = 2;
        this.draftEntries.set([]);
      }
    } catch (err) {
      console.error('[AttendanceMarkBulk] failed to load existing attendance', err);
    }
  }

  getCount(type: string): number {
    return this.draftEntries().find((e) => e.labourType === type)?.count ?? 0;
  }

  adjust(type: string, delta: number): void {
    const list = [...this.draftEntries()];
    const idx = list.findIndex((e) => e.labourType === type);
    const current = idx >= 0 ? list[idx].count : 0;
    const next = Math.max(0, Math.min(1000, current + delta));
    if (next === 0 && current === 0) return;
    if (idx >= 0) {
      if (next === 0) list.splice(idx, 1);
      else list[idx] = { labourType: type, count: next };
    } else if (next > 0) {
      list.push({ labourType: type, count: next });
    }
    this.draftEntries.set(list);
  }

  onCountInput(type: string, event: Event): void {
    const value = Math.max(0, Math.min(1000, Math.floor(Number((event.target as HTMLInputElement).value) || 0)));
    const list = [...this.draftEntries()];
    const idx = list.findIndex((e) => e.labourType === type);
    if (idx >= 0) {
      if (value === 0) list.splice(idx, 1);
      else list[idx] = { labourType: type, count: value };
    } else if (value > 0) {
      list.push({ labourType: type, count: value });
    }
    this.draftEntries.set(list);
  }

  adjustShifts(delta: number): void {
    this.shifts = Math.max(1, Math.min(2, this.shifts + delta));
  }

  validateShifts(event: Event): void {
    const value = Math.max(1, Math.min(2, Math.floor(Number((event.target as HTMLInputElement).value) || 1)));
    this.shifts = value;
  }

  async handleRefresh(event: CustomEvent): Promise<void> {
    await this.loadSubcontractor();
    await this.loadExisting();
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }

  isValid(): boolean {
    if (!this.subcontractorId) return false;
    return this.draftEntries().some((e) => e.count > 0);
  }

  async submit(): Promise<void> {
    if (!this.isValid()) {
      this.errorMessage.set('Enter at least one worker count before saving.');
      return;
    }
    this.errorMessage.set(null);

    const projectId = this.supervisor.selectedProjectId() || undefined;
    const siteId = this.supervisor.selectedSiteId() || undefined;
    const siteName = this.supervisor.selectedSiteName() || undefined;

    if (!projectId) {
      const toast = await this.toastCtrl.create({
        message: 'Please select a project first',
        duration: 2500,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    this.isSubmitting.set(true);

    const entries: SubcontractorAttendanceEntry[] = this.draftEntries()
      .filter((e) => e.count > 0)
      .map((e) => ({ labourType: e.labourType, count: e.count }));

    const payload = {
      subcontractorId: this.subcontractorId,
      projectId,
      siteId,
      siteName,
      attendanceDate: this.attendanceDate,
      entries,
      shifts: this.shifts,
      notes: this.notes?.trim() || undefined,
    };

    this.supervisor.markBulkAttendance(payload).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: this.existingAttendanceId()
            ? 'Attendance updated'
            : 'Attendance saved',
          duration: 2000,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agb:attendance-changed'));
        }
        this.router.navigate(['/tabs/labour']);
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.error || err?.message || 'Failed to save attendance';
        this.errorMessage.set(msg);
        const toast = await this.toastCtrl.create({
          message: msg,
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }

  async confirmDelete(): Promise<void> {
    const id = this.existingAttendanceId();
    if (!id) return;
    const alert = await this.alertCtrl.create({
      header: 'Delete muster?',
      message: 'This will remove today\'s attendance for this sub-contractor. You can re-enter it after.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => void this.deleteAttendance(),
        },
      ],
    });
    await alert.present();
  }

  private async deleteAttendance(): Promise<void> {
    const id = this.existingAttendanceId();
    if (!id) return;
    this.isSubmitting.set(true);
    this.supervisor.deleteBulkAttendance(id).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agb:attendance-changed'));
        }
        this.router.navigate(['/tabs/labour']);
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.error || err?.message || 'Failed to delete';
        const toast = await this.toastCtrl.create({
          message: msg,
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
