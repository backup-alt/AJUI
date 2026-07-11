import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from "@angular/core";
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
  imports: [CommonModule, IonContent, IonIcon, IonBadge, IonSpinner, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent],
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
      </div>
    </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsDirectoryPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;

  readonly searchQuery = signal("");
  readonly projects = signal<ApiProject[]>([]);
  readonly loading = signal(true);

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
  }

  private loadProjects() {
    this.loading.set(true);
    this.api.listProjects({ limit: 100 }).subscribe({
      next: (res) => {
        this.projects.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
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
          void this.router.navigate(["/clients", client._id, "projects", project._id, "materials"]);
        }
      },
      error: () => {},
    });
  }
}