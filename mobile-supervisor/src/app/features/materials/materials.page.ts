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
                      {{ group.siteCount }} site{{ group.siteCount === 1 ? '' : 's' }} &bull; {{ group.projectNames.slice(0, 2).join(', ') }}{{ group.projectNames.length > 2 ? ' +' + (group.projectNames.length - 2) : '' }}
                    </p>
                  </div>
                  <app-status-pill [tone]="getStatusTone(group.status)">{{ group.status }}</app-status-pill>
                  <ion-icon class="expand-chevron" name="chevron-down-outline"></ion-icon>
                </header>

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
    .materials-content { --background: #f5f6f8; }
    .count-chip {
      display: inline-flex; align-items: center;
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 999px;
    }
    .filter-stack { padding: 0 16px 8px; }
    .search { --background: #ffffff; padding: 0; }
    .seg-wrap { padding: 4px 4px 8px; }

    .cards { padding: 8px 16px 96px; }
    .material-group { margin-bottom: 10px; }
    .material-card {
      width: 100%;
      text-align: left;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      cursor: pointer;
      font-family: inherit;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
      display: block;
    }
    .material-group.expanded .material-card {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom: none;
    }
    .material-card:active { transform: scale(0.99); }
    .material-card:hover { box-shadow: var(--agb-shadow-sm); }

    .material-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
    .material-tile {
      width: 44px; height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(220, 38, 38, 0.10), rgba(220, 38, 38, 0.04));
      color: #b91c1c;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .material-tile ion-icon { font-size: 20px; }
    .material-info { flex: 1; min-width: 0; }
    .material-name { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
    .material-site { font-size: 12px; color: #64748b; margin: 0; display: inline-flex; align-items: center; gap: 4px; }
    .material-site ion-icon { font-size: 12px; }
    .expand-chevron {
      font-size: 16px;
      color: #94a3b8;
      transition: transform 200ms ease;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .material-group.expanded .expand-chevron { transform: rotate(180deg); }

    .material-stats {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .stat { text-align: center; }
    .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
    .stat-value { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .stat.highlight .stat-value { color: #16a34a; }

    .material-footer { display: flex; align-items: center; justify-content: space-between; }
    .material-date { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .material-date ion-icon { font-size: 13px; }
    .view-link { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; color: #002263; }
    .view-link ion-icon { font-size: 14px; }

    .group-breakdown {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-top: none;
      border-bottom-left-radius: 20px;
      border-bottom-right-radius: 20px;
      overflow: hidden;
      box-shadow: var(--agb-shadow-2xs);
    }
    .breakdown-item {
      width: 100%;
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      transition: background 120ms ease;
    }
    .breakdown-item:last-child { border-bottom: none; }
    .breakdown-item:active { background: #f8fafc; }
    .breakdown-info { flex: 1; min-width: 0; text-align: left; }
    .breakdown-site { display: block; font-size: 13px; font-weight: 600; color: #0f172a; }
    .breakdown-project { font-size: 11px; color: #64748b; }
    .breakdown-stats { display: flex; align-items: center; gap: 8px; }
    .breakdown-qty { font-size: 13px; font-weight: 600; color: #0f172a; }
    .breakdown-chevron { font-size: 14px; color: #94a3b8; }

    .skeleton-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 10px;
    }
    ion-fab-button { --background: #002263; --color: #ffffff; }
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
      this.supervisor
        .getMaterials({
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
      } else {
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
