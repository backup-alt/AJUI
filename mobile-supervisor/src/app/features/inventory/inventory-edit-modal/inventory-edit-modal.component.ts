import { Component, OnInit, inject, signal, Input } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonButton,
  IonInput,
  IonLabel,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { CurrencyPipe } from '@angular/common';
import { InventoryItem } from '../inventory.page';

@Component({
  selector: 'app-inventory-edit-modal',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonButton,
    IonInput,
    IonLabel,
    IonIcon,
    IonSpinner,
    FormsModule,
    CurrencyPipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Update Quantity</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="modal-content">
      <div class="modal-body">
        <div class="item-info">
          <h2>{{ item.name }}</h2>
          <p>{{ item.vendor ? 'Vendor: ' + item.vendor : 'No vendor' }}</p>
        </div>

        <div class="current-stock">
          <div class="stock-label">Current Stock</div>
          <div class="stock-value">
            {{ item.currentQuantity }} <span class="unit">{{ item.unit }}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">New Purchased Quantity (add to stock)</label>
          <ion-input
            type="number"
            [(ngModel)]="purchasedQty"
            [clearInput]="true"
            placeholder="0"
            class="form-input"
          ></ion-input>
        </div>

        <div class="form-group">
          <label class="form-label">Consumed Quantity (deduct from stock)</label>
          <ion-input
            type="number"
            [(ngModel)]="consumedQty"
            [clearInput]="true"
            placeholder="0"
            class="form-input"
          ></ion-input>
        </div>

        <div class="preview-stock">
          <span class="preview-label">New Stock:</span>
          <span class="preview-value" [class.negative]="newStock < 0">
            {{ newStock }} {{ item.unit }}
          </span>
        </div>

        <div class="modal-actions">
          <ion-button expand="block" fill="outline" (click)="dismiss()">
            Cancel
          </ion-button>
          <ion-button
            expand="block"
            [disabled]="!isValid() || isSubmitting()"
            (click)="submit()"
          >
            @if (isSubmitting()) {
              <ion-spinner name="crescent" slot="start"></ion-spinner>
              Updating...
            } @else {
              <ion-icon name="checkmark-outline" slot="start"></ion-icon>
              Update Stock
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .modal-content { --background: var(--m3-surface); }
    .modal-body { padding: var(--md-space-4); }

    .item-info {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-4);
    }
    .item-info h2 {
      font-size: 16px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 4px;
    }
    .item-info p {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      margin: 0;
    }

    .current-stock {
      background: var(--m3-primary-container);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-4);
      text-align: center;
    }
    .stock-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-on-primary-container);
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--md-space-2);
    }
    .stock-value {
      font-size: 28px;
      font-weight: 800;
      color: var(--m3-on-primary-container);
      line-height: 1;
    }
    .stock-value .unit {
      font-size: 14px;
      font-weight: 600;
      opacity: 0.75;
    }

    .form-group { margin-bottom: var(--md-space-4); }
    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--m3-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--md-space-2);
    }
    .form-input {
      --background: var(--m3-surface-bright);
      --border-radius: var(--md-radius-lg);
      --padding-start: var(--md-space-4);
      --padding-end: var(--md-space-4);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      font-size: 16px;
      font-weight: 700;
      color: var(--m3-on-surface);
    }

    .preview-stock {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--m3-surface-container);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-3) var(--md-space-4);
      margin-bottom: var(--md-space-5);
    }
    .preview-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--m3-on-surface-variant);
    }
    .preview-value {
      font-size: 18px;
      font-weight: 800;
      color: var(--m3-success);
    }
    .preview-value.negative { color: var(--m3-error); }

    .modal-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--md-space-3);
    }
  `],
})
export class InventoryEditModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private supervisor = inject(SupervisorService);
  private toastCtrl = inject(ToastController);

  @Input() item!: InventoryItem;
  purchasedQty: number | null = null;
  consumedQty: number | null = null;
  isSubmitting = signal(false);

  get newStock(): number {
    const current = this.item.currentQuantity;
    const add = this.purchasedQty || 0;
    const sub = this.consumedQty || 0;
    return current + add - sub;
  }

  ngOnInit(): void {
    addIcons({ closeOutline, checkmarkOutline });
  }

  isValid(): boolean {
    return this.newStock >= 0 && (this.purchasedQty !== null || this.consumedQty !== null);
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  async submit(): Promise<void> {
    if (!this.isValid()) return;
    this.isSubmitting.set(true);

    this.supervisor.updateMaterialStock(this.item._id, {
      purchasedQuantity: this.purchasedQty || undefined,
      consumedQuantity: this.consumedQty || undefined,
    }).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        await this.modalCtrl.dismiss({ updated: true });
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to update stock',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}