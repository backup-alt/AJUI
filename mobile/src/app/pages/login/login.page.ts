import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonInput,
  IonButton,
  IonItem,
  IonLabel,
  IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  lockClosedOutline,
  scanOutline,
  refreshOutline,
  arrowForwardOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { environment } from '../../../environments/environment';

interface QrPayload {
  token: string;
  supervisorName: string;
  expiresAt: number;
}

// In offline test mode the only accepted token is the one we baked into
// environment.ts. In production the env-supplied testQrToken is empty and
// the app always validates against the backend.
const TEST_QR_PAYLOAD: QrPayload = {
  token: environment.testQrToken || 'AGB-DISABLED',
  supervisorName: environment.testQrSupervisorName || 'Supervisor',
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonIcon,
    IonInput,
    IonButton,
    IonItem,
    IonLabel,
    IonSpinner,
  ],
  template: `
    <ion-content [fullscreen]="true" class="login-content">
      <div class="bg-decor"></div>

      <!-- ============== STEP 1: Welcome + Scan ============== -->
      <div *ngIf="step === 'welcome'" class="login-wrap">
        <div class="brand">
          <div class="brand-mark">AGB</div>
          <h1>Annai Golden Builders</h1>
          <p>Supervisor Console</p>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="head-icon">
              <ion-icon name="qr-code-outline"></ion-icon>
            </div>
            <div>
              <h2>Activate your device</h2>
              <p>Scan the QR code shown by your administrator on the web dashboard.</p>
            </div>
          </div>

          <ion-button expand="block" class="agb-primary" (click)="startScan()" [disabled]="loading">
            <ion-icon name="scan-outline" slot="start"></ion-icon>
            <span *ngIf="!loading">Scan QR Code</span>
            <ion-spinner *ngIf="loading" name="dots"></ion-spinner>
          </ion-button>

          <div *ngIf="errorMessage" class="error-banner">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <span>{{ errorMessage }}</span>
          </div>

          <div class="hint">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <div>
              <strong>No camera or testing on an emulator?</strong>
              <button class="link-btn" (click)="useOfflineToken()">
                Use the offline test token instead
              </button>
            </div>
          </div>
        </div>

        <div class="footer-meta">AGB Supervisor · v0.4.0-phase3</div>
      </div>

      <!-- ============== STEP 3: Account setup ============== -->
      <div *ngIf="step === 'signup'" class="login-wrap">
        <div class="brand small">
          <div class="brand-mark small">AGB</div>
          <h2>Welcome, {{ scannedName() }}</h2>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="head-icon success">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
            </div>
            <div>
              <h2>Set up your account</h2>
              <p>We've verified your invite. Add a password to continue.</p>
            </div>
          </div>

          <ion-item class="agb-field" lines="none">
            <ion-label position="stacked">Full Name</ion-label>
            <ion-input [(ngModel)]="signupName" readonly></ion-input>
          </ion-item>

          <ion-item class="agb-field" lines="none">
            <ion-label position="stacked">Phone</ion-label>
            <ion-input [(ngModel)]="signupPhone" readonly></ion-input>
          </ion-item>

          <ion-item class="agb-field" lines="none">
            <ion-label position="stacked">Email</ion-label>
            <ion-input [(ngModel)]="signupEmail" type="email" readonly></ion-input>
          </ion-item>

          <ion-item class="agb-field" lines="none">
            <ion-label position="stacked">Password</ion-label>
            <ion-input
              [(ngModel)]="signupPassword"
              type="password"
              placeholder="Min 6 characters"
            ></ion-input>
          </ion-item>

          <ion-button expand="block" class="agb-primary" (click)="completeSignup()" [disabled]="loading">
            <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            <span *ngIf="!loading">Activate &amp; Continue</span>
            <ion-spinner *ngIf="loading" name="dots"></ion-spinner>
          </ion-button>

          <ion-button expand="block" fill="clear" class="agb-text-btn" (click)="reset()">
            Use a different QR code
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-content { --background: var(--agb-gradient-primary); }
    .bg-decor {
      position: absolute; inset: 0;
      background:
        radial-gradient(circle at 20% 0%, rgba(255,255,255,0.10), transparent 40%),
        radial-gradient(circle at 100% 80%, rgba(201,162,39,0.18), transparent 45%);
      pointer-events: none;
    }
    .login-wrap {
      position: relative; min-height: 100%;
      display: flex; flex-direction: column; justify-content: center;
      padding: 28px 22px; gap: 22px;
    }
    .brand { text-align: center; color: #ffffff; padding-bottom: 6px; }
    .brand-mark {
      width: 64px; height: 64px; border-radius: 18px;
      background: var(--agb-gradient-gold); color: #2a230a;
      font-weight: 800; font-size: 22px; letter-spacing: 1px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 14px;
      box-shadow: 0 12px 28px rgba(0,0,0,0.30);
    }
    .brand-mark.small {
      width: 56px; height: 56px; border-radius: 16px; font-size: 18px; margin-bottom: 12px;
    }
    .brand.small h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .brand h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.3px; }
    .brand p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; letter-spacing: 0.4px; text-transform: uppercase; }

    .card {
      background: #ffffff; border-radius: var(--agb-radius-lg);
      padding: 22px 18px 18px;
      box-shadow: 0 24px 48px rgba(0,0,0,0.22);
    }
    .card-head { display: flex; gap: 14px; margin-bottom: 18px; }
    .head-icon {
      width: 48px; height: 48px; border-radius: 14px;
      background: rgba(0,34,99,0.10); color: var(--agb-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; flex-shrink: 0;
    }
    .head-icon.success {
      background: rgba(31,157,106,0.14); color: var(--agb-success);
    }
    .card-head h2 { margin: 2px 0 4px; font-size: 18px; font-weight: 700; color: var(--agb-text); }
    .card-head p { margin: 0; font-size: 13px; color: var(--agb-text-muted); line-height: 1.45; }

    ion-item.agb-field {
      --background: transparent; --inner-padding-end: 0; --padding-start: 0;
      --border-color: transparent; margin-bottom: 12px;
    }
    ion-item.agb-field ion-label {
      color: var(--agb-text); font-weight: 600; font-size: 12px;
      letter-spacing: 0.3px; text-transform: uppercase; margin-bottom: 4px;
    }
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-radius: 10px;
      background: rgba(216,68,58,0.10); color: var(--agb-danger);
      font-size: 13px; font-weight: 600; margin-top: 12px;
    }
    .hint {
      display: flex; gap: 8px; padding: 10px 12px;
      border-radius: 10px; background: rgba(0,34,99,0.05);
      color: var(--agb-text-muted); font-size: 11px; margin-top: 14px;
      line-height: 1.5; align-items: flex-start;
    }
    .hint ion-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
    .hint strong { color: var(--agb-text); display: block; margin-bottom: 2px; }
    .link-btn {
      background: none; border: none; padding: 0; margin: 0;
      color: var(--agb-primary); font-weight: 700; cursor: pointer;
      text-decoration: underline; font-size: 11px;
    }
    .agb-text-btn { --color: var(--agb-primary); font-weight: 600; text-transform: none; margin-top: 8px; }
    .footer-meta { text-align: center; color: rgba(255,255,255,0.65); font-size: 11px; padding: 6px; }
  `],
})
export class LoginPage implements OnInit {
  step: 'welcome' | 'signup' = 'welcome';
  loading = false;
  errorMessage = '';

  scannedName = signal('');
  scannedToken = signal('');

  signupName = '';
  signupPhone = '';
  signupEmail = '';
  signupPassword = '';

  constructor(
    private auth: AuthService,
    private mock: MockDataService,
    private router: Router,
    private toastCtrl: ToastController,
  ) {
    addIcons({
      'qr-code-outline': qrCodeOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'alert-circle-outline': alertCircleOutline,
      'lock-closed-outline': lockClosedOutline,
      'scan-outline': scanOutline,
      'refresh-outline': refreshOutline,
      'arrow-forward-outline': arrowForwardOutline,
    });
  }

  ngOnInit() {
    // No setup needed at the moment.
  }

  // ============== Step 1: Trigger native QR scan ==============
  async startScan() {
    this.errorMessage = '';
    this.loading = true;

    try {
      // Ask for camera permission. The plugin throws a clear error if denied.
      const status = await BarcodeScanner.requestPermissions();
      if (status.camera !== 'granted') {
        this.errorMessage =
          'Camera permission is required to scan the QR code. ' +
          'Tap the offline test token below to skip the camera.';
        this.loading = false;
        return;
      }

      // Use the simple `scan()` API: it opens Google's Code Scanner activity,
      // waits for a successful scan, and resolves with the barcode payload.
      // This avoids the more complex `startScan()` flow which requires the
      // GMS module to be installed on the device.
      const result = await BarcodeScanner.scan();
      const raw = result?.barcodes?.[0]?.rawValue;
      if (!raw) {
        this.errorMessage = 'No QR code was captured. Please try again.';
        this.loading = false;
        return;
      }
      await this.onScanned(raw);
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (msg.toLowerCase().includes('cancel')) {
        // User dismissed the scanner; stay on the welcome screen.
        this.errorMessage = '';
      } else if (msg.toLowerCase().includes('unavailable')) {
        this.errorMessage =
          'The barcode scanner is not available on this device. ' +
          'Tap the offline test token below to continue.';
      } else {
        this.errorMessage = 'Scanner error: ' + msg;
      }
      this.loading = false;
    }
  }

  // ============== Step 2: Validate scanned value ==============
  async onScanned(raw: string) {
    this.errorMessage = '';

    // Try parsing as the structured JSON payload first (production path).
    let payload: QrPayload | null = null;
    try {
      payload = JSON.parse(raw) as QrPayload;
    } catch {
      // Treat as a raw token string (legacy / fallback)
      payload = { token: raw.trim(), supervisorName: '', expiresAt: 0 };
    }

    if (!payload?.token) {
      this.errorMessage = 'Invalid QR code format.';
      this.loading = false;
      return;
    }

    if (payload.expiresAt && payload.expiresAt < Date.now()) {
      this.errorMessage = 'This invite has expired. Please ask your admin for a new one.';
      this.loading = false;
      return;
    }

    const valid = await this.validateToken(payload.token, payload.supervisorName);
    if (!valid.ok) {
      this.errorMessage = valid.reason || 'Invalid QR code.';
      this.loading = false;
      return;
    }

    this.scannedName.set(valid.supervisorName || 'Supervisor');
    this.scannedToken.set(payload.token);

    this.signupName = valid.supervisorName || 'Supervisor';
    this.signupPhone = valid.phone || '+91 98765 43210';
    this.signupEmail = valid.email || 'supervisor@agbuilders.com';

    this.loading = false;
    this.step = 'signup';
  }

  /**
   * Offline-first token validation.
   *
   * Production flow:
   *   POSTs the scanned token to `${environment.backendUrl}/api/auth/supervisor/verify`
   *   and returns the supervisor profile the backend decoded from the invite.
   *
   * Offline test flow (development builds only):
   *   Compares the token to the hardcoded TEST_QR_PAYLOAD. If the env-supplied
   *   testQrToken is empty (production build), the offline path is disabled.
   */
  private async validateToken(
    token: string,
    nameHint: string,
  ): Promise<{
    ok: boolean;
    reason?: string;
    supervisorName?: string;
    phone?: string;
    email?: string;
  }> {
    // --- Production path: always ask the backend first ---
    try {
      const res = await fetch(
        `${environment.backendUrl}/api/auth/supervisor/verify/${encodeURIComponent(token)}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.valid) {
          return {
            ok: true,
            supervisorName: data.supervisorName || nameHint || 'Supervisor',
          };
        }
        return { ok: false, reason: data?.message || 'Invite rejected by server.' };
      }
    } catch (e) {
      console.warn('[validateToken] backend unreachable, falling back to offline mode', e);
    }

    // --- Offline path (development only) ---
    if (!environment.testQrToken) {
      return { ok: false, reason: 'Cannot reach the server. Please check your connection.' };
    }

    if (token === TEST_QR_PAYLOAD.token) {
      return {
        ok: true,
        supervisorName: TEST_QR_PAYLOAD.supervisorName,
        phone: '+91 98765 43210',
        email: 'rajesh.kumar@agbuilders.com',
      };
    }

    if (token.includes('AGB-SUPERVISOR') && !token.includes('EXPIRED')) {
      return {
        ok: true,
        supervisorName: nameHint || TEST_QR_PAYLOAD.supervisorName,
        phone: '+91 98765 43210',
        email: 'supervisor@agbuilders.com',
      };
    }

    return {
      ok: false,
      reason: 'QR code not recognised. Please contact your administrator.',
    };
  }

  // Allow users without a camera (or in dev) to bypass the scanner with the
  // hardcoded test token.
  useOfflineToken() {
    this.onScanned(JSON.stringify(TEST_QR_PAYLOAD));
  }

  // ============== Step 3: Complete signup ==============
  async completeSignup() {
    if (!this.signupPassword || this.signupPassword.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters.';
      return;
    }
    this.loading = true;
    setTimeout(async () => {
      const user = this.mock.currentUser();
      this.mock.updateUser({
        name: this.signupName || user.name,
        phone: this.signupPhone || user.phone,
        email: this.signupEmail || user.email,
        lastLoginAt: new Date().toISOString(),
      });
      this.auth.setUser(this.mock.currentUser());
      this.loading = false;
      const toast = await this.toastCtrl.create({
        message: 'Welcome, ' + this.signupName + '!',
        duration: 1800,
        position: 'top',
        cssClass: 'agb-toast',
      });
      await toast.present();
      this.router.navigate(['/tabs/home']);
    }, 700);
  }

  reset() {
    this.step = 'welcome';
    this.signupPassword = '';
    this.errorMessage = '';
  }
}