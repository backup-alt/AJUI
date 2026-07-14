import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonSpinner,
  IonBackButton,
  IonButtons,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  callOutline,
  eyeOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  shieldCheckmarkOutline,
  arrowForwardOutline,
  timeOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';
import { OtpInputComponent } from '../../../shared/components';

@Component({
  selector: 'app-login-with-otp',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonIcon,
    IonSpinner,
    IonBackButton,
    IonButtons,
    FormsModule,
    OtpInputComponent,
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/auth/login" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Log in with OTP</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="content">
      <div class="container">
        @if (state() === 'request') {
          <div class="icon-circle">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
          </div>
          <h1 class="title">Verify your identity</h1>
          <p class="subtitle">
            Enter your registered email or phone number. We'll send you a one-time code to log in.
          </p>

          <div class="form">
            <div class="form-field">
              <label class="form-label">Email or phone</label>
              <div class="input-wrap">
                <ion-icon
                  [name]="isPhone() ? 'call-outline' : 'mail-outline'"
                  class="input-icon"
                ></ion-icon>
                <input
                  class="text-input"
                  [type]="isPhone() ? 'tel' : 'email'"
                  [placeholder]="isPhone() ? '9876543210' : 'you@agb.co'"
                  [(ngModel)]="identifier"
                  (ngModelChange)="onIdentifierChange($event)"
                  autocomplete="off"
                />
              </div>
            </div>

            <ion-button
              expand="block"
              class="primary-btn"
              [disabled]="!isFormValid() || isLoading()"
              (click)="requestOtp()"
            >
              @if (isLoading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                <span>Send code</span>
                <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
              }
            </ion-button>
          </div>

          <p class="hint">
            <ion-icon name="time-outline"></ion-icon>
            Code expires in 10 minutes. Check your email or phone.
          </p>
        } @else if (state() === 'verify') {
          <div class="icon-circle success">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </div>
          <h1 class="title">Enter the code</h1>
          <p class="subtitle">
            We sent a 6-digit code to <strong>{{ maskIdentifier() }}</strong>
          </p>

          <div class="otp-wrap">
            <agb-otp-input
              [length]="6"
              [(digits)]="otpDigits"
              (digitsChange)="onOtpChange($event)"
            ></agb-otp-input>
          </div>

          @if (errorMessage()) {
            <p class="error-text">{{ errorMessage() }}</p>
          }

          <ion-button
            expand="block"
            class="primary-btn"
            [disabled]="otpDigits().length < 6 || isLoading()"
            (click)="verifyOtp()"
          >
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              <span>Verify & log in</span>
              <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            }
          </ion-button>

          <div class="resend-row">
            <span class="resend-text">Didn't get it?</span>
            <button class="resend-btn" type="button" (click)="requestOtp()" [disabled]="resendCooldown() > 0">
              @if (resendCooldown() > 0) {
                Resend in {{ resendCooldown() }}s
              } @else {
                Resend code
              }
            </button>
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
      padding: 32px 20px 24px;
      text-align: center;
    }
    .icon-circle {
      width: 72px; height: 72px; margin: 0 auto 18px;
      border-radius: 22px;
      background: rgba(0, 34, 99, 0.10);
      color: #002263; display: flex; align-items: center; justify-content: center;
    }
    .icon-circle.success {
      background: rgba(22, 163, 74, 0.12);
      color: #15803d;
    }
    .icon-circle ion-icon { font-size: 32px; }
    .title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 8px; letter-spacing: -0.3px; }
    .subtitle { font-size: 14px; color: #64748b; margin: 0 0 24px; line-height: 1.5; }

    .form {
      background: #ffffff; border-radius: 20px; padding: 22px 18px;
      box-shadow: 0 4px 16px -6px rgba(15, 23, 42, 0.08);
      border: 1px solid #eef0f3; text-align: left;
    }
    .form-field { margin-bottom: 14px; }
    .form-label {
      display: block; font-size: 12px; font-weight: 600;
      color: #475569; margin: 0 4px 6px;
    }
    .input-wrap {
      display: flex; align-items: center;
      background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px;
      transition: border-color var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .input-wrap:focus-within {
      border-color: #002263; box-shadow: 0 0 0 4px rgba(0, 34, 99, 0.10); background: #ffffff;
    }
    .input-icon { color: #94a3b8; font-size: 18px; padding: 0 4px 0 14px; flex-shrink: 0; }
    .text-input {
      flex: 1; background: transparent; border: none; outline: none;
      padding: 14px 14px 14px 10px; font-size: 15px;
      font-family: inherit; color: #0f172a;
      min-height: 50px;
    }
    .text-input::placeholder { color: #94a3b8; }

    .primary-btn {
      --background: #002263; --color: #ffffff; --border-radius: 14px;
      font-weight: 700; height: 52px; margin-top: 8px;
    }
    .primary-btn:hover { --background: #001a4d; }

    .hint {
      font-size: 12px; color: #94a3b8; margin: 14px 0 0;
      display: flex; align-items: center; justify-content: center; gap: 4px;
    }
    .hint ion-icon { font-size: 14px; }

    .otp-wrap { margin-bottom: 20px; }
    .error-text { font-size: 13px; color: #dc2626; margin: 0 0 12px; font-weight: 600; }

    .resend-row {
      display: flex; align-items: center; justify-content: center;
      gap: 6px; margin-top: 16px;
    }
    .resend-text { font-size: 13px; color: #64748b; }
    .resend-btn {
      background: transparent; border: none; padding: 0;
      color: #002263; font-weight: 700; font-size: 13px;
      cursor: pointer; font-family: inherit;
    }
    .resend-btn:disabled { color: #94a3b8; cursor: not-allowed; }
  `],
})
export class LoginWithOtpPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  state = signal<'request' | 'verify'>('request');
  identifier = '';
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  otpDigits = signal<string[]>([]);
  resendCooldown = signal(0);

  private resendInterval: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    addIcons({
      mailOutline,
      callOutline,
      eyeOutline,
      checkmarkCircleOutline,
      chevronBackOutline,
      shieldCheckmarkOutline,
      arrowForwardOutline,
      timeOutline,
    });
  }

  onIdentifierChange(value: string): void {
    this.identifier = value;
    this.errorMessage.set(null);
  }

  isPhone(): boolean {
    return /^\+?[\d\s\-()]{8,}$/.test(this.identifier.trim());
  }

  isFormValid(): boolean {
    const id = this.identifier.trim();
    return id.length >= 3 && (id.includes('@') || /^\+?[\d]{8,}$/.test(id));
  }

  maskIdentifier(): string {
    const id = this.identifier.trim();
    if (id.includes('@')) {
      const [local, domain] = id.split('@');
      return local.substring(0, 2) + '***@' + domain;
    }
    return id.substring(0, 3) + '****' + id.substring(id.length - 3);
  }

  async requestOtp(): Promise<void> {
    if (!this.isFormValid()) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.auth.requestLoginOtp(this.identifier.trim()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.state.set('verify');
        this.startResendCooldown();
      },
      error: async (err) => {
        this.isLoading.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to send code. Please try again.',
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  onOtpChange(digits: string[]): void {
    this.otpDigits.set(digits);
    if (digits.every((d) => d) && digits.length === 6) {
      this.verifyOtp();
    }
  }

  async verifyOtp(): Promise<void> {
    const digits = this.otpDigits();
    const code = digits.join('');
    if (code.length < 6) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.auth.verifyLoginOtp(this.identifier.trim(), code).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/tabs/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.message || 'Invalid code. Please try again.');
        this.otpDigits.set(['', '', '', '', '', '']);
      },
    });
  }

  private startResendCooldown(): void {
    this.resendCooldown.set(60);
    if (this.resendInterval) clearInterval(this.resendInterval);
    this.resendInterval = setInterval(() => {
      const next = this.resendCooldown() - 1;
      if (next <= 0) {
        this.resendCooldown.set(0);
        if (this.resendInterval) clearInterval(this.resendInterval);
      } else {
        this.resendCooldown.set(next);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.resendInterval) clearInterval(this.resendInterval);
  }
}