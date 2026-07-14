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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  keyOutline,
  arrowForwardOutline,
  chevronBackOutline,
  ticketOutline,
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
        <ion-title>Invite token</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="content">
      <div class="container">
        <div class="icon-circle">
          <ion-icon name="ticket-outline"></ion-icon>
        </div>
        <h1 class="title">Enter your invite token</h1>
        <p class="subtitle">
          Paste the invite token from your admin. We'll verify it and take you to account setup.
        </p>

        <div class="form">
          <label class="form-label">Invite token</label>
          <div class="input-wrap">
            <ion-icon name="key-outline" class="input-icon"></ion-icon>
            <textarea
              class="token-area"
              placeholder="Paste your invite token here"
              [(ngModel)]="token"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              rows="3"
            ></textarea>
          </div>

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
              <span>Verify &amp; continue</span>
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
      width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 22px;
      background: linear-gradient(135deg, rgba(201, 162, 39, 0.16), rgba(201, 162, 39, 0.04));
      color: #a8861f;
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
    .input-wrap {
      display: flex; align-items: flex-start;
      background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px;
      padding: 12px 12px 12px 0;
      transition: border-color var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .input-wrap:focus-within { border-color: #002263; box-shadow: 0 0 0 4px rgba(0, 34, 99, 0.10); background: #ffffff; }
    .input-icon { color: #94a3b8; font-size: 18px; padding: 4px 4px 0 14px; flex-shrink: 0; }
    .token-area {
      flex: 1; background: transparent; border: 0; outline: none; resize: none;
      font-family: var(--agb-font-mono); font-size: 13px; line-height: 1.5; color: #0f172a;
      padding: 4px 8px 0 4px;
    }
    .primary-btn {
      --background: #002263; --color: #ffffff; --border-radius: 14px;
      font-weight: 700; height: 52px; margin-top: 14px;
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
    addIcons({ keyOutline, arrowForwardOutline, chevronBackOutline, ticketOutline });
  }

  async verifyToken(): Promise<void> {
    const t = this.token.trim();
    if (!t) return;
    this.isLoading.set(true);
    this.auth.verifyInvite(t).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.valid) {
          void this.showError('This invite is no longer valid');
          return;
        }
        try {
          sessionStorage.setItem('agb:pending-invite', JSON.stringify(res));
        } catch {
          // ignore
        }
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
        void this.showError(err?.message || 'Invalid invite token');
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
