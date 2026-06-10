import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  IonBadge,
  IonContent,
  IonIcon,
  IonProgressBar,
  IonSplitPane,
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
          eyebrow="Projects"
          metaLabel=""
          [blurred]="showProjectForm() || editingClient()"
          [showTitle]="false"
          role="Admin"
        />

        <ion-content class="erp-page">
          <main class="workspace-shell client-project-shell" *ngIf="client() as currentClient">
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
                    <span class="project-activity-chip"><ion-icon name="time-outline"></ion-icon>{{ lastWorkedLabel(project) }}</span>
                    <span>{{ project.sites.length }} sites / areas</span>
                  </div>
                  <div class="project-select-ledger">
                    <div><span>Project Value</span><strong>{{ formatMoney(project.totalValue) }}</strong></div>
                    <div><span>Received</span><strong>{{ formatMoney(projectReceivedAmount(project)) }}</strong></div>
                    <div><span>Balance</span><strong>{{ formatMoney(projectPendingAmount(project)) }}</strong></div>
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
                <div class="project-empty-state icon-only" aria-label="No records found">
                  <span class="empty-box-icon large" aria-hidden="true">
                    <svg viewBox="0 0 96 96" aria-hidden="true">
                      <path class="empty-box-fill" d="M22 50 30 28h36l8 22v22a7 7 0 0 1-7 7H29a7 7 0 0 1-7-7V50Z" />
                      <path class="empty-box-line" d="M30 28h36l8 22H60l-5 8H41l-5-8H22l8-22Z" />
                      <path class="empty-box-line" d="M22 50v22a7 7 0 0 0 7 7h38a7 7 0 0 0 7-7V50" />
                      <path class="empty-box-line" d="M36 40h24" />
                      <path class="empty-box-line" d="M40 68h16" />
                    </svg>
                  </span>
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
              (cancel)="closeProjectForm()"
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
export class ClientWorkspacePage implements OnInit {
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

  ngOnInit() {
    const currentClient = this.client();
    if (!currentClient) return;
    const project = this.data.firstProjectForClient(currentClient) ?? this.data.createDefaultProject(currentClient);
    this.data.touchProject(project.id);
    void this.router.navigate(["/clients", currentClient.id, "projects", project.id, "materials"], { replaceUrl: true });
  }

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
      advanceAmount: project.advanceAmount,
      receivedAmount: project.receivedAmount,
      openingBalance: project.expenseBalance,
      status: project.status,
    };
  }

  projectReceivedAmount(project: Project): number {
    return this.data.projectReceivedAmount(project);
  }

  projectPendingAmount(project: Project): number {
    return this.data.projectPendingAmount(project);
  }

  saveProject(value: ProjectFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.startDate || !value.supervisor || !value.totalValue) return;
    const { openingBalance, ...projectValue } = value;
    const editing = this.editingProject();
    if (editing) {
      const updated = this.data.updateProject(editing.id, { ...projectValue, expenseBalance: openingBalance });
      this.data.setExpenseOpeningBalance(editing.id, updated?.sites[0] ?? editing.sites[0] ?? "Main Site", openingBalance);
      this.editingProject.set(null);
      this.showProjectForm.set(false);
      return;
    }
    const project = this.data.addProject(currentClient, { ...projectValue, openingBalance });
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
