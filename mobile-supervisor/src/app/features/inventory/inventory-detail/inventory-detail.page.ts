import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons,
  IonSpinner, IonIcon, IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cubeOutline, timeOutline, businessOutline, alertCircleOutline, refreshOutline, swapVerticalOutline, documentTextOutline, imageOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonSpinner, IonIcon, IonButton, DatePipe],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/inventory" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Inventory Detail</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="detail-content">
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
                {{ item()!.site }} - {{ item()!.projectName }}
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
                Purchase History (PO Numbers)
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
                      @if (entry.poNumber) {
                        <span class="log-po">PO: {{ entry.poNumber }}</span>
                      }
                      <span class="log-date">{{ entry.date | date:'MMM d, yyyy' }}</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          @if (billImageUrl()) {
            <div class="card">
              <h3 class="card-title">
                <ion-icon name="image-outline"></ion-icon>
                Bill / Reference Image
              </h3>
              <div class="bill-image-wrap">
                <img [src]="billImageUrl()" alt="Bill/Receipt" class="bill-image" (click)="openImage()" />
              </div>
            </div>
          }

          @if (item()!.vendor) {
            <div class="card">
              <h3 class="card-title">Vendor Info</h3>
              <div class="kv-list">
                <div class="kv">
                  <span class="kv-label">Vendor</span>
                  <span class="kv-value">{{ item()!.vendor }}</span>
                </div>
                @if (item()!.poNumber) {
                  <div class="kv">
                    <span class="kv-label">PO Number</span>
                    <span class="kv-value po-value">{{ item()!.poNumber }}</span>
                  </div>
                }
              </div>
            </div>
          }
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

    .bill-image-wrap {
      border-radius: var(--md-radius-lg); overflow: hidden;
      border: 1px solid var(--m3-outline-variant);
    }
    .bill-image {
      width: 100%; max-height: 300px; object-fit: contain;
      display: block; cursor: pointer; background: var(--m3-surface-container);
    }

    .kv-list { display: flex; flex-direction: column; gap: var(--md-space-2); }
    .kv { display: flex; justify-content: space-between; align-items: center; }
    .kv-label { font-size: 12px; color: var(--m3-on-surface-muted); font-weight: 600; }
    .kv-value { font-size: 14px; font-weight: 700; color: var(--m3-on-surface); }
    .kv-value.po-value { font-family: var(--m3-font-mono); font-size: 13px; color: var(--m3-success); }
  `],
})
export class InventoryDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private supervisor = inject(SupervisorService);

  item = signal<any>(null);
  loading = signal(true);

  consumptionLog = signal<Array<{ quantity: number; date: string; updatedBy?: string; notes?: string }>>([]);
  purchaseHistory = signal<Array<{ vendor: string; quantity: number; date: string; poNumber?: string }>>([]);
  billImageUrl = signal<string>('');

  ngOnInit(): void {
    addIcons({ cubeOutline, timeOutline, businessOutline, alertCircleOutline, refreshOutline, swapVerticalOutline, documentTextOutline, imageOutline });
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

      this.billImageUrl.set((mat as any)?.billUrl || (mat as any)?.receiptImage || '');
    } catch {
      this.item.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  openImage(): void {
    const url = this.billImageUrl();
    if (url) window.open(url, '_blank');
  }
}
