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
  IonItem,
  IonLabel,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { InventoryItem } from '../inventory.page';
import { ModalController } from '@ionic/angular/standalone';
import { Vendor } from '../../../shared/models';

const MATERIAL_UNITS = ['Bag', 'Nos', 'Kg', 'Load', 'Piece', 'Item', 'Ton', 'Litre', 'Cft'];

@Component({
  selector: 'app-inventory-request-modal',
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
    IonItem,
    IonLabel,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    FormsModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ preSelected ? 'Request More' : 'New Material Request' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="modal-content">
      <div class="modal-body">
        @if (preSelected) {
          <div class="item-banner">
            <div class="banner-info">
              <h2>{{ preSelected.name }}</h2>
              <p>Current stock: {{ preSelected.currentQuantity }} {{ preSelected.unit }}</p>
            </div>
          </div>
        }

        <div class="form-group">
          <label class="form-label">Material Name *</label>
          <ion-input
            class="form-input"
            [(ngModel)]="name"
            [clearInput]="true"
            placeholder="Enter material name"
          ></ion-input>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Quantity *</label>
            <ion-input
              class="form-input"
              type="number"
              [(ngModel)]="quantity"
              [clearInput]="true"
              placeholder="0"
            ></ion-input>
          </div>
          <div class="form-group">
            <label class="form-label">Unit *</label>
            <ion-select
              class="form-input"
              [(ngModel)]="unit"
              interface="popover"
              placeholder="Select unit"
            >
              @for (option of unitOptions; track option) {
                <ion-select-option [value]="option">{{ option }}</ion-select-option>
              }
            </ion-select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Issued Amount *</label>
            <ion-input
              class="form-input"
              type="number"
              [(ngModel)]="issuedAmount"
              [clearInput]="true"
              placeholder="0"
            ></ion-input>
          </div>
          <div class="form-group">
            <label class="form-label">Vendor *</label>
            <ion-select
              class="form-input"
              [(ngModel)]="vendorId"
              interface="popover"
              placeholder="Select vendor"
              (ionChange)="onVendorChange()"
            >
              @for (vendor of vendors(); track vendor._id) {
                <ion-select-option [value]="vendor._id">{{ vendor.name }}</ion-select-option>
              }
            </ion-select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Notes (optional)</label>
          <ion-textarea
            class="form-textarea"
            [(ngModel)]="notes"
            placeholder="Any additional notes..."
            [rows]="3"
            [autoGrow]="true"
          ></ion-textarea>
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
              Submitting...
            } @else {
              <ion-icon name="checkmark-outline" slot="start"></ion-icon>
              Submit Request
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .modal-content { --background: var(--m3-surface); }
    .modal-body { padding: var(--md-space-4); }

    .item-banner {
      background: var(--m3-primary-container);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-4);
    }
    .banner-info h2 {
      font-size: 15px;
      font-weight: 700;
      color: var(--m3-on-primary-container);
      margin: 0 0 4px;
    }
    .banner-info p {
      font-size: 12px;
      color: var(--m3-on-primary-container);
      opacity: 0.75;
      margin: 0;
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
      font-size: 15px;
      color: var(--m3-on-surface);
    }
    .form-textarea {
      --background: var(--m3-surface-bright);
      --padding-start: var(--md-space-4);
      --padding-end: var(--md-space-4);
      --padding-top: var(--md-space-3);
      --padding-bottom: var(--md-space-3);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      font-size: 15px;
      color: var(--m3-on-surface);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--md-space-3);
    }

    .modal-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--md-space-3);
      margin-top: var(--md-space-2);
    }
  `],
})
export class InventoryRequestModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private supervisor = inject(SupervisorService);
  private toastCtrl = inject(ToastController);

  @Input() preSelected: InventoryItem | null = null;
  name = '';
  quantity: number | null = null;
  unit = '';
  issuedAmount: number | null = null;
  vendorId = '';
  vendorName = '';
  notes = '';
  unitOptions = MATERIAL_UNITS;
  vendors = signal<Vendor[]>([]);
  isSubmitting = signal(false);

  ngOnInit(): void {
    addIcons({ closeOutline, checkmarkOutline });
    if (this.preSelected) {
      this.name = this.preSelected.name;
      this.unit = this.preSelected.unit;
      this.vendorName = this.preSelected.vendor || '';
    }
    this.loadVendors();
  }

  isValid(): boolean {
    return !!this.name.trim()
      && this.quantity !== null
      && this.quantity > 0
      && !!this.unit.trim()
      && this.issuedAmount !== null
      && this.issuedAmount >= 0
      && !!this.vendorName.trim();
  }

  loadVendors(): void {
    this.supervisor.getVendors({ limit: 100 }).subscribe({
      next: (res) => this.vendors.set(res.items || []),
      error: () => this.vendors.set([]),
    });
  }

  onVendorChange(): void {
    const selected = this.vendors().find((vendor) => vendor._id === this.vendorId);
    this.vendorName = selected?.name || '';
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  async submit(): Promise<void> {
    if (!this.isValid()) return;

    const siteId = this.supervisor.selectedSiteId();
    const siteName = this.supervisor.selectedSiteName();
    const projectId = this.supervisor.selectedProjectId();

    if (!siteId || !siteName || !projectId) {
      const toast = await this.toastCtrl.create({
        message: 'Please select a site first',
        duration: 2500,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    this.isSubmitting.set(true);

    this.supervisor.createMaterial({
      projectId,
      siteId,
      site: siteName,
      name: this.name.trim(),
      unit: this.unit.trim(),
      requestedQuantity: this.quantity!,
      issuedAmount: this.issuedAmount!,
      vendor: this.vendorName.trim(),
      vendorId: this.vendorId || undefined,
      requestDate: new Date().toISOString().slice(0, 10),
      notes: this.notes.trim() || undefined,
    }).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agb:inventory-changed', { detail: { reason: 'requested' } }));
        }
        await this.modalCtrl.dismiss({ requested: true });
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to submit request',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
