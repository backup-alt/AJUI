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
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  arrowForwardOutline,
  checkmarkCircleOutline,
  timeOutline,
  chevronBackOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-otp',
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
        <ion-title>Verify invite</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="content">
      <div class="container">
        <div class="icon-circle">
          <ion-icon name="mail-outline"></ion-icon>
        </div>
        <h1 class="title">Enter the 6-digit code</h1>
        <p class="subtitle">
          We sent a code to your registered email to verify this invite.
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
          [disabled]="!isComplete() || isVerifying()"
          (click)="verify()"
        >
          @if (isVerifying()) {
            <ion-spinner name="crescent"></ion-spinner>
          } @else {
            <ion-icon name="checkmark-circle-outline" slot="end"></ion-icon>
            <span>Verify & Continue</span>
          }
        </ion-button>

        <div class="resend-row">
          <span>Didn't get a code?</span>
          <button
            class="link-btn"
            (click)="resend()"
            [disabled]="resendCooldown() > 0 || isVerifying()"
          >
            @if (resendCooldown() > 0) {
              Resend in {{ resendCooldown() }}s
            } @else {
              Resend
            }
          </button>
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
    .primary-btn {
      --background: #002263;
      --color: #ffffff;
      --border-radius: 8px;
      font-weight: 600;
      height: 48px;
    }
    .primary-btn:hover { --background: #001a4d; }
    .resend-row {
      margin-top: 16px;
      font-size: 13px;
      color: #6c757d;
      display: flex;
      gap: 6px;
      justify-content: center;
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
    .link-btn:disabled { color: #9ca3af; text-decoration: none; cursor: default; }
  `],
})
export class VerifyOtpPage implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  token = '';
  otpDigits: string[] = ['', '', '', '', '', ''];
  isVerifying = signal(false);
  resendCooldown = signal(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    addIcons({
      mailOutline,
      arrowForwardOutline,
      checkmarkCircleOutline,
      timeOutline,
      chevronBackOutline,
    });
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  isComplete(): boolean {
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

  async verify(): Promise<void> {
    const otp = this.otpDigits.join('');
    if (otp.length !== 6) return;
    this.isVerifying.set(true);
    this.auth.verifyOtp(this.token, otp).subscribe({
      next: () => {
        this.isVerifying.set(false);
        this.router.navigate(['/auth/signup'], {
          queryParams: { token: this.token, otp },
        });
      },
      error: async (err) => {
        this.isVerifying.set(false);
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

  async resend(): Promise<void> {
    if (this.resendCooldown() > 0) return;
    this.auth.resendInviteOtp(this.token).subscribe({
      next: async () => {
        this.startCooldown(30);
        const toast = await this.toastCtrl.create({
          message: 'Code resent',
          duration: 2000,
          position: 'top',
          color: 'success',
        });
        await toast.present();
      },
      error: async (err) => {
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to resend code',
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
