import { Component, signal, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonInput,
  IonButton,
  IonSpinner,
  IonToast,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  scanOutline,
  arrowBackOutline,
  timeOutline,
  refreshOutline,
  personOutline,
  mailOutline,
  lockClosedOutline,
  arrowForwardOutline,
  cloudOfflineOutline,
  callOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { NetworkService } from '../../core/services/network.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { environment } from '../../../environments/environment';

type Step = 'welcome' | 'login' | 'verifying' | 'otp' | 'signup';

interface QrPayload {
  token: string;
  supervisorName: string;
  supervisorPhone?: string;
  expiresAt: number;
}

const TEST_QR_PAYLOAD: QrPayload = {
  token: environment.testQrToken || 'AGB-DISABLED',
  supervisorName: environment.testQrSupervisorName || 'Supervisor',
  supervisorPhone: '+919876543210',
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonIcon,
    IonInput,
    IonButton,
    IonSpinner,
    IonToast,
  ],
  template: `
    <ion-content [fullscreen]="true" class="login-content">
      <div class="bg-decor"></div>

      <!-- ============ STEP: Welcome ============ -->
      <div *ngIf="step === 'welcome'" class="login-wrap">
        <div class="brand">
          <div class="brand-mark">AGB</div>
          <h1>Annai Golden Builders</h1>
          <p>Supervisor Console</p>
        </div>

        <div class="card welcome-card">
          <div class="welcome-headline">
            <ion-icon name="qr-code-outline"></ion-icon>
            <h2>First time here?</h2>
            <p>Scan the QR code from your admin to activate this device.</p>
          </div>

          <ion-button expand="block" class="agb-primary" (click)="startScan()" [disabled]="loading">
            <ion-icon name="scan-outline" slot="start"></ion-icon>
            <span *ngIf="!loading">Scan QR Code</span>
            <ion-spinner *ngIf="loading" name="dots"></ion-spinner>
          </ion-button>

          <div *ngIf="errorMessage" class="error-banner">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <span>{{ errorMessage }}</span>
          </div>

          <div class="hint">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <div>
              <strong>No camera or testing on an emulator?</strong>
              <button class="link-btn" (click)="useOfflineToken()">
                Use the offline test token instead
              </button>
            </div>
          </div>
        </div>

        <div class="divider">
          <span>or</span>
        </div>

        <div class="card login-card-compact" (click)="goToLogin()">
          <div class="login-card-inner">
            <div class="login-card-icon">
              <ion-icon name="person-outline"></ion-icon>
            </div>
            <div class="login-card-text">
              <strong>Already have an account?</strong>
              <span>Log in with your phone &amp; password</span>
            </div>
            <ion-icon name="chevron-forward-outline" class="login-card-chevron"></ion-icon>
          </div>
        </div>

        <div class="footer-meta">AGB Supervisor · v0.4.0-phase3</div>
      </div>

      <!-- ============ STEP: Login (existing supervisors) ============ -->
      <div *ngIf="step === 'login'" class="login-wrap">
        <button class="back-btn" (click)="reset()">
          <ion-icon name="arrow-back-outline"></ion-icon>
          <span>Back</span>
        </button>

        <div class="brand small">
          <div class="brand-mark small">AGB</div>
          <h2>Welcome back</h2>
          <p class="brand-sub">Log in to your supervisor account</p>
        </div>

        <div class="card login-form-card">
          <div class="form-field">
            <label>
              <ion-icon name="call-outline"></ion-icon>
              <span>Mobile Number</span>
            </label>
            <ion-input
              [(ngModel)]="loginPhone"
              placeholder="+91 XXXXX XXXXX"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
            ></ion-input>
          </div>

          <div class="form-field">
            <label>
              <ion-icon name="lock-closed-outline"></ion-icon>
              <span>Password</span>
            </label>
            <ion-input
              [(ngModel)]="loginPassword"
              type="password"
              placeholder="Enter your password"
              autocomplete="current-password"
            ></ion-input>
          </div>

          <div *ngIf="errorMessage" class="error-banner">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <span>{{ errorMessage }}</span>
          </div>

          <ion-button
            expand="block"
            class="agb-primary"
            (click)="loginExisting()"
            [disabled]="loading || !loginPhone || !loginPassword || !network.isOnline()"
          >
            <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            <span *ngIf="!loading">Log In</span>
            <ion-spinner *ngIf="loading" name="dots"></ion-spinner>
          </ion-button>

          <div class="forgot-link">
            <a (click)="onForgotPassword()">Forgot password?</a>
          </div>
        </div>

        <div class="divider">
          <span>need to activate?</span>
        </div>

        <ion-button expand="block" fill="clear" class="agb-text-btn" (click)="reset()">
          <ion-icon name="qr-code-outline" slot="start"></ion-icon>
          <span>Scan QR to activate a new device</span>
        </ion-button>

        <div class="footer-meta">AGB Supervisor · v0.4.0-phase3</div>
      </div>

      <!-- ============ STEP: Verifying ============ -->
      <div *ngIf="step === 'verifying'" class="login-wrap">
        <div class="brand small">
          <div class="brand-mark">AGB</div>
        </div>

        <div class="card verifying-card">
          <div class="spinner-wrap">
            <ion-spinner name="crescent" class="agb-spinner"></ion-spinner>
          </div>
          <h2>Verifying invite…</h2>
          <p>{{ verifyingMessage }}</p>
          <ion-button expand="block" fill="clear" class="agb-text-btn" (click)="reset()">
            <ion-icon name="arrow-back-outline" slot="start"></ion-icon>
            Cancel
          </ion-button>
        </div>
      </div>

      <!-- ============ STEP: OTP ============ -->
      <div *ngIf="step === 'otp'" class="login-wrap">
        <button class="back-btn" (click)="reset()">
          <ion-icon name="arrow-back-outline"></ion-icon>
        </button>

        <div class="brand small">
          <div class="brand-mark small">AGB</div>
          <h2>Verify your email</h2>
          <p class="brand-sub">Enter the 6-digit code sent to<br><strong>{{ inviteEmail || 'your email' }}</strong></p>
        </div>

        <div class="card">
          <div class="otp-label">One-Time Password</div>
          <div class="otp-inputs">
            <ion-input
              *ngFor="let i of [0,1,2,3,4,5]; let idx = index"
              #otpInput
              class="otp-digit"
              type="text"
              inputmode="numeric"
              maxlength="1"
              pattern="[0-9]*"
              autocomplete="off"
              [value]="otpDigits[idx]"
              (ionInput)="onOtpInput($event, idx)"
              (keydown)="onOtpKeydown($event, idx)"
              (ionBlur)="focusNext(idx)"
            ></ion-input>
          </div>

          <div class="otp-timer" [class.expired]="otpExpired()">
            <ion-icon name="time-outline"></ion-icon>
            <span *ngIf="!otpExpired()">{{ otpCountdown() }}</span>
            <span *ngIf="otpExpired()">Code expired · resend below</span>
          </div>

          <ion-button
            expand="block"
            class="agb-primary"
            (click)="verifyOtp()"
            [disabled]="loading || otpDigits.join('').length < 6 || !network.isOnline()"
          >
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            <span *ngIf="!loading">Verify & Continue</span>
            <ion-spinner *ngIf="loading" name="dots"></ion-spinner>
          </ion-button>

          <div *ngIf="!network.isOnline()" class="offline-note">
            <ion-icon name="cloud-offline-outline"></ion-icon>
            You appear offline · code was sent to your email
          </div>

          <button class="resend-btn" (click)="resendOtp()" [disabled]="resendCooldown() > 0">
            <ion-icon name="refresh-outline"></ion-icon>
            <span *ngIf="resendCooldown() === 0">Resend code</span>
            <span *ngIf="resendCooldown() > 0">Resend in {{ resendCooldown() }}s</span>
          </button>
        </div>

        <div *ngIf="errorMessage" class="error-banner">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <!-- ============ STEP: Signup ============ -->
      <div *ngIf="step === 'signup'" class="login-wrap">
        <button class="back-btn" (click)="goBackToOtp()">
          <ion-icon name="arrow-back-outline"></ion-icon>
        </button>

        <div class="brand small">
          <div class="brand-mark small">AGB</div>
          <h2>Welcome, {{ scannedName() }}</h2>
          <p class="brand-sub">Complete your account setup</p>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="head-icon success">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
            </div>
            <div>
              <h2>Set up your account</h2>
              <p>We've verified your invite. Add a password to continue.</p>
            </div>
          </div>

          <div class="form-field">
            <label>Full Name</label>
            <ion-input [(ngModel)]="signupName" placeholder="As per records" readonly></ion-input>
          </div>

          <div class="form-field">
            <label>Phone</label>
            <ion-input [(ngModel)]="signupPhone" placeholder="+91 XXXXX XXXXX" type="tel"></ion-input>
          </div>

          <div class="form-field">
            <label>Email (optional)</label>
            <ion-input [(ngModel)]="signupEmail" placeholder="you@example.com" type="email"></ion-input>
          </div>

          <div class="form-field">
            <label>Password <span class="hint-inline">· min 6 chars</span></label>
            <ion-input [(ngModel)]="signupPassword" type="password" placeholder="Create a strong password"></ion-input>
          </div>

          <ion-button
            expand="block"
            class="agb-primary"
            (click)="completeSignup()"
            [disabled]="loading || !signupPassword || signupPassword.length < 6 || !network.isOnline()"
          >
            <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            <span *ngIf="!loading">Activate & Continue</span>
            <ion-spinner *ngIf="loading" name="dots"></ion-spinner>
          </ion-button>

          <ion-button expand="block" fill="clear" class="agb-text-btn" (click)="reset()">
            Use a different QR code
          </ion-button>
        </div>
      </div>

      <!-- ============ Global error toast ============ -->
      <ion-toast
        [isOpen]="!!toastMessage()"
        [message]="toastMessage()"
        [color]="toastColor()"
        (didDismiss)="toastMessage.set('')"
        duration="3500"
        position="top"
      ></ion-toast>
    </ion-content>
  `,
  styles: [`
    .login-content { --background: var(--agb-gradient-primary); }
    .bg-decor {
      position: absolute; inset: 0;
      background:
        radial-gradient(circle at 20% 0%, rgba(255,255,255,0.10), transparent 40%),
        radial-gradient(circle at 100% 80%, rgba(201,162,39,0.18), transparent 45%);
      pointer-events: none;
    }
    .login-wrap {
      position: relative; min-height: 100%;
      display: flex; flex-direction: column; justify-content: center;
      padding: 28px 22px; gap: 22px;
    }
    .brand { text-align: center; color: #ffffff; padding-bottom: 6px; }
    .brand-mark {
      width: 64px; height: 64px; border-radius: 18px;
      background: var(--agb-gradient-gold); color: #2a230a;
      font-weight: 800; font-size: 22px; letter-spacing: 1px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 14px;
      box-shadow: 0 12px 28px rgba(0,0,0,0.30);
    }
    .brand-mark.small {
      width: 56px; height: 56px; border-radius: 16px; font-size: 18px; margin-bottom: 12px;
    }
    .brand.small h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .brand-sub { margin-top: 4px; font-size: 13px; opacity: 0.85; color: #ffffff; }
    .brand h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.3px; }
    .brand p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; letter-spacing: 0.4px; text-transform: uppercase; }

    .card {
      background: #ffffff; border-radius: var(--agb-radius-lg);
      padding: 22px 18px 18px;
      box-shadow: 0 24px 48px rgba(0,0,0,0.22);
    }
    .card-head { display: flex; gap: 14px; margin-bottom: 18px; }
    .head-icon {
      width: 48px; height: 48px; border-radius: 14px;
      background: rgba(0,34,99,0.10); color: var(--agb-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; flex-shrink: 0;
    }
    .head-icon.success {
      background: rgba(31,157,106,0.14); color: var(--agb-success);
    }
    .card-head h2 { margin: 2px 0 4px; font-size: 18px; font-weight: 700; color: var(--agb-text); }
    .card-head p { margin: 0; font-size: 13px; color: var(--agb-text-muted); line-height: 1.45; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-radius: 10px;
      background: rgba(216,68,58,0.10); color: var(--agb-danger);
      font-size: 13px; font-weight: 600; margin-top: 12px;
    }
    .hint {
      display: flex; gap: 8px; padding: 10px 12px;
      border-radius: 10px; background: rgba(0,34,99,0.05);
      color: var(--agb-text-muted); font-size: 11px; margin-top: 14px;
      line-height: 1.5; align-items: flex-start;
    }
    .hint ion-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
    .hint strong { color: var(--agb-text); display: block; margin-bottom: 2px; }
    .link-btn {
      background: none; border: none; padding: 0; margin: 0;
      color: var(--agb-primary); font-weight: 700; cursor: pointer;
      text-decoration: underline; font-size: 11px;
    }
    .agb-text-btn { --color: var(--agb-primary); font-weight: 600; text-transform: none; margin-top: 8px; }
    .footer-meta { text-align: center; color: rgba(255,255,255,0.65); font-size: 11px; padding: 6px; }

    /* Verifying */
    .verifying-card {
      display: flex; flex-direction: column; align-items: center;
      gap: 12px; text-align: center;
    }
    .spinner-wrap { display: flex; justify-content: center; margin-bottom: 8px; }
    .agb-spinner { width: 48px; height: 48px; color: var(--agb-primary); }
    .verifying-card h2 { margin: 0; font-size: 18px; font-weight: 700; color: var(--agb-text); }
    .verifying-card p { margin: 0; font-size: 13px; color: var(--agb-text-muted); }

    /* Back button */
    .back-btn {
      display: flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
      border-radius: 10px; padding: 6px 12px; color: #ffffff;
      font-size: 13px; font-weight: 600; cursor: pointer;
      align-self: flex-start;
    }
    .back-btn ion-icon { font-size: 18px; }

    /* OTP */
    .otp-label {
      text-align: center; font-size: 13px; font-weight: 600;
      color: var(--agb-text-muted); text-transform: uppercase;
      letter-spacing: 0.06em; margin-bottom: 16px;
    }
    .otp-inputs {
      display: flex; gap: 8px; justify-content: center; margin-bottom: 16px;
    }
    .otp-digit {
      width: 46px; height: 54px; border-radius: 10px;
      border: 2px solid #e6eaf2; background: #f8fafc;
      font-size: 20px; font-weight: 800; text-align: center;
      color: var(--agb-primary);
      --padding-start: 0; --padding-end: 0;
    }
    .otp-digit:focus-within {
      border-color: var(--agb-primary);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(0,34,99,0.12);
    }
    .otp-timer {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-size: 14px; font-weight: 600; color: var(--agb-text-muted);
      margin-bottom: 14px;
    }
    .otp-timer ion-icon { font-size: 16px; }
    .otp-timer.expired { color: var(--agb-danger); }

    .offline-note {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-size: 12px; color: var(--agb-text-muted); margin-bottom: 8px;
    }
    .offline-note ion-icon { font-size: 16px; }

    .resend-btn {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      width: 100%; margin-top: 8px; padding: 8px;
      background: none; border: none;
      color: var(--agb-primary); font-size: 13px; font-weight: 600;
      cursor: pointer;
    }
    .resend-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Signup form */
    .form-field {
      margin-bottom: 14px;
    }
    .form-field label {
      display: block; font-size: 11px; font-weight: 700;
      color: var(--agb-text-muted); text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 6px;
    }
    .hint-inline {
      font-weight: 400; text-transform: none; letter-spacing: 0;
      color: var(--agb-text-muted);
    }
    .form-field ion-input {
      --background: #f8fafc; --padding-start: 12px; --padding-end: 12px;
      --border-radius: 10px; border: 1.5px solid #e6eaf2;
      --highlight-color-focused: var(--agb-primary);
      font-size: 15px;
    }

    /* Welcome card with icon header */
    .welcome-card { padding: 24px 20px 20px; }
    .welcome-headline {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      text-align: center; margin-bottom: 20px;
    }
    .welcome-headline ion-icon {
      width: 56px; height: 56px; border-radius: 16px;
      background: rgba(0,34,99,0.10); color: var(--agb-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 30px; padding: 12px;
    }
    .welcome-headline h2 { margin: 4px 0 2px; font-size: 20px; font-weight: 700; color: var(--agb-text); }
    .welcome-headline p { margin: 0; font-size: 13px; color: var(--agb-text-muted); line-height: 1.45; max-width: 280px; }

    /* Divider */
    .divider {
      display: flex; align-items: center; gap: 12px;
      color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      padding: 4px 0;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.25);
    }

    /* Compact login card on welcome */
    .login-card-compact {
      padding: 0; cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .login-card-compact:hover { transform: translateY(-1px); }
    .login-card-compact:active { transform: scale(0.99); }
    .login-card-inner {
      display: flex; align-items: center; gap: 14px; padding: 16px 18px;
    }
    .login-card-icon {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      background: rgba(201,162,39,0.15); color: var(--agb-gold, #c9a227);
      display: flex; align-items: center; justify-content: center; font-size: 22px;
    }
    .login-card-text { flex: 1; min-width: 0; }
    .login-card-text strong { display: block; font-size: 15px; font-weight: 700; color: var(--agb-text); }
    .login-card-text span { display: block; font-size: 12px; color: var(--agb-text-muted); margin-top: 2px; }
    .login-card-chevron { font-size: 20px; color: var(--agb-text-muted); }

    /* Login form card */
    .login-form-card { padding: 22px 20px 20px; }

    /* Form field with icon */
    .form-field label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700;
      color: var(--agb-text-muted); text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 8px;
    }
    .form-field label ion-icon { font-size: 14px; }
    .form-field label span { display: inline-block; }

    /* Forgot password */
    .forgot-link {
      text-align: center; margin-top: 14px;
    }
    .forgot-link a {
      color: var(--agb-primary); font-size: 13px; font-weight: 600;
      cursor: pointer; text-decoration: none;
    }
    .forgot-link a:hover { text-decoration: underline; }
  `],
})
export class LoginPage implements OnInit, OnDestroy {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLIonInputElement>>;

  step: Step = 'welcome';
  loading = false;
  errorMessage = '';
  toastMessage = signal('');
  toastColor = signal<'danger' | 'success'>('danger');

  scannedName = signal('');
  scannedToken = signal('');
  inviteEmail = '';
  scannedOtpExpiry = 0;

  signupName = '';
  signupPhone = '';
  signupEmail = '';
  signupPassword = '';
  verifyingMessage = '';

  // Login state (existing supervisors)
  loginPhone = '';
  loginPassword = '';

  // OTP state
  otpDigits: string[] = ['', '', '', '', '', ''];
  otpCountdown = signal('05:00');
  otpExpired = signal(false);
  private otpTimer: any = null;
  private otpExpiry = 0;
  resendCooldown = signal(0);
  private resendTimer: any = null;

  constructor(
    private auth: AuthService,
    public network: NetworkService,
    private router: Router,
    private toastCtrl: ToastController,
  ) {
    addIcons({
      'qr-code-outline': qrCodeOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'alert-circle-outline': alertCircleOutline,
      'scan-outline': scanOutline,
      'arrow-back-outline': arrowBackOutline,
      'time-outline': timeOutline,
      'refresh-outline': refreshOutline,
      'person-outline': personOutline,
      'mail-outline': mailOutline,
      'lock-closed-outline': lockClosedOutline,
      'arrow-forward-outline': arrowForwardOutline,
      'cloud-offline-outline': cloudOfflineOutline,
      'call-outline': callOutline,
      'chevron-forward-outline': chevronForwardOutline,
    });
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.clearTimers();
  }

  // ============== Navigation helpers ==============
  goToLogin() {
    this.errorMessage = '';
    this.step = 'login';
  }

  onForgotPassword() {
    this.showToast('Please contact your administrator to reset your password.', 'danger');
  }

  // ============== Step 1: Scan QR ==============
  async startScan() {
    this.errorMessage = '';
    this.loading = true;
    try {
      const status = await BarcodeScanner.requestPermissions();
      if (status.camera !== 'granted') {
        this.errorMessage = 'Camera permission is required. Tap offline token below to skip.';
        this.loading = false;
        return;
      }
      const result = await BarcodeScanner.scan();
      const raw = result?.barcodes?.[0]?.rawValue;
      if (!raw) {
        this.errorMessage = 'No QR code captured. Please try again.';
        this.loading = false;
        return;
      }
      await this.processQr(raw);
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (msg.toLowerCase().includes('cancel')) {
        this.errorMessage = '';
      } else if (msg.toLowerCase().includes('unavailable')) {
        this.errorMessage = 'Scanner unavailable. Use the offline test token below.';
      } else {
        this.errorMessage = 'Scanner error: ' + msg;
      }
      this.loading = false;
    }
  }

  useOfflineToken() {
    this.processQr(JSON.stringify(TEST_QR_PAYLOAD));
  }

  // ============== Step 2: Process QR ==============
  private async processQr(raw: string) {
    let payload: QrPayload | null = null;
    try {
      payload = JSON.parse(raw) as QrPayload;
    } catch {
      payload = { token: raw.trim(), supervisorName: '', expiresAt: 0 };
    }

    if (!payload?.token) {
      this.errorMessage = 'Invalid QR code format.';
      this.loading = false;
      return;
    }

    if (payload.expiresAt && payload.expiresAt < Date.now()) {
      this.errorMessage = 'This invite has expired. Please ask your admin for a new one.';
      this.loading = false;
      return;
    }

    this.scannedToken.set(payload.token);
    this.scannedName.set(payload.supervisorName || 'Supervisor');
    this.verifyingMessage = 'Checking invite with server…';

    // Switch to verifying screen
    this.step = 'verifying';
    this.loading = false;

    try {
      const result = await this.auth.verifyInvite(payload.token);
      if (!result.valid) {
        this.showToast(result.message || 'Invalid or expired QR code.', 'danger');
        this.reset();
        return;
      }

      this.scannedName.set(result.supervisorName || this.scannedName());
      this.inviteEmail = result.supervisorEmail || this.inviteEmail;
      this.signupEmail = this.inviteEmail;
      this.signupName = this.scannedName();
      // Pre-fill phone from the invite (via server response) or from the QR payload
      const invitePhone = (result as any).supervisorPhone || payload.supervisorPhone || '';
      if (invitePhone) {
        this.signupPhone = invitePhone;
      }

      // Check if OTP is required
      if (result.requiresOtp) {
        this.step = 'otp';
        this.startOtpCountdown(5 * 60); // 5 min expiry
        this.startResendCooldown(30);
      } else {
        // No OTP required - go directly to signup
        this.step = 'signup';
      }
    } catch (e: any) {
      this.showToast('Cannot reach server. Check your connection.', 'danger');
      this.reset();
    }
  }

  // ============== Step 3: OTP verification ==============
  private startOtpCountdown(seconds: number) {
    this.clearTimers();
    this.otpExpiry = Date.now() + seconds * 1000;
    this.otpExpired.set(false);
    this.updateOtpCountdown();
    this.otpTimer = setInterval(() => this.updateOtpCountdown(), 1000);
  }

  private updateOtpCountdown() {
    const remaining = Math.max(0, this.otpExpiry - Date.now());
    if (remaining === 0) {
      this.otpExpired.set(true);
      this.otpCountdown.set('00:00');
      this.clearTimers();
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    this.otpCountdown.set(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
  }

  private startResendCooldown(seconds: number) {
    this.resendCooldown.set(seconds);
    clearInterval(this.resendTimer);
    this.resendTimer = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        this.resendCooldown.set(0);
        clearInterval(this.resendTimer);
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }

  async resendOtp() {
    if (this.resendCooldown() > 0) return;
    const res = await this.auth.resendInviteOtp(this.scannedToken());
    if (res.success) {
      this.startResendCooldown(30);
      this.startOtpCountdown(5 * 60);
      if (res.emailSent) {
        this.showToast('New OTP sent to supervisor email.', 'success');
      } else if (res.otp) {
        // Email delivery failed (e.g. SendGrid misconfigured / 403).
        // The backend still returns the OTP in development so the
        // supervisor can complete signup without an email.
        this.otpDigits = res.otp.split('');
        this.errorMessage = '';
        this.showToast(`Email delivery failed. OTP shown on screen: ${res.otp}`, 'danger');
      } else {
        this.showToast('New OTP generated. Check your email.', 'success');
      }
    } else {
      this.showToast(res.message || 'Failed to resend OTP.', 'danger');
    }
  }

  onOtpInput(event: any, index: number) {
    const value = event.target.value?.replace(/\D/g, '').slice(-1) || '';
    this.otpDigits[index] = value;
    if (value && index < 5) {
      setTimeout(() => {
        const inputs = this.otpInputs.toArray();
        if (inputs[index + 1]) {
          inputs[index + 1].nativeElement.getInputElement().then((el: HTMLInputElement) => el?.focus());
        }
      }, 50);
    }
    this.errorMessage = '';
  }

  onOtpKeydown(event: any, index: number) {
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      setTimeout(() => {
        const inputs = this.otpInputs.toArray();
        if (inputs[index - 1]) {
          inputs[index - 1].nativeElement.getInputElement().then((el: HTMLInputElement) => el?.focus());
        }
      }, 50);
    }
  }

  focusNext(index: number) {}

  async verifyOtp() {
    const otp = this.otpDigits.join('');
    if (otp.length < 6) {
      this.errorMessage = 'Please enter all 6 digits.';
      return;
    }
    if (this.otpExpired()) {
      this.errorMessage = 'Code expired. Resend a new one.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    try {
      const result = await this.auth.verifyInviteOtp(this.scannedToken(), otp);
      if (!result.valid) {
        this.errorMessage = result.message || 'Invalid code. Please try again.';
        this.loading = false;
        return;
      }
      this.step = 'signup';
      this.loading = false;
    } catch {
      this.errorMessage = 'Cannot verify. Check your connection.';
      this.loading = false;
    }
  }

  goBackToOtp() {
    this.step = 'otp';
    this.signupPassword = '';
  }

  // ============== Step 4: Complete signup ==============
  async completeSignup() {
    if (!this.signupPassword || this.signupPassword.length < 6) {
      this.showToast('Password must be at least 6 characters.', 'danger');
      return;
    }
    if (!this.signupPhone || this.signupPhone.replace(/\D/g, '').length < 8) {
      this.showToast('Please enter a valid mobile number.', 'danger');
      return;
    }
    this.loading = true;
    try {
      const otp = this.otpDigits.join('');
      const tokens = await this.auth.supervisorSignup({
        inviteToken: this.scannedToken(),
        otp,
        password: this.signupPassword,
        supervisorName: this.signupName || this.scannedName(),
        phone: this.signupPhone,
        email: this.signupEmail,
      });
      const displayName = (tokens as any)?.user?.name || this.scannedName();
      this.showToast('Welcome, ' + displayName + '!', 'success');
      setTimeout(() => this.router.navigate(['/tabs/home']), 800);
    } catch (e: any) {
      const errorMsg = e?.message || 'Signup failed. Please try again.';
      if (errorMsg.includes('already exists') || errorMsg.includes('409')) {
        this.showToast('An account with this email or phone already exists. Please contact your administrator.', 'danger');
      } else {
        this.showToast(errorMsg, 'danger');
      }
    } finally {
      this.loading = false;
    }
  }

  // ============== Step: Login (existing supervisors) ==============
  async loginExisting() {
    if (!this.loginPhone || this.loginPhone.replace(/\D/g, '').length < 8) {
      this.showToast('Please enter a valid mobile number.', 'danger');
      return;
    }
    if (!this.loginPassword || this.loginPassword.length < 6) {
      this.showToast('Password must be at least 6 characters.', 'danger');
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    try {
      const tokens = await this.auth.loginWithPassword(this.loginPhone, this.loginPassword);
      const displayName = (tokens as any)?.user?.name || 'Supervisor';
      this.showToast('Welcome back, ' + displayName + '!', 'success');
      setTimeout(() => this.router.navigate(['/tabs/home']), 800);
    } catch (e: any) {
      const errorMsg = e?.message || 'Login failed. Check your credentials.';
      if (errorMsg.includes('401') || errorMsg.toLowerCase().includes('invalid')) {
        this.showToast('Wrong phone number or password.', 'danger');
      } else if (errorMsg.includes('403') || errorMsg.toLowerCase().includes('deactivat')) {
        this.showToast('Your account has been deactivated. Contact your administrator.', 'danger');
      } else {
        this.showToast(errorMsg, 'danger');
      }
    } finally {
      this.loading = false;
    }
  }

  // ============== Helpers ==============
  private showToast(message: string, color: 'danger' | 'success') {
    this.toastMessage.set(message);
    this.toastColor.set(color);
    setTimeout(() => this.toastMessage.set(''), 3500);
  }

  reset() {
    this.step = 'welcome';
    this.loading = false;
    this.errorMessage = '';
    this.scannedToken.set('');
    this.scannedName.set('');
    this.signupName = '';
    this.signupPhone = '';
    this.signupEmail = '';
    this.signupPassword = '';
    this.loginPhone = '';
    this.loginPassword = '';
    this.otpDigits = ['', '', '', '', '', ''];
    this.clearTimers();
  }

  private clearTimers() {
    if (this.otpTimer) { clearInterval(this.otpTimer); this.otpTimer = null; }
    if (this.resendTimer) { clearInterval(this.resendTimer); this.resendTimer = null; }
  }
}