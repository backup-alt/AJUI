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
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  callOutline,
  arrowForwardOutline,
  keyOutline,
  checkmarkCircleOutline,
  timeOutline,
  chevronBackOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-otp-login',
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
          <ion-back-button default-href="/auth/login" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Sign in with OTP</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="otp-content">
      <div class="otp-container">
        @if (step() === 'request') {
          <div class="icon-circle">
            <ion-icon name="key-outline"></ion-icon>
          </div>
          <h1 class="title">Get a one-time code</h1>
          <p class="subtitle">
            We'll send a 6-digit code to your registered email or phone.
          </p>

          <div class="form">
            <ion-item class="agb-input">
              <ion-icon name="mail-outline" slot="start"></ion-icon>
              <ion-input
                type="text"
                inputmode="email"
                placeholder="Email or phone"
                [(ngModel)]="identifier"
                autocomplete="username"
                [clearInput]="true"
              ></ion-input>
            </ion-item>
            <ion-button
              expand="block"
              class="primary-btn"
              [disabled]="!identifier.trim() || isLoading()"
              (click)="requestOtp()"
            >
              @if (isLoading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
                <span>Send Code</span>
              }
            </ion-button>
          </div>
        }

        @if (step() === 'verify') {
          <div class="icon-circle">
            <ion-icon name="mail-outline"></ion-icon>
          </div>
          <h1 class="title">Enter the 6-digit code</h1>
          <p class="subtitle">
            Sent to <strong>{{ identifier }}</strong>
            <button class="link-btn" (click)="step.set('request')">change</button>
          </p>

          <div class="otp-inputs">
            @for (i of [0,1,2,3,4,5]; track i) {
              <ion-input
                type="text"
                inputmode="numeric"
                maxlength="1"
                class="otp-digit"
                [(ngModel)]="otpDigits[i]"
                (input)="onOtpInput($event, i)"
                (keydown)="onOtpKeyDown($event, i)"
              ></ion-input>
            }
          </div>

          <ion-button
            expand="block"
            class="primary-btn"
            [disabled]="!isOtpComplete() || isLoading()"
            (click)="verifyOtp()"
          >
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              <ion-icon name="checkmark-circle-outline" slot="end"></ion-icon>
              <span>Verify & Sign In</span>
            }
          </ion-button>

          <div class="resend-row">
            <span>Didn't get a code?</span>
            <button
              class="link-btn"
              (click)="requestOtp()"
              [disabled]="resendCooldown() > 0 || isLoading()"
            >
              @if (resendCooldown() > 0) {
                Resend in {{ resendCooldown() }}s
              } @else {
                Resend
              }
            </button>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-header {
      --background: var(--agb-white);
      --border-color: var(--agb-light-gray);
    }
    .otp-content {
      --background: #f8f9fa;
    }
    .otp-container {
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
    }
    .agb-input {
      --background: #f8f9fa;
      --border-radius: 8px;
      --padding-start: 12px;
      --padding-end: 12px;
      margin-bottom: 16px;
    }
    .primary-btn {
      --background: #002263;
      --color: #ffffff;
      --border-radius: 8px;
      font-weight: 600;
      height: 48px;
    }
    .primary-btn:hover { --background: #001a4d; }

    .otp-inputs {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin: 8px 0 24px;
    }
    .otp-digit {
      width: 48px;
      height: 56px;
      text-align: center;
      font-size: 24px;
      font-weight: 700;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      --padding-start: 0;
      --padding-end: 0;
    }
    .otp-digit:focus-within { border-color: #002263; }

    .resend-row {
      margin-top: 16px;
      font-size: 13px;
      color: #6c757d;
      display: flex;
      gap: 6px;
      justify-content: center;
      align-items: center;
    }
    .link-btn {
      background: transparent;
      border: 0;
      padding: 0;
      color: #002263;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }
    .link-btn:disabled {
      color: #9ca3af;
      text-decoration: none;
      cursor: default;
    }
  `],
})
export class OtpLoginPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  step = signal<'request' | 'verify'>('request');
  identifier = '';
  otpDigits: string[] = ['', '', '', '', '', ''];
  isLoading = signal(false);
  resendCooldown = signal(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    addIcons({
      mailOutline,
      callOutline,
      arrowForwardOutline,
      keyOutline,
      checkmarkCircleOutline,
      timeOutline,
      chevronBackOutline,
    });
  }

  isOtpComplete(): boolean {
    return this.otpDigits.every((d) => d && d.length === 1);
  }

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 1);
    this.otpDigits[index] = value;
    if (value && index < 5) {
      const next = input.nextElementSibling as HTMLInputElement | null;
      next?.focus();
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      const prev = (event.target as HTMLInputElement).previousElementSibling as HTMLInputElement | null;
      prev?.focus();
    }
  }

  async requestOtp(): Promise<void> {
    if (!this.identifier.trim()) return;
    this.isLoading.set(true);
    this.auth.requestLoginOtp(this.identifier.trim()).subscribe({
      next: async () => {
        this.isLoading.set(false);
        this.step.set('verify');
        this.startCooldown(30);
        const toast = await this.toastCtrl.create({
          message: 'Code sent to your email/phone',
          duration: 2000,
          position: 'top',
          color: 'success',
        });
        await toast.present();
      },
      error: async (err) => {
        this.isLoading.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to send code',
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  async verifyOtp(): Promise<void> {
    const otp = this.otpDigits.join('');
    if (otp.length !== 6) return;
    this.isLoading.set(true);
    this.auth.verifyLoginOtp(this.identifier.trim(), otp).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/tabs/dashboard']);
      },
      error: async (err) => {
        this.isLoading.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Invalid code',
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  private startCooldown(seconds: number): void {
    this.resendCooldown.set(seconds);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const cur = this.resendCooldown();
      if (cur <= 1) {
        this.resendCooldown.set(0);
        if (this.cooldownTimer) {
          clearInterval(this.cooldownTimer);
          this.cooldownTimer = null;
        }
      } else {
        this.resendCooldown.set(cur - 1);
      }
    }, 1000);
  }
}
