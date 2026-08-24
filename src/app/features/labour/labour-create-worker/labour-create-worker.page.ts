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
  IonRefresher,
  IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { locationOutline, peopleOutline, businessOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { ApiService } from '../../../core/services/api.service';
import type { Subcontractor } from '../../../shared/models/labour.model';

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
    IonRefresher,
    IonRefresherContent,
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
      <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
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

      @if (selectedProjectName()) {
          <div class="site-banner">
            <ion-icon name="location-outline"></ion-icon>
            <div>
            <div class="site-banner-label">Project</div>
            <div class="site-banner-value">{{ selectedProjectName() }}</div>
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
            <ion-label position="stacked">Sub-contractor *</ion-label>
            <ion-select
              placeholder="Select sub-contractor"
              [(ngModel)]="worker.subcontractorId"
              interface="popover"
              (ionChange)="onSubcontractorChange()"
              [disabled]="loadingSubcontractors()"
              class="full-width-select"
            >
              @for (sub of subcontractors(); track sub._id) {
                <ion-select-option [value]="sub._id">
                  {{ sub.subcontractorName }}{{ sub.phone ? ' · ' + sub.phone : '' }}
                </ion-select-option>
              }
            </ion-select>
            @if (loadingSubcontractors()) {
              <ion-spinner name="dots" slot="end"></ion-spinner>
            }
          </ion-item>
          @if (!loadingSubcontractors() && subcontractors().length === 0) {
            <p class="empty-hint">No sub-contractors on file. Add one from the web app first.</p>
          }

          <ion-item class="form-item form-item-last">
            <ion-label position="stacked">Labour Type *</ion-label>
            <ion-select
              placeholder="Select labour type"
              [(ngModel)]="worker.labourType"
              interface="popover"
              class="full-width-select"
            >
              @for (type of labourTypes; track type) {
                <ion-select-option [value]="type">{{ type }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        </ion-list>

        @if (errorMessage()) {
          <p class="form-error">{{ errorMessage() }}</p>
        }

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
    .form-list { background: transparent; padding: 0; }
    .form-item {
      --background: #ffffff;
      --border-radius: 8px !important;
      --inner-border-radius: 8px !important;
      --padding-start: 14px;
      --padding-end: 14px;
      --min-height: 64px;
      border: 1px solid #e5e7eb;
      margin-bottom: 12px;
      overflow: visible;
    }
    .form-item.form-item-last { margin-bottom: 0; }
    /* Reset the inner ion-input / ion-textarea / ion-select chrome so the
       form-item border defines the visual container. */
    .form-item ion-input,
    .form-item ion-textarea,
    .form-item ion-select {
      --background: transparent !important;
      --border-radius: 0 !important;
      --inner-border-radius: 0 !important;
      --border-width: 0 !important;
      --border-color: transparent !important;
      --padding-start: 0 !important;
      --padding-end: 0 !important;
      --padding-top: 0 !important;
      --padding-bottom: 0 !important;
      --min-height: 0 !important;
      min-height: 0 !important;
      align-self: stretch;
      width: 100%;
    }
    .full-width-select { width: 100%; min-width: 100%; }
    .empty-hint {
      font-size: 12px;
      color: #94a3b8;
      padding: 4px 14px 0;
      margin: -8px 0 12px;
    }
    .form-error { color: #b91c1c; font-size: 13px; padding: 8px 0; margin: 0; }
    .form-actions { padding: 20px 0; }
  `],
})
export class LabourCreateWorkerPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private api = inject(ApiService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  labourTypes = LABOUR_TYPES;

  worker = {
    name: '',
    address: '',
    labourType: '',
    subcontractorId: '',
    subcontractorName: '',
  };

  isSubmitting = signal(false);
  loadingSubcontractors = signal(false);
  errorMessage = signal<string | null>(null);
  subcontractors = signal<Subcontractor[]>([]);

  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  selectedProjectName = signal<string | null>(null);
  siteProjectId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    addIcons({ locationOutline, peopleOutline, businessOutline, checkmarkCircleOutline });
    await this.supervisor.init();
    this.selectedSiteId.set(this.supervisor.selectedSiteId());
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    this.selectedProjectName.set(this.supervisor.selectedProjectName());
    this.siteProjectId.set(this.supervisor.selectedProjectId());
    // Always fetch the freshest list of subcontractors when the form opens —
    // the GET cache may hold a stale snapshot if a sub-contractor was created
    // or modified from another device since the last visit.
    this.api.invalidateGetCache('/supervisor/subcontractors');
    await this.loadSubcontractors();
  }



  private async loadSubcontractors(): Promise<void> {
    this.loadingSubcontractors.set(true);
    try {
      const res = await firstValueFrom(this.supervisor.getSubcontractors());
      this.subcontractors.set(res?.subcontractors ?? []);
    } catch {
      this.subcontractors.set([]);
    } finally {
      this.loadingSubcontractors.set(false);
    }
  }

  onSubcontractorChange(): void {
    const sub = this.subcontractors().find((s) => s._id === this.worker.subcontractorId);
    this.worker.subcontractorName = sub?.subcontractorName ?? '';
  }

  isValid(): boolean {
    return !!this.worker.name && !!this.worker.labourType && !!this.worker.subcontractorId && !!this.worker.subcontractorName;
  }

  async submit(): Promise<void> {
    if (!this.isValid()) {
      this.errorMessage.set('Please fill all required fields (worker name, sub-contractor, labour type).');
      return;
    }
    this.errorMessage.set(null);

    const siteId = this.selectedSiteId();
    const siteName = this.selectedSiteName();
    const projectId = this.siteProjectId();

    if (!siteId || !siteName || !projectId) {
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

    const payload: Record<string, unknown> = {
      projectId,
      siteId,
      site: siteName,
      name: this.worker.name.trim(),
      address: this.worker.address?.trim() || undefined,
      labourType: this.worker.labourType,
      isSubcontract: true,
      subcontractorId: this.worker.subcontractorId,
      subcontractorName: this.worker.subcontractorName,
    };

    this.supervisor.createWorker(payload as never).subscribe({
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
          err?.error?.details?.fieldErrors?.subcontractorId?.[0] ||
          err?.error?.error ||
          err?.message ||
          'Failed to create worker';
        this.errorMessage.set(msg);
      },
    });
  }

  handleRefresh(event: CustomEvent): void {
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }
}
