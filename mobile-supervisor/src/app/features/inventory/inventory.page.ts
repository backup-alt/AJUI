import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  IonContent,
  IonSearchbar,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonFab,
  IonFabButton,
  IonSelect,
  IonSelectOption,
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
  close,
  swapVerticalOutline,
  cloudOfflineOutline,
  refreshOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Material, MaterialStatus } from '../../shared/models';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { PageHeaderComponent, EmptyStateComponent } from '../../shared/components';
import { InventoryEditModalComponent } from './inventory-edit-modal/inventory-edit-modal.component';
import { InventoryRequestModalComponent } from './inventory-request-modal/inventory-request-modal.component';
import { InventoryActionSheetComponent } from './inventory-action-sheet/inventory-action-sheet.component';

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
  billUrl?: string;
  purchaseHistory?: Array<{
    vendor: string;
    quantity: number;
    date: string;
    materialId?: string;
    billUrl?: string;
  }>;
}

type SortField = 'name' | 'currentQuantity' | 'lastUpdated' | 'vendor';
type SortDir = 'asc' | 'desc';
type InventoryStockFilter = 'all' | 'available' | 'low' | 'out';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonSearchbar,
    IonFab,
    IonFabButton,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    DatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <ion-content class="inventory-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshInventory($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <app-page-header
        title="Materials"
        subtitle="Current material stock at your site"
      >
        <span actions class="count-chip">{{ filteredItems().length }} item{{ filteredItems().length === 1 ? '' : 's' }}</span>
      </app-page-header>

      <div class="filter-stack">
        <ion-searchbar
          placeholder="Search materials..."
          [ngModel]="searchQuery()"
          (ngModelChange)="onSearchChange($event)"
          class="search-bar"
       />

        <div class="filter-row">
          <ion-select
            class="stock-filter"
            aria-label="Stock filter"
            interface="popover"
            [ngModel]="stockFilter()"
            (ionChange)="onStockFilterChange($event.detail.value)"
          >
            <ion-select-option value="all">All stock</ion-select-option>
            <ion-select-option value="available">Available</ion-select-option>
            <ion-select-option value="low">Low stock</ion-select-option>
            <ion-select-option value="out">Out of stock</ion-select-option>
          </ion-select>
          <button class="sort-btn" (click)="cycleSort()">
            <ion-icon name="swap-vertical-outline"></ion-icon>
            <span>{{ sortLabel() }}</span>
          </button>
        </div>
      </div>

      <div class="inventory-list">
        @if (errorMessage()) {
          <div class="error-state">
            <ion-icon name="cloud-offline-outline" class="error-icon"></ion-icon>
            <span class="error-title">Something went wrong</span>
            <span class="error-text">{{ errorMessage() }}</span>
            <button class="retry-btn" (click)="loadInventory()">
              <ion-icon name="refresh-outline"></ion-icon>
              Retry
            </button>
          </div>
        } @else if (isLoading() && items().length === 0) {
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
            [title]="searchQuery() ? 'No matches found' : 'No materials yet'"
            [message]="searchQuery()
              ? 'Try adjusting your search.'
              : 'Approved stock will appear here as materials.'"
          ></app-empty-state>
        } @else {
          @for (item of filteredItems(); track item.materialId) {
            <div class="inventory-card" [class.low-stock]="item.currentQuantity <= item.minimumQuantity" (click)="openDetail(item._id)">
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
                  <button class="edit-qty-btn" (click)="openEditQuantity(item); $event.stopPropagation()">
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

              @if (item.purchaseHistory && item.purchaseHistory.length > 0) {
                <div class="vendor-history">
                  <div class="vendor-history-header">
                    <ion-icon name="time-outline"></ion-icon>
                    <span>Vendor History</span>
                  </div>
                  @for (entry of item.purchaseHistory; track $index) {
                    <div class="vendor-history-entry">
                      <span class="vh-vendor">{{ entry.vendor || 'Unknown' }}</span>
                      <span class="vh-qty">{{ entry.quantity }} {{ item.unit }}</span>
                      <span class="vh-date">{{ entry.date | date:'MMM d, yyyy' }}</span>
                      @if (entry.billUrl) {
                        <button class="vh-bill-btn" (click)="openBillViewer(entry.billUrl!); $event.stopPropagation()">
                          <ion-icon name="document-text-outline"></ion-icon>
                          View Bill
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              <footer class="card-footer">
                <button class="request-btn" (click)="raiseRequest(item); $event.stopPropagation()">
                  <ion-icon name="add-outline"></ion-icon>
                  Raise Request
                </button>
              </footer>
            </div>
          }
        }
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="showInventoryActions()">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <ion-infinite-scroll
        threshold="160px"
        [disabled]="!nextCursor() || isLoading() || isLoadingMore()"
        (ionInfinite)="loadMoreInventory($event)"
      >
        <ion-infinite-scroll-content loadingSpinner="dots"></ion-infinite-scroll-content>
      </ion-infinite-scroll>

      @if (viewerUrl()) {
        <div class="bill-viewer-overlay" (click)="closeBillViewer($event)">
          <button class="bill-viewer-close" (click)="closeBillViewer($event)">
            <ion-icon name="close"></ion-icon>
          </button>
          <div class="bill-viewer-img-wrap"
               (touchstart)="onPinchStart($event)"
               (touchmove)="onPinchMove($event)"
               (touchend)="onPinchEnd($event)"
               (touchcancel)="onPinchEnd($event)"
               (mousedown)="onDragStart($event)"
               (mousemove)="onDragMove($event)"
               (mouseup)="onDragEnd()"
               (mouseleave)="onDragEnd()"
               (dblclick)="toggleZoom($event)">
            <img [src]="viewerUrl()" alt="Bill" class="bill-viewer-img"
                 [style.transform]="'translate(' + panX + 'px,' + panY + 'px) scale(' + zoomScale + ')'"
                 (dragstart)="$event.preventDefault()" />
          </div>
        </div>
      }
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

    .stock-filter {
      flex: 1;
      min-width: 0;
      min-height: 38px;
      --background: var(--m3-surface-bright);
      --padding-start: var(--md-space-3);
      --padding-end: var(--md-space-3);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      font-size: 12px;
      color: var(--m3-on-surface-variant);
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
      cursor: pointer;
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

    .vendor-history {
      margin-top: var(--md-space-3);
      padding-top: var(--md-space-3);
      border-top: 1px solid var(--m3-outline-variant);
    }
    .vendor-history-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--md-space-2);
    }
    .vendor-history-header ion-icon { font-size: 14px; }
    .vendor-history-entry {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px solid var(--m3-outline-variant);
    }
    .vendor-history-entry:last-child { border-bottom: none; }
    .vh-vendor {
      font-size: 13px;
      font-weight: 600;
      color: var(--m3-on-surface);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .vh-qty {
      font-size: 13px;
      font-weight: 700;
      color: var(--m3-primary);
      flex-shrink: 0;
    }
    .vh-date {
      font-size: 11px;
      color: var(--m3-on-surface-muted);
      flex-shrink: 0;
    }

    .vh-bill-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: var(--md-radius-pill);
      background: rgba(0, 34, 99, 0.06);
      color: var(--m3-primary);
      border: 1px solid rgba(0, 34, 99, 0.15);
      font-size: 11px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
      flex-shrink: 0;
    }
    .vh-bill-btn:active { background: rgba(0, 34, 99, 0.12); }
    .vh-bill-btn ion-icon { font-size: 12px; }

    .skeleton-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-3);
    }

    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--md-space-8) var(--md-space-4);
      text-align: center;
    }
    .error-icon { font-size: 48px; color: var(--m3-error); opacity: 0.7; margin-bottom: var(--md-space-3); }
    .error-title { font-size: 16px; font-weight: 700; color: var(--m3-on-surface); margin-bottom: var(--md-space-1); }
    .error-text { font-size: 13px; color: var(--m3-on-surface-muted); margin-bottom: var(--md-space-4); max-width: 280px; }
    .retry-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 20px; border-radius: var(--md-radius-pill);
      background: var(--m3-primary); color: var(--m3-on-primary);
      border: none; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .retry-btn ion-icon { font-size: 16px; }

    ion-fab-button { --background: var(--m3-primary); --color: var(--m3-on-primary); }

    :host ::ng-deep .action-sheet-modal {
      --backdrop-opacity: 0;
      --width: 100%;
      --max-width: 480px;
      --height: auto;
      --border-radius: var(--md-radius-2xl) var(--md-radius-2xl) 0 0;
      --box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
      align-self: center;
    }

    :host ::ng-deep .action-sheet-modal ion-content {
      --background: transparent;
      --overflow: hidden;
    }

    .bill-viewer-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.92);
      display: flex; align-items: center; justify-content: center;
      animation: billFadeIn 0.2s ease;
    }
    @keyframes billFadeIn { from { opacity: 0; } to { opacity: 1; } }
    .bill-viewer-close {
      position: absolute; top: 12px; right: 12px; z-index: 10;
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255,255,255,0.15); border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #fff;
    }
    .bill-viewer-close ion-icon { font-size: 24px; }
    .bill-viewer-img-wrap {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; touch-action: none;
      -webkit-user-select: none; user-select: none;
    }
    .bill-viewer-img {
      max-width: 92vw; max-height: 88vh;
      object-fit: contain; border-radius: 4px;
      transition: transform 0.15s ease;
      transform-origin: center center;
      will-change: transform;
      pointer-events: none;
    }
  `],
})
export class InventoryPage implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private supervisor = inject(SupervisorService);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);

  items = signal<InventoryItem[]>([]);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  errorMessage = signal<string>('');
  nextCursor = signal<string | null>(null);
  searchQuery = signal('');
  stockFilter = signal<InventoryStockFilter>('all');
  sortField = signal<SortField>('name');
  sortDir = signal<SortDir>('asc');
  private loadGeneration = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  viewerUrl = signal<string | null>(null);
  zoomScale = 1;
  panX = 0;
  panY = 0;
  private pinchStartDist = 0;
  private pinchStartScale = 1;
  private dragStartX = 0;
  private dragStartY = 0;
  private isDragging = false;

  filteredItems = computed(() => {
    let result = this.consolidateByName(this.items());

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.vendor || '').toLowerCase().includes(q) ||
          (i.poNumber || '').toLowerCase().includes(q) ||
          (i.site || '').toLowerCase().includes(q) ||
          (i.category || '').toLowerCase().includes(q)
      );
    }

    if (this.stockFilter() === 'available') {
      result = result.filter((item) => item.currentQuantity > 0);
    } else if (this.stockFilter() === 'low') {
      result = result.filter((item) => item.currentQuantity > 0 && item.currentQuantity <= item.minimumQuantity);
    } else if (this.stockFilter() === 'out') {
      result = result.filter((item) => item.currentQuantity <= 0);
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

  private consolidateByName(items: InventoryItem[]): InventoryItem[] {
    const grouped = new Map<string, InventoryItem>();
    const inventoryKeys = new Set(
      items
        .filter((item) => item._id === item.materialId)
        .map((item) => this.normalizedMaterialName(item.name))
    );

    for (const item of items) {
      const key = this.normalizedMaterialName(item.name);
      if (!key) continue;
      if (inventoryKeys.has(key) && item._id !== item.materialId) continue;

      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          ...item,
          name: item.name.trim(),
          purchaseHistory: [...(item.purchaseHistory || [])],
        });
        continue;
      }

      existing.currentQuantity += item.currentQuantity;
      existing.minimumQuantity += item.minimumQuantity;
      existing.purchaseHistory = [
        ...(existing.purchaseHistory || []),
        ...(item.purchaseHistory || []),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (new Date(item.lastUpdated).getTime() > new Date(existing.lastUpdated).getTime()) {
        existing.lastUpdated = item.lastUpdated;
        existing._id = item._id;
        existing.materialId = item.materialId;
        existing.vendor = item.vendor;
        existing.poNumber = item.poNumber;
        existing.billUrl = item.billUrl;
      }
    }

    return Array.from(grouped.values());
  }

  private normalizedMaterialName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

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
      checkmarkCircleOutline, alertCircleOutline, pencilOutline, closeOutline, close,
      swapVerticalOutline, cloudOfflineOutline, refreshOutline,
    });
    await this.supervisor.init().catch(() => {});
    await this.loadInventory();

    this.supervisor.siteChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.loadInventory());

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:inventory-changed', this.handleInventoryChange);
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:inventory-changed', this.handleInventoryChange);
    }
  }

  private handleInventoryChange = (): void => {
    void this.loadInventory(true);
  };

  async loadInventory(force = false): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    const gen = ++this.loadGeneration;
    const siteId = this.supervisor.selectedSiteId();
    const projectId = this.supervisor.selectedProjectId();

    try {
      const res = await firstValueFrom(
        this.supervisor.getMaterials({
          siteId: siteId || undefined,
          projectId: projectId || undefined,
          status: 'Approved',
          limit: 25,
          search: this.searchQuery().trim() || undefined,
          stockStatus: this.stockFilter(),
        }, force)
      );
      if (gen !== this.loadGeneration) return;
      const materials = (res?.materials || []).map((material) => this.toInventoryItem(material));
      this.items.set(materials);
      this.nextCursor.set(res?.pagination?.nextCursor ?? null);
      this.isLoading.set(false);
    } catch (err) {
      if (gen !== this.loadGeneration) return;
      console.error('[Inventory] failed to load', err);
      this.errorMessage.set((err as Error)?.message || 'Failed to load inventory');
      this.isLoading.set(false);
    }
  }

  async refreshInventory(event: CustomEvent): Promise<void> {
    await this.loadInventory(true);
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }

  async loadMoreInventory(event: CustomEvent): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.isLoadingMore()) {
      (event.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }

    this.isLoadingMore.set(true);
    try {
      const response = await firstValueFrom(
        this.supervisor.getMaterials({
          siteId: this.supervisor.selectedSiteId() || undefined,
          projectId: this.supervisor.selectedProjectId() || undefined,
          status: 'Approved',
          limit: 25,
          cursor,
          search: this.searchQuery().trim() || undefined,
          stockStatus: this.stockFilter(),
        })
      );
      const existing = this.items();
      const existingIds = new Set(existing.map((item) => item._id));
      const appended = (response?.materials || [])
        .map((material) => this.toInventoryItem(material))
        .filter((item) => !existingIds.has(item._id));
      this.items.set([...existing, ...appended]);
      this.nextCursor.set(response?.pagination?.nextCursor ?? null);
    } catch (error) {
      console.error('[Inventory] failed to load next page', error);
    } finally {
      this.isLoadingMore.set(false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    }
  }

  private toInventoryItem(material: Material): InventoryItem {
    return {
      _id: material._id,
      materialId: material.materialId,
      name: material.name,
      category: (material as any).category || 'General',
      unit: material.unit,
      currentQuantity: material.remainingStock ?? material.approvedQuantity ?? 0,
      minimumQuantity: material.minimumQuantity || 0,
      lastUpdated: material.updatedAt || material.requestDate,
      vendor: material.vendor || '',
      poNumber: material.poNumber || '',
      status: material.status,
      projectId: material.projectId,
      projectName: material.projectName,
      siteId: material.siteId || '',
      site: material.site,
      billUrl: (material as any).billUrl || '',
      purchaseHistory: material.purchaseHistory || [],
    };
  }

  applyFilters(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadInventory(true), 350);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value || '');
    this.applyFilters();
  }

  onStockFilterChange(value: InventoryStockFilter): void {
    this.stockFilter.set(value || 'all');
    void this.loadInventory(true);
  }

  cycleSort(): void {
    const states: Array<[SortField, SortDir]> = [
      ['name', 'asc'], ['name', 'desc'],
      ['currentQuantity', 'asc'], ['currentQuantity', 'desc'],
      ['lastUpdated', 'desc'], ['lastUpdated', 'asc'],
      ['vendor', 'asc'], ['vendor', 'desc'],
    ];
    const index = states.findIndex(([field, direction]) => field === this.sortField() && direction === this.sortDir());
    const [field, direction] = states[(index + 1) % states.length];
    this.sortField.set(field);
    this.sortDir.set(direction);
  }

  async openEditQuantity(item: InventoryItem): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: InventoryEditModalComponent,
      componentProps: { item },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.updated) {
      await this.loadInventory(true);
    }
  }

  openDetail(id: string): void {
    this.router.navigate(['/tabs/inventory', id]);
  }

  async raiseRequest(item: InventoryItem | null): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: InventoryRequestModalComponent,
      componentProps: { preSelected: item },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.requested) {
      await this.loadInventory(true);
      const toast = await this.toastCtrl.create({
        message: 'Material request submitted successfully',
        duration: 2500,
        color: 'success',
        position: 'top',
      });
      await toast.present();
    }
  }

  async showInventoryActions(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: InventoryActionSheetComponent,
      cssClass: 'action-sheet-modal',
      breakpoints: [0, 0.5, 0.7],
      initialBreakpoint: 0.5,
      handle: false,
      showBackdrop: false,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.action === 'existing') {
      void this.openAddExisting();
    } else if (data?.action === 'request') {
      void this.raiseRequest(null);
    }
  }

  private async openAddExisting(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: InventoryRequestModalComponent,
      componentProps: {
        mode: 'existing',
        // Build the autofill catalog from the current inventory items:
        // unit / vendor / poNumber / minimumQuantity / remainingStock
        // are derived from the most-recent stock entry per material name.
        materialCatalog: this.items().map((item) => ({
          name: item.name,
          unit: item.unit,
          vendor: item.vendor || undefined,
          poNumber: item.poNumber || undefined,
          minimumQuantity: item.minimumQuantity ?? null,
          remainingStock: item.currentQuantity ?? null,
        })),
      },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (!data?.added) return;
    await this.loadInventory(true);
    const toast = await this.toastCtrl.create({
      message: data.message || 'Inventory updated successfully',
      duration: 2500,
      color: 'success',
      position: 'top',
    });
    await toast.present();
  }

  openBillViewer(url: string): void {
    this.viewerUrl.set(url);
    this.resetZoom();
  }

  closeBillViewer(event: Event): void {
    event.stopPropagation();
    this.viewerUrl.set(null);
    this.resetZoom();
  }

  private resetZoom(): void {
    this.zoomScale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  toggleZoom(event: Event): void {
    event.stopPropagation();
    if (this.zoomScale > 1) {
      this.resetZoom();
    } else {
      this.zoomScale = 2.5;
    }
  }

  onPinchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault();
      this.pinchStartDist = this.getTouchDistance(event.touches);
      this.pinchStartScale = this.zoomScale;
    }
  }

  onPinchMove(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault();
      const dist = this.getTouchDistance(event.touches);
      const ratio = dist / this.pinchStartDist;
      this.zoomScale = Math.min(Math.max(this.pinchStartScale * ratio, 0.5), 5);
      if (this.zoomScale <= 1) {
        this.panX = 0;
        this.panY = 0;
      }
    }
  }

  onPinchEnd(event: TouchEvent): void {
    if (event.touches.length < 2 && this.zoomScale < 1) {
      this.resetZoom();
    }
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  onDragStart(event: MouseEvent): void {
    if (this.zoomScale <= 1) return;
    event.preventDefault();
    this.isDragging = true;
    this.dragStartX = event.clientX - this.panX;
    this.dragStartY = event.clientY - this.panY;
  }

  onDragMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    event.preventDefault();
    this.panX = event.clientX - this.dragStartX;
    this.panY = event.clientY - this.dragStartY;
  }

  onDragEnd(): void {
    this.isDragging = false;
  }
}
