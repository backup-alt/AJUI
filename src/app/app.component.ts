import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { IonApp } from "@ionic/angular/standalone";
import { MaterialsService } from "./core/materials.service";

const CACHE_VERSION = "v2-site-fix";

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
  private readonly materialsService = inject(MaterialsService);

  ngOnInit(): void {
    if (typeof localStorage !== "undefined") {
      const currentVersion = localStorage.getItem("agb-cache-version");
      if (currentVersion !== CACHE_VERSION) {
        localStorage.removeItem("agb-erp:materials");
        localStorage.removeItem("agb-erp:labour");
        localStorage.removeItem("agb-erp:expenses");
        localStorage.removeItem("agb-erp:vendors");
        localStorage.removeItem("agb-erp:supervisors");
        localStorage.removeItem("agb-erp:subcontractors");
        localStorage.removeItem("agb-erp:sites");
        localStorage.setItem("agb-cache-version", CACHE_VERSION);
      }
    }
    void this.materialsService.refresh();
  }
}
