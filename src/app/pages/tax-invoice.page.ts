import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonIcon, IonSplitPane, ToastController } from "@ionic/angular/standalone";
import { ErpDataService } from "../data/erp-data.service";
import { ApiService } from "../core/api.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { TaxInvoiceDialogComponent } from "../shared/tax-invoice-dialog.component";
import type { TaxInvoice, TaxInvoiceRow } from "../../data/dashboardData";
import { formatMoney } from "../shared/format";

const INDIAN_STATES = [
  "Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana",
  "Maharashtra", "Gujarat", "Rajasthan", "Madhya Pradesh", "Uttar Pradesh",
  "Bihar", "West Bengal", "Odisha", "Punjab", "Haryana", "Delhi",
  "Chandigarh", "Goa", "Other",
];

function numberToWords(num: number): string {
  if (num === 0) return "Zero Rupees Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigit(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }

  function threeDigit(n: number): string {
    if (n < 100) return twoDigit(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigit(n % 100) : "");
  }

  const crores = Math.floor(num / 10000000);
  const lakhs = Math.floor((num % 10000000) / 100000);
  const thousands = Math.floor((num % 100000) / 1000);
  const remainder = num % 1000;

  let result = "";
  if (crores > 0) result += threeDigit(crores) + " Crore ";
  if (lakhs > 0) result += threeDigit(lakhs) + " Lakh ";
  if (thousands > 0) result += threeDigit(thousands) + " Thousand ";
  if (remainder > 0) result += threeDigit(remainder);
  return result.trim() + " Rupees Only";
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, TaxInvoiceDialogComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="tax-invoices"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Invoices"
          eyebrow="Invoice Builder · Create and manage GST-compliant tax invoices"
          metaLabel=""
          [showTitle]="false"
          searchPlaceholder="Search invoices"
        />

        <ion-content class="erp-page">
          <main class="quotation-page">
            @if (!editingInvoice()) {
              <section class="quotation-header-section">
                <div class="section-header">
                  <h2>Saved Invoices</h2>
                  <button type="button" class="btn-primary" (click)="startNewInvoice()">
                    <ion-icon name="add-outline"></ion-icon>
                    New Invoice
                  </button>
                </div>
              </section>

              @if (data.taxInvoices().length === 0) {
                <div class="empty-state">
                  <ion-icon name="receipt-outline"></ion-icon>
                  <p>No invoices yet. Create your first invoice.</p>
                </div>
              } @else {
                <section class="quotation-list">
                  <table class="quotation-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (inv of data.taxInvoices(); track inv.id) {
                        <tr>
                          <td><strong>{{ inv.invoiceNumber }}</strong></td>
                          <td>{{ inv.date }}</td>
                          <td>{{ inv.clientName || '-' }}</td>
                          <td><strong>{{ formatMoney(inv.totalAmount) }}</strong></td>
                          <td>
                            <span class="status-pill" [class]="inv.status.toLowerCase()">{{ inv.status }}</span>
                          </td>
                          <td>
                            <button type="button" class="action-btn" (click)="editInvoice(inv)">Edit</button>
                            <button type="button" class="action-btn" (click)="previewInvoice(inv)">Preview</button>
                            <button type="button" class="action-btn danger" (click)="deleteInvoice(inv.id)">Delete</button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </section>
              }
            } @else {
              <!-- Invoice Editor View -->
              <section class="quotation-editor">
                <div class="editor-header">
                  <button type="button" class="back-link" (click)="cancelEdit()">
                    <ion-icon name="arrow-back-outline"></ion-icon>
                    Back to Invoices
                  </button>
                  <div class="editor-actions">
                    <button type="button" class="btn-outline" (click)="showInvoicePreview.set(true)">Preview Invoice</button>
                    <button type="button" class="btn-secondary" (click)="saveInvoice('Draft')" [disabled]="saving()">Save as Draft</button>
                    <button type="button" class="btn-primary" (click)="saveInvoice('Sent')" [disabled]="saving()">Save & Send</button>
                  </div>
                </div>

                <div class="quotation-document" id="invoice-print-area">
                  <div class="doc-header">
                    <div class="company-info">
                      <h1 class="company-name">{{ companyProfile().name || 'Company Name' }}</h1>
                      <p class="company-address">{{ companyProfile().address || 'Company Address' }}</p>
                      <p class="company-state-gst">
                        {{ companyProfile().state || 'State' }} | GSTIN: {{ companyProfile().gstin || 'GSTIN' }}
                      </p>
                      @if (companyProfile().bankName) {
                        <p class="company-bank">
                          Bank: {{ companyProfile().bankName }} | A/C: {{ companyProfile().accountNumber }} | IFSC: {{ companyProfile().ifsc }} | Branch: {{ companyProfile().branch }}
                        </p>
                      }
                    </div>
                    <div class="quotation-title-block">
                      <h2 class="quotation-title">TAX INVOICE</h2>
                      <div class="quotation-meta">
                        <div class="meta-row">
                          <span class="meta-label">Invoice No:</span>
                          <span class="meta-value">{{ currentInvoiceNumber() }}</span>
                        </div>
                        <div class="meta-row">
                          <span class="meta-label">Date:</span>
                          <span class="meta-value">{{ invoiceDate() }}</span>
                        </div>
                        <div class="meta-row">
                          <span class="meta-label">Place of Supply:</span>
                          <span class="meta-value">{{ invoiceState() }}</span>
                        </div>
                        <div class="meta-row">
                          <span class="meta-label">Supply Type:</span>
                          <span class="meta-value supply-type" [class]="supplyType() === 'Intrastate' ? 'intrastate' : 'interstate'">{{ supplyType() }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="client-section">
                    <h3 class="section-label">Bill To</h3>
                    <div class="client-form-grid">
                      <div class="form-field">
                        <label>Client Name</label>
                        <input type="text" [(ngModel)]="clientName" placeholder="Enter client name" />
                      </div>
                      <div class="form-field">
                        <label>State</label>
                        <select [(ngModel)]="clientState">
                          @for (state of states; track state) {
                            <option [value]="state">{{ state }}</option>
                          }
                        </select>
                      </div>
                      <div class="form-field full-width">
                        <label>Client Address</label>
                        <textarea [(ngModel)]="clientAddress" rows="2" placeholder="Enter client address"></textarea>
                      </div>
                      <div class="form-field">
                        <label>Client GSTIN</label>
                        <input type="text" [(ngModel)]="clientGstin" placeholder="Enter GSTIN" />
                      </div>
                    </div>
                  </div>

                  <div class="items-section">
                    <div class="section-label">Items</div>
                    <table class="items-table">
                      <thead>
                        <tr>
                          <th class="col-sno">S.No</th>
                          <th class="col-desc">Description</th>
                          <th class="col-hsn">HSN Code</th>
                          <th class="col-unit">Unit</th>
                          <th class="col-qty">Qty</th>
                          <th class="col-rate">Rate (₹)</th>
                          <th class="col-amount">Amount (₹)</th>
                          <th class="col-action"></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of invoiceRows(); track row.id; let i = $index) {
                          <tr>
                            <td class="col-sno cell-center">{{ i + 1 }}</td>
                            <td class="col-desc">
                              <input type="text" [(ngModel)]="row.description" placeholder="Description" class="table-input" />
                            </td>
                            <td class="col-hsn">
                              <input type="text" [(ngModel)]="row.hsnCode" placeholder="HSN" class="table-input narrow" />
                            </td>
                            <td class="col-unit">
                              <input type="text" [(ngModel)]="row.unit" placeholder="Unit" class="table-input narrow" />
                            </td>
                            <td class="col-qty">
                              <input type="number" [(ngModel)]="row.qty" (ngModelChange)="recalc(row)" min="0" class="table-input narrow cell-right" />
                            </td>
                            <td class="col-rate">
                              <input type="number" [(ngModel)]="row.rate" (ngModelChange)="recalc(row)" min="0" class="table-input narrow cell-right" />
                            </td>
                            <td class="col-amount cell-right">{{ formatMoney(row.amount) }}</td>
                            <td class="col-action">
                              <button type="button" class="icon-btn danger" (click)="removeRow(row.id)">×</button>
                            </td>
                          </tr>
                          @if (i === invoiceRows().length - 1) {
                            <tr class="add-row-tr">
                              <td colspan="8">
                                <button type="button" class="add-item-btn" (click)="addRow()">
                                  <ion-icon name="add-outline"></ion-icon> Add Item
                                </button>
                                <button type="button" class="add-item-btn secondary" (click)="addSectionHeader()">
                                  <ion-icon name="remove-outline"></ion-icon> Add Section
                                </button>
                              </td>
                            </tr>
                          }
                        }
                      </tbody>
                    </table>
                  </div>

                  <div class="totals-section">
                    <div class="totals-grid">
                      <div class="totals-left">
                        <div class="amount-words-block">
                          <span class="totals-label">Amount Chargeable (in words):</span>
                          <strong class="amount-words">{{ amountInWords() }}</strong>
                        </div>
                        <div class="custom-columns-block">
                          <div class="section-label" style="margin-top:16px">Custom Columns</div>
                          @for (col of customColumns(); track col) {
                            <div class="custom-col-row">
                              <span class="custom-col-name">{{ col }}</span>
                              <input type="text" class="table-input" placeholder="Value" />
                            </div>
                          }
                        </div>
                      </div>
                      <div class="totals-right">
                        <div class="summary-table">
                          <div class="summary-row">
                            <span>Sub Total</span>
                            <span>{{ formatMoney(subtotal()) }}</span>
                          </div>
                          <div class="summary-row">
                            <span>
                              CGST
                              <input type="number" [(ngModel)]="cgstPercent" (ngModelChange)="recalcTax()" min="0" max="100" class="inline-input" />%
                            </span>
                            <span>{{ formatMoney(cgstAmount()) }}</span>
                          </div>
                          <div class="summary-row">
                            <span>
                              SGST
                              <input type="number" [(ngModel)]="sgstPercent" (ngModelChange)="recalcTax()" min="0" max="100" class="inline-input" />%
                            </span>
                            <span>{{ formatMoney(sgstAmount()) }}</span>
                          </div>
                          <div class="summary-row">
                            <span>Round Off</span>
                            <input type="number" [(ngModel)]="roundOff" (ngModelChange)="recalcTax()" class="inline-input narrow" />
                          </div>
                          <div class="summary-row total-row">
                            <span>Total (₹)</span>
                            <span>{{ formatMoney(totalAmount()) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            }
          </main>
        </ion-content>
      </div>
    </ion-split-pane>

    @if (showInvoicePreview()) {
      <agb-tax-invoice-dialog
        [invoice]="currentInvoiceForPreview()"
        (closed)="showInvoicePreview.set(false)"
      ></agb-tax-invoice-dialog>
    }
  `,
  styles: [`
    .section-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; }
    .section-header h2 { font-size: 20px; font-weight: 700; color: #1a2540; margin: 0; }
    .quotation-header-section { border-bottom: 1px solid #e2e8f0; }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #64748b; }
    .empty-state ion-icon { font-size: 48px; margin-bottom: 12px; }
    .quotation-list { padding: 0 24px; }
    .quotation-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .quotation-table th { background: #1a2540; color: #fff; padding: 10px 14px; text-align: left; font-size: 12px; }
    .quotation-table td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
    .quotation-table tr:hover { background: #f8fafc; }
    .status-pill { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .status-pill.draft { background: #fef3c7; color: #92400e; }
    .status-pill.sent { background: #dbeafe; color: #1e40af; }
    .status-pill.paid { background: #d1fae5; color: #065f46; }
    .action-btn { padding: 4px 10px; background: #2c5cff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px; }
    .action-btn.danger { background: #dc2626; }
    .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #2c5cff; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #fff; color: #2c5cff; border: 1.5px solid #2c5cff; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #fff; color: #64748b; border: 1.5px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .editor-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
    .back-link { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: #2c5cff; cursor: pointer; font-size: 14px; padding: 6px 0; }
    .editor-actions { display: flex; gap: 8px; align-items: center; }
    .quotation-editor { }
    .quotation-document { background: #fff; padding: 40px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; max-width: 900px; margin: 20px auto; border: 1px solid #cbd5e1; }
    .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a2540; padding-bottom: 16px; margin-bottom: 20px; }
    .company-info { max-width: 55%; }
    .company-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
    .company-address { font-size: 12px; color: #475569; margin: 0 0 2px; }
    .company-state-gst { font-size: 12px; color: #475569; font-weight: 600; margin: 0 0 2px; }
    .company-bank { font-size: 11px; color: #64748b; margin: 4px 0 0; }
    .quotation-title-block { text-align: right; }
    .quotation-title { font-size: 20px; font-weight: 800; color: #1a2540; letter-spacing: 3px; border: 2px solid #1a2540; padding: 6px 16px; margin: 0 0 10px; text-align: center; }
    .quotation-meta { display: flex; flex-direction: column; gap: 4px; }
    .meta-row { display: flex; justify-content: flex-end; gap: 10px; }
    .meta-label { font-size: 11px; color: #64748b; min-width: 90px; text-align: right; }
    .meta-value { font-size: 12px; font-weight: 600; color: #1e293b; min-width: 120px; }
    .supply-type { font-weight: 700; }
    .supply-type.intrastate { color: #16a34a; }
    .supply-type.interstate { color: #d97706; }
    .client-section { margin-bottom: 20px; }
    .section-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px; }
    .client-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-field.full-width { grid-column: 1 / -1; }
    .form-field label { font-size: 12px; color: #475569; font-weight: 500; }
    .form-field input, .form-field textarea, .form-field select { padding: 7px 10px; border: 1.5px solid #e2e8f0; border-radius: 6px; font-size: 13px; color: #1e293b; background: #fff; outline: none; transition: border-color 140ms; }
    .form-field input:focus, .form-field textarea:focus, .form-field select:focus { border-color: #2c5cff; }
    .items-section { margin-bottom: 20px; }
    .items-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .items-table th { background: #1a2540; color: #fff; padding: 7px 8px; text-align: left; font-size: 11px; }
    .items-table td { padding: 4px 6px; border: 1px solid #cbd5e1; vertical-align: middle; }
    .col-sno { width: 5%; text-align: center; }
    .col-desc { width: 35%; }
    .col-hsn { width: 10%; }
    .col-unit { width: 8%; }
    .col-qty { width: 8%; }
    .col-rate { width: 14%; }
    .col-amount { width: 14%; }
    .col-action { width: 6%; text-align: center; }
    .cell-center { text-align: center; }
    .cell-right { text-align: right; }
    .table-input { width: 100%; padding: 5px 6px; border: 1px solid transparent; border-radius: 4px; font-size: 12px; background: transparent; outline: none; transition: background 140ms; }
    .table-input:focus { background: #f0f6ff; border-color: #2c5cff; }
    .table-input.narrow { width: 90px; }
    .add-row-tr td { border: none; padding: 6px 8px; }
    .add-item-btn { display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; background: #f0f6ff; color: #2c5cff; border: 1.5px dashed #2c5cff; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 8px; }
    .add-item-btn.secondary { color: #64748b; border-color: #94a3b8; background: none; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 18px; color: #dc2626; padding: 0; line-height: 1; }
    .totals-section { margin-top: 16px; }
    .totals-grid { display: flex; justify-content: space-between; gap: 40px; }
    .totals-left { flex: 1; }
    .totals-right { min-width: 280px; }
    .amount-words-block { font-size: 12px; color: #475569; }
    .amount-words { font-size: 13px; color: #0f172a; display: block; margin-top: 4px; }
    .summary-table { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
    .summary-row { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .summary-row:last-child { border-bottom: none; }
    .summary-row.total-row { background: #f1f5f9; font-weight: 700; font-size: 15px; color: #0f172a; }
    .inline-input { width: 50px; padding: 2px 4px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px; text-align: right; margin: 0 4px; }
    .inline-input.narrow { width: 80px; }
    .custom-columns-block { }
    .custom-col-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
    .custom-col-name { font-size: 12px; color: #64748b; min-width: 120px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxInvoicePage {
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly formatMoney = formatMoney;
  readonly states = INDIAN_STATES;

  readonly companyProfile = this.data.companyProfile;

  readonly editingInvoice = signal(false);
  readonly editingInvoiceId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showInvoicePreview = signal(false);

  readonly invoiceRows = signal<TaxInvoiceRow[]>([]);
  readonly customColumns = signal<string[]>([]);

  clientName = "";
  clientAddress = "";
  clientState = "Tamil Nadu";
  clientGstin = "";
  cgstPercent = 9;
  sgstPercent = 9;
  roundOff = 0;

  readonly currentInvoiceNumber = computed(() => {
    if (this.editingInvoiceId()) {
      const inv = this.data.taxInvoiceById(this.editingInvoiceId()!);
      return inv?.invoiceNumber || `INV-${Date.now()}`;
    }
    const existing = this.data.taxInvoices();
    const nextNumber = Math.max(0, ...existing.map(inv => Number(inv.invoiceNumber.replace(/\D/g, "")))) + 1;
    return `INV-${String(nextNumber).padStart(4, "0")}`;
  });

  readonly invoiceDate = computed(() => {
    if (this.editingInvoiceId()) {
      const inv = this.data.taxInvoiceById(this.editingInvoiceId()!);
      return inv?.date || new Date().toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });

  readonly invoiceState = computed(() => this.companyProfile().state || "Tamil Nadu");

  readonly supplyType = computed(() => {
    const co = this.companyProfile();
    return co.state?.trim().toLowerCase() === this.clientState.trim().toLowerCase() ? "Intrastate" : "Interstate";
  });

  readonly subtotal = computed(() => this.invoiceRows().reduce((sum, r) => sum + (r.amount || 0), 0));
  readonly cgstAmount = computed(() => Math.round(this.subtotal() * this.cgstPercent / 100));
  readonly sgstAmount = computed(() => Math.round(this.subtotal() * this.sgstPercent / 100));
  readonly totalAmount = computed(() => this.subtotal() + this.cgstAmount() + this.sgstAmount() + this.roundOff);
  readonly amountInWords = computed(() => numberToWords(Math.round(this.totalAmount())));

  readonly currentInvoiceForPreview = computed<TaxInvoice | null>(() => {
    if (!this.editingInvoice()) return null;
    return {
      id: this.editingInvoiceId() || "",
      invoiceNumber: this.currentInvoiceNumber(),
      date: this.invoiceDate(),
      companyName: this.companyProfile().name || "",
      companyAddress: this.companyProfile().address || "",
      state: this.companyProfile().state || "",
      gstin: this.companyProfile().gstin || "",
      clientName: this.clientName,
      clientAddress: this.clientAddress,
      clientState: this.clientState,
      clientGstin: this.clientGstin,
      items: this.invoiceRows(),
      customColumns: this.customColumns(),
      subtotal: this.subtotal(),
      cgstPercent: this.cgstPercent,
      sgstPercent: this.sgstPercent,
      cgstAmount: this.cgstAmount(),
      sgstAmount: this.sgstAmount(),
      roundOff: this.roundOff,
      totalAmount: this.totalAmount(),
      amountInWords: this.amountInWords(),
      supplyType: this.supplyType() as "Intrastate" | "Interstate",
      status: "Draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  constructor() {
    this.loadInvoicesFromBackend();
  }

  private loadInvoicesFromBackend() {
    this.api.listInvoices({ limit: 100 }).subscribe({
      next: (res) => {
        const items = (res.items || []).map((i: any) => ({
          id: i._id,
          invoiceNumber: i.invoiceNumber,
          date: i.date,
          clientName: i.clientName || "",
          clientAddress: i.clientAddress || "",
          clientState: i.clientState || "",
          clientGstin: i.clientGstin || "",
          items: (i.items || []).map((it: any, idx: number) => ({
            id: String(idx),
            sno: it.sno ?? idx + 1,
            description: it.description || "",
            hsnCode: it.hsnCode || "",
            unit: it.unit || "",
            qty: it.qty ?? 0,
            rate: it.rate ?? 0,
            amount: it.amount ?? 0,
            isCustom: it.isCustom ?? false,
          })),
          customColumns: i.customColumns || [],
          subtotal: i.subtotal ?? 0,
          cgstPercent: i.cgstPercent ?? 9,
          sgstPercent: i.sgstPercent ?? 9,
          cgstAmount: i.cgstAmount ?? 0,
          sgstAmount: i.sgstAmount ?? 0,
          roundOff: i.roundOff ?? 0,
          totalAmount: i.totalAmount ?? 0,
          amountInWords: i.amountInWords || "",
          supplyType: i.supplyType || "Intrastate",
          status: (i.status as TaxInvoice["status"]) || "Draft",
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        })) as TaxInvoice[];
        this.data.taxInvoices.set(items);
      },
      error: () => {},
    });
  }

  startNewInvoice() {
    this.editingInvoiceId.set(null);
    this.invoiceRows.set([this.newRow()]);
    this.customColumns.set([]);
    this.clientName = "";
    this.clientAddress = "";
    this.clientState = "Tamil Nadu";
    this.clientGstin = "";
    this.cgstPercent = 9;
    this.sgstPercent = 9;
    this.roundOff = 0;
    this.editingInvoice.set(true);
  }

  editInvoice(inv: TaxInvoice) {
    this.editingInvoiceId.set(inv.id);
    this.invoiceRows.set(inv.items.length > 0 ? inv.items.map((it, idx) => ({ ...it, id: String(idx) })) : [this.newRow()]);
    this.customColumns.set(inv.customColumns || []);
    this.clientName = inv.clientName;
    this.clientAddress = inv.clientAddress;
    this.clientState = inv.clientState || "Tamil Nadu";
    this.clientGstin = inv.clientGstin;
    this.cgstPercent = inv.cgstPercent ?? 9;
    this.sgstPercent = inv.sgstPercent ?? 9;
    this.roundOff = inv.roundOff ?? 0;
    this.editingInvoice.set(true);
  }

  previewInvoice(inv: TaxInvoice) {
    this.editingInvoiceId.set(inv.id);
    this.invoiceRows.set(inv.items);
    this.customColumns.set(inv.customColumns || []);
    this.clientName = inv.clientName;
    this.clientAddress = inv.clientAddress;
    this.clientState = inv.clientState || "Tamil Nadu";
    this.clientGstin = inv.clientGstin;
    this.cgstPercent = inv.cgstPercent ?? 9;
    this.sgstPercent = inv.sgstPercent ?? 9;
    this.roundOff = inv.roundOff ?? 0;
    this.editingInvoice.set(true);
    setTimeout(() => this.showInvoicePreview.set(true), 50);
  }

  cancelEdit() {
    this.editingInvoice.set(false);
    this.editingInvoiceId.set(null);
  }

  deleteInvoice(id: string) {
    if (!confirm("Delete this invoice?")) return;
    this.data.deleteTaxInvoice(id);
    this.loadInvoicesFromBackend();
  }

  addRow() {
    this.invoiceRows.update(rows => [...rows, this.newRow()]);
  }

  addSectionHeader() {
    this.invoiceRows.update(rows => [
      ...rows,
      { id: `SEC-${Date.now()}`, sno: 0, description: "---", unit: "", qty: 0, rate: 0, amount: 0, isCustom: true },
    ]);
  }

  removeRow(id: string) {
    this.invoiceRows.update(rows => rows.filter(r => r.id !== id));
  }

  recalc(row: TaxInvoiceRow) {
    row.amount = (Number(row.qty) || 0) * (Number(row.rate) || 0);
    this.invoiceRows.update(rows => [...rows]);
  }

  recalcTax() {
    this.invoiceRows.update(rows => [...rows]);
  }

  private newRow(): TaxInvoiceRow {
    return { id: `ROW-${Date.now()}`, sno: 0, description: "", hsnCode: "", unit: "", qty: 1, rate: 0, amount: 0 };
  }

  async saveInvoice(status: "Draft" | "Sent" | "Paid") {
    if (this.invoiceRows().length === 0 || !this.clientName.trim()) {
      alert("Please fill in client name and at least one item.");
      return;
    }

    this.saving.set(true);

    const validItems = this.invoiceRows()
      .map((row, idx) => ({
        sno: idx + 1,
        description: (row.description || "").trim(),
        hsnCode: row.hsnCode || "",
        unit: row.unit || "",
        qty: Number(row.qty) || 0,
        rate: Number(row.rate) || 0,
        amount: Number(row.amount) || 0,
        isCustom: row.isCustom ?? false,
      }))
      .filter(row => row.description.length > 0 || row.isCustom);

    const payload = {
      date: this.invoiceDate(),
      companyName: this.companyProfile().name,
      companyAddress: this.companyProfile().address,
      state: this.companyProfile().state,
      gstin: this.companyProfile().gstin,
      clientName: this.clientName.trim(),
      clientAddress: this.clientAddress.trim(),
      clientState: this.clientState,
      clientGstin: this.clientGstin.trim(),
      items: validItems,
      customColumns: this.customColumns(),
      subtotal: this.subtotal(),
      cgstPercent: this.cgstPercent,
      sgstPercent: this.sgstPercent,
      cgstAmount: this.cgstAmount(),
      sgstAmount: this.sgstAmount(),
      roundOff: this.roundOff,
      totalAmount: this.totalAmount(),
      amountInWords: this.amountInWords(),
      supplyType: this.supplyType(),
      status,
    };

    const existingId = this.editingInvoiceId();

    try {
      if (existingId) {
        await this.api.patchInvoice(existingId, payload).toPromise();
        this.data.updateTaxInvoice(existingId, payload as any);
      } else {
        const created = await this.api.createInvoice(payload).toPromise();
        const saved = {
          ...payload,
          id: (created as any).invoice?._id || (created as any).id,
          invoiceNumber: (created as any).invoice?.invoiceNumber || this.currentInvoiceNumber(),
        } as TaxInvoice;
        this.data.addTaxInvoice(saved);
      }
      this.editingInvoice.set(false);
      this.editingInvoiceId.set(null);
      this.loadInvoicesFromBackend();
    } catch (err: any) {
      alert("Failed to save invoice: " + (err?.message || "please try again"));
    } finally {
      this.saving.set(false);
    }
  }
}