import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ErpDataService } from "../data/erp-data.service";
import type { Quotation, TaxInvoice } from "../../data/dashboardData";
import { formatMoney } from "./format";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

@Component({
  selector: "agb-tax-invoice-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="invoice-overlay" role="presentation" (click)="closeIfOverlay($event)">
      <div class="invoice-modal" role="dialog" aria-modal="true" aria-label="Tax Invoice">
        <div class="invoice-toolbar">
          <span>Tax Invoice Preview</span>
          <div class="toolbar-actions">
            <button type="button" class="btn-secondary" (click)="exportToPDF()">
              {{ saving() ? 'Generating...' : 'Download PDF' }}
            </button>
            <button type="button" class="btn-close" (click)="closed.emit()">Close</button>
          </div>
        </div>

        <div class="invoice-scroll-area">
          <div class="invoice-page" id="tax-invoice-print-area">

            <div class="inv-header">
              <div class="inv-company-block">
                <div class="inv-company-name">{{ profile().name || 'Company Name' }}</div>
                <div class="inv-company-address">{{ profile().address || 'Address' }}</div>
                <div class="inv-company-state-gst">
                  {{ profile().state || 'State' }} | GSTIN: {{ profile().gstin || 'GSTIN' }}
                </div>
                @if (profile().bankName) {
                  <div class="inv-company-bank">
                    Bank: {{ profile().bankName }} | A/C: {{ profile().accountNumber }} | IFSC: {{ profile().ifsc }} | Branch: {{ profile().branch }}
                  </div>
                }
              </div>
              <div class="inv-title-block">
                <div class="inv-title">TAX INVOICE</div>
                <div class="inv-meta-table">
                  <div class="inv-meta-row">
                    <span class="inv-meta-label">Invoice No.</span>
                    <span class="inv-meta-value">{{ getInvoiceNumber() }}</span>
                  </div>
                  <div class="inv-meta-row">
                    <span class="inv-meta-label">Invoice Date</span>
                    <span class="inv-meta-value">{{ invoice?.date || '—' }}</span>
                  </div>
                  <div class="inv-meta-row">
                    <span class="inv-meta-label">Place of Supply</span>
                    <span class="inv-meta-value">{{ invoice?.state || '—' }}</span>
                  </div>
                  <div class="inv-meta-row">
                    <span class="inv-meta-label">Supply Type</span>
                    <span class="inv-meta-value" [class.intrastate]="supplyType() === 'Intrastate'" [class.interstate]="supplyType() === 'Interstate'">{{ supplyType() }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="inv-bill-to">
              <div class="inv-section-label">Bill To:</div>
              <div class="inv-party-details">
                <div class="inv-party-name">{{ invoice?.clientName || '—' }}</div>
                <div class="inv-party-address">{{ invoice?.clientAddress || '—' }}</div>
                <div class="inv-party-gst">State: {{ invoice?.clientState || '—' }} | GSTIN: {{ invoice?.clientGstin || '—' }}</div>
              </div>
            </div>

            <table class="inv-table">
              <thead>
                <tr>
                  <th class="col-sno">S.No</th>
                  <th class="col-desc">Description of Goods / Services</th>
                  <th class="col-hsn">HSN Code</th>
                  <th class="col-unit">Unit</th>
                  <th class="col-qty">Qty</th>
                  <th class="col-rate">Rate (₹)</th>
                  <th class="col-amount">Amount (₹)</th>
                  @for (col of customColumns; track col) {
                    <th class="col-custom">{{ col }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (item of items; track item.id || $index) {
                  @if (item.isSectionHeading) {
                    <tr class="section-row">
                      <td class="col-sno"></td>
                      <td [attr.colspan]="6 + customColumns.length" class="section-header">{{ item.description }}</td>
                    </tr>
                  } @else if (item.description) {
                    <tr [class.sub-row]="!!item.parentRowId">
                      <td class="col-sno cell-center">{{ item.isSectionHeading ? '' : (item.sno || ($index + 1)) }}</td>
                      <td class="col-desc">{{ item.description }}</td>
                      <td class="col-hsn cell-center">{{ item.hsnCode || '—' }}</td>
                      <td class="col-unit cell-center">{{ item.unit || '—' }}</td>
                      <td class="col-qty cell-right">{{ item.qty || 0 }}</td>
                      <td class="col-rate cell-right">{{ formatRupee(item.rate) }}</td>
                      <td class="col-amount cell-right">{{ formatRupee(item.amount) }}</td>
                      @for (col of customColumns; track col) {
                        <td class="col-custom">{{ item[col] || '—' }}</td>
                      }
                    </tr>
                  }
                }
                @if (items.length === 0) {
                  <tr>
                    <td [attr.colspan]="7 + customColumns.length" class="empty-row">No items found.</td>
                  </tr>
                }
              </tbody>
            </table>

            <div class="inv-summary-section">
              <div class="inv-summary-left">
                <div class="inv-amount-words">
                  <span class="summary-label">Amount Chargeable (in words):</span>
                  <strong>{{ invoice?.amountInWords || '—' }}</strong>
                </div>
              </div>
              <div class="inv-summary-right">
                <div class="inv-summary-table">
                  <div class="inv-summary-row">
                    <span class="summary-label">Sub Total</span>
                    <span class="summary-value">{{ formatRupee(invoice?.subtotal || 0) }}</span>
                  </div>
                  @if (invoice?.cgstPercent) {
                    <div class="inv-summary-row">
                      <span class="summary-label">Add: CGST @ {{ invoice?.cgstPercent }}%</span>
                      <span class="summary-value">{{ formatRupee(invoice?.cgstAmount || 0) }}</span>
                    </div>
                  }
                  @if (invoice?.sgstPercent) {
                    <div class="inv-summary-row">
                      <span class="summary-label">Add: SGST @ {{ invoice?.sgstPercent }}%</span>
                      <span class="summary-value">{{ formatRupee(invoice?.sgstAmount || 0) }}</span>
                    </div>
                  }
                  @if (invoice?.roundOff !== 0 && invoice?.roundOff !== undefined) {
                    <div class="inv-summary-row">
                      <span class="summary-label">Round Off</span>
                      <span class="summary-value">{{ formatRupee(invoice?.roundOff || 0) }}</span>
                    </div>
                  }
                  <div class="inv-summary-row inv-total-row">
                    <span class="summary-label">Total Amount Payable (₹)</span>
                    <span class="summary-value">{{ formatRupee(invoice?.totalAmount || 0) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="inv-footer-section">
              <div class="inv-bank-details">
                <div class="inv-footer-label">Bank Details:</div>
                @if (profile().bankName) {
                  <div class="inv-bank-row"><span>Bank Name:</span> {{ profile().bankName }}</div>
                  <div class="inv-bank-row"><span>Account Number:</span> {{ profile().accountNumber }}</div>
                  <div class="inv-bank-row"><span>IFSC Code:</span> {{ profile().ifsc }}</div>
                  <div class="inv-bank-row"><span>Branch:</span> {{ profile().branch }}</div>
                } @else {
                  <div class="inv-bank-row"><em>Bank details not configured. Add them in Settings → Company Profile.</em></div>
                }
              </div>
              <div class="inv-signatory">
                <div class="inv-footer-label">For {{ profile().name || 'Company Name' }}:</div>
                <div class="inv-signature-area">
                  <div class="inv-signature-line">Authorized Signatory</div>
                </div>
              </div>
            </div>

            <div class="inv-footer-note">
              This is a computer-generated Tax Invoice. No signature required. &nbsp;|&nbsp; Page <span class="page-num">{{ currentPage() }}</span> of <span class="page-total">{{ totalPages() }}</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .invoice-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 9999; display: flex; align-items: flex-start; justify-content: center;
      padding: 20px; overflow-y: auto;
    }
    .invoice-modal {
      background: #f8fafc; border-radius: 12px; width: 100%; max-width: 900px;
      display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .invoice-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; background: #1a2540; color: #fff;
      border-radius: 12px 12px 0 0;
    }
    .invoice-toolbar span { font-size: 15px; font-weight: 600; }
    .toolbar-actions { display: flex; gap: 10px; }
    .btn-secondary {
      padding: 8px 16px; background: #2c5cff; color: #fff;
      border: none; border-radius: 6px; cursor: pointer; font-size: 13px;
    }
    .btn-secondary:hover { background: #1e4ae8; }
    .btn-secondary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-close {
      padding: 8px 16px; background: rgba(255,255,255,0.15); color: #fff;
      border: 1px solid rgba(255,255,255,0.25); border-radius: 6px;
      cursor: pointer; font-size: 13px;
    }
    .invoice-scroll-area { padding: 24px; background: #e2e8f0; overflow-y: auto; max-height: calc(100vh - 120px); }
    .invoice-page {
      background: #fff; padding: 40px 48px; font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px; color: #1e293b; border-radius: 4px;
      border: 1px solid #cbd5e1; width: 794px; box-sizing: border-box; margin: 0 auto;
    }
    .inv-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 2px solid #1a2540; padding-bottom: 16px; margin-bottom: 20px;
    }
    .inv-company-block { max-width: 55%; }
    .inv-company-name { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .inv-company-address { font-size: 12px; color: #475569; margin-bottom: 2px; }
    .inv-company-state-gst { font-size: 12px; color: #475569; font-weight: 600; }
    .inv-company-bank { font-size: 11px; color: #64748b; margin-top: 4px; }
    .inv-title-block { text-align: right; }
    .inv-title {
      font-size: 22px; font-weight: 800; color: #1a2540; letter-spacing: 4px;
      text-align: center; border: 2px solid #1a2540; padding: 6px 20px; margin-bottom: 10px;
    }
    .inv-meta-table { display: flex; flex-direction: column; gap: 4px; }
    .inv-meta-row { display: flex; justify-content: flex-end; gap: 12px; }
    .inv-meta-label { font-size: 11px; color: #64748b; min-width: 80px; text-align: right; }
    .inv-meta-value { font-size: 12px; font-weight: 600; color: #1e293b; min-width: 120px; }
    .inv-bill-to { margin-bottom: 20px; }
    .inv-section-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .inv-party-details { border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 4px; }
    .inv-party-name { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .inv-party-address { font-size: 12px; color: #475569; margin-bottom: 2px; }
    .inv-party-gst { font-size: 11px; color: #64748b; font-weight: 600; }
    .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; table-layout: fixed; }
    .inv-table th {
      background: #1a2540; color: #fff; padding: 7px 8px;
      text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border: 1px solid #1a2540;
    }
    .inv-table td { padding: 4px 6px; border: 1px solid #cbd5e1; vertical-align: top; box-sizing: border-box; }
    .inv-table .section-row td { background: #f1f5f9; }
    .inv-table .section-header { font-weight: 700; font-size: 13px; color: #0f172a; padding: 6px 8px; text-transform: none; letter-spacing: 0; }
    .inv-table .empty-row { text-align: center; color: #94a3b8; font-style: italic; }
    .inv-table tr.sub-row td { background: #f8fafc; }
    .inv-table tr.sub-row .col-desc { padding-left: 30px; font-style: italic; }
    .col-sno { width: 50px; text-align: center; }
    .col-desc { min-width: 200px; }
    .col-hsn { width: 90px; text-align: center; }
    .col-unit { width: 80px; text-align: center; }
    .col-qty { width: 80px; text-align: right; }
    .col-rate { width: 110px; text-align: right; }
    .col-amount { width: 120px; text-align: right; }
    .col-custom { min-width: 100px; text-align: left; }
    .cell-center { text-align: center; }
    .cell-right { text-align: right; }
    .inv-summary-section {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; gap: 40px;
    }
    .inv-summary-left { flex: 1; }
    .inv-amount-words { font-size: 12px; color: #475569; line-height: 1.6; }
    .inv-amount-words strong { font-size: 13px; color: #0f172a; }
    .inv-summary-right { min-width: 280px; }
    .inv-summary-table { border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; }
    .inv-summary-row {
      display: flex; justify-content: space-between; padding: 7px 12px;
      border-bottom: 1px solid #e2e8f0; font-size: 12px;
    }
    .inv-summary-row:last-child { border-bottom: none; }
    .summary-label { color: #475569; }
    .summary-value { font-weight: 600; color: #1e293b; }
    .inv-total-row { background: #f1f5f9; }
    .inv-total-row .summary-label { font-weight: 700; color: #0f172a; font-size: 13px; }
    .inv-total-row .summary-value { font-weight: 800; font-size: 14px; color: #0f172a; }
    .inv-footer-section {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 16px; gap: 40px;
    }
    .inv-footer-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .inv-bank-details { flex: 1; }
    .inv-bank-row { font-size: 12px; color: #1e293b; margin-bottom: 3px; }
    .inv-bank-row span { font-weight: 600; color: #475569; }
    .inv-signatory { text-align: right; min-width: 200px; }
    .inv-signature-area { border-top: 1px solid #cbd5e1; padding-top: 4px; }
    .inv-signature-line { font-size: 11px; color: #94a3b8; text-align: right; margin-top: 40px; }
    .inv-footer-note { text-align: center; font-size: 10px; color: #94a3b8; font-style: italic; }
    .intrastate { color: #16a34a !important; font-weight: 700; }
    .interstate { color: #d97706 !important; font-weight: 700; }
    .page-num, .page-total { font-style: normal; }
    @media print {
      .invoice-overlay { background: #fff; padding: 0; }
      .invoice-modal { box-shadow: none; border-radius: 0; }
      .invoice-toolbar { display: none; }
      .invoice-scroll-area { padding: 0; background: #fff; max-height: none; overflow: visible; }
      .invoice-page { border: none; padding: 30px 40px; width: 100%; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxInvoiceDialogComponent {
  @Input() invoice: (Quotation | TaxInvoice) | null = null;
  @Output() closed = new EventEmitter<void>();

  private readonly data = inject(ErpDataService);
  readonly saving = signal(false);
  readonly profile = this.data.companyProfile;
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);

  readonly supplyType = computed(() => {
    const inv = this.invoice as (Quotation | TaxInvoice) | null;
    if (!inv) return "—";
    if ("supplyType" in inv && inv.supplyType) return inv.supplyType;
    const co = this.profile();
    if (!co?.state || !inv.state) return "—";
    return co.state.trim().toLowerCase() === inv.state.trim().toLowerCase() ? "Intrastate" : "Interstate";
  });

  get items() {
    return (this.invoice as any)?.items || [];
  }

  get customColumns() {
    return (this.invoice as any)?.customColumns || [];
  }

  getInvoiceNumber(): string {
    const inv = this.invoice as any;
    return inv?.invoiceNumber || inv?.quotationNumber || '—';
  }

  formatRupee(amount: number): string {
    return formatMoney(amount);
  }

  stripSectionPrefix(desc: string): string {
    return desc.replace(/^---\s*/, "");
  }

  /**
   * Returns the parent-only serial number for the item at the given index.
   * Child rows (parentRowId set) are excluded from the counter so the S.No
   * column only increments once per parent group.
   */
  parentSno(index: number): number {
    let counter = 0;
    const list = this.items as any[];
    for (let i = 0; i <= index; i++) {
      const it = list[i];
      if (!it || !it.parentRowId) counter += 1;
    }
    return counter;
  }

  closeIfOverlay(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains("invoice-overlay")) {
      this.closed.emit();
    }
  }

  async exportToPDF() {
    const el = document.getElementById("tax-invoice-print-area");
    if (!el) return;
    this.saving.set(true);
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
      let pageCount = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      pageCount = 1;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        pageCount++;
      }
      this.totalPages.set(pageCount);
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 6, { align: "center" });
      }
      const inv = this.invoice as any;
      pdf.save(`tax-invoice-${inv?.invoiceNumber || inv?.quotationNumber || 'draft'}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      this.saving.set(false);
    }
  }
}
