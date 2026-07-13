import { Component, OnInit, inject } from '@angular/core';
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

  async ngOnInit(): Promise<void> {
    await this.auth.init();
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
   */
  private registerDeepLink(): void {
    CapacitorApp.addListener('appUrlOpen', (event) => {
      try {
        const url = new URL(event.url);
        const token = url.searchParams.get('token');
        const otp = url.searchParams.get('otp');
        if (token) {
          this.router.navigate(['/auth/signup'], {
            queryParams: { token, otp: otp ?? '' },
          });
        }
      } catch (err) {
        console.warn('[App] Failed to handle deep link', event.url, err);
      }
    });
  }
}
