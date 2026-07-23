import { Component, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonContent,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonModal,
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
  searchOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Site, Material } from '../../shared/models';
import { DatePipe } from '@angular/common';
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
    IonModal,
    DatePipe,
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
              </footer>
            </article>
          }
        </div>
        <div class="bottom-spacer"></div>
      }
    </ion-content>

    <ion-modal [isOpen]="drawerOpen()" (didDismiss)="closeDrawer()" [breakpoints]="[0, 0.6, 0.92]" [initialBreakpoint]="0.92" [backdropDismiss]="true" class="inventory-drawer">
      <ng-template>
        <div class="drawer">
          <header class="drawer-head">
            <button class="drawer-close" (click)="closeDrawer()" aria-label="Close">
              <ion-icon name="close-outline"></ion-icon>
            </button>
            <div class="drawer-title">
              <div class="drawer-eyebrow">Inventory · {{ drawerMaterials().length }} {{ drawerMaterials().length === 1 ? 'item' : 'items' }}</div>
              <h2>{{ drawerSite()?.name }}</h2>
            </div>
            <div class="drawer-handle"></div>
          </header>

          <div class="drawer-search">
            <ion-icon name="search-outline" class="search-icon"></ion-icon>
            <input
              type="text"
              class="search-input"
              placeholder="Search materials..."
              [value]="drawerSearch()"
              (input)="onDrawerSearch($event)"
            />
            @if (drawerSearch()) {
              <button class="search-clear" (click)="clearDrawerSearch()" aria-label="Clear">
                <ion-icon name="close-outline"></ion-icon>
              </button>
            }
          </div>

          <div class="drawer-body">
            @if (drawerLoading()) {
              @for (i of [1, 2, 3]; track i) {
                <div class="skeleton-card">
                  <ion-skeleton-text animated style="width: 60%; height: 16px;"></ion-skeleton-text>
                  <ion-skeleton-text animated style="width: 90%; height: 14px; margin-top: 6px;"></ion-skeleton-text>
                  <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 6px;"></ion-skeleton-text>
                </div>
              }
            } @else if (filteredDrawerMaterials().length === 0) {
              <app-empty-state
                icon="cube-outline"
                [title]="drawerSearch() ? 'No matches' : 'No materials yet'"
                [message]="drawerSearch() ? 'Try a different search term.' : 'This site has no materials recorded.'"
              ></app-empty-state>
            } @else {
              @for (m of filteredDrawerMaterials(); track m._id) {
                <article class="material-card">
                  <header class="m-head">
                    <span class="m-icon"><ion-icon name="cube-outline"></ion-icon></span>
                    <div class="m-info">
                      <h3 class="m-name">{{ m.name }}</h3>
                      @if (m.vendor) {
                        <p class="m-vendor"><ion-icon name="business-outline"></ion-icon> {{ m.vendor }}</p>
                      }
                    </div>
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
    .sites-content { --background: var(--m3-surface); }

    .cards { padding: 0 var(--md-space-4); }
    .site-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-3);
      box-shadow: var(--md-elevation-1);
      transition: transform var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  box-shadow var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  border-color var(--md-motion-duration-short1) var(--md-motion-easing-standard);
    }
    .site-card:active { transform: scale(0.99); }
    .site-card.active {
      border-color: var(--m3-secondary);
      box-shadow: 0 12px 28px -16px rgba(201, 162, 39, 0.45);
      background: linear-gradient(180deg, var(--m3-secondary-container) 0%, var(--m3-surface-bright) 30%);
    }

    .site-head { display: flex; align-items: center; gap: 12px; margin-bottom: var(--md-space-3); }
    .site-tile {
      width: 44px; height: 44px;
      border-radius: var(--md-radius-lg);
      background: var(--m3-primary-container);
      color: var(--m3-on-primary-container);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .site-tile ion-icon { font-size: 20px; }
    .site-meta { flex: 1; min-width: 0; }
    .site-name { font-size: 15px; font-weight: 700; color: var(--m3-on-surface); margin: 0 0 2px; }
    .site-id { font-size: 11px; color: var(--m3-on-surface-muted); margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .active-icon { font-size: 24px; flex-shrink: 0; }

    .site-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: var(--md-space-3);
    }
    .stat {
      display: flex; align-items: center; gap: 8px;
      background: var(--m3-surface-container);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-md);
      padding: 8px 10px;
    }
    .stat-tile {
      width: 28px; height: 28px;
      border-radius: var(--md-radius-sm);
      background: var(--m3-primary-container);
      color: var(--m3-on-primary-container);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .stat-tile ion-icon { font-size: 14px; }
    .stat-tile-gold { background: rgba(201, 162, 39, 0.14); color: var(--m3-secondary); }
    .stat-tile-green { background: var(--m3-success-container); color: var(--m3-success); }
    .stat-value { font-size: 15px; font-weight: 700; color: var(--m3-on-surface); line-height: 1; }
    .stat-label { font-size: 10px; color: var(--m3-on-surface-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }

    .site-actions { display: flex; gap: 8px; }
    .action-btn {
      flex: 1;
      min-width: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 14px;
      border-radius: var(--md-radius-lg);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
      border: 0;
      transition: background var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  transform var(--md-motion-duration-short1) var(--md-motion-easing-standard);
    }
    .action-btn.ghost {
      background: var(--m3-surface-container);
      color: var(--m3-primary);
      border: 1px solid var(--m3-outline-variant);
    }
    .action-btn.ghost:hover { background: var(--m3-surface-container-high); }
    .action-btn ion-icon { font-size: 16px; }

    .skeleton-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin: 0 var(--md-space-4) var(--md-space-3);
    }
    .bottom-spacer { height: 24px; }

    .drawer {
      background: var(--m3-surface);
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 100%;
      overflow: hidden;
    }
    .drawer-head {
      flex-shrink: 0;
      position: relative;
      background: var(--m3-surface-bright);
      padding: var(--md-space-4) var(--md-space-4) var(--md-space-3);
      border-bottom: 1px solid var(--m3-outline-variant);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .drawer-handle {
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 4px;
      border-radius: 999px;
      background: var(--m3-outline);
    }
    .drawer-close {
      width: 36px; height: 36px;
      border-radius: var(--md-radius-md);
      background: var(--m3-surface-container);
      color: var(--m3-on-surface-variant);
      border: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .drawer-close ion-icon { font-size: 20px; }
    .drawer-eyebrow {
      font-size: 10px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .drawer-title h2 {
      font-size: 18px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 2px 0 0;
      letter-spacing: -0.2px;
    }
    .drawer-title { flex: 1; min-width: 0; }

    .drawer-search {
      flex-shrink: 0;
      position: relative;
      margin: var(--md-space-3) var(--md-space-4) var(--md-space-2);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      display: flex;
      align-items: center;
      padding: 0 12px;
      height: 44px;
    }
    .drawer-search .search-icon {
      font-size: 18px;
      color: var(--m3-on-surface-muted);
      margin-right: 8px;
      flex-shrink: 0;
    }
    .drawer-search .search-input {
      flex: 1;
      border: 0;
      outline: 0;
      background: transparent;
      font: inherit;
      font-size: 14px;
      color: var(--m3-on-surface);
      min-width: 0;
    }
    .drawer-search .search-input::placeholder { color: var(--m3-on-surface-muted); }
    .drawer-search .search-clear {
      width: 22px; height: 22px;
      border-radius: 999px;
      background: var(--m3-surface-container-high);
      color: var(--m3-on-surface-variant);
      border: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }
    .drawer-search .search-clear ion-icon { font-size: 14px; }

    .drawer-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      padding: var(--md-space-2) 0 24px;
    }

    .material-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-3) var(--md-space-4);
      margin: 0 var(--md-space-4) var(--md-space-2);
    }
    .m-head { display: flex; align-items: center; gap: 10px; margin-bottom: var(--md-space-2); }
    .m-icon {
      width: 36px; height: 36px;
      border-radius: var(--md-radius-md);
      background: var(--m3-primary-container);
      color: var(--m3-on-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .m-icon ion-icon { font-size: 18px; }
    .m-info { flex: 1; min-width: 0; }
    .m-name { font-size: 15px; font-weight: 700; color: var(--m3-on-surface); margin: 0 0 2px; }
    .m-vendor {
      font-size: 11px; color: var(--m3-on-surface-muted); margin: 0;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .m-vendor ion-icon { font-size: 12px; }
    .m-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
    .m-stat {
      background: var(--m3-surface-container);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-md);
      padding: 8px 6px;
      text-align: center;
    }
    .m-label { font-size: 10px; color: var(--m3-on-surface-muted); text-transform: uppercase; letter-spacing: 0.3px; }
    .m-value { font-size: 14px; font-weight: 700; color: var(--m3-on-surface); margin-top: 2px; }
    .m-value.highlight { color: var(--m3-secondary); }
    .m-date { font-size: 11px; color: var(--m3-on-surface-muted); margin: 4px 0 0; }
  `],
})
export class SitesPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);

  sites = signal<Site[]>([]);
  isLoading = signal(true);
  loadError = signal(false);
  activeSiteId = computed(() => this.supervisor.selectedSiteId());

  drawerOpen = signal(false);
  drawerSite = signal<Site | null>(null);
  drawerMaterials = signal<Material[]>([]);
  drawerLoading = signal(false);
  drawerSearch = signal('');

  filteredDrawerMaterials = computed(() => {
    const q = this.drawerSearch().toLowerCase().trim();
    if (!q) return this.drawerMaterials();
    return this.drawerMaterials().filter((m) => {
      const name = (m.name || '').toLowerCase();
      const vendor = (m.vendor || '').toLowerCase();
      const status = (m.status || '').toLowerCase();
      return name.includes(q) || vendor.includes(q) || status.includes(q);
    });
  });

  async ngOnInit(): Promise<void> {
    addIcons({
      locationOutline, cubeOutline, peopleOutline, arrowForwardOutline,
      closeOutline, businessOutline, checkmarkCircle, alertCircleOutline,
      constructOutline, calendarOutline, chevronForwardOutline, layersOutline,
      searchOutline,
    });
    await this.loadSites();
  }

  async loadSites(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(false);
    try {
      this.supervisor.getSites().subscribe({
        next: (res) => {
          this.sites.set(res.sites || []);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[Sites] failed to load', err);
          this.sites.set([]);
          this.loadError.set(true);
          this.isLoading.set(false);
        },
      });
    } catch (e) {
      console.error(e);
      this.sites.set([]);
      this.loadError.set(true);
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
    this.drawerSearch.set('');
  }

  onDrawerSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.drawerSearch.set(value);
  }

  clearDrawerSearch(): void {
    this.drawerSearch.set('');
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
