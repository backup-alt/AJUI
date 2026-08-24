import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons,
  IonButton, IonInput, IonItem, IonLabel, IonList, IonTextarea,
  IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  businessOutline, checkmarkCircleOutline, personAddOutline,
  locationOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';

@Component({
  selector: 'app-attendance-add-subcontractor',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons,
    IonButton, IonInput, IonItem, IonLabel, IonList, IonTextarea,
    IonIcon, IonSpinner, IonRefresher, IonRefresherContent, FormsModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour"></ion-back-button>
        </ion-buttons>
        <ion-title>Add Sub-contractor</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="create-content">
      <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="form-container">
        <div class="page-header">
          <div class="page-icon">
            <ion-icon name="person-add-outline"></ion-icon>
          </div>
          <div>
            <h1 class="page-title">New Sub-contractor</h1>
            <p class="page-subtitle">Add a sub-contractor to mark attendance for them.</p>
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
            <ion-label position="stacked">Name *</ion-label>
            <ion-input
              placeholder="e.g. Sri Balaji Electricals"
              [(ngModel)]="form.subcontractorName"
              [clearInput]="true"
            ></ion-input>
          </ion-item>

          <ion-item class="form-item">
            <ion-label position="stacked">Phone</ion-label>
            <ion-input
              type="tel"
              placeholder="Optional"
              [(ngModel)]="form.phone"
              [clearInput]="true"
            ></ion-input>
          </ion-item>

          <ion-item class="form-item form-item-last">
            <ion-label position="stacked">Address</ion-label>
            <ion-textarea
              placeholder="Optional"
              [(ngModel)]="form.address"
              [rows]="2"
              [autoGrow]="true"
            ></ion-textarea>
          </ion-item>
        </ion-list>

        <p class="hint">
          Sub-contractor profile (GST, multi-project assignment, custom fields) can be
          completed later from the web admin.
        </p>

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
              Saving...
            } @else {
              <ion-icon slot="start" name="checkmark-circle-outline"></ion-icon>
              Add Sub-contractor
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
      background: rgba(0, 34, 99, 0.1);
      color: #002263;
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
    .form-item ion-input,
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
    .hint {
      font-size: 12px;
      color: #6b7280;
      margin: 12px 4px 0;
      line-height: 1.4;
    }
    .form-error { color: #b91c1c; font-size: 13px; padding: 8px 0; margin: 0; }
    .form-actions { padding: 20px 0; }
  `],
})
export class AttendanceAddSubcontractorPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  form = {
    subcontractorName: '',
    phone: '',
    address: '',
  };

  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);
  selectedProjectName = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    addIcons({
      businessOutline, checkmarkCircleOutline, personAddOutline, locationOutline,
    });
    await this.supervisor.init().catch(() => {});
    this.selectedProjectName.set(this.supervisor.selectedProjectName());
  }

  isValid(): boolean {
    return !!this.form.subcontractorName.trim();
  }

  async submit(): Promise<void> {
    if (!this.isValid()) {
      this.errorMessage.set('Sub-contractor name is required.');
      return;
    }
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const payload = {
      subcontractorName: this.form.subcontractorName.trim(),
      phone: this.form.phone?.trim() || undefined,
      address: this.form.address?.trim() || undefined,
    };

    this.supervisor.createQuickSubcontractor(payload).subscribe({
      next: async (res) => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: `${res?.subcontractor?.subcontractorName || 'Sub-contractor'} added`,
          duration: 1800,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agb:labour-changed'));
        }
        // Drop the supervisor on the new sub-contractor's attendance
        // screen so they can immediately record today's muster.
        if (res?.subcontractor?._id) {
          this.router.navigate(['/tabs/labour/mark-bulk', res.subcontractor._id]);
        } else {
          this.router.navigate(['/tabs/labour']);
        }
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.error || err?.message || 'Failed to add sub-contractor';
        this.errorMessage.set(msg);
      },
    });
  }

  handleRefresh(event: CustomEvent): void {
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }
}
