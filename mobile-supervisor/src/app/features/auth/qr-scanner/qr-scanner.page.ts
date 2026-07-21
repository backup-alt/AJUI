import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonBackButton,
  IonButtons,
  IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline,
  cameraOutline,
  closeCircleOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  refreshOutline,
  keyOutline,
  flashOutline,
  flashOffOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonIcon,
    IonBackButton,
    IonButtons,
    IonSpinner,
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/auth/login" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Scan QR</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="scanner-content">
      <div class="scanner-container">
        @if (state() === 'scanning') {
          <div class="scanner-stage">
            <div class="scanner-frame">
              <div class="frame-corner tl"></div>
              <div class="frame-corner tr"></div>
              <div class="frame-corner bl"></div>
              <div class="frame-corner br"></div>
              <div class="scan-line"></div>
              <div class="frame-glow"></div>
            </div>
            <p class="scanner-hint">Position the QR code inside the frame</p>
          </div>
        } @else if (state() === 'verifying') {
          <div class="status-card">
            <div class="status-icon verifying">
              <ion-spinner name="crescent" color="primary"></ion-spinner>
            </div>
            <h2 class="status-title">Verifying invite</h2>
            <p class="status-msg">Please wait while we check your invite...</p>
          </div>
        } @else if (state() === 'error') {
          <div class="status-card">
            <div class="status-icon error">
              <ion-icon name="close-circle-outline"></ion-icon>
            </div>
            <h2 class="status-title">Invalid QR code</h2>
            <p class="status-msg">{{ errorMessage() || 'This QR code is not valid for supervisor login' }}</p>
            <ion-button expand="block" class="retry-btn" (click)="retryScan()">
              <ion-icon name="refresh-outline" slot="start"></ion-icon>
              Try again
            </ion-button>
          </div>
        } @else {
          <div class="status-card">
            <div class="status-icon success">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
            </div>
            <h2 class="status-title">QR code detected</h2>
            <p class="status-msg">Your invite has been verified. Continue to complete registration.</p>
          </div>
        }

        <div class="manual-entry">
          <div class="manual-entry-head">
            <ion-icon name="key-outline"></ion-icon>
            <span>Have a token instead?</span>
          </div>
          <ion-button fill="clear" class="manual-btn" (click)="showManualEntry()">
            Enter invite token manually
            <ion-icon name="key-outline" slot="end"></ion-icon>
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); --border-color: var(--agb-light-gray); }
    .scanner-content { --background: #0a1330; }
    .scanner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: 24px 20px;
      color: #ffffff;
      gap: 32px;
    }

    /* Scanning state */
    .scanner-stage {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .scanner-frame {
      position: relative;
      width: 260px;
      height: 260px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 28px;
      overflow: hidden;
    }
    .frame-corner {
      position: absolute;
      width: 36px;
      height: 36px;
      border-color: #c9a227;
      border-style: solid;
      border-width: 0;
      z-index: 2;
    }
    .frame-corner.tl { top: 0; left: 0; border-top-width: 4px; border-left-width: 4px; border-top-left-radius: 14px; }
    .frame-corner.tr { top: 0; right: 0; border-top-width: 4px; border-right-width: 4px; border-top-right-radius: 14px; }
    .frame-corner.bl { bottom: 0; left: 0; border-bottom-width: 4px; border-left-width: 4px; border-bottom-left-radius: 14px; }
    .frame-corner.br { bottom: 0; right: 0; border-bottom-width: 4px; border-right-width: 4px; border-bottom-right-radius: 14px; }
    .scan-line {
      position: absolute;
      left: 8%;
      right: 8%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #c9a227 30%, #c9a227 70%, transparent);
      box-shadow: 0 0 18px rgba(201, 162, 39, 0.65);
      animation: scan 2.2s ease-in-out infinite;
      z-index: 1;
    }
    .frame-glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 50%, rgba(201, 162, 39, 0.10), transparent 60%);
    }
    @keyframes scan {
      0%, 100% { top: 12%; opacity: 1; }
      50% { top: 84%; opacity: 0.6; }
    }
    .scanner-hint {
      margin-top: 20px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.75);
      text-align: center;
    }

    /* Status states */
    .status-card {
      width: 100%;
      max-width: 360px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.10);
      border-radius: 24px;
      padding: 32px 24px;
      text-align: center;
      backdrop-filter: blur(8px);
    }
    .status-icon {
      width: 72px;
      height: 72px;
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      background: rgba(255, 255, 255, 0.08);
    }
    .status-icon.success { background: rgba(22, 163, 74, 0.20); color: #4ade80; }
    .status-icon.error { background: rgba(220, 38, 38, 0.20); color: #fca5a5; }
    .status-icon ion-icon { font-size: 40px; }
    .status-title { font-size: 20px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.2px; }
    .status-msg { font-size: 14px; color: rgba(255, 255, 255, 0.78); margin: 0 0 20px; line-height: 1.5; }

    .retry-btn {
      --background: #ffffff;
      --color: #002263;
      --border-radius: 14px;
      font-weight: 700;
      height: 50px;
    }

    .manual-entry {
      width: 100%;
      max-width: 360px;
      text-align: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.10);
      border-radius: 18px;
      padding: 14px 16px;
    }
    .manual-entry-head {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }
    .manual-entry-head ion-icon { font-size: 14px; color: #c9a227; }
    .manual-btn {
      --color: #c9a227;
      font-weight: 600;
      font-size: 13px;
      margin-top: 2px;
    }
  `],
})
export class QrScannerPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  state = signal<'scanning' | 'verifying' | 'success' | 'error'>('scanning');
  errorMessage = signal<string | null>(null);

  inviteToken = '';

  async ngOnInit(): Promise<void> {
    addIcons({
      qrCodeOutline,
      cameraOutline,
      closeCircleOutline,
      checkmarkCircleOutline,
      chevronBackOutline,
      refreshOutline,
      keyOutline,
      flashOutline,
      flashOffOutline,
    });
    await this.startScanning();
  }

  async startScanning(): Promise<void> {
    this.state.set('scanning');
    this.errorMessage.set(null);
    try {
      const result = await this.auth.loginWithQRCode();
      if (!result.scanned) {
        this.state.set('error');
        this.errorMessage.set('No QR code detected');
        return;
      }

      if (result.payload) {
        this.inviteToken = result.payload.token;
        this.state.set('verifying');

        this.auth.verifyInvite(this.inviteToken).subscribe({
          next: (response) => {
            try {
              sessionStorage.setItem('agb:pending-invite', JSON.stringify(response));
            } catch {
              // ignore
            }
            if (!response.valid) {
              this.state.set('error');
              this.errorMessage.set('Invite is no longer valid');
              return;
            }
            this.state.set('success');
            setTimeout(() => {
              if (response.requiresOtp) {
                this.router.navigate(['/auth/verify-otp'], {
                  queryParams: { token: this.inviteToken },
                });
              } else {
                this.router.navigate(['/auth/signup'], {
                  queryParams: { token: this.inviteToken },
                });
              }
            }, 600);
          },
          error: (error: unknown) => {
            this.state.set('error');
            this.errorMessage.set(
              error instanceof Error ? error.message : String(error) || 'Invalid invite'
            );
          },
        });
      }
    } catch (error: unknown) {
      this.state.set('error');
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to scan QR code');
    }
  }

  async retryScan(): Promise<void> {
    await this.startScanning();
  }

  showManualEntry(): void {
    this.router.navigate(['/auth/manual-token']);
  }
}
