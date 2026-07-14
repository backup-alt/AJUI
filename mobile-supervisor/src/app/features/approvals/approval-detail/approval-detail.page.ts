import { Component, OnInit, signal, inject } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonButton,
  IonBadge,
  IonItem,
  IonLabel,
  IonList,
  IonTextarea,
  IonIcon,
  IonSpinner,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  cubeOutline,
  peopleOutline,
  walletOutline,
  constructOutline,
  locationOutline,
  timeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  businessOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';

@Component({
  selector: 'app-approval-detail',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonButton,
    IonBadge,
    IonItem,
    IonLabel,
    IonList,
    IonTextarea,
    IonIcon,
    IonSpinner,
    FormsModule,
    DatePipe,
    CurrencyPipe,
    TitleCasePipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/approvals"></ion-back-button>
        </ion-buttons>
        <ion-title>Review Approval</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="approval-content">
      <div class="approval-container">
        @if (isLoading()) {
          <div class="loading">
            <ion-spinner name="crescent"></ion-spinner>
            <p>Loading approval...</p>
          </div>
        } @else if (approval()) {
          <div class="approval-type-badge" [class]="approval()?.type">
            <ion-icon [name]="getTypeIcon(approval()?.type)"></ion-icon>
            {{ approval()?.type | titlecase }}
          </div>

          <h2 class="approval-title">{{ approval()?.title }}</h2>

          <ion-badge [color]="getStatusColor(approval()?.status)" class="status-badge">
            {{ approval()?.status }}
          </ion-badge>

          @if (approval()?.amount) {
            <div class="approval-amount">
              {{ approval()?.amount | currency:'INR':'symbol':'1.0-0' }}
            </div>
          }

          <div class="info-block">
            <div class="info-row">
              <span class="info-label">Project</span>
              <span class="info-value">{{ approval()?.projectName || '-' }}</span>
            </div>
            @if (approval()?.site) {
              <div class="info-row">
                <span class="info-label">Site</span>
                <span class="info-value">
                  <ion-icon name="location-outline"></ion-icon>
                  {{ approval()?.site }}
                </span>
              </div>
            }
            <div class="info-row">
              <span class="info-label">Submitted</span>
              <span class="info-value">
                <ion-icon name="time-outline"></ion-icon>
                {{ approval()?.submittedAt | date:'MMM d, yyyy h:mm a' }}
              </span>
            </div>
          </div>

          @if (approval()?.status === 'Pending') {
            <div class="decision-block">
              <h3 class="decision-title">Your Decision</h3>
              <ion-textarea
                placeholder="Add notes (optional)"
                [(ngModel)]="notes"
                [rows]="3"
                [autoGrow]="true"
              ></ion-textarea>
              <div class="action-buttons">
                <ion-button
                  expand="block"
                  class="reject-btn"
                  fill="outline"
                  [disabled]="isProcessing()"
                  (click)="takeAction('reject')"
                >
                  <ion-icon name="close-circle-outline" slot="start"></ion-icon>
                  Reject
                </ion-button>
                <ion-button
                  expand="block"
                  class="approve-btn"
                  [disabled]="isProcessing()"
                  (click)="takeAction('approve')"
                >
                  @if (isProcessing()) {
                    <ion-spinner name="crescent" slot="start"></ion-spinner>
                  } @else {
                    <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
                  }
                  Approve
                </ion-button>
              </div>
            </div>
          } @else {
            <div class="decision-block">
              <h3 class="decision-title">Decision Made</h3>
              <div class="info-row">
                <span class="info-label">Status</span>
                <ion-badge [color]="getStatusColor(approval()?.status)">
                  {{ approval()?.status }}
                </ion-badge>
              </div>
            </div>
          }
        } @else {
          <div class="error-state">
            <ion-icon name="close-circle-outline"></ion-icon>
            <p>Approval not found</p>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .approval-content { --background: #f5f6f8; }
    .approval-container { padding: 16px; }
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 64px 16px;
      color: #6b7280;
    }
    .loading p { margin-top: 12px; font-size: 13px; }
    .approval-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 10px;
      background: #f1f3f5;
      color: #374151;
      margin-bottom: 12px;
    }
    .approval-type-badge ion-icon { font-size: 14px; }
    .approval-type-badge.material { background: rgba(220, 53, 69, 0.1); color: #dc3545; }
    .approval-type-badge.labour { background: rgba(13, 202, 240, 0.1); color: #0891b2; }
    .approval-type-badge.expense { background: rgba(217, 119, 6, 0.1); color: #d97706; }
    .approval-type-badge.payment { background: rgba(25, 135, 84, 0.1); color: #198754; }
    .approval-title {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 8px;
    }
    .status-badge {
      font-size: 10px;
      padding: 4px 10px;
    }
    .approval-amount {
      font-size: 32px;
      font-weight: 700;
      color: #002263;
      margin: 16px 0 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-block {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      padding: 4px 0;
      margin-bottom: 16px;
    }
    .info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f3f5;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label {
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    .info-value ion-icon { font-size: 14px; color: #6b7280; }
    .decision-block {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      padding: 16px;
      margin-top: 16px;
    }
    .decision-title {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 12px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .action-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 16px;
    }
    .approve-btn {
      --background: #198754;
      --color: white;
      --border-radius: 2px;
    }
    .reject-btn {
      --color: #dc3545;
      --border-color: #dc3545;
      --border-radius: 2px;
      --border-width: 1px;
    }
    .error-state {
      text-align: center;
      padding: 64px 16px;
      color: #6b7280;
    }
    .error-state ion-icon {
      font-size: 48px;
      color: #9ca3af;
      margin-bottom: 12px;
    }
    .error-state p { font-size: 14px; }
  `],
})
export class ApprovalDetailPage implements OnInit {
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supervisor = inject(SupervisorService);

  approval = signal<any>(null);
  notes = '';
  isProcessing = signal(false);
  isLoading = signal(true);

  async ngOnInit(): Promise<void> {
    addIcons({
      cubeOutline,
      peopleOutline,
      walletOutline,
      constructOutline,
      locationOutline,
      timeOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      businessOutline,
    });
    await this.loadApproval();
  }

  async loadApproval(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.supervisor.getApprovalDetail(id).subscribe({
      next: (result) => {
        this.approval.set(result.approval as any);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('[ApprovalDetail] failed to load', err);
        this.isLoading.set(false);
      },
    });
  }

  async takeAction(action: 'approve' | 'reject'): Promise<void> {
    const actionLabel = action === 'approve' ? 'Approve' : 'Reject';
    const alert = await this.alertCtrl.create({
      header: `${actionLabel} this request?`,
      message: `Are you sure you want to ${action} this approval? The decision will be sent to the office immediately.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: actionLabel,
          handler: async () => {
            await this.submitAction(action);
          },
        },
      ],
    });
    await alert.present();
  }

  private async submitAction(action: 'approve' | 'reject'): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.isProcessing.set(true);
    this.supervisor.takeApprovalAction(id, { action, comment: this.notes }).subscribe({
      next: async () => {
        this.isProcessing.set(false);
        // Notify other pages that an approval status changed.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agb:approvals-changed'));
        }
        const toast = await this.toastCtrl.create({
          message: `Request ${action}d successfully`,
          duration: 2500,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        this.router.navigate(['/tabs/approvals']);
      },
      error: async (err) => {
        this.isProcessing.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to process request',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }

  getStatusColor(status?: string): string {
    switch (status) {
      case 'Pending': return 'warning';
      case 'Approved': return 'success';
      case 'Rejected': return 'danger';
      default: return 'medium';
    }
  }

  getTypeIcon(type?: string): string {
    switch (type) {
      case 'material': return 'cube-outline';
      case 'labour': return 'people-outline';
      case 'expense': return 'wallet-outline';
      case 'payment': return 'business-outline';
      case 'subcontract': return 'construct-outline';
      default: return 'cube-outline';
    }
  }
}
