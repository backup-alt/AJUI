import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from "@angular/core";
import { ErpDataService } from "../data/erp-data.service";
import { formatMoney } from "./format";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface QuotationReportItem {
  id?: string;
  sno?: number;
  description: string;
  hsnCode?: string;
  unit?: string;
  qty?: number;
  rate?: number;
  amount?: number;
  isCustom?: boolean;
}

export interface QuotationReportData {
  quotationNumber: string;
  date: string;
  clientName: string;
  clientAddress: string;
  clientState: string;
  clientGstin: string;
  items: QuotationReportItem[];
  subtotal: number;
  cgstPercent: number;
  sgstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
}

@Component({
  selector: "agb-quotation-report",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="invoice-overlay" role="presentation" (click)="closeIfOverlay($event)">
      <div class="invoice-modal" role="dialog" aria-modal="true" aria-label="Quotation Report">
        <div class="invoice-toolbar">
          <span>Quotation Preview</span>
          <div class="toolbar-actions">
            <button type="button" class="btn-secondary" (click)="exportToPDF()">
              {{ saving() ? 'Generating...' : 'Download PDF' }}
            </button>
            <button type="button" class="btn-close" (click)="closed.emit()">Close</button>
          </div>
        </div>

        <div class="invoice-scroll-area">
          <div class="invoice-page" id="quotation-report-print-area">

            <div class="inv-header">
              <div class="inv-company-block">
                <div class="inv-company-name">{{ profile().name || 'Company Name' }}</div>
                <div class="inv-company-address">{{ profile().address || 'Address' }}</div>
                <div class="inv-company-state-gst">
                  {{ profile().state || 'State' }} | GSTIN: {{ profile().gstin || 'GSTIN' }}
                </div>
              </div>
              <div class="inv-title-block">
                <div class="inv-title">QUOTATION</div>
                <div class="inv-meta-table">
                  <div class="inv-meta-row">
                    <span class="inv-meta-label">Quote No.</span>
                    <span class="inv-meta-value">{{ quotationData?.quotationNumber || '—' }}</span>
                  </div>
                  <div class="inv-meta-row">
                    <span class="inv-meta-label">Date</span>
                    <span class="inv-meta-value">{{ quotationData?.date || '—' }}</span>
                  </div>
                  <div class="inv-meta-row">
                    <span class="inv-meta-label">Place of Supply</span>
                    <span class="inv-meta-value">{{ quotationData?.clientState || '—' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="inv-bill-to">
              <div class="inv-section-label">Bill To:</div>
              <div class="inv-party-details">
                <div class="inv-party-name">{{ quotationData?.clientName || '—' }}</div>
                <div class="inv-party-address">{{ quotationData?.clientAddress || '—' }}</div>
                <div class="inv-party-gst">State: {{ quotationData?.clientState || '—' }} | GSTIN: {{ quotationData?.clientGstin || '—' }}</div>
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
                </tr>
              </thead>
              <tbody>
                @for (item of items; track item.id || $index) {
                  @if (item.description && !item.description.startsWith('---')) {
                    <tr>
                      <td class="col-sno cell-center">{{ item.sno || $index + 1 }}</td>
                      <td class="col-desc">{{ item.description }}</td>
                      <td class="col-hsn cell-center">{{ item.hsnCode || '—' }}</td>
                      <td class="col-unit cell-center">{{ item.unit || '—' }}</td>
                      <td class="col-qty cell-right">{{ item.qty || 0 }}</td>
                      <td class="col-rate cell-right">{{ formatRupee(item.rate) }}</td>
                      <td class="col-amount cell-right">{{ formatRupee(item.amount) }}</td>
                    </tr>
                  } @else {
                    <tr class="section-divider">
                      <td colspan="7" class="section-header">{{ stripSectionPrefix(item.description || '') }}</td>
                    </tr>
                  }
                }
                @if (items.length === 0) {
                  <tr>
                    <td colspan="7" class="empty-row">No items found.</td>
                  </tr>
                }
              </tbody>
            </table>

            <div class="inv-summary-section">
              <div class="inv-summary-left">
                <div class="inv-amount-words">
                  <span class="summary-label">Amount Chargeable (in words):</span>
                  <strong>{{ quotationData?.amountInWords || '—' }}</strong>
                </div>
              </div>
              <div class="inv-summary-right">
                <div class="inv-summary-table">
                  <div class="inv-summary-row">
                    <span class="summary-label">Sub Total</span>
                    <span class="summary-value">{{ formatRupee(quotationData?.subtotal || 0) }}</span>
                  </div>
                  @if (quotationData?.cgstPercent) {
                    <div class="inv-summary-row">
                      <span class="summary-label">Add: CGST @ {{ quotationData?.cgstPercent }}%</span>
                      <span class="summary-value">{{ formatRupee(quotationData?.cgstAmount || 0) }}</span>
                    </div>
                  }
                  @if (quotationData?.sgstPercent) {
                    <div class="inv-summary-row">
                      <span class="summary-label">Add: SGST @ {{ quotationData?.sgstPercent }}%</span>
                      <span class="summary-value">{{ formatRupee(quotationData?.sgstAmount || 0) }}</span>
                    </div>
                  }
                  @if (quotationData?.roundOff !== 0 && quotationData?.roundOff !== undefined) {
                    <div class="inv-summary-row">
                      <span class="summary-label">Round Off</span>
                      <span class="summary-value">{{ formatRupee(quotationData?.roundOff || 0) }}</span>
                    </div>
                  }
                  <div class="inv-summary-row inv-total-row">
                    <span class="summary-label">Total Amount (₹)</span>
                    <span class="summary-value">{{ formatRupee(quotationData?.totalAmount || 0) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="inv-footer-section">
              <div class="inv-signatory">
                <div class="inv-footer-label">For {{ profile().name || 'Company Name' }}:</div>
                <div class="inv-signature-area">
                  <div class="inv-signature-line">Authorized Signatory</div>
                </div>
              </div>
            </div>

            <div class="inv-footer-note">
              This is a computer-generated Quotation. No signature required. &nbsp;|&nbsp; Page <span class="page-num">{{ currentPage() }}</span> of <span class="page-total">{{ totalPages() }}</span>
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
    .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    .inv-table th {
      background: #1a2540; color: #fff; padding: 8px 10px;
      text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border: 1px solid #1a2540;
    }
    .inv-table td { padding: 8px 10px; border: 1px solid #cbd5e1; vertical-align: top; }
    .inv-table .section-divider td { background: #f1f5f9; }
    .inv-table .section-header { font-weight: 700; font-size: 12px; color: #1a2540; padding: 6px 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .inv-table .empty-row { text-align: center; color: #94a3b8; font-style: italic; }
    .col-sno { width: 5%; text-align: center; }
    .col-desc { width: 40%; }
    .col-hsn { width: 10%; text-align: center; }
    .col-unit { width: 8%; text-align: center; }
    .col-qty { width: 7%; text-align: right; }
    .col-rate { width: 15%; text-align: right; }
    .col-amount { width: 15%; text-align: right; }
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
      display: flex; justify-content: flex-end; align-items: flex-start;
      border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 16px; gap: 40px;
    }
    .inv-footer-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .inv-signatory { text-align: right; min-width: 200px; }
    .inv-signature-area { border-top: 1px solid #cbd5e1; padding-top: 4px; }
    .inv-signature-line { font-size: 11px; color: #94a3b8; text-align: right; margin-top: 40px; }
    .inv-footer-note { text-align: center; font-size: 10px; color: #94a3b8; font-style: italic; }
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
export class QuotationReportComponent {
  @Input() quotationData: QuotationReportData | null = null;
  @Output() closed = new EventEmitter<void>();

  private readonly data = inject(ErpDataService);
  readonly saving = signal(false);
  readonly profile = this.data.companyProfile;
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);

  get items() {
    return this.quotationData?.items || [];
  }

  formatRupee(amount: number | undefined): string {
    return formatMoney(amount ?? 0);
  }

  stripSectionPrefix(desc: string): string {
    return desc.replace(/^---\s*/, "");
  }

  closeIfOverlay(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains("invoice-overlay")) {
      this.closed.emit();
    }
  }

  async exportToPDF() {
    const el = document.getElementById("quotation-report-print-area");
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
      const qnum = this.quotationData?.quotationNumber || 'draft';
      pdf.save(`quotation-${qnum}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      this.saving.set(false);
    }
  }
}