import { Component, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonInput,
  IonButton,
  IonCheckbox,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  cloudUploadOutline,
  documentOutline,
  cubeOutline,
  cartOutline,
  timeOutline,
  imageOutline,
  cashOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { DatePipe, CurrencyPipe } from '@angular/common';
import {
  PageHeaderComponent,
  EmptyStateComponent,
  StatusPillComponent,
} from '../../shared/components';

interface RequestItem {
  _id: string;
  type: 'material' | 'expense';
  title: string;
  subtitle: string;
  site: string;
  date: string;
  status: string;
  amount?: number;
  issuedAmount?: number;
  givenAmount?: number;
  billUrl?: string;
  received?: boolean;
  transactionType?: string;
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
    IonSpinner,
    IonInput,
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

      <app-page-header
        title="Requests"
        subtitle="Track your submitted requests"
      ></app-page-header>

      <div class="seg-wrap">
        <ion-segment [(ngModel)]="activeTab" (ionChange)="onTabChange()">
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

      <div class="cards">
        @if (isLoading() && filteredItems.length === 0) {
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
                <div class="type-pill" [class.material]="item.type === 'material'" [class.expense]="item.type === 'expense'">
                  <ion-icon [name]="item.type === 'material' ? 'cube-outline' : 'cart-outline'"></ion-icon>
                  {{ item.type === 'material'
                      ? 'Material'
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

                    @if (item.type === 'expense') {
                      <div class="upload-field">
                        <ion-label class="upload-field-label">Given Amount (INR) *</ion-label>
                        <ion-input
                          type="number"
                          placeholder="Enter given amount"
                          [(ngModel)]="givenAmountInput"
                          class="upload-input"
                        ></ion-input>
                      </div>
                    }
                    
                    <div class="upload-field checkbox-field">
                      <ion-checkbox
                        [(ngModel)]="isReceivedInput"
                        class="received-checkbox"
                        aria-label="Received materials reached the site"
                      ></ion-checkbox>
                      <span class="received-label">Received (materials reached the site)</span>
                    </div>

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
                      {{ item.type === 'expense' ? 'Upload Bill & Enter Given Amount' : 'Upload Bill' }}
                    </ion-button>
                  </div>
                }
              }

              @if (activeTab === 'upload' && !item.needsUpload) {
                <div class="completed-notice">
                  <ion-icon name="checkmark-circle-outline"></ion-icon>
                  {{ item.type === 'expense' ? 'Bill uploaded & Given amount recorded' : 'Bill uploaded' }}
                </div>
              }
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .requests-content { --background: #f5f6f8; }
    .seg-wrap { padding: 0 16px 8px; }

    .cards { padding: 0 16px 96px; }
    .request-card {
      width: 100%; text-align: left;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 14px 16px;
      margin-bottom: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      border-left: 3px solid #c9a227;
    }
    .request-card.upload-mode { border-left-color: #002263; }

    .request-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
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
      border-radius: 6px;
    }
    .type-pill.material {
      background: rgba(220, 53, 69, 0.08);
      color: #dc3545;
    }
    .type-pill.expense {
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
    }
    .type-pill ion-icon { font-size: 13px; }

    .request-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 2px;
    }
    .request-subtitle {
      font-size: 12px;
      color: #64748b;
      margin: 0 0 6px;
    }
    .request-meta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #94a3b8;
      margin: 0 0 8px;
    }
    .request-meta ion-icon { font-size: 13px; }
    .meta-sep { color: #cbd5e1; }

    .amount-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 4px;
    }
    .amount-row.given { background: #f0fdf4; }
    .amount-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .amount-value {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .amount-row.given .amount-value { color: #16a34a; }

    .upload-cta { margin-top: 10px; }

    .upload-section {
      margin-top: 10px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
    }

    .file-preview {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #16a34a;
      font-weight: 600;
      margin-bottom: 8px;
      padding: 6px 10px;
      background: #f0fdf4;
      border-radius: 8px;
    }
    .file-preview ion-icon { font-size: 16px; }

    .upload-field {
      margin-bottom: 10px;
    }
    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .received-checkbox {
      --checkbox-background: #ffffff;
      --checkbox-background-checked: #002263;
      --border-color: #94a3b8;
      --border-color-checked: #002263;
      --checkbox-border-radius: 6px;
      --checkbox-size: 20px;
      margin: 0;
      flex: 0 0 auto;
    }
    .received-label {
      font-size: 13px;
      line-height: 1.35;
      color: #334155;
      font-weight: 600;
    }
    .upload-field-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 4px;
    }
    .upload-input {
      --background: #ffffff;
      --border-radius: 8px;
      --padding-start: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
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
      color: #16a34a;
      margin-top: 8px;
      padding: 6px 10px;
      background: #f0fdf4;
      border-radius: 8px;
    }
    .completed-notice ion-icon { font-size: 16px; }

    .skeleton-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 10px;
    }
  `],
})
export class RequestsPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  activeTab: 'approved' | 'declined' | 'upload' = 'approved';
  isLoading = signal(true);

  allItems = signal<RequestItem[]>([]);
  get filteredItems() {
    const items = this.allItems();
    if (this.activeTab === 'approved') {
      return items.filter(i => i.status === 'Approved' || i.status === 'Completed' || i.status === 'Received');
    }
    if (this.activeTab === 'declined') {
      return items.filter(i => i.status === 'Rejected');
    }
    // Upload tab: only show approved site-material expenses and approved materials that still need upload
    return items.filter(i =>
      i.status === 'Approved' && i.needsUpload
    );
  }

  uploadingItemId = signal<string | null>(null);
  selectedFileData = signal<string | null>(null);
  selectedFileName = signal<string | null>(null);
  selectedFileMimeType = signal<string | null>(null);
  givenAmountInput: number | null = null;
  isReceivedInput: boolean = false;
  isUploading = signal(false);

  get emptyIcon() {
    if (this.activeTab === 'approved') return 'checkmark-circle-outline';
    if (this.activeTab === 'declined') return 'close-circle-outline';
    return 'cloud-upload-outline';
  }

  get emptyTitle() {
    if (this.activeTab === 'approved') return 'No approved requests';
    if (this.activeTab === 'declined') return 'No declined requests';
    return 'Nothing to upload';
  }

  get emptyMessage() {
    if (this.activeTab === 'approved') return 'Approved material and purchase requests will appear here.';
    if (this.activeTab === 'declined') return 'Declined requests will appear here.';
    return 'All bills have been uploaded. Great job!';
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      checkmarkCircleOutline, closeCircleOutline, cloudUploadOutline,
      documentOutline, cubeOutline, cartOutline, timeOutline,
      imageOutline, cashOutline, chevronForwardOutline,
    });
    await this.supervisor.init();
    await this.loadAllRequests();
  }

  onTabChange(): void {
    this.cancelUpload();
  }

  async handleRefresh(event: CustomEvent): Promise<void> {
    await this.loadAllRequests();
    (event.target as HTMLIonRefresherElement).complete();
  }

  async loadAllRequests(): Promise<void> {
    this.isLoading.set(true);
    const items: RequestItem[] = [];

    try {
      // Load materials
      await new Promise<void>((resolve) => {
        this.supervisor.getMaterials({ limit: 200 }).subscribe({
          next: (res) => {
            for (const m of res.materials || []) {
              items.push({
                _id: m._id,
                type: 'material',
                title: m.name,
                subtitle: `${m.requestedQuantity} ${m.unit} requested`,
                site: m.site,
                date: m.requestDate,
                status: m.status,
                issuedAmount: m.issuedAmount,
                givenAmount: (m as any).givenAmount,
                billUrl: (m as any).billUrl,
                received: (m as any).status === 'Received',
                needsUpload: (m.status === 'Approved') && !(m as any).billUrl,
              });
            }
            resolve();
          },
          error: () => resolve(),
        });
      });

      // Load expenses — include ALL transaction types (Purchase + Add Cash)
      await new Promise<void>((resolve) => {
        this.supervisor.getExpenses({ type: 'site', limit: 200 }).subscribe({
          next: (res) => {
            for (const e of res.expenses || []) {
              // Display-friendly transaction type label
              const txLabel =
                e.transactionType === 'Cash Added' ? 'Add Cash' :
                (e.transactionType || 'Purchase');

              items.push({
                _id: e._id,
                type: 'expense',
                title: (e as any).isSiteMaterial
                  ? `${(e as any).materialName || e.description}`
                  : e.description,
                subtitle: (e as any).isSiteMaterial
                  ? `${(e as any).materialQuantity || ''} ${(e as any).materialUnit || ''} - ${txLabel}`
                  : `${txLabel} expense`,
                site: e.site || 'General',
                date: e.date,
                status: e.status,
                amount: e.amount,
                issuedAmount: e.issuedAmount,
                givenAmount: (e as any).givenAmount,
                billUrl: (e as any).billUrl,
                received: (e as any).received,
                transactionType: e.transactionType,
                needsUpload:
                  (e.status === 'Approved') &&
                  !(e as any).billUrl &&
                  ((e as any).isSiteMaterial === true),
              });
            }
            resolve();
          },
          error: () => resolve(),
        });
      });
    } catch (err) {
      console.error('[Requests] Failed to load', err);
    }

    this.allItems.set(items);
    this.isLoading.set(false);
  }

  getStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'Approved' || status === 'Completed' || status === 'Received') return 'success';
    if (status === 'Pending') return 'warning';
    if (status === 'Rejected') return 'danger';
    return 'neutral';
  }

  startUpload(item: RequestItem): void {
    this.uploadingItemId.set(item._id);
    this.givenAmountInput = null;
    this.selectedFileData.set(null);
    this.selectedFileName.set(null);
    this.selectedFileMimeType.set(null);
    // trigger file picker
    this.pickFile();
  }

  cancelUpload(): void {
    this.uploadingItemId.set(null);
    this.givenAmountInput = null;
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
    if (!this.selectedFileData() || !this.isReceivedInput || this.isUploading()) {
      return false;
    }
    if (item.type === 'expense') {
      return this.givenAmountInput !== null && this.givenAmountInput > 0;
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
    if (item.type === 'expense') {
      payload.givenAmount = this.givenAmountInput!;
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
        message: item.type === 'expense' ? 'Bill uploaded & Given Amount recorded successfully' : 'Bill uploaded successfully',
        duration: 2500,
        color: 'success',
        position: 'top',
      });
      await toast.present();
      this.cancelUpload();
      await this.loadAllRequests();
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
