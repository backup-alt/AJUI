import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonSpinner,
  IonBackButton,
  IonButtons,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  chevronBackOutline,
  checkmarkCircleOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonSpinner,
    IonBackButton,
    IonButtons,
    FormsModule,
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/profile" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Change Password</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="content">
      <div class="container">
        <div class="icon-circle">
          <ion-icon name="shield-checkmark-outline"></ion-icon>
        </div>
        <h1 class="title">Update your password</h1>
        <p class="subtitle">
          Choose a strong password you don't use on other sites.
        </p>

        <div class="form">
          <ion-item class="agb-input">
            <ion-input
              [type]="showCurrent() ? 'text' : 'password'"
              label="Current Password"
              labelPlacement="stacked"
              [(ngModel)]="currentPassword"
              autocomplete="current-password"
            />
            <ion-button
              slot="end"
              fill="clear"
              class="password-toggle"
              (click)="showCurrent.set(!showCurrent())"
            >
              <ion-icon [name]="showCurrent() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
            </ion-button>
          </ion-item>

          <ion-item class="agb-input">
            <ion-input
              [type]="showNew() ? 'text' : 'password'"
              label="New Password"
              labelPlacement="stacked"
              [(ngModel)]="newPassword"
              autocomplete="new-password"
            />
            <ion-button
              slot="end"
              fill="clear"
              class="password-toggle"
              (click)="showNew.set(!showNew())"
            >
              <ion-icon [name]="showNew() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
            </ion-button>
          </ion-item>
          <div class="password-hint">
            <span [class.valid]="newPassword.length >= 8">8+ characters</span>
            <span [class.valid]="hasUpperCase()">Uppercase</span>
            <span [class.valid]="hasNumber()">Number</span>
          </div>

          <ion-item class="agb-input">
            <ion-input
              [type]="showConfirm() ? 'text' : 'password'"
              label="Confirm New Password"
              labelPlacement="stacked"
              [(ngModel)]="confirmPassword"
              autocomplete="new-password"
            />
            <ion-button
              slot="end"
              fill="clear"
              class="password-toggle"
              (click)="showConfirm.set(!showConfirm())"
            >
              <ion-icon [name]="showConfirm() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
            </ion-button>
          </ion-item>

          <ion-button
            expand="block"
            class="primary-btn"
            [disabled]="!isValid() || isLoading()"
            (click)="submit()"
          >
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              <ion-icon name="checkmark-circle-outline" slot="end"></ion-icon>
              <span>Update Password</span>
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-header {
      --background: var(--agb-white);
      --border-color: var(--agb-light-gray);
    }
    .content { --background: #f8f9fa; }
    .container {
      max-width: 420px;
      margin: 0 auto;
      padding: 32px 24px;
      text-align: center;
    }
    .icon-circle {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      border-radius: 8px;
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-circle ion-icon { font-size: 40px; }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #002263;
      margin: 0 0 8px;
    }
    .subtitle {
      font-size: 14px;
      color: #6c757d;
      margin: 0 0 24px;
    }
    .form {
      background: #ffffff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      text-align: left;
    }
    .agb-input {
      --background: #f8f9fa;
      --border-radius: 8px;
      --padding-start: 12px;
      --padding-end: 12px;
      --min-height: 64px;
      margin-bottom: 12px;
    }
    .password-toggle { --color: #6c757d; }
    .password-hint {
      display: flex;
      gap: 12px;
      margin: 4px 0 12px;
      padding: 0 4px;
    }
    .password-hint span {
      font-size: 11px;
      color: #6c757d;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .password-hint span::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 8px;
      background: #e9ecef;
    }
    .password-hint span.valid { color: #198754; }
    .password-hint span.valid::before { background: #198754; }
    .primary-btn {
      --background: #002263;
      --color: #ffffff;
      --border-radius: 8px;
      font-weight: 600;
      height: 48px;
      margin-top: 8px;
    }
    .primary-btn:hover { --background: #001a4d; }
  `],
})
export class ChangePasswordPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);
  isLoading = signal(false);

  async ngOnInit(): Promise<void> {
    addIcons({
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      chevronBackOutline,
      checkmarkCircleOutline,
      shieldCheckmarkOutline,
    });
  }

  hasUpperCase(): boolean {
    return /[A-Z]/.test(this.newPassword);
  }

  hasNumber(): boolean {
    return /\d/.test(this.newPassword);
  }

  isValid(): boolean {
    return (
      this.currentPassword.length > 0 &&
      this.newPassword.length >= 8 &&
      this.hasUpperCase() &&
      this.hasNumber() &&
      this.newPassword === this.confirmPassword
    );
  }

  async submit(): Promise<void> {
    if (!this.isValid()) return;
    this.isLoading.set(true);

    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: async () => {
        this.isLoading.set(false);
        const toast = await this.toastCtrl.create({
          message: 'Password updated',
          duration: 2000,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        await this.modalCtrl.dismiss();
        this.router.navigate(['/tabs/profile']);
      },
      error: async (err) => {
        this.isLoading.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to update password',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
