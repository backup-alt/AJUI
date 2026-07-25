import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { IonApp } from "@ionic/angular/standalone";
import { ApiService } from "./core/api.service";
import { MaterialsService } from "./core/materials.service";
import { WorkspaceHydrationService } from "./core/workspace-hydration.service";

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
  private readonly materialsService = inject(MaterialsService);
  private readonly hydration = inject(WorkspaceHydrationService);

  ngOnInit(): void {
    if (this.api.isAuthenticated()) {
      this.hydration.hydrateFromBackend().finally(() => {
        this.removeSplash();
      });
    } else {
      this.removeSplash();
    }
    void this.materialsService.refresh();
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
