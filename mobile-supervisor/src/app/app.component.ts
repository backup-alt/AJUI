import { Component, OnInit, inject, NgZone } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthService } from './core/services/auth.service';
import { SupervisorService } from './core/services/supervisor.service';
import { NotificationService } from './core/services/notification.service';

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
  private router = inject(Router);
  private zone = inject(NgZone);

  async ngOnInit(): Promise<void> {
    await this.auth.init();
    if (this.auth.isAuthenticated()) {
      await this.auth.initAfterLogin();
    }
    await this.supervisor.init();
    await this.notifications.initFromStorage();

    if (this.notifications.pushEnabled()) {
      try {
        await this.notifications.requestPermission();
      } catch {
        // ignore
      }
    }

    this.registerDeepLink();
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
            this.router.navigate(['/auth/signup'], {
              queryParams: { token },
            });
          }
        },
        error: () => {
          this.router.navigate(['/auth/signup'], {
            queryParams: { token },
          });
        },
      });
    } catch (err) {
      console.warn('[App] Failed to handle deep link', url, err);
    }
  }
}
