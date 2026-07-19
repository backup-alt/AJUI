import { Component, OnInit, inject } from '@angular/core';
import {
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline,
  mailOutline,
  shieldCheckmarkOutline,
  chevronForwardOutline,
  mailUnreadOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, IonIcon],
  template: `
    <ion-content class="login-content" [fullscreen]="true">
      <div class="login-shell">
        <div class="login-card">
          <header class="hero">
            <h1 class="hero-title">Welcome Back, Builder</h1>
            <p class="hero-sub">
              Sign in to manage your sites, materials, labor, and expenses in one place.
           </p>
         </header>

          <div class="auth-card">
            <button
              class="action-tile primary"
              type="button"
              (click)="goToQR()"
              [disabled]="isLoading"
            >
              <span class="tile-icon">
                <ion-icon name="qr-code-outline"></ion-icon>
             </span>
              <span class="tile-body">
                <span class="tile-title">Sign in with QR Code</span>
                <span class="tile-sub">Scan the invite QR from your admin</span>
             </span>
              <span class="tile-chev"><ion-icon name="chevron-forward-outline"></ion-icon></span>
           </button>

            <button
              class="action-tile"
              type="button"
              (click)="goToPassword()"
              [disabled]="isLoading"
            >
              <span class="tile-icon tile-icon-soft">
                <ion-icon name="mail-outline"></ion-icon>
             </span>
              <span class="tile-body">
                <span class="tile-title">Sign in with Email & Password</span>
                <span class="tile-sub">Use the password set during onboarding</span>
             </span>
              <span class="tile-chev"><ion-icon name="chevron-forward-outline"></ion-icon></span>
           </button>
         </div>

          <div class="invite-hint">
            <span class="hint-icon"><ion-icon name="mail-unread-outline"></ion-icon></span>
            <div class="hint-body">
              <strong>Don't have an account yet</strong>
              <span>
                Use the invite link sent by your admin and tap
                <em>Create Account</em> to set your password.
             </span>
           </div>
         </div>

          <div class="trust">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <span>Secure supervisor access &middot; AGB internal</span>
         </div>
       </div>
     </div>
   </ion-content>
  `,
  styles: [`
    .login-content {
      --background: #f5f6f8;
      --padding-top: 0;
      --padding-bottom: 0;
      --padding-start: 0;
      --padding-end: 0;
    }

    .login-shell {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: max(24px, env(safe-area-inset-top)) 16px
              max(24px, env(safe-area-inset-bottom));
      box-sizing: border-box;
    }

    .login-card {
      width: 100%;
      max-width: 460px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .hero {
      text-align: center;
      padding: 0 8px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .hero-title {
      font-size: 26px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.5px;
      margin: 0;
      color: #0f172a;
    }
    .hero-sub {
      font-size: 14px;
      line-height: 1.55;
      color: #475569;
      margin: 0 auto;
      max-width: 360px;
    }

    .auth-card {
      background: #ffffff;
      border-radius: 22px;
      padding: 18px;
      box-shadow: 0 18px 48px -22px rgba(15, 23, 42, 0.25);
      border: 1px solid #eef0f3;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .action-tile {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
      color: #0f172a;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast), background var(--agb-transition-fast);
    }
    .action-tile:disabled { opacity: 0.6; cursor: not-allowed; }
    .action-tile:hover { background: #f1f5f9; }
    .action-tile:active { transform: scale(0.99); }
    .action-tile.primary {
      background: var(--agb-gradient-primary);
      border-color: transparent;
      color: #ffffff;
      box-shadow: 0 10px 24px -10px rgba(0, 34, 99, 0.55);
    }
    .action-tile.primary:hover { background: #001a4d; }

    .tile-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .tile-icon.tile-icon-soft,
    .tile-icon.soft {
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
    }
    .tile-icon ion-icon { font-size: 22px; }

    .tile-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .tile-title { font-size: 15px; font-weight: 700; }
    .tile-sub { font-size: 12px; opacity: 0.8; }

    .tile-chev {
      color: inherit;
      opacity: 0.6;
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }
    .tile-chev ion-icon { font-size: 20px; }

    .invite-hint {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 16px;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 16px;
      box-shadow: var(--agb-shadow-2xs);
    }
    .hint-icon {
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 12px;
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .hint-icon ion-icon { font-size: 18px; }
    .hint-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .invite-hint strong {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
    }
    .invite-hint span {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .invite-hint em {
      font-style: normal;
      color: #002263;
      font-weight: 600;
    }

    .trust {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 4px;
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 0.4px;
    }
    .trust ion-icon { font-size: 14px; }

    @media (max-width: 380px) {
      .hero-title { font-size: 22px; }
      .hero-sub { font-size: 13px; }
      .action-tile { padding: 14px; gap: 12px; }
      .tile-icon { width: 40px; height: 40px; border-radius: 12px; }
      .tile-title { font-size: 14px; }
    }
  `],
})
export class LoginPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  isLoading = false;

  async ngOnInit(): Promise<void> {
    addIcons({
      qrCodeOutline,
      mailOutline,
      shieldCheckmarkOutline,
      chevronForwardOutline,
      mailUnreadOutline,
    });

    try {
      const isAuthed = await this.auth.isLoggedIn();
      if (isAuthed) {
        await this.router.navigate(['/tabs/dashboard']);
      }
    } catch {
      // ignore
    }
  }

  goToQR(): void {
    void this.router.navigate(['/auth/qr-scanner']);
  }

  goToPassword(): void {
    void this.router.navigate(['/auth/password-login']);
  }
}
