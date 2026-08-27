import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  IonBadge,
  IonContent,
  IonIcon,
  IonProgressBar,
  IonSplitPane,
  ToastController,
} from "@ionic/angular/standalone";
import { type Project } from "../../data/dashboardData";
import { ErpDataService } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { ProjectFormDialogComponent, type ProjectFormValue } from "../shared/project-form-dialog.component";
import { formatMoney, statusClass } from "../shared/format";
import { DashboardSkeletonComponent } from "../shared/dashboard-skeleton.component";

@Component({
  standalone: true,
  imports: [
    CommonModule,
    IonBadge,
    IonContent,
    IonIcon,
    IonProgressBar,
    IonSplitPane,
    EnterpriseHeaderComponent,
    EnterpriseSidebarComponent,
    ProjectFormDialogComponent,
    DashboardSkeletonComponent,
  ],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar
        [clientId]="clientId()"
        active="projects"
        (newProject)="openCreateProject()"
        (editProject)="openEditProject($event)"
        (deleteProject)="deleteProject($event)"
      ></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Client Projects"
          eyebrow="Projects"
          metaLabel=""
          [blurred]="showProjectForm()"
          [showTitle]="false"
        />

        <ion-content class="erp-page">
          <main class="workspace-shell client-project-loading" *ngIf="!client()">
            <agb-dashboard-skeleton variant="card-grid" [cardCount]="4" ariaLabel="Loading client projects"></agb-dashboard-skeleton>
          </main>
          <main class="workspace-shell client-project-shell" *ngIf="client() as currentClient">
            <header class="project-management-heading">
              <h2>Project Management</h2>
              <p>Select a project to open its details, activity, and settings.</p>
            </header>
            <section class="module-panel project-management-panel">
              <div class="project-select-grid">
                <article class="project-select-card add-client-card add-project-card" role="button" tabindex="0" (click)="openCreateProject()" (keydown.enter)="openCreateProject()">
                  <div class="add-client-icon">
                    <ion-icon name="add-outline"></ion-icon>
                  </div>
                  <h3>Add Project</h3>
                  <p>Create a new project under {{ currentClient.name }}.</p>
                </article>

                <article *ngFor="let project of projects()" class="project-select-card" role="button" tabindex="0" (click)="openProject(project)" (keydown.enter)="openProject(project)">
                  <div class="project-hover-actions" aria-label="Project actions">
                    <button type="button" aria-label="Edit project" (click)="openEditProject(project, $event)">
                      <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                        <path d="M4 20h4.2l11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" />
                        <path d="m14.8 7.2 3 3" />
                      </svg>
                    </button>
                  </div>
                  <div class="project-select-card-head">
                    <div>
                      <ion-badge class="status" [ngClass]="statusClass(project.status)">{{ project.status }}</ion-badge>
                      <h3>{{ project.name }}</h3>
                      <p>{{ project.client }}</p>
                    </div>
                  </div>
                  <div class="project-select-meta">
                    <span><ion-icon name="calendar-outline"></ion-icon>Started {{ project.startDate }}</span>
                    <span class="project-activity-chip"><ion-icon name="time-outline"></ion-icon>{{ lastWorkedLabel(project) }}</span>
                  </div>
                  <div class="project-select-ledger">
                    <div><span>Project Value</span><strong>{{ formatMoney(project.totalValue) }}</strong></div>
                    <div><span>Received</span><strong>{{ formatMoney(projectReceivedAmount(project)) }}</strong></div>
                    <div><span>Balance</span><strong>{{ formatMoney(projectPendingAmount(project)) }}</strong></div>
                    <div><span>Supervisor</span><strong>{{ project.supervisor }}</strong></div>
                  </div>
                  <ion-progress-bar [value]="project.completion / 100"></ion-progress-bar>
                  <div class="project-select-footer">
                    <strong>Open Project</strong>
                  </div>
                </article>
              </div>
            </section>

            <agb-project-form-dialog
              *ngIf="showProjectForm()"
              [clientName]="currentClient.name"
              [lockClient]="!editingProject()"
              [defaultSupervisor]="currentClient.supervisor"
              [clients]="data.clients()"
              [currentClientId]="currentClient._id || currentClient.id"
              [initialValue]="editingProjectValue()"
              [eyebrow]="editingProject() ? 'Project Edit' : 'Project Setup'"
              [title]="editingProject() ? 'Edit Project' : 'Create New Project'"
              [submitLabel]="editingProject() ? 'Save Project' : 'Create Project'"
              [submitting]="projectSaving()"
              (cancel)="closeProjectForm()"
              (create)="saveProject($event)"
            ></agb-project-form-dialog>

          </main>
        </ion-content>
      </div>
    </ion-split-pane>
  `,
  styles: [`
    .project-management-heading {
      margin: 0 0 14px;
      padding: 0 2px;
    }

    .project-management-heading h2 {
      margin: 0;
      color: #101828;
      font-size: 20px;
      font-weight: 800;
    }

    .project-management-heading p {
      margin: 5px 0 0;
      color: #667085;
      font-size: 13px;
    }

    .project-management-panel {
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    .project-select-grid {
      align-items: stretch;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }

    .project-select-grid > .project-select-card {
      align-self: stretch;
      height: 100%;
    }

    .add-project-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      align-self: stretch;
      gap: 14px;
      min-height: 248px;
      box-sizing: border-box;
      padding: 24px;
      text-align: center;
    }

    .add-project-card .add-client-icon {
      flex: 0 0 44px;
      width: 44px;
      height: 44px;
      margin: 0;
    }

    .add-project-card h3,
    .add-project-card p {
      margin: 0;
    }

    .add-project-card p {
      width: min(100%, 280px);
    }

    @media (max-width: 760px) {
      .add-project-card {
        min-height: 210px;
        padding: 22px 18px;
      }
      .project-select-grid > .project-select-card {
        height: auto;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientWorkspacePage {
  readonly data = inject(ErpDataService);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  readonly paramMap = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly clientId = computed(() => this.paramMap().get("clientId") ?? "");
  readonly showProjectForm = signal(false);
  readonly editingProject = signal<Project | null>(null);
  readonly projectSaving = signal(false);
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;

  readonly client = computed(() => this.data.clientById(this.clientId()));
  readonly projects = computed(() => this.data.projectsForClient(this.client()));

  openProject(project: Project) {
    this.data.touchProject(project.id);
    void this.router.navigate(["/clients", this.clientId(), "projects", project.id]);
  }

  lastWorkedLabel(project: Project): string {
    return this.data.projectLastWorkedLabel(project.id);
  }

  openCreateProject() {
    this.editingProject.set(null);
    this.showProjectForm.set(true);
  }

  openEditProject(project: Project, event?: Event) {
    event?.stopPropagation();
    this.editingProject.set(project);
    this.showProjectForm.set(true);
  }

  closeProjectForm() {
    this.showProjectForm.set(false);
    this.editingProject.set(null);
  }

  editingProjectValue(): ProjectFormValue | null {
    const project = this.editingProject();
    if (!project) return null;
    return {
      name: project.name,
      sites: project.sites,
      startDate: project.startDate,
      supervisor: project.supervisor,
      totalValue: project.totalValue,
      status: project.status,
      clientId: this.client()?._id || this.client()?.id,
    };
  }

  projectReceivedAmount(project: Project): number {
    return this.data.projectReceivedAmount(project);
  }

  projectPendingAmount(project: Project): number {
    return this.data.projectPendingAmount(project);
  }

  async saveProject(value: ProjectFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.startDate || !value.supervisor || !value.totalValue) return;
    if (this.projectSaving()) return; // guard against double-submit
    const editing = this.editingProject();
    this.projectSaving.set(true);
    try {
      if (editing) {
        const updated = this.data.updateProject(editing.id, { ...value });
        // Persist supervisor/site changes to the backend so the supervisor mobile
        // app receives the updated site assignments.
        await this.data.persistProjectEdit(editing.id, {
          clientId: value.clientId,
          name: value.name,
          sites: value.sites,
          startDate: value.startDate,
          supervisor: value.supervisor,
          supervisorId: value.supervisorId,
          status: value.status,
          totalValue: value.totalValue,
        });
        this.editingProject.set(null);
        this.showProjectForm.set(false);
        await this.presentToast(`Project "${value.name}" updated.`);
        const targetClient = value.clientId
          ? this.data.clients().find((client) => client._id === value.clientId || client.id === value.clientId)
          : undefined;
        if (targetClient && targetClient.id !== currentClient.id) {
          void this.router.navigate(["/clients", targetClient.id, "projects", editing.id]);
          return;
        }
        if (updated && editing.id === currentClient.id) {
          // Refresh current project context if needed
        }
        return;
      }
      try {
        const project = await this.data.addProject(currentClient, { ...value });
        this.showProjectForm.set(false);
        await this.presentToast(`Project "${value.name}" created.`);
        // The projects signal is already updated inside addProject() before
        // the await resolves, so the workspace signal `project = computed(() =>
        // data.projectById(this.projectId()))` will find the new project on its
        // next evaluation. Wrapping the navigate in a microtask defers past
        // the toast's pending UI state and any pending change-detection cycle
        // without the indeterminate timing of setTimeout(0).
        await Promise.resolve();
        await this.router.navigate(["/clients", currentClient.id, "projects", project.id]);
      } catch (err) {
        console.error("[ClientWorkspace] Failed to create project:", (err as any)?.message ?? err);
        await this.presentToast(
          (err as any)?.message || "Could not create the project. Please try again.",
          "danger",
        );
        // Keep the dialog open so the user can correct and retry.
      }
    } finally {
      this.projectSaving.set(false);
    }
  }

  private async presentToast(message: string, color: "success" | "warning" | "danger" = "success") {
    try {
      const toast = await this.toastController.create({
        message,
        duration: color === "danger" ? 4000 : 2500,
        color,
        position: "top",
      });
      await toast.present();
    } catch (err) {
      console.warn("[ClientWorkspace] Failed to present toast:", err);
    }
  }

  deleteProject(project: Project, event?: Event) {
    event?.stopPropagation();
    const confirmed = window.confirm(`Delete ${project.name}? This removes the project from this client.`);
    if (!confirmed) return;
    this.data.deleteProject(project.id);
  }

}
