import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonIcon,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline,
  mailOutline,
  shieldCheckmarkOutline,
  chevronForwardOutline,
  constructOutline,
  sparklesOutline,
  callOutline,
  locationOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, IonIcon],
  template: `
    <ion-content class="login-content">
      <div class="login-shell">
        <div class="hero">
          <div class="brand">
            <div class="brand-logo">
              <img src="assets/logo.png" alt="AGB" />
            </div>
            <div class="brand-meta">
              <span class="brand-name">Annai Golden Builders</span>
              <span class="brand-tag">Supervisor Portal</span>
            </div>
          </div>
          <div class="hero-content">
            <h1 class="hero-title">Welcome back, builder.</h1>
            <p class="hero-sub">
              Sign in to manage your sites, materials, labour and expenses in one place.
            </p>
            <div class="hero-bullets">
              <div class="bullet">
                <span class="bullet-icon"><ion-icon name="location-outline"></ion-icon></span>
                <span>Track every site in real time</span>
              </div>
              <div class="bullet">
                <span class="bullet-icon"><ion-icon name="construct-outline"></ion-icon></span>
                <span>Materials, labour and expenses synced</span>
              </div>
              <div class="bullet">
                <span class="bullet-icon"><ion-icon name="sparkles-outline"></ion-icon></span>
                <span>Approvals updated instantly</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card-stack">
          <div class="auth-card">
            <div class="card-eyebrow">
              <span class="dot"></span>
              <span>Sign in</span>
            </div>
            <h2 class="card-title">Choose how to sign in</h2>
            <p class="card-sub">Pick the option that fits the way you were onboarded.</p>

            <button
              class="action-tile primary"
              type="button"
              (click)="goToQR()"
              [disabled]="isLoading()"
            >
              <span class="tile-icon">
                <ion-icon name="qr-code-outline"></ion-icon>
              </span>
              <span class="tile-body">
                <span class="tile-title">Sign in with QR</span>
                <span class="tile-sub">Scan the invite QR from your admin</span>
              </span>
              <span class="tile-chev"><ion-icon name="chevron-forward-outline"></ion-icon></span>
            </button>

<button
              class="action-tile"
              type="button"
              (click)="goToLogin()"
              [disabled]="isLoading()"
            >
              <span class="tile-icon tile-icon-soft">
                <ion-icon name="mail-outline"></ion-icon>
              </span>
              <span class="tile-body">
                <span class="tile-title">Log in with OTP</span>
                <span class="tile-sub">Get a code to your email or phone</span>
              </span>
              <span class="tile-chev"><ion-icon name="chevron-forward-outline"></ion-icon></span>
            </button>

            <div class="divider">
              <span>or</span>
            </div>

            <button class="link-action" type="button" (click)="openManualToken()">
              Enter invite token manually
            </button>
          </div>

          <div class="invite-hint">
            <span class="hint-icon"><ion-icon name="call-outline"></ion-icon></span>
            <div>
              <strong>You can also log in by clicking the invite link in your email.</strong>
              <span>Just tap <em>Create Account</em> from the email and the app will open with your details pre-filled.</span>
            </div>
          </div>

          <div class="trust">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <span>Secure supervisor access - AGB internal</span>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-content {
      --background: #f5f6f8;
    }
    .login-shell {
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }

    /* Hero */
    .hero {
      position: relative;
      background: #002263;
      color: #ffffff;
      padding: 56px 24px 110px;
      overflow: hidden;
    }

    .brand {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
    }
    .brand-logo {
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
    }
    .brand-logo img { width: 32px; height: 32px; object-fit: contain; }
    .brand-meta { display: flex; flex-direction: column; line-height: 1.2; }
    .brand-name { font-weight: 700; font-size: 14px; }
    .brand-tag { font-size: 10px; opacity: 0.75; letter-spacing: 0.6px; text-transform: uppercase; }

    .hero-content { position: relative; }
    .hero-title {
      font-size: 30px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.5px;
      margin: 0 0 12px;
    }
    .hero-sub {
      font-size: 14px;
      line-height: 1.55;
      opacity: 0.85;
      margin: 0 0 24px;
      max-width: 360px;
    }
    .hero-bullets { display: flex; flex-direction: column; gap: 10px; }
    .bullet {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.92);
    }
    .bullet-icon {
      width: 28px;
      height: 28px;
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.14);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bullet-icon ion-icon { font-size: 14px; color: #c9a227; }

    /* Card */
    .card-stack {
      margin: -70px 16px 24px;
      position: relative;
      z-index: 2;
    }
    .auth-card {
      background: #ffffff;
      border-radius: 24px;
      padding: 24px 20px;
      box-shadow: 0 18px 48px -16px rgba(15, 23, 42, 0.20);
      border: 1px solid rgba(255, 255, 255, 0.6);
    }
    .card-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 6px;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #16a34a; }
    .card-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px;
      letter-spacing: -0.2px;
    }
    .card-sub {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 20px;
      line-height: 1.5;
    }

    .action-tile {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      text-align: left;
      cursor: pointer;
      margin-bottom: 12px;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast), background var(--agb-transition-fast);
      font-family: inherit;
    }
    .action-tile:hover { background: #f1f5f9; }
    .action-tile:active { transform: scale(0.99); }
    .action-tile.primary {
      background: var(--agb-gradient-primary);
      border-color: transparent;
      color: #ffffff;
      box-shadow: 0 10px 24px -10px rgba(0, 34, 99, 0.55);
    }
    .action-tile.primary:hover {
      background: #001a4d;
    }
    .tile-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .tile-icon.soft, .tile-icon-soft {
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
    }
    .tile-icon ion-icon { font-size: 22px; }
    .tile-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .tile-title { font-size: 15px; font-weight: 700; }
    .tile-sub { font-size: 12px; opacity: 0.85; margin-top: 2px; }
    .tile-chev { color: inherit; opacity: 0.6; display: flex; align-items: center; }
    .tile-chev ion-icon { font-size: 20px; }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 4px 0 8px;
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }
    .divider span {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .link-action {
      width: 100%;
      background: transparent;
      border: 0;
      padding: 10px 0;
      color: #002263;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
    }
    .link-action:hover { text-decoration: underline; }

    .invite-hint {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-top: 16px;
      padding: 14px 16px;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      box-shadow: var(--agb-shadow-2xs);
    }
    .hint-icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .hint-icon ion-icon { font-size: 18px; }
    .invite-hint strong { display: block; font-size: 13px; color: #0f172a; }
    .invite-hint span {
      display: block;
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
      line-height: 1.5;
    }
    .invite-hint em { font-style: normal; color: #002263; font-weight: 600; }

    .trust {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 20px;
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 0.4px;
    }
    .trust ion-icon { font-size: 14px; }
  `],
})
export class LoginPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  isLoading = signal(false);

  async ngOnInit(): Promise<void> {
    addIcons({
      qrCodeOutline,
      mailOutline,
      shieldCheckmarkOutline,
      chevronForwardOutline,
      constructOutline,
      sparklesOutline,
      callOutline,
      locationOutline,
    });
  }

  goToQR(): void {
    this.router.navigate(['/auth/qr-scanner']);
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login-with-otp']);
  }

  openManualToken(): void {
    this.router.navigate(['/auth/manual-token']);
  }
}
