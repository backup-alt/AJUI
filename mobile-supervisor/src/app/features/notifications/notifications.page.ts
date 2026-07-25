import { Component, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  notificationsOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  cubeOutline,
  walletOutline,
  peopleOutline,
  alertCircleOutline,
  trashOutline,
} from 'ionicons/icons';
import { NotificationService, InAppNotification } from '../../core/services/notification.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    DatePipe,
  ],
  template: `
    <ion-content class="notif-content">
      <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="notif-wrap">
        <div class="notif-header">
          <h1 class="notif-title">Notifications</h1>
          @if (notifications().length > 0) {
            <button class="clear-btn" (click)="clearAll()">
              <ion-icon name="trash-outline"></ion-icon>
              Clear All
            </button>
          }
        </div>

        @if (notifications().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">
              <ion-icon name="notifications-outline"></ion-icon>
            </div>
            <h3 class="empty-title">No notifications</h3>
            <p class="empty-text">You'll see alerts for material approvals, wage updates, and inventory changes here.</p>
          </div>
        } @else {
          @for (notif of notifications(); track notif.id) {
            <div class="notif-card" [class.unread]="!notif.read" (click)="markRead(notif)">
              <div class="notif-icon" [class]="getIconClass(notif)">
                <ion-icon [name]="getIcon(notif)"></ion-icon>
              </div>
              <div class="notif-body">
                <h4 class="notif-title-text">{{ notif.title }}</h4>
                <p class="notif-body-text">{{ notif.body }}</p>
                <span class="notif-time">{{ notif.receivedAt | date:'MMM d, h:mm a' }}</span>
              </div>
              @if (!notif.read) {
                <span class="unread-dot"></span>
              }
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .notif-content { --background: var(--m3-surface); }
    .notif-wrap { padding: var(--md-space-4); padding-top: env(safe-area-inset-top); }

    .notif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--md-space-4);
    }
    .notif-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--m3-on-surface);
      margin: 0;
    }
    .clear-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      color: var(--m3-error);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      padding: 6px 10px;
      border-radius: var(--md-radius-md);
      transition: background 120ms ease;
    }
    .clear-btn:active { background: rgba(220, 38, 38, 0.08); }
    .clear-btn ion-icon { font-size: 16px; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--md-space-3);
      padding: var(--md-space-8) var(--md-space-4);
      text-align: center;
    }
    .empty-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--m3-surface-container);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .empty-icon ion-icon {
      font-size: 32px;
      color: var(--m3-on-surface-muted);
    }
    .empty-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0;
    }
    .empty-text {
      font-size: 13px;
      color: var(--m3-on-surface-muted);
      margin: 0;
      max-width: 260px;
      line-height: 1.5;
    }

    .notif-card {
      display: flex;
      align-items: flex-start;
      gap: var(--md-space-3);
      padding: var(--md-space-4);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      margin-bottom: var(--md-space-2);
      box-shadow: var(--md-elevation-1);
      cursor: pointer;
      transition: transform 100ms ease;
      position: relative;
    }
    .notif-card:active { transform: scale(0.99); }
    .notif-card.unread {
      border-left: 3px solid var(--m3-primary);
    }

    .notif-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--md-radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .notif-icon ion-icon { font-size: 20px; }
    .notif-icon.icon-success {
      background: rgba(34, 197, 94, 0.1);
      color: #16a34a;
    }
    .notif-icon.icon-danger {
      background: rgba(220, 38, 38, 0.1);
      color: #dc2626;
    }
    .notif-icon.icon-warning {
      background: rgba(245, 158, 11, 0.1);
      color: #d97706;
    }
    .notif-icon.icon-info {
      background: rgba(0, 34, 99, 0.08);
      color: var(--m3-primary);
    }

    .notif-body { flex: 1; min-width: 0; }
    .notif-title-text {
      font-size: 14px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 2px;
    }
    .notif-body-text {
      font-size: 13px;
      color: var(--m3-on-surface-muted);
      margin: 0 0 4px;
      line-height: 1.4;
    }
    .notif-time {
      font-size: 11px;
      color: var(--m3-on-surface-muted);
      opacity: 0.7;
    }

    .unread-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--m3-primary);
      flex-shrink: 0;
      margin-top: 4px;
    }
  `],
})
export class NotificationsPage implements OnInit {
  private notifService = inject(NotificationService);

  notifications = signal<InAppNotification[]>([]);

  ngOnInit(): void {
    addIcons({
      notificationsOutline, checkmarkCircleOutline, closeCircleOutline,
      timeOutline, cubeOutline, walletOutline, peopleOutline,
      alertCircleOutline, trashOutline,
    });
    this.notifications.set(this.notifService.notifications());
    this.notifService.markAllRead();
  }

  handleRefresh(event: CustomEvent): void {
    this.notifications.set(this.notifService.notifications());
    this.notifService.markAllRead();
    (event.target as HTMLIonRefresherElement).complete();
  }

  markRead(notif: InAppNotification): void {
    notif.read = true;
    this.notifService.markAllRead();
  }

  clearAll(): void {
    this.notifService.clear();
    this.notifications.set([]);
  }

  getIcon(notif: InAppNotification): string {
    const title = (notif.title || '').toLowerCase();
    const body = (notif.body || '').toLowerCase();
    if (title.includes('approved') || body.includes('approved')) return 'checkmark-circle-outline';
    if (title.includes('rejected') || body.includes('rejected')) return 'close-circle-outline';
    if (title.includes('wage') || body.includes('wage')) return 'wallet-outline';
    if (title.includes('material') || body.includes('material')) return 'cube-outline';
    if (title.includes('inventory') || body.includes('inventory')) return 'alert-circle-outline';
    return 'notifications-outline';
  }

  getIconClass(notif: InAppNotification): string {
    const title = (notif.title || '').toLowerCase();
    const body = (notif.body || '').toLowerCase();
    if (title.includes('approved') || body.includes('approved')) return 'notif-icon icon-success';
    if (title.includes('rejected') || body.includes('rejected')) return 'notif-icon icon-danger';
    if (title.includes('wage') || body.includes('wage')) return 'notif-icon icon-warning';
    return 'notif-icon icon-info';
  }
}
