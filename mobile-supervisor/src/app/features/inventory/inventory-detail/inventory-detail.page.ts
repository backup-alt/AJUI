import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons,
  IonSpinner, IonIcon, IonButton, IonRefresher, IonRefresherContent,
  IonCheckbox, ToastController,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { addIcons } from 'ionicons';
import { cubeOutline, timeOutline, businessOutline, alertCircleOutline, refreshOutline, swapVerticalOutline, documentTextOutline, close } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonSpinner, IonIcon, IonButton, IonRefresher, IonRefresherContent, IonCheckbox, DatePipe],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/inventory" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Material Detail</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="detail-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
      @if (loading()) {
        <div class="loading-wrap"><ion-spinner name="crescent"></ion-spinner></div>
      } @else if (!item()) {
        <div class="empty-state">
          <ion-icon name="alert-circle-outline" class="empty-icon"></ion-icon>
          <p>Item not found.</p>
          <ion-button fill="outline" (click)="loadItem()">
            <ion-icon name="refresh-outline" slot="start"></ion-icon>
            Retry
          </ion-button>
        </div>
      } @else {
        <div class="detail-container">
          <div class="hero">
            <span class="hero-tile"><ion-icon name="cube-outline"></ion-icon></span>
            <div class="hero-body">
              <h2 class="item-name">{{ item()!.name }}</h2>
              <p class="meta">
                <ion-icon name="business-outline"></ion-icon>
                {{ item()!.projectName }}
              </p>
            </div>
          </div>

          <div class="stock-card">
            <div class="stock-row">
              <div class="stock-block">
                <span class="stock-label">Current Stock</span>
                <span class="stock-value">{{ item()!.remainingStock ?? item()!.currentQuantity ?? 0 }}</span>
                <span class="stock-unit">{{ item()!.unit }}</span>
              </div>
              <div class="stock-block">
                <span class="stock-label">Purchased</span>
                <span class="stock-value purchased">{{ item()!.purchasedQuantity ?? 0 }}</span>
                <span class="stock-unit">{{ item()!.unit }}</span>
              </div>
              <div class="stock-block">
                <span class="stock-label">Consumed</span>
                <span class="stock-value consumed">{{ item()!.consumedQuantity ?? 0 }}</span>
                <span class="stock-unit">{{ item()!.unit }}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">
              <ion-icon name="swap-vertical-outline"></ion-icon>
              Consumption Log
            </h3>
            @if (consumptionLog().length === 0) {
              <div class="empty-log">
                <p>No consumption records yet.</p>
              </div>
            } @else {
              <div class="log-list">
                @for (entry of consumptionLog(); track $index) {
                  <div class="log-entry">
                    <div class="log-icon consumed-icon">
                      <ion-icon name="swap-vertical-outline"></ion-icon>
                    </div>
                    <div class="log-info">
                      <span class="log-qty">-{{ entry.quantity }} {{ item()!.unit }}</span>
                      <span class="log-date">{{ entry.date | date:'MMM d, yyyy h:mm a' }}</span>
                      @if (entry.notes) {
                        <span class="log-notes">{{ entry.notes }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          @if (purchaseHistory().length > 0) {
            <div class="card">
              <h3 class="card-title">
                <ion-icon name="document-text-outline"></ion-icon>
                Purchase History
              </h3>
              <div class="log-list">
                @for (entry of purchaseHistory(); track $index) {
                  <div class="log-entry">
                    <div class="log-icon purchase-icon">
                      <ion-icon name="document-text-outline"></ion-icon>
                    </div>
                    <div class="log-info">
                      <span class="log-qty">+{{ entry.quantity }} {{ item()!.unit }}</span>
                      <span class="log-vendor">{{ entry.vendor || 'Unknown Vendor' }}</span>
                      <span class="log-date">{{ entry.date | date:'MMM d, yyyy' }}</span>
                      @if (entry.billUrl) {
                        <button class="log-bill-btn" (click)="openBillViewer(entry.billUrl!); $event.stopPropagation()">
                          <ion-icon name="document-text-outline"></ion-icon>
                          View Bill
                        </button>
                      }
                      <label class="received-control">
                        <ion-checkbox
                          aria-label="Mark this purchase as received"
                          [checked]="entry.received"
                          [disabled]="entry.received || !entry.materialId || updatingReceived().has(entry.materialId)"
                          (ionChange)="setPurchaseReceived(entry, $event.detail.checked)"
                        ></ion-checkbox>
                        <span>{{ entry.received ? 'Received' : 'Mark received' }}</span>
                      </label>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

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
    .detail-content { --background: var(--m3-surface); }
    .loading-wrap { display: flex; justify-content: center; padding-top: 120px; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; padding: 120px 24px; text-align: center;
    }
    .empty-icon { font-size: 48px; color: var(--m3-on-surface-muted); opacity: 0.5; margin-bottom: 16px; }
    .empty-state p { font-size: 14px; color: var(--m3-on-surface-muted); margin: 0 0 16px; }

    .detail-container { padding: var(--md-space-3) var(--md-space-4) 96px; }

    .hero {
      display: flex; align-items: flex-start; gap: var(--md-space-3);
      margin-bottom: var(--md-space-4);
    }
    .hero-tile {
      width: 48px; height: 48px; border-radius: var(--md-radius-lg);
      background: rgba(0, 34, 99, 0.08); color: var(--m3-primary);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .hero-tile ion-icon { font-size: 24px; }
    .hero-body { flex: 1; min-width: 0; }
    .item-name { font-size: 18px; font-weight: 700; color: var(--m3-on-surface); margin: 0 0 4px; }
    .meta {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 13px; color: var(--m3-on-surface-muted); margin: 0;
    }
    .meta ion-icon { font-size: 14px; }

    .stock-card {
      background: var(--m3-primary-container); border-radius: var(--md-radius-xl);
      padding: var(--md-space-4); margin-bottom: var(--md-space-4);
    }
    .stock-row { display: flex; justify-content: space-around; }
    .stock-block { text-align: center; }
    .stock-label {
      display: block; font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--m3-on-primary-container); opacity: 0.7; margin-bottom: 4px;
    }
    .stock-value {
      display: block; font-size: 24px; font-weight: 800; color: var(--m3-on-primary-container); line-height: 1;
    }
    .stock-value.purchased { color: var(--m3-success); }
    .stock-value.consumed { color: var(--m3-error); }
    .stock-unit { font-size: 12px; font-weight: 600; color: var(--m3-on-primary-container); opacity: 0.65; }

    .card {
      background: var(--m3-surface-bright); border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl); padding: var(--md-space-4); margin-bottom: var(--md-space-3);
    }
    .card-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--m3-on-surface-muted); margin: 0 0 var(--md-space-3);
    }
    .card-title ion-icon { font-size: 16px; }

    .empty-log { text-align: center; padding: var(--md-space-4) 0; }
    .empty-log p { font-size: 13px; color: var(--m3-on-surface-muted); margin: 0; }

    .log-list { display: flex; flex-direction: column; gap: var(--md-space-2); }
    .log-entry {
      display: flex; align-items: flex-start; gap: var(--md-space-3);
      padding: var(--md-space-3); background: var(--m3-surface-container);
      border-radius: var(--md-radius-lg);
    }
    .log-icon {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .consumed-icon { background: rgba(220, 38, 38, 0.08); color: var(--m3-error); }
    .purchase-icon { background: rgba(16, 185, 129, 0.08); color: var(--m3-success); }
    .log-icon ion-icon { font-size: 18px; }
    .log-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .log-qty { font-size: 15px; font-weight: 700; }
    .log-qty { color: var(--m3-error); }
    .log-entry:nth-child(n) .log-qty { color: var(--m3-on-surface); }
    .log-vendor { font-size: 13px; font-weight: 600; color: var(--m3-on-surface); }
    .log-po { font-size: 12px; font-family: var(--m3-font-mono); font-weight: 700; color: var(--m3-success); }
    .log-date { font-size: 12px; color: var(--m3-on-surface-muted); }
    .log-notes { font-size: 12px; color: var(--m3-on-surface-variant); font-style: italic; }
    .received-control {
      display: inline-flex; align-items: center; gap: 8px; align-self: flex-start;
      margin-top: 7px; font-size: 13px; font-weight: 700; color: var(--m3-on-surface);
    }
    .received-control ion-checkbox {
      --size: 21px; --checkbox-background-checked: var(--m3-success);
      --border-color-checked: var(--m3-success);
    }

    .log-bill-btn {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 4px; padding: 4px 10px;
      background: rgba(0, 34, 99, 0.06); color: var(--m3-primary);
      border: 1px solid rgba(0, 34, 99, 0.15); border-radius: var(--md-radius-pill);
      font-size: 11px; font-weight: 600; cursor: pointer;
      align-self: flex-start;
    }
    .log-bill-btn:active { background: rgba(0, 34, 99, 0.12); }
    .log-bill-btn ion-icon { font-size: 12px; }

    .bill-viewer-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.92);
      display: flex; align-items: center; justify-content: center;
      animation: invBillFadeIn 0.2s ease;
    }
    @keyframes invBillFadeIn { from { opacity: 0; } to { opacity: 1; } }
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
export class InventoryDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private supervisor = inject(SupervisorService);
  private toastCtrl = inject(ToastController);

  item = signal<any>(null);
  loading = signal(true);

  consumptionLog = signal<Array<{ quantity: number; date: string; updatedBy?: string; notes?: string }>>([]);
  purchaseHistory = signal<Array<{ vendor: string; quantity: number; date: string; materialId?: string; billUrl?: string; received?: boolean; receivedDate?: string }>>([]);
  updatingReceived = signal<Set<string>>(new Set());

  viewerUrl = signal<string | null>(null);
  zoomScale = 1;
  panX = 0;
  panY = 0;
  private pinchStartDist = 0;
  private pinchStartScale = 1;
  private dragStartX = 0;
  private dragStartY = 0;
  private isDragging = false;

  ngOnInit(): void {
    addIcons({ cubeOutline, timeOutline, businessOutline, alertCircleOutline, refreshOutline, swapVerticalOutline, documentTextOutline, close });
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadItem(id);
    });
  }

  async loadItem(id?: string): Promise<void> {
    const itemId = id || this.route.snapshot.paramMap.get('id');
    if (!itemId) return;
    this.loading.set(true);
    try {
      const res = await this.supervisor.getMaterialDetail(itemId).toPromise();
      const mat = res?.material;
      this.item.set(mat);

      const log = (mat as any)?.consumptionHistory || [];
      this.consumptionLog.set(
        [...log].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );

      const history = (mat as any)?.purchaseHistory || [];
      this.purchaseHistory.set(
        [...history].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } catch {
      this.item.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async refresh(event?: CustomEvent): Promise<void> {
    await this.loadItem();
    if (event) setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }

  async setPurchaseReceived(
    entry: { materialId?: string; received?: boolean },
    received: boolean
  ): Promise<void> {
    const materialId = entry.materialId;
    if (!received || entry.received || !materialId || this.updatingReceived().has(materialId)) return;

    this.updatingReceived.update((current) => new Set([...current, materialId]));
    try {
      await firstValueFrom(this.supervisor.setMaterialReceived(materialId, true));
      this.purchaseHistory.update((history) => history.map((purchase) =>
        purchase.materialId === materialId
          ? { ...purchase, received: true, receivedDate: new Date().toISOString() }
          : purchase
      ));
      window.dispatchEvent(new CustomEvent('agb:inventory-changed', {
        detail: { id: materialId, reason: 'received' },
      }));
      const toast = await this.toastCtrl.create({
        message: 'Purchase marked as received',
        duration: 1800,
        color: 'success',
        position: 'top',
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: (error as Error)?.message || 'Could not update received status',
        duration: 2200,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      this.updatingReceived.update((current) => {
        const next = new Set(current);
        next.delete(materialId);
        return next;
      });
    }
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
