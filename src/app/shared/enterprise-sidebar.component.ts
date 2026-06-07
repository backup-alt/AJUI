import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonButton, IonContent, IonIcon, IonItem, IonLabel, IonList, IonMenu } from "@ionic/angular/standalone";

type SidebarItem = {
  key: string;
  label: string;
  icon: string;
  route: unknown[];
  disabled?: boolean;
};

@Component({
  selector: "agb-enterprise-sidebar",
  standalone: true,
  imports: [CommonModule, RouterLink, IonButton, IonContent, IonIcon, IonItem, IonLabel, IonList, IonMenu],
  template: `
    <ion-menu contentId="main-content" type="overlay" class="enterprise-sidebar">
      <ion-content>
        <div class="sidebar-logo-wrap">
          <img class="sidebar-logo" [src]="logoPath" alt="Annai Golden Builders" />
          <div class="sidebar-brand-copy">
            <strong>Annai Golden</strong>
            <span>Builders ERP</span>
          </div>
        </div>

        <ion-list lines="none" class="sidebar-nav">
          <ion-item
            *ngFor="let item of items"
            button
            [routerLink]="item.route"
            [class.selected]="active === item.key"
            [class.disabled]="item.disabled"
            [disabled]="item.disabled"
          >
            <ion-icon slot="start" [name]="item.icon"></ion-icon>
            <ion-label>{{ item.label }}</ion-label>
          </ion-item>
        </ion-list>

        <div class="sidebar-action">
          <ion-button expand="block" [disabled]="!clientId" (click)="newProject.emit()">
            <ion-icon slot="start" name="add-outline"></ion-icon>
            New Project
          </ion-button>
        </div>
      </ion-content>
    </ion-menu>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnterpriseSidebarComponent {
  @Input() active = "dashboard";
  @Input() clientId: string | null = null;
  @Input() projectId: string | null = null;
  @Output() newProject = new EventEmitter<void>();

  readonly logoPath = "assets/logo.png";

  get items(): SidebarItem[] {
    const clientRoute = this.clientId ? ["/clients", this.clientId] : ["/clients"];
    const settingsRoute = this.clientId && this.projectId ? ["/clients", this.clientId, "projects", this.projectId] : clientRoute;

    return [
      { key: "dashboard", label: "Dashboard", icon: "grid-outline", route: clientRoute },
      { key: "clients", label: "Clients", icon: "people-outline", route: ["/clients"] },
      { key: "projects", label: "Projects", icon: "construct-outline", route: clientRoute },
      { key: "settings", label: "Settings", icon: "settings-outline", route: settingsRoute },
    ];
  }
}
