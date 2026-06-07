import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import {
  IonHeader,
  IonTitle,
  IonToolbar,
} from "@ionic/angular/standalone";

@Component({
  selector: "agb-enterprise-header",
  standalone: true,
  imports: [CommonModule, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header class="enterprise-header" [class.client-header]="dark">
      <ion-toolbar>
        <div class="enterprise-toolbar">
          <div class="toolbar-left">
            <ion-title *ngIf="showLogo || showTitle">
              <img *ngIf="showLogo" class="topbar-logo" [src]="logoPath" alt="Annai Golden Builders" />
              <span *ngIf="!showLogo && showTitle">{{ title }}</span>
            </ion-title>
          </div>

          <div class="toolbar-search">
            <input [placeholder]="searchPlaceholder" />
          </div>
        </div>
      </ion-toolbar>
    </ion-header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnterpriseHeaderComponent {
  @Input() title = "Annai Golden Builders";
  @Input() role = "Admin";
  @Input() dark = false;
  @Input() showLogo = false;
  @Input() showTitle = true;
  @Input() showMenu = false;
  @Input() searchPlaceholder = "Search clients, projects, vendors...";

  readonly logoPath = "assets/logo.png";
}
