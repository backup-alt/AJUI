import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { IonIcon } from "@ionic/angular/standalone";
import { firstValueFrom } from "rxjs";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { ApiService, PurchaseOrder } from "../core/api.service";
import { mapMaterial } from "../core/mappers";
import { ErpDataService } from "../data/erp-data.service";
import { formatMoney } from "./format";
import { SearchableSelectComponent } from "./searchable-select.component";

type ExistingMaterial = {
  _id: string;
  name: string;
  unit: string;
  approvedQuantity: number;
  requestedQuantity?: number;
  givenAmount?: number;
  issuedAmount?: number;
  isExistingMaterial?: boolean;
  poNumber?: string;
  createdAt?: string | Date;
};

type PoDraftLine = {
  key: string;
  source: "existing" | "manual";
  materialId: string;
  description: string;
  unit: string;
  quantity: number;
  amount: number;
  paymentMode: string;
  gstPercent: number;
};

@Component({
  selector: "agb-purchase-orders-panel",
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, SearchableSelectComponent],
  template: `
    @if (view === "list") {
      <section class="po-panel">
        @if (!loading() && orders().length > 0) {
          <div class="page-search-bar">
            <input
              type="search"
              class="seamless-search"
              placeholder="Search purchase orders by PO number, vendor, or project..."
              [value]="search()"
              (input)="search.set($any($event.target).value)"
            />
            <svg viewBox="0 0 24 24" class="search-icon" aria-hidden="true">
              <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
              <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        }
        @if (loading()) {
          <p class="po-state">Loading purchase orders…</p>
        } @else if (orders().length === 0) {
          <p class="po-state">{{ projectId ? 'No purchase orders have been created for this project.' : 'No purchase orders have been created yet.' }}</p>
        } @else {
          <div class="po-list-wrap">
            <table class="po-list">
              <thead><tr><th>PO Number</th><th>Date</th>@if (!projectId) {<th>Project</th>}<th>Vendor</th><th>Items</th><th>Subtotal</th><th>GST</th><th>Grand Total</th></tr></thead>
              <tbody>
                @for (order of filteredOrders(); track order._id) {
                  <tr [class.row-selected]="poActionRow()?._id === order._id" (click)="openPoActionMenu(order, $event)">
                    <td><button type="button">{{ order.poNumber }}</button></td>
                    <td>{{ order.date }}</td>@if (!projectId) {<td>{{ order.projectName }}</td>}<td>{{ order.vendorName }}</td><td>{{ order.items.length }}</td>
                    <td>{{ formatMoney(order.subtotal) }}</td><td>{{ formatMoney(order.totalGst) }}</td><td>{{ formatMoney(order.grandTotal) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (canRequestOrEdit() && poActionRow()) { <div class="cursor-action-menu" [style.left.px]="poActionPosition().x" [style.top.px]="poActionPosition().y" (click)="$event.stopPropagation()"><button type="button" (click)="openSelectedPo()">Open</button>@if (isAdmin()) { <button type="button" (click)="editSelectedPo()">Edit</button><button type="button" class="danger" (click)="deleteSelectedPo()">Delete</button> } @else { <button type="button" (click)="requestPoEdit()">Request edit</button> }</div> }
          @if (totalPages() > 1) {
            <nav class="po-pagination" aria-label="Purchase order pagination">
              <span>{{ pageSummary() }}</span>
              <div class="po-pagination-actions">
                <button
                  type="button"
                  [disabled]="currentPage() === 1 || loading()"
                  (click)="changePage(currentPage() - 1)"
                >Previous</button>
                <span>Page {{ currentPage() }} of {{ totalPages() }}</span>
                <button
                  type="button"
                  [disabled]="currentPage() === totalPages() || loading()"
                  (click)="changePage(currentPage() + 1)"
                >Next</button>
              </div>
            </nav>
          }
        }
      </section>
    }

    @if (view === "create" || view === "edit") {
      <section class="po-editor">
        <div class="editor-header">
          <button type="button" class="back-link" (click)="closeCreate.emit()">
            <ion-icon name="arrow-back-outline"></ion-icon>
            Back to Purchase Orders
          </button>
          <div class="editor-actions">
            <button type="button" class="btn-primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : (editingId() ? 'Save Changes' : 'Save Purchase Order') }}</button>
          </div>
        </div>

        <div class="quotation-document po-doc">
          <div class="doc-header">
            <div class="company-info">
              <h1 class="company-name">{{ companyName }}</h1>
              <p class="company-address">{{ companyAddress }}</p>
              <p class="company-state-gst">{{ companyState }} | GSTIN: {{ companyGstin }}</p>
            </div>
            <div class="quotation-title-block">
              <h2 class="quotation-title">PURCHASE ORDER</h2>
              <div class="quotation-meta">
                <div class="meta-row"><span class="meta-label">PO Number:</span><span class="meta-value">{{ displayPoNumber() }}</span></div>
                <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">{{ date() }}</span></div>
              </div>
            </div>
          </div>

          <div class="client-section">
            <h3 class="section-label">Purchase Order Details</h3>
            @if (referenceLoading()) { <p role="status">Loading projects and vendors…</p> }
            <div class="client-form-grid po-fields">
              <div class="form-field">
                <label>Project *</label>
                <div class="erp-select-menu" [class.open]="openMenu() === 'project'">
                  <button type="button" class="erp-select-trigger po-select-trigger" [class.trigger-disabled]="view === 'edit'" (click)="toggleMenu('project')">
                    <span class="po-trigger-value" [class.placeholder]="!selectedProjectName()">{{ selectedProjectName() || 'Select project' }}</span>
                    <svg class="svg-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" /></svg>
                  </button>
                  @if (openMenu() === 'project') {
                    <div class="erp-select-panel po-select-panel">
                      <input type="text" class="po-select-search" placeholder="Search project…" autocomplete="off" [value]="menuSearch()" (input)="menuSearch.set($any($event.target).value)" />
                      @for (project of filteredProjects(); track project._id) {
                        <button type="button" [class.selected]="draftProjectId() === project._id" (mousedown)="$event.preventDefault()" (click)="selectProjectFromMenu(project._id)">{{ project.name }}</button>
                      }
                      @if (filteredProjects().length === 0) { <div class="po-select-empty">No matching projects</div> }
                    </div>
                  }
                </div>
              </div>
              <div class="form-field">
                <label>Vendor *</label>
                <div class="erp-select-menu" [class.open]="openMenu() === 'vendor'">
                  <button type="button" class="erp-select-trigger po-select-trigger" [class.trigger-disabled]="!draftProjectId()" (click)="toggleMenu('vendor')">
                    <span class="po-trigger-value" [class.placeholder]="!selectedVendorName()">{{ selectedVendorName() || 'Select vendor' }}</span>
                    <svg class="svg-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" /></svg>
                  </button>
                  @if (openMenu() === 'vendor') {
                    <div class="erp-select-panel po-select-panel">
                      <input type="text" class="po-select-search" placeholder="Search vendor…" autocomplete="off" [value]="menuSearch()" (input)="menuSearch.set($any($event.target).value)" />
                      @for (vendor of filteredVendors(); track vendor._id) {
                        <button type="button" [class.selected]="vendorId() === vendor._id" (mousedown)="$event.preventDefault()" (click)="selectVendorFromMenu(vendor._id)">{{ vendor.name }}</button>
                      }
                      @if (filteredVendors().length === 0) { <div class="po-select-empty">No matching vendors</div> }
                    </div>
                  }
                </div>
              </div>
              <div class="form-field">
                <label>PO Date *</label>
                <input type="date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
              </div>
              <div class="form-field po-notes-field">
                <label>Notes</label>
                <textarea rows="3" maxlength="2000" [ngModel]="notes()" (ngModelChange)="notes.set($event)" placeholder="Add notes for this purchase order"></textarea>
              </div>
            </div>
          </div>

          <div class="items-section">
            <div class="section-label">Review Items and Quantities</div>
            <div class="po-table-wrap">
              <table class="items-table po-items">
                <colgroup>
                  <col class="col-col-sno" />
                  <col class="col-col-desc" />
                  <col class="col-col-unit" />
                  <col class="col-col-qty" />
                  <col class="col-col-amount" />
                  <col class="col-col-payment" />
                  <col class="col-col-gst" />
                  <col class="col-col-gstamt" />
                  <col class="col-col-total" />
                  <col class="col-col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="col-sno">S.No</th>
                    <th class="col-desc">Material Name</th>
                    <th class="col-unit">Unit</th>
                      <th class="col-qty">Qty</th>
                      <th class="col-amount">Rate (₹)</th>
                      <th class="col-payment">Payment Mode</th>
                      <th class="col-gst">GST %</th>
                      <th class="col-gstamt">GST Amt (₹)</th>
                      <th class="col-total">Total (₹)</th>
                      <th class="col-action"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of lines(); track line.key; let index = $index) {
                    <tr>
                      <td class="col-sno cell-center">{{ index + 1 }}</td>
                      <td class="col-desc">
                        @if (line.source === 'existing') {
                          <div class="erp-select-menu" [class.open]="openMenu() === materialKey(index)">
                            <button type="button" class="erp-select-trigger po-material-trigger" [class.trigger-disabled]="!draftProjectId() || !vendorId()" (click)="toggleMenu(materialKey(index))">
                              <span class="po-trigger-value" [class.placeholder]="!materialName(line)">{{ materialName(line) || 'Select material from inventory' }}</span>
                              <svg class="svg-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" /></svg>
                            </button>
                            @if (openMenu() === materialKey(index)) {
                              <div class="erp-select-panel po-select-panel po-material-panel">
                                <input type="text" class="po-select-search" placeholder="Search material…" autocomplete="off" [value]="menuSearch()" (input)="menuSearch.set($any($event.target).value)" />
                                <div class="po-material-options">
                                  @for (material of filteredMaterials(); track material._id) {
                                    <button type="button" [class.selected]="line.materialId === material._id" (mousedown)="$event.preventDefault()" (click)="selectMaterial(index, material._id)">
                                      <span class="po-option-main" [title]="material.name">{{ material.name }}</span>
                                      <span class="po-option-meta">{{ material.unit }}</span>
                                    </button>
                                  }
                                  @if (filteredMaterials().length === 0) { <div class="po-select-empty">No matching materials</div> }
                                </div>
                              </div>
                            }
                          </div>
                          <button type="button" class="manual-material-toggle" [disabled]="!draftProjectId() || !vendorId()" (click)="setManualLine(index)">+ Add custom material</button>
                        } @else {
                          <div class="manual-material">
                            <input [ngModel]="line.description" (ngModelChange)="updateLine(index, 'description', $event)" placeholder="Enter material name" />
                            <button type="button" (click)="setExistingLine(index)">Use inventory</button>
                          </div>
                        }
                      </td>
                      <td class="col-unit"><agb-searchable-select [options]="unitOptions" [allowCustom]="true" [disabled]="line.source === 'existing' && !!line.materialId" placeholder="Unit" [ngModel]="line.unit" (ngModelChange)="updateLine(index, 'unit', $event)" /></td>
                      <td class="col-qty"><input type="number" min="0" [ngModel]="line.quantity" (ngModelChange)="updateLine(index, 'quantity', +$event || 0)" /></td>
                      <td class="col-amount"><input type="number" min="0" step="0.01" [ngModel]="line.amount" (ngModelChange)="updateLine(index, 'amount', +$event || 0)" /></td>
                      <td class="col-payment"><agb-searchable-select [ngModel]="line.paymentMode" (ngModelChange)="updateLine(index, 'paymentMode', $any($event))" [options]="paymentModes" [allowCustom]="true" /></td>
                      <td class="col-gst">
                        <agb-searchable-select
                          [ngModel]="line.gstPercent"
                          (ngModelChange)="updateLine(index, 'gstPercent', +$event || 0)"
                          [options]="gstRateOptions()"
                        />
                        <button type="button" class="custom-gst-action" (click)="customGstLine.set(index)">+ Custom</button>
                        @if (customGstLine() === index) {
                          <div class="custom-gst"><input type="number" min="0" max="100" #gst /><button type="button" (click)="saveCustomGst(index, gst.value)">Add</button></div>
                        }
                      </td>
                      <td class="col-gstamt amount-cell">{{ formatMoney(lineGst(line)) }}</td>
                      <td class="col-total amount-cell">{{ formatMoney(lineTotal(line)) }}</td>
                      <td class="col-action"><button type="button" class="remove-line" [disabled]="lines().length === 1" (click)="removeLine(index)">×</button></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="items-actions">
              <button type="button" class="add-line" [disabled]="!draftProjectId() || !vendorId()" (click)="addLine()">+ Add Row</button>
            </div>
          </div>

          <div class="po-totals">
            <div class="total-row"><span>Subtotal</span><span class="total-value">{{ formatMoney(subtotal()) }}</span></div>
            <div class="total-row"><span>Total GST</span><span class="total-value">{{ formatMoney(totalGst()) }}</span></div>
            <div class="total-row"><span>Round Off</span><span class="total-value"><input type="number" step="0.01" [ngModel]="roundOff()" (ngModelChange)="roundOff.set(+$event || 0)" /></span></div>
            <div class="total-row grand"><span>Grand Total</span><span class="total-value">{{ formatMoney(grandTotal()) }}</span></div>
          </div>
          @if (error()) { <p class="po-error">{{ error() }}</p> }
        </div>
      </section>
    }

    @if (view === "detail") {
      <section class="po-editor">
        <div class="editor-header">
          <button type="button" class="back-link" (click)="closeDetailView()">
            <ion-icon name="arrow-back-outline"></ion-icon>
            Back to Purchase Orders
          </button>
          @if (selectedOrder()) {
            <div class="editor-actions">
              <button type="button" class="btn-secondary" [disabled]="exporting()" (click)="downloadPdf()">
                {{ exporting() === 'pdf' ? 'Preparing PDF…' : 'Download PDF' }}
              </button>
              <button type="button" class="btn-secondary" [disabled]="exporting()" (click)="downloadExcel()">
                {{ exporting() === 'excel' ? 'Preparing Excel…' : 'Download Excel' }}
              </button>
              @if (isAdmin()) { <button type="button" class="btn-secondary" (click)="editRequest.emit(selectedOrder()!.poNumber)">Edit Purchase Order</button> }
              @if (!isAdmin() && canRequestOrEdit()) { <button type="button" class="btn-secondary" (click)="requestPoEdit(selectedOrder()!)">Request edit</button> }
              @if (isAdmin()) {
                <button type="button" class="btn-danger" [disabled]="saving()" (click)="deleteOrder()">
                  {{ saving() ? 'Deleting…' : 'Delete Purchase Order' }}
                </button>
              }
            </div>
          }
        </div>
        @if (error()) { <p class="po-error">{{ error() }}</p> }
        @if (selectedOrder(); as order) {
          <div class="quotation-document po-doc po-detail-document">
            <div class="doc-header">
              <div class="company-info">
                <h1 class="company-name">{{ companyName }}</h1>
                <p class="company-address">{{ companyAddress }}</p>
                <p class="company-state-gst">{{ companyState }} | GSTIN: {{ companyGstin }}</p>
              </div>
              <div class="quotation-title-block">
                <h2 class="quotation-title">PURCHASE ORDER</h2>
                <div class="quotation-meta">
                  <div class="meta-row"><span class="meta-label">PO Number:</span><span class="meta-value">{{ order.poNumber }}</span></div>
                  <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">{{ order.date }}</span></div>
                </div>
              </div>
            </div>

            <div class="client-section">
              <h3 class="section-label">Purchase Order Details</h3>
              <div class="client-form-grid po-fields">
                <div class="form-field"><label>Project</label><div class="po-readonly">{{ order.projectName }}</div></div>
                <div class="form-field"><label>Vendor</label><div class="po-readonly">{{ order.vendorName }}</div></div>
                <div class="form-field po-notes-field"><label>Notes</label><div class="po-readonly">{{ order.notes || '—' }}</div></div>
              </div>
            </div>

            <div class="items-section">
              <div class="section-label">Items</div>
              <div class="po-table-wrap">
                <table class="items-table po-items">
                  <thead>
                    <tr>
                      <th class="col-sno">S.No</th>
                      <th class="col-desc">Description</th>
                      <th class="col-unit">Unit</th>
                      <th class="col-qty">Qty</th>
                      <th class="col-amount">Amount (₹)</th>
                      <th class="col-payment">Payment Mode</th>
                      <th class="col-gst">GST %</th>
                      <th class="col-gstamt">GST Amt (₹)</th>
                      <th class="col-total">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of order.items; track item.materialId; let index = $index) {
                      <tr>
                        <td class="col-sno cell-center">{{ index + 1 }}</td>
                        <td class="col-desc">{{ item.description }}</td>
                        <td class="col-unit">{{ item.unit }}</td>
                        <td class="col-qty cell-right">{{ item.quantity }}</td>
                        <td class="col-amount amount-cell">{{ formatMoney(item.itemAmount) }}</td>
                        <td class="col-payment">{{ item.paymentMode || order.paymentMode || 'Bank Transfer' }}</td>
                        <td class="col-gst cell-center">{{ item.gstPercent }}%</td>
                        <td class="col-gstamt amount-cell">{{ formatMoney(item.gstAmount) }}</td>
                        <td class="col-total amount-cell">{{ formatMoney(itemTotal(item)) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="po-totals">
              <div class="total-row"><span>Subtotal</span><span class="total-value">{{ formatMoney(order.subtotal) }}</span></div>
              <div class="total-row"><span>Total GST</span><span class="total-value">{{ formatMoney(order.totalGst) }}</span></div>
              <div class="total-row"><span>Round Off</span><span class="total-value">{{ formatMoney(order.roundOff) }}</span></div>
              <div class="total-row grand"><span>Grand Total</span><span class="total-value">{{ formatMoney(order.grandTotal) }}</span></div>
            </div>
          </div>
        } @else {
          <p class="po-state">Loading purchase order…</p>
          @if (error()) { <p class="po-error">{{ error() }}</p> }
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }

    .page-search-bar {
      position: relative;
      max-width: 600px;
      margin: 16px auto 24px;
      padding: 0 24px;
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
      left: 40px;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      color: #9ca3af;
      pointer-events: none;
    }

    .po-panel { background: #fff; border: 1px solid #d9e2ef; border-radius: 12px; overflow: hidden; }
    .po-state { padding: 40px 24px; text-align: center; color: #64748b; font-size: 14px; }
    .po-list-wrap { overflow: auto; }
    .po-list { width: 100%; border-collapse: collapse; min-width: 760px; }
    .po-list th, .po-list td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: middle; }
    .po-list th { background: #f4f7fb; color: #334155; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .po-list tr { cursor: pointer; }
    .po-list tbody tr:hover { background: #f8fbff; }
    .po-list tbody tr.row-selected { background: #f0f6ff; }
    .cursor-action-menu { position:fixed;z-index:1200;display:flex;gap:4px;padding:5px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;box-shadow:0 12px 28px rgba(16,24,40,.18) }.cursor-action-menu button{padding:7px 9px;border:0;border-radius:6px;background:transparent;color:#344054;font-weight:700;cursor:pointer}.cursor-action-menu button:hover{background:#f2f4f7}.cursor-action-menu button.danger{color:#b42318}.cursor-action-menu button.danger:hover{background:#fff1f0}
    .po-list td button { border: 0; background: none; color: #003a8c; font-weight: 800; cursor: pointer; padding: 0; text-align: left; }
    .po-pagination { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 18px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px; }
    .po-pagination-actions { display: flex; align-items: center; gap: 12px; }
    .po-pagination-actions button { padding: 7px 12px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #2c5cff; font-weight: 700; cursor: pointer; }
    .po-pagination-actions button:hover:not(:disabled) { background: #eef2ff; border-color: #2c5cff; }
    .po-pagination-actions button:disabled { color: #94a3b8; background: #f8fafc; cursor: not-allowed; }

    .po-editor { max-width: 1100px; margin: 0 auto; }
    .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .back-link { display: inline-flex; align-items: center; gap: 6px; padding: 8px 0; background: none; border: none; color: #2c5cff; font-size: 14px; font-weight: 500; cursor: pointer; }
    .back-link:hover { text-decoration: underline; }
    .editor-actions { display: flex; gap: 10px; }
    .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; background: #2c5cff; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; line-height: 1; }
    .btn-primary:hover { background: #1e4ae8; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; background: #eef2ff; color: #2c5cff; border: 1px solid #c7d7fe; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; line-height: 1; }
    .btn-secondary:hover { background: #e0e7ff; border-color: #2c5cff; }
    .btn-danger { display: inline-flex; align-items: center; padding: 10px 18px; background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; line-height: 1; }
    .btn-danger:hover:not(:disabled) { background: #ffe4e6; border-color: #fb7185; }
    .btn-danger:disabled { opacity: 0.65; cursor: not-allowed; }

    .quotation-document { background: #fff; border: 1px solid #cbd6e6; border-radius: 14px; padding: 32px; }
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #002263; margin-bottom: 24px; }
    .company-name { font-size: 22px; font-weight: 900; color: #002263; margin: 0 0 4px; }
    .company-address, .company-state-gst { font-size: 12px; color: #64748b; margin: 0 0 2px; }
    .quotation-title { font-size: 24px; font-weight: 900; color: #002263; text-align: right; margin: 0 0 12px; letter-spacing: 0.05em; }
    .quotation-meta { text-align: right; }
    .meta-row { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 4px; }
    .meta-label { font-size: 12px; color: #64748b; }
    .meta-value { font-size: 12px; font-weight: 600; color: #1e293b; }

    .client-section { margin-bottom: 24px; }
    .section-label { font-size: 11px; font-weight: 700; color: #002263; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px; }
    .client-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .po-fields { grid-template-columns: 2fr 2fr 1fr; }
    .po-notes-field { grid-column: 1 / -1; }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-field label { font-size: 11px; font-weight: 600; color: #64748b; }
    .form-field input, .form-field select, .form-field textarea { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; color: #1e293b; background: #fff; }
    .form-field select {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5.5 7.5 10 12l4.5-4.5' fill='none' stroke='%232c5cff' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 16px 16px;
      padding-right: 34px;
      cursor: pointer;
    }
    .form-field select:disabled {
      background-color: #f1f5f9;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5.5 7.5 10 12l4.5-4.5' fill='none' stroke='%2394a3b8' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      color: #64748b;
    }
    .form-field input:focus, .form-field select:focus, .form-field textarea:focus { outline: none; border-color: #2c5cff; box-shadow: 0 0 0 3px rgba(44, 92, 255, 0.1); }
    .form-field input:disabled, .form-field select:disabled { background: #f1f5f9; color: #64748b; }
    .po-readonly { padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; font-size: 13px; color: #1e293b; }

    .svg-icon { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
    .erp-select-menu { position: relative; }
    .erp-select-menu.open .erp-select-trigger { border-color: #2c5cff; box-shadow: 0 0 0 3px rgba(44, 92, 255, 0.1); }
    .po-select-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; color: #1e293b; background: #fff; cursor: pointer; text-align: left; box-sizing: border-box; }
    .po-select-trigger.trigger-disabled { background: #f1f5f9; color: #64748b; cursor: not-allowed; }
    .po-select-trigger .svg-icon { flex-shrink: 0; color: #2c5cff; }
    .po-select-trigger.trigger-disabled .svg-icon { color: #94a3b8; }
    .po-trigger-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .po-trigger-value.placeholder { color: #94a3b8; }
    .po-material-trigger { padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px; }
    .po-material-trigger .svg-icon { width: 14px; height: 14px; }
    .po-material-panel { min-width: 320px; max-width: 450px; max-height: 320px; padding: 8px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #d5deea; border-radius: 10px; background: #fff; box-shadow: 0 16px 36px rgba(15, 23, 42, .18), 0 3px 8px rgba(15, 23, 42, .08); }
    .po-material-panel .po-select-search { position: relative; z-index: 2; min-height: 38px; padding: 8px 10px; border: 1px solid #dbe3ee; border-radius: 7px; background: #fff; flex: 0 0 auto; }
    .po-material-panel .po-select-search:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, .1); }
    .po-material-options { min-height: 0; margin-top: 6px; overflow-y: auto; overscroll-behavior: contain; flex: 1 1 auto; scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
    .po-material-panel button {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #334155;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .po-material-panel button:hover { background: #f1f5f9; color: #0f172a; }
    .po-material-panel button.selected { background: #eff6ff; color: #1d4ed8; }
    .po-material-panel .po-option-main {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: left;
    }
    .po-material-panel .po-option-meta {
      flex-shrink: 0;
      white-space: nowrap;
      text-align: right;
      min-width: 50px;
    }
    .erp-select-panel { position: absolute; top: calc(100% + 4px); left: 0; right: 0; min-width: 100%; max-height: 260px; overflow-y: auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 12px 30px rgba(2, 22, 60, 0.18); z-index: 300; display: flex; flex-direction: column; overflow: hidden; }
    .erp-select-panel.po-select-panel:not(.po-material-panel) { overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
    .erp-select-panel > button { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 8px 10px; border: none; background: none; text-align: left; font-size: 12px; color: #1e293b; cursor: pointer; box-sizing: border-box; flex-shrink: 0; }
    .erp-select-panel > button:hover { background: #f0f6ff; }
    .erp-select-panel > button.selected { background: #e0ecff; color: #003a8c; font-weight: 600; }
    .po-option-main { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .po-option-meta { flex-shrink: 0; font-size: 11px; color: #64748b; font-weight: 400; }
    .po-select-search { width: 100%; padding: 8px 10px; border: none; border-bottom: 1px solid #e2e8f0; font-size: 12px; outline: none; box-sizing: border-box; position: sticky; top: 0; background: #fff; z-index: 10; flex-shrink: 0; }
    .po-select-empty { padding: 14px 10px; text-align: center; color: #94a3b8; font-size: 12px; }
    .po-select-create { justify-content: flex-start !important; color: #2c5cff !important; font-weight: 700; border-top: 1px solid #e2e8f0 !important; background: #f8fafc !important; position: sticky; bottom: 0; z-index: 1; }
    .po-select-create:hover { background: #eef2ff !important; }
    .items-section { margin-bottom: 24px; overflow: visible; }
    .items-section .po-table-wrap { position: relative; }
    .items-table tbody tr { position: relative; }
    .items-table tbody td { position: relative; }
    .items-table tbody td .erp-select-menu { position: static; }
    .items-table tbody td .erp-select-panel { position: absolute; top: 100%; left: 0; z-index: 9999; margin-top: 4px; }
    .po-table-wrap { overflow: visible; }
    .items-table { width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #cfd8e6; border-radius: 8px; overflow: visible; min-width: 856px; }
    .items-table col.col-col-sno { width: 44px; }
    .items-table col.col-col-desc { width: auto; }
    .items-table col.col-col-unit { width: 76px; }
    .items-table col.col-col-qty { width: 76px; }
    .items-table col.col-col-amount { width: 104px; }
    .items-table col.col-col-gst { width: 96px; }
    .items-table col.col-col-gstamt { width: 100px; }
    .items-table col.col-col-total { width: 104px; }
    .items-table col.col-col-action { width: 56px; }
    .items-table th { background: #eef4ff; color: #002263; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; padding: 10px 8px; text-align: left; border-bottom: 2px solid #cfd8e6; }
    .items-table td { padding: 6px 8px; border-bottom: 1px solid #e8edf4; vertical-align: middle; box-sizing: border-box; }
    .items-table tr:last-child td { border-bottom: none; }
    .col-sno { width: 44px; text-align: center; }
    .col-desc { min-width: 200px; }
    .col-unit { width: 76px; }
    .col-qty { width: 76px; }
    .col-amount { width: 104px; text-align: right; }
    .col-gst { width: 96px; }
    .col-gstamt { width: 100px; text-align: right; }
    .col-total { width: 104px; text-align: right; }
    .col-action { width: 56px; text-align: center; }
    .cell-center { text-align: center; }
    .cell-right { text-align: right; }
    .amount-cell { font-weight: 600; color: #0f172a; }
    .items-table input, .items-table select { width: 100%; padding: 6px 8px; border: 1px solid transparent; border-radius: 4px; font-size: 12px; color: #1e293b; background: transparent; box-sizing: border-box; }
    .items-table select {
      border: 1px solid #e2e8f0;
      background-color: #fff;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5.5 7.5 10 12l4.5-4.5' fill='none' stroke='%232c5cff' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
      background-size: 14px 14px;
      padding-right: 26px;
      cursor: pointer;
    }
    .items-table select:disabled { background-color: #f1f5f9; color: #64748b; }
    .items-table input:focus, .items-table select:focus { border-color: #2c5cff; background: #fff; outline: none; }
    .items-table input[type="number"] { text-align: right; }
    .items-table input:disabled { background: transparent; color: #475569; }
    .items-actions { margin-top: 12px; }
    .add-line { padding: 9px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; border: 1px dashed #2c5cff; background: #eef2ff; color: #2c5cff; font-size: 13px; }
    .add-line:hover { background: #e0e7ff; }
    .add-line:disabled { border-color: #cbd5e1; background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }

    .manual-material { display: flex; gap: 6px; align-items: center; }
    .manual-material-toggle { border: 0; background: none; color: #003a8c; font-weight: 700; cursor: pointer; padding: 6px 0; font-size: 12px; }
    .manual-material input { border: 1px solid #e2e8f0 !important; background: #fff !important; }
    .manual-material button { border: 0; background: none; color: #003a8c; font-weight: 700; cursor: pointer; white-space: nowrap; font-size: 12px; }
    .custom-gst-action { border: 0; background: none; color: #003a8c; font-weight: 700; cursor: pointer; white-space: nowrap; font-size: 12px; margin-top: 2px; }
    .custom-gst { display: flex; gap: 4px; margin-top: 5px; }
    .custom-gst input { width: 52px; border: 1px solid #cbd5e1 !important; background: #fff !important; }
    .remove-line { border: 0; background: #fee2e2; color: #dc2626; border-radius: 6px; width: 26px; height: 26px; font-size: 16px; cursor: pointer; line-height: 1; }
    .remove-line:disabled { opacity: 0.4; cursor: not-allowed; }

    .po-totals { margin-left: auto; width: 320px; max-width: 100%; border-top: 2px solid #002263; padding-top: 12px; }
    .total-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px; color: #475569; }
    .total-row .total-value { font-weight: 600; color: #1e293b; }
    .total-row input { width: 90px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; text-align: right; }
    .total-row.grand { border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 10px; }
    .total-row.grand span { font-size: 16px; font-weight: 800; color: #0f172a; }

    .po-error { margin: 12px 0 0; padding: 10px 14px; background: #fee2e2; color: #991b1b; border-radius: 8px; font-size: 13px; }

    @media (max-width: 768px) {
      .quotation-document { padding: 20px; }
      .po-fields { grid-template-columns: 1fr; }
      .doc-header { flex-direction: column; gap: 16px; }
      .quotation-title, .quotation-meta { text-align: left; }
      .meta-row { justify-content: flex-start; }
      .po-totals { width: 100%; }
      .editor-header { flex-direction: column; align-items: flex-start; gap: 12px; }
      .po-pagination { align-items: flex-start; flex-direction: column; }
      .po-pagination-actions { width: 100%; justify-content: space-between; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrdersPanelComponent implements OnInit, OnChanges {
  @Input() projectId = "";
  @Input() projectName = "Current project";
  @Input() preselectedMaterialIds: string[] = [];
  @Input() view: "list" | "create" | "detail" | "edit" = "list";
  @Input() openNumber = "";
  @Output() closeCreate = new EventEmitter<void>();
  @Output() saved = new EventEmitter<PurchaseOrder>();
  @Output() countChange = new EventEmitter<number>();
  @Output() closeDetail = new EventEmitter<void>();
  @Output() requestDetail = new EventEmitter<string>();
  @Output() editRequest = new EventEmitter<string>();

  private readonly api = inject(ApiService);
  private readonly data = inject(ErpDataService);
  private readonly router = inject(Router);
  readonly formatMoney = formatMoney;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal("");
  readonly exporting = signal<"" | "pdf" | "excel">("");
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);
  readonly totalOrders = signal(0);
  readonly pageSize = 200;
  readonly search = signal("");
  readonly filteredOrders = computed(() => {
    const searchTerm = this.search().toLowerCase().trim();
    if (!searchTerm) return this.orders();
    return this.orders().filter(order =>
      order.poNumber?.toLowerCase().includes(searchTerm) ||
      order.vendorName?.toLowerCase().includes(searchTerm) ||
      order.projectName?.toLowerCase().includes(searchTerm)
    );
  });
  readonly pageSummary = computed(() => {
    const total = this.totalOrders();
    if (!total) return "No purchase orders";
    const first = (this.currentPage() - 1) * this.pageSize + 1;
    const last = Math.min(first + this.orders().length - 1, total);
    return `Showing ${first}-${last} of ${total}`;
  });
  readonly selectedOrder = signal<PurchaseOrder | null>(null);
  readonly poActionRow = signal<PurchaseOrder | null>(null);
  readonly poActionPosition = signal({ x: 0, y: 0 });
  readonly editingId = signal("");
  readonly vendors = signal<any[]>([]);
  readonly projects = signal<any[]>([]);
  readonly materials = signal<ExistingMaterial[]>([]);
  readonly gstRates = signal<number[]>([0, 5, 12, 18, 28]);
  readonly customGstLine = signal<number | null>(null);
  readonly openMenu = signal("");
  readonly menuSearch = signal("");
  readonly filteredProjects = computed(() => filterByName(this.projects(), this.menuSearch(), "name"));
  readonly filteredVendors = computed(() => filterByName(this.vendors(), this.menuSearch(), "name"));
  readonly selectableMaterials = computed(() => {
    const unique = new Map<string, ExistingMaterial>();
    const selectedIds = new Set([
      ...this.lines().map((line) => line.materialId),
      ...this.preselectedMaterialIds,
    ].filter(Boolean));
    for (const material of this.materials()) {
      const key = `${this.normalizedMaterialValue(material.name)}::${this.normalizedMaterialValue(material.unit)}`;
      const current = unique.get(key);
      if (!current || (selectedIds.has(material._id) && !selectedIds.has(current._id))) {
        unique.set(key, material);
      }
    }
    return Array.from(unique.values());
  });
  readonly filteredMaterials = computed(() => {
    const query = this.normalizedMaterialValue(this.menuSearch());
    if (!query) return this.selectableMaterials();
    return this.selectableMaterials().filter((material) =>
      `${material.name} ${material.unit}`.toLocaleLowerCase().includes(query),
    );
  });
  readonly selectedProjectName = computed(() => {
    const projectId = this.draftProjectId();
    const currentProjectName = this.projects().find((project) => project._id === projectId)?.name;
    if (currentProjectName) return currentProjectName;
    if (this.selectedOrder()?.projectId === projectId) return this.selectedOrder()?.projectName ?? "";
    return this.projectId === projectId ? this.projectName : "";
  });
  readonly selectedVendorName = computed(() => this.vendors().find((v) => v._id === this.vendorId())?.name ?? "");
  readonly draftProjectId = signal("");
  readonly vendorId = signal("");
  readonly date = signal(new Date().toISOString().slice(0, 10));
  readonly notes = signal("");
  readonly paymentModes = ["Bank Transfer", "Cash", "UPI", "Cheque", "NEFT", "RTGS", "IMPS", "Credit Card", "Debit Card", "Net Banking", "Other"];

  gstRateOptions() {
    return this.gstRates().map((rate) => ({ label: `${rate}%`, value: rate }));
  }
  readonly roundOff = signal(0);
  readonly lines = signal<PoDraftLine[]>([this.emptyLine()]);
  readonly subtotal = computed(() => this.lines().reduce((sum, line) => sum + this.lineAmount(line), 0));
  readonly totalGst = computed(() => this.lines().reduce((sum, line) => sum + this.lineGst(line), 0));
  readonly grandTotal = computed(() => this.subtotal() + this.totalGst() + this.roundOff());
  readonly displayPoNumber = computed(() => (this.editingId() ? (this.selectedOrder()?.poNumber ?? "") : this.nextNumberPreview));

  get companyName(): string { return this.data.companyProfile().name || "Annai Golden Builders"; }
  get companyAddress(): string { return this.data.companyProfile().address || ""; }
  get companyState(): string { return this.data.companyProfile().state || "Tamil Nadu"; }
  get companyGstin(): string { return this.data.companyProfile().gstin || ""; }

  get nextNumberPreview(): string {
    const year = new Date().getFullYear();
    const max = this.orders().reduce((highest, order) => {
      const match = /^PO-(\d{4})-(\d+)$/.exec(String(order.poNumber || "").trim());
      if (!match || Number(match[1]) !== year) return highest;
      return Math.max(highest, Number(match[2]));
    }, 0);
    return `PO-${year}-${String(max + 1).padStart(4, "0")}`;
  }

  ngOnInit() { this.loadReferenceData(); this.loadOrders(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["projectId"] && !changes["projectId"].firstChange) {
      this.currentPage.set(1);
      this.loadOrders(1);
    }
    if (changes["view"]?.currentValue === "create") this.resetDraft();
    if (this.view === "create" && this.projectId && (changes["projectId"] || changes["preselectedMaterialIds"] || changes["view"]?.currentValue === "create")) {
      void this.selectProject(this.projectId);
    }
    if (changes["view"]?.currentValue === "edit") void this.startEdit(this.openNumber);
    if (changes["view"]?.currentValue === "detail" && this.openNumber && !this.selectedOrder()) {
      this.openOrder(this.openNumber);
    }
    if (changes["openNumber"]?.currentValue) this.openOrder(String(changes["openNumber"].currentValue));
  }

  closeDetailView() {
    this.selectedOrder.set(null);
    this.closeDetail.emit();
  }

  isAdmin() { return this.api.user()?.role === "admin"; }
  canRequestOrEdit() { return ["admin", "project_manager", "accountant"].includes(String(this.api.user()?.role || "")); }

  openPoActionMenu(order: PurchaseOrder, event: MouseEvent) {
    if (!this.canRequestOrEdit()) { this.requestDetail.emit(order.poNumber); return; }
    this.poActionRow.set(order);
    this.poActionPosition.set({ x: Math.min(event.clientX + 10, window.innerWidth - 190), y: Math.min(event.clientY + 10, window.innerHeight - 52) });
  }
  openSelectedPo() { const order = this.poActionRow(); if (order) this.requestDetail.emit(order.poNumber); this.poActionRow.set(null); }
  editSelectedPo() { const order = this.poActionRow(); if (order) this.editRequest.emit(order.poNumber); this.poActionRow.set(null); }
  deleteSelectedPo() { const order = this.poActionRow(); if (!order) return; this.selectedOrder.set(order); this.poActionRow.set(null); void this.deleteOrder(); }
  requestPoEdit(order = this.poActionRow()) {
    if (!order) return;
    this.poActionRow.set(null);
    void this.router.navigate(["/inbox"], { queryParams: { request: `Please edit purchase order ${order.poNumber}.`, link: `/purchase-orders?edit=${encodeURIComponent(order.poNumber)}` } });
  }

  async deleteOrder() {
    const order = this.selectedOrder();
    if (!order || !this.isAdmin()) return;
    const confirmed = window.confirm(
      `Delete PO ${order.poNumber}? All materials and quantities recorded by this PO will also be removed from inventory.`,
    );
    if (!confirmed) return;
    this.error.set("");
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.deletePurchaseOrder(order._id));
      await this.loadOrders(1);
      this.refreshSharedMaterials();
      this.closeDetailView();
    } catch (error: any) {
      this.error.set(error?.error?.error || error?.error?.message || error?.message || "Could not delete purchase order.");
    } finally {
      this.saving.set(false);
    }
  }

  readonly referenceLoading = signal(false);
  readonly unitOptions = ["Nos", "Pcs", "Bags", "Kg", "Ton", "Litre", "Meter", "Feet", "Sq.ft", "Sq.m", "Cu.ft", "Cu.m", "Load", "Box", "Set"];

  private async loadReferenceData() {
    this.referenceLoading.set(true);
    const results = await Promise.allSettled([
      this.loadReferencePages((page) => firstValueFrom(this.api.listVendors({ limit: 25, page })))
        .then((items) => this.vendors.set(items)),
      firstValueFrom(this.api.listPurchaseOrderGstRates())
        .then((result) => this.gstRates.set(result.rates || [0, 5, 12, 18, 28])),
      this.loadReferencePages((page) => firstValueFrom(this.api.listProjects({ limit: 25, page })))
        .then((items) => this.projects.set(items)),
    ]);
    this.referenceLoading.set(false);
    if (results.some((result) => result.status === "rejected")) {
      this.error.set("Some purchase order options could not be loaded. Please reload to retry.");
    }
    if (this.projectId && !this.draftProjectId()) await this.selectProject(this.projectId);
  }

  private async loadReferencePages(fetchPage: (page: number) => Promise<{ items: any[]; total?: number }>) {
    const items: any[] = [];
    for (let page = 1; ; page += 1) {
      const result = await fetchPage(page);
      const rows = result.items || [];
      items.push(...rows);
      if (rows.length < 25 || (result.total !== undefined && items.length >= result.total)) return items;
    }
  }

  async loadOrders(page = this.currentPage()) {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(
        this.api.listPurchaseOrders(
          this.projectId
            ? { projectId: this.projectId, page, limit: this.pageSize }
            : { page, limit: this.pageSize },
        ),
      );
      const orders = result.items || [];
      const total = Number(result.total) || 0;
      const pages = Math.max(1, Number(result.pages) || Math.ceil(total / this.pageSize));
      this.orders.set(orders);
      this.currentPage.set(page);
      this.totalPages.set(pages);
      this.totalOrders.set(total);
      this.countChange.emit(total);
    } catch {
      this.orders.set([]);
      this.totalPages.set(1);
      this.totalOrders.set(0);
      this.countChange.emit(0);
    }
    finally { this.loading.set(false); }
    this.refreshSharedMaterials();
  }

  changePage(page: number) {
    if (this.loading() || page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.search.set("");
    void this.loadOrders(page);
  }

  async selectProject(projectId: string) {
    this.draftProjectId.set(projectId);
    this.materials.set([]);
    this.lines.set([this.emptyLine()]);
    if (!projectId) return;
    try {
      const items = await this.loadAllMaterialsAcrossProjects();
      if (this.draftProjectId() !== projectId) return;
      this.materials.set(items);
      this.applyPreselectedMaterials();
    } catch { this.error.set("Could not load materials from inventory."); }
  }

  selectMaterial(index: number, materialId: string) {
    const material = this.selectableMaterials().find((item) => item._id === materialId);
    if (!material) return;
    const knownAmount = Number(material.givenAmount ?? material.issuedAmount ?? 0);
    const quantity = this.defaultQuantityFor(material);
    this.updateLineObject(index, { source: "existing", materialId, description: material.name, unit: material.unit, quantity: 0, amount: knownAmount > 0 && quantity > 0 ? knownAmount / quantity : 0 });
    this.openMenu.set("");
  }

  private applyPreselectedMaterials() {
    if (!this.preselectedMaterialIds.length) return;
    const selected = new Set(this.preselectedMaterialIds);
    const rows = this.selectableMaterials()
      .filter((material) => selected.has(material._id))
      .map((material) => this.draftLineForMaterial(material));
    if (rows.length) this.lines.set(rows);
  }

  private draftLineForMaterial(material: ExistingMaterial): PoDraftLine {
    const knownAmount = Number(material.givenAmount ?? material.issuedAmount ?? 0);
    const quantity = this.defaultQuantityFor(material);
    return {
      key: crypto.randomUUID(),
      source: "existing",
      materialId: material._id,
      description: material.name,
      unit: material.unit,
      quantity: 0,
      amount: knownAmount > 0 && quantity > 0 ? knownAmount / quantity : 0,
      paymentMode: "Bank Transfer",
      gstPercent: 18,
    };
  }

  private defaultQuantityFor(material: ExistingMaterial) {
    return Number(material.approvedQuantity) || Number(material.requestedQuantity) || 1;
  }



  setManualLine(index: number) {
    this.openMenu.set("");
    this.updateLineObject(index, { source: "manual", materialId: "", description: "", unit: "", quantity: 0, amount: 0 });
  }
  setExistingLine(index: number) { this.updateLineObject(index, { source: "existing", materialId: "", description: "", unit: "", quantity: 0, amount: 0 }); }
  updateLine(index: number, key: keyof PoDraftLine, value: string | number) { this.updateLineObject(index, { [key]: value } as Partial<PoDraftLine>); }
  private updateLineObject(index: number, patch: Partial<PoDraftLine>) { this.lines.update((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)); }
  addLine() { this.lines.update((rows) => [...rows, this.emptyLine()]); }
  removeLine(index: number) { this.lines.update((rows) => rows.filter((_, rowIndex) => rowIndex !== index)); }
  lineAmount(line: PoDraftLine) { return Math.round(line.quantity * line.amount * 100) / 100; }
  lineGst(line: PoDraftLine) { return Math.round(this.lineAmount(line) * line.gstPercent) / 100; }
  lineTotal(line: PoDraftLine) { return Math.round((this.lineAmount(line) + this.lineGst(line)) * 100) / 100; }
  itemTotal(item: { itemAmount?: number; gstAmount?: number }) { return Math.round(((item.itemAmount || 0) + (item.gstAmount || 0)) * 100) / 100; }

  async saveCustomGst(index: number, raw: string) {
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { this.error.set("GST rate must be between 0 and 100."); return; }
    try { await firstValueFrom(this.api.addPurchaseOrderGstRate(rate)); this.gstRates.update((rates) => [...new Set([...rates, rate])].sort((a, b) => a - b)); this.updateLine(index, "gstPercent", rate); this.customGstLine.set(null); }
    catch (error: any) { this.error.set(error?.error?.error || "Could not save GST rate."); }
  }

  async save() {
    this.error.set("");
    if (!this.draftProjectId()) { this.error.set("Select the project first."); return; }
    if (!this.vendorId()) { this.error.set("Select a vendor."); return; }
    if (this.lines().some((line) => !line.paymentMode.trim())) { this.error.set("Select a payment mode for every row."); return; }
    const invalid = this.lines().some((line) => line.source === "existing"
      ? !line.materialId
        || !this.selectableMaterials().some((material) => material._id === line.materialId)
        || line.quantity <= 0
      : !line.description.trim() || !line.unit.trim() || line.quantity <= 0);
    if (invalid) { this.error.set("Complete every purchase order line."); return; }
    if (this.grandTotal() <= 0) { this.error.set("Purchase order total must be greater than ₹0. Enter an amount before saving."); return; }
    this.saving.set(true);
    try {
      const payload = {
        vendorId: this.vendorId(),
        date: this.date(),
        notes: this.notes().trim(),
        roundOff: this.roundOff(),
        items: this.lines().map((line) => ({
          source: line.source,
          materialId: line.materialId || undefined,
          description: line.source === "manual" ? line.description || undefined : undefined,
          unit: line.source === "manual" ? line.unit || undefined : undefined,
          quantity: line.quantity,
          rate: line.amount,
          paymentMode: line.paymentMode,
          gstPercent: line.gstPercent,
        })),
      };
      const editingId = this.editingId();
      const response = editingId
        ? await firstValueFrom(this.api.updatePurchaseOrder(editingId, payload))
        : await firstValueFrom(this.api.createPurchaseOrder({ ...payload, projectId: this.draftProjectId() }));
      this.syncSavedOrderMaterials(response.purchaseOrder);
      this.editingId.set("");
      await this.loadOrders();
      await this.refreshSharedMaterials(response.purchaseOrder.projectId);
      this.selectedOrder.set(response.purchaseOrder);
      this.saved.emit(response.purchaseOrder);
    } catch (error: any) { this.error.set(error?.error?.error || error?.error?.message || error?.message || "Could not save purchase order."); }
    finally { this.saving.set(false); }
  }

  private async refreshSharedMaterials(projectId = this.projectId) {
    try {
      const items = projectId
        ? await this.loadAllMaterials(projectId)
        : (await firstValueFrom(this.api.listMaterials({ limit: 25 }))).items;
      const fresh = (items || []).map((item: any) => mapMaterial(item));
      const byId = new Map<string, any>();
      for (const row of this.data.materials()) {
        const key = String((row as any)._id ?? (row as any).id ?? "");
        if (key) byId.set(key, row);
      }
      for (const item of fresh) {
        const key = String(item._id ?? item.id ?? "");
        if (key) byId.set(key, item);
      }
      this.data.materials.set(Array.from(byId.values()));
    } catch {
      this.error.set("Purchase orders loaded, but material totals could not be refreshed. Please reload.");
    }
  }

  private async startEdit(value: string) {
    this.editingId.set("");
    this.error.set("");
    let order = this.orders().find((item) => item.poNumber === value || item._id === value);
    if (!order) {
      try { const response = await firstValueFrom(this.api.getPurchaseOrder(value)); order = response.purchaseOrder; }
      catch { this.error.set("Purchase order could not be opened for editing."); return; }
    }
    this.selectedOrder.set(order);
    this.editingId.set(order._id);
    this.draftProjectId.set(order.projectId);
    this.vendorId.set(order.vendorId);
    this.date.set(order.date);
    this.notes.set(order.notes || "");
    this.roundOff.set(order.roundOff || 0);
    this.lines.set(order.items.map((item) => ({
      key: crypto.randomUUID(),
      source: item.source,
      materialId: item.materialId || "",
      description: item.description || "",
      unit: item.unit || "",
      quantity: item.quantity || 0,
      amount: item.rate || 0,
      paymentMode: item.paymentMode || order.paymentMode || "Bank Transfer",
      gstPercent: item.gstPercent ?? 18,
    })));
    if (this.lines().length === 0) this.lines.set([this.emptyLine()]);
    this.materials.set([]);
    try {
      const items = await this.loadAllMaterialsAcrossProjects();
      this.materials.set(items);
    } catch {}
  }

  private async openOrder(value: string) {
    if (!value) return;
    const local = this.orders().find((order) => order.poNumber === value || order._id === value);
    if (local) { this.selectedOrder.set(local); return; }
    try { const response = await firstValueFrom(this.api.getPurchaseOrder(value)); this.selectedOrder.set(response.purchaseOrder); }
    catch { this.error.set("Purchase order could not be opened."); }
  }

  private syncSavedOrderMaterials(order: PurchaseOrder) {
    const materialIds = new Set((order.items || []).map((item) => String(item.materialId || "")));
    this.data.materials.update((rows) => rows.map((row) => {
      const databaseId = String((row as any)._id || "");
      if (!materialIds.has(databaseId)) return row;
      return {
        ...row,
        poNumber: order.poNumber,
        vendor: order.vendorName,
        vendorId: order.vendorId,
        orderedDate: order.date,
        purchasedDate: order.date,
        paymentType: order.items.find((item) => String(item.materialId || "") === databaseId)?.paymentMode || order.paymentMode,
      };
    }));
  }

  async downloadPdf() {
    const order = this.selectedOrder();
    if (!order || this.exporting()) return;
    const element = document.querySelector<HTMLElement>(".po-detail-document");
    if (!element) {
      this.error.set("Purchase order preview is not ready yet.");
      return;
    }
    this.exporting.set("pdf");
    this.error.set("");
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        windowWidth: Math.max(element.scrollWidth, element.clientWidth),
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imageWidth = pageWidth - margin * 2;
      const imageHeight = canvas.height * imageWidth / canvas.width;
      const image = canvas.toDataURL("image/png");
      let remaining = imageHeight;
      let offset = margin;
      pdf.addImage(image, "PNG", margin, offset, imageWidth, imageHeight);
      remaining -= pageHeight - margin * 2;
      while (remaining > 0) {
        offset = margin - (imageHeight - remaining);
        pdf.addPage();
        pdf.addImage(image, "PNG", margin, offset, imageWidth, imageHeight);
        remaining -= pageHeight - margin * 2;
      }
      pdf.save(`${this.safeFileName(order.poNumber)}.pdf`);
    } catch {
      this.error.set("Could not generate the purchase order PDF.");
    } finally {
      this.exporting.set("");
    }
  }

  async downloadExcel() {
    const order = this.selectedOrder();
    if (!order || this.exporting()) return;
    this.exporting.set("excel");
    this.error.set("");
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = this.companyName;
      const sheet = workbook.addWorksheet("Purchase Order", {
        views: [{ showGridLines: false }],
      });
      [8, 36, 12, 12, 16, 18, 12, 16, 16].forEach((width, index) => {
        sheet.getColumn(index + 1).width = width;
      });
      sheet.mergeCells("A1:I1");
      sheet.getCell("A1").value = this.companyName;
      sheet.getCell("A1").font = { bold: true, size: 16 };
      sheet.mergeCells("A2:I2");
      sheet.getCell("A2").value = this.companyAddress;
      sheet.mergeCells("A3:I3");
      sheet.getCell("A3").value = `${this.companyState}${this.companyGstin ? ` | GSTIN: ${this.companyGstin}` : ""}`;
      sheet.mergeCells("A5:I5");
      sheet.getCell("A5").value = "PURCHASE ORDER";
      sheet.getCell("A5").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
      sheet.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A4A8A" } };
      sheet.getCell("A5").alignment = { horizontal: "center" };
      sheet.addRow(["PO Number", order.poNumber, "Date", order.date, "Project", order.projectName, "Vendor", order.vendorName]);
      sheet.addRow([]);
      const header = sheet.addRow(["S.No", "Description", "Unit", "Qty", "Amount", "Payment Mode", "GST %", "GST Amount", "Total"]);
      header.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FF002263" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF1FB" } };
      });
      order.items.forEach((item, index) => {
        const row = sheet.addRow([
          index + 1,
          item.description,
          item.unit,
          item.quantity,
          item.itemAmount,
          item.paymentMode || order.paymentMode || "Bank Transfer",
          item.gstPercent,
          item.gstAmount,
          this.itemTotal(item),
        ]);
        for (const column of [4, 5, 7, 8, 9]) row.getCell(column).numFmt = "#,##0.00";
      });
      sheet.addRow([]);
      sheet.addRow(["", "", "", "", "", "", "", "Subtotal", order.subtotal]);
      sheet.addRow(["", "", "", "", "", "", "", "Total GST", order.totalGst]);
      sheet.addRow(["", "", "", "", "", "", "", "Round Off", order.roundOff]);
      const grandTotalRow = sheet.addRow(["", "", "", "", "", "", "", "Grand Total", order.grandTotal]);
      grandTotalRow.font = { bold: true };
      for (let rowNumber = sheet.rowCount - 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
        sheet.getRow(rowNumber).getCell(9).numFmt = "#,##0.00";
      }
      sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${this.safeFileName(order.poNumber)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.error.set("Could not generate the purchase order Excel file.");
    } finally {
      this.exporting.set("");
    }
  }

  private safeFileName(value: string) {
    return String(value || "purchase-order").replace(/[\\/:*?"<>|]+/g, "-");
  }

  @HostListener("document:pointerdown", ["$event"])
  onDocumentClick(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (target && !target.closest(".erp-select-menu")) this.openMenu.set("");
    if (target && !target.closest(".cursor-action-menu, .po-list tbody tr")) this.poActionRow.set(null);
  }

  private async loadAllMaterials(projectId: string): Promise<ExistingMaterial[]> {
    const all: ExistingMaterial[] = [];
    let cursor: string | undefined;
    do {
      const result = await firstValueFrom(this.api.listMaterials({ projectId, limit: 100, cursor }));
      all.push(...((result.items || []) as ExistingMaterial[]));
      cursor = result.nextCursor || undefined;
    } while (cursor);
    return all;
  }

  private async loadAllMaterialsAcrossProjects(): Promise<ExistingMaterial[]> {
    const all: ExistingMaterial[] = [];
    let cursor: string | undefined;
    do {
      const result = await firstValueFrom(this.api.listMaterials({ limit: 100, cursor }));
      all.push(...((result.items || []) as ExistingMaterial[]));
      cursor = result.nextCursor || undefined;
    } while (cursor);

    // Remove duplicates: keep only the first occurrence of each (name, unit) pair
    const seen = new Set<string>();
    const unique: ExistingMaterial[] = [];

    for (const material of all) {
      const normalizedName = material.name.trim().toLowerCase().replace(/\s+/g, " ");
      const normalizedUnit = material.unit.trim().toLowerCase().replace(/\s+/g, " ");
      const key = `${normalizedName}|||${normalizedUnit}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(material);
      }
    }

    return unique.sort((a, b) => a.name.localeCompare(b.name));
  }

  materialKey(index: number) { return `material-${index}`; }
  materialName(line: PoDraftLine) { return line.description || ""; }

  private normalizedMaterialValue(value: string) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  }

  toggleMenu(key: string) {
    if (key === "project" && this.view === "edit") return;
    if (key === "vendor" && !this.draftProjectId()) return;
    if (key.startsWith("material-") && (!this.draftProjectId() || !this.vendorId())) return;
    this.menuSearch.set("");
    this.openMenu.set(this.openMenu() === key ? "" : key);
  }

  async selectProjectFromMenu(projectId: string) {
    this.openMenu.set("");
    await this.selectProject(projectId);
  }

  selectVendorFromMenu(vendorId: string) {
    this.vendorId.set(vendorId);
    this.openMenu.set("");
  }

  private resetDraft() { this.openMenu.set(""); this.editingId.set(""); this.draftProjectId.set(""); this.vendorId.set(""); this.date.set(new Date().toISOString().slice(0, 10)); this.notes.set(""); this.roundOff.set(0); this.lines.set([this.emptyLine()]); this.materials.set([]); this.error.set(""); }
  private emptyLine(): PoDraftLine { return { key: crypto.randomUUID(), source: "existing", materialId: "", description: "", unit: "", quantity: 0, amount: 0, paymentMode: "Bank Transfer", gstPercent: 18 }; }
}

function filterByName<T>(list: T[], search: string, field: string): T[] {
  const query = search.trim().toLowerCase();
  if (!query) return list;
  return list.filter((item) => String((item as any)[field] || "").toLowerCase().includes(query));
}
