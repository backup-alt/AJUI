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
  chevronBackOutline,
  arrowForwardOutline,
  checkmarkCircleOutline,
  keyOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
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
          <ion-back-button default-href="/auth/password-login" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Reset password</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="content">
      <div class="container">
        @if (sent()) {
          <div class="icon-circle success">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </div>
          <h1 class="title">Check your email</h1>
          <p class="subtitle">
            We've sent a password reset link to <strong>{{ email }}</strong>.
            Open the email and tap <em>Reset Password</em> to continue.
          </p>
          <div class="actions-row">
            <ion-button expand="block" class="primary-btn" (click)="goToLogin()">
              <span>Back to login</span>
            </ion-button>
            <button class="resend-link" type="button" (click)="reset()">
              Didn't get the email? Try again
            </button>
          </div>
        } @else {
          <div class="icon-circle">
            <ion-icon name="key-outline"></ion-icon>
          </div>
          <h1 class="title">Forgot your password?</h1>
          <p class="subtitle">
            Enter your registered email and we'll send a <em>Reset Password</em> link to set a new one.
          </p>

          <div class="form">
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

            <ion-button
              expand="block"
              class="primary-btn"
              [disabled]="!isEmailValid() || isLoading()"
              (click)="submit()"
            >
              @if (isLoading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                <span>Send reset link</span>
                <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
              }
            </ion-button>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); --border-color: var(--agb-light-gray); }
    .content { --background: #f8f9fb; }
    .container {
      max-width: 440px;
      margin: 0 auto;
      padding: 32px 20px;
      text-align: center;
    }
    .icon-circle {
      width: 72px;
      height: 72px;
      margin: 0 auto 18px;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(0, 34, 99, 0.10), rgba(0, 34, 99, 0.04));
      color: #002263;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-circle ion-icon { font-size: 32px; }
    .icon-circle.success {
      background: linear-gradient(135deg, rgba(22, 163, 74, 0.14), rgba(22, 163, 74, 0.04));
      color: #15803d;
    }
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
    .subtitle em, .subtitle strong { color: #0f172a; font-style: normal; font-weight: 700; }
    .form {
      background: #ffffff;
      border-radius: 20px;
      padding: 22px 18px;
      box-shadow: 0 4px 16px -6px rgba(15, 23, 42, 0.08);
      border: 1px solid #eef0f3;
      text-align: left;
    }
    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      margin: 0 4px 6px;
    }
    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      margin-bottom: 16px;
    }
    .input-wrap:focus-within {
      border-color: #002263;
      box-shadow: 0 0 0 4px rgba(0, 34, 99, 0.10);
      background: #ffffff;
    }
    .input-icon { color: #94a3b8; font-size: 18px; padding: 0 4px 0 14px; }
    .input-wrap ion-input {
      --background: transparent;
      --border-radius: 14px;
      --padding-start: 10px;
      --padding-end: 10px;
      --padding-top: 14px;
      --padding-bottom: 14px;
      --border-width: 0;
      --border-style: none;
      min-height: 50px;
      flex: 1;
    }
    .primary-btn {
      --background: #002263;
      --color: #ffffff;
      --border-radius: 14px;
      font-weight: 700;
      height: 52px;
    }
    .primary-btn:hover { --background: #001a4d; }
    .actions-row { margin-top: 8px; }
    .resend-link {
      background: transparent;
      border: 0;
      padding: 14px 0 0;
      color: #002263;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
    }
    .resend-link:hover { text-decoration: underline; }
  `],
})
export class ForgotPasswordPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  email = '';
  isLoading = signal(false);
  sent = signal(false);

  async ngOnInit(): Promise<void> {
    addIcons({
      mailOutline,
      chevronBackOutline,
      arrowForwardOutline,
      checkmarkCircleOutline,
      keyOutline,
    });
  }

  isEmailValid(): boolean {
    return this.email.trim().includes('@');
  }

  async submit(): Promise<void> {
    if (!this.isEmailValid()) return;
    this.isLoading.set(true);
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.sent.set(true);
      },
      error: async (err) => {
        this.isLoading.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to send reset link',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }

  reset(): void {
    this.sent.set(false);
    this.email = '';
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
