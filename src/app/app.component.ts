import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { IonApp } from "@ionic/angular/standalone";
import { MaterialsService } from "./core/materials.service";

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
    void this.materialsService.refresh();
  }
}
