import { Component, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonContent,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  cubeOutline,
  peopleOutline,
  checkmarkCircle,
  alertCircleOutline,
  chevronForwardOutline,
  walletOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Project } from '../../shared/models';
import {
  PageHeaderComponent,
  EmptyStateComponent,
  StatusPillComponent,
} from '../../shared/components';

@Component({
  selector: 'app-sites',
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusPillComponent,
  ],
  template: `
    <ion-content class="projects-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshProjects($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <app-page-header title="My projects" subtitle="Choose a project to view and update its work records.">
        <span actions class="count-chip">{{ projects().length }} assigned</span>
      </app-page-header>

      @if (isLoading() && projects().length === 0) {
        <div class="project-list">
          @for (i of [1, 2, 3]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width: 62%; height: 19px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 38%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 100%; height: 8px; margin-top: 18px;"></ion-skeleton-text>
            </div>
          }
        </div>
      } @else if (loadError()) {
        <app-empty-state icon="alert-circle-outline" title="Projects unavailable" message="Pull down to retry loading your assigned projects."></app-empty-state>
      } @else if (projects().length === 0) {
        <app-empty-state icon="business-outline" title="No projects assigned" message="Contact your administrator to be assigned to a project."></app-empty-state>
      } @else {
        <div class="project-list">
          @for (project of projects(); track project.id) {
            <article class="project-card" [class.active]="project.id === activeProjectId()" (click)="selectProject(project)">
              <header class="project-head">
                <span class="project-icon"><ion-icon name="business-outline"></ion-icon></span>
                <div class="project-title">
                  <h3>{{ project.name }}</h3>
                  <p>{{ project.client || 'Project workspace' }}</p>
                </div>
                @if (project.id === activeProjectId()) {
                  <ion-icon name="checkmark-circle" class="active-icon" color="success"></ion-icon>
                } @else {
                  <app-status-pill [tone]="statusTone(project.status)">{{ project.status }}</app-status-pill>
                }
              </header>

              <div class="project-stats">
                <div class="stat"><ion-icon name="cube-outline"></ion-icon><div><strong>{{ project.stats?.materials?.count || 0 }}</strong><span>Materials</span></div></div>
                <div class="stat"><ion-icon name="people-outline"></ion-icon><div><strong>{{ project.stats?.labour?.count || 0 }}</strong><span>Labour records</span></div></div>
                <div class="stat"><ion-icon name="wallet-outline"></ion-icon><div><strong>{{ project.stats?.expenses?.count || 0 }}</strong><span>Expenses</span></div></div>
              </div>

              <footer><span>{{ project.id === activeProjectId() ? 'Current project' : 'Switch to project' }}</span><ion-icon name="chevron-forward-outline"></ion-icon></footer>
            </article>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .projects-content { --background: var(--m3-surface); }
    .count-chip { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; background: rgba(0, 34, 99, 0.08); color: var(--m3-primary); font-size: 12px; font-weight: 700; }
    .project-list { display: grid; gap: 14px; padding: 0 var(--md-space-4) 28px; }
    .project-card, .skeleton-card { background: var(--m3-surface-bright); border: 1px solid var(--m3-outline-variant); border-radius: var(--md-radius-xl); padding: 18px; box-shadow: var(--md-elevation-1); }
    .project-card { cursor: pointer; transition: border-color 140ms ease, transform 140ms ease; }
    .project-card:active { transform: scale(0.99); }
    .project-card.active { border-color: var(--m3-primary); box-shadow: 0 0 0 1px rgba(0, 34, 99, 0.12); }
    .project-head { display: flex; align-items: center; gap: 12px; }
    .project-icon { width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0; display: grid; place-items: center; color: var(--m3-primary); background: var(--m3-primary-container); }
    .project-icon ion-icon { font-size: 21px; }
    .project-title { flex: 1; min-width: 0; }
    .project-title h3 { margin: 0; font-size: 17px; font-weight: 750; color: var(--m3-on-surface); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .project-title p { margin: 4px 0 0; font-size: 13px; color: var(--m3-on-surface-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .active-icon { font-size: 24px; }
    .project-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
    .stat { display: flex; gap: 7px; align-items: center; min-width: 0; padding: 10px 8px; border-radius: 12px; background: var(--m3-surface-container-low); }
    .stat ion-icon { color: var(--m3-primary); font-size: 17px; flex-shrink: 0; }
    .stat div { min-width: 0; }
    .stat strong, .stat span { display: block; }
    .stat strong { font-size: 14px; color: var(--m3-on-surface); }
    .stat span { margin-top: 2px; font-size: 9px; color: var(--m3-on-surface-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    footer { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--m3-outline-variant); color: var(--m3-primary); font-size: 13px; font-weight: 700; }
    footer ion-icon { font-size: 17px; }
  `],
})
export class SitesPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  projects = signal<Project[]>([]);
  isLoading = signal(true);
  loadError = signal(false);
  activeProjectId = computed(() => this.supervisor.selectedProjectId());

  async ngOnInit(): Promise<void> {
    addIcons({ businessOutline, cubeOutline, peopleOutline, checkmarkCircle, alertCircleOutline, chevronForwardOutline, walletOutline });
    await this.supervisor.init().catch(() => undefined);
    await this.loadProjects();
  }

  async loadProjects(_force = false): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(false);
    try {
      // Assignments are managed from the web app, so this page must not reuse
      // a previously cached project list when it becomes active.
      const response = await firstValueFrom(this.supervisor.getProjects(true, true));
      this.projects.set(response.projects || []);
    } catch (error) {
      console.error('[Projects] failed to load', error);
      // Keep already-rendered assignments visible if a background refresh
      // fails. Only show the full error state when no usable data exists.
      this.loadError.set(this.projects().length === 0);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshProjects(event: CustomEvent): Promise<void> {
    await this.loadProjects(true);
    (event.target as HTMLIonRefresherElement).complete();
  }

  async selectProject(project: Project): Promise<void> {
    const changed = project.id !== this.activeProjectId();
    await this.supervisor.setSelectedProject(project);
    window.dispatchEvent(new CustomEvent('agb:project-changed', { detail: project.id }));
    if (changed) {
      const toast = await this.toastCtrl.create({ message: `Switched to ${project.name}`, duration: 1600, color: 'success', position: 'top' });
      await toast.present();
    }
    await this.router.navigate(['/tabs/dashboard']);
  }

  statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'Active') return 'success';
    if (status === 'On Hold') return 'warning';
    if (status === 'Cancelled') return 'danger';
    return 'neutral';
  }
}
