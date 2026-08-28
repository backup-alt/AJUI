import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject } from "@angular/core";
import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterOutlet } from "@angular/router";
import { IonApp } from "@ionic/angular/standalone";
import { ApiService } from "./core/api.service";
import { WorkspaceHydrationService } from "./core/workspace-hydration.service";
import { HttpClient } from "@angular/common/http";
import { environment } from "../environments/environment";
import { NavigationLoadingService } from "./core/navigation-loading.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [IonApp, RouterOutlet],
  template: `
    <ion-app>
      <router-outlet></router-outlet>
      @if (navigationLoading.active()) {
        <div class="page-navigation-loader" role="status" aria-live="polite" aria-label="Loading page">
          <span class="page-navigation-spinner" aria-hidden="true"></span>
          <span>Loading…</span>
        </div>
      }
    </ion-app>
  `,
  styles: [`
    .page-navigation-loader {
      position: fixed;
      inset: 0;
      z-index: 2147483600;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 12px;
      background: rgba(248, 250, 252, 0.82);
      color: #17366f;
      font-size: 13px;
      font-weight: 750;
      letter-spacing: 0.02em;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .page-navigation-spinner {
      width: 38px;
      height: 38px;
      border: 4px solid #dbe7fb;
      border-top-color: #2c5cff;
      border-radius: 50%;
      animation: page-navigation-spin 700ms linear infinite;
    }
    @keyframes page-navigation-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .page-navigation-spinner { animation-duration: 1400ms; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly hydration = inject(WorkspaceHydrationService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly navigationLoading = inject(NavigationLoadingService);

  ngOnInit(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        this.navigationLoading.stop();
      }
    });
    if (this.api.isAuthenticated()) {
      void this.hydration.hydrateFromBackend();
    }
    this.startKeepAlive();
    requestAnimationFrame(() => this.removeSplash());
  }

  @HostListener("document:click", ["$event"])
  openDatePickerFromField(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "date" || target.disabled || target.readOnly) return;
    try {
      (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Browsers without showPicker still open their native calendar normally.
    }
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
