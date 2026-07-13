import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonList,
  IonItem, IonLabel, IonIcon, IonButton, IonToggle,
  IonAvatar, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  personCircleOutline, mailOutline, callOutline, businessOutline,
  lockClosedOutline, notificationsOutline, moonOutline, helpCircleOutline,
  logOutOutline, chevronForwardOutline, shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { SupervisorService } from '../../core/services/supervisor.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonList,
    IonItem, IonLabel, IonIcon, IonButton, IonToggle,
    IonAvatar, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    FormsModule
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar><ion-title>Profile</ion-title></ion-toolbar>
    </ion-header>

    <ion-content class="profile-content">
      <div class="profile-header">
        <ion-avatar class="profile-avatar">
          {{ userInitials() }}
        </ion-avatar>
        <h2 class="profile-name">{{ currentUser()?.name || 'Supervisor' }}</h2>
        <p class="profile-role">Site Supervisor</p>
        @if (currentUser()?.email) {
          <p class="profile-email">{{ currentUser()?.email }}</p>
        }
      </div>

      <ion-card class="profile-card">
        <ion-card-header>
          <ion-card-title>Account Information</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-icon name="person-circle-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <p>Name</p>
                <h3>{{ currentUser()?.name || 'Not set' }}</h3>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-icon name="mail-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <p>Email</p>
                <h3>{{ currentUser()?.email || 'Not set' }}</h3>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-icon name="call-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <p>Phone</p>
                <h3>{{ currentUser()?.phone || 'Not set' }}</h3>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <ion-card class="profile-card">
        <ion-card-header>
          <ion-card-title>Preferences</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-icon name="notifications-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>Push Notifications</h3>
                <p>Receive alerts for approvals and updates</p>
              </ion-label>
              <ion-toggle
                slot="end"
                [checked]="pushEnabled"
                (ionChange)="togglePush()"
              ></ion-toggle>
            </ion-item>
            <ion-item>
              <ion-icon name="moon-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>Dark Mode</h3>
                <p>Use the dark theme</p>
              </ion-label>
              <ion-toggle
                slot="end"
                [checked]="darkMode"
                (ionChange)="toggleDarkMode()"
              ></ion-toggle>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <ion-card class="profile-card">
        <ion-card-header>
          <ion-card-title>Security</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item button detail (click)="changePassword()">
              <ion-icon name="lock-closed-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>Change Password</h3>
                <p>Update your account password</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <ion-card class="profile-card">
        <ion-card-header>
          <ion-card-title>Support</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item button detail>
              <ion-icon name="help-circle-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>Help & FAQ</h3>
                <p>Get help with the app</p>
              </ion-label>
            </ion-item>
            <ion-item button detail>
              <ion-icon name="business-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>About App</h3>
                <p>AGB Supervisor v{{ version }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <div class="logout-section">
        <ion-button expand="block" class="logout-btn" (click)="logout()">
          <ion-icon name="log-out-outline" slot="start"></ion-icon>
          Sign Out
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); }
    .profile-content { --background: var(--agb-off-white); }
    .profile-header {
      text-align: center;
      padding: 32px 24px 24px;
      background: var(--agb-white);
    }
    .profile-avatar {
      width: 80px;
      height: 80px;
      margin: 0 auto 16px;
      --background: var(--agb-gradient-gold);
      --color: var(--agb-secondary-contrast);
      font-size: 28px;
      font-weight: 700;
    }
    .profile-name { font-size: 22px; font-weight: 700; color: var(--agb-navy); margin: 0 0 4px; }
    .profile-role { font-size: 12px; color: var(--agb-gold-dark); margin: 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .profile-email { font-size: 13px; color: var(--agb-gray); margin: 4px 0 0; }
    .profile-card { margin: 16px; }
    .profile-card ion-card-title { font-size: 16px; font-weight: 600; color: var(--agb-navy); }
    .profile-card ion-item { --padding-start: 0; --inner-padding-end: 0; margin-bottom: 4px; }
    .profile-card ion-item h3 { font-size: 14px; font-weight: 500; color: var(--agb-navy); margin: 2px 0 0; }
    .profile-card ion-item p { font-size: 12px; color: var(--agb-gray); margin: 0; }
    html.dark .profile-card ion-item h3 { color: #f1f5f9; }
    html.dark .profile-card ion-item p { color: #94a3b8; }
    html.dark .profile-card { background: #1e293b; border-color: #334155; }
    html.dark .profile-header { background: #1e293b; }
    .logout-section { padding: 24px 16px; text-align: center; }
    .logout-btn {
      --background: transparent;
      --color: var(--agb-danger);
      --border-color: var(--agb-danger);
      border: 2px solid var(--agb-danger);
      --border-radius: var(--agb-radius-md);
      font-weight: 600;
    }
    .logout-btn:hover {
      --background: var(--agb-danger);
      --color: var(--agb-white);
    }
    .version-text { font-size: 12px; color: var(--agb-gray); margin: 16px 0 0; }
  `],
})
export class ProfilePage implements OnInit {
  private auth = inject(AuthService);
  private supervisor = inject(SupervisorService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private notifications = inject(NotificationService);
  router = inject(Router);

  currentUser = signal<{ name: string; email: string; phone: string } | null>(null);
  pushEnabled = false;
  darkMode = false;
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
    });

    this.currentUser.set(this.auth.currentUser());
    this.pushEnabled = this.notifications.pushEnabled();
    this.darkMode = document.documentElement.classList.contains('dark');
  }

  async togglePush(): Promise<void> {
    if (this.pushEnabled) {
      await this.notifications.requestPermission();
    } else {
      await this.notifications.disable();
    }
    this.pushEnabled = this.notifications.pushEnabled();
  }

  toggleDarkMode(): void {
    document.documentElement.classList.toggle('dark', this.darkMode);
    try {
      localStorage.setItem('agb:theme', this.darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }

  changePassword(): void {
    this.router.navigate(['/auth/change-password']);
  }

  async logout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Sign Out',
          role: 'destructive',
          handler: () => this.auth.logout(),
        },
      ],
    });
    await alert.present();
  }
}