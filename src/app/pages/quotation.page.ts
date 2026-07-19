import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal, computed, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonIcon, IonSplitPane, ToastController } from "@ionic/angular/standalone";
import { ErpDataService } from "../data/erp-data.service";
import { ApiService } from "../core/api.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { QuotationReportComponent, QuotationReportData } from "../shared/quotation-report.component";
import { formatMoney } from "../shared/format";
import type { Quotation, QuotationRow } from "../../data/dashboardData";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, QuotationReportComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="quotations"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Quotations"
          eyebrow="Quotation Builder · Create and manage professional quotations"
          metaLabel=""
          [showTitle]="false"
          searchPlaceholder="Search quotations"
        />

        <ion-content class="erp-page">
          <main class="quotation-page">
            @if (!editingQuotation()) {
              <!-- Quotation List View -->
              <section class="quotation-header-section">
                <div class="section-header">
                  <h2>Saved Quotations</h2>
                  <button type="button" class="btn-primary" (click)="startNewQuotation()">
                    <ion-icon name="add-outline"></ion-icon>
                    New Quotation
                  </button>
                </div>
              </section>

              @if (data.quotations().length === 0) {
                <div class="empty-state">
                  <ion-icon name="document-text-outline"></ion-icon>
                  <p>No quotations yet. Create your first quotation.</p>
                </div>
              } @else {
                <section class="quotation-list">
                  <table class="quotation-table">
                    <thead>
                      <tr>
                        <th>Quote #</th>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (quote of data.quotations(); track quote.id) {
                        <tr>
                          <td><strong>{{ quote.quotationNumber }}</strong></td>
                          <td>{{ quote.date }}</td>
                          <td>{{ quote.clientName || '-' }}</td>
                          <td><strong>{{ formatMoney(quote.totalAmount) }}</strong></td>
                          <td>
                            <span class="status-pill" [class]="quote.status.toLowerCase()">{{ quote.status }}</span>
                          </td>
                          <td>
                            <button type="button" class="action-btn" (click)="editQuotation(quote)">Edit</button>
                            <button type="button" class="action-btn danger" (click)="deleteQuotation(quote.id)">Delete</button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </section>
              }
            } @else {
              <!-- Quotation Editor View -->
              <section class="quotation-editor">
                <div class="editor-header">
                  <button type="button" class="back-link" (click)="cancelEdit()">
                    <ion-icon name="arrow-back-outline"></ion-icon>
                    Back to Quotations
                  </button>
                  <div class="editor-actions">
                    <button type="button" class="btn-outline" (click)="exportToExcel()">Export Excel</button>
                    <button type="button" class="btn-outline" (click)="quotationReport?.exportToPDF()" [disabled]="savingPdf()">Export PDF</button>
                    <button type="button" class="btn-secondary" (click)="saveQuotation('Draft')" [disabled]="savingQuote()">Save as Draft</button>
                    <button type="button" class="btn-primary" (click)="saveQuotation('Sent')" [disabled]="savingQuote()">Save & Send</button>
                  </div>
                </div>

                <!-- Printable Quotation Document -->
                <div class="quotation-document" id="quotation-print-area">
                  <div class="doc-header">
                    <div class="company-info">
                      <h1 class="company-name">{{ companyProfile().name || 'Company Name' }}</h1>
                      <p class="company-address">{{ companyProfile().address || 'Company Address' }}</p>
                      <p class="company-state-gst">
                        {{ companyProfile().state || 'State' }} | GSTIN: {{ companyProfile().gstin || 'GSTIN' }}
                      </p>
                    </div>
                    <div class="quotation-title-block">
                      <h2 class="quotation-title">QUOTATION</h2>
                      <div class="quotation-meta">
                        <div class="meta-row">
                          <span class="meta-label">Quote Number:</span>
                          <span class="meta-value">{{ currentQuoteNumber() }}</span>
                        </div>
                        <div class="meta-row">
                          <span class="meta-label">Date:</span>
                          <span class="meta-value">{{ quotationDate() }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Client Details -->
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
                        <input type="text" [(ngModel)]="clientGstin" placeholder="Enter GSTIN" maxlength="15" />
                      </div>
                    </div>
                  </div>

                  <!-- Items Table -->
                  <div class="items-section">
                    <table class="items-table" id="quotation-items-table">
                      <thead>
                        <tr>
                          <th class="col-sno">S.No</th>
                          <th class="col-desc">Description</th>
                          <th class="col-unit">Unit</th>
                          <th class="col-qty">Qty</th>
                          <th class="col-rate">Rate</th>
                          <th class="col-amount">Amount</th>
                          @for (col of customColumns(); track col) {
                            <th class="col-custom">{{ col }} <button type="button" class="remove-col-btn" (click)="removeCustomColumn(col)">×</button></th>
                          }
                          <th class="col-action"></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of quotationRows(); track row.id; let i = $index) {
                          <tr>
                            <td class="col-sno">{{ i + 1 }}</td>
                            <td class="col-desc">
                              <input type="text" [(ngModel)]="row.description" placeholder="Description" class="table-input" />
                            </td>
                            <td class="col-unit">
                              <input type="text" [(ngModel)]="row.unit" placeholder="Unit" class="table-input" />
                            </td>
                            <td class="col-qty">
                              <input type="number" [(ngModel)]="row.qty" (ngModelChange)="recalculateAmount(row)" min="0" class="table-input" />
                            </td>
                            <td class="col-rate">
                              <input type="number" [(ngModel)]="row.rate" (ngModelChange)="recalculateAmount(row)" min="0" class="table-input" />
                            </td>
                            <td class="col-amount amount-cell">{{ formatMoney(row.amount) }}</td>
                            @for (col of customColumns(); track col) {
                              <td class="col-custom">
                                <input type="text" [(ngModel)]="$any(row)[col]" placeholder="" class="table-input" />
                              </td>
                            }
                            <td class="col-action">
                              <button type="button" class="remove-row-btn" (click)="removeRow(row.id)">×</button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>

                    <div class="table-actions">
                      <button type="button" class="btn-add-row" (click)="addRow()">
                        <ion-icon name="add-circle-outline"></ion-icon>
                        Add Row
                      </button>
                      <button type="button" class="btn-add-col" (click)="showAddColumnInput.set(true)">
                        <ion-icon name="add-outline"></ion-icon>
                        Add Custom Column
                      </button>
                      @if (showAddColumnInput()) {
                        <div class="add-col-inline">
                          <input type="text" [(ngModel)]="newColumnName" placeholder="Column name" class="col-name-input" />
                          <button type="button" class="btn-confirm" (click)="addCustomColumn()">Add</button>
                          <button type="button" class="btn-cancel" (click)="showAddColumnInput.set(false); newColumnName.set('')">Cancel</button>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Financial Summary -->
                  <div class="financial-summary">
                    <div class="summary-left">
                      <div class="amount-in-words">
                        <span class="aiw-label">Amount in Words:</span>
                        <span class="aiw-value">{{ amountInWords() }}</span>
                      </div>
                    </div>
                    <div class="summary-right">
                      <div class="summary-row">
                        <span class="summary-label">Subtotal</span>
                        <span class="summary-value">{{ formatMoney(subtotal()) }}</span>
                      </div>
                      <div class="summary-row tax-row">
                        <span class="summary-label">CGST @</span>
                        <div class="tax-input-group">
                          <input type="number" [(ngModel)]="cgstPercent" (ngModelChange)="recalculateTotals()" min="0" max="100" class="tax-input" />
                          <span>%</span>
                          <span class="tax-amount">{{ formatMoney(cgstAmount()) }}</span>
                        </div>
                      </div>
                      <div class="summary-row tax-row">
                        <span class="summary-label">SGST @</span>
                        <div class="tax-input-group">
                          <input type="number" [(ngModel)]="sgstPercent" (ngModelChange)="recalculateTotals()" min="0" max="100" class="tax-input" />
                          <span>%</span>
                          <span class="tax-amount">{{ formatMoney(sgstAmount()) }}</span>
                        </div>
                      </div>
                      <div class="summary-row roundoff-row">
                        <span class="summary-label">Round Off</span>
                        <input type="number" [(ngModel)]="roundOff" (ngModelChange)="recalculateTotals()" class="roundoff-input" />
                      </div>
                      <div class="summary-row total-row">
                        <span class="summary-label">Total Amount</span>
                        <span class="summary-value total-value">{{ formatMoney(totalAmount()) }}</span>
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
    <agb-quotation-report #quotationReport [quotationData]="reportQuotation()" />
  `,
  styles: [`
    .quotation-page {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .section-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      background: #2c5cff;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary:hover { background: #1e4ae8; }
    .btn-outline {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      background: #fff;
      color: #2c5cff;
      border: 1px solid #2c5cff;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-outline:hover { background: #eef2ff; }
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      background: #fff;
      color: #475569;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-secondary:hover { background: #f8fafc; border-color: #94a3b8; }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #94a3b8;
    }
    .empty-state ion-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
    .empty-state p {
      margin: 0;
      font-size: 15px;
    }
    .quotation-list {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .quotation-table {
      width: 100%;
      border-collapse: collapse;
    }
    .quotation-table th {
      background: #f8fafc;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    .quotation-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
      color: #1e293b;
    }
    .quotation-table tr:last-child td { border-bottom: none; }
    .quotation-table tr:hover td { background: #fafbfc; }
    .status-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-pill.draft { background: #f1f5f9; color: #64748b; }
    .status-pill.sent { background: #e0f2fe; color: #0369a1; }
    .status-pill.accepted { background: #dcfce7; color: #15803d; }
    .status-pill.rejected { background: #fee2e2; color: #dc2626; }
    .action-btn {
      padding: 5px 10px;
      background: none;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
      color: #475569;
      cursor: pointer;
      margin-right: 6px;
    }
    .action-btn:hover { background: #f8fafc; }
    .action-btn.danger { color: #dc2626; border-color: #fecaca; }
    .action-btn.danger:hover { background: #fef2f2; }
    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 0;
      background: none;
      border: none;
      color: #2c5cff;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .back-link:hover { text-decoration: underline; }
    .editor-actions {
      display: flex;
      gap: 10px;
    }
    .quotation-document {
      background: #fff;
      border: 1px solid #cbd6e6;
      border-radius: 14px;
      padding: 32px;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 3px solid #002263;
      margin-bottom: 24px;
    }
    .company-name {
      font-size: 22px;
      font-weight: 900;
      color: #002263;
      margin: 0 0 4px;
    }
    .company-address, .company-state-gst {
      font-size: 12px;
      color: #64748b;
      margin: 0 0 2px;
    }
    .quotation-title {
      font-size: 24px;
      font-weight: 900;
      color: #002263;
      text-align: right;
      margin: 0 0 12px;
      letter-spacing: 0.05em;
    }
    .quotation-meta {
      text-align: right;
    }
    .meta-row {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-bottom: 4px;
    }
    .meta-label {
      font-size: 12px;
      color: #64748b;
    }
    .meta-value {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
    }
    .client-section {
      margin-bottom: 24px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 700;
      color: #002263;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 12px;
    }
    .client-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-field.full-width {
      grid-column: 1 / -1;
    }
    .form-field label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
    }
    .form-field input,
    .form-field select,
    .form-field textarea {
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      color: #1e293b;
      background: #fff;
    }
    .form-field input:focus,
    .form-field select:focus,
    .form-field textarea:focus {
      outline: none;
      border-color: #2c5cff;
      box-shadow: 0 0 0 3px rgba(44, 92, 255, 0.1);
    }
    .items-section {
      margin-bottom: 24px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cfd8e6;
      border-radius: 8px;
      overflow: hidden;
    }
    .items-table th {
      background: #eef4ff;
      color: #002263;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 10px 8px;
      text-align: left;
      border-bottom: 2px solid #cfd8e6;
    }
    .items-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e8edf4;
      vertical-align: middle;
    }
    .items-table tr:last-child td { border-bottom: none; }
    .col-sno { width: 50px; text-align: center; }
    .col-desc { min-width: 200px; }
    .col-unit { width: 80px; }
    .col-qty { width: 80px; }
    .col-rate { width: 100px; }
    .col-amount { width: 110px; text-align: right; }
    .col-custom { min-width: 100px; }
    .col-action { width: 36px; text-align: center; }
    .table-input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid transparent;
      border-radius: 4px;
      font-size: 12px;
      color: #1e293b;
      background: transparent;
    }
    .table-input:focus {
      border-color: #2c5cff;
      background: #fff;
      outline: none;
    }
    .table-input[type="number"] {
      text-align: right;
    }
    .amount-cell {
      font-weight: 600;
      text-align: right;
      color: #1e293b;
    }
    .remove-row-btn, .remove-col-btn {
      width: 24px;
      height: 24px;
      background: #fee2e2;
      color: #dc2626;
      border: none;
      border-radius: 50%;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .remove-col-btn {
      margin-left: 4px;
      font-size: 14px;
      vertical-align: middle;
    }
    .table-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    .btn-add-row, .btn-add-col {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      color: #475569;
      cursor: pointer;
    }
    .btn-add-row:hover, .btn-add-col:hover {
      background: #f1f5f9;
      border-color: #2c5cff;
      color: #2c5cff;
    }
    .add-col-inline {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .col-name-input {
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
    }
    .btn-confirm {
      padding: 7px 12px;
      background: #2c5cff;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-cancel {
      padding: 7px 12px;
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .financial-summary {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 32px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 2px solid #cfd8e6;
    }
    .amount-in-words {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .aiw-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }
    .aiw-value {
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
      font-style: italic;
    }
    .summary-right {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
    }
    .summary-label {
      font-size: 13px;
      color: #475569;
    }
    .summary-value {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }
    .tax-row .tax-input-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tax-input {
      width: 50px;
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 12px;
      text-align: center;
    }
    .tax-amount {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      min-width: 70px;
      text-align: right;
    }
    .roundoff-input {
      width: 80px;
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 12px;
      text-align: right;
    }
    .total-row {
      border-top: 2px solid #002263;
      padding-top: 10px;
      margin-top: 4px;
    }
    .total-value {
      font-size: 18px;
      font-weight: 900;
      color: #002263;
    }
    @media print {
      .quotation-page { padding: 0; }
      .editor-header { display: none; }
      .quotation-document {
        border: 2px solid #1e293b;
        border-radius: 0;
        padding: 24px;
        box-shadow: none;
        max-width: 100%;
        margin: 0;
      }
      .btn-add-row, .btn-add-col, .remove-row-btn, .add-col-inline, .back-link, .editor-actions,
      .action-btn, .btn-edit, .btn-save, .btn-delete, .table-actions, .btn-confirm, .btn-cancel { display: none !important; }
      .col-action { display: none !important; }
      ion-menu, ion-split-pane, ion-sidebar, ion-header, ion-toolbar { display: none !important; }
      ion-content { --background: transparent !important; }
      .ion-page, .ion-page > div { display: block !important; visibility: visible !important; }
      .ion-page { position: static !important; width: 100% !important; height: auto !important; }
      #main-content { display: block !important; width: 100% !important; }
      input[type="text"],
      input[type="number"],
      input[type="date"],
      select,
      textarea {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        padding: 0 !important;
        font-size: inherit !important;
        color: inherit !important;
        width: 100% !important;
        -webkit-appearance: none;
        appearance: none;
      }
      input[type="number"] { -moz-appearance: textfield; }
      select { appearance: none; -webkit-appearance: none; }
      @page { size: A4; margin: 15mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @media (max-width: 768px) {
      .quotation-page { padding: 16px; }
      .client-form-grid { grid-template-columns: 1fr; }
      .financial-summary { grid-template-columns: 1fr; }
      .doc-header { flex-direction: column; gap: 16px; }
      .quotation-title { text-align: left; }
      .quotation-meta { text-align: left; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationPage {
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly formatMoney = formatMoney;
  readonly states = INDIAN_STATES;

  readonly editingQuotation = signal(false);
  readonly showAddColumnInput = signal(false);
  readonly newColumnName = signal("");
  readonly savingPdf = signal(false);
  readonly savingQuote = signal(false);
  readonly editingQuoteId = signal<string | null>(null);
  readonly quotationRows = signal<QuotationRow[]>([]);
  readonly customColumns = signal<string[]>([]);

  @ViewChild('quotationReport') quotationReport!: QuotationReportComponent;

  readonly companyProfile = this.data.companyProfile;

  clientName = "";
  clientAddress = "";
  clientState = "Tamil Nadu";
  clientGstin = "";
  cgstPercent = 9;
  sgstPercent = 9;
  roundOff = 0;

  readonly currentQuoteNumber = computed(() => {
    if (this.editingQuoteId()) {
      const quote = this.data.quotationById(this.editingQuoteId()!);
      return quote?.quotationNumber || `QUO-${Date.now()}`;
    }
    const existing = this.data.quotations();
    const nextNumber = Math.max(0, ...existing.map(q => Number(q.quotationNumber.replace(/\D/g, "")))) + 1;
    return `QUO-${String(nextNumber).padStart(4, "0")}`;
  });

  readonly quotationDate = computed(() => {
    if (this.editingQuoteId()) {
      const quote = this.data.quotationById(this.editingQuoteId()!);
      return quote?.date || new Date().toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });

  readonly subtotal = computed(() =>
    this.quotationRows().reduce((sum, row) => sum + (row.amount || 0), 0)
  );

  readonly cgstAmount = computed(() => this.subtotal() * this.cgstPercent / 100);
  readonly sgstAmount = computed(() => this.subtotal() * this.sgstPercent / 100);

  readonly totalAmount = computed(() =>
    this.subtotal() + this.cgstAmount() + this.sgstAmount() + this.roundOff
  );

  readonly amountInWords = computed(() => numberToWords(Math.round(this.totalAmount())));

  readonly reportQuotation = computed<QuotationReportData>(() => ({
    quotationNumber: this.currentQuoteNumber(),
    date: this.quotationDate(),
    clientName: this.clientName,
    clientAddress: this.clientAddress,
    clientState: this.clientState,
    clientGstin: this.clientGstin,
    items: this.quotationRows().map((row, idx) => ({
      id: row.id || String(idx),
      description: row.description || "",
      hsnCode: (row as any).hsnCode || "",
      unit: row.unit || "",
      qty: row.qty || 0,
      rate: row.rate || 0,
      amount: row.amount || 0,
      isCustom: row.isCustom ?? false,
    })),
    subtotal: this.subtotal(),
    cgstPercent: this.cgstPercent,
    sgstPercent: this.sgstPercent,
    cgstAmount: this.cgstAmount(),
    sgstAmount: this.sgstAmount(),
    roundOff: this.roundOff,
    totalAmount: this.totalAmount(),
    amountInWords: this.amountInWords(),
  }));

  constructor() {
    this.loadQuotationsFromBackend();
  }

  private loadQuotationsFromBackend() {
    this.api.listQuotations({ limit: 100 }).subscribe({
      next: (res) => {
        const items = (res.items || []).map((q: any) => ({
          id: q._id,
          quotationNumber: q.quotationNumber,
          date: q.date,
          clientName: q.clientName,
          clientAddress: q.clientAddress,
          clientState: q.clientState,
          clientGstin: q.clientGstin,
          items: q.items || [],
          customColumns: q.customColumns || [],
          subtotal: q.subtotal || 0,
          cgstPercent: q.cgstPercent || 9,
          sgstPercent: q.sgstPercent || 9,
          cgstAmount: q.cgstAmount || 0,
          sgstAmount: q.sgstAmount || 0,
          roundOff: q.roundOff || 0,
          totalAmount: q.totalAmount || 0,
          amountInWords: q.amountInWords || "",
          status: q.status || "Draft",
        }));
        this.data.quotations.set(items as any);
      },
      error: () => {},
    });
  }

  startNewQuotation() {
    this.editingQuoteId.set(null);
    this.quotationRows.set([this.createEmptyRow()]);
    this.customColumns.set([]);
    this.clientName = "";
    this.clientAddress = "";
    this.clientState = "Tamil Nadu";
    this.clientGstin = "";
    this.cgstPercent = 9;
    this.sgstPercent = 9;
    this.roundOff = 0;
    this.editingQuotation.set(true);
  }

  editQuotation(quote: Quotation) {
    this.editingQuoteId.set(quote.id);
    this.quotationRows.set(quote.items.map(item => ({ ...item })));
    this.customColumns.set(quote.customColumns || []);
    this.clientName = quote.clientName;
    this.clientAddress = quote.clientAddress;
    this.clientState = quote.clientState || "Tamil Nadu";
    this.clientGstin = quote.clientGstin;
    this.cgstPercent = quote.cgstPercent;
    this.sgstPercent = quote.sgstPercent;
    this.roundOff = quote.roundOff;
    this.editingQuotation.set(true);
  }

  cancelEdit() {
    this.editingQuotation.set(false);
    this.editingQuoteId.set(null);
  }

  createEmptyRow(): QuotationRow {
    return {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sno: 0,
      description: "",
      unit: "",
      qty: 0,
      rate: 0,
      amount: 0,
    };
  }

  addRow() {
    this.quotationRows.update(rows => [...rows, this.createEmptyRow()]);
  }

  removeRow(rowId: string) {
    this.quotationRows.update(rows => rows.filter(r => r.id !== rowId));
  }

  recalculateAmount(row: QuotationRow) {
    row.amount = (row.qty || 0) * (row.rate || 0);
    this.quotationRows.update(rows => [...rows]);
  }

  addCustomColumn() {
    const name = this.newColumnName().trim();
    if (!name) return;
    if (this.customColumns().includes(name)) return;
    this.customColumns.update(cols => [...cols, name]);
    this.newColumnName.set("");
    this.showAddColumnInput.set(false);
  }

  removeCustomColumn(colName: string) {
    this.customColumns.update(cols => cols.filter(c => c !== colName));
    this.quotationRows.update(rows =>
      rows.map(row => {
        const { [colName]: _, ...rest } = row as any;
        return rest as QuotationRow;
      })
    );
  }

  recalculateTotals() {
    this.quotationRows.update(rows => [...rows]);
  }

  async saveQuotation(status: "Draft" | "Sent") {
    if (this.quotationRows().length === 0) {
      alert("Please add at least one item.");
      return;
    }

    this.savingQuote.set(true);

    const validItems = this.quotationRows()
      .map((row) => ({
        description: (row.description || "").trim(),
        unit: row.unit || "",
        qty: Number(row.qty) || 0,
        rate: Number(row.rate) || 0,
        amount: Number(row.amount) || 0,
        isCustom: row.isCustom ?? false,
      }))
      .filter((row) => row.description.length > 0);

    const quotationData = {
      quotationNumber: this.currentQuoteNumber(),
      date: this.quotationDate(),
      companyName: this.companyProfile().name,
      companyAddress: this.companyProfile().address,
      state: this.companyProfile().state,
      gstin: this.companyProfile().gstin,
      clientName: this.clientName,
      clientAddress: this.clientAddress,
      clientState: this.clientState,
      clientGstin: this.clientGstin,
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
      status,
    };

    const existingId = this.editingQuoteId();

    try {
      if (existingId) {
        await this.api.patchQuotation(existingId, quotationData).toPromise();
        this.data.updateQuotation(existingId, quotationData as any);
        this.editingQuoteId.set(null);
      } else {
        const created = await this.api.createQuotation(quotationData).toPromise();
        const saved = {
          ...quotationData,
          quotationNumber: (created as any).quotation?.quotationNumber || quotationData.quotationNumber,
          id: (created as any).quotation?._id || (created as any).id || existingId,
        };
        this.data.addQuotation(saved as any);
        this.editingQuoteId.set(null);
      }
      this.editingQuotation.set(false);
      this.loadQuotationsFromBackend();
    } catch (err: any) {
      const details = err?.error?.details;
      let msg = "Please check your input and try again.";
      if (details && typeof details === "object") {
        const fieldErrors = Object.entries(details as Record<string, unknown[]>)
          .map(([field, errs]) => {
            const msgs = (errs as any[])?.map((e: any) => e.message || e).join(", ") || "";
            return msgs ? `${field}: ${msgs}` : null;
          })
          .filter(Boolean);
        if (fieldErrors.length) msg = fieldErrors.join("; ");
      } else if (err?.message) {
        msg = err.message;
      }
      alert("Failed to save quotation: " + msg);
    } finally {
      this.savingQuote.set(false);
    }
  }

  deleteQuotation(id: string) {
    if (!confirm("Delete this quotation?")) return;
    this.api.deleteQuotation(id).subscribe({
      next: () => {
        this.data.deleteQuotation(id);
        this.loadQuotationsFromBackend();
      },
      error: (err: any) => {
        alert("Failed to delete quotation: " + (err?.message || "Unknown error"));
      },
    });
  }

  async exportToPDF() {
    const el = document.getElementById("quotation-print-area");
    if (!el) return;
    this.savingPdf.set(true);
    try {
      el.style.width = "794px";
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      el.style.width = "";
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`quotation-${this.currentQuoteNumber()}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      this.savingPdf.set(false);
    }
  }

  exportToExcel() {
    const rows = this.quotationRows();
    const headers = ["S.No", "Description", "Unit", "Qty", "Rate", "Amount", ...this.customColumns()];
    const csvRows = [
      headers.join(","),
      ...rows.map((row, i) => {
        const values = [i + 1, `"${row.description}"`, `"${row.unit}"`, row.qty, row.rate, row.amount];
        this.customColumns().forEach(col => {
          values.push(`"${(row as any)[col] || ""}"`);
        });
        return values.join(",");
      }),
      "",
      `Subtotal,,,,"${this.subtotal()}"`,
      `CGST @${this.cgstPercent}%,,,,"${this.cgstAmount()}"`,
      `SGST @${this.sgstPercent}%,,,,"${this.sgstAmount()}"`,
      `Round Off,,,,,"${this.roundOff}"`,
      `Total,,,,,"${this.totalAmount()}"`,
      `Amount in Words: "${this.amountInWords()}"`,
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `quotation-${this.currentQuoteNumber()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}