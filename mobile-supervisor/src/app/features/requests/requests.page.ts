import { Component, OnInit, inject, signal, computed, ElementRef, ViewChild, AfterViewInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSpinner,
  IonButton,
  IonCheckbox,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  close,
  cloudUploadOutline,
  documentOutline,
  cubeOutline,
  cartOutline,
  timeOutline,
  imageOutline,
  cashOutline,
  chevronForwardOutline,
  cloudOfflineOutline,
  refreshOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { NotificationService } from '../../core/services/notification.service';
import { DatePipe, CurrencyPipe } from '@angular/common';
import {
  PageHeaderComponent,
  EmptyStateComponent,
  StatusPillComponent,
} from '../../shared/components';

interface RequestItem {
  _id: string;
  type: 'material' | 'expense' | 'labour';
  title: string;
  subtitle: string;
  site: string;
  date: string;
  status: string;
  amount?: number;
  issuedAmount?: number;
  givenAmount?: number;
  billUrl?: string;
  billFileName?: string;
  received?: boolean;
  transactionType?: string;
  billEligible: boolean;
  needsUpload: boolean;
}

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonSpinner,
    IonButton,
    IonCheckbox,
    FormsModule,
    DatePipe,
    CurrencyPipe,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusPillComponent,
  ],
  template: `
    <ion-content class="requests-content">
      <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="page-fixed-header">
        <app-page-header
          title="Requests"
          subtitle="All your submitted requests, latest first"
        ></app-page-header>

        <div class="seg-wrap">
          <ion-segment [(ngModel)]="activeTab" (ionChange)="onTabChange()">
            <ion-segment-button value="pending">
              <ion-label>Pending</ion-label>
            </ion-segment-button>
            <ion-segment-button value="approved">
              <ion-label>Approved</ion-label>
            </ion-segment-button>
            <ion-segment-button value="declined">
              <ion-label>Declined</ion-label>
            </ion-segment-button>
            <ion-segment-button value="upload">
              <ion-label>Upload</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>
      </div>

      <div class="cards">
        @if (errorMessage()) {
          <div class="error-state">
            <ion-icon name="cloud-offline-outline" class="error-icon"></ion-icon>
            <span class="error-title">Something went wrong</span>
            <span class="error-text">{{ errorMessage() }}</span>
            <button class="retry-btn" (click)="loadAllRequests()">
              <ion-icon name="refresh-outline"></ion-icon>
              Retry
            </button>
          </div>
        } @else if (isLoading() && filteredItems.length === 0) {
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 40%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </div>
          }
        } @else if (filteredItems.length === 0) {
          <app-empty-state
            [icon]="emptyIcon"
            [title]="emptyTitle"
            [message]="emptyMessage"
          ></app-empty-state>
        } @else {
          @for (item of filteredItems; track item._id) {
            <div class="request-card" [class.upload-mode]="activeTab === 'upload'">
              <header class="request-head">
                <div class="type-pill" [class.material]="item.type === 'material'" [class.expense]="item.type === 'expense' || item.type === 'labour'">
                  <ion-icon [name]="item.type === 'material' ? 'cube-outline' : (item.type === 'labour' ? 'cash-outline' : 'cart-outline')"></ion-icon>
                  {{ item.type === 'material'
                      ? 'Material'
                      : item.type === 'labour'
                      ? 'Labour'
                      : (item.transactionType === 'Cash Added' ? 'Add Cash' : 'Purchase') }}
             </div>
                <app-status-pill [tone]="getStatusTone(item.status)">{{ item.status }}</app-status-pill>
          </header>

              <h3 class="request-title">{{ item.title }}</h3>
              <p class="request-subtitle">{{ item.subtitle }}</p>
              <p class="request-meta">
                <ion-icon name="time-outline"></ion-icon>
                {{ item.date | date:'MMM d, yyyy' }}
                <span class="meta-sep">·</span>
                    {{ item.site }}
              </p>

              @if (item.issuedAmount) {
                <div class="amount-row">
                  <span class="amount-label">Issued Amount</span>
                  <span class="amount-value">{{ item.issuedAmount | currency:'INR':'symbol':'1.0-0' }}</span>
                </div>
              }

              @if (item.givenAmount) {
                <div class="amount-row given">
                  <span class="amount-label">Given Amount</span>
                  <span class="amount-value">{{ item.givenAmount | currency:'INR':'symbol':'1.0-0' }}</span>
                </div>
              }

              @if (activeTab === 'upload' && item.needsUpload) {
                @if (uploadingItemId() === item._id) {
                  <div class="upload-section">
                    @if (selectedFileName()) {
                      <div class="file-preview">
                        <ion-icon name="document-outline"></ion-icon>
                        <span>{{ selectedFileName() }}</span>
                      </div>
                    }

                    @if (item.type === 'material') {
                      <div class="upload-field checkbox-field">
                        <ion-checkbox
                          [(ngModel)]="isReceivedInput"
                          [disabled]="isUploading()"
                          class="received-checkbox"
                  aria-label="Received materials reached the project"
                        ></ion-checkbox>
                  <span class="received-label">Received (materials delivered)</span>
                      </div>
                    }

                    <div class="upload-actions">
                      <ion-button
                        expand="block"
                        fill="outline"
                        size="small"
                        (click)="cancelUpload()"
                      >
                        Cancel
                      </ion-button>
                      <ion-button
                        expand="block"
                        size="small"
                        [disabled]="!canSubmitUpload(item)"
                        (click)="submitUpload(item)"
                      >
                        @if (isUploading()) {
                          <ion-spinner name="crescent" slot="start"></ion-spinner>
                          Uploading...
                        } @else {
                          Submit
                        }
                      </ion-button>
                    </div>
                  </div>
                } @else {
                  <div class="upload-cta">
                    <ion-button
                      expand="block"
                      fill="outline"
                      size="small"
                      (click)="startUpload(item)"
                    >
                      <ion-icon name="cloud-upload-outline" slot="start"></ion-icon>
                      Upload Bill
                    </ion-button>
                  </div>
                }
              }

              @if (activeTab === 'upload' && !item.needsUpload) {
                <div class="completed-notice">
                  <ion-icon name="checkmark-circle-outline"></ion-icon>
                  Bill uploaded
                </div>
              }

              @if (item.billUrl) {
                <div class="bill-thumb-wrap" (click)="openBill(item)">
                  @if (isPdfBill(item)) {
                    <ion-icon name="document-outline" class="bill-document-icon"></ion-icon>
                  } @else {
                    <img [src]="item.billUrl" alt="Bill" class="bill-thumb" />
                  }
                  <span class="bill-thumb-label">View Bill</span>
                </div>
              }
            </div>
          }
        }
      </div>

      @if (activeTab === 'upload' && materialBillNextCursor()) {
        <ion-infinite-scroll threshold="120px" (ionInfinite)="loadMoreMaterialBills($event)">
          <ion-infinite-scroll-content loadingSpinner="crescent"></ion-infinite-scroll-content>
        </ion-infinite-scroll>
      }

      @if (viewImageUrl()) {
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
               (mouseup)="onDragEnd($event)"
               (mouseleave)="onDragEnd($event)"
               (dblclick)="toggleZoom($event)">
            <img [src]="viewImageUrl()" alt="Bill" class="bill-viewer-img"
                 [style.transform]="'translate(' + panX + 'px,' + panY + 'px) scale(' + zoomScale + ')'"
                 (dragstart)="$event.preventDefault()" />
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .requests-content { --background: var(--m3-surface); }
    .page-fixed-header {
      background: var(--m3-surface);
      position: relative;
      z-index: 1;
    }
    .seg-wrap { padding: 0 var(--md-space-4) var(--md-space-2); }

    .cards { padding: 0 var(--md-space-4) 96px; }
    .request-card {
      width: 100%; text-align: left;
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-3) var(--md-space-4);
      margin-bottom: var(--md-space-2);
      box-shadow: var(--md-elevation-1);
      border-left: 3px solid var(--m3-secondary);
    }
    .request-card.upload-mode { border-left-color: var(--m3-primary); }

    .request-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--md-space-2);
    }
    .type-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 3px 8px;
      border-radius: var(--md-radius-sm);
    }
    .type-pill.material {
      background: rgba(220, 53, 69, 0.08);
      color: var(--m3-error);
    }
    .type-pill.expense {
      background: rgba(0, 34, 99, 0.08);
      color: var(--m3-primary);
    }
    .type-pill ion-icon { font-size: 13px; }

    .request-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 2px;
    }
    .request-subtitle {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      margin: 0 0 6px;
    }
    .request-meta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      margin: 0 0 8px;
    }
    .request-meta ion-icon { font-size: 13px; }
    .meta-sep { color: var(--m3-on-surface-muted); opacity: 0.5; }

    .amount-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      background: var(--m3-surface-container);
      border-radius: var(--md-radius-md);
      margin-bottom: 4px;
    }
    .amount-row.given { background: var(--m3-success-container); }
    .amount-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .amount-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--m3-on-surface);
    }
    .amount-row.given .amount-value { color: var(--m3-success); }

    .upload-cta { margin-top: var(--md-space-2); }

    .upload-section {
      margin-top: var(--md-space-2);
      padding: var(--md-space-3);
      background: var(--m3-surface-container);
      border-radius: var(--md-radius-lg);
      border: 1px dashed var(--m3-outline);
    }

    .file-preview {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--m3-success);
      font-weight: 600;
      margin-bottom: 8px;
      padding: 6px 10px;
      background: var(--m3-success-container);
      border-radius: var(--md-radius-md);
      min-width: 0;
    }
    .file-preview ion-icon { font-size: 16px; }
    .file-preview span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .upload-field { margin-bottom: 10px; }
    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .received-checkbox {
      --checkbox-background: var(--m3-surface-bright);
      --checkbox-background-checked: var(--m3-primary);
      --border-color: var(--m3-outline);
      --border-color-checked: var(--m3-primary);
      --checkbox-border-radius: 6px;
      --checkbox-size: 20px;
      margin: 0;
      flex: 0 0 auto;
    }
    .received-label {
      font-size: 13px;
      line-height: 1.35;
      color: var(--m3-on-surface);
      font-weight: 600;
    }
    .upload-field-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 4px;
    }
    .upload-input {
      --background: var(--m3-surface-bright);
      --border-radius: var(--md-radius-md);
      --padding-start: 10px;
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-md);
    }

    .upload-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .completed-notice {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--m3-success);
      margin-top: 8px;
      padding: 6px 10px;
      background: var(--m3-success-container);
      border-radius: var(--md-radius-md);
    }
    .completed-notice ion-icon { font-size: 16px; }

    .bill-thumb-wrap {
      display: flex; align-items: center; gap: 8px;
      margin-top: var(--md-space-2); padding: 8px;
      background: var(--m3-surface-container); border-radius: var(--md-radius-lg);
      cursor: pointer; border: 1px solid var(--m3-outline-variant);
    }
    .bill-thumb {
      width: 48px; height: 48px; border-radius: var(--md-radius-md);
      object-fit: cover; flex-shrink: 0;
    }
    .bill-document-icon {
      width: 48px;
      height: 48px;
      padding: 8px;
      color: var(--m3-primary);
      background: var(--m3-primary-container);
      border-radius: 6px;
    }
    .bill-thumb-label {
      font-size: 12px; font-weight: 600; color: var(--m3-primary);
    }

    .skeleton-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-2);
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

    .bill-viewer-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.92);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
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
export class RequestsPage implements OnInit {
  private destroyRef = inject(DestroyRef);
  private supervisor = inject(SupervisorService);
  private toastCtrl = inject(ToastController);
  private notifications = inject(NotificationService);

  activeTab: 'pending' | 'approved' | 'declined' | 'upload' = 'pending';
  isLoading = signal(true);
  errorMessage = signal<string>('');

  allItems = signal<RequestItem[]>([]);
  materialBillNextCursor = signal<string | null>(null);
  get filteredItems() {
    const items = [...this.allItems()].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });
    if (this.activeTab === 'pending') {
      return items.filter(i => i.status === 'Pending' || i.status === 'Not Received');
    }
    if (this.activeTab === 'approved') {
      return items.filter(i => i.status === 'Approved' || i.status === 'Completed' || i.status === 'Received');
    }
    if (this.activeTab === 'declined') {
      return items.filter(i => i.status === 'Rejected' || i.status === 'Declined');
    }
    // Keep completed uploads visible so the bill can be opened again.
    return items.filter(i => i.billEligible);
  }

  uploadingItemId = signal<string | null>(null);
  selectedFileData = signal<string | null>(null);
  selectedFileName = signal<string | null>(null);
  selectedFileMimeType = signal<string | null>(null);
  isReceivedInput: boolean = false;
  isUploading = signal(false);

  viewImageUrl = signal<string | null>(null);
  zoomScale = 1;
  private pinchStartDist = 0;
  private pinchStartScale = 1;
  panX = 0;
  panY = 0;
  private lastPanX = 0;
  private lastPanY = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private isDragging = false;

  get emptyIcon() {
    if (this.activeTab === 'approved') return 'checkmark-circle-outline';
    if (this.activeTab === 'declined') return 'close-circle-outline';
    if (this.activeTab === 'pending') return 'time-outline';
    return 'cloud-upload-outline';
  }

  get emptyTitle() {
    if (this.activeTab === 'pending') return 'No pending requests';
    if (this.activeTab === 'approved') return 'No approved requests';
    if (this.activeTab === 'declined') return 'No declined requests';
    return 'No bill requests';
  }

  get emptyMessage() {
    if (this.activeTab === 'pending') return 'Pending material and expense requests will appear here.';
    if (this.activeTab === 'approved') return 'Approved material and purchase requests will appear here.';
    if (this.activeTab === 'declined') return 'Declined requests will appear here.';
    return 'Approved material and purchase bills will appear here.';
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      checkmarkCircleOutline, closeCircleOutline, close, cloudUploadOutline,
      documentOutline, cubeOutline, cartOutline, timeOutline,
      imageOutline, cashOutline, chevronForwardOutline,
      cloudOfflineOutline, refreshOutline,
    });
    await this.supervisor.init().catch(() => {});
    await this.loadAllRequests();
    this.supervisor.siteChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.loadAllRequests());
  }

  onTabChange(): void {
    this.cancelUpload();
  }

  async handleRefresh(event: CustomEvent): Promise<void> {
    await this.loadAllRequests(true);
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }

  async loadAllRequests(force = false): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    const items: RequestItem[] = [];
    let failedRequests = 0;
    const siteId = this.supervisor.selectedSiteId();
    const projectId = this.supervisor.selectedProjectId();
    const siteFilter = { siteId: siteId || undefined, projectId: projectId || undefined };
    this.materialBillNextCursor.set(null);

    try {
      const addItem = (item: RequestItem) => {
        const existingIndex = items.findIndex((existing) => existing._id === item._id);
        if (existingIndex >= 0) {
          items[existingIndex] = { ...items[existingIndex], ...item };
          return;
        }
        items.push(item);
      };

      try {
        const approvalsRes = await firstValueFrom(this.supervisor.getApprovals());
        for (const approval of approvalsRes?.approvals || []) {
          const rawType = String((approval as any).type || (approval as any).sourceCollection || '').toLowerCase();
          const requestType: RequestItem['type'] =
            rawType.includes('expense') ? 'expense' :
            rawType.includes('labour') ? 'labour' :
            'material';
          addItem({
            _id: String((approval as any).sourceId || approval._id || approval.approvalId),
            type: requestType,
            title: approval.title || (requestType === 'labour' ? 'Labour request' : `${requestType} request`),
            subtitle: approval.projectName || approval.sourceCollection || '',
            site: approval.projectName || 'General',
            date: approval.submittedAt,
            status: approval.status || 'Pending',
            amount: approval.amount,
            issuedAmount: approval.amount,
            billEligible: false,
            needsUpload: false,
          });
        }
      } catch (err) {
        failedRequests++;
        console.error('[Requests] approvals load failed', err);
      }

      // Load the individual approved Material records, not aggregated Inventory cards.
      try {
        const approvedMatRes = await firstValueFrom(this.supervisor.getMaterialBillRequests({ ...siteFilter, limit: 25 }));
        for (const m of approvedMatRes?.materials || []) {
          addItem(this.toMaterialBillItem(m));
        }
        this.materialBillNextCursor.set(approvedMatRes?.pagination?.nextCursor || null);
      } catch (err) {
        failedRequests++;
        console.error('[Requests] approved materials load failed', err);
      }

          // Load PENDING/DECLINED materials from Material collection (may timeout on M0 — non-critical)
      try {
        const otherMatRes = await firstValueFrom(this.supervisor.getMaterials({ ...siteFilter, limit: 25 }));
        const approvedIds = new Set(items.filter(i => i.type === 'material').map(i => i._id));
        for (const m of otherMatRes?.materials || []) {
          if (approvedIds.has(m._id)) continue;
          const isApproved = m.status === 'Approved' || m.status === 'Completed' || m.status === 'Received';
          addItem({
            _id: m._id,
            type: 'material',
            title: m.name,
            subtitle: m.approvedQuantity ? `${m.approvedQuantity} ${m.unit} approved` : `${m.requestedQuantity} ${m.unit} requested`,
            site: m.projectName,
            date: m.requestDate,
            status: m.status,
            issuedAmount: m.issuedAmount,
            givenAmount: (m as any).givenAmount,
            billUrl: (m as any).billUrl,
            billFileName: m.receiptImageName,
            received: m.status === 'Received',
            billEligible: false,
            needsUpload: isApproved && !(m as any).billUrl,
          });
        }
      } catch (err) {
        failedRequests++;
        console.error('[Requests] other materials load failed (non-critical)', err);
      }

      // Load expenses — include ALL transaction types (Purchase + Add Cash)
      try {
        const expRes = await firstValueFrom(this.supervisor.getExpenses({ ...siteFilter, type: 'site', limit: 25 }));
        for (const e of expRes?.expenses || []) {
          const txLabel =
            e.transactionType === 'Cash Added' ? 'Add Cash' :
            (e.transactionType || 'Purchase');

          addItem({
            _id: e._id,
            type: 'expense',
            title: (e as any).isSiteMaterial
              ? `${(e as any).materialName || e.description}`
              : e.description,
            subtitle: (e as any).isSiteMaterial
              ? `${(e as any).materialQuantity || ''} ${(e as any).materialUnit || ''} - ${txLabel}`
              : `${txLabel} expense`,
            site: e.projectName || 'General',
            date: e.date,
            status: e.status,
            amount: e.amount,
            issuedAmount: e.issuedAmount,
            givenAmount: (e as any).givenAmount,
            billUrl: (e as any).billUrl,
            received: (e as any).received,
            transactionType: e.transactionType,
            billFileName: e.receiptImageName,
            billEligible:
              e.transactionType === 'Purchase' &&
              (e.status === 'Approved' || e.status === 'Completed'),
            needsUpload:
              (e.status === 'Approved') &&
              !(e as any).billUrl,
          });
        }
      } catch (err) {
        failedRequests++;
        console.error('[Requests] expenses load failed', err);
      }
    } catch (err) {
      console.error('[Requests] Failed to load', err);
      this.errorMessage.set((err as Error)?.message || 'Failed to load requests');
    }

    if (failedRequests >= 4 && items.length === 0) {
      this.errorMessage.set('Unable to load requests. Please retry.');
    }
    this.allItems.set(items);
    this.isLoading.set(false);
  }

  async loadMoreMaterialBills(event: CustomEvent): Promise<void> {
    const cursor = this.materialBillNextCursor();
    if (!cursor) {
      await (event.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }

    try {
      const response = await firstValueFrom(this.supervisor.getMaterialBillRequests({
        siteId: this.supervisor.selectedSiteId() || undefined,
        projectId: this.supervisor.selectedProjectId() || undefined,
        limit: 25,
        cursor,
      }));
      const merged = [...this.allItems()];
      for (const material of response?.materials || []) {
        const item = this.toMaterialBillItem(material);
        const index = merged.findIndex((current) => current._id === item._id);
        if (index >= 0) merged[index] = { ...merged[index], ...item };
        else merged.push(item);
      }
      this.allItems.set(merged);
      this.materialBillNextCursor.set(response?.pagination?.nextCursor || null);
    } catch (err) {
      const toast = await this.toastCtrl.create({
        message: (err as Error)?.message || 'Failed to load more bill requests',
        duration: 2500,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      await (event.target as HTMLIonInfiniteScrollElement).complete();
    }
  }

  private toMaterialBillItem(material: any): RequestItem {
    return {
      _id: material._id,
      type: 'material',
      title: material.name,
      subtitle: material.approvedQuantity
        ? `${material.approvedQuantity} ${material.unit} approved`
        : `${material.requestedQuantity} ${material.unit} requested`,
      site: material.projectName,
      date: material.requestDate,
      status: material.status,
      issuedAmount: material.issuedAmount,
      givenAmount: material.givenAmount,
      billUrl: material.billUrl,
      billFileName: material.receiptImageName,
      received: material.status === 'Received',
      billEligible: true,
      needsUpload: !material.billUrl,
    };
  }

  getStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'Approved' || status === 'Completed' || status === 'Received') return 'success';
    if (status === 'Pending') return 'warning';
    if (status === 'Rejected') return 'danger';
    return 'neutral';
  }

  openBillImage(url: string): void {
    this.viewImageUrl.set(url);
    this.resetZoom();
  }

  openBill(item: RequestItem): void {
    if (!item.billUrl) return;
    if (this.isPdfBill(item)) {
      window.open(item.billUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    this.openBillImage(item.billUrl);
  }

  isPdfBill(item: RequestItem): boolean {
    return String(item.billFileName || '').toLowerCase().endsWith('.pdf');
  }

  closeBillViewer(event: Event): void {
    event.stopPropagation();
    this.viewImageUrl.set(null);
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
    if (event.touches.length < 2) {
      if (this.zoomScale < 1) {
        this.resetZoom();
      }
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

  onDragEnd(event: MouseEvent): void {
    this.isDragging = false;
  }

  startUpload(item: RequestItem): void {
    this.uploadingItemId.set(item._id);
    this.selectedFileData.set(null);
    this.selectedFileName.set(null);
    this.selectedFileMimeType.set(null);
    // trigger file picker
    this.pickFile();
  }

  cancelUpload(): void {
    this.uploadingItemId.set(null);
    this.isReceivedInput = false;
    this.selectedFileData.set(null);
    this.selectedFileName.set(null);
    this.selectedFileMimeType.set(null);
  }

  pickFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      this.selectedFileName.set(file.name);
      this.selectedFileMimeType.set(file.type);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        this.selectedFileData.set(base64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  canSubmitUpload(item: RequestItem): boolean {
    if (!this.selectedFileData() || this.isUploading()) {
      return false;
    }
    if (item.type === 'material') {
      return !!this.isReceivedInput;
    }
    return true;
  }

  async submitUpload(item: RequestItem): Promise<void> {
    if (!this.canSubmitUpload(item)) return;
    this.isUploading.set(true);

    const payload: any = {
      data: this.selectedFileData()!,
      mimeType: this.selectedFileMimeType() || 'image/jpeg',
      fileName: this.selectedFileName() || 'bill.jpg',
    };
    if (item.type === 'material') {
      payload.received = this.isReceivedInput;
    }

    try {
      if (item.type === 'material') {
        await new Promise<void>((resolve, reject) => {
          this.supervisor.uploadMaterialReceipt(item._id, payload).subscribe({
            next: () => resolve(),
            error: (err) => reject(err),
          });
        });
      } else {
        await new Promise<void>((resolve, reject) => {
          this.supervisor.uploadReceipt(item._id, payload).subscribe({
            next: () => resolve(),
            error: (err) => reject(err),
          });
        });
      }

      const toast = await this.toastCtrl.create({
        message: 'Bill uploaded successfully',
        duration: 2500,
        color: 'success',
        position: 'top',
      });
      await toast.present();
      this.cancelUpload();
      if (typeof window !== 'undefined' && item.type === 'material') {
        window.dispatchEvent(new CustomEvent('agb:inventory-changed', { detail: { id: item._id, reason: 'received' } }));
      }
      this.notifications.notify(
        'Material Submitted',
        `Receipt for ${item.title || 'material'} has been uploaded successfully.`
      );
      await this.loadAllRequests(true);
    } catch (err: any) {
      const toast = await this.toastCtrl.create({
        message: err?.message || 'Failed to upload bill',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      this.isUploading.set(false);
    }
  }
}
