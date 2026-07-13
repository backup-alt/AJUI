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
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  keyOutline,
  arrowForwardOutline,
  chevronBackOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-manual-token',
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
        <ion-title>Use invite token</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="content">
      <div class="container">
        <div class="icon-circle">
          <ion-icon name="key-outline"></ion-icon>
        </div>
        <h1 class="title">Enter your invite token</h1>
        <p class="subtitle">
          Paste the invite token from your admin. We'll verify it and take you to account setup.
        </p>

        <div class="form">
          <ion-item class="agb-input">
            <ion-input
              type="text"
              placeholder="Invite token"
              [(ngModel)]="token"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
            ></ion-input>
          </ion-item>
          <ion-button
            expand="block"
            class="primary-btn"
            [disabled]="!token.trim() || isLoading()"
            (click)="verifyToken()"
          >
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
              <span>Verify & Continue</span>
            }
          </ion-button>
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
    .form {
      background: #ffffff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .agb-input {
      --background: #f8f9fa;
      --border-radius: 8px;
      --padding-start: 12px;
      --padding-end: 12px;
      margin-bottom: 16px;
    }
    .primary-btn {
      --background: #002263;
      --color: #ffffff;
      --border-radius: 8px;
      font-weight: 600;
      height: 48px;
    }
    .primary-btn:hover { --background: #001a4d; }
  `],
})
export class ManualTokenPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  token = '';
  isLoading = signal(false);

  async ngOnInit(): Promise<void> {
    addIcons({ keyOutline, arrowForwardOutline, chevronBackOutline });
  }

  async verifyToken(): Promise<void> {
    const t = this.token.trim();
    if (!t) return;
    this.isLoading.set(true);
    this.auth.verifyInvite(t).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.valid) {
          this.showError('This invite is no longer valid');
          return;
        }
        // If OTP is required, navigate to qr-scanner-style OTP flow
        if (res.requiresOtp) {
          this.router.navigate(['/auth/verify-otp'], {
            queryParams: { token: t },
          });
        } else {
          this.router.navigate(['/auth/signup'], { queryParams: { token: t } });
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showError(err?.message || 'Invalid invite token');
      },
    });
  }

  private async showError(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'danger',
    });
    await toast.present();
  }
}
