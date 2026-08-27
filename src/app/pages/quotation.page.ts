import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostListener, inject, signal, computed, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import { ErpDataService, type Client } from "../data/erp-data.service";
import { ApiService } from "../core/api.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { QuotationReportComponent, QuotationReportData } from "../shared/quotation-report.component";
import { ClientFormDialogComponent, type ClientFormValue } from "../shared/client-form-dialog.component";
import { formatMoney } from "../shared/format";
import { buildBusinessDocumentXlsx } from "../shared/excel-export";
import type { Quotation, QuotationRow } from "../../data/dashboardData";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { SearchableSelectComponent } from "../shared/searchable-select.component";

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
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, QuotationReportComponent, ClientFormDialogComponent, SearchableSelectComponent],
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
                <div class="page-search-bar">
                  <input
                    type="search"
                    class="seamless-search"
                    placeholder="Search quotations by client, quote number, or amount..."
                    [value]="search()"
                    (input)="search.set($any($event.target).value)"
                  />
                  <svg viewBox="0 0 24 24" class="search-icon" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
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
                      @for (quote of filteredQuotations(); track quote.id) {
                        <tr>
                          <td><strong>{{ quote.quotationNumber }}</strong></td>
                          <td>{{ quote.date }}</td>
                          <td>{{ quote.clientName || '-' }}</td>
                          <td><strong>{{ formatMoney(quote.totalAmount) }}</strong></td>
                          <td>
                            <span class="status-pill" [class]="quote.status.toLowerCase()">{{ quote.status }}</span>
                          </td>
                          <td>
                            <button type="button" class="invoice-action-btn" title="Make Invoice" aria-label="Make invoice from quotation" (click)="makeInvoice(quote)">
                              <ion-icon name="receipt-outline"></ion-icon>
                              Make Invoice
                            </button>
                            <button type="button" class="icon-action-btn edit" title="Edit" (click)="editQuotation(quote)">
                              <ion-icon name="pencil-outline"></ion-icon>
                            </button>
                            <button type="button" class="icon-action-btn delete" title="Delete" (click)="deleteQuotation(quote.id)">
                              <ion-icon name="trash"></ion-icon>
                            </button>
                            @if (!quotationHasClient(quote) && quote.clientName) {
                              <button type="button" class="icon-action-btn client" title="Make as Client" [disabled]="convertingClientId() === quote.id" (click)="makeAsClient(quote)">
                                @if (convertingClientId() === quote.id) {
                                  <span class="agb-loading-spinner" aria-hidden="true"></span>
                                } @else {
                                  <ion-icon name="id-card-outline"></ion-icon>
                                }
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
              <!-- Quotation Editor View -->
              <section class="quotation-editor">
                <div class="editor-header">
                  <button type="button" class="back-link" (click)="cancelEdit()">
                    <ion-icon name="arrow-back-outline"></ion-icon>
                    Back to Quotations
                  </button>
                  <div class="editor-actions">
                    <button type="button" class="btn-outline" (click)="exportToExcel()" [disabled]="savingExcel()">Export Excel</button>
                    <button type="button" class="btn-secondary" (click)="saveQuotation('Draft')" [disabled]="savingQuote()">
                      @if (savingQuote()) { <span class="agb-loading-spinner" aria-hidden="true"></span> }
                      {{ savingQuote() ? 'Saving…' : 'Save as Draft' }}
                    </button>
                    <button type="button" class="btn-primary" (click)="saveQuotation('Sent')" [disabled]="savingQuote()">
                      @if (savingQuote()) { <span class="agb-loading-spinner" aria-hidden="true"></span> }
                      {{ savingQuote() ? 'Saving…' : 'Save & Send' }}
                    </button>
                    <button type="button" class="btn-outline" (click)="showQuotationPreview.set(true)" [disabled]="savingQuote()">Preview</button>
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
                        <agb-searchable-select [(ngModel)]="clientState" [options]="states" placeholder="Select state" />
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
                      <colgroup>
                        <col class="col-col-sno" />
                        <col class="col-col-desc" />
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
                          <tr [class.sub-row]="!!row.parentRowId" [class.section-row]="isSectionHeading(row)" [class.parent-row]="!row.parentRowId && !isSectionHeading(row)">
                            <td class="col-sno">{{ rowSnoMap()[row.id] }}</td>
                            <td class="col-desc">
                              <div class="desc-cell" [class.is-sub]="!!row.parentRowId" [class.is-heading]="isSectionHeading(row)">
                                <input type="text" [(ngModel)]="row.description" [placeholder]="isSectionHeading(row) ? 'Section heading (e.g. Plumbing Fittings)' : 'Description'" class="table-input" />
                              </div>
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
                                <input type="number" [(ngModel)]="row.qty" (ngModelChange)="recalculateAmount(row)" min="0" class="table-input" />
                              }
                            </td>
                            <td class="col-rate">
                              @if (!parentIds().has(row.id)) {
                                <input type="number" [(ngModel)]="row.rate" (ngModelChange)="recalculateAmount(row)" min="0" class="table-input" />
                              }
                            </td>
                            <td class="col-amount amount-cell">{{ (isSectionHeading(row) || parentIds().has(row.id)) ? '' : formatMoney(row.amount) }}</td>
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
                                <button type="button" class="remove-row-btn" (click)="removeRow(row.id)">×</button>
                              </div>
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

                  @if (deleteConfirm(); as dc) {
                    <div class="confirm-overlay" role="presentation" (click)="cancelDeleteConfirm()">
                      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" (click)="$event.stopPropagation()">
                        <h3 id="confirm-delete-title" class="confirm-title">Delete row</h3>
                        <p class="confirm-message">This row contains sub rows. Choose one:</p>
                        <div class="confirm-actions">
                          <button type="button" class="btn-confirm" (click)="confirmDeleteParentOnly()">Delete Parent Only</button>
                          <button type="button" class="btn-confirm danger" (click)="confirmDeleteParentAndChildren()">Delete Parent and All Sub Rows</button>
                          <button type="button" class="btn-cancel" (click)="cancelDeleteConfirm()">Cancel</button>
                        </div>
                      </div>
                    </div>
                  }

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
    @if (showQuotationPreview()) {
      <div class="form-overlay" role="presentation" (click)="showQuotationPreview.set(false)">
        <section class="erp-dialog quotation-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title" (click)="$event.stopPropagation()">
          <div class="dialog-head">
            <div>
              <span>Quotation Preview</span>
              <h2 id="preview-title">{{ currentQuoteNumber() }}</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Close preview" (click)="showQuotationPreview.set(false)">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <agb-quotation-report
            #quotationReport
            [quotationData]="reportQuotation()"
            [embedded]="true"
            class="preview-report"
          />
          <div class="dialog-actions">
            <button type="button" class="primary-action" (click)="quotationReport?.exportToPDF()">
              <ion-icon name="download-outline"></ion-icon>
              Download PDF
            </button>
            <button type="button" class="secondary-action" (click)="showQuotationPreview.set(false)">Close</button>
          </div>
        </section>
      </div>
    }

    @if (showMakeClientDialog()) {
      <agb-client-form-dialog
        [initialValue]="makeClientInitialValue()"
        [title]="'Convert to Client'"
        [description]="'Create a client record from this quotation details.'"
        [submitLabel]="'Create Client'"
        [submitting]="creatingClient()"
        (cancel)="showMakeClientDialog.set(false)"
        (create)="onMakeClientCreated($event)"
      ></agb-client-form-dialog>
    }
  `,
  styles: [`
    .page-search-bar {
      position: relative;
      max-width: 600px;
      margin: 16px auto 24px;
    }
    .seamless-search {
      width: 100%;
      padding: 12px 16px 12px 44px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      font-size: 15px;
      background: #fff;
      transition: all 0.2s ease;
    }
    .seamless-search:focus {
      outline: none;
      border-color: #002263;
      box-shadow: 0 0 0 3px rgba(0, 34, 99, 0.1);
    }
    .search-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      color: #9ca3af;
      pointer-events: none;
    }
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
    .icon-action-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; cursor: pointer; font-size: 16px; margin-right: 6px; transition: background 150ms, transform 150ms; }
    .icon-action-btn:hover { transform: scale(1.1); }
    .icon-action-btn ion-icon { font-size: 16px; pointer-events: none; }
    .icon-action-btn.edit { background: #e0ecff; color: #2c5cff; }
    .icon-action-btn.edit:hover { background: #c7d9ff; }
    .icon-action-btn.delete { background: #fee2e2; color: #dc2626; }
    .icon-action-btn.delete:hover { background: #fecaca; }
    .icon-action-btn.client { background: #d1fae5; color: #059669; }
    .icon-action-btn.client:hover { background: #a7f3d0; }
    .icon-action-btn:disabled { cursor: wait; opacity: .72; }
    .icon-action-btn .agb-loading-spinner,
    .editor-actions .agb-loading-spinner { width: 15px; height: 15px; border-width: 2px; }
    .invoice-action-btn { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; margin-right: 6px; padding: 0 10px; border: 0; border-radius: 999px; background: #ede9fe; color: #6d28d9; font-size: 11px; font-weight: 700; cursor: pointer; }
    .invoice-action-btn:hover { background: #ddd6fe; }
    .invoice-action-btn ion-icon { font-size: 15px; }
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
      table-layout: fixed;
      border-collapse: collapse;
      border: 1px solid #cfd8e6;
      border-radius: 8px;
      overflow: hidden;
    }
    .items-table col.col-col-sno { width: 50px; }
    .items-table col.col-col-desc { width: auto; }
    .items-table col.col-col-unit { width: 90px; }
    .items-table col.col-col-qty { width: 90px; }
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
      padding: 10px 8px;
      text-align: left;
      border-bottom: 2px solid #cfd8e6;
    }
    .items-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e8edf4;
      vertical-align: middle;
      box-sizing: border-box;
    }
    .items-table tr:last-child td { border-bottom: none; }
    .col-sno { width: 50px; text-align: center; }
    .col-desc { min-width: 200px; }
    .col-unit { width: 80px; }
    .col-qty { width: 80px; }
    .col-rate { width: 100px; }
    .col-amount { width: 110px; text-align: right; }
    .col-custom { min-width: 100px; }
    .col-action { width: 78px; text-align: center; }
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
    .sub-row td { background: #f8fafc; }
    .sub-row .col-desc { padding-left: 30px; }
    .sub-row .desc-cell .table-input { color: #475569; }
    .parent-row td { background: #ffffff; }
    .parent-row .desc-cell .table-input { font-weight: 600; color: #0f172a; }
    .parent-row .col-sno { font-weight: 700; color: #0f172a; }
    .sub-row .col-sno { color: #64748b; }
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
      min-width: 0;
      padding-right: 8px;
    }
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
      .icon-action-btn, .btn-edit, .btn-save, .btn-delete, .table-actions, .btn-confirm, .btn-cancel { display: none !important; }
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
    .form-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .quotation-preview-dialog {
      background: #fff;
      border-radius: 16px;
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .quotation-preview-dialog .dialog-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    .quotation-preview-dialog .dialog-head h2 {
      margin: 4px 0 0;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .quotation-preview-dialog .icon-button {
      background: #f1f5f9;
      border: none;
      border-radius: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #475569;
    }
    .quotation-preview-dialog .icon-button:hover {
      background: #e2e8f0;
    }
    .preview-report {
      flex: 1;
      overflow: auto;
    }
    .quotation-preview-dialog .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .dialog-actions .primary-action,
    .dialog-actions .secondary-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    .dialog-actions .primary-action {
      background: #2c5cff;
      color: #fff;
    }
    .dialog-actions .primary-action:hover {
      background: #1e4ae8;
    }
    .dialog-actions .secondary-action {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .dialog-actions .secondary-action:hover {
      background: #e2e8f0;
    }
    .client-search-wrapper { position: relative; }
    .client-search-input { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; color: #1e293b; background: #fff; outline: none; transition: border-color 140ms; box-sizing: border-box; }
    .client-search-input:focus { border-color: #2c5cff; box-shadow: 0 0 0 3px rgba(44, 92, 255, 0.1); }
    .client-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 100; max-height: 220px; overflow-y: auto; margin-top: 4px; }
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
    .items-table tr:has(.erp-select-menu.open) {
      position: relative;
      z-index: 30;
    }
    .items-table:has(.erp-select-menu.open) {
      overflow: visible !important;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationPage {
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  readonly formatMoney = formatMoney;
  readonly states = INDIAN_STATES;

  readonly editingQuotation = signal(false);
  readonly search = signal("");
  readonly filteredQuotations = computed(() => {
    const searchTerm = this.search().toLowerCase().trim();
    if (!searchTerm) return this.data.quotations();
    return this.data.quotations().filter(quote => {
      const client = this.data.clients().find(c => c.id === quote.clientId);
      return (
        quote.quotationNumber?.toLowerCase().includes(searchTerm) ||
        quote.clientName?.toLowerCase().includes(searchTerm) ||
        client?.name.toLowerCase().includes(searchTerm) ||
        String(quote.totalAmount || 0).includes(searchTerm)
      );
    });
  });
  readonly showAddColumnInput = signal(false);
  readonly newColumnName = signal("");
readonly savingPdf = signal(false);
  readonly savingExcel = signal(false);
  readonly savingQuote = signal(false);
  readonly convertingClientId = signal<string | null>(null);
  readonly creatingClient = signal(false);
  readonly editingQuoteId = signal<string | null>(null);
  readonly quotationRows = signal<QuotationRow[]>([]);
  readonly customColumns = signal<string[]>([]);
  readonly showQuotationPreview = signal(false);

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

  @ViewChild('quotationReport') quotationReport!: QuotationReportComponent;

  readonly companyProfile = this.data.companyProfile;

  clientName = "";
  clientAddress = "";
  clientState = "Tamil Nadu";
  clientGstin = "";
  cgstPercent = signal(9);
  sgstPercent = signal(9);
  roundOff = signal(0);

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
    this.quotationRows()
      .filter(row => !this.isSectionHeading(row))
      .reduce((sum, row) => sum + (row.amount || 0), 0)
  );

  /**
   * A parent row is treated as a section heading when it has no billable
   * values (no unit, qty, rate or amount). Section headings are not assigned
   * an S.No, are excluded from subtotals, GST and the final total, and
   * never render Unit/Qty/Rate/Amount inputs in the editable table.
   */
  isSectionHeading(row: QuotationRow | any): boolean {
    if (!row || row.parentRowId) return false;
    const unit = (row.unit || "").trim();
    const qty = Number(row.qty) || 0;
    const rate = Number(row.rate) || 0;
    const amount = Number(row.amount) || 0;
    return !unit && qty === 0 && rate === 0 && amount === 0;
  }

  readonly cgstAmount = computed(() => this.subtotal() * this.cgstPercent() / 100);
  readonly sgstAmount = computed(() => this.subtotal() * this.sgstPercent() / 100);

  readonly totalAmount = computed(() =>
    this.subtotal() + this.cgstAmount() + this.sgstAmount() + this.roundOff()
  );

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
    for (const row of this.quotationRows()) {
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
    for (const row of this.quotationRows()) {
      if (!row.parentRowId && !this.isSectionHeading(row)) counter += 1;
      map[row.id] = counter;
    }
    return map;
  });

  readonly parentIds = computed(() => {
    const ids = new Set<string>();
    for (const row of this.quotationRows()) {
      if (row.parentRowId) ids.add(row.parentRowId);
    }
    return ids;
  });

  readonly reportQuotation = computed<QuotationReportData>(() => {
    const rowSno = this.rowSnoMap();
    return {
      quotationNumber: this.currentQuoteNumber(),
      date: this.quotationDate(),
      clientName: this.clientName,
      clientAddress: this.clientAddress,
      clientState: this.clientState,
      clientGstin: this.clientGstin,
      items: this.quotationRows().map((row, idx) => {
        const customValues: Record<string, string> = {};
        this.customColumns().forEach(col => { customValues[col] = (row as any)[col] || ""; });
        const heading = this.isSectionHeading(row);
        return {
          ...customValues,
          id: row.id || String(idx),
          sno: rowSno[row.id],
          description: row.description || "",
          hsnCode: (row as any).hsnCode || "",
          unit: heading ? "" : (row.unit || ""),
          qty: heading ? 0 : (row.qty || 0),
          rate: heading ? 0 : (row.rate || 0),
          amount: heading ? 0 : (row.amount || 0),
          isCustom: row.isCustom ?? false,
          isSectionHeading: heading,
          parentRowId: row.parentRowId || null,
          customValues,
        };
      }),
      customColumns: this.customColumns(),
      subtotal: this.subtotal(),
      cgstPercent: this.cgstPercent(),
      sgstPercent: this.sgstPercent(),
      cgstAmount: this.cgstAmount(),
      sgstAmount: this.sgstAmount(),
      roundOff: this.roundOff(),
      totalAmount: this.totalAmount(),
      amountInWords: this.amountInWords(),
    };
  });

  readonly previewQuotation = computed<QuotationReportData>(() => this.reportQuotation());

  showPreview() {
    this.showQuotationPreview.set(true);
  }

  constructor() {
    this.loadQuotationsFromBackend();
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
    this.selectedClientId.set(this.mongoClientId(client));
    this.showClientDropdown.set(false);
  }

  makeAsClient(quote: Quotation) {
    const existing = this.data.clients().find(
      c => c.name.toLowerCase() === quote.clientName.toLowerCase()
    );
    if (existing) {
      this.convertingClientId.set(quote.id);
      this.api.patchQuotation(quote.id, { clientId: existing._id || existing.id }).subscribe({
        next: () => {
          alert("Client already exists. Quotation linked to existing client.");
          this.loadQuotationsFromBackend();
          this.convertingClientId.set(null);
        },
        error: () => this.convertingClientId.set(null),
      });
      return;
    }
    this.makeClientData.set({
      clientName: quote.clientName,
      clientAddress: quote.clientAddress,
      clientState: quote.clientState,
      clientGstin: quote.clientGstin,
      sourceId: quote.id,
    });
    this.showMakeClientDialog.set(true);
  }

  makeInvoice(quote: Quotation) {
    void this.router.navigate(["/tax-invoices"], {
      state: { quotationForInvoice: quote },
    });
  }

  onMakeClientCreated(value: ClientFormValue) {
    const data = this.makeClientData();
    if (!data || this.creatingClient()) return;
    this.creatingClient.set(true);
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
        this.data.addClient({
          ...value,
          id: clientId,
          _id: mongoId,
          gstNumber: value.gstNumber || "",
        } as any);
        this.api.patchQuotation(data.sourceId, { clientId: mongoId || clientId }).subscribe({
          next: () => {
            this.showMakeClientDialog.set(false);
            this.makeClientData.set(null);
            this.loadQuotationsFromBackend();
            this.creatingClient.set(false);
          },
          error: () => this.creatingClient.set(false),
        });
      },
      error: (err: any) => {
        console.error("Failed to create client", err);
        this.creatingClient.set(false);
      },
    });
  }

  @HostListener("document:pointerdown", ["$event"])
  onDocumentClick(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (target && !target.closest(".client-search-wrapper")) {
      this.showClientDropdown.set(false);
    }
    if (target && !target.closest(".erp-select-menu")) {
      this.openUnitMenu.set("");
    }
  }

  private loadQuotationsFromBackend() {
    this.api.listQuotations({ limit: 25, page: 1 }).subscribe({
      next: (res) => {
        const items = (res.items || []).map((q: any) => ({
          id: q._id,
          quotationNumber: q.quotationNumber,
          date: q.date,
          clientId: q.clientId || null,
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
    this.clientSearchTerm.set("");
    this.selectedClientId.set(null);
    this.cgstPercent.set(9);
    this.sgstPercent.set(9);
    this.roundOff.set(0);
    this.editingQuotation.set(true);
  }

  editQuotation(quote: Quotation) {
    this.editingQuoteId.set(quote.id);
    const rows = (quote.items || []).map((item: any, idx) => {
      const merged: any = { ...item, ...((item && item.customValues) || {}) };
      // Preserve the hierarchy metadata explicitly so parent/child
      // relationships survive the save → reload round-trip.
      merged.id = merged.id != null ? String(merged.id) : `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`;
      merged.parentRowId =
        merged.parentRowId === null || merged.parentRowId === undefined || merged.parentRowId === ""
          ? null
          : String(merged.parentRowId);
      return merged;
    });
    // Defensive: remap any dangling parentRowId references to null so we
    // never end up with orphans after the load.
    const idSet = new Set<string>(rows.map((r: any) => r.id));
    rows.forEach((r: any) => {
      if (r.parentRowId && !idSet.has(r.parentRowId)) r.parentRowId = null;
    });
    this.quotationRows.set(rows as QuotationRow[]);
    this.customColumns.set(quote.customColumns || []);
    this.clientName = quote.clientName;
    this.clientAddress = quote.clientAddress;
    this.clientState = quote.clientState || "Tamil Nadu";
    this.clientGstin = quote.clientGstin;
    this.clientSearchTerm.set(quote.clientName);
    this.selectedClientId.set(this.findClientIdByName(quote.clientName));
    this.cgstPercent.set(quote.cgstPercent);
    this.sgstPercent.set(quote.sgstPercent);
    this.roundOff.set(quote.roundOff);
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
      qty: null as any,
      rate: null as any,
      amount: null as any,
      parentRowId: null,
    };
  }

  private findClientIdByName(name: string): string | null {
    const match = this.data.clients().find(c => c.name.toLowerCase() === name.toLowerCase());
    return match ? this.mongoClientId(match) : null;
  }

  private mongoClientId(client: Client): string | null {
    return this.validMongoObjectId(client._id);
  }

  private validMongoObjectId(value: unknown): string | null {
    const id = String(value || "");
    return /^[a-f\d]{24}$/i.test(id) ? id : null;
  }

  quotationHasClient(quotation: Quotation): boolean {
    if (quotation.clientId) return true;
    const name = String(quotation.clientName || "").trim().toLowerCase();
    return !!name && this.data.clients().some((client) => client.name.trim().toLowerCase() === name);
  }

  addRow() {
    this.quotationRows.update(rows => [...rows, this.createEmptyRow()]);
  }

  addSubRow(parentId: string) {
    const child = this.createEmptyRow();
    child.parentRowId = parentId;
    this.quotationRows.update(rows => {
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

  removeRow(rowId: string) {
    const childCount = this.quotationRows().filter(r => r.parentRowId === rowId).length;
    if (childCount > 0) {
      this.deleteConfirm.set({ parentId: rowId, childCount });
      return;
    }
    this.quotationRows.update(rows => rows.filter(r => r.id !== rowId));
  }

  confirmDeleteParentOnly() {
    const dc = this.deleteConfirm();
    if (!dc) return;
    const parentId = dc.parentId;
    this.quotationRows.update(rows =>
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
    this.quotationRows.update(rows => rows.filter(r => r.id !== parentId && r.parentRowId !== parentId));
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
  selectUnit(row: QuotationRow, unit: string) {
    row.unit = unit;
    this.openUnitMenu.set("");
    this.unitSearch.set("");
  }
  createAndSelectUnit(row: QuotationRow, unit: string) {
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
    if (!this.clientName.trim()) {
      alert("Please enter a client name.");
      return;
    }

    const validItems = this.quotationRows()
      .map((row) => {
        const customValues: Record<string, string> = {};
        this.customColumns().forEach(col => { customValues[col] = (row as any)[col] || ""; });
        return {
          id: row.id,
          description: (row.description || "").trim(),
          unit: row.unit || "",
          qty: Number(row.qty) || 0,
          rate: Number(row.rate) || 0,
          amount: Number(row.amount) || 0,
          isCustom: row.isCustom ?? false,
          parentRowId: row.parentRowId || null,
          customValues,
        };
      })
      .filter((row) => row.description.length > 0);

    if (validItems.length === 0) {
      alert("Please add at least one item with a description.");
      return;
    }

    this.savingQuote.set(true);

    const quotationData = {
      quotationNumber: this.currentQuoteNumber(),
      date: this.quotationDate(),
      companyName: this.companyProfile().name,
      companyAddress: this.companyProfile().address,
      state: this.companyProfile().state,
      gstin: this.companyProfile().gstin,
      clientId: this.validMongoObjectId(this.selectedClientId()),
      clientName: this.clientName.trim(),
      clientAddress: this.clientAddress,
      clientState: this.clientState,
      clientGstin: this.clientGstin,
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

  async exportToExcel() {
    this.savingExcel.set(true);
    try {
      const rows = this.quotationRows();
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
          unit: row.unit || "",
          qty: Number(row.qty) || 0,
          rate: Number(row.rate) || 0,
          amount: Number(row.amount) || 0,
          parentRowId: row.parentRowId || null,
          customValues,
        };
      });

      await buildBusinessDocumentXlsx({
        documentTitle: "QUOTATION",
        documentNumber: this.currentQuoteNumber(),
        documentDate: this.quotationDate(),
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
        fileName: `quotation-${this.currentQuoteNumber()}`,
      });
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Failed to export Excel. Please try again.");
    } finally {
      this.savingExcel.set(false);
    }
  }
}
