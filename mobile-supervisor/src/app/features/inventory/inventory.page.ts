import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import {
  IonContent,
  IonSearchbar,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  gridOutline,
  searchOutline,
  addOutline,
  chevronDownOutline,
  timeOutline,
  businessOutline,
  documentTextOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  pencilOutline,
  closeOutline,
  swapVerticalOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Material, MaterialStatus } from '../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { PageHeaderComponent, EmptyStateComponent } from '../../shared/components';
import { InventoryEditModalComponent } from './inventory-edit-modal/inventory-edit-modal.component';
import { InventoryRequestModalComponent } from './inventory-request-modal/inventory-request-modal.component';

export interface InventoryItem {
  _id: string;
  materialId: string;
  name: string;
  category: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  lastUpdated: string;
  vendor: string;
  poNumber: string;
  status: MaterialStatus;
  projectId: string;
  projectName: string;
  siteId: string;
  site: string;
}

type SortField = 'name' | 'currentQuantity' | 'lastUpdated' | 'vendor';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonSearchbar,
    IonFab,
    IonFabButton,
    IonIcon,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    DatePipe,
    CurrencyPipe,
    PageHeaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <ion-content class="inventory-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshInventory($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <app-page-header
        title="Inventory"
        subtitle="Current stock at your site"
      >
        <span actions class="count-chip">{{ filteredItems().length }} item{{ filteredItems().length === 1 ? '' : 's' }}</span>
      </app-page-header>

      <div class="filter-stack">
        <ion-searchbar
          placeholder="Search materials..."
          [(ngModel)]="searchQuery"
          (ionInput)="applyFilters()"
          class="search-bar"
       />

        <div class="filter-row">
          <button class="sort-btn" (click)="cycleSort()">
            <ion-icon name="swap-vertical-outline"></ion-icon>
            <span>{{ sortLabel() }}</span>
          </button>
        </div>
      </div>

      <div class="inventory-list">
        @if (isLoading() && items().length === 0) {
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width: 55%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 75%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 40%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </div>
          }
        } @else if (filteredItems().length === 0) {
          <app-empty-state
            icon="grid-outline"
            [title]="searchQuery ? 'No matches found' : 'No inventory yet'"
            [message]="searchQuery
              ? 'Try adjusting your search.'
              : 'Approved materials will appear here as inventory.'"
          ></app-empty-state>
        } @else {
          @for (item of filteredItems(); track item.materialId) {
            <div class="inventory-card" [class.low-stock]="item.currentQuantity <= item.minimumQuantity">
              <header class="card-header">
                <div class="material-icon" [class.low]="item.currentQuantity <= item.minimumQuantity">
                  <ion-icon name="cube-outline"></ion-icon>
                </div>
                <div class="material-info">
                  <h3 class="material-name">{{ item.name }}</h3>
                  <p class="material-meta">
                    <ion-icon name="business-outline"></ion-icon>
                    {{ item.site }}
                  </p>
                </div>
                @if (item.currentQuantity <= item.minimumQuantity) {
                  <div class="low-stock-badge">
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    Low Stock
                  </div>
                }
              </header>

              <div class="quantity-section">
                <div class="qty-main">
                  <span class="qty-value">{{ item.currentQuantity }}</span>
                  <span class="qty-unit">{{ item.unit }}</span>
                </div>
                <div class="qty-meta">
                  <span class="qty-min">Min: {{ item.minimumQuantity }} {{ item.unit }}</span>
                  <button class="edit-qty-btn" (click)="openEditQuantity(item)">
                    <ion-icon name="pencil-outline"></ion-icon>
                    Update
                  </button>
                </div>
              </div>

              <div class="card-details">
                @if (item.vendor) {
                  <div class="detail-row">
                    <span class="detail-label">Vendor</span>
                    <span class="detail-value">{{ item.vendor }}</span>
                  </div>
                }
                @if (item.poNumber) {
                  <div class="detail-row">
                    <span class="detail-label">PO Number</span>
                    <span class="detail-value po-value">{{ item.poNumber }}</span>
                  </div>
                }
                <div class="detail-row">
                  <span class="detail-label">Last Updated</span>
                  <span class="detail-value">{{ item.lastUpdated | date:'MMM d, yyyy' }}</span>
                </div>
              </div>

              <footer class="card-footer">
                <button class="request-btn" (click)="raiseRequest(item)">
                  <ion-icon name="add-outline"></ion-icon>
                  Raise Request
                </button>
              </footer>
            </div>
          }
        }
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="raiseRequest(null)">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .inventory-content { --background: var(--m3-surface); }

    .count-chip {
      display: inline-flex;
      align-items: center;
      background: rgba(0, 34, 99, 0.08);
      color: var(--m3-primary);
      font-size: 11px;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 999px;
    }

    .filter-stack {
      padding: 0 var(--md-space-4) var(--md-space-3);
    }

    .search-bar {
      --background: var(--m3-surface-bright);
      --border-radius: var(--md-radius-xl);
      --box-shadow: var(--md-elevation-1);
      padding: 0;
      margin-bottom: var(--md-space-2);
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
    }

    .seg-wrap {
      flex: 1;
      min-width: 0;
      padding: 0;
    }

    .sort-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--md-space-1);
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      padding: 8px var(--md-space-3);
      font-size: 12px;
      font-weight: 600;
      color: var(--m3-on-surface-variant);
      cursor: pointer;
      flex-shrink: 0;
      font-family: inherit;
      transition: background var(--md-motion-duration-short1) var(--md-motion-easing-standard);
    }
    .sort-btn:active { background: var(--m3-surface-container); }
    .sort-btn ion-icon { font-size: 14px; }

    .inventory-list {
      padding: var(--md-space-2) var(--md-space-4) 96px;
    }

    .inventory-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-3);
      box-shadow: var(--md-elevation-1);
      transition: box-shadow var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  transform var(--md-motion-duration-short1) var(--md-motion-easing-standard);
    }
    .inventory-card:active { transform: scale(0.99); }
    .inventory-card.low-stock {
      border-left: 3px solid var(--m3-warning);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      gap: var(--md-space-3);
      margin-bottom: var(--md-space-4);
    }

    .material-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--md-radius-lg);
      background: rgba(0, 34, 99, 0.08);
      color: var(--m3-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .material-icon.low {
      background: var(--m3-warning-container);
      color: var(--m3-warning);
    }
    .material-icon ion-icon { font-size: 22px; }

    .material-info { flex: 1; min-width: 0; }
    .material-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 4px;
    }
    .material-meta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      margin: 0;
    }
    .material-meta ion-icon { font-size: 12px; }

    .low-stock-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--m3-warning-container);
      color: var(--m3-on-warning-container);
      font-size: 10px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: var(--md-radius-sm);
      flex-shrink: 0;
    }
    .low-stock-badge ion-icon { font-size: 12px; }

    .quantity-section {
      background: var(--m3-surface-container);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-3);
    }

    .qty-main {
      display: flex;
      align-items: baseline;
      gap: var(--md-space-2);
      margin-bottom: var(--md-space-2);
    }
    .qty-value {
      font-size: 28px;
      font-weight: 800;
      color: var(--m3-on-surface);
      line-height: 1;
    }
    .qty-unit {
      font-size: 14px;
      font-weight: 600;
      color: var(--m3-on-surface-muted);
    }

    .qty-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .qty-min {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
    }

    .edit-qty-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-md);
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-primary);
      cursor: pointer;
      font-family: inherit;
      transition: background var(--md-motion-duration-short1);
    }
    .edit-qty-btn:active { background: var(--m3-surface-container-high); }
    .edit-qty-btn ion-icon { font-size: 12px; }

    .card-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--md-space-2);
      padding: var(--md-space-3) 0;
      border-top: 1px solid var(--m3-outline-variant);
      border-bottom: 1px solid var(--m3-outline-variant);
      margin-bottom: var(--md-space-3);
    }
    .detail-row { display: flex; flex-direction: column; gap: 2px; }
    .detail-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-value {
      font-size: 13px;
      font-weight: 600;
      color: var(--m3-on-surface);
    }
    .detail-value.po-value {
      font-family: var(--m3-font-mono);
      font-size: 12px;
      color: var(--m3-success);
    }

    .card-footer {
      display: flex;
      justify-content: flex-end;
    }

    .request-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--md-space-1);
      background: var(--m3-primary);
      color: var(--m3-on-primary);
      border: none;
      border-radius: var(--md-radius-lg);
      padding: 10px var(--md-space-4);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: box-shadow var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  transform var(--md-motion-duration-short1) var(--md-motion-easing-standard);
    }
    .request-btn:active { transform: scale(0.98); }
    .request-btn ion-icon { font-size: 16px; }

    .skeleton-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-3);
    }

    ion-fab-button { --background: var(--m3-primary); --color: var(--m3-on-primary); }
  `],
})
export class InventoryPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);

  items = signal<InventoryItem[]>([]);
  isLoading = signal(true);
  searchQuery = '';
  sortField = signal<SortField>('name');
  sortDir = signal<SortDir>('asc');

  filteredItems = computed(() => {
    let result = [...this.items()];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.vendor?.toLowerCase().includes(q) ||
          i.poNumber?.toLowerCase().includes(q) ||
          i.site.toLowerCase().includes(q)
      );
    }

    const field = this.sortField();
    const dir = this.sortDir();
    result.sort((a, b) => {
      let cmp = 0;
      if (field === 'name') cmp = a.name.localeCompare(b.name);
      else if (field === 'currentQuantity') cmp = a.currentQuantity - b.currentQuantity;
      else if (field === 'lastUpdated') cmp = a.lastUpdated.localeCompare(b.lastUpdated);
      else if (field === 'vendor') cmp = (a.vendor || '').localeCompare(b.vendor || '');
      return dir === 'asc' ? cmp : -cmp;
    });

    return result;
  });

  sortLabel = computed(() => {
    const map: Record<SortField, string> = {
      name: 'Name',
      currentQuantity: 'Qty',
      lastUpdated: 'Updated',
      vendor: 'Vendor',
    };
    const field = this.sortField();
    return `${map[field]} ${this.sortDir() === 'asc' ? '↑' : '↓'}`;
  });

  async ngOnInit(): Promise<void> {
    addIcons({
      gridOutline, searchOutline, addOutline,
      chevronDownOutline, timeOutline, businessOutline, documentTextOutline,
      checkmarkCircleOutline, alertCircleOutline, pencilOutline, closeOutline,
      swapVerticalOutline,
    });
    await this.supervisor.init();
    await this.loadInventory();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:site-changed', this.handleSiteChange);
      window.addEventListener('agb:inventory-changed', this.handleInventoryChange);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:site-changed', this.handleSiteChange);
      window.removeEventListener('agb:inventory-changed', this.handleInventoryChange);
    }
  }

  private handleSiteChange = (): void => {
    void this.loadInventory();
  };

  private handleInventoryChange = (): void => {
    void this.loadInventory();
  };

  async loadInventory(): Promise<void> {
    this.isLoading.set(true);
    const siteId = this.supervisor.selectedSiteId();
    const projectId = this.supervisor.selectedProjectId();

    try {
      this.supervisor.getMaterials({
        siteId: siteId || undefined,
        projectId: projectId || undefined,
        status: 'Approved',
        limit: 200,
      }).subscribe({
        next: (res) => {
          const materials: InventoryItem[] = (res.materials || []).map((m) => ({
            _id: m._id,
            materialId: m.materialId,
            name: m.name,
            category: (m as any).category || 'General',
            unit: m.unit,
            currentQuantity: m.remainingStock ?? m.approvedQuantity ?? 0,
            minimumQuantity: (m as any).minimumQuantity || 0,
            lastUpdated: m.updatedAt || m.requestDate,
            vendor: m.vendor || '',
            poNumber: m.poNumber || '',
            status: m.status,
            projectId: m.projectId,
            projectName: m.projectName,
            siteId: m.siteId || '',
            site: m.site,
          }));
          this.items.set(materials);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[Inventory] failed to load', err);
          this.isLoading.set(false);
        },
      });
    } catch {
      this.isLoading.set(false);
    }
  }

  async refreshInventory(event: CustomEvent): Promise<void> {
    await this.loadInventory();
    (event.target as HTMLIonRefresherElement).complete();
  }

  applyFilters(): void {
    // triggers computed recompute via signal dependency
  }

  cycleSort(): void {
    const fields: SortField[] = ['name', 'currentQuantity', 'lastUpdated', 'vendor'];
    const idx = fields.indexOf(this.sortField());
    const next = fields[(idx + 1) % fields.length];
    if (next === this.sortField()) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(next);
      this.sortDir.set('asc');
    }
  }

  async openEditQuantity(item: InventoryItem): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: InventoryEditModalComponent,
      componentProps: { item },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.updated) {
      await this.loadInventory();
    }
  }

  async raiseRequest(item: InventoryItem | null): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: InventoryRequestModalComponent,
      componentProps: { preSelected: item },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.requested) {
      await this.loadInventory();
      const toast = await this.toastCtrl.create({
        message: 'Material request submitted successfully',
        duration: 2500,
        color: 'success',
        position: 'top',
      });
      await toast.present();
    }
  }
}
