import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonMenu } from "@ionic/angular/standalone";
import { ErpDataService } from "../data/erp-data.service";
import type { Project } from "../../data/dashboardData";

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
  imports: [CommonModule, RouterLink, IonContent, IonIcon, IonItem, IonLabel, IonList, IonMenu],
  template: `
    <ion-menu contentId="main-content" type="overlay" class="enterprise-sidebar">
      <ion-content>
        <div class="sidebar-shell">
          <div class="sidebar-logo-wrap">
            <img class="sidebar-logo" [src]="logoPath" alt="Annai Golden Builders" />
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

          <section class="sidebar-project-list" *ngIf="clientId">
            <div class="sidebar-section-head">
              <span>Projects</span>
              <button type="button" class="project-create-icon" aria-label="Create new project" (click)="newProject.emit()">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                  <path d="M4 5.5h9.5" />
                  <path d="M4 11.5h7" />
                  <path d="M4 17.5h5.5" />
                  <path d="M16.5 10v7" />
                  <path d="M13 13.5h7" />
                </svg>
              </button>
            </div>
            <div *ngFor="let project of clientProjects" class="sidebar-project-row" [class.active]="project.id === projectId">
              <a [routerLink]="['/clients', clientId, 'projects', project.id, 'materials']">
                <span>{{ project.name }}</span>
                <small>{{ project.id }}</small>
              </a>
              <div class="sidebar-project-actions">
                <button type="button" aria-label="Edit project" (click)="editProject.emit(project)">
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                    <path d="M4 20h4.2l11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" />
                    <path d="m14.8 7.2 3 3" />
                  </svg>
                </button>
                <button type="button" aria-label="Delete project" (click)="deleteProject.emit(project)">
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                    <path d="M5 7h14" />
                    <path d="M9 7V5h6v2" />
                    <path d="M8 10v8" />
                    <path d="M12 10v8" />
                    <path d="M16 10v8" />
                    <path d="M7 7l1 14h8l1-14" />
                  </svg>
                </button>
              </div>
            </div>
          </section>

          <div class="sidebar-user-panel">
            <div class="sidebar-user-avatar" aria-hidden="true">
              <ion-icon name="person-outline"></ion-icon>
            </div>
            <div class="sidebar-user-copy">
              <strong>{{ userName }}</strong>
              <span>{{ role }}</span>
            </div>
            <button type="button" class="sidebar-logout" aria-label="Logout">
              <ion-icon name="log-out-outline"></ion-icon>
            </button>
          </div>
        </div>
      </ion-content>
    </ion-menu>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnterpriseSidebarComponent {
  private readonly data = inject(ErpDataService);

  @Input() active = "dashboard";
  @Input() clientId: string | null = null;
  @Input() projectId: string | null = null;
  @Input() userName = "Karthik";
  @Input() role = "Admin";
  @Output() newProject = new EventEmitter<void>();
  @Output() editProject = new EventEmitter<Project>();
  @Output() deleteProject = new EventEmitter<Project>();

  readonly logoPath = "assets/logo.png";

  get clientProjects(): Project[] {
    return this.data.projectsForClient(this.data.clientById(this.clientId));
  }

  get items(): SidebarItem[] {
    const settingsRoute = this.clientId && this.projectId ? ["/clients", this.clientId, "projects", this.projectId, "settings"] : ["/dashboard"];

    return [
      { key: "dashboard", label: "Dashboard", icon: "grid-outline", route: ["/dashboard"] },
      { key: "clients", label: "Clients", icon: "people-outline", route: ["/clients"] },
      { key: "settings", label: "Settings", icon: "settings-outline", route: settingsRoute },
    ];
  }
}
