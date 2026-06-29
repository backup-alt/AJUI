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
  personCircleOutline,
  callOutline,
  mailOutline,
  lockClosedOutline,
  scanOutline,
  flashOutline,
  flashOffOutline,
  refreshOutline,
  closeOutline,
  arrowForwardOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { MockDataService } from '../../core/services/mock-data.service';
import {
  BarcodeScanner,
  BarcodeFormat,
  LensFacing,
} from '@capacitor-mlkit/barcode-scanning';

interface QrPayload {
  token: string;
  supervisorName: string;
  expiresAt: number;
}

// The single, fixed QR payload for the offline test mode.
// The mobile app knows this exact value; the admin's web app also generates
// a QR with this exact payload (see Settings → Add Supervisor on the web).
// In production, the backend issues a unique one-time token per supervisor
// and the QR encodes the full JSON payload.
const TEST_QR_PAYLOAD: QrPayload = {
  token: 'AGB-SUPERVISOR-2026-OFFLINE-TEST-TOKEN',
  supervisorName: 'Rajesh Kumar',
  // 24 hours from now (fixed for deterministic builds)
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
              <strong>No camera?</strong>
              <button class="link-btn" (click)="useOfflineToken()">Use the offline test token instead</button>
            </div>
          </div>
        </div>

        <div class="footer-meta">AGB Supervisor · v0.3.0-phase3</div>
      </div>

      <!-- ============== STEP 2: Camera Scanner ============== -->
      <div *ngIf="step === 'scanning'" class="scanner-wrap">
        <div class="scanner-header">
          <div class="scanner-title">
            <ion-icon name="qr-code-outline"></ion-icon>
            <span>Scan QR Code</span>
          </div>
          <ion-button fill="clear" size="small" class="close-btn" (click)="stopScan()">
            <ion-icon name="close-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </div>

        <!-- The ML Kit plugin renders its own camera preview here -->
        <div class="scanner-stage" id="scanner-stage"></div>

        <div class="scanner-overlay">
          <div class="scanner-frame">
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
          </div>
          <p class="scanner-hint">Align the QR code from the web dashboard within the frame.</p>
          <div class="scanner-actions">
            <ion-button fill="clear" class="scanner-toggle" (click)="toggleTorch()" *ngIf="torchSupported">
              <ion-icon [name]="torchOn() ? 'flash-off-outline' : 'flash-outline'" slot="icon-only"></ion-icon>
            </ion-button>
            <ion-button fill="clear" class="scanner-toggle" (click)="useOfflineToken()">
              <ion-icon name="refresh-outline" slot="icon-only"></ion-icon>
            </ion-button>
          </div>
        </div>
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
            <ion-input [(ngModel)]="signupPassword" type="password" placeholder="Min 6 characters"></ion-input>
          </ion-item>

          <ion-button expand="block" class="agb-primary" (click)="completeSignup()" [disabled]="loading">
            <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
            <span *ngIf="!loading">Activate & Continue</span>
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
    .brand.small h2 {
      margin: 0; font-size: 20px; font-weight: 700;
    }
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

    /* ====== Scanner ====== */
    .scanner-wrap {
      position: relative; width: 100%; height: 100%;
      background: #000000;
    }
    .scanner-header {
      position: absolute; top: 0; left: 0; right: 0; z-index: 10;
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 16px;
      background: linear-gradient(180deg, rgba(0,0,0,0.6), transparent);
    }
    .scanner-title {
      display: flex; align-items: center; gap: 8px;
      color: #ffffff; font-weight: 700; font-size: 15px;
    }
    .close-btn { --color: #ffffff; }
    .scanner-stage {
      position: absolute; inset: 0;
    }
    .scanner-stage canvas, .scanner-stage video {
      width: 100% !important; height: 100% !important;
      object-fit: cover !important;
    }
    .scanner-overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      pointer-events: none;
    }
    .scanner-frame {
      position: relative;
      width: 240px; height: 240px;
    }
    .corner {
      position: absolute; width: 36px; height: 36px;
      border: 4px solid var(--agb-gold);
    }
    .corner.tl { top: 0; left: 0; border-right: none; border-bottom: none; border-top-left-radius: 16px; }
    .corner.tr { top: 0; right: 0; border-left: none; border-bottom: none; border-top-right-radius: 16px; }
    .corner.bl { bottom: 0; left: 0; border-right: none; border-top: none; border-bottom-left-radius: 16px; }
    .corner.br { bottom: 0; right: 0; border-left: none; border-top: none; border-bottom-right-radius: 16px; }

    .scanner-hint {
      margin-top: 32px;
      color: #ffffff; font-size: 13px;
      background: rgba(0,0,0,0.55); padding: 8px 14px; border-radius: 999px;
      max-width: 80%; text-align: center;
    }
    .scanner-actions {
      display: flex; gap: 16px;
      margin-top: 28px; pointer-events: auto;
    }
    .scanner-toggle {
      --color: #ffffff;
      --background: rgba(255,255,255,0.16);
      --border-radius: 50%;
      width: 52px; height: 52px;
    }
  `],
})
export class LoginPage implements OnInit {
  step: 'welcome' | 'scanning' | 'signup' = 'welcome';
  loading = false;
  errorMessage = '';

  // Scanned invite data (prefilled into the signup form)
  scannedName = signal('');
  scannedToken = signal('');
  scannedExpiresAt = signal(0);

  signupName = '';
  signupPhone = '';
  signupEmail = '';
  signupPassword = '';

  torchOn = signal(false);
  torchSupported = false;
  private scanListener: any = null;

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
      'person-circle-outline': personCircleOutline,
      'call-outline': callOutline,
      'mail-outline': mailOutline,
      'lock-closed-outline': lockClosedOutline,
      'scan-outline': scanOutline,
      'flash-outline': flashOutline,
      'flash-off-outline': flashOffOutline,
      'refresh-outline': refreshOutline,
      'close-outline': closeOutline,
      'arrow-forward-outline': arrowForwardOutline,
    });
  }

  async ngOnInit() {
    try {
      const supported = await BarcodeScanner.isSupported();
      this.torchSupported = supported.supported;
    } catch {}
  }

  // ============== Step 1: Start camera scan ==============
  async startScan() {
    this.errorMessage = '';
    this.loading = true;
    try {
      const status = await BarcodeScanner.requestPermissions();
      if (status.camera !== 'granted') {
        this.errorMessage = 'Camera permission is required to scan the QR code.';
        this.loading = false;
        return;
      }

      // Mount the camera preview into our container
      const stage = document.getElementById('scanner-stage');
      if (!stage) {
        this.errorMessage = 'Scanner UI not ready. Please try again.';
        this.loading = false;
        return;
      }

      // Listen for scans BEFORE starting the camera (some plugins require this order)
      this.scanListener = await BarcodeScanner.addListener('barcodesScanned', async (result) => {
        const code = result.barcodes?.[0]?.rawValue;
        if (code) {
          await this.onScanned(code);
        }
      });

      // Hide WebView so the native camera preview shows through
      document.body.classList.add('scanner-active');

      await BarcodeScanner.startScan({
        formats: [BarcodeFormat.QrCode],
        lensFacing: LensFacing.Back,
      });

      this.step = 'scanning';
      this.loading = false;
    } catch (e: any) {
      console.error('[Scanner] failed to start:', e);
      this.errorMessage =
        'Could not start the camera. ' +
        (e?.message || '') +
        ' Use the offline test token below.';
      this.loading = false;
      this.step = 'welcome';
      document.body.classList.remove('scanner-active');
    }
  }

  async stopScan() {
    try {
      await BarcodeScanner.stopScan();
    } catch {}
    if (this.scanListener) {
      try { this.scanListener.remove(); } catch {}
      this.scanListener = null;
    }
    document.body.classList.remove('scanner-active');
    this.torchOn.set(false);
    this.step = 'welcome';
  }

  async toggleTorch() {
    try {
      if (this.torchOn()) {
        await BarcodeScanner.disableTorch();
        this.torchOn.set(false);
      } else {
        await BarcodeScanner.enableTorch();
        this.torchOn.set(true);
      }
    } catch {}
  }

  // ============== Step 2: Handle scanned value ==============
  async onScanned(raw: string) {
    // Stop the camera immediately so we don't get duplicate scans
    await this.stopScan();

    if (!raw) {
      this.errorMessage = 'Could not read the QR code. Please try again.';
      return;
    }

    // Try to parse as the structured JSON payload first (production path)
    let payload: QrPayload | null = null;
    try {
      payload = JSON.parse(raw) as QrPayload;
    } catch {
      // Could be a raw token string (legacy); treat as token-only
      payload = { token: raw.trim(), supervisorName: '', expiresAt: 0 };
    }

    if (!payload?.token) {
      this.errorMessage = 'Invalid QR code format.';
      return;
    }

    // Expiry check
    if (payload.expiresAt && payload.expiresAt < Date.now()) {
      this.errorMessage = 'This invite has expired. Please ask your admin for a new one.';
      return;
    }

    // Validate the token: in offline test mode, the only accepted token is the
    // hardcoded one. In production, this calls the backend's verify endpoint.
    const valid = await this.validateToken(payload.token, payload.supervisorName);
    if (!valid.ok) {
      this.errorMessage = valid.reason || 'Invalid QR code.';
      return;
    }

    // Prefill the signup form
    this.scannedName.set(valid.supervisorName || 'Supervisor');
    this.scannedToken.set(payload.token);
    this.scannedExpiresAt.set(payload.expiresAt || Date.now() + 24 * 60 * 60 * 1000);

    this.signupName = valid.supervisorName || 'Supervisor';
    this.signupPhone = valid.phone || '+91 98765 43210';
    this.signupEmail = valid.email || 'supervisor@agbuilders.com';

    this.step = 'signup';
  }

  /**
   * Offline-first token validation.
   * - In test mode: compares to the hardcoded TEST_QR_PAYLOAD.
   * - In production: would POST to /api/auth/supervisor/verify/:token on the backend.
   */
  private async validateToken(token: string, nameHint: string): Promise<{
    ok: boolean;
    reason?: string;
    supervisorName?: string;
    phone?: string;
    email?: string;
  }> {
    // 1) Match against offline test payload
    if (token === TEST_QR_PAYLOAD.token) {
      return {
        ok: true,
        supervisorName: TEST_QR_PAYLOAD.supervisorName,
        phone: '+91 98765 43210',
        email: 'rajesh.kumar@agbuilders.com',
      };
    }

    // 2) Any non-empty token containing "AGB-SUPERVISOR" is accepted in test mode
    if (token.includes('AGB-SUPERVISOR') && !token.includes('EXPIRED')) {
      return {
        ok: true,
        supervisorName: nameHint || 'Supervisor',
        phone: '+91 98765 43210',
        email: 'supervisor@agbuilders.com',
      };
    }

    // 3) Production path (commented until backend is deployed):
    // return await fetch(`${environment.backendUrl}/api/auth/supervisor/verify/${token}`)
    //   .then(r => r.ok ? r.json() : null)
    //   .then((data) => data?.valid
    //     ? { ok: true, supervisorName: data.supervisorName, phone: data.phone, email: data.email }
    //     : { ok: false, reason: 'Invalid invite.' });

    return { ok: false, reason: 'QR code not recognised. Please contact your administrator.' };
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