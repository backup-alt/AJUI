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
  businessOutline,
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
        <ion-title>Create account</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="signup-content">
      <div class="signup-container">
        @if (isSuccess()) {
          <div class="success-card">
            <div class="success-icon">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
            </div>
            <h1 class="success-title">Account created</h1>
            <p class="success-msg">Your supervisor account is ready. You can now sign in.</p>
            <ion-button expand="block" class="primary-btn" (click)="goToDashboard()">
              <span>Go to dashboard</span>
              <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            </ion-button>
          </div>
        } @else {
          <div class="hero">
            <div class="hero-icon">
              <ion-icon name="business-outline"></ion-icon>
            </div>
            <h1 class="hero-title">Complete your profile</h1>
            <p class="hero-sub">
              We've pre-filled the details from your invite. Choose a password to finish.
            </p>
          </div>

          @if (siteCount() > 0) {
            <div class="prefill-banner">
              <ion-icon name="home-outline"></ion-icon>
              <div>
                <div class="prefill-label">Assigned sites</div>
                <div class="prefill-value">
                  {{ siteCount() }} site{{ siteCount() === 1 ? '' : 's' }} assigned to you
                </div>
              </div>
            </div>
          }

          <div class="form">
            <div class="form-field">
              <label class="form-label">Full name</label>
              <div class="input-wrap">
                <ion-icon name="person-outline" class="input-icon"></ion-icon>
                <ion-input
                  type="text"
                  placeholder="Your full name"
                  [(ngModel)]="name"
                  autocomplete="name"
                ></ion-input>
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Email</label>
              <div class="input-wrap" [class.locked]="emailLocked">
                <ion-icon name="mail-outline" class="input-icon"></ion-icon>
                <ion-input
                  type="email"
                  placeholder="you@agb.co"
                  [(ngModel)]="email"
                  [readonly]="emailLocked"
                  autocomplete="email"
                ></ion-input>
                @if (emailLocked) {
                  <span class="lock-tag">Locked</span>
                }
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Phone</label>
              <div class="input-wrap">
                <ion-icon name="call-outline" class="input-icon"></ion-icon>
                <ion-input
                  type="tel"
                  placeholder="+91 98765 43210"
                  [(ngModel)]="phone"
                  autocomplete="tel"
                ></ion-input>
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Address (optional)</label>
              <div class="input-wrap">
                <ion-icon name="home-outline" class="input-icon"></ion-icon>
                <ion-input
                  type="text"
                  placeholder="Your address"
                  [(ngModel)]="address"
                  autocomplete="street-address"
                ></ion-input>
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Create password</label>
              <div class="input-wrap">
                <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
                <ion-input
                  [type]="showPassword() ? 'text' : 'password'"
                  placeholder="Choose a password"
                  [(ngModel)]="password"
                  autocomplete="new-password"
                ></ion-input>
                <button
                  type="button"
                  class="eye-toggle"
                  (click)="togglePassword()"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                >
                  <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
                </button>
              </div>
              <div class="password-hint">
                <span [class.valid]="password.length >= 8">8+ characters</span>
                <span [class.valid]="hasUpperCase()">Uppercase</span>
                <span [class.valid]="hasNumber()">Number</span>
              </div>
            </div>

            <ion-button
              expand="block"
              class="primary-btn"
              [disabled]="!isFormValid() || isLoading()"
              (click)="createAccount()"
            >
              @if (isLoading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                <span>Create account</span>
                <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
              }
            </ion-button>

            <p class="terms-text">
              By creating an account, you agree to our internal use policies for AGB Supervisor.
            </p>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); --border-color: var(--agb-light-gray); }
    .signup-content { --background: #f8f9fb; }
    .signup-container { padding: 24px 20px 32px; max-width: 520px; margin: 0 auto; }

    .hero { text-align: center; padding: 8px 0 24px; }
    .hero-icon {
      width: 64px; height: 64px; margin: 0 auto 14px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(0, 34, 99, 0.10), rgba(0, 34, 99, 0.04));
      color: #002263; display: flex; align-items: center; justify-content: center;
    }
    .hero-icon ion-icon { font-size: 30px; }
    .hero-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.3px; }
    .hero-sub { font-size: 14px; color: #64748b; margin: 0; line-height: 1.5; }

    .prefill-banner {
      display: flex; align-items: center; gap: 12px;
      background: linear-gradient(135deg, rgba(201, 162, 39, 0.10), rgba(201, 162, 39, 0.04));
      border: 1px solid rgba(201, 162, 39, 0.25);
      border-radius: 16px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .prefill-banner ion-icon { color: #a8861f; font-size: 22px; }
    .prefill-label { font-size: 10px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; }
    .prefill-value { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }

    .form {
      background: #ffffff; border-radius: 20px; padding: 22px 18px;
      box-shadow: 0 4px 16px -6px rgba(15, 23, 42, 0.08);
      border: 1px solid #eef0f3;
    }
    .form-field { margin-bottom: 14px; }
    .form-label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin: 0 4px 6px; }
    .input-wrap {
      position: relative; display: flex; align-items: center;
      background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px;
      transition: border-color var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .input-wrap:focus-within {
      border-color: #002263; box-shadow: 0 0 0 4px rgba(0, 34, 99, 0.10); background: #ffffff;
    }
    .input-wrap.locked { background: #f1f5f9; }
    .input-icon { color: #94a3b8; font-size: 18px; padding: 0 4px 0 14px; flex-shrink: 0; }
    .input-wrap ion-input {
      --background: transparent; --border-radius: 14px;
      --padding-start: 10px; --padding-end: 10px;
      --padding-top: 14px; --padding-bottom: 14px;
      --border-width: 0; --border-style: none;
      min-height: 50px; flex: 1;
    }
    .lock-tag {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      color: #475569; background: #e2e8f0; padding: 4px 8px;
      border-radius: 999px; margin-right: 10px;
    }
    .eye-toggle { background: transparent; border: 0; padding: 8px 12px; color: #94a3b8; cursor: pointer; }
    .eye-toggle ion-icon { font-size: 20px; }

    .password-hint { display: flex; gap: 14px; margin: 8px 4px 0; }
    .password-hint span { font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 4px; }
    .password-hint span::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #e2e8f0; }
    .password-hint span.valid { color: #16a34a; }
    .password-hint span.valid::before { background: #16a34a; }

    .primary-btn {
      --background: #002263; --color: #ffffff; --border-radius: 14px;
      font-weight: 700; height: 52px; margin-top: 16px;
    }
    .primary-btn:hover { --background: #001a4d; }

    .terms-text {
      font-size: 12px; color: #94a3b8;
      text-align: center; margin: 16px 0 0; line-height: 1.6;
    }

    .success-card {
      background: #ffffff; border-radius: 24px; padding: 32px 24px;
      box-shadow: 0 18px 48px -16px rgba(15, 23, 42, 0.20);
      border: 1px solid #eef0f3; text-align: center; margin-top: 24px;
    }
    .success-icon {
      width: 80px; height: 80px; margin: 0 auto 16px;
      border-radius: 24px;
      background: linear-gradient(135deg, rgba(22, 163, 74, 0.18), rgba(22, 163, 74, 0.04));
      color: #15803d;
      display: flex; align-items: center; justify-content: center;
    }
    .success-icon ion-icon { font-size: 42px; }
    .success-title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.3px; }
    .success-msg { font-size: 14px; color: #64748b; margin: 0 0 24px; line-height: 1.5; }
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
      businessOutline,
    });

    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
      this.otp = params['otp'] || '';
    });

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
