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
  IonSegment,
  IonSegmentButton,
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
import { locationOutline, peopleOutline, businessOutline, personOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { SupervisorService } from '../../../core/services/supervisor.service';
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

type WorkerMode = 'subcontract' | 'direct';

interface SupervisorOption {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  supervisorId?: string;
}

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
    IonSegment,
    IonSegmentButton,
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

          <!--
            Hiring mode toggle. Subcontract workers are tied to a
            sub-contractor; directly-hired workers are tied to a
            supervisor. The matching dropdown is shown below.
          -->
          <ion-item class="form-item">
            <ion-label position="stacked">Hiring Mode *</ion-label>
            <ion-segment
              [value]="mode()"
              (ionChange)="setMode($event.detail.value)"
              mode="ios"
            >
              <ion-segment-button value="subcontract">
                <ion-icon name="business-outline"></ion-icon>
                <ion-label>Subcontract</ion-label>
              </ion-segment-button>
              <ion-segment-button value="direct">
                <ion-icon name="person-outline"></ion-icon>
                <ion-label>Direct Hire</ion-label>
              </ion-segment-button>
            </ion-segment>
          </ion-item>

          @if (mode() === 'subcontract') {
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
          } @else {
            <ion-item class="form-item">
              <ion-label position="stacked">Supervisor *</ion-label>
              <ion-select
                placeholder="Select supervisor"
                [(ngModel)]="worker.supervisorId"
                interface="popover"
                (ionChange)="onSupervisorChange()"
                [disabled]="loadingSupervisors()"
                class="full-width-select"
              >
                @for (sup of supervisors(); track sup._id) {
                  <ion-select-option [value]="sup._id">
                    {{ sup.name }}{{ sup.phone ? ' · ' + sup.phone : '' }}
                  </ion-select-option>
                }
              </ion-select>
              @if (loadingSupervisors()) {
                <ion-spinner name="dots" slot="end"></ion-spinner>
              }
            </ion-item>
            @if (!loadingSupervisors() && supervisors().length === 0) {
              <p class="empty-hint">No other supervisors available for your projects.</p>
            }
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
    /* Make the segment span the full form-item width. */
    .form-item ion-segment {
      width: 100%;
      --background: #f1f5f9;
      border-radius: 8px;
      padding: 2px;
    }
    .form-item ion-segment-button {
      --indicator-color: #ffffff;
      --color: #64748b;
      --color-checked: #0891b2;
      min-height: 36px;
      text-transform: none;
      font-weight: 600;
      font-size: 13px;
    }
    .form-item ion-segment-button ion-icon {
      font-size: 16px;
      margin-bottom: 0;
      margin-right: 4px;
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
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  labourTypes = LABOUR_TYPES;

  worker = {
    name: '',
    address: '',
    labourType: '',
    subcontractorId: '',
    subcontractorName: '',
    supervisorId: '',
    supervisorName: '',
  };

  mode = signal<WorkerMode>('subcontract');
  isSubmitting = signal(false);
  loadingSubcontractors = signal(false);
  loadingSupervisors = signal(false);
  errorMessage = signal<string | null>(null);
  subcontractors = signal<Subcontractor[]>([]);
  supervisors = signal<SupervisorOption[]>([]);

  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  siteProjectId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    addIcons({ locationOutline, peopleOutline, businessOutline, personOutline, checkmarkCircleOutline });
    await this.supervisor.init();
    this.selectedSiteId.set(this.supervisor.selectedSiteId());
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    this.siteProjectId.set(this.supervisor.selectedProjectId());
    // Load both lists up-front — toggling between modes then doesn't
    // require a network round-trip and the spinner state is accurate.
    await Promise.all([this.loadSubcontractors(), this.loadSupervisors()]);
  }

  setMode(next: string | number | undefined): void {
    const value = String(next ?? 'subcontract') as WorkerMode;
    this.mode.set(value);
    // Clear the now-irrelevant field so validation doesn't carry over
    // a stale id from the previous mode.
    if (value === 'subcontract') {
      this.worker.supervisorId = '';
      this.worker.supervisorName = '';
    } else {
      this.worker.subcontractorId = '';
      this.worker.subcontractorName = '';
    }
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

  private async loadSupervisors(): Promise<void> {
    this.loadingSupervisors.set(true);
    try {
      const res = await firstValueFrom(this.supervisor.getSupervisorsForWorker());
      this.supervisors.set(res?.supervisors ?? []);
    } catch {
      this.supervisors.set([]);
    } finally {
      this.loadingSupervisors.set(false);
    }
  }

  onSubcontractorChange(): void {
    const sub = this.subcontractors().find((s) => s._id === this.worker.subcontractorId);
    this.worker.subcontractorName = sub?.subcontractorName ?? '';
  }

  onSupervisorChange(): void {
    const sup = this.supervisors().find((s) => s._id === this.worker.supervisorId);
    this.worker.supervisorName = sup?.name ?? '';
  }

  isValid(): boolean {
    const baseOk = !!this.worker.name && !!this.worker.labourType;
    if (this.mode() === 'subcontract') {
      return baseOk && !!this.worker.subcontractorId && !!this.worker.subcontractorName;
    }
    return baseOk && !!this.worker.supervisorId && !!this.worker.supervisorName;
  }

  async submit(): Promise<void> {
    if (!this.isValid()) {
      const missing = this.mode() === 'subcontract'
        ? 'worker name, sub-contractor, labour type'
        : 'worker name, supervisor, labour type';
      this.errorMessage.set(`Please fill all required fields (${missing}).`);
      return;
    }
    this.errorMessage.set(null);

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

    const isSub = this.mode() === 'subcontract';
    const payload: Record<string, unknown> = {
      projectId,
      siteId,
      site: siteName,
      name: this.worker.name.trim(),
      address: this.worker.address?.trim() || undefined,
      labourType: this.worker.labourType,
      isSubcontract: isSub,
    };
    if (isSub) {
      payload['subcontractorId'] = this.worker.subcontractorId;
      payload['subcontractorName'] = this.worker.subcontractorName;
    } else {
      payload['supervisorId'] = this.worker.supervisorId;
      payload['supervisorName'] = this.worker.supervisorName;
    }

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
          err?.error?.details?.fieldErrors?.supervisorId?.[0] ||
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