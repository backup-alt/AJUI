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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  chevronBackOutline,
  checkmarkCircleOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
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
        <ion-title>New password</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="content">
      <div class="container">
        <div class="icon-circle">
          <ion-icon name="shield-checkmark-outline"></ion-icon>
        </div>
        <h1 class="title">Set a new password</h1>
        <p class="subtitle">Choose a strong password you don't use anywhere else.</p>

        <div class="form">
          <label class="form-label">New password</label>
          <div class="input-wrap">
            <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
            <ion-input
              [type]="showNew() ? 'text' : 'password'"
              placeholder="New password"
              [(ngModel)]="password"
              autocomplete="new-password"
            ></ion-input>
            <button type="button" class="eye-toggle" (click)="showNew.set(!showNew())">
              <ion-icon [name]="showNew() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
            </button>
          </div>

          <label class="form-label">Confirm password</label>
          <div class="input-wrap">
            <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
            <ion-input
              [type]="showConfirm() ? 'text' : 'password'"
              placeholder="Confirm new password"
              [(ngModel)]="confirmPassword"
              autocomplete="new-password"
            ></ion-input>
            <button type="button" class="eye-toggle" (click)="showConfirm.set(!showConfirm())">
              <ion-icon [name]="showConfirm() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
            </button>
          </div>

          <div class="password-hint">
            <span [class.valid]="password.length >= 8">8+ characters</span>
            <span [class.valid]="hasUpperCase()">Uppercase</span>
            <span [class.valid]="hasNumber()">Number</span>
          </div>

          <ion-button
            expand="block"
            class="primary-btn"
            [disabled]="!isValid() || isLoading()"
            (click)="submit()"
          >
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              <ion-icon name="checkmark-circle-outline" slot="end"></ion-icon>
              <span>Update password</span>
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); --border-color: var(--agb-light-gray); }
    .content { --background: #f8f9fb; }
    .container { max-width: 440px; margin: 0 auto; padding: 32px 20px; text-align: center; }
    .icon-circle {
      width: 72px; height: 72px; margin: 0 auto 18px;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(0, 34, 99, 0.10), rgba(0, 34, 99, 0.04));
      color: #002263;
      display: flex; align-items: center; justify-content: center;
    }
    .icon-circle ion-icon { font-size: 32px; }
    .title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.3px; }
    .subtitle { font-size: 14px; color: #64748b; margin: 0 0 24px; line-height: 1.5; }
    .form {
      background: #ffffff; border-radius: 20px; padding: 22px 18px;
      box-shadow: 0 4px 16px -6px rgba(15, 23, 42, 0.08);
      border: 1px solid #eef0f3; text-align: left;
    }
    .form-label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin: 0 4px 6px; }
    .form-label + .input-wrap { margin-bottom: 14px; }
    .input-wrap {
      position: relative; display: flex; align-items: center;
      background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px;
    }
    .input-wrap:focus-within { border-color: #002263; box-shadow: 0 0 0 4px rgba(0, 34, 99, 0.10); background: #ffffff; }
    .input-icon { color: #94a3b8; font-size: 18px; padding: 0 4px 0 14px; }
    .input-wrap ion-input {
      --background: transparent; --border-radius: 14px;
      --padding-start: 10px; --padding-end: 10px;
      --padding-top: 14px; --padding-bottom: 14px;
      --border-width: 0; --border-style: none;
      min-height: 50px; flex: 1;
    }
    .eye-toggle { background: transparent; border: 0; padding: 8px 12px; color: #94a3b8; cursor: pointer; }
    .eye-toggle ion-icon { font-size: 20px; }
    .password-hint { display: flex; gap: 14px; margin: 4px 0 16px; padding: 0 4px; }
    .password-hint span { font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 4px; }
    .password-hint span::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #e2e8f0; }
    .password-hint span.valid { color: #16a34a; }
    .password-hint span.valid::before { background: #16a34a; }
    .primary-btn {
      --background: #002263; --color: #ffffff; --border-radius: 14px;
      font-weight: 700; height: 52px;
    }
    .primary-btn:hover { --background: #001a4d; }
  `],
})
export class ResetPasswordPage implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  token = '';
  password = '';
  confirmPassword = '';
  showNew = signal(false);
  showConfirm = signal(false);
  isLoading = signal(false);

  async ngOnInit(): Promise<void> {
    addIcons({
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      chevronBackOutline,
      checkmarkCircleOutline,
      shieldCheckmarkOutline,
    });
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      const toast = await this.toastCtrl.create({
        message: 'Invalid or missing reset link',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
      this.router.navigate(['/auth/login']);
    }
  }

  hasUpperCase(): boolean {
    return /[A-Z]/.test(this.password);
  }

  hasNumber(): boolean {
    return /\d/.test(this.password);
  }

  isValid(): boolean {
    return (
      this.password.length >= 8 &&
      this.hasUpperCase() &&
      this.hasNumber() &&
      this.password === this.confirmPassword
    );
  }

  async submit(): Promise<void> {
    if (!this.isValid() || !this.token) return;
    this.isLoading.set(true);
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: async () => {
        this.isLoading.set(false);
        const toast = await this.toastCtrl.create({
          message: 'Password updated. Please log in.',
          duration: 2500,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        this.router.navigate(['/auth/login']);
      },
      error: async (err) => {
        this.isLoading.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to reset password',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
