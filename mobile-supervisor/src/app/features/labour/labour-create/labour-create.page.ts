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
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { locationOutline, peopleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-labour-create',
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
    IonSegment,
    IonSegmentButton,
    IonIcon,
    IonSpinner,
    FormsModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour"></ion-back-button>
        </ion-buttons>
        <ion-title>Log Attendance</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="create-content">
      <div class="form-container">
        <div class="page-header">
          <div class="page-icon">
            <ion-icon name="people-outline"></ion-icon>
          </div>
          <div>
            <h1 class="page-title">Labour Attendance</h1>
            <p class="page-subtitle">Log daily attendance for the active site</p>
          </div>
        </div>

        @if (selectedSiteName()) {
          <div class="site-banner">
            <ion-icon name="location-outline"></ion-icon>
            <div>
              <div class="site-banner-label">Site</div>
              <div class="site-banner-value">{{ selectedSiteName() }}</div>
            </div>
          </div>
        }

        <ion-list lines="none" class="form-list">
          <ion-item class="form-item">
            <ion-label position="stacked">Supervisor Name *</ion-label>
            <ion-input
              [value]="supervisorName()"
              readonly="true"
              class="readonly-input"
            ></ion-input>
          </ion-item>

          <ion-item class="form-item">
            <ion-label position="stacked">Category *</ion-label>
            <ion-input
              placeholder="e.g., Mason, Carpenter, Helper"
              [(ngModel)]="labour.category"
              [clearInput]="true"
            ></ion-input>
          </ion-item>

          <div class="form-row">
            <ion-item class="form-item form-item-half">
              <ion-label position="stacked">Present Count *</ion-label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="labour.presentCount"
                [clearInput]="true"
              ></ion-input>
            </ion-item>

            <ion-item class="form-item form-item-half">
              <ion-label position="stacked">Daily Wage *</ion-label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="labour.dailyWage"
                [clearInput]="true"
              ></ion-input>
            </ion-item>
          </div>

          <ion-item class="form-item shift-item">
            <ion-label position="stacked">Shift</ion-label>
            <ion-segment [(ngModel)]="labour.shift" mode="ios">
              <ion-segment-button value="Day">
                <ion-label>Day</ion-label>
              </ion-segment-button>
              <ion-segment-button value="Evening">
                <ion-label>Evening</ion-label>
              </ion-segment-button>
              <ion-segment-button value="Night">
                <ion-label>Night</ion-label>
              </ion-segment-button>
            </ion-segment>
          </ion-item>

          <ion-item class="form-item">
            <ion-label position="stacked">Payment Mode</ion-label>
            <ion-select
              placeholder="Select"
              [(ngModel)]="labour.paymentMode"
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
              placeholder="Additional notes..."
              [(ngModel)]="labour.notes"
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
              Submit Attendance
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
      background: rgba(13, 202, 240, 0.1);
      color: #0891b2;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .page-icon ion-icon { font-size: 24px; }
    .page-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 2px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .page-subtitle { font-size: 12px; color: #6b7280; margin: 0; }
    .site-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-left: 3px solid #c9a227;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .site-banner ion-icon { font-size: 18px; color: #c9a227; }
    .site-banner-label {
      font-size: 10px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .site-banner-value { font-size: 14px; font-weight: 600; color: #111827; }
    .form-list { background: transparent; padding: 0; }
    .form-item {
      --background: #ffffff;
      --border-radius: 0 !important;
      --inner-border-radius: 0 !important;
      --padding-start: 14px;
      --padding-end: 14px;
      --min-height: 64px;
      border: 1px solid #e5e7eb;
      border-bottom: none;
      margin-bottom: 0;
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
    .readonly-input { --color: #111827; font-weight: 600; opacity: 1; }
  `],
})
export class LabourCreatePage implements OnInit {
  private supervisor = inject(SupervisorService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  labour = {
    partyName: '',
    category: '',
    presentCount: null as number | null,
    presentDays: 1,
    absentDays: 0,
    dailyWage: null as number | null,
    overtime: 0,
    lateFine: 0,
    shift: 'Day' as 'Day' | 'Night' | 'Evening',
    paymentMode: 'Cash' as 'Cash' | 'NEFT' | 'UPI' | 'Cheque',
    notes: '',
  };

  isSubmitting = signal(false);
  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  siteProjectId = signal<string | null>(null);
  supervisorName = signal<string>('');

  async ngOnInit(): Promise<void> {
    addIcons({ locationOutline, peopleOutline, checkmarkCircleOutline });
    await this.auth.init();
    await this.supervisor.init();
    this.selectedSiteId.set(this.supervisor.selectedSiteId());
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    this.siteProjectId.set(this.supervisor.selectedProjectId());
    const user = this.auth.currentUser();
    const name = user?.name?.trim() || '';
    this.supervisorName.set(name);
    this.labour.partyName = name;
  }

  isValid(): boolean {
    return !!(
      this.labour.partyName &&
      this.labour.category &&
      this.labour.presentCount &&
      this.labour.dailyWage
    );
  }

  async submit(): Promise<void> {
    if (!this.isValid()) return;

    const siteId = this.selectedSiteId();
    const siteName = this.selectedSiteName();
    const projectId = this.siteProjectId();

    if (!siteId || !siteName) {
      const toast = await this.toastCtrl.create({
        message: 'Please select a site first',
        duration: 2500,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    if (!projectId) {
      const toast = await this.toastCtrl.create({
        message: 'Project for this site is not set. Please contact admin.',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      projectId,
      siteId,
      site: siteName,
      partyName: this.labour.partyName,
      category: this.labour.category,
      attendanceDate: new Date().toISOString().slice(0, 10),
      presentCount: this.labour.presentCount || 0,
      presentDays: this.labour.presentDays,
      absentDays: this.labour.absentDays,
      dailyWage: this.labour.dailyWage || 0,
      overtime: this.labour.overtime,
      lateFine: this.labour.lateFine,
      shift: this.labour.shift,
      paymentMode: this.labour.paymentMode,
      notes: this.labour.notes || undefined,
      laborTypes: [],
    };

    this.supervisor.createLabour(payload).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: 'Attendance submitted successfully',
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
          message: err?.message || 'Failed to submit attendance',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
