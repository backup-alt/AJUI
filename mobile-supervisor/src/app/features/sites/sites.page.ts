import { Component, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardContent,
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
import { FormsModule } from '@angular/forms';
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
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Site, Material } from '../../shared/models';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-sites',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardContent,
    IonIcon,
    IonBadge,
    IonButton,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonModal,
    IonButtons,
    FormsModule,
    DatePipe,
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar><ion-title>My Sites</ion-title></ion-toolbar>
    </ion-header>

    <ion-content class="sites-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshSites($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="page-header">
        <h1 class="page-title">Your Assigned Sites</h1>
        <p class="page-subtitle">
          Tap a site to view its full material inventory and switch to it.
        </p>
      </div>

      @if (isLoading() && sites().length === 0) {
        @for (i of [1, 2]; track i) {
          <ion-card class="site-card skeleton">
            <ion-card-content>
              <ion-skeleton-text animated style="width: 70%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 50%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 90%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </ion-card-content>
          </ion-card>
        }
      } @else if (sites().length === 0) {
        <div class="empty-state">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <h3>No Sites Assigned</h3>
          <p>Please contact your admin to be assigned to a site.</p>
        </div>
      } @else {
        @for (site of sites(); track site.id) {
          <ion-card
            class="site-card"
            [class.active]="site.id === activeSiteId()"
            (click)="openSite(site)"
          >
            <ion-card-content>
              <div class="card-top">
                <div class="card-info">
                  <h3 class="site-name">{{ site.name }}</h3>
                  <p class="site-id">Site ID: {{ site.siteId }}</p>
                </div>
                @if (site.id === activeSiteId()) {
                  <ion-icon name="checkmark-circle" class="active-icon" color="success"></ion-icon>
                }
              </div>

              <div class="card-stats">
                @if (site.employeeCount !== undefined) {
                  <div class="stat">
                    <ion-icon name="people-outline"></ion-icon>
                    <div class="stat-info">
                      <span class="stat-value">{{ site.employeeCount }}</span>
                      <span class="stat-label">{{ site.employeeCount === 1 ? 'worker' : 'workers' }}</span>
                    </div>
                  </div>
                }
                @if (site.daysActive !== undefined) {
                  <div class="stat">
                    <ion-icon name="time-outline"></ion-icon>
                    <div class="stat-info">
                      <span class="stat-value">{{ site.daysActive }}</span>
                      <span class="stat-label">{{ site.daysActive === 1 ? 'day' : 'days' }} active</span>
                    </div>
                  </div>
                }
                <div class="stat">
                  <ion-icon name="business-outline"></ion-icon>
                  <div class="stat-info">
                    <ion-badge [color]="getStatusColor(site.status)">{{ site.status }}</ion-badge>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <ion-button
                  size="small"
                  fill="outline"
                  (click)="viewMaterials(site, $event)"
                >
                  <ion-icon name="cube-outline" slot="start"></ion-icon>
                  Materials
                </ion-button>
                @if (site.id !== activeSiteId()) {
                  <ion-button
                    size="small"
                    class="primary-action"
                    (click)="switchTo(site, $event)"
                  >
                    Switch to this site
                    <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
                  </ion-button>
                } @else {
                  <ion-button size="small" class="primary-action" disabled>
                    Active Site
                  </ion-button>
                }
              </div>
            </ion-card-content>
          </ion-card>
        }
      }
    </ion-content>

    <!-- Materials drawer per site -->
    <ion-modal [isOpen]="drawerOpen()" (didDismiss)="closeDrawer()">
      <ng-template>
        <ion-header class="agb-header">
          <ion-toolbar>
            <ion-title>{{ drawerSite()?.name }} · Materials</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="closeDrawer()">
                <ion-icon name="close-outline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="drawer-content">
          @if (drawerLoading()) {
            @for (i of [1, 2, 3]; track i) {
              <ion-card class="skeleton">
                <ion-card-content>
                  <ion-skeleton-text animated style="width: 60%; height: 16px;"></ion-skeleton-text>
                  <ion-skeleton-text animated style="width: 90%; height: 14px; margin-top: 6px;"></ion-skeleton-text>
                </ion-card-content>
              </ion-card>
            }
          } @else if (drawerMaterials().length === 0) {
            <div class="empty-state">
              <ion-icon name="cube-outline"></ion-icon>
              <h3>No materials yet</h3>
              <p>This site has no materials recorded.</p>
            </div>
          } @else {
            @for (m of drawerMaterials(); track m._id) {
              <ion-card class="material-card">
                <ion-card-content>
                  <div class="m-head">
                    <h3 class="m-name">{{ m.name }}</h3>
                    <ion-badge [color]="getMaterialStatusColor(m.status)">{{ m.status }}</ion-badge>
                  </div>
                  <div class="m-stats">
                    <div class="m-stat">
                      <span class="m-label">Remaining</span>
                      <span class="m-value highlight">{{ m.remainingStock }} {{ m.unit }}</span>
                    </div>
                    <div class="m-stat">
                      <span class="m-label">Purchased</span>
                      <span class="m-value">{{ m.purchasedQuantity }} {{ m.unit }}</span>
                    </div>
                    <div class="m-stat">
                      <span class="m-label">Consumed</span>
                      <span class="m-value">{{ m.consumedQuantity }} {{ m.unit }}</span>
                    </div>
                  </div>
                  <p class="m-date">Requested {{ m.requestDate | date: 'MMM d, y' }}</p>
                </ion-card-content>
              </ion-card>
            }
          }
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); --border-color: var(--agb-light-gray); }
    .sites-content { --background: #f5f6f8; }
    .page-header { padding: 16px 16px 4px; }
    .page-title {
      font-size: 18px;
      font-weight: 700;
      color: #002263;
      margin: 0 0 4px;
    }
    .page-subtitle {
      font-size: 13px;
      color: #6c757d;
      margin: 0 0 8px;
    }

    .site-card {
      margin: 12px 16px;
      border: 1px solid #e5e7eb;
      background: #ffffff;
      transition: border-color 0.15s;
    }
    .site-card.active {
      border-color: #c9a227;
      background: #fffbeb;
    }
    .site-card:active { transform: scale(0.99); }

    .card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .card-info { min-width: 0; flex: 1; }
    .site-name {
      font-size: 16px;
      font-weight: 700;
      color: #002263;
      margin: 0 0 2px;
    }
    .site-id {
      font-size: 11px;
      color: #6b7280;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .active-icon { font-size: 24px; flex-shrink: 0; }

    .card-stats {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .stat {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .stat ion-icon { font-size: 16px; color: #002263; flex-shrink: 0; }
    .stat-info { display: flex; flex-direction: column; min-width: 0; }
    .stat-value { font-size: 14px; font-weight: 700; color: #111827; line-height: 1; }
    .stat-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; }

    .card-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .card-actions ion-button {
      --border-radius: 8px;
      flex: 1;
      min-width: 0;
    }
    .card-actions ion-button[fill="outline"] {
      --border-color: #d1d5db;
      --color: #002263;
    }
    .primary-action {
      --background: #002263;
      --color: #ffffff;
    }
    .primary-action[disabled] {
      --background: #c9a227;
      --color: #ffffff;
      opacity: 1;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 64px 32px;
      text-align: center;
    }
    .empty-state ion-icon { font-size: 64px; color: #d1d5db; margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; font-weight: 600; color: #002263; margin: 0 0 8px; }
    .empty-state p { font-size: 14px; color: #6c757d; margin: 0; }

    .skeleton { margin: 12px 16px; }
    .skeleton:active { transform: none; }

    .drawer-content { --background: #f5f6f8; }
    .material-card { margin: 12px 16px; }
    .m-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .m-name { font-size: 15px; font-weight: 700; color: #002263; margin: 0; }
    .m-stats {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }
    .m-stat {
      flex: 1;
      padding: 8px 6px;
      background: #f8f9fa;
      border-radius: 8px;
      text-align: center;
    }
    .m-label { display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
    .m-value { display: block; font-size: 13px; font-weight: 700; color: #002263; }
    .m-value.highlight { color: #c9a227; }
    .m-date { font-size: 11px; color: #9ca3af; margin: 4px 0 0; }
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
      locationOutline,
      cubeOutline,
      peopleOutline,
      arrowForwardOutline,
      closeOutline,
      businessOutline,
      checkmarkCircle,
      alertCircleOutline,
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
    // Trigger list-page refresh by reloading the URL.
    window.dispatchEvent(new CustomEvent('agb:site-changed', { detail: site.id }));
  }

  getStatusColor(status?: string): string {
    switch (status) {
      case 'Active': return 'success';
      case 'On Hold': return 'warning';
      case 'Completed': return 'primary';
      default: return 'medium';
    }
  }

  getMaterialStatusColor(status: string): string {
    switch (status) {
      case 'Pending': return 'warning';
      case 'Approved': return 'success';
      case 'Rejected': return 'danger';
      default: return 'medium';
    }
  }
}
