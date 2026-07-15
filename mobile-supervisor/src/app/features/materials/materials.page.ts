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
        <span actions class="count-chip">{{ filteredMaterials().length }} item{{ filteredMaterials().length === 1 ? '' : 's' }}</span>
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
        } @else if (filteredMaterials().length === 0) {
          <app-empty-state
            icon="cube-outline"
            [title]="searchQuery || statusFilter ? 'No matches' : 'No materials yet'"
            [message]="searchQuery || statusFilter
              ? 'No materials match your filters. Try clearing them.'
              : 'Create a material request to get started.'"
          ></app-empty-state>
        } @else {
          @for (material of filteredMaterials(); track material.materialId) {
            <button class="material-card" (click)="viewMaterial(material)">
              <header class="material-head">
                <span class="material-tile">
                  <ion-icon name="cube-outline"></ion-icon>
                </span>
                <div class="material-info">
                  <h3 class="material-name">{{ material.name }}</h3>
                  <p class="material-site">
                    <ion-icon name="business-outline"></ion-icon>
                    {{ material.site }} - {{ material.projectName }}
                  </p>
                </div>
                <app-status-pill [tone]="getStatusTone(material.status)">{{ material.status }}</app-status-pill>
              </header>

              <div class="material-stats">
                <div class="stat">
                  <div class="stat-label">Requested</div>
                  <div class="stat-value">{{ material.requestedQuantity }} {{ material.unit }}</div>
                </div>
                @if (material.approvedQuantity > 0) {
                  <div class="stat highlight">
                    <div class="stat-label">Approved</div>
                    <div class="stat-value">{{ material.approvedQuantity }} {{ material.unit }}</div>
                  </div>
                }
                @if (material.remainingStock !== undefined) {
                  <div class="stat">
                    <div class="stat-label">On site</div>
                    <div class="stat-value">{{ material.remainingStock }} {{ material.unit }}</div>
                  </div>
                }
              </div>

              @if (material.poNumber) {
                <div class="material-po">
                  <ion-icon name="document-text-outline"></ion-icon>
                  <span class="po-label">PO Number</span>
                  <span class="po-value">{{ material.poNumber }}</span>
                </div>
              }

              <footer class="material-footer">
                <div class="material-date">
                  <ion-icon name="time-outline"></ion-icon>
                  {{ material.requestDate | date:'MMM d, yyyy' }}
                </div>
                <span class="view-link">
                  View
                  <ion-icon name="chevron-forward-outline"></ion-icon>
                </span>
              </footer>
            </button>
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
    .material-card {
      width: 100%;
      text-align: left;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 16px;
      margin-bottom: 10px;
      box-shadow: var(--agb-shadow-2xs);
      cursor: pointer;
      font-family: inherit;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
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

    .material-po {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(22, 163, 74, 0.08);
      border: 1px solid rgba(22, 163, 74, 0.2);
      color: #15803d;
      font-size: 12px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 999px;
      margin-bottom: 10px;
    }
    .material-po ion-icon { font-size: 13px; }
    .material-po .po-label { font-weight: 500; opacity: 0.8; }
    .material-po .po-value { font-weight: 700; }

    .material-footer { display: flex; align-items: center; justify-content: space-between; }
    .material-date { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .material-date ion-icon { font-size: 13px; }
    .view-link { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; color: #002263; }
    .view-link ion-icon { font-size: 14px; }

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
  filteredMaterials = signal<Material[]>([]);
  isLoading = signal(true);
  searchQuery = '';
  statusFilter: MaterialStatus | '' = '';

  async ngOnInit(): Promise<void> {
    addIcons({
      addOutline, cubeOutline, filterOutline, timeOutline, checkmarkCircleOutline,
      closeCircleOutline, chevronForwardOutline, businessOutline,
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
            this.materials.set([]);
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
    this.filteredMaterials.set(filtered);
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
