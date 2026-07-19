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
  IonToggle,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { locationOutline, peopleOutline, checkmarkCircleOutline, businessOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Subcontractor } from '../../../shared/models';

const LABOUR_TYPES = ['Helper', 'Mason', 'Plumber', 'Electrician', 'Carpenter', 'Civil'];

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
    IonToggle,
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

          <ion-item class="form-item">
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
            <ion-label position="stacked">Weekly Pay (INR) *</ion-label>
            <ion-input
              type="number"
              placeholder="Enter weekly pay"
              [(ngModel)]="worker.weeklyPay"
              [clearInput]="true"
            ></ion-input>
          </ion-item>

          <ion-item class="form-item toggle-item">
            <div class="toggle-row">
              <ion-label position="stacked">From Subcontractor?</ion-label>
              <ion-toggle
                [(ngModel)]="worker.isSubcontract"
                (ionChange)="onSubcontractToggle()"
              ></ion-toggle>
            </div>
          </ion-item>

          @if (worker.isSubcontract) {
            <ion-item class="form-item form-item-last">
              <ion-label position="stacked">Select Subcontractor *</ion-label>
              <ion-select
                placeholder="Choose subcontractor"
                [(ngModel)]="worker.subcontractorId"
                interface="popover"
              >
                @for (sub of subcontractors(); track sub.subcontractorId) {
                  <ion-select-option [value]="sub.subcontractorId">
                    {{ sub.subcontractorName }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          }
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
    .toggle-item { min-height: 72px; }
    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }
    .toggle-row ion-label { position: static !important; }
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
    isSubcontract: false,
    subcontractorId: '',
    subcontractorName: '',
  };

  subcontractors = signal<Subcontractor[]>([]);
  isSubmitting = signal(false);
  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  siteProjectId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    addIcons({ locationOutline, peopleOutline, checkmarkCircleOutline, businessOutline });
    await this.supervisor.init();
    this.selectedSiteId.set(this.supervisor.selectedSiteId());
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    this.siteProjectId.set(this.supervisor.selectedProjectId());
  }

  onSubcontractToggle(): void {
    if (this.worker.isSubcontract) {
      void this.loadSubcontractors();
    } else {
      this.worker.subcontractorId = '';
      this.worker.subcontractorName = '';
    }
  }

  async loadSubcontractors(): Promise<void> {
    const projectId = this.siteProjectId();
    const siteId = this.selectedSiteId();
    if (!projectId) return;

    this.supervisor.getSubcontractors(projectId, siteId || undefined).subscribe({
      next: (res) => this.subcontractors.set(res.subcontractors || []),
      error: (err) => console.error('[CreateWorker] failed to load subcontractors', err),
    });
  }

  isValid(): boolean {
    return !!(
      this.worker.name &&
      this.worker.labourType &&
      this.worker.weeklyPay !== null &&
      this.worker.weeklyPay > 0 &&
      (!this.worker.isSubcontract || this.worker.subcontractorId)
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

    const selectedSub = this.subcontractors().find(
      (s) => s.subcontractorId === this.worker.subcontractorId
    );

    this.isSubmitting.set(true);

    const payload = {
      projectId,
      siteId,
      site: siteName,
      name: this.worker.name,
      address: this.worker.address || undefined,
      labourType: this.worker.labourType,
      weeklyPay: this.worker.weeklyPay || 0,
      isSubcontract: this.worker.isSubcontract,
      subcontractorId: this.worker.subcontractorId || undefined,
      subcontractorName: selectedSub?.subcontractorName || undefined,
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
        this.router.navigate(['/tabs/labour']);
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to create worker',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}