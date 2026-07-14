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
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  arrowForwardOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';
import { OtpInputComponent } from '../../../shared/components';

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
    IonSpinner,
    IonBackButton,
    IonButtons,
    OtpInputComponent,
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
          <ion-icon name="shield-checkmark-outline"></ion-icon>
        </div>
        <h1 class="title">Enter the 6-digit code</h1>
        <p class="subtitle">
          We sent a one-time code to your email to verify this invite.
        </p>

        <agb-otp-input [(digits)]="otpDigits" [length]="6"></agb-otp-input>

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
            <span>Verify &amp; continue</span>
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
              Resend code
            }
          </button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); --border-color: var(--agb-light-gray); }
    .content { --background: #f8f9fb; }
    .container { max-width: 440px; margin: 0 auto; padding: 32px 20px; text-align: center; }
    .icon-circle {
      width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 22px;
      background: linear-gradient(135deg, rgba(0, 34, 99, 0.10), rgba(0, 34, 99, 0.04));
      color: #002263; display: flex; align-items: center; justify-content: center;
    }
    .icon-circle ion-icon { font-size: 32px; }
    .title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.3px; }
    .subtitle { font-size: 14px; color: #64748b; margin: 0 0 24px; line-height: 1.5; }
    agb-otp-input { display: block; margin: 0 0 24px; }
    .primary-btn {
      --background: #002263; --color: #ffffff; --border-radius: 14px;
      font-weight: 700; height: 52px;
    }
    .primary-btn:hover { --background: #001a4d; }
    .resend-row {
      margin-top: 20px; font-size: 13px; color: #64748b;
      display: flex; gap: 6px; justify-content: center; align-items: center;
    }
    .link-btn {
      background: transparent; border: 0; padding: 0;
      color: #002263; font-weight: 700; cursor: pointer; font-family: inherit;
    }
    .link-btn:disabled { color: #94a3b8; cursor: default; }
    .link-btn:not(:disabled):hover { text-decoration: underline; }
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
      chevronBackOutline,
      shieldCheckmarkOutline,
    });
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  isComplete(): boolean {
    return this.otpDigits.every((d) => d && d.length === 1);
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
          message: 'Code resent to your email',
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
