import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonFab,
  IonFabButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonButton,
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
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Material, MaterialStatus } from '../../shared/models';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonBadge,
    IonFab,
    IonFabButton,
    IonIcon,
    IonCard,
    IonCardContent,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonButtons,
    IonButton,
    DatePipe,
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar>
        <ion-title>Materials</ion-title>
        <ion-buttons slot="end">
          <ion-button>
            <ion-icon name="filter-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Search materials..." [(ngModel)]="searchQuery" (ionInput)="filterMaterials()"></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar>
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
      </ion-toolbar>
    </ion-header>

    <ion-content class="materials-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshMaterials($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (isLoading() && materials().length === 0) {
        @for (i of [1,2,3,4]; track i) {
          <ion-card class="material-card skeleton">
            <ion-card-content>
              <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 40%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </ion-card-content>
          </ion-card>
        }
      } @else if (filteredMaterials().length === 0) {
        <div class="empty-state">
          <ion-icon name="cube-outline"></ion-icon>
          <h3>No Materials Found</h3>
          <p>
            @if (searchQuery || statusFilter) {
              No materials match your filters
            } @else {
              Create a material request to get started
            }
          </p>
        </div>
      } @else {
        @for (material of filteredMaterials(); track material.materialId) {
          <ion-card class="material-card" (click)="viewMaterial(material)">
            <ion-card-content>
              <div class="material-header">
                <div class="material-info">
                  <h3 class="material-name">{{ material.name }}</h3>
                  <p class="material-site">{{ material.site }} • {{ material.projectName }}</p>
                </div>
                <ion-badge [color]="getStatusColor(material.status)">
                  {{ material.status }}
                </ion-badge>
              </div>

              <div class="material-details">
                <div class="detail-item">
                  <span class="detail-label">Quantity</span>
                  <span class="detail-value">{{ material.requestedQuantity }} {{ material.unit }}</span>
                </div>
                @if (material.approvedQuantity > 0) {
                  <div class="detail-item">
                    <span class="detail-label">Approved</span>
                    <span class="detail-value approved">{{ material.approvedQuantity }} {{ material.unit }}</span>
                  </div>
                }
                @if (material.vendor) {
                  <div class="detail-item full-width">
                    <span class="detail-label">Vendor</span>
                    <span class="detail-value">{{ material.vendor }}</span>
                  </div>
                }
              </div>

              <div class="material-footer">
                <div class="material-date">
                  <ion-icon name="time-outline"></ion-icon>
                  {{ material.requestDate | date:'MMM d, yyyy' }}
                </div>
                @if (material.status === 'Pending') {
                  <ion-badge class="action-badge" color="warning">
                    <ion-icon name="time-outline"></ion-icon>
                    Awaiting Approval
                  </ion-badge>
                }
              </div>
            </ion-card-content>
          </ion-card>
        }
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="createMaterial()">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .agb-header {
      --background: var(--agb-white);
    }
    .materials-content {
      --background: var(--agb-off-white);
    }
    .material-card {
      margin: 12px 16px;
      transition: all var(--agb-transition-fast);
    }
    .material-card:active {
      transform: scale(0.98);
    }
    .material-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .material-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--agb-navy);
      margin: 0 0 4px;
    }
    .material-site {
      font-size: 13px;
      color: var(--agb-gray);
      margin: 0;
    }
    .material-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 12px;
      padding: 12px;
      background: var(--agb-off-white);
      border-radius: var(--agb-radius-md);
    }
    .detail-item {
      display: flex;
      flex-direction: column;
    }
    .detail-item.full-width {
      grid-column: span 2;
    }
    .detail-label {
      font-size: 11px;
      color: var(--agb-gray);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .detail-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--agb-navy);
    }
    .detail-value.approved {
      color: var(--agb-success);
    }
    .material-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .material-date {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--agb-gray);
    }
    .material-date ion-icon {
      font-size: 14px;
    }
    .action-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 32px;
      text-align: center;
    }
    .empty-state ion-icon {
      font-size: 64px;
      color: var(--agb-light-gray);
      margin-bottom: 16px;
    }
    .empty-state h3 {
      font-size: 18px;
      font-weight: 600;
      color: var(--agb-navy);
      margin: 0 0 8px;
    }
    .empty-state p {
      font-size: 14px;
      color: var(--agb-gray);
      margin: 0;
    }
    .skeleton {
      margin: 12px 16px;
    }
    ion-fab-button {
      --background: var(--agb-primary);
      --color: var(--agb-white);
    }
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
    addIcons({ addOutline, cubeOutline, filterOutline, timeOutline, checkmarkCircleOutline, closeCircleOutline });
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
      const projectId = this.supervisor.selectedProjectId();
      this.supervisor
        .getMaterials({ projectId: projectId ?? undefined, limit: 100 })
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

  getStatusColor(status: MaterialStatus): string {
    switch (status) {
      case 'Pending': return 'warning';
      case 'Approved': return 'success';
      case 'Rejected': return 'danger';
      default: return 'medium';
    }
  }

  /**
   * Total material count for the header. Falls back to the array length when
   * the backend omits the pagination object.
   */
  totalCount = (): number => {
    const total = (this.materials() || []).length;
    return total;
  };
}