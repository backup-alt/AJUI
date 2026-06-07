import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
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
    ProjectFormDialogComponent,
  ],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar [clientId]="clientId()" active="projects" (newProject)="showProjectForm.set(true)"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header [showTitle]="false" role="Admin" />

        <ion-content class="erp-page">
          <main class="workspace-shell" *ngIf="client() as currentClient">
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

            <section class="module-panel">
              <div class="module-toolbar">
                <div>
                  <h2>Project Management</h2>
                  <p>Select a project to open its details, site status, activity, and settings.</p>
                </div>
                <div class="table-actions">
                  <button type="button" class="primary-table-action" (click)="showProjectForm.set(true)"><ion-icon name="add-outline"></ion-icon>New Project</button>
                  <button type="button"><ion-icon name="search-outline"></ion-icon>Search</button>
                  <button type="button"><ion-icon name="funnel-outline"></ion-icon>Filters</button>
                  <button type="button"><ion-icon name="download-outline"></ion-icon>Export</button>
                </div>
              </div>

              <div class="project-select-grid">
                <article *ngFor="let project of projects()" class="project-select-card" role="button" tabindex="0" (click)="openProject(project)" (keydown.enter)="openProject(project)">
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
            </section>

            <agb-project-form-dialog
              *ngIf="showProjectForm()"
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
export class ClientWorkspacePage {
  readonly data = inject(ErpDataService);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly clientId = signal(this.route.snapshot.paramMap.get("clientId") ?? "");
  readonly showProjectForm = signal(false);
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

  openProject(project: Project) {
    void this.router.navigate(["/clients", this.clientId(), "projects", project.id]);
  }

  createProject(value: ProjectFormValue) {
    const currentClient = this.client();
    if (!currentClient || !value.name || !value.startDate || !value.supervisor || !value.totalValue) return;
    const project = this.data.addProject(currentClient, value);
    this.showProjectForm.set(false);
    setTimeout(() => void this.router.navigate(["/clients", currentClient.id, "projects", project.id]));
  }
}
