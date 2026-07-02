import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButtons,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonChip,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkDoneCircleOutline, timeOutline, checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonButtons,
    IonMenuButton,
    IonRefresher,
    IonRefresherContent,
    IonChip,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar class="agb-header">
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Approvals</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="container" *ngIf="approvals().length > 0; else emptyState">
        <div class="agb-list-card">
          <div class="agb-list-item" *ngFor="let item of approvals()">
            <div class="icon-bubble" [ngClass]="sourceClass(item.source)">
              <ion-icon [name]="sourceIcon(item.source)"></ion-icon>
            </div>
            <div class="body">
              <p class="title">{{ item.title }}</p>
              <p class="subtitle">{{ item.subtitle }}</p>
            </div>
            <div class="trailing">
              <ion-chip [class]="statusChipClass(item.status)">{{ item.status }}</ion-chip>
            </div>
          </div>
        </div>
      </div>

      <ng-template #emptyState>
        <div class="agb-empty" style="margin-top: 80px;">
          <ion-icon name="checkmark-done-circle-outline"></ion-icon>
          <h3>No pending approvals</h3>
          <p>All caught up! Your submitted requests will appear here.</p>
        </div>
      </ng-template>
    </ion-content>
  `,
  styles: [`
    .container { padding: 18px; }
    .icon-bubble.material { background: rgba(0,34,99,0.08); color: var(--agb-primary); }
    .icon-bubble.labour { background: rgba(31,157,106,0.12); color: var(--agb-success); }
    .icon-bubble.expense { background: rgba(201,162,39,0.16); color: var(--agb-gold); }
    .icon-bubble.payment { background: rgba(43,127,204,0.12); color: var(--agb-info); }
    .icon-bubble.subcontract { background: rgba(160,84,196,0.14); color: #8b4fa0; }
  `],
})
export class ApprovalsPage implements OnInit {
  approvals = this.api.approvals;

  constructor(private api: ApiService) {
    addIcons({
      'checkmark-done-circle-outline': checkmarkDoneCircleOutline,
      'time-outline': timeOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
    });
  }

  async ngOnInit() {
    await this.api.loadApprovals();
  }

  async handleRefresh(event: CustomEvent) {
    await this.api.loadApprovals();
    setTimeout(() => (event.target as any).complete(), 400);
  }

  sourceIcon(s: string) {
    return { material: 'cube-outline', labour: 'people-outline', expense: 'wallet-outline', payment: 'card-outline', subcontract: 'briefcase-outline' }[s] || 'time-outline';
  }

  sourceClass(s: string) {
    return s;
  }

  statusChipClass(s: string) {
    return {
      Pending: 'agb-chip agb-chip-warning',
      Approved: 'agb-chip agb-chip-success',
      Rejected: 'agb-chip agb-chip-danger',
    }[s] || 'agb-chip';
  }
}