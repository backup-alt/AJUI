import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonIcon, IonSplitPane, ToastController } from "@ionic/angular/standalone";
import { ErpDataService, type Client } from "../data/erp-data.service";
import { ApiService } from "../core/api.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { TaxInvoiceDialogComponent } from "../shared/tax-invoice-dialog.component";
import { ClientFormDialogComponent, type ClientFormValue } from "../shared/client-form-dialog.component";
import type { Quotation, TaxInvoice, TaxInvoiceRow } from "../../data/dashboardData";
import { formatMoney } from "../shared/format";
import { buildBusinessDocumentXlsx } from "../shared/excel-export";

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
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, TaxInvoiceDialogComponent, ClientFormDialogComponent],
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
                            <button type="button" class="icon-action-btn edit" title="Edit" (click)="editInvoice(inv)">
                              <ion-icon name="pencil-outline"></ion-icon>
                            </button>
                            <button type="button" class="icon-action-btn preview" title="Preview" (click)="previewInvoice(inv)">
                              <ion-icon name="document-text-outline"></ion-icon>
                            </button>
                            <button type="button" class="icon-action-btn delete" title="Delete" (click)="deleteInvoice(inv.id)">
                              <ion-icon name="trash"></ion-icon>
                            </button>
                            @if (!inv.clientId && inv.clientName) {
                              <button type="button" class="icon-action-btn client" title="Make as Client" (click)="makeAsClient(inv)">
                                <ion-icon name="id-card-outline"></ion-icon>
                              </button>
                            }
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
                    <button type="button" class="btn-outline" (click)="exportToExcel()" [disabled]="savingExcel()">Export Excel</button>
                    <button type="button" class="btn-secondary" (click)="saveInvoice('Draft')" [disabled]="saving()">Save as Draft</button>
                    <button type="button" class="btn-primary" (click)="saveInvoice('Sent')" [disabled]="saving()">Save & Send</button>
                  </div>
                </div>

                @if (sourceQuotationNumber()) {
                  <div class="conversion-notice">
                    <ion-icon name="receipt-outline"></ion-icon>
                    <span>Reviewing invoice created from quotation <strong>{{ sourceQuotationNumber() }}</strong>. Nothing will be created until you save and confirm.</span>
                  </div>
                }

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
                      </div>
                    </div>
                  </div>

                  <div class="client-section">
                    <h3 class="section-label">Bill To</h3>
                    <div class="client-form-grid">
                      <div class="form-field client-search-wrapper">
                        <label>Client Name</label>
                        <input
                          type="text"
                          [value]="clientSearchTerm()"
                          (input)="onClientSearchInput($event)"
                          (focus)="onClientSearchFocus()"
                          placeholder="Search or enter client name"
                          class="client-search-input"
                        />
                        @if (showClientDropdown()) {
                          <div class="client-dropdown">
                            @for (client of filteredClients(); track client.id) {
                              <div
                                class="client-dropdown-item"
                                [class.selected]="selectedClientId() === client._id"
                                (mousedown)="selectClient(client)"
                              >
                                <span class="client-dropdown-name">{{ client.name }}</span>
                                <span class="client-dropdown-meta">{{ client.address }}</span>
                              </div>
                            } @empty {
                              <div class="client-dropdown-empty">No clients found</div>
                            }
                          </div>
                        }
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

                  <div class="items-section">
                    <div class="section-label">Items</div>
                    <table class="items-table">
                      <colgroup>
                        <col class="col-col-sno" />
                        <col class="col-col-desc" />
                        <col class="col-col-hsn" />
                        <col class="col-col-unit" />
                        <col class="col-col-qty" />
                        <col class="col-col-rate" />
                        <col class="col-col-amount" />
                        @for (col of customColumns(); track col) {
                          <col class="col-col-custom" />
                        }
                        <col class="col-col-action" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th class="col-sno">S.No</th>
                          <th class="col-desc">Description</th>
                          <th class="col-hsn">HSN Code</th>
                          <th class="col-unit">Unit</th>
                          <th class="col-qty">Qty</th>
                          <th class="col-rate">Rate / Item (₹)</th>
                          <th class="col-amount">Amount (₹)</th>
                          @for (col of customColumns(); track col) {
                            <th class="col-custom">{{ col }} <button type="button" class="remove-col-btn" (click)="removeCustomColumn(col)">×</button></th>
                          }
                          <th class="col-action"></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of invoiceRows(); track row.id; let i = $index) {
                          <tr [class.sub-row]="!!row.parentRowId" [class.section-row]="isSectionHeading(row)" [class.parent-row]="!row.parentRowId && !isSectionHeading(row)">
                            <td class="col-sno cell-center">{{ rowSnoMap()[row.id] }}</td>
                            <td class="col-desc">
                              <div class="desc-cell" [class.is-sub]="!!row.parentRowId" [class.is-heading]="isSectionHeading(row)">
                                <input type="text" [(ngModel)]="row.description" [placeholder]="isSectionHeading(row) ? 'Section heading (e.g. Plumbing Fittings)' : 'Description'" class="table-input" />
                              </div>
                            </td>
                            <td class="col-hsn">
                              @if (!parentIds().has(row.id)) {
                                <input type="text" [(ngModel)]="row.hsnCode" placeholder="HSN" class="table-input narrow" />
                              }
                            </td>
                            <td class="col-unit">
                              @if (!parentIds().has(row.id)) {
                                <div class="erp-select-menu" [class.open]="openUnitMenu() === row.id">
                                  <button type="button" class="erp-select-trigger unit-trigger" (click)="toggleUnitMenu(row.id)">
                                    <span>{{ row.unit || 'Select' }}</span>
                                    <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon"><path d="M5.5 7.5 10 12l4.5-4.5" /></svg>
                                  </button>
                                  <div class="erp-select-panel unit-panel" *ngIf="openUnitMenu() === row.id">
                                    <input type="text" class="unit-search" placeholder="Search or type..."
                                      (click)="$event.stopPropagation()"
                                      (input)="unitSearch.set($any($event.target).value)"
                                      [value]="unitSearch()" autocomplete="off" />
                                    <button *ngFor="let u of filteredUnits()" type="button"
                                      [class.selected]="row.unit === u"
                                      (mousedown)="$event.preventDefault()"
                                      (click)="selectUnit(row, u)">{{ u }}</button>
                                    @if (unitSearch().trim() && !filteredUnits().includes(unitSearch().trim())) {
                                      <button type="button" class="unit-create"
                                        (mousedown)="$event.preventDefault()"
                                        (click)="createAndSelectUnit(row, unitSearch().trim())">
                                        Create "{{ unitSearch().trim() }}"
                                      </button>
                                    }
                                  </div>
                                </div>
                              }
                            </td>
                            <td class="col-qty">
                              @if (!parentIds().has(row.id)) {
                                <input type="number" [(ngModel)]="row.qty" (ngModelChange)="recalc(row)" min="0" class="table-input narrow cell-right" />
                              }
                            </td>
                            <td class="col-rate">
                              @if (!parentIds().has(row.id)) {
                                <input type="number" [(ngModel)]="row.rate" (ngModelChange)="recalc(row)" min="0" class="table-input narrow cell-right" />
                              }
                            </td>
                            <td class="col-amount cell-right">{{ (isSectionHeading(row) || parentIds().has(row.id)) ? '' : formatMoney(row.amount) }}</td>
                            @for (col of customColumns(); track col) {
                              <td class="col-custom">
                                @if (!parentIds().has(row.id)) {
                                  <input type="text" [(ngModel)]="$any(row)[col]" placeholder="" class="table-input" />
                                }
                              </td>
                            }
                            <td class="col-action">
                              <div class="row-actions" [class.menu-open]="openRowMenu() === row.id">
                                @if (!row.parentRowId) {
                                  <button type="button" class="add-sub-row-btn" title="Add Sub Row" aria-label="Add Sub Row" (click)="addSubRow(row.id)">
                                    <ion-icon name="add-outline"></ion-icon>
                                  </button>
                                  <button type="button" class="row-action-btn" title="More actions" aria-label="More actions" (click)="toggleRowMenu(row.id, $event)">
                                    <ion-icon name="ellipsis-vertical"></ion-icon>
                                  </button>
                                  @if (openRowMenu() === row.id) {
                                    <div class="row-action-menu" (click)="$event.stopPropagation()">
                                      <button type="button" class="row-action-item" (click)="addSubRow(row.id); toggleRowMenu('', $event)">
                                        <ion-icon name="git-branch-outline"></ion-icon>
                                        <span>Add Sub Row</span>
                                      </button>
                                    </div>
                                  }
                                }
                                <button type="button" class="icon-btn danger" (click)="removeRow(row.id)">×</button>
                              </div>
                            </td>
                          </tr>
                          @if (i === invoiceRows().length - 1) {
                            <tr class="add-row-tr">
                              <td [attr.colspan]="8 + customColumns().length">
                                <button type="button" class="add-item-btn" (click)="addRow()">
                                  <ion-icon name="add-outline"></ion-icon> Add Item
                                </button>
                                <button type="button" class="add-item-btn" (click)="showAddColumnInput.set(true)">
                                  <ion-icon name="add-outline"></ion-icon> Add Custom Column
                                </button>
                                @if (showAddColumnInput()) {
                                  <span class="add-col-inline">
                                    <input type="text" [(ngModel)]="newColumnName" placeholder="Column name" class="col-name-input" />
                                    <button type="button" class="btn-confirm" (click)="addCustomColumn()">Add</button>
                                    <button type="button" class="btn-cancel" (click)="showAddColumnInput.set(false); newColumnName.set('')">Cancel</button>
                                  </span>
                                }
                              </td>
                            </tr>
                          }
                        }
                      </tbody>
                    </table>
                  </div>

                  @if (deleteConfirm(); as dc) {
                    <div class="confirm-overlay" role="presentation" (click)="cancelDeleteConfirm()">
                      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title-inv" (click)="$event.stopPropagation()">
                        <h3 id="confirm-delete-title-inv" class="confirm-title">Delete row</h3>
                        <p class="confirm-message">This row contains sub rows. Choose one:</p>
                        <div class="confirm-actions">
                          <button type="button" class="btn-confirm" (click)="confirmDeleteParentOnly()">Delete Parent Only</button>
                          <button type="button" class="btn-confirm danger" (click)="confirmDeleteParentAndChildren()">Delete Parent and All Sub Rows</button>
                          <button type="button" class="btn-cancel" (click)="cancelDeleteConfirm()">Cancel</button>
                        </div>
                      </div>
                    </div>
                  }

                  <div class="totals-section">
                    <div class="totals-grid">
                      <div class="totals-left">
                        <div class="amount-words-block">
                          <span class="totals-label">Amount Chargeable (in words):</span>
                          <strong class="amount-words">{{ amountInWords() }}</strong>
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

    @if (showMakeClientDialog()) {
      <agb-client-form-dialog
        [initialValue]="makeClientInitialValue()"
        [title]="'Convert to Client'"
        [description]="'Create a client record from this invoice details.'"
        [submitLabel]="'Create Client'"
        (cancel)="showMakeClientDialog.set(false)"
        (create)="onMakeClientCreated($event)"
      ></agb-client-form-dialog>
    }
  `,
  styles: [`
    .section-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; }
    .section-header h2 { font-size: 20px; font-weight: 700; color: #1a2540; margin: 0; }
    .quotation-header-section { border-bottom: 1px solid #e2e8f0; }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #64748b; }
    .empty-state ion-icon { font-size: 48px; margin-bottom: 12px; }
    .quotation-list { padding: 0 24px; }
    .quotation-table { width: 100%; border-collapse: collapse; font-size: 14px; border: 1px solid #cfd8e6; border-radius: 8px; overflow: hidden; }
    .quotation-table th {
      background: #eef4ff;
      color: #002263;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 2px solid #cfd8e6;
    }
    .quotation-table td { padding: 10px 14px; border-bottom: 1px solid #e8edf4; color: #1e293b; }
    .quotation-table tr:last-child td { border-bottom: none; }
    .quotation-table tr:hover { background: #f8fafc; }
    .status-pill { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .status-pill.draft { background: #fef3c7; color: #92400e; }
    .status-pill.sent { background: #dbeafe; color: #1e40af; }
    .status-pill.paid { background: #d1fae5; color: #065f46; }
    .icon-action-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; cursor: pointer; font-size: 16px; margin-right: 6px; transition: background 150ms, transform 150ms; }
    .icon-action-btn:hover { transform: scale(1.1); }
    .icon-action-btn ion-icon { font-size: 16px; pointer-events: none; }
    .icon-action-btn.edit { background: #e0ecff; color: #2c5cff; }
    .icon-action-btn.edit:hover { background: #c7d9ff; }
    .icon-action-btn.preview { background: #f1f5f9; color: #475569; }
    .icon-action-btn.preview:hover { background: #e2e8f0; }
    .icon-action-btn.delete { background: #fee2e2; color: #dc2626; }
    .icon-action-btn.delete:hover { background: #fecaca; }
    .icon-action-btn.client { background: #d1fae5; color: #059669; }
    .icon-action-btn.client:hover { background: #a7f3d0; }
    .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #2c5cff; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #fff; color: #2c5cff; border: 1.5px solid #2c5cff; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #fff; color: #64748b; border: 1.5px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .editor-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
    .conversion-notice { max-width: 900px; margin: 16px auto 0; padding: 11px 14px; display: flex; align-items: center; gap: 9px; border: 1px solid #c4b5fd; border-radius: 9px; background: #f5f3ff; color: #5b21b6; font-size: 13px; }
    .conversion-notice ion-icon { flex: 0 0 auto; font-size: 18px; }
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
    .client-section { margin-bottom: 20px; }
    .section-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px; }
    .client-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-field.full-width { grid-column: 1 / -1; }
    .form-field label { font-size: 12px; color: #475569; font-weight: 500; }
    .form-field input, .form-field textarea, .form-field select { padding: 7px 10px; border: 1.5px solid #e2e8f0; border-radius: 6px; font-size: 13px; color: #1e293b; background: #fff; outline: none; transition: border-color 140ms; }
    .form-field input:focus, .form-field textarea:focus, .form-field select:focus { border-color: #2c5cff; }
    .items-section { margin-bottom: 20px; }
    .items-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
    .items-table col.col-col-sno { width: 50px; }
    .items-table col.col-col-desc { width: auto; }
    .items-table col.col-col-hsn { width: 90px; }
    .items-table col.col-col-unit { width: 90px; }
    .items-table col.col-col-qty { width: 80px; }
    .items-table col.col-col-rate { width: 110px; }
    .items-table col.col-col-amount { width: 120px; }
    .items-table col.col-col-custom { width: 110px; }
    .items-table col.col-col-action { width: 96px; }
    .items-table th {
      background: #eef4ff;
      color: #002263;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 8px;
      text-align: left;
      border-bottom: 2px solid #cfd8e6;
    }
    .items-table td { padding: 5px 6px; border-bottom: 1px solid #e8edf4; vertical-align: middle; box-sizing: border-box; }
    .col-sno { text-align: center; }
    .col-desc { }
    .col-hsn { text-align: center; }
    .col-unit { }
    .col-qty { }
    .col-rate { }
    .col-amount { }
    .col-action { text-align: center; }
    .cell-center { text-align: center; }
    .cell-right { text-align: right; }
    .table-input { width: 100%; padding: 5px 6px; border: 1px solid transparent; border-radius: 4px; font-size: 12px; background: transparent; outline: none; transition: background 140ms; box-sizing: border-box; }
    .table-input:focus { background: #f0f6ff; border-color: #2c5cff; }
    .table-input.narrow { width: 100%; }
    .table-input[type="number"] { text-align: right; min-width: 0; }
    /* Hide the browser number spinners so the entire Qty / Rate cell stays
       clickable and the typed value remains fully visible. */
    .col-qty input[type="number"],
    .col-rate input[type="number"] {
      -moz-appearance: textfield;
      appearance: textfield;
    }
    .col-qty input[type="number"]::-webkit-outer-spin-button,
    .col-qty input[type="number"]::-webkit-inner-spin-button,
    .col-rate input[type="number"]::-webkit-outer-spin-button,
    .col-rate input[type="number"]::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
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
    .col-custom { min-width: 90px; }
    .col-custom .remove-col-btn {
      margin-left: 4px;
      font-size: 14px;
      vertical-align: middle;
      background: none;
      border: none;
      color: #dc2626;
      cursor: pointer;
      padding: 0;
    }
    .row-actions { position: relative; display: inline-flex; align-items: center; gap: 4px; }
    .row-action-btn,
    .add-sub-row-btn {
      background: transparent; border: none; cursor: pointer; padding: 2px 4px;
      color: #475569; font-size: 16px; line-height: 1; border-radius: 4px;
    }
    .row-action-btn:hover,
    .add-sub-row-btn:hover { background: rgba(0,0,0,0.06); color: #1e293b; }
    .add-sub-row-btn { color: #16a34a; font-size: 18px; font-weight: 700; }
    .add-sub-row-btn:hover { color: #15803d; background: rgba(22,163,74,0.10); }
    .row-action-menu {
      position: absolute; right: 0; top: 100%; margin-top: 4px;
      background: #fff; border: 1px solid #cbd5e1; border-radius: 6px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.12); min-width: 160px; z-index: 50;
      padding: 4px 0;
    }
    .row-action-item {
      display: flex; align-items: center; gap: 8px; width: 100%;
      background: transparent; border: none; padding: 8px 12px;
      cursor: pointer; font-size: 13px; color: #1e293b; text-align: left;
    }
    .row-action-item:hover { background: #f1f5f9; }
    .row-action-item ion-icon { font-size: 16px; color: #475569; }
    tr.sub-row td { background: #f8fafc; }
    tr.sub-row .col-desc { padding-left: 30px; }
    tr.sub-row .desc-cell .table-input { color: #475569; }
    tr.parent-row td { background: #ffffff; }
    tr.parent-row .desc-cell .table-input { font-weight: 600; color: #0f172a; }
    tr.parent-row .col-sno { font-weight: 700; color: #0f172a; }
    tr.sub-row .col-sno { color: #64748b; }
    .desc-cell { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .desc-cell .table-input { flex: 1; min-width: 0; }
    .desc-cell.is-sub .table-input { font-style: italic; }
    .section-row td { background: #f1f5f9; }
    .section-row .col-desc { padding-left: 12px; }
    .section-row .desc-cell .table-input { font-weight: 700; color: #0f172a; font-size: 13px; }
    .confirm-overlay {
      position: fixed; inset: 0; background: rgba(15,23,42,0.55);
      display: flex; align-items: center; justify-content: center; z-index: 9999;
      padding: 20px;
    }
    .confirm-dialog {
      background: #fff; border-radius: 10px; width: 100%; max-width: 440px;
      padding: 22px 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.25);
    }
    .confirm-title { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
    .confirm-message { font-size: 14px; color: #475569; margin: 0 0 18px; }
    .confirm-actions { display: flex; flex-direction: column; gap: 10px; }
    .confirm-actions .btn-confirm,
    .confirm-actions .btn-cancel { width: 100%; justify-content: center; }
    .confirm-actions .btn-confirm.danger { background: #dc2626; }
    .confirm-actions .btn-confirm.danger:hover { background: #b91c1c; }
    .add-col-inline { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; }
    .col-name-input { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }
    .btn-confirm { padding: 7px 12px; background: #2c5cff; color: #fff; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; }
    .btn-cancel { padding: 7px 12px; background: #f1f5f9; color: #64748b; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; }
    .client-search-wrapper { position: relative; }
    .client-search-input { width: 100%; padding: 7px 10px; border: 1.5px solid #e2e8f0; border-radius: 6px; font-size: 13px; color: #1e293b; background: #fff; outline: none; transition: border-color 140ms; box-sizing: border-box; }
    .client-search-input:focus { border-color: #2c5cff; }
    .client-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 100; max-height: 220px; overflow-y: auto; margin-top: 4px; }
    .client-dropdown-item { padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; border-bottom: 1px solid #f1f5f9; }
    .client-dropdown-item:last-child { border-bottom: none; }
    .client-dropdown-item:hover { background: #f0f6ff; }
    .client-dropdown-item.selected { background: #e0ecff; }
    .client-dropdown-name { font-size: 13px; font-weight: 600; color: #1e293b; }
    .client-dropdown-meta { font-size: 11px; color: #64748b; }
    .client-dropdown-empty { padding: 12px; text-align: center; color: #94a3b8; font-size: 13px; }
    .col-unit { position: relative; }
    .col-unit .erp-select-menu { min-width: 0; width: 100%; }
    .unit-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border: 1px solid transparent; border-radius: 4px; font-size: 12px; color: #1e293b; background: transparent; cursor: pointer; text-align: left; }
    .unit-trigger:hover, .erp-select-menu.open .unit-trigger { border-color: #2c5cff; background: #fff; }
    .unit-trigger .svg-icon { width: 14px; height: 14px; flex-shrink: 0; }
    .unit-panel { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 200; max-height: 220px; overflow-y: auto; margin-top: 2px; }
    .unit-search { width: 100%; padding: 6px 8px; border: none; border-bottom: 1px solid #e2e8f0; font-size: 12px; outline: none; box-sizing: border-box; }
    .unit-panel button { display: block; width: 100%; padding: 6px 8px; text-align: left; border: none; background: none; cursor: pointer; font-size: 12px; color: #1e293b; }
    .unit-panel button:hover { background: #f0f6ff; }
    .unit-panel button.selected { background: #e0ecff; font-weight: 600; }
    .unit-create { border-top: 1px solid #e2e8f0 !important; color: #2c5cff !important; font-weight: 500; background: #f8fafc !important; }
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
  readonly savingExcel = signal(false);
  readonly showInvoicePreview = signal(false);
  readonly sourceQuotationNumber = signal("");

  readonly invoiceRows = signal<TaxInvoiceRow[]>([]);
  readonly customColumns = signal<string[]>([]);
  readonly showAddColumnInput = signal(false);
  readonly newColumnName = signal("");

  readonly defaultUnits = ["Nos","Bag","Kg","Ton","Load","Cubic Feet","Cubic Meter","Meter","Litre","Roll","Bundle","Piece","Box"];
  readonly customUnits = signal<string[]>(this.loadCustomUnits());
  readonly allUnits = computed(() => [...this.defaultUnits, ...this.customUnits()].sort((a, b) => a.localeCompare(b)));
  readonly openUnitMenu = signal("");
  readonly unitSearch = signal("");
  readonly openRowMenu = signal("");
  readonly filteredUnits = computed(() => {
    const q = this.unitSearch().trim().toLowerCase();
    const all = this.allUnits();
    return q ? all.filter(u => u.toLowerCase().includes(q)) : all;
  });

  readonly clientSearchTerm = signal("");
  readonly showClientDropdown = signal(false);
  readonly selectedClientId = signal<string | null>(null);
  readonly showMakeClientDialog = signal(false);
  readonly makeClientData = signal<{ clientName: string; clientAddress: string; clientState: string; clientGstin: string; sourceId: string } | null>(null);

  readonly makeClientInitialValue = computed<ClientFormValue | null>(() => {
    const d = this.makeClientData();
    if (!d) return null;
    return {
      name: d.clientName,
      mobile: "",
      address: d.clientAddress,
      gstNumber: d.clientGstin,
      state: d.clientState,
      supervisor: "",
      status: "Active",
    };
  });

  readonly filteredClients = computed(() => {
    const term = this.clientSearchTerm().toLowerCase().trim();
    const all = this.data.clients();
    const sorted = [...all].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return sorted;
    return sorted.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.mobile.includes(term) ||
      c.address.toLowerCase().includes(term)
    );
  });

  clientName = "";
  clientAddress = "";
  clientState = "Tamil Nadu";
  clientGstin = "";
  cgstPercent = signal(9);
  sgstPercent = signal(9);
  roundOff = signal(0);

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

  readonly subtotal = computed(() =>
    this.invoiceRows()
      .filter(row => !this.isSectionHeading(row))
      .reduce((sum, r) => sum + (r.amount || 0), 0)
  );
  readonly cgstAmount = computed(() => Math.round(this.subtotal() * this.cgstPercent() / 100));
  readonly sgstAmount = computed(() => Math.round(this.subtotal() * this.sgstPercent() / 100));
  readonly totalAmount = computed(() => this.subtotal() + this.cgstAmount() + this.sgstAmount() + this.roundOff());
  readonly amountInWords = computed(() => numberToWords(Math.round(this.totalAmount())));

  /**
   * Serial number map for every visible row.
   *  - Parent rows (including section headings) get a sequential counter
   *    (1, 2, 3…) so every parent row in the table shows an S.No.
   *  - Child rows (rows with parentRowId) get their own counter that resets
   *    to 1 within each parent group, so every child has its own number.
   */
  readonly rowSnoMap = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    const childCounters: Record<string, number> = {};
    let parentCounter = 0;
    for (const row of this.invoiceRows()) {
      if (!row.parentRowId) {
        parentCounter += 1;
        map[row.id] = parentCounter;
      } else {
        childCounters[row.parentRowId] = (childCounters[row.parentRowId] || 0) + 1;
        map[row.id] = childCounters[row.parentRowId];
      }
    }
    return map;
  });

  /**
   * Parent-only serial number map used by the report/PDF. Section-heading
   * parents are excluded so the S.No column only increments for actual
   * billable parent rows in the printed document.
   */
  readonly parentSnoMap = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    let counter = 0;
    for (const row of this.invoiceRows()) {
      if (!row.parentRowId && !this.isSectionHeading(row)) counter += 1;
      map[row.id] = counter;
    }
    return map;
  });

  readonly parentIds = computed(() => {
    const ids = new Set<string>();
    for (const row of this.invoiceRows()) {
      if (row.parentRowId) ids.add(row.parentRowId);
    }
    return ids;
  });

  /**
   * A parent row is treated as a section heading when it has no billable
   * values (no unit, qty, rate or amount). Section headings are not assigned
   * an S.No, are excluded from subtotals, GST and the final total, and
   * never render Unit/Qty/Rate/Amount inputs in the editable table.
   */
  isSectionHeading(row: TaxInvoiceRow | any): boolean {
    if (!row || row.parentRowId) return false;
    const unit = (row.unit || "").trim();
    const qty = Number(row.qty) || 0;
    const rate = Number(row.rate) || 0;
    const amount = Number(row.amount) || 0;
    return !unit && qty === 0 && rate === 0 && amount === 0;
  }

  readonly currentInvoiceForPreview = computed<TaxInvoice | null>(() => {
    if (!this.editingInvoice()) return null;
    const rowSno = this.rowSnoMap();
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
      items: this.invoiceRows().map(r => ({
        ...r,
        isSectionHeading: this.isSectionHeading(r),
        sno: rowSno[r.id],
      })) as any,
      customColumns: this.customColumns(),
      subtotal: this.subtotal(),
      cgstPercent: this.cgstPercent(),
      sgstPercent: this.sgstPercent(),
      cgstAmount: this.cgstAmount(),
      sgstAmount: this.sgstAmount(),
      roundOff: this.roundOff(),
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
    const quotation = history.state?.quotationForInvoice as Quotation | undefined;
    if (quotation?.id) this.startInvoiceFromQuotation(quotation);
  }

  onClientSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.clientSearchTerm.set(value);
    this.selectedClientId.set(null);
    this.showClientDropdown.set(true);
    this.clientName = value;
  }

  onClientSearchFocus() {
    this.showClientDropdown.set(true);
  }

  selectClient(client: Client) {
    this.clientName = client.name;
    this.clientAddress = client.address;
    this.clientGstin = client.gstNumber || "";
    this.clientState = client.state || "Tamil Nadu";
    this.clientSearchTerm.set(client.name);
    this.selectedClientId.set(client._id || "");
    this.showClientDropdown.set(false);
  }

  makeAsClient(inv: TaxInvoice) {
    const existing = this.data.clients().find(
      c => c.name.toLowerCase() === inv.clientName.toLowerCase()
    );
    if (existing) {
      this.api.patchInvoice(inv.id, { clientId: existing._id || existing.id }).subscribe({
        next: () => {
          alert("Client already exists. Invoice linked to existing client.");
          this.loadInvoicesFromBackend();
        },
        error: () => {},
      });
      return;
    }
    this.makeClientData.set({
      clientName: inv.clientName,
      clientAddress: inv.clientAddress,
      clientState: inv.clientState,
      clientGstin: inv.clientGstin,
      sourceId: inv.id,
    });
    this.showMakeClientDialog.set(true);
  }

  onMakeClientCreated(value: ClientFormValue) {
    const data = this.makeClientData();
    if (!data) return;
    this.api.createClient({
      name: value.name,
      mobile: value.mobile,
      address: value.address,
      gstNumber: value.gstNumber || "",
      state: value.state || "",
      supervisor: value.supervisor || "",
      status: value.status || "Active",
    }).subscribe({
      next: (res: any) => {
        const clientId = res?.client?.clientId || res?.clientId || res?.id;
        const mongoId = res?.client?._id || res?._id;
        this.data.addClient({ ...value, id: clientId, gstNumber: value.gstNumber || "" } as any);
        this.api.patchInvoice(data.sourceId, { clientId: mongoId || clientId }).subscribe({
          next: () => {
            this.showMakeClientDialog.set(false);
            this.makeClientData.set(null);
            this.loadInvoicesFromBackend();
          },
          error: () => {},
        });
      },
      error: (err: any) => {
        console.error("Failed to create client", err);
      },
    });
  }

  @HostListener("document:pointerdown", ["$event"])
  onDocumentClick(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (target && !target.closest(".client-search-wrapper")) {
      this.showClientDropdown.set(false);
    }
    if (target && !target.closest(".col-unit")) {
      this.openUnitMenu.set("");
      this.unitSearch.set("");
    }
  }

  private loadInvoicesFromBackend() {
    this.api.listInvoices({ limit: 25, page: 1 }).subscribe({
      next: (res) => {
        const items = (res.items || []).map((i: any) => ({
          id: i._id,
          invoiceNumber: i.invoiceNumber,
          date: i.date,
          clientId: i.clientId || null,
          clientName: i.clientName || "",
          clientAddress: i.clientAddress || "",
          clientState: i.clientState || "",
          clientGstin: i.clientGstin || "",
          items: (i.items || []).map((it: any, idx: number) => ({
            id: it.id || String(idx),
            sno: it.sno ?? idx + 1,
            description: it.description || "",
            hsnCode: it.hsnCode || "",
            unit: it.unit || "",
            qty: it.qty ?? 0,
            rate: it.rate ?? 0,
            amount: it.amount ?? 0,
            isCustom: it.isCustom ?? false,
            parentRowId: it.parentRowId || null,
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
    this.sourceQuotationNumber.set("");
    this.editingInvoiceId.set(null);
    this.invoiceRows.set([this.newRow()]);
    this.customColumns.set([]);
    this.showAddColumnInput.set(false);
    this.newColumnName.set("");
    this.clientName = "";
    this.clientAddress = "";
    this.clientState = "Tamil Nadu";
    this.clientGstin = "";
    this.clientSearchTerm.set("");
    this.selectedClientId.set(null);
    this.cgstPercent.set(9);
    this.sgstPercent.set(9);
    this.roundOff.set(0);
    this.editingInvoice.set(true);
  }

  editInvoice(inv: TaxInvoice) {
    this.sourceQuotationNumber.set("");
    this.editingInvoiceId.set(inv.id);
    const rows = inv.items.length > 0 ? inv.items.map((it: any, idx) => {
      const merged: any = { ...it };
      // Preserve the hierarchy metadata explicitly so parent/child
      // relationships survive the save → reload round-trip.
      merged.id = merged.id != null ? String(merged.id) : `ROW-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`;
      merged.parentRowId =
        merged.parentRowId === null || merged.parentRowId === undefined || merged.parentRowId === ""
          ? null
          : String(merged.parentRowId);
      return merged;
    }) : [this.newRow()];
    // Defensive: remap any dangling parentRowId references to null.
    const idSet = new Set<string>(rows.map((r: any) => r.id));
    rows.forEach((r: any) => {
      if (r.parentRowId && !idSet.has(r.parentRowId)) r.parentRowId = null;
    });
    this.mergeCustomValues(rows, inv.invoiceNumber);
    this.invoiceRows.set(rows as TaxInvoiceRow[]);
    this.customColumns.set(inv.customColumns || []);
    this.showAddColumnInput.set(false);
    this.newColumnName.set("");
    this.clientName = inv.clientName;
    this.clientAddress = inv.clientAddress;
    this.clientState = inv.clientState || "Tamil Nadu";
    this.clientGstin = inv.clientGstin;
    this.clientSearchTerm.set(inv.clientName);
    this.selectedClientId.set(this.findClientIdByName(inv.clientName));
    this.cgstPercent.set(inv.cgstPercent ?? 9);
    this.sgstPercent.set(inv.sgstPercent ?? 9);
    this.roundOff.set(inv.roundOff ?? 0);
    this.editingInvoice.set(true);
  }

  previewInvoice(inv: TaxInvoice) {
    this.editingInvoiceId.set(inv.id);
    const rows = inv.items.map((it: any, idx) => {
      const merged: any = { ...it };
      merged.id = merged.id != null ? String(merged.id) : `ROW-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`;
      merged.parentRowId =
        merged.parentRowId === null || merged.parentRowId === undefined || merged.parentRowId === ""
          ? null
          : String(merged.parentRowId);
      return merged;
    });
    const idSet = new Set<string>(rows.map((r: any) => r.id));
    rows.forEach((r: any) => {
      if (r.parentRowId && !idSet.has(r.parentRowId)) r.parentRowId = null;
    });
    this.mergeCustomValues(rows, inv.invoiceNumber);
    this.invoiceRows.set(rows as TaxInvoiceRow[]);
    this.customColumns.set(inv.customColumns || []);
    this.clientName = inv.clientName;
    this.clientAddress = inv.clientAddress;
    this.clientState = inv.clientState || "Tamil Nadu";
    this.clientGstin = inv.clientGstin;
    this.clientSearchTerm.set(inv.clientName);
    this.selectedClientId.set(this.findClientIdByName(inv.clientName));
    this.cgstPercent.set(inv.cgstPercent ?? 9);
    this.sgstPercent.set(inv.sgstPercent ?? 9);
    this.roundOff.set(inv.roundOff ?? 0);
    this.editingInvoice.set(true);
    setTimeout(() => this.showInvoicePreview.set(true), 50);
  }

  cancelEdit() {
    this.editingInvoice.set(false);
    this.editingInvoiceId.set(null);
    this.sourceQuotationNumber.set("");
  }

  private startInvoiceFromQuotation(quotation: Quotation) {
    const rows = (quotation.items || []).map((item: any, index) => ({
      ...item,
      ...(item?.customValues || {}),
      id: item?.id != null ? String(item.id) : `ROW-${Date.now()}-${index}`,
      sno: Number(item?.sno) || index + 1,
      description: item?.description || "",
      hsnCode: item?.hsnCode || "",
      unit: item?.unit || "",
      qty: Number(item?.qty) || 0,
      rate: Number(item?.rate) || 0,
      amount: Number(item?.amount) || ((Number(item?.qty) || 0) * (Number(item?.rate) || 0)),
      parentRowId: item?.parentRowId ? String(item.parentRowId) : null,
    })) as TaxInvoiceRow[];

    this.editingInvoiceId.set(null);
    this.invoiceRows.set(rows.length ? rows : [this.newRow()]);
    this.customColumns.set([...(quotation.customColumns || [])]);
    this.showAddColumnInput.set(false);
    this.newColumnName.set("");
    this.clientName = quotation.clientName || "";
    this.clientAddress = quotation.clientAddress || "";
    this.clientState = quotation.clientState || "Tamil Nadu";
    this.clientGstin = quotation.clientGstin || "";
    this.clientSearchTerm.set(quotation.clientName || "");
    this.selectedClientId.set(quotation.clientId || this.findClientIdByName(quotation.clientName || ""));
    this.cgstPercent.set(Number(quotation.cgstPercent) || 0);
    this.sgstPercent.set(Number(quotation.sgstPercent) || 0);
    this.roundOff.set(Number(quotation.roundOff) || 0);
    this.sourceQuotationNumber.set(quotation.quotationNumber || "Quotation");
    this.editingInvoice.set(true);
  }

  deleteInvoice(id: string) {
    if (!confirm("Delete this invoice?")) return;
    const inv = this.data.taxInvoiceById(id);
    if (inv?.invoiceNumber) this.removeStoredCustomValues(inv.invoiceNumber);
    this.data.deleteTaxInvoice(id);
    this.loadInvoicesFromBackend();
  }

  addRow() {
    this.invoiceRows.update(rows => [...rows, this.newRow()]);
  }

  addSubRow(parentId: string) {
    const child = this.newRow();
    child.parentRowId = parentId;
    this.invoiceRows.update(rows => {
      const index = rows.findIndex(r => r.id === parentId);
      if (index === -1) return [...rows, child];
      const next = [...rows];
      next.splice(index + 1, 0, child);
      return next;
    });
  }

  toggleRowMenu(rowId: string, event?: Event) {
    event?.stopPropagation();
    this.openRowMenu.set(this.openRowMenu() === rowId ? "" : rowId);
  }

  readonly deleteConfirm = signal<{ parentId: string; childCount: number } | null>(null);

  removeRow(id: string) {
    const childCount = this.invoiceRows().filter(r => r.parentRowId === id).length;
    if (childCount > 0) {
      this.deleteConfirm.set({ parentId: id, childCount });
      return;
    }
    this.invoiceRows.update(rows => rows.filter(r => r.id !== id));
  }

  confirmDeleteParentOnly() {
    const dc = this.deleteConfirm();
    if (!dc) return;
    const parentId = dc.parentId;
    this.invoiceRows.update(rows =>
      rows
        .filter(r => r.id !== parentId)
        .map(r => r.parentRowId === parentId ? { ...r, parentRowId: null } : r)
    );
    this.deleteConfirm.set(null);
  }

  confirmDeleteParentAndChildren() {
    const dc = this.deleteConfirm();
    if (!dc) return;
    const parentId = dc.parentId;
    this.invoiceRows.update(rows => rows.filter(r => r.id !== parentId && r.parentRowId !== parentId));
    this.deleteConfirm.set(null);
  }

  cancelDeleteConfirm() {
    this.deleteConfirm.set(null);
  }

  @HostListener("document:click", ["$event"])
  closeRowMenu(event: MouseEvent) {
    if (!this.openRowMenu()) return;
    const target = event.target as HTMLElement | null;
    if (target && target.closest(".row-action-menu, .row-action-btn")) return;
    this.openRowMenu.set("");
  }

  addSectionHeader() {
    this.invoiceRows.update(rows => [
      ...rows,
      { id: `SEC-${Date.now()}`, sno: 0, description: "", hsnCode: "", unit: "", qty: null as any, rate: null as any, amount: null as any, isCustom: false, parentRowId: null },
    ]);
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
    this.invoiceRows.update(rows =>
      rows.map(row => {
        const { [colName]: _, ...rest } = row as any;
        return rest as TaxInvoiceRow;
      })
    );
  }

  private loadCustomValues(docNumber: string): Array<Record<string, string>> {
    try {
      const store = JSON.parse(localStorage.getItem("ajui_custom_values") || "{}");
      return store?.[docNumber] || [];
    } catch { return []; }
  }

  private persistCustomValues(docNumber: string, values: Array<Record<string, string>>) {
    try {
      const store = JSON.parse(localStorage.getItem("ajui_custom_values") || "{}") || {};
      store[docNumber] = values;
      localStorage.setItem("ajui_custom_values", JSON.stringify(store));
    } catch { /* ignore storage errors */ }
  }

  private removeStoredCustomValues(docNumber: string) {
    try {
      const store = JSON.parse(localStorage.getItem("ajui_custom_values") || "{}") || {};
      delete store[docNumber];
      localStorage.setItem("ajui_custom_values", JSON.stringify(store));
    } catch { /* ignore storage errors */ }
  }

  private mergeCustomValues(rows: TaxInvoiceRow[], docNumber: string) {
    const values = this.loadCustomValues(docNumber);
    rows.forEach((row, i) => {
      if (values[i]) Object.assign(row, values[i]);
    });
  }

  private loadCustomUnits(): string[] {
    try { return JSON.parse(localStorage.getItem("ajui_custom_units") || "[]"); } catch { return []; }
  }
  private persistCustomUnits(units: string[]) {
    localStorage.setItem("ajui_custom_units", JSON.stringify(units));
  }
  toggleUnitMenu(rowId: string) {
    this.openUnitMenu.set(this.openUnitMenu() === rowId ? "" : rowId);
    this.unitSearch.set("");
  }
  selectUnit(row: TaxInvoiceRow, unit: string) {
    row.unit = unit;
    this.openUnitMenu.set("");
    this.unitSearch.set("");
  }
  createAndSelectUnit(row: TaxInvoiceRow, unit: string) {
    const existing = this.allUnits().find(u => u.toLowerCase() === unit.toLowerCase());
    const toAdd = existing || unit;
    if (!existing) {
      const updated = [...this.customUnits(), toAdd];
      this.customUnits.set(updated);
      this.persistCustomUnits(updated);
    }
    row.unit = toAdd;
    this.openUnitMenu.set("");
    this.unitSearch.set("");
  }

  recalc(row: TaxInvoiceRow) {
    row.amount = (Number(row.qty) || 0) * (Number(row.rate) || 0);
    this.invoiceRows.update(rows => [...rows]);
  }

  recalcTax() {
    this.invoiceRows.update(rows => [...rows]);
  }

  private newRow(): TaxInvoiceRow {
    return { id: `ROW-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sno: 0, description: "", hsnCode: "", unit: "", qty: null as any, rate: null as any, amount: null as any, parentRowId: null };
  }

  private findClientIdByName(name: string): string | null {
    const match = this.data.clients().find(c => c.name.toLowerCase() === name.toLowerCase());
    return match?._id || null;
  }

  async exportToExcel() {
    this.savingExcel.set(true);
    try {
      const rows = this.invoiceRows();
      const customColumns = this.customColumns();
      const company = this.companyProfile();
      const items = rows.map((row) => {
        const customValues: Record<string, string> = {};
        customColumns.forEach((col) => {
          customValues[col] = (row as any)[col] || "";
        });
        return {
          id: row.id,
          description: row.description || "",
          hsnCode: row.hsnCode || "",
          unit: row.unit || "",
          qty: Number(row.qty) || 0,
          rate: Number(row.rate) || 0,
          amount: Number(row.amount) || 0,
          parentRowId: row.parentRowId || null,
          customValues,
        };
      });

      await buildBusinessDocumentXlsx({
        documentTitle: "TAX INVOICE",
        documentNumber: this.currentInvoiceNumber(),
        documentDate: this.invoiceDate(),
        company: {
          name: company.name,
          address: company.address,
          state: company.state,
          gstin: company.gstin,
        },
        client: {
          name: this.clientName,
          address: this.clientAddress,
          state: this.clientState,
          gstin: this.clientGstin,
        },
        items,
        customColumns,
        totals: {
          subtotal: this.subtotal(),
          cgstPercent: this.cgstPercent(),
          cgstAmount: this.cgstAmount(),
          sgstPercent: this.sgstPercent(),
          sgstAmount: this.sgstAmount(),
          roundOff: this.roundOff(),
          totalAmount: this.totalAmount(),
          amountInWords: this.amountInWords(),
        },
        fileName: `tax-invoice-${this.currentInvoiceNumber()}`,
      });
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Failed to export Excel. Please try again.");
    } finally {
      this.savingExcel.set(false);
    }
  }

  async saveInvoice(status: "Draft" | "Sent" | "Paid") {
    if (this.invoiceRows().length === 0 || !this.clientName.trim()) {
      alert("Please fill in client name and at least one item.");
      return;
    }

    if (!this.editingInvoiceId() && this.sourceQuotationNumber() && !confirm(
      `Create this invoice from ${this.sourceQuotationNumber()}? You can continue editing before confirming.`,
    )) {
      return;
    }

    this.saving.set(true);

    const rowSno = this.rowSnoMap();
    const validItems = this.invoiceRows()
      .map((row) => ({
        sno: rowSno[row.id] || 0,
        id: row.id,
        description: (row.description || "").trim(),
        hsnCode: row.hsnCode || "",
        unit: row.unit || "",
        qty: Number(row.qty) || 0,
        rate: Number(row.rate) || 0,
        amount: Number(row.amount) || 0,
        isCustom: row.isCustom ?? false,
        parentRowId: row.parentRowId || null,
      }))
      .filter(row => row.description.length > 0 || row.isCustom);

    const customValues = this.invoiceRows().map((row) => {
      const values: Record<string, string> = {};
      this.customColumns().forEach(col => { values[col] = (row as any)[col] || ""; });
      return values;
    });
    this.persistCustomValues(this.currentInvoiceNumber(), customValues);

    const payload = {
      date: this.invoiceDate(),
      companyName: this.companyProfile().name,
      companyAddress: this.companyProfile().address,
      state: this.companyProfile().state,
      gstin: this.companyProfile().gstin,
      clientId: this.selectedClientId() || null,
      clientName: this.clientName.trim(),
      clientAddress: this.clientAddress.trim(),
      clientState: this.clientState,
      clientGstin: this.clientGstin.trim(),
      items: validItems,
      customColumns: this.customColumns(),
      subtotal: this.subtotal(),
      cgstPercent: this.cgstPercent(),
      sgstPercent: this.sgstPercent(),
      cgstAmount: this.cgstAmount(),
      sgstAmount: this.sgstAmount(),
      roundOff: this.roundOff(),
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
      this.sourceQuotationNumber.set("");
      this.loadInvoicesFromBackend();
    } catch (err: any) {
      alert("Failed to save invoice: " + (err?.message || "please try again"));
    } finally {
      this.saving.set(false);
    }
  }
}
