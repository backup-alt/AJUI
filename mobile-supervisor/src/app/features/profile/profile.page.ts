import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonContent, IonList, IonItem, IonLabel, IonIcon, IonButton, IonToggle,
  IonAvatar, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  personCircleOutline, mailOutline, callOutline, businessOutline,
  lockClosedOutline, notificationsOutline, moonOutline, helpCircleOutline,
  logOutOutline, chevronForwardOutline, shieldCheckmarkOutline,
  sunnyOutline, informationCircleOutline, documentTextOutline, globeOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { SupervisorService } from '../../core/services/supervisor.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
imports: [
    IonContent, IonIcon, IonButton, IonToggle,
    IonAvatar, FormsModule,
  ],
  template: `
    <ion-content class="profile-content">
      <div class="profile-hero">
        <div class="hero-content">
          <div class="avatar-wrap">
            <div class="avatar">{{ userInitials() }}</div>
            <span class="status-dot"></span>
          </div>
          <h2 class="user-name">{{ currentUser()?.name || 'Supervisor' }}</h2>
          <p class="user-role">Site Supervisor</p>
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
            <span class="head-tile"><ion-icon name="globe-outline"></ion-icon></span>
            <h3>Preferences</h3>
          </header>
          <div class="row-item">
            <span class="row-tile">
              <ion-icon name="notifications-outline"></ion-icon>
            </span>
            <div class="row-content">
              <div class="row-title">Push notifications</div>
              <div class="row-sub">Receive alerts for approvals and updates</div>
            </div>
            <ion-toggle
              [checked]="pushEnabled"
              (ionChange)="togglePush()"
            ></ion-toggle>
          </div>
          <div class="row-item">
            <span class="row-tile">
              <ion-icon [name]="isDark() ? 'sunny-outline' : 'moon-outline'"></ion-icon>
            </span>
            <div class="row-content">
              <div class="row-title">{{ isDark() ? 'Light mode' : 'Dark mode' }}</div>
              <div class="row-sub">Switch between themes</div>
            </div>
            <ion-toggle
              [checked]="isDark()"
              (ionChange)="toggleDarkMode()"
            ></ion-toggle>
          </div>
        </section>

        <section class="profile-card">
          <header class="card-head">
            <span class="head-tile"><ion-icon name="shield-checkmark-outline"></ion-icon></span>
            <h3>Security</h3>
          </header>
          <button class="row-item action" (click)="changePassword()">
            <span class="row-tile">
              <ion-icon name="lock-closed-outline"></ion-icon>
            </span>
            <div class="row-content">
              <div class="row-title">Change password</div>
              <div class="row-sub">Update your account password</div>
            </div>
            <ion-icon name="chevron-forward-outline" class="chev"></ion-icon>
          </button>
        </section>

        <section class="profile-card">
          <header class="card-head">
            <span class="head-tile"><ion-icon name="information-circle-outline"></ion-icon></span>
            <h3>Support</h3>
          </header>
          <div class="row-item">
            <span class="row-tile">
              <ion-icon name="document-text-outline"></ion-icon>
            </span>
            <div class="row-content">
              <div class="row-title">About AGB Supervisor</div>
              <div class="row-sub">Version {{ version }}</div>
            </div>
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
    .profile-content { --background: #f5f6f8; }

    .profile-hero {
      position: relative;
      background: var(--agb-gradient-hero);
      color: #ffffff;
      padding: 32px 20px 64px;
      overflow: hidden;
    }
    .hero-content { position: relative; text-align: center; }
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
    .user-name { font-size: 22px; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.3px; }
    .user-role { font-size: 11px; opacity: 0.78; text-transform: uppercase; letter-spacing: 0.6px; margin: 0 0 8px; font-weight: 600; }
    .user-email { font-size: 13px; opacity: 0.85; margin: 0; display: inline-flex; align-items: center; gap: 4px; }
    .user-email ion-icon { font-size: 14px; color: #c9a227; }

    .content-stack {
      margin: -36px 16px 24px;
      position: relative;
      z-index: 2;
    }

    .profile-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 16px 18px;
      margin-bottom: 12px;
      box-shadow: var(--agb-shadow-sm);
    }
    .card-head {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 12px;
    }
    .head-tile {
      width: 32px; height: 32px;
      border-radius: 10px;
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
      display: flex; align-items: center; justify-content: center;
    }
    .head-tile ion-icon { font-size: 16px; }
    .card-head h3 { font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.4px; }

    .kv-list { display: flex; flex-direction: column; gap: 10px; }
    .kv {
      display: flex; flex-direction: column; gap: 2px;
      padding: 10px 12px;
      background: #f8fafc;
      border-radius: 12px;
    }
    .kv-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; }
    .kv-value { font-size: 14px; font-weight: 600; color: #0f172a; }

    .row-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .row-item:last-child { border-bottom: none; padding-bottom: 0; }
    .row-item.action { background: transparent; border: 0; width: 100%; text-align: left; cursor: pointer; font-family: inherit; }
    .row-tile {
      width: 36px; height: 36px;
      border-radius: 11px;
      background: rgba(0, 34, 99, 0.06);
      color: #002263;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .row-tile ion-icon { font-size: 18px; }
    .row-content { flex: 1; min-width: 0; }
    .row-title { font-size: 14px; font-weight: 600; color: #0f172a; }
    .row-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
    .chev { color: #cbd5e1; font-size: 16px; }

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
      color: #94a3b8;
      margin: 16px 0 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      justify-content: center;
    }
    .version-text ion-icon { font-size: 12px; }
  `],
})
export class ProfilePage implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private supervisor = inject(SupervisorService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private notifications = inject(NotificationService);
  private router = inject(Router);

  currentUser = signal<{ name: string; email: string; phone: string } | null>(null);
  pushEnabled = false;
  isDark = signal<boolean>(document.documentElement.classList.contains('dark'));
  version = '1.0.0';

  userInitials(): string {
    const name = this.currentUser()?.name || 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      personCircleOutline, mailOutline, callOutline, businessOutline,
      lockClosedOutline, notificationsOutline, moonOutline, helpCircleOutline,
      logOutOutline, chevronForwardOutline, shieldCheckmarkOutline,
      sunnyOutline, informationCircleOutline, documentTextOutline, globeOutline,
    });

    this.currentUser.set(this.auth.currentUser());
    this.pushEnabled = this.notifications.pushEnabled();
    if (typeof window !== 'undefined') {
      window.addEventListener('agb:theme-changed', this.handleThemeChanged);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:theme-changed', this.handleThemeChanged);
    }
  }

  private handleThemeChanged = (): void => {
    this.isDark.set(document.documentElement.classList.contains('dark'));
  };

  async togglePush(): Promise<void> {
    if (this.pushEnabled) {
      await this.notifications.requestPermission();
    } else {
      await this.notifications.disable();
    }
    this.pushEnabled = this.notifications.pushEnabled();
  }

  toggleDarkMode(): void {
    const next = !this.isDark();
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('agb:theme', next ? 'dark' : 'light');
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('agb:theme-changed'));
  }

  changePassword(): void {
    this.router.navigate(['/auth/change-password']);
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
