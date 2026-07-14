import { Component, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonContent,
  IonIcon,
  IonBadge,
  IonButton,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonButtons,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  locationOutline,
  cubeOutline,
  peopleOutline,
  arrowForwardOutline,
  closeOutline,
  businessOutline,
  checkmarkCircle,
  alertCircleOutline,
  constructOutline,
  calendarOutline,
  chevronForwardOutline,
  layersOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Site, Material } from '../../shared/models';
import { DatePipe, NgIf } from '@angular/common';
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
    IonBadge,
    IonButton,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonModal,
    IonButtons,
    DatePipe,
    NgIf,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusPillComponent,
  ],
  template: `
    <ion-content class="sites-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshSites($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <app-page-header
        title="Your sites"
        subtitle="Tap a site to view its full material inventory or switch to it."
      ></app-page-header>

      @if (isLoading() && sites().length === 0) {
        @for (i of [1, 2]; track i) {
          <div class="skeleton-card">
            <ion-skeleton-text animated style="width: 70%; height: 18px;"></ion-skeleton-text>
            <ion-skeleton-text animated style="width: 50%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            <ion-skeleton-text animated style="width: 90%; height: 14px; margin-top: 12px;"></ion-skeleton-text>
          </div>
        }
      } @else if (sites().length === 0) {
        <app-empty-state
          icon="alert-circle-outline"
          iconBg="rgba(245, 158, 11, 0.14)"
          iconColor="#b45309"
          title="No sites assigned"
          message="You haven't been assigned to a site yet. Please contact your admin."
        ></app-empty-state>
      } @else {
        <div class="cards">
          @for (site of sites(); track site.id) {
            <article
              class="site-card"
              [class.active]="site.id === activeSiteId()"
              (click)="openSite(site)"
            >
              <header class="site-head">
                <span class="site-tile">
                  <ion-icon name="construct-outline"></ion-icon>
                </span>
                <div class="site-meta">
                  <h3 class="site-name">{{ site.name }}</h3>
                  <p class="site-id">Site ID - {{ site.siteId }}</p>
                </div>
                @if (site.id === activeSiteId()) {
                  <ion-icon name="checkmark-circle" class="active-icon" color="success"></ion-icon>
                }
              </header>

              <div class="site-stats">
                @if (site.employeeCount !== undefined) {
                  <div class="stat">
                    <span class="stat-tile">
                      <ion-icon name="people-outline"></ion-icon>
                    </span>
                    <div>
                      <div class="stat-value">{{ site.employeeCount }}</div>
                      <div class="stat-label">{{ site.employeeCount === 1 ? 'Worker' : 'Workers' }}</div>
                    </div>
                  </div>
                }
                @if (site.daysActive !== undefined) {
                  <div class="stat">
                    <span class="stat-tile stat-tile-gold">
                      <ion-icon name="calendar-outline"></ion-icon>
                    </span>
                    <div>
                      <div class="stat-value">{{ site.daysActive }}</div>
                      <div class="stat-label">Day{{ site.daysActive === 1 ? '' : 's' }} active</div>
                    </div>
                  </div>
                }
                <div class="stat">
                  <span class="stat-tile stat-tile-green">
                    <ion-icon name="layers-outline"></ion-icon>
                  </span>
                  <div>
                    <app-status-pill [tone]="getStatusTone(site.status)">
                      {{ site.status || 'Active' }}
                    </app-status-pill>
                  </div>
                </div>
              </div>

              <footer class="site-actions">
                <button class="action-btn ghost" (click)="viewMaterials(site, $event)">
                  <ion-icon name="cube-outline"></ion-icon>
                  Materials
                </button>
                @if (site.id !== activeSiteId()) {
                  <button class="action-btn primary" (click)="switchTo(site, $event)">
                    Switch to site
                    <ion-icon name="arrow-forward-outline"></ion-icon>
                  </button>
                } @else {
                  <span class="action-btn primary active">
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    Active site
                  </span>
                }
              </footer>
            </article>
          }
        </div>
        <div class="bottom-spacer"></div>
      }
    </ion-content>

    <ion-modal [isOpen]="drawerOpen()" (didDismiss)="closeDrawer()">
      <ng-template>
        <div class="drawer">
          <header class="drawer-head">
            <button class="drawer-close" (click)="closeDrawer()" aria-label="Close">
              <ion-icon name="close-outline"></ion-icon>
            </button>
            <div class="drawer-title">
              <div class="drawer-eyebrow">Materials inventory</div>
              <h2>{{ drawerSite()?.name }}</h2>
            </div>
          </header>

          <div class="drawer-body">
            @if (drawerLoading()) {
              @for (i of [1, 2, 3]; track i) {
                <div class="skeleton-card">
                  <ion-skeleton-text animated style="width: 60%; height: 16px;"></ion-skeleton-text>
                  <ion-skeleton-text animated style="width: 90%; height: 14px; margin-top: 6px;"></ion-skeleton-text>
                </div>
              }
            } @else if (drawerMaterials().length === 0) {
              <app-empty-state
                icon="cube-outline"
                title="No materials yet"
                message="This site has no materials recorded."
              ></app-empty-state>
            } @else {
              @for (m of drawerMaterials(); track m._id) {
                <article class="material-card">
                  <header class="m-head">
                    <h3 class="m-name">{{ m.name }}</h3>
                    <app-status-pill [tone]="getMaterialTone(m.status)">{{ m.status }}</app-status-pill>
                  </header>
                  <div class="m-stats">
                    <div class="m-stat">
                      <div class="m-label">Remaining</div>
                      <div class="m-value highlight">{{ m.remainingStock }} {{ m.unit }}</div>
                    </div>
                    <div class="m-stat">
                      <div class="m-label">Purchased</div>
                      <div class="m-value">{{ m.purchasedQuantity }} {{ m.unit }}</div>
                    </div>
                    <div class="m-stat">
                      <div class="m-label">Consumed</div>
                      <div class="m-value">{{ m.consumedQuantity }} {{ m.unit }}</div>
                    </div>
                  </div>
                  <p class="m-date">Requested {{ m.requestDate | date: 'MMM d, y' }}</p>
                </article>
              }
            }
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .sites-content { --background: #f5f6f8; }

    .cards { padding: 0 16px; }
    .site-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: var(--agb-shadow-2xs);
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast), border-color var(--agb-transition-fast);
    }
    .site-card:active { transform: scale(0.99); }
    .site-card:hover { box-shadow: var(--agb-shadow-sm); }
    .site-card.active {
      border-color: #c9a227;
      box-shadow: 0 12px 28px -16px rgba(201, 162, 39, 0.45);
      background: linear-gradient(180deg, #fffbeb 0%, #ffffff 30%);
    }

    .site-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
    .site-tile {
      width: 44px; height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(0, 34, 99, 0.10), rgba(0, 34, 99, 0.04));
      color: #002263;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .site-tile ion-icon { font-size: 20px; }
    .site-meta { flex: 1; min-width: 0; }
    .site-name { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
    .site-id { font-size: 11px; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .active-icon { font-size: 24px; flex-shrink: 0; }

    .site-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .stat {
      display: flex; align-items: center; gap: 8px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 12px;
      padding: 8px 10px;
    }
    .stat-tile {
      width: 28px; height: 28px;
      border-radius: 9px;
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .stat-tile ion-icon { font-size: 14px; }
    .stat-tile-gold { background: rgba(201, 162, 39, 0.14); color: #a8861f; }
    .stat-tile-green { background: rgba(22, 163, 74, 0.10); color: #15803d; }
    .stat-value { font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1; }
    .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }

    .site-actions { display: flex; gap: 8px; }
    .action-btn {
      flex: 1;
      min-width: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 14px;
      border-radius: 14px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
      border: 0;
      transition: background var(--agb-transition-fast), transform var(--agb-transition-fast);
    }
    .action-btn.ghost {
      background: #f1f5f9;
      color: #002263;
      border: 1px solid #e2e8f0;
    }
    .action-btn.ghost:hover { background: #e2e8f0; }
    .action-btn.primary {
      background: #002263;
      color: #ffffff;
      box-shadow: 0 8px 18px -10px rgba(0, 34, 99, 0.55);
    }
    .action-btn.primary:hover { filter: brightness(1.05); }
    .action-btn.primary.active {
      background: linear-gradient(135deg, #c9a227, #d4b45a);
      color: #1f2937;
      box-shadow: 0 8px 18px -10px rgba(201, 162, 39, 0.55);
      cursor: default;
    }
    .action-btn ion-icon { font-size: 16px; }

    .skeleton-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 16px;
      margin: 0 16px 12px;
    }
    .bottom-spacer { height: 24px; }

    /* Drawer */
    .drawer {
      background: #f5f6f8;
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }
    .drawer-head {
      position: sticky;
      top: 0;
      z-index: 5;
      background: #ffffff;
      padding: 16px 18px;
      border-bottom: 1px solid #eef0f3;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .drawer-close {
      width: 36px; height: 36px;
      border-radius: 12px;
      background: #f1f5f9;
      color: #475569;
      border: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .drawer-close ion-icon { font-size: 20px; }
    .drawer-eyebrow {
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .drawer-title h2 {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 2px 0 0;
      letter-spacing: -0.2px;
    }
    .drawer-body { padding: 12px 0 24px; }

    .material-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 14px 16px;
      margin: 0 16px 10px;
    }
    .m-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .m-name { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; }
    .m-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
    .m-stat {
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 10px;
      padding: 8px 6px;
      text-align: center;
    }
    .m-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
    .m-value { font-size: 14px; font-weight: 700; color: #002263; margin-top: 2px; }
    .m-value.highlight { color: #a8861f; }
    .m-date { font-size: 11px; color: #94a3b8; margin: 4px 0 0; }
  `],
})
export class SitesPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);

  sites = signal<Site[]>([]);
  isLoading = signal(true);
  activeSiteId = computed(() => this.supervisor.selectedSiteId());

  drawerOpen = signal(false);
  drawerSite = signal<Site | null>(null);
  drawerMaterials = signal<Material[]>([]);
  drawerLoading = signal(false);

  async ngOnInit(): Promise<void> {
    addIcons({
      locationOutline, cubeOutline, peopleOutline, arrowForwardOutline,
      closeOutline, businessOutline, checkmarkCircle, alertCircleOutline,
      constructOutline, calendarOutline, chevronForwardOutline, layersOutline,
    });
    await this.loadSites();
  }

  async loadSites(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.supervisor.getSites().subscribe({
        next: (res) => {
          this.sites.set(res.sites || []);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[Sites] failed to load', err);
          this.sites.set([]);
          this.isLoading.set(false);
        },
      });
    } catch (e) {
      console.error(e);
      this.isLoading.set(false);
    }
  }

  async refreshSites(event: CustomEvent): Promise<void> {
    await this.loadSites();
    (event.target as HTMLIonRefresherElement).complete();
  }

  openSite(site: Site): void {
    this.drawerSite.set(site);
    this.drawerOpen.set(true);
    void this.loadDrawerMaterials(site);
  }

  viewMaterials(site: Site, event: Event): void {
    event.stopPropagation();
    this.openSite(site);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.drawerSite.set(null);
    this.drawerMaterials.set([]);
  }

  private async loadDrawerMaterials(site: Site): Promise<void> {
    this.drawerLoading.set(true);
    this.supervisor
      .getMaterials({ siteId: site.id, limit: 100 })
      .subscribe({
        next: (res) => {
          this.drawerMaterials.set(res.materials || []);
          this.drawerLoading.set(false);
        },
        error: (err) => {
          console.error('[Sites] failed to load materials', err);
          this.drawerMaterials.set([]);
          this.drawerLoading.set(false);
        },
      });
  }

  async switchTo(site: Site, event: Event): Promise<void> {
    event.stopPropagation();
    await this.supervisor.setSelectedSite(
      site.id,
      site.projectId || '',
      site.projectName || site.name,
      site.name
    );
    const toast = await this.toastCtrl.create({
      message: `Switched to ${site.name}`,
      duration: 1500,
      color: 'success',
      position: 'top',
    });
    await toast.present();
    window.dispatchEvent(new CustomEvent('agb:site-changed', { detail: site.id }));
  }

  getStatusTone(status?: string): 'success' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'Active': return 'success';
      case 'On Hold': return 'warning';
      case 'Completed': return 'info';
      default: return 'neutral';
    }
  }

  getMaterialTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'Pending': return 'warning';
      case 'Approved': return 'success';
      case 'Rejected': return 'danger';
      default: return 'neutral';
    }
  }
}
