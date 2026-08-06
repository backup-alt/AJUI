import { Component, OnInit, inject, signal, Input } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonInput,
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
import {
  MaterialAutocompleteComponent,
  MaterialAutocompleteMatch,
} from '../../../shared/components';

const MATERIAL_UNITS = ['Bag', 'Nos', 'Kg', 'Load', 'Piece', 'Item', 'Ton', 'Litre', 'Cft'];

@Component({
  selector: 'app-inventory-request-modal',
  standalone: true,
imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    FormsModule,
    MaterialAutocompleteComponent,
  ],
  template: `
    <ion-header class="modal-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()" class="close-button">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ mode === 'existing' ? 'Add Existing Material' : (preSelected ? 'Request More' : 'New Material Request') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="modal-content">
      <div class="modal-body">
        @if (preSelected) {
          <div class="item-banner">
            <div class="banner-icon">
              <ion-icon name="cube-outline"></ion-icon>
            </div>
            <div class="banner-info">
              <h2>{{ preSelected.name }}</h2>
              <p>Current stock: {{ preSelected.currentQuantity }} {{ preSelected.unit }}</p>
            </div>
          </div>
        }

        <div class="form-section">
          <div class="form-group">
            <label class="form-label">Material Name *</label>
            <app-material-autocomplete
              [ngModel]="name"
              (ngModelChange)="name = $event"
              (matchSelected)="onMaterialMatch($event)"
              [catalog]="materialCatalog"
              placeholder="Search or enter material name"
            ></app-material-autocomplete>
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

          @if (mode === 'request') {
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
          } @else {
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Vendor (optional)</label>
                <ion-select class="form-input" [(ngModel)]="vendorId" interface="popover" placeholder="Select vendor" (ionChange)="onVendorChange()">
                  @for (vendor of vendors(); track vendor._id) {
                    <ion-select-option [value]="vendor._id">{{ vendor.name }}</ion-select-option>
                  }
                </ion-select>
              </div>
              <div class="form-group">
                <label class="form-label">PO Number (optional)</label>
                <ion-input class="form-input" [(ngModel)]="poNumber" placeholder="PO number"></ion-input>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Minimum Stock (optional)</label>
              <ion-input class="form-input" type="number" [(ngModel)]="minimumQuantity" placeholder="0"></ion-input>
            </div>
          }

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
        </div>

        <div class="modal-actions">
          <ion-button expand="block" fill="outline" (click)="dismiss()" class="cancel-btn">
            Cancel
          </ion-button>
          <ion-button
            expand="block"
            [disabled]="!isValid() || isSubmitting()"
            (click)="submit()"
            class="submit-btn"
          >
            @if (isSubmitting()) {
              <ion-spinner name="crescent" slot="start"></ion-spinner>
              Submitting...
            } @else {
              <ion-icon name="checkmark-outline" slot="start"></ion-icon>
              {{ mode === 'existing' ? 'Add to Inventory' : 'Submit Request' }}
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .modal-header ion-toolbar {
      --background: var(--m3-surface-bright);
      --border-width: 0;
    }

    .modal-header ion-title {
      font-weight: 700;
      font-size: 17px;
      color: var(--m3-on-surface);
    }

    .close-button {
      --color: var(--m3-on-surface-variant);
    }

    .modal-content {
      --background: var(--m3-surface);
    }

    .modal-body {
      padding: var(--md-space-4);
      animation: fadeInUp 0.25s ease;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .item-banner {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      background: linear-gradient(135deg, rgba(0, 34, 99, 0.06) 0%, rgba(0, 34, 99, 0.03) 100%);
      border: 1px solid rgba(0, 34, 99, 0.12);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-5);
    }

    .banner-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--md-radius-lg);
      background: var(--m3-primary);
      color: var(--m3-on-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .banner-icon ion-icon {
      font-size: 22px;
    }

    .banner-info h2 {
      font-size: 15px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 3px;
    }

    .banner-info p {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      margin: 0;
    }

    .form-section {
      margin-bottom: var(--md-space-4);
    }

    .form-group {
      margin-bottom: var(--md-space-4);
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

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
      --min-height: 48px;
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      font-size: 15px;
      color: var(--m3-on-surface);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .form-input:focus-within {
      border-color: var(--m3-primary);
      box-shadow: 0 0 0 3px rgba(0, 34, 99, 0.08);
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
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .form-textarea:focus-within {
      border-color: var(--m3-primary);
      box-shadow: 0 0 0 3px rgba(0, 34, 99, 0.08);
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
      margin-top: var(--md-space-5);
      padding-top: var(--md-space-4);
      border-top: 1px solid var(--m3-outline-variant);
    }

    .cancel-btn {
      --border-radius: var(--md-radius-lg);
      --border-color: var(--m3-outline-variant);
      --color: var(--m3-on-surface-variant);
      font-weight: 600;
      font-size: 15px;
      --min-height: 48px;
    }

    .submit-btn {
      --border-radius: var(--md-radius-lg);
      --background: var(--m3-primary);
      --color: var(--m3-on-primary);
      font-weight: 700;
      font-size: 15px;
      --min-height: 48px;
      --box-shadow: 0 2px 8px rgba(0, 34, 99, 0.25);
    }

    .submit-btn:active {
      transform: scale(0.98);
    }
  `],
})
export class InventoryRequestModalComponent implements OnInit {
private modalCtrl = inject(ModalController);
  private supervisor = inject(SupervisorService);
  private toastCtrl = inject(ToastController);

  @Input() preSelected: InventoryItem | null = null;
  @Input() mode: 'request' | 'existing' = 'request';
  @Input() materialCatalog: MaterialAutocompleteMatch[] = [];
  name = '';
  quantity: number | null = null;
  unit = '';
  issuedAmount: number | null = null;
  vendorId = '';
  vendorName = '';
  poNumber = '';
  minimumQuantity: number | null = null;
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
      this.poNumber = this.preSelected.poNumber || '';
      if (this.preSelected.minimumQuantity != null) {
        this.minimumQuantity = this.preSelected.minimumQuantity;
      }
    }
    this.loadVendors();
  }

  onMaterialMatch(match: MaterialAutocompleteMatch | null): void {
    // Fired by the autocomplete component when a suggestion is picked
    // OR the input is blurred with a value that exactly matches a
    // catalog entry. We never autofill on partial / in-progress typing.
    if (!match) return;
    if (match.unit && !this.unit) this.unit = match.unit;
    if (match.vendor && !this.vendorName) this.vendorName = match.vendor;
    if (match.vendorId && !this.vendorId) this.vendorId = match.vendorId;
    if (match.poNumber && !this.poNumber) this.poNumber = match.poNumber;
    if (match.minimumQuantity != null && this.minimumQuantity == null) {
      this.minimumQuantity = match.minimumQuantity;
    }
  }

  loadVendors(): void {
    this.supervisor.getVendors({ limit: 25 }).subscribe({
      next: (res) => this.vendors.set(res.items || []),
      error: () => this.vendors.set([]),
    });
  }

  onVendorChange(): void {
    const selected = this.vendors().find((vendor) => vendor._id === this.vendorId);
    this.vendorName = selected?.name || '';
  }

  isValid(): boolean {
    const baseValid = !!this.name.trim()
      && this.quantity !== null
      && this.quantity > 0
      && !!this.unit.trim();
    if (this.mode === 'existing') return baseValid;
    return baseValid && this.issuedAmount !== null
      && this.issuedAmount >= 0
      && !!this.vendorName.trim();
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

    if (this.mode === 'existing') {
      this.supervisor.addExistingMaterial({
        projectId,
        siteId,
        site: siteName,
        name: this.name.trim(),
        unit: this.unit.trim(),
        quantity: this.quantity!,
        vendor: this.vendorName.trim() || undefined,
        vendorId: this.vendorId || undefined,
        poNumber: this.poNumber.trim() || undefined,
        minimumQuantity: this.minimumQuantity === null ? undefined : Math.max(0, Number(this.minimumQuantity) || 0),
        notes: this.notes.trim() || undefined,
      }).subscribe({
        next: async (result) => {
          this.isSubmitting.set(false);
          await this.modalCtrl.dismiss({ added: true, message: result.message });
        },
        error: async (err) => {
          this.isSubmitting.set(false);
          const toast = await this.toastCtrl.create({
            message: err?.message || 'Failed to update inventory',
            duration: 3000,
            color: 'danger',
            position: 'top',
          });
          await toast.present();
        },
      });
      return;
    }

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
