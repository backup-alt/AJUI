import { Component, OnInit, inject, signal } from '@angular/core';
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
  IonIcon,
  IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  cartOutline,
  cashOutline,
  checkmarkCircleOutline,
  cubeOutline,
  locationOutline,
  walletOutline,
  warningOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Vendor } from '../../../shared/models';

@Component({
  selector: 'app-expense-create',
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
    IonIcon,
    IonSpinner,
    FormsModule,
    CurrencyPipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="step() === 1 ? '/tabs/expenses' : undefined" (click)="step() === 2 ? step.set(1) : null"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ getTitle() }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="create-content">
      <div class="form-container">
        @if (step() === 1) {
          <div class="page-header">
            <div class="page-icon">
              <ion-icon name="wallet-outline"></ion-icon>
            </div>
            <div>
              <h1 class="page-title">Site Expense</h1>
              <p class="page-subtitle">Record a site expense for approval</p>
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

          <div class="type-grid">
            <div class="type-card" [class.selected]="expenseType() === 'Purchase'" (click)="selectType('Purchase')">
              <div class="type-icon">
                <ion-icon name="cart-outline"></ion-icon>
              </div>
              <div class="type-info">
                <strong>Purchase</strong>
                <span>Record a purchase expense (goes through approval, checks balance)</span>
              </div>
            </div>
            <div class="type-card" [class.selected]="expenseType() === 'Cash Added'" (click)="selectType('Cash Added')">
              <div class="type-icon type-icon-gold">
                <ion-icon name="cash-outline"></ion-icon>
              </div>
              <div class="type-info">
                <strong>Cash Added</strong>
                <span>Add cash to site (goes through approval)</span>
              </div>
            </div>
            <div class="type-card" [class.selected]="expenseType() === 'Site Material'" (click)="selectType('Site Material')">
              <div class="type-icon type-icon-green">
                <ion-icon name="cube-outline"></ion-icon>
              </div>
              <div class="type-info">
                <strong>Site Material</strong>
                <span>Request materials for site (creates material record on approval)</span>
              </div>
            </div>
          </div>

          <ion-button expand="block" [disabled]="!expenseType()" (click)="goToStep2()">
            Continue
          </ion-button>
        }

        @if (step() === 2) {
          @if (expenseType() === 'Purchase' && currentBalance() !== null) {
            <div class="balance-banner" [class.warning]="currentBalance()! < (expense.amount || 0)">
              <div class="balance-info">
                <span class="balance-label">Available Balance</span>
                <span class="balance-value" [class.negative]="currentBalance()! < 0">{{ currentBalance()! | currency:'INR':'symbol':'1.0-0' }}</span>
              </div>
              @if (expense.amount && expense.amount > currentBalance()!) {
                <div class="balance-warning">
                  <ion-icon name="warning-outline"></ion-icon>
                  Amount exceeds available balance
                </div>
              }
            </div>
          }

          <ion-list lines="none" class="form-list">
            @if (expenseType() === 'Site Material') {
              <ion-item class="form-item">
                <ion-label position="stacked">Material Name *</ion-label>
                <ion-input
                  placeholder="e.g., Cement, Sand, Bricks"
                  [(ngModel)]="expense.materialName"
                  [clearInput]="true"
                ></ion-input>
              </ion-item>

              <ion-item class="form-item">
                <ion-label position="stacked">Unit *</ion-label>
                <ion-select
                  placeholder="Select Unit"
                  [(ngModel)]="expense.materialUnit"
                  interface="popover"
                >
                  <ion-select-option value="kg">Kilograms (kg)</ion-select-option>
                  <ion-select-option value="bags">Bags</ion-select-option>
                  <ion-select-option value="tons">Tons</ion-select-option>
                  <ion-select-option value="cubic meters">Cubic Meters (m³)</ion-select-option>
                  <ion-select-option value="pieces">Pieces</ion-select-option>
                  <ion-select-option value="units">Units</ion-select-option>
                  <ion-select-option value="liters">Liters</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item class="form-item">
                <ion-label position="stacked">Quantity *</ion-label>
                <ion-input
                  type="number"
                  placeholder="0"
                  [(ngModel)]="expense.materialQuantity"
                  [clearInput]="true"
                ></ion-input>
              </ion-item>

              <ion-item class="form-item">
                <ion-label position="stacked">Vendor</ion-label>
                <ion-select
                  placeholder="Select Vendor"
                  [(ngModel)]="expense.materialVendorId"
                  interface="popover"
                >
                  @for (vendor of vendors(); track vendor._id) {
                    <ion-select-option [value]="vendor._id">{{ vendor.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
            }

            <ion-item class="form-item">
              <ion-label position="stacked">Description *</ion-label>
              <ion-input
                placeholder="e.g., Sand delivery"
                [(ngModel)]="expense.description"
                [clearInput]="true"
              ></ion-input>
            </ion-item>

            <ion-item class="form-item">
              <ion-label position="stacked">Amount (INR) *</ion-label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="expense.amount"
                (ionInput)="onAmountChange()"
                [clearInput]="true"
              ></ion-input>
            </ion-item>

            @if (expenseType() === 'Purchase') {
              <ion-item class="form-item">
                <ion-label position="stacked">Transaction Type *</ion-label>
                <ion-select
                  placeholder="Select Type"
                  [(ngModel)]="expense.transactionType"
                  interface="popover"
                >
                  <ion-select-option value="Material">Material</ion-select-option>
                  <ion-select-option value="Labour">Labour</ion-select-option>
                  <ion-select-option value="Transport">Transport</ion-select-option>
                  <ion-select-option value="Equipment">Equipment</ion-select-option>
                  <ion-select-option value="Food">Food & Refreshments</ion-select-option>
                  <ion-select-option value="Fuel">Fuel</ion-select-option>
                  <ion-select-option value="Other">Other</ion-select-option>
                </ion-select>
              </ion-item>
            }

            <ion-item class="form-item">
              <ion-label position="stacked">Reference / Bill No.</ion-label>
              <ion-input
                placeholder="Optional"
                [(ngModel)]="expense.reference"
                [clearInput]="true"
              ></ion-input>
            </ion-item>

            <ion-item class="form-item form-item-last">
              <ion-label position="stacked">Amount Paid By</ion-label>
              <ion-input
                placeholder="e.g., Cash, Bank, Personal"
                [(ngModel)]="expense.amountPaidBy"
                [clearInput]="true"
              ></ion-input>
            </ion-item>
          </ion-list>

          @if (expenseType() === 'Purchase' && expense.amount && expense.amount > currentBalance()!) {
            <div class="block-notice">
              <ion-icon name="alert-circle-outline"></ion-icon>
              Cannot submit - amount exceeds available balance
            </div>
          }

          <div class="form-actions">
            <ion-button
              expand="block"
              [disabled]="!isValid() || isSubmitting() || (expenseType() === 'Purchase' && expense.amount! > currentBalance()!)"
              (click)="submit()"
            >
              @if (isSubmitting()) {
                <ion-spinner name="crescent" slot="start"></ion-spinner>
                Submitting...
              } @else {
                {{ getSubmitLabel() }}
              }
            </ion-button>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .create-content { --background: #f5f6f8; }
    .form-container { padding: 16px; }
    .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
    .page-icon { width: 48px; height: 48px; background: rgba(217, 119, 6, 0.1); color: #d97706; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
    .page-icon ion-icon { font-size: 24px; }
    .page-title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.4px; }
    .page-subtitle { font-size: 12px; color: #6b7280; margin: 0; }
    .site-banner { display: flex; align-items: center; gap: 10px; background: #ffffff; border: 1px solid #e5e7eb; border-left: 3px solid #c9a227; padding: 12px 14px; margin-bottom: 16px; }
    .site-banner ion-icon { font-size: 18px; color: #c9a227; }
    .site-banner-label { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .site-banner-value { font-size: 14px; font-weight: 600; color: #111827; }
    .type-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
    .type-card { display: flex; align-items: center; gap: 14px; background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; cursor: pointer; transition: all 0.15s; }
    .type-card:active { transform: scale(0.98); }
    .type-card.selected { border-color: #002263; background: #f0f4ff; }
    .type-icon { width: 44px; height: 44px; background: rgba(0, 34, 99, 0.08); color: #002263; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .type-icon ion-icon { font-size: 22px; }
    .type-icon.type-icon-gold { background: rgba(201, 162, 39, 0.12); color: #c9a227; }
    .type-icon.type-icon-green { background: rgba(16, 185, 129, 0.12); color: #10b981; }
    .type-info { display: flex; flex-direction: column; gap: 2px; }
    .type-info strong { font-size: 14px; font-weight: 600; color: #111827; }
    .type-info span { font-size: 12px; color: #6b7280; }
    .balance-banner { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #fff; border: 1px solid #e5e7eb; border-left: 3px solid #c9a227; border-radius: 8px; margin-bottom: 16px; }
    .balance-banner.warning { border-left-color: #dc2626; background: #fff5f5; }
    .balance-info { display: flex; flex-direction: column; gap: 2px; }
    .balance-label { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .balance-value { font-size: 18px; font-weight: 700; color: #002263; }
    .balance-value.negative { color: #dc2626; }
    .balance-warning { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #dc2626; font-weight: 600; }
    .block-notice { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fff5f5; border: 1px solid #fca5a5; border-radius: 8px; color: #dc2626; font-size: 13px; font-weight: 500; margin-bottom: 12px; }
    .form-list { background: transparent; padding: 0; }
    .form-item { --background: #ffffff; --border-radius: 0 !important; --inner-border-radius: 0 !important; --padding-start: 14px; --padding-end: 14px; --min-height: 64px; border: 1px solid #e5e7eb; border-bottom: none; margin-bottom: 0; }
    .form-item.form-item-last { border-bottom: 1px solid #e5e7eb; }
    .form-actions { padding: 20px 0; }
  `],
})
export class ExpenseCreatePage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  expense = {
    description: '',
    amount: null as number | null,
    transactionType: '',
    reference: '',
    amountPaidBy: '',
    notes: '',
    materialName: '',
    materialUnit: '',
    materialQuantity: null as number | null,
    materialVendorId: '',
    materialVendor: '',
  };

  step = signal(1);
  expenseType = signal<'Purchase' | 'Cash Added' | 'Site Material' | ''>('');
  isSubmitting = signal(false);
  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  siteProjectId = signal<string | null>(null);
  currentBalance = signal<number | null>(null);
  vendors = signal<Vendor[]>([]);

  async ngOnInit(): Promise<void> {
    addIcons({
      alertCircleOutline,
      cartOutline,
      cashOutline,
      checkmarkCircleOutline,
      cubeOutline,
      locationOutline,
      walletOutline,
      warningOutline,
    });
    await this.supervisor.init();
    this.selectedSiteId.set(this.supervisor.selectedSiteId());
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    this.siteProjectId.set(this.supervisor.selectedProjectId());
    await this.loadVendors();
  }

  selectType(type: 'Purchase' | 'Cash Added' | 'Site Material') {
    this.expenseType.set(type);
  }

  getTitle(): string {
    if (this.step() === 1) return 'Log Expense';
    switch (this.expenseType()) {
      case 'Cash Added': return 'Cash Added';
      case 'Site Material': return 'Site Material';
      default: return 'Purchase Expense';
    }
  }

  getSubmitLabel(): string {
    switch (this.expenseType()) {
      case 'Cash Added': return 'Submit Cash Added';
      case 'Site Material': return 'Submit Site Material';
      default: return 'Submit Purchase';
    }
  }

  async loadVendors() {
    this.supervisor.getVendors({ limit: 100 }).subscribe({
      next: (res) => this.vendors.set(res.items || []),
      error: () => this.vendors.set([]),
    });
  }

  async goToStep2() {
    if (!this.expenseType()) return;
    this.step.set(2);
    if (this.expenseType() === 'Purchase') {
      await this.loadBalance();
    }
  }

  async loadBalance() {
    const siteId = this.supervisor.selectedSiteId();
    const projectId = this.supervisor.selectedProjectId();
    this.supervisor
      .getExpenses({
        siteId: siteId ?? undefined,
        projectId: projectId ?? undefined,
        type: 'site',
        limit: 100,
      })
      .subscribe({
        next: (res) => {
          const cashAdded = res.expenses
            .filter((e) => e.status === 'Approved' && e.transactionType === 'Cash Added')
            .reduce((s, e) => s + (e.amount || 0), 0);
          const spent = res.expenses
            .filter((e) => e.status === 'Approved' && e.transactionType !== 'Cash Added')
            .reduce((s, e) => s + (e.amount || 0), 0);
          this.currentBalance.set(cashAdded - spent);
        },
        error: () => this.currentBalance.set(0),
      });
  }

  onAmountChange() {
    // Trigger reactivity
  }

  isValid(): boolean {
    if (this.expenseType() === 'Site Material') {
      return !!(
        this.expense.materialName &&
        this.expense.materialUnit &&
        this.expense.materialQuantity &&
        this.expense.description &&
        this.expense.amount
      );
    }
    if (this.expenseType() === 'Purchase') {
      return !!(this.expense.description && this.expense.amount && this.expense.transactionType);
    }
    return !!(this.expense.description && this.expense.amount);
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

    // Hard block: Purchase exceeding balance
    if (this.expenseType() === 'Purchase' && this.expense.amount! > this.currentBalance()!) {
      const toast = await this.toastCtrl.create({
        message: 'Cannot submit - amount exceeds available balance',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
      return;
    }

    this.isSubmitting.set(true);

    const isSiteMaterial = this.expenseType() === 'Site Material';
    const selectedVendor = this.vendors().find(v => v._id === this.expense.materialVendorId);

    const payload: any = {
      type: 'site',
      projectId,
      siteId,
      site: siteName,
      transactionType: isSiteMaterial ? 'Site Material' : (this.expenseType() === 'Cash Added' ? 'Cash Added' : this.expense.transactionType),
      reference: this.expense.reference || undefined,
      amountPaidBy: this.expense.amountPaidBy || undefined,
      amount: this.expense.amount || 0,
      date: new Date().toISOString().slice(0, 10),
      description: this.expense.description,
      isSiteMaterial,
      materialName: isSiteMaterial ? this.expense.materialName : undefined,
      materialUnit: isSiteMaterial ? this.expense.materialUnit : undefined,
      materialQuantity: isSiteMaterial ? this.expense.materialQuantity : undefined,
      materialVendor: selectedVendor?.name || this.expense.materialVendor || undefined,
      materialVendorId: isSiteMaterial ? this.expense.materialVendorId : undefined,
    };

    this.supervisor.createExpense(payload).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: this.expenseType() === 'Cash Added' ? 'Cash Added submitted for approval' :
                   this.expenseType() === 'Site Material' ? 'Site Material submitted for approval' : 'Expense submitted for approval',
          duration: 2500,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        this.router.navigate(['/tabs/expenses']);
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to submit expense',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
