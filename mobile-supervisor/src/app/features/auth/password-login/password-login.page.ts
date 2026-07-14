import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonInput,
  IonSpinner,
  IonBackButton,
  IonButtons,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  chevronBackOutline,
  arrowForwardOutline,
  shieldCheckmarkOutline,
  helpCircleOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-password-login',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonIcon,
    IonInput,
    IonSpinner,
    IonBackButton,
    IonButtons,
    FormsModule,
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/auth/login" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Log in</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="content">
      <div class="container">
        <div class="icon-circle">
          <ion-icon name="shield-checkmark-outline"></ion-icon>
        </div>
        <h1 class="title">Welcome back</h1>
        <p class="subtitle">Sign in with the email and password you set up.</p>

        <div class="form">
          <div class="form-field">
            <label class="form-label">Email</label>
            <div class="input-wrap">
              <ion-icon name="mail-outline" class="input-icon"></ion-icon>
              <ion-input
                type="email"
                inputmode="email"
                placeholder="you@agb.co"
                [(ngModel)]="email"
                autocomplete="email"
                [clearInput]="true"
              ></ion-input>
            </div>
          </div>

          <div class="form-field">
            <label class="form-label">Password</label>
            <div class="input-wrap">
              <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
              <ion-input
                [type]="showPassword() ? 'text' : 'password'"
                placeholder="Your password"
                [(ngModel)]="password"
                autocomplete="current-password"
              ></ion-input>
              <button
                type="button"
                class="eye-toggle"
                (click)="togglePassword()"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
              >
                <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
              </button>
            </div>
          </div>

          <div class="forgot-row">
            <button class="forgot-link" type="button" (click)="forgotPassword()">
              <ion-icon name="help-circle-outline"></ion-icon>
              Forgot password?
            </button>
          </div>

          <ion-button
            expand="block"
            class="primary-btn"
            [disabled]="!isFormValid() || isLoading()"
            (click)="submit()"
          >
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              <span>Log in</span>
              <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            }
          </ion-button>
        </div>

        <p class="switch-text">
          New here?
          <button class="switch-link" type="button" (click)="goToQR()">Sign in with QR</button>
        </p>
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-header {
      --background: var(--agb-white);
      --border-color: var(--agb-light-gray);
    }
    .content { --background: #f8f9fb; }
    .container {
      max-width: 440px;
      margin: 0 auto;
      padding: 32px 20px 24px;
      text-align: center;
    }
    .icon-circle {
      width: 72px;
      height: 72px;
      margin: 0 auto 18px;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(0, 34, 99, 0.10) 0%, rgba(0, 34, 99, 0.04) 100%);
      color: #002263;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-circle ion-icon { font-size: 32px; }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 6px;
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 24px;
      line-height: 1.5;
    }

    .form {
      background: #ffffff;
      border-radius: 20px;
      padding: 22px 18px;
      box-shadow: 0 4px 16px -6px rgba(15, 23, 42, 0.08);
      border: 1px solid #eef0f3;
      text-align: left;
    }
    .form-field { margin-bottom: 14px; }
    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      margin: 0 4px 6px;
      letter-spacing: 0.1px;
    }
    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      transition: border-color var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .input-wrap:focus-within {
      border-color: #002263;
      box-shadow: 0 0 0 4px rgba(0, 34, 99, 0.10);
      background: #ffffff;
    }
    .input-icon {
      color: #94a3b8;
      font-size: 18px;
      padding: 0 4px 0 14px;
      flex-shrink: 0;
    }
    .input-wrap ion-input {
      --background: transparent;
      --border-radius: 14px;
      --padding-start: 10px;
      --padding-end: 10px;
      --padding-top: 14px;
      --padding-bottom: 14px;
      --border-width: 0;
      --border-style: none;
      --border-color: transparent;
      min-height: 50px;
      flex: 1;
      box-shadow: none;
    }
    .input-wrap ion-input:focus-within { box-shadow: none; }
    .eye-toggle {
      background: transparent;
      border: 0;
      padding: 8px 12px;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .eye-toggle ion-icon { font-size: 20px; }

    .forgot-row {
      display: flex;
      justify-content: flex-end;
      margin: -4px 0 14px;
    }
    .forgot-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: 0;
      padding: 0;
      color: #002263;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
    }
    .forgot-link ion-icon { font-size: 14px; }
    .forgot-link:hover { text-decoration: underline; }

    .primary-btn {
      --background: #002263;
      --color: #ffffff;
      --border-radius: 14px;
      font-weight: 700;
      height: 52px;
      font-size: 15px;
      margin-top: 6px;
    }
    .primary-btn:hover { --background: #001a4d; }

    .switch-text {
      text-align: center;
      font-size: 13px;
      color: #64748b;
      margin: 22px 0 0;
    }
    .switch-link {
      background: transparent;
      border: 0;
      padding: 0 0 0 4px;
      color: #002263;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }
    .switch-link:hover { text-decoration: underline; }
  `],
})
export class PasswordLoginPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  email = '';
  password = '';
  showPassword = signal(false);
  isLoading = signal(false);

  async ngOnInit(): Promise<void> {
    addIcons({
      mailOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      chevronBackOutline,
      arrowForwardOutline,
      shieldCheckmarkOutline,
      helpCircleOutline,
    });
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  isFormValid(): boolean {
    return this.email.trim().includes('@') && this.password.length >= 6;
  }

  async submit(): Promise<void> {
    if (!this.isFormValid()) return;
    this.isLoading.set(true);
    this.auth.loginWithPassword(this.email.trim(), this.password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/tabs/dashboard']);
      },
      error: async (err) => {
        this.isLoading.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Invalid email or password',
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  goToQR(): void {
    this.router.navigate(['/auth/qr-scanner']);
  }

  forgotPassword(): void {
    this.router.navigate(['/auth/forgot-password']);
  }
}
