import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonSpinner,
  IonRouterLink,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline,
  personOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  arrowForwardOutline,
  shieldCheckmarkOutline,
  timeOutline,
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
    IonRouterLink,
    FormsModule,
  ],
  template: `
    <ion-content class="login-content">
      <div class="login-container">
        <!-- Header with gradient background -->
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
          <!-- Decorative shapes -->
          <div class="header-shape shape-1"></div>
          <div class="header-shape shape-2"></div>
        </div>

        <!-- Login Form Card -->
        <div class="login-card">
          <div class="card-header">
            <h2 class="card-title">Sign In</h2>
            <p class="card-subtitle">Welcome back! Enter your credentials to continue.</p>
          </div>

          <div class="login-form">
            <div class="input-wrapper">
              <label class="input-label">Email Address</label>
              <div class="input-container" [class.focused]="emailFocused">
                <ion-icon name="mail-outline" class="input-icon"></ion-icon>
                <ion-input
                  type="email"
                  placeholder="Enter your email"
                  [(ngModel)]="email"
                  [clearInput]="true"
                  autocomplete="email"
                  (ionFocus)="emailFocused = true"
                  (ionBlur)="emailFocused = false"
                />
              </div>
            </div>

            <div class="input-wrapper">
              <label class="input-label">Password</label>
              <div class="input-container" [class.focused]="passwordFocused">
                <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
                <ion-input
                  [type]="showPassword() ? 'text' : 'password'"
                  placeholder="Enter your password"
                  [(ngModel)]="password"
                  autocomplete="current-password"
                  (ionFocus)="passwordFocused = true"
                  (ionBlur)="passwordFocused = false"
                />
                <button type="button" class="password-toggle" (click)="togglePassword()">
                  <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
                </button>
              </div>
            </div>

            <div class="form-footer">
              <a href="#" class="forgot-link">Forgot Password?</a>
            </div>

            <ion-button
              expand="block"
              class="login-btn"
              [disabled]="isLoading()"
              (click)="loginWithEmail()"
            >
              @if (isLoading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                <span>Sign In</span>
                <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
              }
            </ion-button>

            <div class="divider">
              <span>or continue with</span>
            </div>

            <ion-button
              expand="block"
              class="qr-btn"
              (click)="scanQRCode()"
              [disabled]="isLoading()"
            >
              <div class="qr-btn-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="qr-icon-svg">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                  <rect x="14" y="14" width="3" height="3" rx="0.5" fill="currentColor"/>
                  <rect x="18" y="14" width="3" height="3" rx="0.5" fill="currentColor"/>
                  <rect x="14" y="18" width="3" height="3" rx="0.5" fill="currentColor"/>
                  <rect x="18" y="18" width="3" height="3" rx="0.5" fill="currentColor"/>
                </svg>
                <span>Sign in with QR Code</span>
              </div>
            </ion-button>
          </div>
        </div>

        <!-- Security Note -->
        <div class="security-note">
          <ion-icon name="shield-checkmark-outline"></ion-icon>
          <span>Secure supervisor access only</span>
        </div>

        <!-- Footer -->
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

    /* Header with gradient */
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
      border-radius: 20px;
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

    /* Login Card */
    .login-card {
      background: #ffffff;
      margin: -30px 16px 16px;
      border-radius: 24px;
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

    /* Form Styles */
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .input-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .input-label {
      font-size: 13px;
      font-weight: 600;
      color: #495057;
      margin: 0;
    }
    .input-container {
      display: flex;
      align-items: center;
      background: #f8f9fa;
      border: 2px solid transparent;
      border-radius: 12px;
      padding: 0 14px;
      transition: all 0.2s ease;
      min-height: 52px;
    }
    .input-container.focused {
      background: #ffffff;
      border-color: #002263;
      box-shadow: 0 0 0 4px rgba(0, 34, 99, 0.08);
    }
    .input-icon {
      color: #002263;
      font-size: 20px;
      margin-right: 10px;
      min-width: 20px;
    }
    .input-container ion-input {
      flex: 1;
      font-size: 15px;
      --padding-start: 0;
      --padding-end: 0;
    }
    .password-toggle {
      background: transparent;
      border: none;
      padding: 8px;
      cursor: pointer;
      color: #6c757d;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .password-toggle ion-icon {
      font-size: 20px;
    }
    .form-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: -8px;
    }
    .forgot-link {
      font-size: 13px;
      color: #002263;
      text-decoration: none;
      font-weight: 500;
    }
    .forgot-link:hover {
      text-decoration: underline;
    }

    /* Login Button */
    .login-btn {
      --background: #002263;
      --color: #ffffff;
      --border-radius: 12px;
      --box-shadow: 0 4px 14px rgba(0, 34, 99, 0.3);
      font-weight: 600;
      font-size: 16px;
      height: 52px;
      margin-top: 8px;
      letter-spacing: 0.3px;
    }
    .login-btn:hover {
      --background: #001a4d;
    }

    /* Divider */
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

    /* QR Button */
    .qr-btn {
      --background: transparent;
      --color: #002263;
      --border-radius: 12px;
      border: 2px solid #002263;
      font-weight: 600;
      font-size: 15px;
      height: 52px;
      --background: rgba(0, 34, 99, 0.04);
    }
    .qr-btn:hover {
      --background: #002263;
      --color: #ffffff;
    }
    .qr-btn-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .qr-icon-svg {
      flex-shrink: 0;
    }

    /* Security Note */
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

    /* Footer */
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

  email = '';
  password = '';
  showPassword = signal(false);
  isLoading = signal(false);
  emailFocused = false;
  passwordFocused = false;

  async ngOnInit(): Promise<void> {
    addIcons({
      qrCodeOutline,
      personOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      arrowForwardOutline,
      shieldCheckmarkOutline,
      timeOutline,
      mailOutline: personOutline,
    });

    const isLoggedIn = await this.auth.isLoggedIn();
    if (isLoggedIn) {
      this.router.navigate(['/tabs/dashboard']);
    }
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  async loginWithEmail(): Promise<void> {
    if (!this.email || !this.password) {
      const toast = await this.toastCtrl.create({
        message: 'Please enter email and password',
        duration: 2000,
        position: 'top',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    this.isLoading.set(true);

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/tabs/dashboard']);
      },
      error: async (error: unknown) => {
        this.isLoading.set(false);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const toast = await this.toastCtrl.create({
          message: errorMessage || 'Login failed',
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  async scanQRCode(): Promise<void> {
    this.router.navigate(['/auth/qr-scanner']);
  }
}