import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { IonBadge, IonContent, IonIcon, IonSpinner, IonSplitPane } from "@ionic/angular/standalone";
import { ApiService } from "../core/api.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, statusClass } from "../shared/format";

interface ApiProject {
  _id: string;
  projectId: string;
  name: string;
  client: string;
  address: string;
  supervisor: string;
  siteNames: string[];
  status: "Active" | "On Hold" | "Completed";
  startDate: string;
  totalValue: number;
  receivedAmount: number;
  pendingBalance: number;
  lastActivityAt: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonBadge, IonSpinner, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="projects"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Project list"
          eyebrow="Projects"
          metaLabel=""
          [showTitle]="false"
          searchPlaceholder="Search"
        />

        <ion-content class="erp-page">
          <main class="projects-directory-shell">
            <section class="projects-directory-head">
              <div>
                <span>Project list</span>
                <h1>All Projects</h1>
                <p>Sorted by the most recently worked-on project.</p>
              </div>
              <label class="projects-directory-search">
                <ion-icon name="search-outline"></ion-icon>
                <input [value]="searchQuery()" (input)="searchQuery.set($any($event.target).value)" placeholder="Search project, client, supervisor, site..." />
              </label>
            </section>

            <section *ngIf="loading()" class="projects-loading">
              <ion-spinner></ion-spinner>
              <p>Loading projects...</p>
            </section>

            <section *ngIf="!loading() && filteredProjects().length === 0" class="projects-empty">
              <ion-icon name="folder-open-outline"></ion-icon>
              <p>No projects found</p>
            </section>

            <section class="projects-directory-list">
              <article class="projects-directory-card add-client-card" role="button" tabindex="0" (click)="openProjectForm()" (keydown.enter)="openProjectForm()">
                <div class="add-client-icon">
                  <ion-icon name="add-outline"></ion-icon>
                </div>
                <h3>Add Project</h3>
                <p>Create a project independently and link it to a client.</p>
              </article>

              <article *ngFor="let project of filteredProjects(); trackBy: trackProject" class="projects-directory-card" role="button" tabindex="0" (click)="openProject(project)" (keydown.enter)="openProject(project)">
                <div class="projects-directory-title">
                  <div class="title-stack">
                    <ion-badge class="status" [ngClass]="statusClass(project.status)">{{ project.status }}</ion-badge>
                    <h2>{{ project.name }}</h2>
                    <p>{{ project.client }} - {{ project.address }}</p>
                  </div>
                </div>

                <div class="projects-directory-meta">
                  <span><ion-icon name="time-outline"></ion-icon>{{ lastWorkedLabel(project) }}</span>
                  <span><ion-icon name="calendar-outline"></ion-icon>{{ project.startDate }}</span>
                  <span>{{ project.siteNames.length }} sites</span>
                </div>

                <div class="projects-directory-ledger">
                  <div><span>Estimated Value</span><strong>{{ formatMoney(project.totalValue) }}</strong></div>
                  <div><span>Received</span><strong>{{ formatMoney(project.receivedAmount) }}</strong></div>
                  <div><span>Pending</span><strong>{{ formatMoney(project.pendingBalance) }}</strong></div>
                  <div><span>Supervisor</span><strong>{{ project.supervisor }}</strong></div>
                </div>

                <div class="projects-directory-footer">
                  <span>{{ project.siteNames.join(", ") }}</span>
                  <button type="button" (click)="openProject(project); $event.stopPropagation()">
                    Open Project
                    <ion-icon name="arrow-forward-outline"></ion-icon>
                  </button>
                </div>
              </article>
            </section>
          </main>
        </ion-content>

        <section class="form-overlay" *ngIf="showProjectForm()">
          <form class="erp-dialog" (submit)="$event.preventDefault(); createProject()">
            <div class="dialog-head">
              <div>
                <span>Project Setup</span>
                <h2>Add Project</h2>
                <p>Create a project independently from the project list.</p>
              </div>
              <button type="button" class="icon-button" aria-label="Close project form" (click)="closeProjectForm()">
                <ion-icon name="close-outline"></ion-icon>
              </button>
            </div>
            <div class="erp-form">
              <label>
                <span>Client</span>
                <select required [(ngModel)]="projectDraft.clientId" name="clientId">
                  <option value="">Select client</option>
                  <option *ngFor="let client of clients()" [value]="client._id || client.clientId">{{ client.name }}</option>
                </select>
              </label>
              <label>
                <span>Project Name</span>
                <input required [(ngModel)]="projectDraft.name" name="name" placeholder="Project name" />
              </label>
              <label>
                <span>Start Date</span>
                <input required type="date" [(ngModel)]="projectDraft.startDate" name="startDate" />
              </label>
              <label>
                <span>Supervisor</span>
                <select required [(ngModel)]="projectDraft.supervisorId" name="supervisorId" (ngModelChange)="selectSupervisor($event)">
                  <option value="">Select supervisor</option>
                  <option *ngFor="let supervisor of supervisors()" [value]="supervisor._id || supervisor.id">{{ supervisor.name }}</option>
                </select>
              </label>
              <label>
                <span>Status</span>
                <select [(ngModel)]="projectDraft.status" name="status">
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </label>
              <label>
                <span>Estimated Project Value</span>
                <input required type="number" min="0" step="1" [(ngModel)]="projectDraft.totalValue" name="totalValue" />
              </label>
            </div>
            <div class="dialog-actions">
              <button type="button" class="secondary-action" (click)="closeProjectForm()">Cancel</button>
              <button type="submit" class="primary-action">Create Project</button>
            </div>
          </form>
        </section>
      </div>
    </ion-split-pane>
  `,
  styles: [`
    .projects-directory-card.add-client-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 312px;
      padding: 28px;
      border: 1px dashed #c9b46d;
      background: #fffdf6;
      text-align: center;
    }
    .projects-directory-card.add-client-card:hover {
      border-color: var(--gold-dark);
      background: #fff9e6;
    }
    .projects-directory-card.add-client-card h3 {
      margin: 0;
      color: #0f172a;
      font-size: 22px;
      line-height: 1.25;
    }
    .projects-directory-card.add-client-card p {
      max-width: 260px;
      margin: 10px 0 0;
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsDirectoryPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;

  readonly searchQuery = signal("");
  readonly projects = signal<ApiProject[]>([]);
  readonly clients = signal<any[]>([]);
  readonly supervisors = signal<any[]>([]);
  readonly loading = signal(true);
  readonly showProjectForm = signal(false);
  projectDraft = this.emptyProjectDraft();

  private readonly allProjects = computed(() => this.projects());

  readonly filteredProjects = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.allProjects();
    if (!query) return list;
    return list.filter((project) =>
      [project.projectId, project.name, project.client, project.address, project.supervisor, project.status, ...project.siteNames]
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  });

  ngOnInit() {
    this.loadProjects();
    this.loadClients();
    this.loadSupervisors();
  }

  private loadProjects() {
    this.loading.set(true);
    this.api.listProjects({ limit: 25, page: 1 }).subscribe({
      next: (res) => {
        this.projects.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadClients() {
    this.api.listClients({ limit: 200, page: 1 }).subscribe({
      next: (res) => this.clients.set(res.items || []),
      error: () => this.clients.set([]),
    });
  }

  private loadSupervisors() {
    this.api.listEmployees({ limit: 100, role: "supervisor" }).subscribe({
      next: (response) => this.supervisors.set((response.items || []).filter((item: any) => String(item.role || "").toLowerCase() === "supervisor")),
      error: () => this.supervisors.set([]),
    });
  }

  selectSupervisor(supervisorId: string) {
    const supervisor = this.supervisors().find((item) => String(item._id || item.id) === supervisorId);
    this.projectDraft.supervisor = supervisor?.name || "";
  }

  openProjectForm() {
    this.projectDraft = this.emptyProjectDraft();
    this.showProjectForm.set(true);
  }

  closeProjectForm() {
    this.showProjectForm.set(false);
  }

  createProject() {
    if (!this.projectDraft.clientId || !this.projectDraft.name || !this.projectDraft.startDate || !this.projectDraft.supervisor) return;
    this.api.createProject({
      clientId: this.projectDraft.clientId,
      name: this.projectDraft.name,
      startDate: this.projectDraft.startDate,
      supervisor: this.projectDraft.supervisor,
      supervisorId: this.projectDraft.supervisorId,
      status: this.projectDraft.status,
      totalValue: Number(this.projectDraft.totalValue) || 0,
      siteIds: [],
      sites: [],
    }).subscribe({
      next: () => {
        this.closeProjectForm();
        this.loadProjects();
      },
      error: () => {},
    });
  }

  private emptyProjectDraft() {
    return {
      clientId: "",
      name: "",
      startDate: new Date().toISOString().slice(0, 10),
      supervisor: "",
      supervisorId: "",
      status: "Active" as ApiProject["status"],
      totalValue: 0,
    };
  }

  trackProject(_: number, project: ApiProject): string {
    return project._id;
  }

  lastWorkedLabel(project: ApiProject): string {
    if (!project.lastActivityAt) return "No activity";
    const date = new Date(project.lastActivityAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  openProject(project: ApiProject) {
    this.api.listClients({ search: project.client, limit: 1 }).subscribe({
      next: (res) => {
        const client = res.items.find((c) => c.name === project.client);
        if (client) {
          void this.router.navigate(["/clients", client.clientId || client._id, "projects", project._id, "materials"]);
        }
      },
      error: () => {},
    });
  }
}
