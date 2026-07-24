import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonFab,
  IonFabButton,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  addOutline,
  cubeOutline,
  filterOutline,
  timeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  chevronForwardOutline,
  chevronDownOutline,
  businessOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Material, MaterialStatus } from '../../shared/models';
import { DatePipe } from '@angular/common';
import {
  PageHeaderComponent,
  EmptyStateComponent,
  StatusPillComponent,
} from '../../shared/components';

interface ConsolidatedMaterial {
  name: string;
  unit: string;
  totalRequested: number;
  totalApproved: number;
  totalRemaining: number;
  siteCount: number;
  projectNames: string[];
  status: MaterialStatus;
  items: Material[];
  lowStock: boolean;
}

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonFab,
    IonFabButton,
    IonIcon,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    DatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusPillComponent,
  ],
  template: `
    <ion-content class="materials-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshMaterials($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <app-page-header
        title="Materials"
        subtitle="Live inventory across your assigned sites."
      >
        <span actions class="count-chip">{{ consolidatedMaterials().length }} material{{ consolidatedMaterials().length === 1 ? '' : 's' }}</span>
      </app-page-header>

      <div class="filter-stack">
        <ion-searchbar
          placeholder="Search by material, site, vendor"
          [(ngModel)]="searchQuery"
          (ionInput)="filterMaterials()"
          class="search"
        ></ion-searchbar>
        <div class="seg-wrap">
          <ion-segment [(ngModel)]="statusFilter" (ionChange)="filterMaterials()" [value]="''">
            <ion-segment-button [value]="''">
              <ion-label>All</ion-label>
            </ion-segment-button>
            <ion-segment-button value="Pending">
              <ion-label>Pending</ion-label>
            </ion-segment-button>
            <ion-segment-button value="Approved">
              <ion-label>Approved</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>
      </div>

      <div class="cards">
        @if (isLoading() && materials().length === 0) {
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 40%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </div>
          }
        } @else if (consolidatedMaterials().length === 0) {
          <app-empty-state
            icon="cube-outline"
            [title]="searchQuery || statusFilter ? 'No matches' : 'No materials yet'"
            [message]="searchQuery || statusFilter
              ? 'No materials match your filters. Try clearing them.'
              : 'Create a material request to get started.'"
          ></app-empty-state>
        } @else {
          @for (group of consolidatedMaterials(); track group.name) {
            <div class="material-group" [class.expanded]="expandedKey() === group.name">
              <button class="material-card" (click)="toggleGroup(group.name)">
                <header class="material-head">
                  <span class="material-tile">
                    <ion-icon name="cube-outline"></ion-icon>
                  </span>
                  <div class="material-info">
                    <h3 class="material-name">{{ group.name }}</h3>
                    <p class="material-site">
                      <ion-icon name="business-outline"></ion-icon>
                      <span class="site-text">{{ group.siteCount }} site{{ group.siteCount === 1 ? '' : 's' }} &bull; {{ group.projectNames.slice(0, 2).join(', ') }}{{ group.projectNames.length > 2 ? ' +' + (group.projectNames.length - 2) : '' }}</span>
                    </p>
                  </div>
                  <ion-icon class="expand-chevron" name="chevron-down-outline"></ion-icon>
                </header>

                <div class="material-badges">
                  <app-status-pill [tone]="getStatusTone(group.status)">{{ group.status }}</app-status-pill>
                  @if (group.lowStock) {
                    <span class="low-stock-flag">
                      <ion-icon name="alert-circle-outline"></ion-icon>
                      Low
                    </span>
                  }
                </div>

                <div class="material-stats">
                  <div class="stat">
                    <div class="stat-label">Requested</div>
                    <div class="stat-value">{{ group.totalRequested }} {{ group.unit }}</div>
                  </div>
                  @if (group.totalApproved > 0) {
                    <div class="stat highlight">
                      <div class="stat-label">Approved</div>
                      <div class="stat-value">{{ group.totalApproved }} {{ group.unit }}</div>
                    </div>
                  }
                  @if (group.totalRemaining > 0) {
                    <div class="stat">
                      <div class="stat-label">On site</div>
                      <div class="stat-value">{{ group.totalRemaining }} {{ group.unit }}</div>
                    </div>
                  }
                </div>

                <footer class="material-footer">
                  <div class="material-date">
                    <ion-icon name="time-outline"></ion-icon>
                    {{ group.items[0].requestDate | date:'MMM d, yyyy' }}
                  </div>
                  <span class="view-link">
                    {{ expandedKey() === group.name ? 'Collapse' : 'View ' + group.items.length + ' entries' }}
                    <ion-icon [name]="expandedKey() === group.name ? 'chevron-down-outline' : 'chevron-forward-outline'"></ion-icon>
                  </span>
                </footer>
              </button>

              @if (expandedKey() === group.name) {
                <div class="group-breakdown">
                  @for (item of group.items; track item._id) {
                    <button class="breakdown-item" (click)="viewMaterial(item)">
                      <div class="breakdown-info">
                        <span class="breakdown-site">{{ item.site }}</span>
                        <span class="breakdown-project">{{ item.projectName }}</span>
                      </div>
                      <div class="breakdown-stats">
                        <span class="breakdown-qty">{{ item.requestedQuantity }} {{ item.unit }}</span>
                        <app-status-pill [tone]="getStatusTone(item.status)">{{ item.status }}</app-status-pill>
                      </div>
                      <ion-icon name="chevron-forward-outline" class="breakdown-chevron"></ion-icon>
                    </button>
                  }
                </div>
              }
            </div>
          }
        }
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="createMaterial()">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .materials-content { --background: var(--m3-surface); }
    .count-chip {
      display: inline-flex; align-items: center;
      background: rgba(0, 34, 99, 0.08);
      color: var(--m3-primary);
      font-size: 11px;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 999px;
    }
    .filter-stack { padding: 0 var(--md-space-4) var(--md-space-2); }
    .search { --background: var(--m3-surface-bright); padding: 0; }
    .seg-wrap { padding: 4px 4px 6px; }

    .cards { padding: var(--md-space-3) var(--md-space-4) 96px; }
    .material-group { margin-bottom: var(--md-space-3); }
    .material-card {
      width: 100%;
      text-align: left;
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-5);
      box-shadow: var(--md-elevation-1);
      cursor: pointer;
      font-family: inherit;
      transition: transform var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  box-shadow var(--md-motion-duration-short1) var(--md-motion-easing-standard);
      display: block;
    }
    .material-group.expanded .material-card {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom: none;
    }
    .material-card:active { transform: scale(0.99); }

    .material-head { display: flex; align-items: center; gap: 14px; margin-bottom: 0; }
    .material-tile {
      width: 48px; height: 48px;
      border-radius: var(--md-radius-lg);
      background: rgba(220, 38, 38, 0.08);
      color: var(--m3-error);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .material-tile ion-icon { font-size: 22px; }
    .material-info { flex: 1; min-width: 0; }
    .material-name { font-size: 16px; font-weight: 700; color: var(--m3-on-surface); margin: 0 0 4px; }
    .material-site {
      font-size: 13px; color: var(--m3-on-surface-muted); margin: 0;
      display: inline-flex; align-items: center; gap: 5px;
      max-width: 100%;
    }
    .material-site ion-icon { font-size: 13px; flex-shrink: 0; }
    .site-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .expand-chevron {
      font-size: 18px;
      color: var(--m3-on-surface-muted);
      transition: transform 200ms ease;
      flex-shrink: 0;
    }
    .material-group.expanded .expand-chevron { transform: rotate(180deg); }

    .material-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: var(--md-space-4);
      margin-top: var(--md-space-2);
    }
    .low-stock-flag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 3px 7px;
      background: rgba(245, 158, 11, 0.14);
      color: #b45309;
      border-radius: 999px;
    }
    .low-stock-flag ion-icon { font-size: 12px; }

    .material-stats {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      background: var(--m3-surface-container);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      padding: 14px 12px;
      margin-bottom: var(--md-space-4);
    }
    .stat { text-align: center; }
    .stat-label { font-size: 11px; color: var(--m3-on-surface-muted); text-transform: uppercase; letter-spacing: 0.3px; }
    .stat-value { font-size: 15px; font-weight: 700; color: var(--m3-on-surface); margin-top: 3px; }
    .stat.highlight .stat-value { color: var(--m3-success); }

    .material-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 2px; }
    .material-date { display: flex; align-items: center; gap: 5px; font-size: 13px; color: var(--m3-on-surface-muted); }
    .material-date ion-icon { font-size: 14px; }
    .view-link { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 700; color: var(--m3-primary); }
    .view-link ion-icon { font-size: 15px; }

    .group-breakdown {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-top: none;
      border-bottom-left-radius: var(--md-radius-xl);
      border-bottom-right-radius: var(--md-radius-xl);
      overflow: hidden;
    }
    .breakdown-item {
      width: 100%;
      display: flex; align-items: center; gap: 12px;
      padding: var(--md-space-4) var(--md-space-5);
      border-bottom: 1px solid var(--m3-outline-variant);
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      transition: background 120ms ease;
    }
    .breakdown-item:last-child { border-bottom: none; }
    .breakdown-item:active { background: var(--m3-surface-container); }
    .breakdown-info { flex: 1; min-width: 0; text-align: left; }
    .breakdown-site { display: block; font-size: 14px; font-weight: 600; color: var(--m3-on-surface); }
    .breakdown-project { font-size: 12px; color: var(--m3-on-surface-muted); margin-top: 2px; }
    .breakdown-stats { display: flex; align-items: center; gap: 10px; }
    .breakdown-qty { font-size: 14px; font-weight: 600; color: var(--m3-on-surface); }
    .breakdown-chevron { font-size: 16px; color: var(--m3-on-surface-muted); }

    .skeleton-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-2);
    }
    ion-fab-button { --background: var(--m3-primary); --color: var(--m3-on-primary); }
  `],
})
export class MaterialsPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);

  materials = signal<Material[]>([]);
  consolidatedMaterials = signal<ConsolidatedMaterial[]>([]);
  isLoading = signal(true);
  expandedKey = signal<string>('');
  searchQuery = '';
  statusFilter: MaterialStatus | '' = '';

  async ngOnInit(): Promise<void> {
    addIcons({
      addOutline, cubeOutline, filterOutline, timeOutline, checkmarkCircleOutline,
      closeCircleOutline, chevronForwardOutline, chevronDownOutline, businessOutline,
    });
    await this.loadMaterials();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:site-changed', this.handleSiteChange);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:site-changed', this.handleSiteChange);
    }
  }

  private handleSiteChange = (): void => {
    void this.loadMaterials();
  };

  async loadMaterials(): Promise<void> {
    this.isLoading.set(true);
    try {
      const siteId = this.supervisor.selectedSiteId();
      const projectId = this.supervisor.selectedProjectId();
      this.supervisor
        .getMaterials({
          siteId: siteId || undefined,
          projectId: projectId || undefined,
          limit: 100,
        })
        .subscribe({
          next: (response) => {
            this.materials.set(response.materials || []);
            this.filterMaterials();
            this.isLoading.set(false);
          },
          error: (err) => {
            console.error('[Materials] failed to load', err);
            this.filterMaterials();
            this.isLoading.set(false);
          },
        });
    } catch (error) {
      console.error('Failed to load materials:', error);
      this.isLoading.set(false);
    }
  }

  async refreshMaterials(event: CustomEvent): Promise<void> {
    await this.loadMaterials();
    (event.target as HTMLIonRefresherElement).complete();
  }

  filterMaterials(): void {
    let filtered = this.materials();
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.site.toLowerCase().includes(query) ||
          m.projectName.toLowerCase().includes(query) ||
          m.vendor?.toLowerCase().includes(query)
      );
    }
    if (this.statusFilter) {
      filtered = filtered.filter((m) => m.status === this.statusFilter);
    }
    const groups = this.consolidateByName(filtered);
    this.consolidatedMaterials.set(groups);
  }

  private consolidateByName(materials: Material[]): ConsolidatedMaterial[] {
    const map = new Map<string, ConsolidatedMaterial>();

    for (const m of materials) {
      if (!m.name) continue;
      const existing = map.get(m.name);
      if (existing) {
        existing.totalRequested += m.requestedQuantity ?? 0;
        existing.totalApproved += m.approvedQuantity ?? 0;
        existing.totalRemaining += m.remainingStock ?? 0;
        if (!existing.projectNames.includes(m.projectName)) {
          existing.projectNames.push(m.projectName);
        }
        existing.siteCount += 1;
        existing.status = this.worstStatus(existing.status, m.status);
        existing.items.push(m);
        existing.lowStock = existing.totalApproved > 0 && existing.totalRemaining < existing.totalApproved * 0.7;
      } else {
        const lowStock = (m.approvedQuantity ?? 0) > 0 && (m.remainingStock ?? 0) < (m.approvedQuantity ?? 0) * 0.7;
        map.set(m.name, {
          name: m.name,
          unit: m.unit,
          totalRequested: m.requestedQuantity ?? 0,
          totalApproved: m.approvedQuantity ?? 0,
          totalRemaining: m.remainingStock ?? 0,
          siteCount: 1,
          projectNames: [m.projectName],
          status: m.status,
          items: [m],
          lowStock,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.items[0].requestDate).getTime() - new Date(a.items[0].requestDate).getTime()
    );
  }

  private worstStatus(current: MaterialStatus, next: MaterialStatus): MaterialStatus {
    const priority: Record<MaterialStatus, number> = {
      'Rejected': 0,
      'Pending': 1,
      'Not Received': 2,
      'Received': 3,
      'Completed': 4,
      'Approved': 5,
    };
    return (priority[next] ?? 9) < (priority[current] ?? 9) ? next : current;
  }

  toggleGroup(name: string): void {
    if (this.expandedKey() === name) {
      this.expandedKey.set('');
    } else {
      this.expandedKey.set(name);
    }
  }

  viewMaterial(material: Material): void {
    this.router.navigate(['/tabs/materials', material._id]);
  }

  createMaterial(): void {
    this.router.navigate(['/tabs/materials/create']);
  }

  getStatusTone(status: MaterialStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'Pending': return 'warning';
      case 'Approved': return 'success';
      case 'Rejected': return 'danger';
      default: return 'neutral';
    }
}
}
