import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import { AuthService } from './core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent implements OnInit {
  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit() {
    await this.auth.init();

    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/tabs/home']);
    }

    this.handleDeepLinks();
  }

  private async handleDeepLinks() {
    try {
      App.addListener('appUrlOpen', (event) => {
        const url = event.url;
        if (!url) return;

        console.log('[DeepLink] Received URL:', url);

        // Expected URL: ajui://supervisor/signup?token=xxx
        // Also handle: https://annai.../supervisor-signup?token=xxx (universal links)
        const parsed = new URL(url);
        const pathname = parsed.pathname.replace(/\/$/, '');

        if (pathname.endsWith('/supervisor/signup') || pathname.endsWith('/supervisor-signup')) {
          const token = parsed.searchParams.get('token');
          if (token) {
            console.log('[DeepLink] Supervisor invite token:', token);
            this.router.navigate(['/login'], { queryParams: { token }, replaceUrl: true });
          }
        }
      });

      App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          // Check if app was opened via deep link when coming back to foreground
        }
      });
    } catch (e) {
      console.warn('[DeepLink] Capacitor App plugin not available (running in browser):', e);
    }
  }
}