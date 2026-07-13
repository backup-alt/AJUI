import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonSpinner,
  ToastController,
  ModalController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline,
  personOutline,
  lockClosedOutline,
  arrowForwardOutline,
  shieldCheckmarkOutline,
  mailOutline,
  timeOutline,
  keyOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonSpinner,
    FormsModule,
  ],
  template: `
    <ion-content class="login-content">
      <div class="login-container">
        <div class="login-header-bg">
          <div class="header-content">
            <div class="logo-container">
              <img src="assets/logo.png" alt="AGB Logo" class="brand-logo" />
            </div>
            <div class="brand-text">
              <h1 class="brand-name">Annai Golden Builders</h1>
              <p class="brand-tagline">Supervisor Portal</p>
            </div>
          </div>
          <div class="header-shape shape-1"></div>
          <div class="header-shape shape-2"></div>
        </div>

        <div class="login-card">
          <div class="card-header">
            <h2 class="card-title">Welcome</h2>
            <p class="card-subtitle">
              Choose how you'd like to sign in to your supervisor account.
            </p>
          </div>

          <div class="actions">
            <ion-button
              expand="block"
              class="primary-btn"
              [disabled]="isLoading()"
              (click)="scanQRCode()"
            >
              @if (isLoading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                <ion-icon name="qr-code-outline" slot="start"></ion-icon>
                <span>Scan QR Code</span>
                <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
              }
            </ion-button>

            <ion-button
              expand="block"
              class="secondary-btn"
              [disabled]="isLoading()"
              (click)="openOtpLogin()"
            >
              <ion-icon name="key-outline" slot="start"></ion-icon>
              <span>Sign in with OTP</span>
            </ion-button>

            <div class="divider">
              <span>or</span>
            </div>

            <ion-button
              expand="block"
              fill="clear"
              class="text-btn"
              [disabled]="isLoading()"
              (click)="openManualToken()"
            >
              Use invite token
            </ion-button>
          </div>

          <p class="email-hint">
            <ion-icon name="mail-outline"></ion-icon>
            Or open the invite link from your email to start.
          </p>
        </div>

        <div class="security-note">
          <ion-icon name="shield-checkmark-outline"></ion-icon>
          <span>Secure supervisor access only</span>
        </div>

        <div class="login-footer">
          <p class="footer-text">Internal use only. AGB (Annai Golden Builders)</p>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-content {
      --background: #f8f9fa;
    }
    .login-container {
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }

    .login-header-bg {
      background: linear-gradient(135deg, #002263 0%, #003380 50%, #004d99 100%);
      padding: 40px 24px 60px;
      position: relative;
      overflow: hidden;
    }
    .header-content {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .logo-container {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
    .brand-logo {
      width: 56px;
      height: 56px;
      object-fit: contain;
    }
    .brand-text {
      text-align: center;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 4px;
      letter-spacing: 0.3px;
    }
    .brand-tagline {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 500;
    }
    .header-shape {
      position: absolute;
      border-radius: 50%;
      opacity: 0.1;
    }
    .shape-1 {
      width: 200px;
      height: 200px;
      background: #c9a227;
      top: -80px;
      right: -60px;
    }
    .shape-2 {
      width: 150px;
      height: 150px;
      background: #ffffff;
      bottom: -50px;
      left: -40px;
    }

    .login-card {
      background: #ffffff;
      margin: -30px 16px 16px;
      border-radius: 8px;
      padding: 28px 24px;
      box-shadow: 0 4px 24px rgba(0, 34, 99, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
      position: relative;
      z-index: 3;
    }
    .card-header {
      margin-bottom: 24px;
    }
    .card-title {
      font-size: 24px;
      font-weight: 700;
      color: #002263;
      margin: 0 0 6px;
    }
    .card-subtitle {
      font-size: 14px;
      color: #6c757d;
      margin: 0;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .primary-btn,
    .secondary-btn,
    .text-btn {
      height: 52px;
      font-weight: 600;
      font-size: 16px;
      --border-radius: 8px;
    }
    .primary-btn {
      --background: #002263;
      --color: #ffffff;
      --box-shadow: 0 4px 14px rgba(0, 34, 99, 0.3);
    }
    .primary-btn:hover { --background: #001a4d; }
    .secondary-btn {
      --background: #ffffff;
      --color: #002263;
      --border-color: #002263;
      --border-style: solid;
      --border-width: 2px;
    }
    .secondary-btn:hover { --background: rgba(0, 34, 99, 0.04); }
    .text-btn {
      --color: #002263;
      font-weight: 500;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 4px 0;
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e9ecef;
    }
    .divider span {
      font-size: 12px;
      color: #adb5bd;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .email-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #6c757d;
      margin: 16px 0 0;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .email-hint ion-icon {
      color: #002263;
      font-size: 16px;
    }

    .security-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 16px;
      color: #adb5bd;
      font-size: 12px;
    }
    .security-note ion-icon {
      font-size: 14px;
    }

    .login-footer {
      text-align: center;
      padding: 0 24px 32px;
    }
    .footer-text {
      font-size: 11px;
      color: #adb5bd;
      margin: 0;
      letter-spacing: 0.5px;
    }
  `],
})
export class LoginPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);

  isLoading = signal(false);

  async ngOnInit(): Promise<void> {
    addIcons({
      qrCodeOutline,
      personOutline,
      lockClosedOutline,
      arrowForwardOutline,
      shieldCheckmarkOutline,
      mailOutline,
      timeOutline,
      keyOutline,
    });
  }

  async scanQRCode(): Promise<void> {
    this.router.navigate(['/auth/qr-scanner']);
  }

  async openOtpLogin(): Promise<void> {
    this.router.navigate(['/auth/otp-login']);
  }

  async openManualToken(): Promise<void> {
    this.router.navigate(['/auth/manual-token']);
  }
}
