import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { IonApp } from "@ionic/angular/standalone";
import { ApiService } from "./core/api.service";
import { WorkspaceHydrationService } from "./core/workspace-hydration.service";
import { HttpClient } from "@angular/common/http";
import { environment } from "../environments/environment";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [IonApp, RouterOutlet],
  template: `
    <ion-app>
      <router-outlet></router-outlet>
    </ion-app>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly hydration = inject(WorkspaceHydrationService);
  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    if (this.api.isAuthenticated()) {
      void this.hydration.hydrateFromBackend();
    }
    this.startKeepAlive();
    requestAnimationFrame(() => this.removeSplash());
  }

  /** Ping /keepalive immediately, then every 10 min to prevent
   *  Render free-tier spin-down and M0 connection expiry. */
  private startKeepAlive(): void {
    const keepaliveUrl = environment.apiUrl.replace(/\/api\/?$/, "") + "/keepalive";
    const ping = () => {
      try {
        this.http.get(keepaliveUrl, { responseType: "json" })
          .subscribe({ error: () => {} });
      } catch {}
    };
    ping();
    setInterval(ping, 10 * 60 * 1000);
  }

  private removeSplash(): void {
    try {
      const splash = document.getElementById("app-splash");
      if (splash) {
        splash.classList.add("hide");
        setTimeout(() => splash.remove(), 400);
      }
    } catch {}
  }
}
