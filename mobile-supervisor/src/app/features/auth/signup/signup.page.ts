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
  IonLabel,
  IonText,
  IonSpinner,
  IonBackButton,
  IonButtons,
  IonRouterLink,
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
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

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
    IonLabel,
    IonText,
    IonSpinner,
    IonBackButton,
    IonButtons,
    IonRouterLink,
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
              Enter your details to complete registration
            }
          </p>
        </div>

        @if (!isSuccess()) {
          <div class="signup-form">
            <div class="input-group">
              <ion-item class="agb-input">
                <ion-icon name="person-outline" slot="start"></ion-icon>
                <ion-input
                  type="text"
                  placeholder="Full Name"
                  [(ngModel)]="name"
                  autocomplete="name"
                />
              </ion-item>
            </div>

            <div class="input-group">
              <ion-item class="agb-input">
                <ion-icon name="mail-outline" slot="start"></ion-icon>
                <ion-input
                  type="email"
                  placeholder="Email Address"
                  [(ngModel)]="email"
                  autocomplete="email"
                />
              </ion-item>
            </div>

            <div class="input-group">
              <ion-item class="agb-input">
                <ion-icon name="call-outline" slot="start"></ion-icon>
                <ion-input
                  type="tel"
                  placeholder="Phone Number"
                  [(ngModel)]="phone"
                  autocomplete="tel"
                />
              </ion-item>
            </div>

            <div class="input-group">
              <ion-item class="agb-input">
                <ion-icon name="lock-closed-outline" slot="start"></ion-icon>
                <ion-input
                  [type]="showPassword() ? 'text' : 'password'"
                  placeholder="Create Password"
                  [(ngModel)]="password"
                  autocomplete="new-password"
                />
                <ion-button slot="end" fill="clear" class="password-toggle" (click)="togglePassword()">
                  <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
                </ion-button>
              </ion-item>
              <div class="password-hint">
                <span [class.valid]="password.length >= 8">8+ characters</span>
                <span [class.valid]="hasUpperCase()">Uppercase</span>
                <span [class.valid]="hasNumber()">Number</span>
              </div>
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
                Create Account
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
    .signup-content {
      --background: var(--agb-off-white);
    }
    .signup-container {
      min-height: 100%;
      padding: 24px;
    }
    .signup-header {
      text-align: center;
      padding: 32px 0;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(25, 135, 84, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.5s ease;
    }
    .success-icon.visible {
      opacity: 1;
      transform: scale(1);
    }
    .success-icon ion-icon {
      font-size: 48px;
      color: var(--agb-success);
    }
    .signup-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--agb-navy);
      margin: 0 0 8px;
    }
    .signup-subtitle {
      font-size: 14px;
      color: var(--agb-gray);
      margin: 0;
    }
    .signup-form {
      background: var(--agb-white);
      border-radius: var(--agb-radius-xl);
      padding: 32px 24px;
      box-shadow: var(--agb-shadow-md);
    }
    .input-group {
      margin-bottom: 16px;
    }
    .agb-input {
      --background: var(--agb-off-white);
      --border-radius: var(--agb-radius-md);
      --padding-start: 12px;
      --padding-end: 12px;
      border-radius: var(--agb-radius-md);
      --min-height: 56px;
    }
    .agb-input ion-icon {
      color: var(--agb-primary);
      font-size: 20px;
    }
    .agb-input ion-input {
      font-size: 15px;
    }
    .password-toggle {
      --color: var(--agb-gray);
    }
    .password-hint {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      padding: 0 4px;
    }
    .password-hint span {
      font-size: 11px;
      color: var(--agb-gray);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .password-hint span::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--agb-light-gray);
    }
    .password-hint span.valid {
      color: var(--agb-success);
    }
    .password-hint span.valid::before {
      background: var(--agb-success);
    }
    .signup-btn {
      --background: var(--agb-primary);
      --color: var(--agb-white);
      --border-radius: var(--agb-radius-md);
      font-weight: 600;
      font-size: 16px;
      height: 52px;
      margin-top: 8px;
    }
    .terms-text {
      font-size: 12px;
      color: var(--agb-gray);
      text-align: center;
      margin: 16px 0 0;
      line-height: 1.6;
    }
    .terms-text a {
      color: var(--agb-primary);
      text-decoration: none;
    }
    .success-content {
      text-align: center;
    }
    .continue-btn {
      --background: var(--agb-primary);
      --color: var(--agb-white);
      --border-radius: var(--agb-radius-md);
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
  password = '';

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
    });

    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
      this.otp = params['otp'] || '';
    });
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

    this.isLoading.set(true);

    this.auth.signup({
      token: this.token,
      otp: this.otp,
      name: this.name,
      email: this.email,
      phone: this.phone,
      password: this.password,
    }).subscribe({
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