import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonMenu } from "@ionic/angular/standalone";
import { ErpDataService } from "../data/erp-data.service";
import { ApiService } from "../core/api.service";
import type { Project, ProjectStatus } from "../../data/dashboardData";

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

          <section class="sidebar-project-list" *ngIf="sidebarProjects.length">
            <div class="sidebar-section-head">
              <span>Projects</span>
              <button *ngIf="clientId" type="button" class="project-create-icon" aria-label="Create new project" (click)="newProject.emit()">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                  <path d="M4 5.5h9.5" />
                  <path d="M4 11.5h7" />
                  <path d="M4 17.5h5.5" />
                  <path d="M16.5 10v7" />
                  <path d="M13 13.5h7" />
                </svg>
              </button>
            </div>
            <div class="sidebar-project-scroll">
              <div *ngFor="let project of filteredSidebarProjects" class="sidebar-project-row" [class.active]="project.id === projectId">
                <a [routerLink]="['/clients', projectClientId(project), 'projects', project.id, 'materials']">
                  <span>{{ project.name }}</span>
                  <small>
                    <em>
                      <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                        <path d="M12 7v5l3 2" />
                        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      {{ projectActivityLabel(project) }}
                    </em>
                  </small>
                </a>
                <div class="sidebar-project-actions">
                  <button type="button" aria-label="Edit project" (click)="requestEditProject(project, $event)">
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                      <path d="M4 20h4.2l11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" />
                      <path d="m14.8 7.2 3 3" />
                    </svg>
                  </button>
                  <button type="button" aria-label="Delete project" (click)="requestDeleteProject(project, $event)">
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
            </div>
            <a class="sidebar-view-all-projects" [routerLink]="['/projects']">
              <span>View all projects</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </a>
          </section>

          <div class="sidebar-footer-actions">
            <button type="button" class="sidebar-logout-minimal" aria-label="Sign out" (click)="logout()">
              <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Sign out</span>
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
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  @Input() active = "dashboard";
  @Input() clientId: string | null = null;
  @Input() projectId: string | null = null;
  @Output() newProject = new EventEmitter<void>();
  @Output() editProject = new EventEmitter<Project>();
  @Output() deleteProject = new EventEmitter<Project>();

  readonly logoPath = "assets/logo.png";

  get clientProjects(): Project[] {
    return this.data.projectsForClient(this.data.clientById(this.clientId));
  }

  get sidebarProjects(): Project[] {
    if (this.clientId) return this.clientProjects;
    return this.data.sortProjectsByLastWorked(this.data.projects());
  }

  get filteredSidebarProjects(): Project[] {
    if (this.clientId) return this.sidebarProjects;
    // Show all projects (no status filter) so the user can see more
    return this.sidebarProjects;
  }

  projectClientId(project: Project): string {
    return this.data.clients().find((client) => client.projectIds.includes(project.id) || client.name === project.client)?.id ?? this.clientId ?? "";
  }

  projectActivityLabel(project: Project): string {
    return this.data.projectLastWorkedLabel(project.id);
  }

  requestEditProject(project: Project, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.hasOutputObservers(this.editProject)) {
      this.editProject.emit(project);
      return;
    }
    const clientId = this.projectClientId(project);
    if (!clientId) return;
    void this.router.navigate(["/clients", clientId, "projects", project.id, "materials"], { queryParams: { editProject: "1" } });
  }

  requestDeleteProject(project: Project, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.hasOutputObservers(this.deleteProject)) {
      this.deleteProject.emit(project);
      return;
    }
    const confirmed = window.confirm(`Delete ${project.name}? This removes the project and its linked records.`);
    if (!confirmed) return;
    const deletingCurrent = project.id === this.projectId;
    this.data.deleteProject(project.id);
    if (deletingCurrent) void this.router.navigate(["/projects"]);
  }

  get items(): SidebarItem[] {
    return [
      { key: "dashboard", label: "Dashboard", icon: "grid-outline", route: ["/dashboard"] },
      { key: "clients", label: "Clients", icon: "people-outline", route: ["/clients"] },
      { key: "projects", label: "Project list", icon: "folder-open-outline", route: ["/projects"] },
      { key: "approvals", label: "Pending Approvals", icon: "checkmark-done-outline", route: ["/approvals"] },
      { key: "settings", label: "Settings", icon: "settings-outline", route: ["/settings"] },
    ];
  }

  logout() {
    this.api.logout().subscribe({
      next: () => {
        try {
          localStorage.setItem("agb-erp:session", "logged-out");
        } catch {}
        void this.router.navigate(["/login"]);
      },
      error: () => {
        try {
          localStorage.setItem("agb-erp:session", "logged-out");
        } catch {}
        void this.router.navigate(["/login"]);
      },
    });
  }

  private hasOutputObservers<T>(emitter: EventEmitter<T>): boolean {
    const inspectedEmitter = emitter as EventEmitter<T> & { observed?: boolean; observers?: unknown[] };
    return Boolean(inspectedEmitter.observed || inspectedEmitter.observers?.length);
  }
}
