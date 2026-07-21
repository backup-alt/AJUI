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
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { locationOutline, peopleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';

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

@Component({
  selector: 'app-labour-create-worker',
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
    FormsModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour"></ion-back-button>
        </ion-buttons>
        <ion-title>Add Worker</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="create-content">
      <div class="form-container">
        <div class="page-header">
          <div class="page-icon">
            <ion-icon name="people-outline"></ion-icon>
          </div>
          <div>
            <h1 class="page-title">New Worker</h1>
            <p class="page-subtitle">Add a worker to track their attendance</p>
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
            <ion-label position="stacked">Worker Name *</ion-label>
            <ion-input
              placeholder="Enter worker name"
              [(ngModel)]="worker.name"
              [clearInput]="true"
            ></ion-input>
          </ion-item>

          <ion-item class="form-item form-item-last">
            <ion-label position="stacked">Address</ion-label>
            <ion-textarea
              placeholder="Enter address (optional)"
              [(ngModel)]="worker.address"
              [rows]="2"
              [autoGrow]="true"
            ></ion-textarea>
          </ion-item>

          <ion-item class="form-item">
            <ion-label position="stacked">Labour Type *</ion-label>
            <ion-select
              placeholder="Select labour type"
              [(ngModel)]="worker.labourType"
              interface="popover"
            >
              @for (type of labourTypes; track type) {
                <ion-select-option [value]="type">{{ type }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-item class="form-item">
            <ion-label position="stacked">Daily Pay (INR) *</ion-label>
            <ion-input
              type="number"
              placeholder="Enter daily pay"
              [(ngModel)]="worker.weeklyPay"
              [clearInput]="true"
            ></ion-input>
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
              Creating...
            } @else {
              Create Worker
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
      background: rgba(14, 165, 233, 0.1);
      color: #0891b2;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .page-icon ion-icon { font-size: 24px; }
    .page-title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 2px; }
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
    .site-banner-label { font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; }
    .site-banner-value { font-size: 14px; font-weight: 600; color: #111827; }
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
    .toggle-item { min-height: 72px; display: flex; align-items: center; }
    .toggle-label { font-size: 14px; font-weight: 600; color: #111827; margin: 0; }
    .subcontract-toggle {
      --track-background: #e5e7eb;
      --track-background-checked: rgba(0, 34, 99, 0.28);
      --handle-background: #ffffff;
      --handle-background-checked: #002263;
    }
    .form-actions { padding: 20px 0; }
  `],
})
export class LabourCreateWorkerPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  labourTypes = LABOUR_TYPES;

  worker = {
    name: '',
    address: '',
    labourType: '',
    weeklyPay: null as number | null,
  };

  isSubmitting = signal(false);
  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  siteProjectId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    addIcons({ locationOutline, peopleOutline, checkmarkCircleOutline });
    await this.supervisor.init();
    this.selectedSiteId.set(this.supervisor.selectedSiteId());
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    this.siteProjectId.set(this.supervisor.selectedProjectId());
  }

  isValid(): boolean {
    return !!(
      this.worker.name &&
      this.worker.labourType &&
      this.worker.weeklyPay !== null &&
      this.worker.weeklyPay > 0
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
      projectId,
      siteId,
      site: siteName,
      name: this.worker.name.trim(),
      address: this.worker.address?.trim() || undefined,
      labourType: this.worker.labourType,
      weeklyPay: Number(this.worker.weeklyPay) || 0,
    };

    this.supervisor.createWorker(payload).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: 'Worker created successfully. You can now mark attendance.',
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
        const msg =
          err?.error?.details?.fieldErrors?.weeklyPay?.[0] ||
          err?.error?.error ||
          err?.message ||
          'Failed to create worker';
        const toast = await this.toastCtrl.create({
          message: msg,
          duration: 3500,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
