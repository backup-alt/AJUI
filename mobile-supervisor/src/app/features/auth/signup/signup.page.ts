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
  IonTextarea,
  IonSpinner,
  IonBackButton,
  IonButtons,
  ToastController,
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  personOutline,
  mailOutline,
  callOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  homeOutline,
  arrowForwardOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';
import { VerifyInviteResponse } from '../../../shared/models';

@Component({
  selector: 'app-signup',
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
    IonTextarea,
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
        <ion-title>Create Account</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="signup-content">
      <div class="signup-container">
        <div class="signup-header">
          <div class="success-icon" [class.visible]="isSuccess()">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </div>
          <h1 class="signup-title">
            @if (isSuccess()) {
              Account Created!
            } @else {
              Complete Your Profile
            }
          </h1>
          <p class="signup-subtitle">
            @if (isSuccess()) {
              Your supervisor account has been created successfully.
            } @else {
              We've pre-filled the details from your invite. Choose a password to finish.
            }
          </p>
        </div>

        @if (!isSuccess()) {
          <div class="signup-form">
            @if (siteCount() > 0) {
              <div class="prefill-banner">
                <ion-icon name="home-outline"></ion-icon>
                <div>
                  <div class="prefill-label">Assigned Sites</div>
                  <div class="prefill-value">
                    {{ siteCount() }} site{{ siteCount() === 1 ? '' : 's' }} assigned to you
                  </div>
                </div>
              </div>
            }

            <ion-item class="agb-input">
              <ion-icon name="person-outline" slot="start"></ion-icon>
              <ion-input
                type="text"
                label="Full Name"
                labelPlacement="stacked"
                [(ngModel)]="name"
                autocomplete="name"
              />
            </ion-item>

            <ion-item class="agb-input">
              <ion-icon name="mail-outline" slot="start"></ion-icon>
              <ion-input
                type="email"
                label="Email Address"
                labelPlacement="stacked"
                [(ngModel)]="email"
                [readonly]="emailLocked"
                autocomplete="email"
              />
            </ion-item>

            <ion-item class="agb-input">
              <ion-icon name="call-outline" slot="start"></ion-icon>
              <ion-input
                type="tel"
                label="Phone Number"
                labelPlacement="stacked"
                [(ngModel)]="phone"
                autocomplete="tel"
              />
            </ion-item>

            <ion-item class="agb-input">
              <ion-icon name="home-outline" slot="start"></ion-icon>
              <ion-input
                type="text"
                label="Address (optional)"
                labelPlacement="stacked"
                [(ngModel)]="address"
                autocomplete="street-address"
              />
            </ion-item>

            <ion-item class="agb-input">
              <ion-icon name="lock-closed-outline" slot="start"></ion-icon>
              <ion-input
                [type]="showPassword() ? 'text' : 'password'"
                label="Create Password"
                labelPlacement="stacked"
                [(ngModel)]="password"
                autocomplete="new-password"
              />
              <ion-button
                slot="end"
                fill="clear"
                class="password-toggle"
                (click)="togglePassword()"
              >
                <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
              </ion-button>
            </ion-item>
            <div class="password-hint">
              <span [class.valid]="password.length >= 8">8+ characters</span>
              <span [class.valid]="hasUpperCase()">Uppercase</span>
              <span [class.valid]="hasNumber()">Number</span>
            </div>

            <ion-button
              expand="block"
              class="signup-btn"
              [disabled]="!isFormValid() || isLoading()"
              (click)="createAccount()"
            >
              @if (isLoading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                <span>Create Account</span>
                <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
              }
            </ion-button>

            <p class="terms-text">
              By creating an account, you agree to our
              <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
            </p>
          </div>
        } @else {
          <div class="success-content">
            <ion-button expand="block" class="continue-btn" (click)="goToDashboard()">
              Go to Dashboard
              <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            </ion-button>
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
    .signup-content { --background: #f8f9fa; }
    .signup-container {
      min-height: 100%;
      padding: 24px;
    }
    .signup-header {
      text-align: center;
      padding: 24px 0;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      background: rgba(25, 135, 84, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.5s ease;
    }
    .success-icon.visible { opacity: 1; transform: scale(1); }
    .success-icon ion-icon { font-size: 48px; color: #198754; }
    .signup-title {
      font-size: 24px;
      font-weight: 700;
      color: #002263;
      margin: 0 0 8px;
    }
    .signup-subtitle {
      font-size: 14px;
      color: #6c757d;
      margin: 0;
    }
    .signup-form {
      background: #ffffff;
      border-radius: 8px;
      padding: 24px 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .prefill-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(0, 34, 99, 0.05);
      border-left: 3px solid #c9a227;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .prefill-banner ion-icon {
      color: #002263;
      font-size: 18px;
    }
    .prefill-label {
      font-size: 10px;
      font-weight: 700;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .prefill-value {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    .agb-input {
      --background: #f8f9fa;
      --border-radius: 8px;
      --padding-start: 12px;
      --padding-end: 12px;
      --min-height: 64px;
      margin-bottom: 12px;
    }
    .agb-input ion-icon { color: #002263; font-size: 20px; }
    .agb-input ion-input { font-size: 15px; }
    .password-toggle { --color: #6c757d; }
    .password-hint {
      display: flex;
      gap: 12px;
      margin: 4px 0 16px;
      padding: 0 4px;
    }
    .password-hint span {
      font-size: 11px;
      color: #6c757d;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .password-hint span::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 8px;
      background: #e9ecef;
    }
    .password-hint span.valid { color: #198754; }
    .password-hint span.valid::before { background: #198754; }
    .signup-btn {
      --background: #002263;
      --color: #ffffff;
      --border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      height: 52px;
      margin-top: 8px;
    }
    .signup-btn:hover { --background: #001a4d; }
    .terms-text {
      font-size: 12px;
      color: #6c757d;
      text-align: center;
      margin: 16px 0 0;
      line-height: 1.6;
    }
    .terms-text a { color: #002263; text-decoration: none; }
    .success-content { text-align: center; }
    .continue-btn {
      --background: #002263;
      --color: #ffffff;
      --border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      height: 52px;
    }
  `],
})
export class SignupPage implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  token = '';
  otp = '';

  name = '';
  email = '';
  phone = '';
  address = '';
  password = '';

  emailLocked = false;
  siteCount = signal(0);

  showPassword = signal(false);
  isLoading = signal(false);
  isSuccess = signal(false);

  ngOnInit(): void {
    addIcons({
      personOutline,
      mailOutline,
      callOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      checkmarkCircleOutline,
      chevronBackOutline,
      homeOutline,
      arrowForwardOutline,
    });

    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
      this.otp = params['otp'] || '';
    });

    // Pre-fill from the cached verify response (set by QR scanner / manual-token).
    try {
      const raw = sessionStorage.getItem('agb:pending-invite');
      if (raw) {
        const invite = JSON.parse(raw) as VerifyInviteResponse & { siteIds?: string[] };
        if (invite.supervisorName) this.name = invite.supervisorName;
        if (invite.supervisorEmail) {
          this.email = invite.supervisorEmail;
          this.emailLocked = true;
        }
        if (invite.supervisorPhone) this.phone = invite.supervisorPhone;
        if (Array.isArray(invite.siteIds)) this.siteCount.set(invite.siteIds.length);
        sessionStorage.removeItem('agb:pending-invite');
      }
    } catch {
      // ignore
    }
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  hasUpperCase(): boolean {
    return /[A-Z]/.test(this.password);
  }

  hasNumber(): boolean {
    return /\d/.test(this.password);
  }

  isFormValid(): boolean {
    return (
      this.name.trim().length >= 2 &&
      this.email.includes('@') &&
      this.phone.length >= 8 &&
      this.password.length >= 8 &&
      this.hasUpperCase() &&
      this.hasNumber()
    );
  }

  async createAccount(): Promise<void> {
    if (!this.isFormValid()) return;
    if (!this.token) {
      const toast = await this.toastCtrl.create({
        message: 'Missing invite token. Please restart the signup flow.',
        duration: 3000,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    this.isLoading.set(true);

    this.auth
      .signup({
        token: this.token,
        otp: this.otp,
        name: this.name,
        email: this.email,
        phone: this.phone,
        password: this.password,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.isSuccess.set(true);
        },
        error: async (error: unknown) => {
          this.isLoading.set(false);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const toast = await this.toastCtrl.create({
            message: errorMessage || 'Failed to create account',
            duration: 3000,
            position: 'top',
            color: 'danger',
          });
          await toast.present();
        },
      });
  }

  goToDashboard(): void {
    this.router.navigate(['/tabs/dashboard']);
  }
}
