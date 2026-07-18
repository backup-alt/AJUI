import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonIcon,
  IonSpinner,
  IonCheckbox,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { locationOutline, cubeOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { CustomFieldsService } from '../../../core/services/custom-fields.service';
import { CustomField } from '../../../shared/models';
import { Vendor } from '../../../shared/models';

@Component({
  selector: 'app-material-create',
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
    IonList,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonIcon,
    IonSpinner,
    IonCheckbox,
    FormsModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/materials"></ion-back-button>
        </ion-buttons>
        <ion-title>New Material Request</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="create-content">
      <div class="form-container">
        <div class="page-header">
          <div class="page-icon">
            <ion-icon name="cube-outline"></ion-icon>
          </div>
          <div>
            <h1 class="page-title">Material Request</h1>
            <p class="page-subtitle">Submit a new material request for your site</p>
          </div>
        </div>

        @if (selectedSiteName()) {
          <div class="site-banner">
            <ion-icon name="location-outline"></ion-icon>
            <div>
              <div class="site-banner-label">Site</div>
              <div class="site-banner-value">{{ selectedSiteName() }}</div>
            </div>
          </div>
        }

        <ion-list lines="none" class="form-list">
          <ion-item class="form-item">
            <ion-label position="stacked">Material Name *</ion-label>
            <ion-input
              placeholder="e.g., Cement 53 Grade"
              [(ngModel)]="material.name"
              [clearInput]="true"
            ></ion-input>
          </ion-item>

          <div class="form-row">
            <ion-item class="form-item form-item-half">
              <ion-label position="stacked">Quantity *</ion-label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="material.requestedQuantity"
                [clearInput]="true"
              ></ion-input>
            </ion-item>

            <ion-item class="form-item form-item-half">
              <ion-label position="stacked">Unit *</ion-label>
              <ion-select
                placeholder="Select"
                [(ngModel)]="material.unit"
                interface="popover"
              >
                <ion-select-option value="bags">Bags</ion-select-option>
                <ion-select-option value="tons">Tons</ion-select-option>
                <ion-select-option value="cubic meters">Cubic Meters</ion-select-option>
                <ion-select-option value="pieces">Pieces</ion-select-option>
                <ion-select-option value="kg">Kilograms</ion-select-option>
                <ion-select-option value="liters">Liters</ion-select-option>
                <ion-select-option value="meters">Meters</ion-select-option>
              </ion-select>
            </ion-item>
          </div>

          <ion-item class="form-item">
            <ion-label position="stacked">Vendor Name</ion-label>
            <ion-select placeholder="Select vendor" [(ngModel)]="material.vendor" interface="popover">
              @for (v of vendors(); track v._id) {
                <ion-select-option [value]="v.name">{{ v.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <div class="form-row">
            <ion-item class="form-item form-item-half">
              <ion-label position="stacked">Remaining Stock</ion-label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="material.remainingStock"
                [clearInput]="true"
              ></ion-input>
            </ion-item>

            <ion-item class="form-item form-item-half form-item-last">
              <ion-label position="stacked">Issued Amt (INR) *</ion-label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="material.issuedAmount"
                [clearInput]="true"
              ></ion-input>
            </ion-item>
          </div>

          <ion-item class="form-item">
            <ion-label position="stacked">Notes</ion-label>
            <ion-textarea
              placeholder="Additional notes..."
              [(ngModel)]="material.notes"
              [rows]="3"
              [autoGrow]="true"
            ></ion-textarea>
          </ion-item>

          @if (customFields().length > 0) {
            <div class="custom-fields-section">
              <div class="custom-fields-header">Additional Fields</div>
              @for (field of customFields(); track field.id) {
                <ion-item class="form-item custom-field-item">
                  <ion-label position="stacked">{{ field.label }}@if (field.fieldType === 'number' || field.fieldType === 'text' || field.fieldType === 'date') { * }</ion-label>
                  @if (field.fieldType === 'boolean') {
                    <ion-checkbox
                      [checked]="customFieldValues()[field.key] === true"
                      (ionChange)="setCustomFieldValue(field.key, $event.detail.checked)"
                    ></ion-checkbox>
                  } @else if (field.fieldType === 'date') {
                    <ion-input
                      type="date"
                      [value]="customFieldValues()[field.key] || ''"
                      (ionChange)="setCustomFieldValue(field.key, $event.detail.value ?? null)"
                    ></ion-input>
                  } @else if (field.fieldType === 'number') {
                    <ion-input
                      type="number"
                      placeholder="0"
                      [value]="customFieldValues()[field.key] || ''"
                      (ionChange)="setCustomFieldValueAsNumber(field.key, $event.detail.value)"
                    ></ion-input>
                  } @else {
                    <ion-input
                      placeholder="Enter {{ field.label.toLowerCase() }}"
                      [value]="customFieldValues()[field.key] || ''"
                      (ionChange)="setCustomFieldValue(field.key, $event.detail.value ?? null)"
                    ></ion-input>
                  }
                </ion-item>
              }
            </div>
          }
        </ion-list>

        <div class="form-actions">
          <ion-button expand="block" [disabled]="!isValid() || isSubmitting()" (click)="submit()">
            @if (isSubmitting()) {
              <ion-spinner name="crescent" slot="start"></ion-spinner>
              Submitting...
            } @else {
              Submit Request
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .create-content {
      --background: #f5f6f8;
    }
    .form-container {
      padding: 16px;
    }
    .page-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .page-icon {
      width: 48px;
      height: 48px;
      background: rgba(220, 53, 69, 0.1);
      color: #dc3545;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .page-icon ion-icon {
      font-size: 24px;
    }
    .page-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 2px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .page-subtitle {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
    }
    .site-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-left: 3px solid #c9a227;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .site-banner ion-icon {
      font-size: 18px;
      color: #c9a227;
    }
    .site-banner-label {
      font-size: 10px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .site-banner-value {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    .form-list {
      background: transparent;
      padding: 0;
    }
    .form-item {
      --background: #ffffff;
      --border-radius: 0 !important;
      --inner-border-radius: 0 !important;
      --padding-start: 14px;
      --padding-end: 14px;
      --min-height: 64px;
      border: 1px solid #e5e7eb;
      border-bottom: none;
      margin-bottom: 0;
    }
    .form-item:last-of-type {
      border-bottom: 1px solid #e5e7eb;
    }
    .form-item-half {
      width: 100%;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 0;
    }
    .form-row .form-item {
      border-right: 1px solid #e5e7eb;
    }
    .form-row .form-item:last-of-type {
      border-right: none;
    }
    .custom-fields-section {
      margin-top: 24px;
    }
    .custom-fields-header {
      font-size: 12px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .custom-field-item {
      border-top: 1px solid #e5e7eb;
    }
    .form-actions {
      padding: 20px 0;
    }
  `],
})
export class MaterialCreatePage implements OnInit {
  private supervisor = inject(SupervisorService);
  private customFieldsService = inject(CustomFieldsService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  material = {
    name: '',
    requestedQuantity: null as number | null,
    remainingStock: null as number | null,
    unit: '',
    vendor: '',
    issuedAmount: null as number | null,
    notes: '',
  };

  isSubmitting = signal(false);
  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  siteProjectId = signal<string | null>(null);
  customFields = signal<CustomField[]>([]);
  customFieldValues = signal<Record<string, string | number | boolean | null>>({});
  vendors = signal<Vendor[]>([]);

  async ngOnInit(): Promise<void> {
    addIcons({ locationOutline, cubeOutline });
    await this.supervisor.init();
    this.selectedSiteId.set(this.supervisor.selectedSiteId());
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    this.siteProjectId.set(this.supervisor.selectedProjectId());
    await Promise.all([this.loadCustomFields(), this.loadVendors()]);
  }

  async loadVendors(): Promise<void> {
    try {
      const res = await firstValueFrom(this.supervisor.getVendors({ limit: 200 }));
      this.vendors.set(res.items || []);
    } catch (err) {
      console.warn('[MaterialCreate] failed to load vendors', err);
    }
  }

  async loadCustomFields(): Promise<void> {
    const siteId = this.selectedSiteId();
    if (!siteId) return;
    try {
      const fields = await this.customFieldsService.listForEntity('materials', siteId);
      this.customFields.set(fields);
      const values: Record<string, string | number | boolean | null> = {};
      for (const f of fields) {
        values[f.key] = f.value ?? null;
      }
      this.customFieldValues.set(values);
    } catch (err) {
      console.warn('[MaterialCreate] failed to load custom fields', err);
    }
  }

  setCustomFieldValue(key: string, value: string | number | boolean | null): void {
    this.customFieldValues.update((prev) => ({ ...prev, [key]: value }));
  }

  setCustomFieldValueAsNumber(key: string, raw: string | null | undefined): void {
    this.customFieldValues.update((prev) => ({
      ...prev,
      [key]: raw ? Number(raw) : null,
    }));
  }

  isValid(): boolean {
    return !!(
      this.material.name.trim() &&
      this.material.requestedQuantity &&
      this.material.requestedQuantity > 0 &&
      this.material.unit &&
      this.material.issuedAmount !== null &&
      this.material.issuedAmount > 0
    );
  }

  async submit(): Promise<void> {
    if (!this.isValid()) return;

    const siteId = this.selectedSiteId();
    const siteName = this.selectedSiteName();
    const projectId = this.siteProjectId();

    if (!siteId || !siteName) {
      const toast = await this.toastCtrl.create({
        message: 'Please select a site first',
        duration: 2500,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    if (!projectId) {
      const toast = await this.toastCtrl.create({
        message: 'Project for this site is not set. Please contact admin.',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
      return;
    }

    this.isSubmitting.set(true);

    const remainingStock = this.material.remainingStock;
    const customValues = this.customFieldValues();
    const hasCustomValues = Object.values(customValues).some((v) => v !== null && v !== '');

    const payload: {
      projectId: string;
      siteId: string;
      site: string;
      name: string;
      unit: string;
      requestedQuantity: number;
      remainingStock?: number;
      vendor?: string;
      requestDate: string;
      notes?: string;
      customFields?: Record<string, string | number | boolean | null>;
    } = {
      projectId,
      siteId,
      site: siteName,
      name: this.material.name.trim(),
      unit: this.material.unit,
      requestedQuantity: this.material.requestedQuantity || 0,
      vendor: this.material.vendor || undefined,
      issuedAmount: this.material.issuedAmount || 0,
      requestDate: new Date().toISOString().slice(0, 10),
      notes: this.material.notes || undefined,
    };

    if (remainingStock !== null && remainingStock >= 0) {
      payload.remainingStock = remainingStock;
    }

    if (hasCustomValues) {
      payload.customFields = customValues;
    }

    this.supervisor.createMaterial(payload).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: 'Material request submitted successfully',
          duration: 2500,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        this.router.navigate(['/tabs/materials']);
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
