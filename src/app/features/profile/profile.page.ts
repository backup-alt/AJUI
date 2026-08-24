import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent, IonIcon, IonRefresher, IonRefresherContent,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personCircleOutline, mailOutline,
  logOutOutline, shieldCheckmarkOutline,
  notificationsOutline, notificationsOffOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { SupervisorService } from '../../core/services/supervisor.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    IonContent, IonIcon, IonRefresher, IonRefresherContent,
  ],
  template: `
    <ion-content class="profile-content">
      <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
      <div class="profile-hero">
        <div class="hero-content">
          <div class="avatar-wrap">
            <div class="avatar">{{ userInitials() }}</div>
            <span class="status-dot"></span>
          </div>
          <h2 class="user-name">{{ currentUser()?.name || 'Supervisor' }}</h2>
        <p class="user-role">Project Supervisor</p>
          @if (currentUser()?.email) {
            <p class="user-email">
              <ion-icon name="mail-outline"></ion-icon>
              {{ currentUser()?.email }}
            </p>
          }
        </div>
      </div>

      <div class="content-stack">
        <section class="profile-card">
          <header class="card-head">
            <span class="head-tile"><ion-icon name="person-circle-outline"></ion-icon></span>
            <h3>Account</h3>
          </header>
          <div class="kv-list">
            <div class="kv">
              <span class="kv-label">Name</span>
              <span class="kv-value">{{ currentUser()?.name || 'Not set' }}</span>
            </div>
            <div class="kv">
              <span class="kv-label">Email</span>
              <span class="kv-value">{{ currentUser()?.email || 'Not set' }}</span>
            </div>
            <div class="kv">
              <span class="kv-label">Phone</span>
              <span class="kv-value">{{ currentUser()?.phone || 'Not set' }}</span>
            </div>
          </div>
        </section>

        <section class="profile-card">
          <header class="card-head">
            <span class="head-tile"><ion-icon name="notifications-outline"></ion-icon></span>
            <h3>Notifications</h3>
          </header>
          <div class="notif-row">
            <div class="notif-row-text">
              <strong class="notif-row-title">
                <ion-icon [name]="pushEnabled() ? 'notifications-outline' : 'notifications-off-outline'"></ion-icon>
                Push notifications
              </strong>
              <small class="notif-row-sub">
                @if (pushEnabled()) {
                  You'll get an alert on this device when your requests are approved or rejected.
                } @else {
                  Turn on to receive approval and rejection alerts on this device, even when the app is closed.
                }
              </small>
            </div>
            <button
              type="button"
              class="notif-toggle"
              [class.on]="pushEnabled()"
              [disabled]="busy()"
              (click)="togglePush()"
              [attr.aria-label]="pushEnabled() ? 'Turn off push notifications' : 'Turn on push notifications'"
            >
              <span class="notif-toggle-knob"></span>
            </button>
          </div>
        </section>

        <button class="logout-btn" (click)="logout()">
          <ion-icon name="log-out-outline" slot="start"></ion-icon>
          Sign out
        </button>

        <p class="version-text">
          <ion-icon name="shield-checkmark-outline"></ion-icon>
          Internal use only - AGB
        </p>
      </div>
    </ion-content>
  `,
  styles: [`
    .profile-content { --background: #f5f6f8; background: #f5f6f8; color: #0f172a; }

    .profile-hero {
      position: relative;
      background: var(--agb-gradient-hero);
      color: #ffffff;
      padding: 32px 20px 64px;
      overflow: hidden;
    }
    .hero-content { position: relative; text-align: center; color: #ffffff; }
    .avatar-wrap { position: relative; display: inline-block; margin-bottom: 14px; }
    .avatar {
      width: 84px; height: 84px;
      background: linear-gradient(135deg, #c9a227 0%, #d4b45a 100%);
      color: #1f2937;
      border-radius: 26px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 800;
      box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.40);
    }
    .status-dot {
      position: absolute;
      bottom: -2px; right: -2px;
      width: 18px; height: 18px;
      background: #22c55e;
      border: 3px solid #002263;
      border-radius: 50%;
    }
    .user-name {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 4px;
      letter-spacing: -0.3px;
      color: #ffffff;
    }
    .user-role {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.92);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin: 0 0 8px;
      font-weight: 700;
    }
    .user-email {
      font-size: 13px;
      color: #ffffff;
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      opacity: 0.95;
    }
    .user-email ion-icon { font-size: 14px; color: #c9a227; }

    .content-stack {
      margin: -36px 16px 24px;
      position: relative;
      z-index: 2;
      background: transparent;
      color: #0f172a;
    }

    .profile-card {
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 16px 18px;
      margin-bottom: 12px;
      box-shadow: var(--agb-shadow-sm);
    }
    .card-head {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 12px;
      color: #0f172a;
    }
    .head-tile {
      width: 32px; height: 32px;
      border-radius: 10px;
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
      display: flex; align-items: center; justify-content: center;
    }
    .head-tile ion-icon { font-size: 16px; }
    .card-head h3 {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .kv-list { display: flex; flex-direction: column; gap: 10px; }
    .kv {
      display: flex; flex-direction: column; gap: 2px;
      padding: 10px 12px;
      background: #f8fafc;
      border-radius: 12px;
      color: #0f172a;
    }
    .kv-label {
      font-size: 10px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .kv-value {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      word-break: break-word;
    }

    .row-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
    }
    .row-item:last-child { border-bottom: none; padding-bottom: 0; }
    .row-item.action { background: transparent; border: 0; width: 100%; text-align: left; cursor: pointer; font-family: inherit; color: #0f172a; }
    .row-tile {
      width: 36px; height: 36px;
      border-radius: 11px;
      background: rgba(0, 34, 99, 0.06);
      color: #002263;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .row-tile ion-icon { font-size: 18px; }
    .row-content { flex: 1; min-width: 0; color: #0f172a; }
    .row-title { font-size: 14px; font-weight: 600; color: #0f172a; }
    .row-sub { font-size: 12px; color: #475569; margin-top: 2px; }
    .chev { color: #94a3b8; font-size: 16px; }

    .logout-btn {
      width: 100%;
      background: #ffffff;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 16px;
      padding: 14px 16px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 4px;
      transition: background var(--agb-transition-fast);
    }
    .logout-btn:hover { background: #fef2f2; }
    .logout-btn ion-icon { font-size: 18px; }

    .version-text {
      text-align: center;
      font-size: 11px;
      color: #475569;
      margin: 16px 0 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      justify-content: center;
    }
    .version-text ion-icon { font-size: 12px; color: #475569; }

    /* Notifications card */
    .notif-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 12px;
      color: #0f172a;
    }
    .notif-row-text { flex: 1 1 auto; min-width: 0; color: #0f172a; }
    .notif-row-title {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    .notif-row-title ion-icon { font-size: 16px; color: #002263; }
    .notif-row-sub {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.4;
      color: #475569;
    }
    .notif-toggle {
      flex: 0 0 auto;
      position: relative;
      width: 48px;
      height: 28px;
      border-radius: 14px;
      border: 1px solid #cbd5e1;
      background: #e2e8f0;
      cursor: pointer;
      padding: 0;
      transition: background 0.18s ease, border-color 0.18s ease;
      font-family: inherit;
    }
    .notif-toggle:disabled { opacity: 0.6; cursor: not-allowed; }
    .notif-toggle.on { background: #002263; border-color: #002263; }
    .notif-toggle-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
      transition: transform 0.18s ease;
    }
    .notif-toggle.on .notif-toggle-knob { transform: translateX(20px); }
  `],
})
export class ProfilePage implements OnInit {
  private auth = inject(AuthService);
  private supervisor = inject(SupervisorService);
  private notifications = inject(NotificationService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  currentUser = signal<{ name: string; email: string; phone: string } | null>(null);
  readonly pushEnabled = this.notifications.pushEnabled;
  readonly busy = signal<boolean>(false);

  userInitials(): string {
    const name = this.currentUser()?.name || 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      personCircleOutline, mailOutline,
      logOutOutline, shieldCheckmarkOutline,
      notificationsOutline, notificationsOffOutline,
    });
    this.currentUser.set(this.auth.currentUser());
  }

  async handleRefresh(event: CustomEvent): Promise<void> {
    this.currentUser.set(this.auth.currentUser());
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }

  /**
   * Toggle push notifications on/off. When turning ON, we request the
   * system permission and (if Firebase is configured) register the FCM
   * token with the backend so the supervisor starts receiving approval /
   * rejection alerts. When turning OFF, we unregister the token and stop
   * Capacitor listeners.
   *
   * If Firebase isn't configured for this build, the system permission is
   * still granted (so future builds can take over) and notifications
   * continue to be delivered via the in-app polling channel.
   */
  async togglePush(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      if (this.pushEnabled()) {
        await this.notifications.disable();
        await this.notifications.markOptedOut();
        await this.showToast('Push notifications turned off', 'success');
      } else {
        const granted = await this.notifications.requestPermission();
        if (granted) {
          await this.notifications.markOptedOut(); // already opted in
          if (this.notifications.fcmAvailable()) {
            await this.showToast('Push notifications enabled', 'success');
          } else {
            await this.showToast(
              'Permission granted. Push delivery is currently disabled in this build; you will still receive in-app notifications.',
              'success'
            );
          }
        } else {
          // The user dismissed the system prompt — record opt-out so we
          // don't pester them again.
          await this.notifications.markOptedOut();
          await this.showToast('Push notifications were not enabled', 'warning');
        }
      }
    } catch (err) {
      console.error('[Profile] toggle push failed', err);
      await this.showToast('Could not change notification settings', 'danger');
    } finally {
      this.busy.set(false);
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    try {
      const toast = await this.toastCtrl.create({
        message,
        duration: color === 'danger' ? 3500 : 2000,
        color,
        position: 'bottom',
      });
      await toast.present();
    } catch {
      console.log(`[Profile] ${color}: ${message}`);
    }
  }

  async logout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Sign out',
      message: 'Are you sure you want to sign out of AGB Supervisor?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Sign out',
          role: 'destructive',
          handler: () => this.auth.logout(),
        },
      ],
    });
    await alert.present();
  }
}
