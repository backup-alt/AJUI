import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from "@angular/core";
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
            <div class="sidebar-project-filters" aria-label="Project status filters" *ngIf="!clientId">
              <button
                *ngFor="let status of projectStatusFilters"
                type="button"
                [class.active]="projectStatusFilter() === status"
                (click)="projectStatusFilter.set(status)"
              >
                {{ status === 'On Hold' ? 'On-Hold' : status }}
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

          <div class="sidebar-user-panel">
            <button type="button" class="sidebar-profile-trigger" (click)="toggleProfileMenu()" [class.active]="profileMenuOpen()">
              <div class="sidebar-user-avatar" [style.background]="avatarColor" aria-hidden="true">
                <span class="avatar-initial">{{ userInitial }}</span>
                <span class="avatar-status" [class.inactive]="currentUser()?.status !== 'active'"></span>
              </div>
              <div class="sidebar-user-copy">
                <strong class="user-name">{{ userName }}</strong>
                <span class="user-email">{{ currentUser()?.email || '' }}</span>
              </div>
              <svg class="sidebar-profile-chevron" [class.rotated]="profileMenuOpen()" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            <div class="sidebar-profile-menu" *ngIf="profileMenuOpen()">
              <div class="profile-menu-header">
                <div class="profile-menu-role-badge">{{ role }}</div>
                <div class="profile-menu-status" [class.active]="currentUser()?.status === 'active'">
                  <span class="status-dot"></span>
                  {{ currentUser()?.status === 'active' ? 'Active' : 'Inactive' }}
                </div>
              </div>
              <a class="profile-menu-item" [routerLink]="['/settings']" (click)="closeProfileMenu()">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="menu-icon">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                <span>Settings</span>
              </a>
              <button type="button" class="profile-menu-item profile-menu-logout" (click)="logout()">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="menu-icon">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Sign out</span>
              </button>
            </div>
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

  // Live user from auth service (reactive)
  readonly currentUser = this.api.user;

  get userName(): string {
    return this.currentUser()?.name || "User";
  }

  get role(): string {
    return this.formatRole(this.currentUser()?.role || "admin");
  }

  private formatRole(role: string): string {
    const map: Record<string, string> = {
      admin: "Administrator",
      accountant: "Accountant",
      project_manager: "Project Manager",
      supervisor: "Supervisor",
    };
    return map[role] || role;
  }

  readonly logoPath = "assets/logo.png";
  readonly projectStatusFilters: ProjectStatus[] = ["Active", "On Hold", "Completed"];
  readonly projectStatusFilter = signal<ProjectStatus>("Active");

  // Profile dropdown menu state
  readonly profileMenuOpen = signal(false);

  toggleProfileMenu() {
    this.profileMenuOpen.update((v) => !v);
  }

  closeProfileMenu() {
    this.profileMenuOpen.set(false);
  }

  get clientProjects(): Project[] {
    return this.data.projectsForClient(this.data.clientById(this.clientId));
  }

  get sidebarProjects(): Project[] {
    if (this.clientId) return this.clientProjects;
    return this.data.sortProjectsByLastWorked(this.data.projects());
  }

  get filteredSidebarProjects(): Project[] {
    if (this.clientId) return this.sidebarProjects;
    const status = this.projectStatusFilter();
    return this.sidebarProjects.filter((project) => project.status === status);
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

  get userInitial(): string {
    return (this.userName || "A").trim().charAt(0).toUpperCase() || "A";
  }

  get avatarColor(): string {
    const colors = [
      "linear-gradient(135deg, #002263, #1a4499)",
      "linear-gradient(135deg, #1a5c2e, #2d8a4e)",
      "linear-gradient(135deg, #7a3d00, #b86310)",
      "linear-gradient(135deg, #5c1a5c, #8a2d8a)",
      "linear-gradient(135deg, #1a3d5c, #2d608a)",
      "linear-gradient(135deg, #5c1a1a, #8a2d2d)",
    ];
    const name = this.userName || "A";
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
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
