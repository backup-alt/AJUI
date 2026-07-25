import { Component, OnInit, inject, NgZone, effect } from '@angular/core';
import { IonApp, IonRouterOutlet, AlertController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { App as CapacitorApp, AppState } from '@capacitor/app';
import { AuthService } from './core/services/auth.service';
import { SupervisorService } from './core/services/supervisor.service';
import { NotificationService } from './core/services/notification.service';
import { AppReadyService } from './core/services/app-ready.service';

@Component({
  selector: 'app-root',
  template: `
    <ion-app>
      <ion-router-outlet />
    </ion-app>
  `,
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private auth = inject(AuthService);
  private supervisor = inject(SupervisorService);
  private notifications = inject(NotificationService);
  private appReady = inject(AppReadyService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private alertCtrl = inject(AlertController);

  private hasResumedOnce = false;
  private sessionExpiredAlertShown = false;

  async ngOnInit(): Promise<void> {
    // 1. Restore auth session (token + user from Preferences)
    await this.auth.init();

    if (this.auth.isAuthenticated()) {
      try {
        // 2. Fetch supervisor sites, auto-select first site
        await this.auth.initAfterLogin();
      } catch {
        // network may be down; continue — dashboard will show error state
      }
    }

    // 3. Hydrate selected site from Preferences
    await this.supervisor.init();
    // 4. Load cached notifications from Preferences
    await this.notifications.initFromStorage();

    if (this.notifications.pushEnabled()) {
      try {
        await this.notifications.requestPermission();
      } catch {
        // ignore
      }
    }

    this.registerDeepLink();
    this.registerAppStateListener();
    this.watchSessionExpiry();

    // 5. Wait for the first page (Dashboard) to finish loading all data.
    const DASHBOARD_TIMEOUT_MS = 12_000;
    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), DASHBOARD_TIMEOUT_MS)
    );

    const ready = await Promise.race([this.appReady.appReady, timeoutPromise]);
    if (!ready) {
      console.warn('[App] Dashboard timed out or failed — hiding splash anyway');
    }

    this.hideSplashScreen();
  }

  private hideSplashScreen(): void {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => { if (splash.parentNode) splash.remove(); }, 600);
    }
  }

  /**
   * Watch for session expiry signal from the interceptor.
   * When the refresh token is expired/revoked and a refresh attempt fails,
   * the interceptor sets auth.sessionExpired = true. We respond by showing
   * a non-dismissible alert prompting re-login.
   */
  private watchSessionExpiry(): void {
    effect(async () => {
      const expired = this.auth.sessionExpired();
      if (expired && !this.sessionExpiredAlertShown) {
        this.sessionExpiredAlertShown = true;
        await this.showSessionExpiredAlert();
      }
    });
  }

  private async showSessionExpiredAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Session Expired',
      message: 'Your session has expired. Please sign in again to continue.',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Sign In',
          handler: async () => {
            this.sessionExpiredAlertShown = false;
            this.auth.sessionExpired.set(false);
            await this.auth.logout();
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Listen for app foreground/background transitions.
   * When the app resumes, silently attempt a token refresh so the session
   * never expires while the user is active on another app or after a phone call.
   */
  private registerAppStateListener(): void {
    CapacitorApp.addListener('appStateChange', (state: AppState) => {
      if (state.isActive && this.auth.isAuthenticated()) {
        // Reset session expiry flag — user is back, we'll retry naturally
        this.auth.sessionExpired.set(false);
        this.sessionExpiredAlertShown = false;

        // Silently validate the session by hitting a lightweight endpoint.
        // The interceptor handles 401 → refresh → retry automatically.
        this.supervisor.getDashboard().subscribe({
          next: () => { /* touch endpoint to validate token */ },
          error: () => { /* interceptor handles 401 retry; sessionExpired signal handles true expiry */ },
        });
      }
    });
  }

  /**
   * Register the deep-link handler so that tapping an invite link in an email
   * (e.g. `agb-supervisor://invite?token=ABC`) navigates to the right screen.
   *
   * The flow is: verify the token, pre-fill the form, then route to signup.
   * OTPs are NEVER carried via email deep links.
   */
  private registerDeepLink(): void {
    CapacitorApp.addListener('appUrlOpen', (event) => {
      console.log('[DeepLink] received:', event.url);
      this.zone.run(() => {
        this.handleDeepLinkUrl(event.url);
      });
    });
  }

  private handleDeepLinkUrl(url: string): void {
    try {
      let token: string | null = null;
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(url);
        token = parsedUrl.searchParams.get('token');
      } catch {
        const match = url.match(/[?&]token=([^&]+)/);
        if (match) token = match[1];
      }

      if (!token) {
        console.warn('[DeepLink] No token found in URL:', url);
        return;
      }

      // Determine target route from URL host/path
      let targetRoute = '/auth/signup';
      let queryParams: Record<string, string> = { token };
      try {
        const u = new URL(url);
        if (u.hostname === 'reset-password' || u.pathname.includes('reset-password')) {
          targetRoute = '/auth/reset-password';
        } else if (u.hostname === 'invite' || u.pathname.includes('invite')) {
          targetRoute = '/auth/signup';
        }
      } catch {
        // fallback: if URL contains reset-password keyword
        if (url.includes('reset-password')) {
          targetRoute = '/auth/reset-password';
        }
      }

      this.auth.verifyInvite(token).subscribe({
        next: (response) => {
          try {
            sessionStorage.setItem('agb:pending-invite', JSON.stringify(response));
          } catch {
            // ignore
          }
          if (response.requiresOtp) {
            this.router.navigate(['/auth/verify-otp'], {
              queryParams: { token },
            });
          } else {
            this.router.navigate([targetRoute], {
              queryParams,
            });
          }
        },
        error: () => {
          this.router.navigate([targetRoute], {
            queryParams,
          });
        },
      });
    } catch (err) {
      console.warn('[App] Failed to handle deep link', url, err);
    }
  }
}
