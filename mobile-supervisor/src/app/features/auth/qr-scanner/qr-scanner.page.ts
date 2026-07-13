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
  AlertController,
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
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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
        <ion-title>Scan QR Code</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="scanner-content">
      <div class="scanner-container">
        @if (!scannedData()) {
          <div class="scanner-view">
            <div class="scanner-frame">
              <div class="scanner-corners">
                <div class="corner top-left"></div>
                <div class="corner top-right"></div>
                <div class="corner bottom-left"></div>
                <div class="corner bottom-right"></div>
              </div>
              <div class="scanner-line"></div>
            </div>
            <p class="scanner-hint">Position the QR code within the frame</p>
          </div>
        } @else {
          <div class="scanned-view">
            <div class="success-icon" [class.error]="scanError()">
              @if (isProcessing()) {
                <ion-spinner name="crescent" color="primary"></ion-spinner>
              } @else if (scanError()) {
                <ion-icon name="close-circle-outline" color="danger"></ion-icon>
              } @else {
                <ion-icon name="checkmark-circle-outline" color="success"></ion-icon>
              }
            </div>

            <h2 class="scanned-title">
              @if (isProcessing()) {
                Verifying...
              } @else if (scanError()) {
                Invalid QR Code
              } @else {
                QR Code Scanned
              }
            </h2>

            <p class="scanned-message">
              @if (isProcessing()) {
                Please wait while we verify your invite
              } @else if (scanError()) {
                {{ scannedData() || 'This QR code is not valid for supervisor login' }}
              } @else {
                Your invite has been verified. Continue to complete registration.
              }
            </p>

            @if (scanError()) {
              <ion-button expand="block" class="retry-btn" (click)="retryScan()">
                <ion-icon name="qr-code-scanner-outline" slot="start"></ion-icon>
                Scan Again
              </ion-button>
            }
          </div>
        }

        <div class="manual-entry">
          <p class="manual-hint">Have an invite token?</p>
          <ion-button fill="clear" size="small" (click)="showManualEntry()">
            Enter Token Manually
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
    .scanner-content {
      --background: var(--agb-off-white);
    }
    .scanner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: 24px;
    }
    .scanner-view {
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .scanner-frame {
      position: relative;
      width: 240px;
      height: 240px;
      background: var(--agb-black);
      border-radius: var(--agb-radius-xl);
      overflow: hidden;
    }
    .scanner-corners {
      position: absolute;
      inset: 0;
    }
    .corner {
      position: absolute;
      width: 40px;
      height: 40px;
      border-color: var(--agb-secondary);
      border-style: solid;
      border-width: 0;
    }
    .corner.top-left {
      top: 0; left: 0;
      border-top-width: 4px;
      border-left-width: 4px;
      border-top-left-radius: 16px;
    }
    .corner.top-right {
      top: 0; right: 0;
      border-top-width: 4px;
      border-right-width: 4px;
      border-top-right-radius: 16px;
    }
    .corner.bottom-left {
      bottom: 0; left: 0;
      border-bottom-width: 4px;
      border-left-width: 4px;
      border-bottom-left-radius: 16px;
    }
    .corner.bottom-right {
      bottom: 0; right: 0;
      border-bottom-width: 4px;
      border-right-width: 4px;
      border-bottom-right-radius: 16px;
    }
    .scanner-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--agb-secondary);
      animation: scan 2s ease-in-out infinite;
    }
    @keyframes scan {
      0%, 100% { top: 10%; opacity: 1; }
      50% { top: 90%; opacity: 0.5; }
    }
    .scanner-hint {
      margin-top: 24px;
      font-size: 14px;
      color: var(--agb-gray);
      text-align: center;
    }
    .scanned-view {
      text-align: center;
      padding: 48px 24px;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--agb-light-gray);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .success-icon ion-icon {
      font-size: 48px;
    }
    .success-icon.error {
      background: rgba(220, 53, 69, 0.1);
    }
    .scanned-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--agb-navy);
      margin: 0 0 12px;
    }
    .scanned-message {
      font-size: 14px;
      color: var(--agb-gray);
      margin: 0 0 32px;
      line-height: 1.6;
    }
    .retry-btn {
      --background: var(--agb-primary);
      --color: var(--agb-white);
    }
    .manual-entry {
      margin-top: 48px;
      text-align: center;
    }
    .manual-hint {
      font-size: 13px;
      color: var(--agb-gray);
      margin: 0 0 8px;
    }
    .otp-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 1000;
    }
    .otp-content {
      background: var(--agb-white);
      border-radius: var(--agb-radius-xl);
      padding: 32px 24px;
      width: 100%;
      max-width: 360px;
      text-align: center;
    }
    .otp-content h3 {
      font-size: 20px;
      font-weight: 700;
      color: var(--agb-navy);
      margin: 0 0 8px;
    }
    .otp-content p {
      font-size: 14px;
      color: var(--agb-gray);
      margin: 0 0 24px;
    }
    .otp-inputs {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-bottom: 24px;
    }
    .otp-digit {
      width: 48px;
      height: 56px;
      text-align: center;
      font-size: 24px;
      font-weight: 700;
      border: 2px solid var(--agb-light-gray);
      border-radius: var(--agb-radius-md);
      --padding-start: 0;
      --padding-end: 0;
    }
    .otp-digit:focus-within {
      border-color: var(--agb-primary);
    }
    .otp-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .otp-actions ion-button {
      --background: var(--agb-primary);
      --color: var(--agb-white);
    }
  `],
})
export class QrScannerPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  scannedData = signal<string | null>(null);
  scanError = signal(false);
  isProcessing = signal(false);

  inviteToken = '';

  async ngOnInit(): Promise<void> {
    addIcons({
qrCodeOutline,
      cameraOutline,
      closeCircleOutline,
      checkmarkCircleOutline,
      chevronBackOutline,
    });

    await this.startScanning();
  }

  async startScanning(): Promise<void> {
    try {
      const result = await this.auth.loginWithQRCode();

      if (!result.scanned) {
        this.scanError.set(true);
        this.scannedData.set('No QR code detected');
        return;
      }

      if (result.payload) {
        await Haptics.impact({ style: ImpactStyle.Medium });
        this.inviteToken = result.payload.token;
        this.scannedData.set('Invite detected');
        this.isProcessing.set(true);

        this.auth.verifyInvite(this.inviteToken).subscribe({
          next: (response) => {
            this.isProcessing.set(false);
            if (!response.valid) {
              this.scanError.set(true);
              this.scannedData.set('Invite is no longer valid');
              return;
            }
            // Stash the verify response for the signup page to pre-fill.
            try {
              sessionStorage.setItem('agb:pending-invite', JSON.stringify(response));
            } catch {
              // ignore
            }
            if (response.requiresOtp) {
              this.router.navigate(['/auth/verify-otp'], {
                queryParams: { token: this.inviteToken },
              });
            } else {
              this.router.navigate(['/auth/signup'], {
                queryParams: { token: this.inviteToken },
              });
            }
          },
          error: (error: unknown) => {
            this.isProcessing.set(false);
            this.scanError.set(true);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.scannedData.set(errorMessage || 'Invalid invite');
          },
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan QR code';
      this.scanError.set(true);
      this.scannedData.set(errorMessage);
    }
  }

  async retryScan(): Promise<void> {
    this.scannedData.set(null);
    this.scanError.set(false);
    await this.startScanning();
  }

  showManualEntry(): void {
    this.router.navigate(['/auth/manual-token']);
  }
}