import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  IonBadge,
  IonContent,
  IonIcon,
  IonProgressBar,
  IonSplitPane,
  IonText,
} from "@ionic/angular/standalone";
import { type Project } from "../../data/dashboardData";
import { ErpDataService } from "../data/erp-data.service";
import { ClientFormDialogComponent, type ClientFormValue } from "../shared/client-form-dialog.component";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { ProjectFormDialogComponent, type ProjectFormValue } from "../shared/project-form-dialog.component";
import { formatMoney, statusClass } from "../shared/format";

@Component({
  standalone: true,
  imports: [
    CommonModule,
    IonBadge,
    IonContent,
    IonIcon,
    IonProgressBar,
    IonSplitPane,
    IonText,
    EnterpriseHeaderComponent,
    EnterpriseSidebarComponent,
    ClientFormDialogComponent,
    ProjectFormDialogComponent,
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
          eyebrow="Project fallback"
          metaLabel="No-project state"
          [blurred]="showProjectForm() || editingClient()"
          [showTitle]="false"
          role="Admin"
        />

        <ion-content class="erp-page">
          <main class="workspace-shell client-project-shell" *ngIf="client() as currentClient">
            <section class="client-workspace-header">
              <div>
                <ion-text color="medium">{{ currentClient.id }}</ion-text>
                <h1>{{ currentClient.name }}</h1>
                <p>{{ currentClient.address }}  -  {{ currentClient.mobile }}</p>
              </div>
              <div class="client-header-metrics">
                <div><span>Project Value</span><strong>{{ formatMoney(summary().totalValue) }}</strong></div>
                <div><span>Received</span><strong>{{ formatMoney(summary().received) }}</strong></div>
                <div><span>Pending</span><strong class="warning">{{ formatMoney(summary().pending) }}</strong></div>
                <div><span>Supervisor</span><strong>{{ currentClient.supervisor }}</strong></div>
                <ion-badge class="status" [ngClass]="statusClass(currentClient.status)">{{ currentClient.status }}</ion-badge>
              </div>
            </section>

            <section class="module-panel project-management-panel">
              <div class="module-toolbar">
                <div>
                  <h2>Project Management</h2>
                  <p>Select a project to open its details, site status, activity, and settings.</p>
                </div>
                <div class="project-toolbar-icons" aria-label="Project actions">
                  <button type="button" class="project-tool-action primary" aria-label="Create new project" title="Create new project" (click)="openCreateProject()">
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                      <path d="M4 5.5h10" />
                      <path d="M4 11.5h7" />
                      <path d="M4 17.5h6" />
                      <path d="M17 10v8" />
                      <path d="M13 14h8" />
                    </svg>
                  </button>
                  <button type="button" class="project-tool-action" aria-label="Edit client" title="Edit client" (click)="editingClient.set(true)">
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                      <path d="M4 20h4.2l11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" />
                      <path d="m14.8 7.2 3 3" />
                    </svg>
                  </button>
                  <button type="button" class="project-tool-action" aria-label="Export projects" title="Export projects">
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                      <path d="M12 3v11" />
                      <path d="m8 10 4 4 4-4" />
                      <path d="M5 20h14" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="project-select-grid" *ngIf="projects().length; else noProjects">
                <article *ngFor="let project of projects()" class="project-select-card" role="button" tabindex="0" (click)="openProject(project)" (keydown.enter)="openProject(project)">
                  <div class="project-hover-actions" aria-label="Project actions">
                    <button type="button" aria-label="Edit project" (click)="openEditProject(project, $event)">
                      <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                        <path d="M4 20h4.2l11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" />
                        <path d="m14.8 7.2 3 3" />
                      </svg>
                    </button>
                    <button type="button" aria-label="Delete project" (click)="deleteProject(project, $event)">
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
                  <div class="project-select-card-head">
                    <div>
                      <ion-badge class="status" [ngClass]="statusClass(project.status)">{{ project.status }}</ion-badge>
                      <h3>{{ project.name }}</h3>
                      <p>{{ project.client }}</p>
                    </div>
                    <strong>{{ project.id }}</strong>
                  </div>
                  <div class="project-select-meta">
                    <span><ion-icon name="calendar-outline"></ion-icon>Started {{ project.startDate }}</span>
                    <span>{{ project.sites.length }} sites / areas</span>
                  </div>
                  <div class="project-select-ledger">
                    <div><span>Project Value</span><strong>{{ formatMoney(project.totalValue) }}</strong></div>
                    <div><span>Received</span><strong>{{ formatMoney(project.receivedAmount) }}</strong></div>
                    <div><span>Balance</span><strong>{{ formatMoney(project.totalValue - project.receivedAmount) }}</strong></div>
                    <div><span>Supervisor</span><strong>{{ project.supervisor }}</strong></div>
                  </div>
                  <ion-progress-bar [value]="project.completion / 100"></ion-progress-bar>
                  <div class="project-select-footer">
                    <span>{{ project.sites.join(', ') }}</span>
                    <strong>Open Project</strong>
                  </div>
                </article>
              </div>

              <ng-template #noProjects>
                <div class="project-empty-state">
                  <span class="empty-box-icon large" aria-hidden="true">
                    <svg viewBox="0 0 96 96">
                      <path class="box-fill" d="M17 36 48 18l31 18-31 18-31-18Z" />
                      <path class="box-fill" d="M17 36v34l31 18V54L17 36Z" />
                      <path class="box-fill" d="M79 36v34L48 88V54l31-18Z" />
                      <path d="M17 36 48 18l31 18-31 18-31-18Z" />
                      <path d="M17 36v34l31 18 31-18V36" />
                      <path d="M48 54v34" />
                      <path d="m30 26 31 18" />
                      <path d="m66 28-31 18" />
                    </svg>
                  </span>
                  <h2>No records found</h2>
                  <p>This client does not have any active projects.</p>
                </div>
              </ng-template>
            </section>

            <agb-project-form-dialog
              *ngIf="showProjectForm()"
              [clientName]="currentClient.name"
              [defaultSupervisor]="currentClient.supervisor"
              [initialValue]="editingProjectValue()"
              [eyebrow]="editingProject() ? 'Project Edit' : 'Project Setup'"
              [title]="editingProject() ? 'Edit Project' : 'Create New Project'"
              [submitLabel]="editingProject() ? 'Save Project' : 'Create Project'"
              (cancel)="showProjectForm.set(false)"
              (create)="saveProject($event)"
            ></agb-project-form-dialog>

            <agb-client-form-dialog
              *ngIf="editingClient()"
              eyebrow="Client Edit"
              title="Edit Client"
              description="Update client contact, address, and assigned supervisor information."
              submitLabel="Save Client"
              [initialValue]="clientEditValue()"
              (cancel)="editingClient.set(false)"
              (create)="saveClient($event)"
            ></agb-client-form-dialog>
          </main>
        </ion-content>
      </div>
    </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientWorkspacePage {
  readonly data = inject(ErpDataService);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly clientId = signal(this.route.snapshot.paramMap.get("clientId") ?? "");
  readonly showProjectForm = signal(false);
  readonly editingProject = signal<Project | null>(null);
  readonly editingClient = signal(false);
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;

  readonly client = computed(() => this.data.clientById(this.clientId()));
  readonly projects = computed(() => this.data.projectsForClient(this.client()));
  readonly summary = computed(() => {
    const currentClient = this.client();
    return currentClient
      ? this.data.clientSummary(currentClient)
      : { totalValue: 0, received: 0, pending: 0, materialCost: 0, labourCost: 0, siteExpense: 0, activeSites: 0, activeLabour: 0 };
  });

  constructor() {
    effect(() => {
      const project = this.projects()[0];
      if (project) {
        void this.router.navigate(["/clients", this.clientId(), "projects", project.id, "materials"], { replaceUrl: true });
      }
    });
  }

  openProject(project: Project) {
    void this.router.navigate(["/clients", this.clientId(), "projects", project.id]);
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

  editingProjectValue(): ProjectFormValue | null {
    const project = this.editingProject();
    if (!project) return null;
    return {
      name: project.name,
      sites: project.sites,
      startDate: project.startDate,
      supervisor: project.supervisor,
      totalValue: project.totalValue,
      advanceAmount: project.advanceAmount,
      status: project.status,
    };
  }

  saveProject(value: ProjectFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.startDate || !value.supervisor || !value.totalValue) return;
    const editing = this.editingProject();
    if (editing) {
      this.data.updateProject(editing.id, value);
      this.editingProject.set(null);
      this.showProjectForm.set(false);
      return;
    }
    const project = this.data.addProject(currentClient, value);
    this.showProjectForm.set(false);
    setTimeout(() => void this.router.navigate(["/clients", currentClient.id, "projects", project.id]));
  }

  deleteProject(project: Project, event?: Event) {
    event?.stopPropagation();
    const confirmed = window.confirm(`Delete ${project.name}? This removes the project from this client.`);
    if (!confirmed) return;
    this.data.deleteProject(project.id);
  }

  clientEditValue(): ClientFormValue | null {
    const currentClient = this.client();
    if (!currentClient) return null;
    return {
      name: currentClient.name,
      mobile: currentClient.mobile,
      address: currentClient.address,
      supervisor: currentClient.supervisor,
    };
  }

  saveClient(value: ClientFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.mobile || !value.address || !value.supervisor) return;
    this.data.updateClient(currentClient.id, value);
    this.editingClient.set(false);
  }
}
