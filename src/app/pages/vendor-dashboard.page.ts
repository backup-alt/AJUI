import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import { Vendor, ErpDataService, Site } from "../data/erp-data.service";
import type { MaterialRow } from "../../data/dashboardData";
import { ApiService } from "../core/api.service";
import { VendorFormDialogComponent, type VendorFormValue } from "../shared/vendor-form-dialog.component";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney } from "../shared/format";

// Extended Site type for vendor sites with additional computed properties
type VendorSite = Site & {
  materialEntryCount: number;
  materialNames: string[];
  totalIssued: number;
  totalGiven: number;
  materialCount: number;
};

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, VendorFormDialogComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="vendors"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        @if (refreshMessage()) {
          <div class="backend-sync-banner" role="status">
            <span class="spinner" [class.spinning]="refreshing()"></span>
            <span>{{ refreshMessage() }}</span>
            @if (!refreshing()) {
              <button type="button" class="banner-btn" (click)="refreshFromBackend()">Refresh from backend</button>
            }
          </div>
        }
        <agb-enterprise-header
          title="Vendors"
          eyebrow="Vendor Registry · Material suppliers and contractors"
          metaLabel=""
          [blurred]="showVendorForm() || !!editingVendor()"
          [showTitle]="false"
          searchPlaceholder="Search vendors"
        />

        <ion-content class="erp-page">
          <main class="client-landing">
            @if (!selectedVendor()) {
              <!-- Vendor list view -->
              <section class="client-grid">
                <article class="client-card add-client-card" role="button" tabindex="0" (click)="showVendorForm.set(true)" (keydown.enter)="showVendorForm.set(true)">
                  <div class="add-client-icon">
                    <ion-icon name="add-outline"></ion-icon>
                  </div>
                  <h3>Add New Vendor</h3>
                  <p>Create a vendor profile to track material purchases, GST, and payment history.</p>
                </article>

                @for (vendor of vendors(); track vendor.id) {
                  <article
                    class="client-card"
                    role="button"
                    tabindex="0"
                    (click)="openVendor(vendor)"
                    (keydown.enter)="openVendor(vendor)"
                  >
                    <div class="client-card-body">
                      <div class="card-head">
                        <div class="identity">
                          <div class="avatar-block vendor-avatar">{{ vendorInitials(vendor.name) }}</div>
                          <div>
                            <h3>{{ vendor.name }}</h3>
                            <p><ion-icon name="call-outline"></ion-icon>{{ vendor.phone }}</p>
                          </div>
                        </div>
                        <span class="material-type-badge">{{ vendor.materialType }}</span>
                      </div>

                      <p class="address"><ion-icon name="location-outline"></ion-icon>{{ vendor.address }}</p>

                      <div class="ledger-box">
                        <div class="ledger-row">
                          <span>GST Number</span>
                          <strong class="gst-number">{{ vendor.gst }}</strong>
                        </div>
                      </div>
                    </div>

                    <div class="client-card-footer">
                      <span>View Sites</span>
                      <div class="client-card-footer-actions">
                        <button type="button" class="client-edit-action" aria-label="Edit vendor" title="Edit Vendor" (click)="editVendor(vendor, $event)">
                          <strong>Edit Vendor</strong>
                        </button>
                      </div>
                    </div>
                  </article>
                }

                @if (vendors().length === 0) {
                  <div class="empty-state">
                    <p>No vendors found. Add a vendor to get started.</p>
                  </div>
                }
              </section>
            } @else if (!selectedSite()) {
              <!-- Site list view for selected vendor -->
              <section class="vendor-breadcrumb">
                <button type="button" class="back-btn" (click)="backToVendors()">&larr; Vendors</button>
                <h2>{{ selectedVendor()!.name }} – Sites</h2>
              </section>

              @if (loadingSites()) {
                <div class="loading-indicator">
                  <span class="spinner-inline"></span>
                  <span>Loading sites…</span>
                </div>
              }

              <section class="client-grid">
                @for (site of vendorSites(); track site.id) {
                  <article
                    class="client-card site-card"
                    role="button"
                    tabindex="0"
                    (click)="openSite(site)"
                    (keydown.enter)="openSite(site)"
                  >
                    <div class="client-card-body">
                      <div class="card-head">
                        <div class="identity">
                          <div class="avatar-block site-avatar">
                            <ion-icon name="location-outline"></ion-icon>
                          </div>
                          <div>
                            <h3>{{ site.name }}</h3>
                            <p class="site-meta">
                              <span class="meta-item">{{ site.materialEntryCount }} entries</span>
                              <span class="meta-item">{{ site.materialCount }} types</span>
                            </p>
                          </div>
                        </div>
                        <ion-icon name="chevron-forward-outline" class="arrow-icon"></ion-icon>
                      </div>
                      <div class="ledger-box">
                        <div class="ledger-row">
                          <span>Purchase Value</span>
                          <strong>{{ formatMoney(site.totalIssued) }}</strong>
                        </div>
                        <div class="ledger-row">
                          <span>Amount Paid</span>
                          <strong>{{ formatMoney(site.totalGiven) }}</strong>
                        </div>
                      </div>
                      <div class="site-card-footer">
                        <span class="site-status" [class.active]="site.status === 'Active'" [class.on-hold]="site.status === 'On Hold'" [class.completed]="site.status === 'Completed'">
                          {{ site.status || 'Active' }}
                        </span>
                      </div>
                    </div>
                  </article>
                }

                @if (vendorSites().length === 0 && !loadingSites()) {
                  <div class="empty-state">
                    <ion-icon name="location-off-outline"></ion-icon>
                    <p>No sites with material purchases for this vendor.</p>
                  </div>
                }
              </section>
            } @else {
              <!-- Material purchase table for selected site -->
              <nav class="breadcrumb" aria-label="Breadcrumb">
                <button type="button" class="breadcrumb-link" (click)="backToVendors()">Vendors</button>
                <span class="breadcrumb-sep">›</span>
                <button type="button" class="breadcrumb-link" (click)="backToSites()">{{ selectedVendor()!.name }}</button>
                <span class="breadcrumb-sep">›</span>
                <span class="breadcrumb-current">{{ selectedSite()!.name }}</span>
              </nav>

              @if (loadingMaterials()) {
                <div class="loading-indicator">
                  <span class="spinner-inline"></span>
                  <span>Loading materials…</span>
                </div>
              }

              <div class="table-controls">
                <div class="search-box">
                  <ion-icon name="search-outline"></ion-icon>
                  <input
                    type="text"
                    [value]="materialSearchQuery()"
                    (input)="materialSearchQuery.set($any($event.target).value)"
                    placeholder="Search by material, unit, payment type, or status..."
                  />
                  @if (materialSearchQuery()) {
                    <button type="button" class="clear-search" (click)="materialSearchQuery.set('')">×</button>
                  }
                </div>
                <div class="table-actions">
                  <button type="button" class="btn-add-row" (click)="addMaterialRow()">
                    <ion-icon name="add-circle-outline"></ion-icon>
                    Add Row
                  </button>
                  <button type="button" class="btn-add-col" (click)="showAddColumnInput.set(true)">
                    <ion-icon name="add-outline"></ion-icon>
                    Add Field
                  </button>
                  @if (showAddColumnInput()) {
                    <div class="add-col-inline">
                      <input
                        type="text"
                        [value]="newColumnName()"
                        (input)="newColumnName.set($any($event.target).value)"
                        placeholder="Column name"
                        class="col-name-input"
                      />
                      <button type="button" class="btn-confirm" (click)="addCustomColumn()">Add</button>
                      <button type="button" class="btn-cancel" (click)="showAddColumnInput.set(false); newColumnName.set('')">Cancel</button>
                    </div>
                  }
                </div>
              </div>

              <section class="table-wrap materials-table">
                <table>
                  <thead>
                    <tr>
                      <th class="col-sno">S.No</th>
                      <th class="col-material">Material</th>
                      <th class="col-qty">Qty</th>
                      <th class="col-unit">Unit</th>
                      <th class="col-date">Purchase Date</th>
                      <th class="col-amount">Issued Amt</th>
                      <th class="col-amount">Given Amt</th>
                      <th class="col-payment">Payment Type</th>
                      <th class="col-date">Delivered On</th>
                      @for (col of customColumns(); track col) {
                        <th class="col-custom">
                          {{ col }}
                          <button type="button" class="remove-col-btn" (click)="removeCustomColumn(col)">×</button>
                        </th>
                      }
                      <th class="col-status">Status</th>
                      <th class="col-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of filteredSiteMaterials(); track row.id; let i = $index) {
                      <tr [class.editing]="editingRowId() === row.id">
                        <td class="col-sno">{{ i + 1 }}</td>
                        <td class="col-material">
                          @if (editingRowId() === row.id) {
                            <input type="text" [value]="row.name" (blur)="updateField(row, 'name', $any($event.target).value)" class="table-input" />
                          } @else {
                            <strong>{{ row.name || '-' }}</strong>
                          }
                        </td>
                        <td class="col-qty">
                          @if (editingRowId() === row.id) {
                            <input type="number" [value]="row.quantity" (blur)="updateField(row, 'quantity', +$any($event.target).value)" class="table-input" min="0" />
                          } @else {
                            {{ row.quantity || 0 }}
                          }
                        </td>
                        <td class="col-unit">
                          @if (editingRowId() === row.id) {
                            <input type="text" [value]="row.unit" (blur)="updateField(row, 'unit', $any($event.target).value)" class="table-input" />
                          } @else {
                            {{ row.unit || '-' }}
                          }
                        </td>
                        <td class="col-date">
                          @if (editingRowId() === row.id) {
                            <input type="date" [value]="row.purchasedDate" (blur)="updateField(row, 'purchasedDate', $any($event.target).value)" class="table-input" />
                          } @else {
                            {{ row.purchasedDate || '-' }}
                          }
                        </td>
                        <td class="col-amount">
                          @if (editingRowId() === row.id) {
                            <input type="number" [value]="row.issuedAmount" (blur)="updateField(row, 'issuedAmount', +$any($event.target).value)" class="table-input" min="0" />
                          } @else {
                            {{ formatMoney(row.issuedAmount || 0) }}
                          }
                        </td>
                        <td class="col-amount">
                          @if (editingRowId() === row.id) {
                            <input type="number" [value]="row.givenAmount" (blur)="updateField(row, 'givenAmount', +$any($event.target).value)" class="table-input" min="0" />
                          } @else {
                            {{ formatMoney(row.givenAmount || 0) }}
                          }
                        </td>
                        <td class="col-payment">
                          @if (editingRowId() === row.id) {
                            <select [value]="row.paymentType" (blur)="updateField(row, 'paymentType', $any($event.target).value)" class="table-input">
                              <option value="">Select</option>
                              <option value="Cash">Cash</option>
                              <option value="NEFT">NEFT</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="UPI">UPI</option>
                              <option value="Cheque">Cheque</option>
                            </select>
                          } @else {
                            {{ row.paymentType || '-' }}
                          }
                        </td>
                        <td class="col-date">
                          @if (editingRowId() === row.id) {
                            <input type="date" [value]="row.deliveredOn" (blur)="updateField(row, 'deliveredOn', $any($event.target).value)" class="table-input" />
                          } @else {
                            {{ row.deliveredOn || '-' }}
                          }
                        </td>
                        @for (col of customColumns(); track col) {
                          <td class="col-custom">
                            @if (editingRowId() === row.id) {
                              <input type="text" [value]="row[col]" (blur)="updateField(row, col, $any($event.target).value)" class="table-input" />
                            } @else {
                              {{ row[col] || '-' }}
                            }
                          </td>
                        }
                        <td class="col-status">
                          @if (editingRowId() === row.id) {
                            <select [value]="row.status" (blur)="updateField(row, 'status', $any($event.target).value)" class="table-input">
                              <option value="Pending">Pending</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          } @else {
                            <span class="status-badge" [class]="row.status.toLowerCase()">{{ row.status || 'Pending' }}</span>
                          }
                        </td>
                        <td class="col-action">
                          @if (editingRowId() === row.id) {
                            <button type="button" class="btn-save" (click)="saveRow(row)">Save</button>
                          } @else {
                            <button type="button" class="btn-edit" (click)="editRow(row)">Edit</button>
                            <button type="button" class="btn-delete" (click)="deleteRow(row.id)">Delete</button>
                          }
                        </td>
                      </tr>
                    }
                    @if (filteredSiteMaterials().length === 0 && !loadingMaterials()) {
                      <tr>
                        <td class="empty-row" [attr.colspan]="8 + customColumns().length">
                          <span>{{ materialSearchQuery() ? 'No materials match your search.' : 'No material purchases recorded for this site.' }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </section>
            }
          </main>
        </ion-content>

        <agb-vendor-form-dialog
          *ngIf="showVendorForm() || editingVendor()"
          eyebrow="{{ editingVendor() ? 'Vendor Edit' : 'Vendor Setup' }}"
          title="{{ editingVendor() ? 'Edit Vendor' : 'Add New Vendor' }}"
          description="{{ editingVendor() ? 'Update vendor contact, material type, GST, and address information.' : 'Create the vendor record to track material purchases and GST.' }}"
          submitLabel="{{ editingVendor() ? 'Save Changes' : 'Create Vendor' }}"
          [initialValue]="editingVendor() ? vendorEditValue(editingVendor()!) : null"
          (cancel)="closeVendorForm()"
          (create)="editingVendor() ? updateVendor($event) : createVendor($event)"
        ></agb-vendor-form-dialog>
      </div>
    </ion-split-pane>
  `,
  styles: [`
    .backend-sync-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      background: #1a2540;
      color: #fff;
      font-size: 13px;
      border-bottom: 1px solid #2c3760;
    }
    .backend-sync-banner .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #4a5780;
      border-top-color: #6fffb0;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .backend-sync-banner .spinner.spinning {
      animation: vd-spin 0.8s linear infinite;
    }
    @keyframes vd-spin { to { transform: rotate(360deg); } }
    .backend-sync-banner .banner-btn {
      margin-left: auto;
      background: #2c5cff;
      color: #fff;
      border: none;
      padding: 5px 12px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
    }
    .material-type-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      background: #eef3ff;
      color: #002263;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid #c7d9f5;
    }
    .gst-number {
      font-family: monospace;
      font-size: 12px;
      letter-spacing: 0.5px;
      color: #667085;
    }
    .vendor-avatar {
      background: linear-gradient(135deg, #5c3d00, #b86310) !important;
    }
    .vendor-breadcrumb {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      flex-wrap: wrap;
    }
    .vendor-breadcrumb h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }
    .back-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      color: #1e293b;
    }
    .back-btn:hover { background: #e2e8f0; }
    .site-avatar {
      background: linear-gradient(135deg, #002263, #1a4499) !important;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      color: #fff;
      font-size: 18px;
    }
    .site-card {
      cursor: pointer;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }
    .site-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    }
    .arrow-icon {
      font-size: 20px;
      color: #94a3b8;
    }
    .loading-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: #64748b;
      font-size: 14px;
    }
    .spinner-inline {
      width: 16px;
      height: 16px;
      border: 2px solid #cbd5e1;
      border-top-color: #2c5cff;
      border-radius: 50%;
      animation: vd-spin 0.8s linear infinite;
    }
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 48px 24px;
      color: #94a3b8;
    }
    .empty-state p {
      margin: 0;
      font-size: 15px;
    }
    @media (max-width: 640px) {
      .vendor-breadcrumb {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .vendor-breadcrumb h2 {
        font-size: 18px;
      }
    }
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 12px 0;
      flex-wrap: wrap;
    }
    .breadcrumb-link {
      background: none;
      border: none;
      color: #2c5cff;
      font-size: 14px;
      cursor: pointer;
      padding: 0;
    }
    .breadcrumb-link:hover { text-decoration: underline; }
    .breadcrumb-sep {
      color: #94a3b8;
      font-size: 14px;
    }
    .breadcrumb-current {
      color: #1e293b;
      font-size: 14px;
      font-weight: 500;
    }
    .table-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      flex: 1;
      max-width: 400px;
    }
    .search-box ion-icon {
      color: #94a3b8;
      font-size: 18px;
    }
    .search-box input {
      border: none;
      outline: none;
      flex: 1;
      font-size: 14px;
      color: #1e293b;
      background: transparent;
    }
    .search-box input::placeholder { color: #94a3b8; }
    .clear-search {
      background: #f1f5f9;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
    }
    .table-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .btn-add-row, .btn-add-col {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
    }
    .btn-add-row:hover, .btn-add-col:hover {
      background: #eef2ff;
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
      font-weight: 500;
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
    .materials-table {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .materials-table table {
      width: 100%;
      border-collapse: collapse;
    }
    .materials-table th {
      background: #f8fafc;
      color: #475569;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 12px 10px;
      text-align: left;
      border-bottom: 2px solid #e2e8f0;
    }
    .materials-table td {
      padding: 10px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
      color: #1e293b;
      vertical-align: middle;
    }
    .materials-table tr:last-child td { border-bottom: none; }
    .materials-table tr:hover td { background: #fafbfc; }
    .materials-table tr.editing td { background: #f0f9ff; }
    .col-sno { width: 50px; text-align: center; }
    .col-material { min-width: 120px; }
    .col-qty { width: 80px; text-align: right; }
    .col-unit { width: 80px; }
    .col-date { width: 120px; }
    .col-amount { width: 110px; text-align: right; }
    .col-payment { width: 120px; }
    .col-custom { min-width: 100px; }
    .col-status { width: 100px; }
    .col-action { width: 120px; text-align: center; }
    .table-input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 12px;
      color: #1e293b;
      background: #fff;
    }
    .table-input:focus {
      outline: none;
      border-color: #2c5cff;
      box-shadow: 0 0 0 3px rgba(44, 92, 255, 0.1);
    }
    .table-input[type="number"] { text-align: right; }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-badge.approved { background: #dcfce7; color: #15803d; }
    .status-badge.pending { background: #fef9c3; color: #854d0e; }
    .status-badge.rejected { background: #fee2e2; color: #dc2626; }
    .remove-col-btn {
      margin-left: 4px;
      background: #fee2e2;
      color: #dc2626;
      border: none;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    }
    .btn-edit, .btn-save, .btn-delete {
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: none;
    }
    .btn-edit {
      background: #eef2ff;
      color: #2c5cff;
      margin-right: 4px;
    }
    .btn-edit:hover { background: #dde4ff; }
    .btn-save {
      background: #22c55e;
      color: #fff;
      margin-right: 4px;
    }
    .btn-save:hover { background: #16a34a; }
    .btn-delete {
      background: #fee2e2;
      color: #dc2626;
    }
    .btn-delete:hover { background: #fecaca; }
    .empty-row {
      text-align: center;
      padding: 32px;
      color: #94a3b8;
    }
    @media (max-width: 768px) {
      .table-controls { flex-direction: column; align-items: stretch; }
      .search-box { max-width: none; }
      .table-actions { justify-content: flex-start; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDashboardPage {
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly formatMoney = formatMoney;

  readonly showVendorForm = signal(false);
  readonly editingVendor = signal<Vendor | null>(null);
  readonly vendors = this.data.vendors;
  readonly sites = this.data.getSiteEntities();
  readonly refreshing = signal(false);
  readonly refreshMessage = signal<string | null>(null);

  readonly selectedVendor = signal<Vendor | null>(null);
  readonly selectedSite = signal<Site | null>(null);
  readonly loadingSites = signal(false);
  readonly loadingMaterials = signal(false);

  readonly materialSearchQuery = signal("");
  readonly editingRowId = signal<string | null>(null);
  readonly showAddColumnInput = signal(false);
  readonly newColumnName = signal("");

  private readonly vendorSiteCustomColumnsKey = computed(() => {
    const vendor = this.selectedVendor();
    const site = this.selectedSite();
    if (!vendor || !site) return "";
    return `vendor-site-custom-cols:${vendor.name}:${site.name}`;
  });

  readonly customColumns = signal<string[]>(this.loadCustomColumns());

  // Vendor-specific sites with full details - derived from materials
  readonly vendorSites = computed(() => {
    const vendor = this.selectedVendor();
    if (!vendor) return [] as VendorSite[];

    const materialSites = new Map<string, { count: number; materialNames: string[]; totalIssued: number; totalGiven: number }>();
    for (const m of this.data.materials()) {
      if (m.vendor === vendor.name && m.site) {
        const existing = materialSites.get(m.site) || { count: 0, materialNames: [], totalIssued: 0, totalGiven: 0 };
        existing.count++;
        existing.totalIssued += m.issuedAmount || 0;
        existing.totalGiven += m.givenAmount || 0;
        if (!existing.materialNames.includes(m.name)) {
          existing.materialNames.push(m.name);
        }
        materialSites.set(m.site, existing);
      }
    }

    const vendorSiteNames = Array.from(materialSites.keys());

    // Create Site objects directly from material data
    const vendorSites: VendorSite[] = vendorSiteNames
      .map((siteName) => ({
        id: siteName,
        name: siteName,
        status: "Active" as const,
        materialEntryCount: materialSites.get(siteName)!.count,
        materialNames: materialSites.get(siteName)!.materialNames,
        totalIssued: materialSites.get(siteName)!.totalIssued,
        totalGiven: materialSites.get(siteName)!.totalGiven,
        materialCount: materialSites.get(siteName)!.materialNames.length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return vendorSites;
  });

  readonly siteMaterials = computed(() => {
    const vendor = this.selectedVendor();
    const site = this.selectedSite();
    if (!vendor || !site) return [] as MaterialRow[];
    return this.data.materials().filter(
      (m) => m.vendor === vendor.name && m.site === site.name
    );
  });

  readonly filteredSiteMaterials = computed(() => {
    const query = this.materialSearchQuery().toLowerCase().trim();
    const materials = this.siteMaterials();
    if (!query) return materials;
    return materials.filter(m =>
      m.name?.toLowerCase().includes(query) ||
      m.unit?.toLowerCase().includes(query) ||
      m.paymentType?.toLowerCase().includes(query) ||
      m.status?.toLowerCase().includes(query)
    );
  });

  siteMaterialCount(siteName: string): number {
    const vendor = this.selectedVendor();
    if (!vendor) return 0;
    return this.data.materials().filter(
      (m) => m.vendor === vendor.name && m.site === siteName
    ).length;
  }

  openVendor(vendor: Vendor) {
    this.selectedVendor.set(vendor);
    this.selectedSite.set(null);
  }

  openSite(site: Site) {
    this.selectedSite.set(site);
  }

  backToVendors() {
    this.selectedVendor.set(null);
    this.selectedSite.set(null);
  }

  backToSites() {
    this.selectedSite.set(null);
  }

  loadCustomColumns(): string[] {
    const key = this.vendorSiteCustomColumnsKey();
    if (!key) return [];
    try {
      const stored = localStorage.getItem(`agb-erp:${key}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  saveCustomColumns() {
    const key = this.vendorSiteCustomColumnsKey();
    if (!key) return;
    localStorage.setItem(`agb-erp:${key}`, JSON.stringify(this.customColumns()));
  }

  addMaterialRow() {
    const vendor = this.selectedVendor();
    const site = this.selectedSite();
    if (!vendor || !site) return;
    const newMaterial = this.data.addMaterial({
      projectId: "",
      site: site.name,
      name: "",
      unit: "",
      requested: 0,
      approved: 0,
      purchased: 0,
      consumed: 0,
      quantity: 0,
      vendor: vendor.name,
      poNumber: "Pending",
      status: "Pending",
      purchasedDate: new Date().toISOString().slice(0, 10),
      issuedAmount: 0,
      givenAmount: 0,
      paymentType: "Cash",
      deliveredOn: "",
    });
    this.editingRowId.set(newMaterial.id);
  }

  editRow(row: MaterialRow) {
    this.editingRowId.set(row.id);
  }

  saveRow(row: MaterialRow) {
    this.editingRowId.set(null);
  }

  deleteRow(materialId: string) {
    if (!confirm("Delete this material entry?")) return;
    this.data.deleteMaterial(materialId);
  }

  updateField(row: MaterialRow, field: string, value: any) {
    const patch: Partial<MaterialRow> = { [field]: value };
    this.data.updateMaterial(row.id, patch);
  }

  addCustomColumn() {
    const name = this.newColumnName().trim();
    if (!name) return;
    if (this.customColumns().includes(name)) return;
    this.customColumns.update(cols => [...cols, name]);
    this.newColumnName.set("");
    this.showAddColumnInput.set(false);
    this.saveCustomColumns();
  }

  removeCustomColumn(colName: string) {
    this.customColumns.update(cols => cols.filter(c => c !== colName));
    this.saveCustomColumns();
  }

  refreshFromBackend() {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.refreshMessage.set("Refreshing vendors from backend…");
    this.api.listVendors({ limit: 100 }).subscribe({
      next: (r) => {
        try {
          const mapped = (r.items || []).map((v: any) => ({
            id: v.vendorId || v._id,
            name: v.vendorName || v.name,
            materialType: v.materialType,
            phone: v.phoneNumber || v.phone,
            address: v.address,
            gst: v.gstNumber || v.gst,
          }));
          this.data.vendors.set(mapped);
          localStorage.setItem("agb-erp:vendors", JSON.stringify(mapped));
        } catch {}
        this.refreshing.set(false);
        this.refreshMessage.set(`Synced ${r.total} vendors`);
        setTimeout(() => this.refreshMessage.set(null), 2500);
      },
      error: (e) => {
        this.refreshing.set(false);
        this.refreshMessage.set("Sync failed: " + (e?.message || "unknown"));
        setTimeout(() => this.refreshMessage.set(null), 4000);
      },
    });
  }

  vendorInitials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "V";
  }

  createVendor(value: VendorFormValue) {
    if (!value.name || !value.materialType || !value.phone || !value.gst || !value.address) return;

    const payload = {
      vendorName: value.name,
      materialType: value.materialType,
      phoneNumber: value.phone,
      address: value.address,
      gstNumber: value.gst,
    };

    this.api.createVendor(payload).subscribe({
      next: (res: any) => {
        const newVendor: Vendor = {
          id: res.vendorId || res._id || res.id,
          name: value.name,
          materialType: value.materialType,
          phone: value.phone,
          address: value.address,
          gst: value.gst,
        };
        this.data.addVendor(newVendor);
        this.showVendorForm.set(false);
      },
      error: (err) => {
        console.error("Failed to create vendor on backend", err);
        this.showVendorForm.set(false);
      },
    });
  }

  editVendor(vendor: Vendor, event: Event) {
    event.stopPropagation();
    this.editingVendor.set(vendor);
  }

  closeVendorForm() {
    this.showVendorForm.set(false);
    this.editingVendor.set(null);
  }

  vendorEditValue(vendor: Vendor): VendorFormValue {
    return {
      name: vendor.name,
      materialType: vendor.materialType,
      phone: vendor.phone,
      address: vendor.address,
      gst: vendor.gst,
    };
  }

  updateVendor(value: VendorFormValue) {
    const vendor = this.editingVendor();
    if (!vendor || !value.name || !value.materialType || !value.phone || !value.gst || !value.address) return;

    const payload = {
      vendorName: value.name,
      materialType: value.materialType,
      phoneNumber: value.phone,
      address: value.address,
      gstNumber: value.gst,
    };

    this.api.patchVendor(vendor.id, payload).subscribe({
      next: () => {
        this.data.updateVendor(vendor.id, value);
        this.closeVendorForm();
      },
      error: (err) => {
        console.error("Failed to update vendor on backend", err);
        this.closeVendorForm();
      },
    });
  }

  deleteVendor(vendorId: string) {
    if (!confirm("Delete this vendor?")) return;
    this.api.deleteVendor(vendorId).subscribe({
      next: () => {
        this.data.deleteVendor(vendorId);
        if (this.selectedVendor()?.id === vendorId) {
          this.selectedVendor.set(null);
          this.selectedSite.set(null);
        }
      },
      error: (err) => {
        console.error("Failed to delete vendor on backend", err);
      },
    });
  }

  trackVendor(_: number, vendor: Vendor) {
    return vendor.id;
  }
}
