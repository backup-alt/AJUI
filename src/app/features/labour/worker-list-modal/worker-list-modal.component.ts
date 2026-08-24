import { Component, OnInit, inject } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  closeOutline, chevronForwardOutline, personOutline,
} from 'ionicons/icons';
import { Worker } from '../../../shared/models';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-worker-list-modal',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    FormsModule,
    CurrencyPipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ titleText }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="modal-content">
      <ion-list lines="none" class="worker-list">
        @for (worker of workers; track worker._id) {
          <ion-item
            class="worker-item"
            button
            detail
            (click)="navigateToDetail(worker)"
          >
            <div class="worker-avatar" slot="start">
              {{ getInitials(worker.name) }}
            </div>
            <ion-label>
              <h3 class="worker-name">{{ worker.name }}</h3>
              <p class="worker-meta">
                @if (worker.isSubcontract && worker.subcontractorName) {
                  {{ worker.subcontractorName }}
                } @else {
                  Direct Employee
                }
              </p>
            </ion-label>
            <div class="worker-pay" slot="end">
              <span class="pay-value">{{ worker.weeklyPay | currency:'INR':'symbol':'1.0-0' }}</span>
              <span class="pay-label">/week</span>
            </div>
            <ion-icon name="chevron-forward-outline" slot="end" class="chevron"></ion-icon>
          </ion-item>
        }
        @if (workers.length === 0) {
          <div class="empty-state">
            <ion-icon name="person-outline"></ion-icon>
            <p>No workers found</p>
          </div>
        }
      </ion-list>
    </ion-content>
  `,
  styles: [`
    .modal-content { --background: var(--m3-surface); }

    ion-toolbar {
      --background: var(--m3-surface-bright);
      --color: var(--m3-on-surface);
    }

    .worker-list {
      background: transparent;
      padding: var(--md-space-2) 0;
    }

    .worker-item {
      --background: var(--m3-surface-bright);
      --border-radius: var(--md-radius-lg);
      --padding-start: var(--md-space-4);
      --padding-end: var(--md-space-4);
      --min-height: 68px;
      margin: 4px var(--md-space-3);
      border-radius: var(--md-radius-lg);
      border-bottom: none;
      --inner-border-radius: var(--md-radius-lg);
    }

    .worker-avatar {
      width: 40px;
      height: 40px;
      border-radius: var(--md-radius-md);
      background: var(--m3-primary-container);
      color: var(--m3-on-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 800;
      flex-shrink: 0;
    }

    ion-label {
      padding-left: var(--md-space-3);
    }
    .worker-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--m3-on-surface);
    }
    .worker-meta {
      font-size: 11px;
      color: var(--m3-on-surface-muted);
      margin-top: 2px;
    }

    .worker-pay {
      display: flex;
      align-items: baseline;
      gap: 2px;
      margin-right: var(--md-space-2);
    }
    .pay-value {
      font-size: 13px;
      font-weight: 800;
      color: var(--m3-primary);
    }
    .pay-label {
      font-size: 10px;
      color: var(--m3-on-surface-muted);
    }

    .chevron {
      font-size: 16px;
      color: var(--m3-on-surface-muted);
      flex-shrink: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px var(--md-space-4);
      color: var(--m3-on-surface-muted);
    }
    .empty-state ion-icon { font-size: 48px; opacity: 0.4; }
    .empty-state p { font-size: 14px; margin-top: 8px; }
  `],
})
export class WorkerListModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private router = inject(Router);

  workers: Worker[] = [];
  labourType = '';
  action: 'view' | 'mark-attendance' = 'view';

  ngOnInit(): void {
    addIcons({ closeOutline, chevronForwardOutline, personOutline });
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  get titleText(): string {
    if (this.action === 'mark-attendance') {
      return this.labourType && this.labourType !== 'Select worker to mark attendance'
        ? `Mark Attendance — ${this.labourType}`
        : 'Mark Attendance';
    }
    return this.labourType ? `${this.labourType} Workers` : 'Workers';
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  async navigateToDetail(worker: Worker): Promise<void> {
    console.log('[WorkerListModal] Action:', this.action, 'Worker:', worker._id);
    await this.modalCtrl.dismiss();
    if (this.action === 'mark-attendance') {
      await this.router.navigate(['/tabs/labour/mark-attendance', worker._id]);
    } else {
      await this.router.navigate(['/tabs/labour/worker', worker._id]);
    }
    console.log('[WorkerListModal] Navigation complete');
  }
}