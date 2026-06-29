import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { IonBadge, IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import type { Project } from "../../data/dashboardData";
import { ErpDataService } from "../data/erp-data.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, statusClass } from "../shared/format";

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonBadge, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent],
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
                <input [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Search project, client, supervisor, site..." />
              </label>
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
                  <span><ion-icon name="time-outline"></ion-icon>{{ data.projectLastWorkedLabel(project.id) }}</span>
                  <span><ion-icon name="calendar-outline"></ion-icon>{{ project.startDate }}</span>
                  <span>{{ project.sites.length }} sites</span>
                </div>

                <div class="projects-directory-ledger">
                  <div><span>Estimated Value</span><strong>{{ formatMoney(project.totalValue) }}</strong></div>
                  <div><span>Received</span><strong>{{ formatMoney(projectReceivedAmount(project)) }}</strong></div>
                  <div><span>Pending</span><strong>{{ formatMoney(projectPendingAmount(project)) }}</strong></div>
                  <div><span>Supervisor</span><strong>{{ project.supervisor }}</strong></div>
                </div>

                <div class="projects-directory-footer">
                  <span>{{ project.sites.join(", ") }}</span>
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
export class ProjectsDirectoryPage {
  readonly data = inject(ErpDataService);
  private readonly router = inject(Router);
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;
  readonly query = signal("");
  readonly projects = computed(() => this.data.sortProjectsByLastWorked(this.data.projects()));
  readonly filteredProjects = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) return this.projects();
    return this.projects().filter((project) =>
      [project.id, project.name, project.client, project.address, project.supervisor, project.status, ...project.sites]
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  });

  trackProject(_: number, project: Project): string {
    return project.id;
  }

  projectReceivedAmount(project: Project): number {
    return this.data.projectReceivedAmount(project);
  }

  projectPendingAmount(project: Project): number {
    return this.data.projectPendingAmount(project);
  }

  openProject(project: Project) {
    const clientId = this.data.clients().find((client) => client.projectIds.includes(project.id) || client.name === project.client)?.id;
    if (!clientId) return;
    this.data.touchProject(project.id);
    void this.router.navigate(["/clients", clientId, "projects", project.id, "materials"]);
  }
}
