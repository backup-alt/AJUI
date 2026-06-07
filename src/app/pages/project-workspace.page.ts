import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { IonBadge, IonContent, IonProgressBar, IonSplitPane, IonText } from "@ionic/angular/standalone";
import { ErpDataService } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, statusClass } from "../shared/format";
import { ProjectFormDialogComponent, type ProjectFormValue } from "../shared/project-form-dialog.component";

type ProjectTab = "overview" | "sites" | "activity" | "settings";

@Component({
  standalone: true,
  imports: [
    CommonModule,
    IonBadge,
    IonContent,
    IonProgressBar,
    IonSplitPane,
    IonText,
    EnterpriseHeaderComponent,
    EnterpriseSidebarComponent,
    ProjectFormDialogComponent,
  ],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar [clientId]="clientId()" [projectId]="projectId()" active="projects" (newProject)="showProjectForm.set(true)"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header [showTitle]="false" role="Admin" searchPlaceholder="Search project notes..." />

        <ion-content class="erp-page">
          <main class="workspace-shell" *ngIf="project() as currentProject">
            <nav class="workspace-breadcrumb" aria-label="Breadcrumb">
              <button type="button" (click)="backToClients()">Clients</button>
              <span>/</span>
              <button type="button" (click)="backToProjects()">{{ currentProject.client }}</button>
              <span>/</span>
              <strong>{{ currentProject.name }}</strong>
            </nav>

            <section class="project-hero">
              <div class="project-hero-main">
                <ion-text color="medium">{{ currentProject.id }}</ion-text>
                <h1>{{ currentProject.name }}</h1>
                <p>{{ currentProject.client }}  -  {{ currentProject.address }}</p>
                <div class="project-hero-meta">
                  <span>Supervisor: {{ currentProject.supervisor }}</span>
                  <span>Started {{ currentProject.startDate }}</span>
                  <span>{{ currentProject.sites.length }} sites</span>
                </div>
              </div>

              <div class="project-hero-panel">
                <div>
                  <span>Project Progress</span>
                  <strong>{{ currentProject.completion }}%</strong>
                </div>
                <ion-progress-bar [value]="currentProject.completion / 100"></ion-progress-bar>
                <ion-badge class="status" [ngClass]="statusClass(currentProject.status)">{{ currentProject.status }}</ion-badge>
              </div>
            </section>

            <section class="project-tabbar" role="tablist" aria-label="Project detail navigation">
              <button
                *ngFor="let tab of tabs"
                type="button"
                role="tab"
                [class.active]="activeTab() === tab.key"
                [attr.aria-selected]="activeTab() === tab.key"
                (click)="activeTab.set(tab.key)"
              >
                {{ tab.label }}
              </button>
            </section>

            <section class="project-detail-content" [ngSwitch]="activeTab()">
              <ng-container *ngSwitchCase="'overview'">
                <div class="project-summary-grid">
                  <article class="detail-card primary">
                    <span>Project Value</span>
                    <strong>{{ formatMoney(currentProject.totalValue) }}</strong>
                    <p>Approved contract value for this project.</p>
                  </article>
                  <article class="detail-card">
                    <span>Received</span>
                    <strong>{{ formatMoney(currentProject.receivedAmount) }}</strong>
                    <p>{{ receiptRatio() }}% collected from client.</p>
                  </article>
                  <article class="detail-card">
                    <span>Pending</span>
                    <strong>{{ formatMoney(pendingReceivable()) }}</strong>
                    <p>Balance receivable against the agreed value.</p>
                  </article>
                  <article class="detail-card">
                    <span>Advance</span>
                    <strong>{{ formatMoney(currentProject.advanceAmount) }}</strong>
                    <p>Initial amount recorded at project creation.</p>
                  </article>
                </div>

                <div class="project-overview-layout">
                  <article class="project-profile-panel">
                    <div class="panel-title-row">
                      <h2>Project Details</h2>
                      <ion-badge class="neutral">{{ currentProject.status }}</ion-badge>
                    </div>
                    <dl class="project-definition-list">
                      <div><dt>Client</dt><dd>{{ currentProject.client }}</dd></div>
                      <div><dt>Mobile</dt><dd>{{ currentProject.mobile }}</dd></div>
                      <div><dt>Address</dt><dd>{{ currentProject.address }}</dd></div>
                      <div><dt>Supervisor</dt><dd>{{ currentProject.supervisor }}</dd></div>
                      <div><dt>Start Date</dt><dd>{{ currentProject.startDate }}</dd></div>
                      <div><dt>Project ID</dt><dd>{{ currentProject.id }}</dd></div>
                    </dl>
                  </article>

                  <aside class="project-side-panel">
                    <h2>Current Focus</h2>
                    <p>The workspace is scoped to this project only. Use the tabs above to review details without opening unrelated modules.</p>
                    <div class="focus-list">
                      <span *ngFor="let site of currentProject.sites">{{ site }}</span>
                    </div>
                  </aside>
                </div>
              </ng-container>

              <ng-container *ngSwitchCase="'sites'">
                <div class="site-card-grid">
                  <article *ngFor="let site of siteCards(); let index = index" class="site-card">
                    <div>
                      <span>Site {{ index + 1 }}</span>
                      <h2>{{ site.name }}</h2>
                      <p>{{ site.phase }}</p>
                    </div>
                    <strong>{{ site.progress }}%</strong>
                    <ion-progress-bar [value]="site.progress / 100"></ion-progress-bar>
                    <div class="site-card-footer">
                      <span>{{ site.owner }}</span>
                      <ion-badge class="neutral">{{ site.status }}</ion-badge>
                    </div>
                  </article>
                </div>
              </ng-container>

              <ng-container *ngSwitchCase="'activity'">
                <article class="activity-panel">
                  <div class="panel-title-row">
                    <h2>Recent Activity</h2>
                    <span>{{ activityItems().length }} updates</span>
                  </div>
                  <div class="activity-list">
                    <div *ngFor="let item of activityItems()" class="activity-item">
                      <span class="activity-dot"></span>
                      <div>
                        <strong>{{ item.title }}</strong>
                        <p>{{ item.detail }}</p>
                        <small>{{ item.time }}</small>
                      </div>
                    </div>
                  </div>
                </article>
              </ng-container>

              <ng-container *ngSwitchCase="'settings'">
                <article class="project-settings-panel">
                  <div class="panel-title-row">
                    <h2>Project Settings</h2>
                    <button type="button" class="secondary-action">Edit</button>
                  </div>
                  <div class="settings-grid">
                    <label>
                      <span>Project Name</span>
                      <input [value]="currentProject.name" readonly />
                    </label>
                    <label>
                      <span>Assigned Supervisor</span>
                      <input [value]="currentProject.supervisor" readonly />
                    </label>
                    <label>
                      <span>Status</span>
                      <input [value]="currentProject.status" readonly />
                    </label>
                    <label>
                      <span>Default View</span>
                      <input value="Overview" readonly />
                    </label>
                  </div>
                </article>
              </ng-container>
            </section>

            <agb-project-form-dialog
              *ngIf="showProjectForm() && client() as currentClient"
              [clientName]="currentClient.name"
              [defaultSupervisor]="currentClient.supervisor"
              (cancel)="showProjectForm.set(false)"
              (create)="createProject($event)"
            ></agb-project-form-dialog>
          </main>
        </ion-content>
      </div>
    </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectWorkspacePage {
  readonly data = inject(ErpDataService);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly paramMap = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;
  readonly showProjectForm = signal(false);
  readonly activeTab = signal<ProjectTab>("overview");

  readonly tabs: { key: ProjectTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "sites", label: "Sites" },
    { key: "activity", label: "Activity" },
    { key: "settings", label: "Settings" },
  ];

  readonly clientId = computed(() => this.paramMap().get("clientId") ?? "");
  readonly projectId = computed(() => this.paramMap().get("projectId") ?? "");
  readonly client = computed(() => this.data.clientById(this.clientId()));
  readonly project = computed(() => this.data.projectById(this.projectId()));

  pendingReceivable() {
    const project = this.project();
    return project ? project.totalValue - project.receivedAmount : 0;
  }

  receiptRatio() {
    const project = this.project();
    if (!project?.totalValue) return 0;
    return Math.round((project.receivedAmount / project.totalValue) * 100);
  }

  siteCards() {
    const project = this.project();
    if (!project) return [];
    const phases = ["Foundation and structure", "Civil work in progress", "Finishing preparation", "Final inspection"];
    return project.sites.map((site, index) => ({
      name: site,
      phase: phases[index % phases.length],
      owner: project.supervisor,
      progress: Math.max(18, Math.min(96, project.completion + index * 7 - 8)),
      status: project.status === "Completed" ? "Closed" : index === 0 ? "In Progress" : "Queued",
    }));
  }

  activityItems() {
    const project = this.project();
    if (!project) return [];
    return [
      {
        title: "Project workspace reviewed",
        detail: `${project.name} was opened for project-level planning and follow-up.`,
        time: "Today",
      },
      {
        title: "Supervisor assignment confirmed",
        detail: `${project.supervisor} is responsible for site updates and coordination.`,
        time: "Yesterday",
      },
      {
        title: "Client balance checked",
        detail: `${this.formatMoney(this.pendingReceivable())} remains pending against the project value.`,
        time: "This week",
      },
    ];
  }

  backToClients() {
    void this.router.navigate(["/clients"]);
  }

  backToProjects() {
    void this.router.navigate(["/clients", this.clientId()]);
  }

  createProject(value: ProjectFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.startDate || !value.supervisor || !value.totalValue) return;
    const project = this.data.addProject(currentClient, value);
    this.showProjectForm.set(false);
    setTimeout(() => void this.router.navigate(["/clients", currentClient.id, "projects", project.id]));
  }
}
