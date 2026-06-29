import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './core/services/auth.service';
import { MockDataService } from './core/services/mock-data.service';

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
  constructor(
    private auth: AuthService,
    private mock: MockDataService,
  ) {}

  ngOnInit() {
    // Restore session if a previous QR signup completed.
    try {
      const raw = localStorage.getItem('agb_session');
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.id) {
          this.auth.setUser(this.mock.currentUser());
        }
      }
    } catch {}
  }
}