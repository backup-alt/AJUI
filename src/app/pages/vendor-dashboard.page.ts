import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from "@angular/core";
import { IonContent, IonIcon, IonSplitPane, ToastController } from "@ionic/angular/standalone";
import { Vendor, VendorStatus, ErpDataService, Site } from "../data/erp-data.service";
import type { MaterialRow } from "../../data/dashboardData";
import { ApiService } from "../core/api.service";
import { MaterialsService } from "../core/materials.service";
import { VendorFormDialogComponent, type VendorFormValue } from "../shared/vendor-form-dialog.component";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney } from "../shared/format";

type VendorSite = Site & {
  materialEntryCount: number;
  materialNames: string[];
  totalIssued: number;
  totalGiven: number;
  materialCount: number;
};

type BillLinkEntry = { materialId: string; billUrl: string; billLabel?: string };

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
                    class="client-card vendor-card"
                    [class.is-inactive]="vendor.status === 'Not Active'"
                    role="button"
                    tabindex="0"
                    (click)="openVendor(vendor)"
                    (keydown.enter)="openVendor(vendor)"
                  >
                    <div class="client-card-body">
                      <div class="card-head">
                        <div class="identity">
                          <div class="avatar-block">{{ vendorInitials(vendor.name) }}</div>
                          <div class="identity-text">
                            <h3>{{ vendor.name }}</h3>
                            <p><ion-icon name="call-outline"></ion-icon>{{ vendor.phone }}</p>
                          </div>
                        </div>
                        <div class="head-meta">
                          <span class="status-pill" [class.is-active]="vendor.status !== 'Not Active'" [class.is-inactive]="vendor.status === 'Not Active'">
                            <ion-icon [name]="vendor.status === 'Not Active' ? 'pause-circle-outline' : 'checkmark-circle-outline'"></ion-icon>
                            {{ vendor.status || 'Active' }}
                          </span>
                        </div>
                      </div>

                      <p class="address"><ion-icon name="location-outline"></ion-icon>{{ vendor.address }}</p>

                      <div class="ledger-box">
                        <div class="ledger-row strong">
                          <span>Material Type</span>
                          <strong>{{ vendor.materialType }}</strong>
                        </div>
                        <div class="ledger-row">
                          <span>GST Number</span>
                          <strong class="gst-number">{{ vendor.gst }}</strong>
                        </div>
                      </div>
                    </div>

                    <div class="client-card-footer">
                      <span class="footer-label">View Sites</span>
                      <div class="client-card-footer-actions">
                        <button type="button" class="client-edit-action" aria-label="Edit vendor" title="Edit Vendor" (click)="editVendor(vendor, $event)">
                          <ion-icon name="create-outline"></ion-icon>
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
              <section class="vendor-breadcrumb">
                <button type="button" class="back-btn" (click)="backToVendors()">&larr; Vendors</button>
                <h2>{{ selectedVendor()!.name }} – Sites</h2>
                <span class="vendor-status-pill" [class.is-active]="selectedVendor()!.status !== 'Not Active'" [class.is-inactive]="selectedVendor()!.status === 'Not Active'">
                  <ion-icon [name]="selectedVendor()!.status === 'Not Active' ? 'pause-circle-outline' : 'checkmark-circle-outline'"></ion-icon>
                  {{ selectedVendor()!.status || 'Active' }}
                </span>
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
                    [class.is-inactive]="selectedVendor()!.status === 'Not Active'"
                    role="button"
                    tabindex="0"
                    (click)="openSite(site)"
                    (keydown.enter)="openSite(site)"
                  >
                    <div class="client-card-body">
<div class="card-head">
                          <div class="identity">
                            <div class="avatar-block">
                              <ion-icon name="location-outline"></ion-icon>
                            </div>
                            <div class="identity-text">
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
                        <span class="vendor-status-pill" [class.is-active]="selectedVendor()!.status !== 'Not Active'" [class.is-inactive]="selectedVendor()!.status === 'Not Active'">
                          <ion-icon [name]="selectedVendor()!.status === 'Not Active' ? 'pause-circle-outline' : 'checkmark-circle-outline'"></ion-icon>
                          {{ selectedVendor()!.status || 'Active' }}
                        </span>
                      </div>
                    </div>
                  </article>
                }

                <article
                  class="client-card add-site-card"
                  role="button"
                  tabindex="0"
                  (click)="openAddSitePicker()"
                  (keydown.enter)="openAddSitePicker()"
                  [class.disabled]="availableSites().length === 0"
                >
                  <div class="add-client-icon">
                    <ion-icon name="add-outline"></ion-icon>
                  </div>
                  <h3>Add Site</h3>
                  <p>{{ availableSites().length === 0 ? 'All sites already assigned' : 'Assign an existing site to this vendor' }}</p>
                </article>

                @if (vendorSites().length === 0 && !loadingSites()) {
                  <div class="empty-state">
                    <ion-icon name="location-off-outline"></ion-icon>
                    <p>No sites with material purchases for this vendor.</p>
                  </div>
                }
              </section>

              @if (showAddSitePicker()) {
                <section class="form-overlay" role="presentation">
                  <section class="erp-dialog" role="dialog" aria-modal="true" aria-labelledby="add-site-title">
                    <div class="dialog-head">
                      <div>
                        <span>Assign Site</span>
                        <h2 id="add-site-title">Add existing site to {{ selectedVendor()!.name }}</h2>
                        <p>Select a site to assign to this vendor.</p>
                      </div>
                      <button type="button" class="icon-button" aria-label="Close site picker" (click)="closeAddSitePicker()">
                        <ion-icon name="close-outline"></ion-icon>
                      </button>
                    </div>
                    <div class="site-picker-list">
                      @if (loadingAvailableSites()) {
                        <p class="site-msg">Loading sites…</p>
                      } @else if (availableSites().length === 0) {
                        <p class="site-msg">All existing sites are already assigned to this vendor.</p>
                      } @else {
                        @for (site of availableSites(); track site.id) {
                          <button type="button" class="site-picker-row" (click)="assignExistingSite(site)">
                            <div>
                              <strong>{{ site.name }}</strong>
                            </div>
                            <ion-icon name="add-circle-outline"></ion-icon>
                          </button>
                        }
                      }
                    </div>
                  </section>
                </section>
              }
            } @else {
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
                      <th class="col-bill">Bill / Reference</th>
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
                            <input type="text" [value]="row.name" (blur)="updateField(row, 'name', $any($event.target).value)" class="table-input" [class.input-error]="nameError()" placeholder="Material name" />
                            @if (nameError()) {
                              <span class="name-error">{{ nameError() }}</span>
                            }
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
                        <td class="col-bill">
                          @if (row.billUrl) {
                            @if (isDataUrl(row.billUrl)) {
                              <button type="button" class="bill-link" (click)="openImagePreview(row.billUrl)" title="View Bill">
                                <ion-icon name="link-outline"></ion-icon>
                                <span>View Bill</span>
                              </button>
                            } @else {
                              <a class="bill-link" [href]="row.billUrl" target="_blank" rel="noopener noreferrer" title="View Bill">
                                <ion-icon name="link-outline"></ion-icon>
                                <span>View Bill</span>
                              </a>
                            }
                          } @else if (billLinkFor(row.id); as link) {
                            @if (isDataUrl(link.billUrl)) {
                              <button type="button" class="bill-link" (click)="openImagePreview(link.billUrl)" [title]="link.billUrl">
                                <ion-icon name="link-outline"></ion-icon>
                                <span>{{ link.billLabel || shortLinkLabel(link.billUrl) }}</span>
                              </button>
                            } @else {
                              <a class="bill-link" [href]="link.billUrl" target="_blank" rel="noopener noreferrer" [title]="link.billUrl">
                                <ion-icon name="link-outline"></ion-icon>
                                <span>{{ link.billLabel || shortLinkLabel(link.billUrl) }}</span>
                              </a>
                            }
                          } @else if (editingRowId() === row.id) {
                            <input type="text" [value]="draftBillLink(row.id)" (input)="setDraftBillLink(row.id, $any($event.target).value)" (blur)="commitBillLink(row.id, $any($event.target).value)" placeholder="Paste PCLOUD URL" class="table-input" />
                          } @else {
                            <span class="bill-empty">—</span>
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
                              <option value="Received">Received</option>
                              <option value="Not Received">Not Received</option>
                            </select>
                          } @else {
                            <span class="status-badge" [ngClass]="statusBadgeClass(row.status)">{{ row.status || 'Not Received' }}</span>
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
                        <td class="empty-row" [attr.colspan]="9 + customColumns().length">
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

      @if (previewImageUrl()) {
        <div class="image-preview-overlay" (click)="closeImagePreview()">
          <button type="button" class="image-preview-close" (click)="closeImagePreview()" aria-label="Close">×</button>
          <img [src]="previewImageUrl()" alt="Bill preview" (click)="$event.stopPropagation()" />
        </div>
      }
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
    .vendor-card .card-head {
      padding-bottom: 12px;
      border-bottom: 1px solid #e5eaf1;
      margin-bottom: 12px;
    }
    .vendor-card .head-meta {
      flex: 0 0 auto;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      border: 1px solid transparent;
      transition: background 180ms ease, color 180ms ease, border-color 180ms ease;
    }
    .status-pill ion-icon { font-size: 13px; }
    .status-pill.is-active {
      background: rgba(16, 185, 129, 0.12);
      color: #047857;
      border-color: rgba(16, 185, 129, 0.32);
    }
    .status-pill.is-inactive {
      background: rgba(239, 68, 68, 0.12);
      color: #b91c1c;
      border-color: rgba(239, 68, 68, 0.3);
    }
    .gst-number {
      font-family: "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      letter-spacing: 0.5px;
      color: #475569;
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
    .client-card-footer-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .client-edit-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
    }
    .client-edit-action:hover {
      background: #f8fafc;
      border-color: #94a3b8;
      color: #1e293b;
    }
    .client-edit-action ion-icon { font-size: 15px; }
    .vendor-card .client-card-body {
      padding: 18px 20px 14px;
    }
    .site-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 8px;
      background: #f3f5f8;
      color: #0b1020;
      font-size: 18px;
      flex: 0 0 auto;
    }
    .site-card .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .site-card .identity {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .site-card .identity-text {
      min-width: 0;
      flex: 1 1 auto;
    }
    .site-card h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .site-card .site-meta {
      display: flex;
      gap: 6px;
      margin: 4px 0 0;
      flex-wrap: wrap;
    }
    .site-card .meta-item {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 11px;
      font-weight: 600;
    }
    .arrow-icon {
      font-size: 20px;
      color: #94a3b8;
    }
    .site-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #eef1f6;
    }
    .site-status {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      background: rgba(148, 163, 184, 0.18);
      color: #475569;
    }
    .site-status.active {
      background: rgba(16, 185, 129, 0.14);
      color: #047857;
    }
    .site-status.on-hold {
      background: rgba(245, 158, 11, 0.16);
      color: #b45309;
    }
    .site-status.completed {
      background: rgba(59, 130, 246, 0.14);
      color: #1d4ed8;
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
    .col-bill { width: 200px; }
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
    .table-input.input-error { border-color: #dc2626; }
    .table-input.input-error:focus { box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1); }
    .name-error { display: block; color: #dc2626; font-size: 11px; margin-top: 2px; }
    .bill-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid #c7d9f5;
      max-width: 100%;
      transition: background 160ms ease, transform 160ms ease, box-shadow 160ms ease;
    }
    .bill-link:hover {
      background: linear-gradient(135deg, #dbe5ff 0%, #c7d4ff 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(29, 78, 216, 0.18);
    }
    .bill-link ion-icon { font-size: 14px; }
    .bill-link span {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bill-empty {
      color: #94a3b8;
      font-size: 14px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-badge.approved, .status-badge.received { background: #dcfce7; color: #15803d; }
    .status-badge.pending { background: #fef9c3; color: #854d0e; }
    .status-badge.rejected, .status-badge.not-received { background: #fee2e2; color: #dc2626; }
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
    .add-site-card {
      border: 2px dashed #c7d9f5;
      background: #f8faff;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 180px;
      transition: all 160ms ease;
    }
    .add-site-card:hover:not(.disabled) {
      background: #eef3ff;
      border-color: #2c5cff;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    .add-site-card.disabled {
      opacity: 0.5;
    }
    .add-site-card h3 { color: #2c5cff; }
    .site-picker-list {
      max-height: 360px;
      overflow-y: auto;
      padding: 8px 0;
    }
    .site-picker-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 12px 18px;
      background: #fff;
      border: 1px solid #e5eaf1;
      border-radius: 8px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease;
      text-align: left;
    }
    .site-picker-row:hover {
      background: #f0f6ff;
      border-color: #2c5cff;
    }
    .site-picker-row > div { display: flex; flex-direction: column; gap: 2px; }
    .site-picker-row strong { color: #1a2540; font-size: 14px; }
    .site-picker-row small { color: #94a3b8; font-size: 11px; }
    .site-picker-row ion-icon { color: #2c5cff; font-size: 22px; }
    .site-msg { padding: 12px 18px; color: #64748b; font-size: 14px; }
    .image-preview-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .image-preview-overlay img {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    }
    .image-preview-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: #fff;
      font-size: 28px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image-preview-close:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDashboardPage {
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly materialsService = inject(MaterialsService);
  readonly formatMoney = formatMoney;
  readonly toastController = inject(ToastController);

  readonly showVendorForm = signal(false);
  readonly editingVendor = signal<Vendor | null>(null);
  readonly vendors = computed<Vendor[]>(() => this.data.vendors());
  readonly refreshing = signal(false);
  readonly refreshMessage = signal<string | null>(null);
  private vendorsLoaded = false;

  readonly selectedVendor = signal<Vendor | null>(null);
  readonly selectedSite = signal<Site | null>(null);
  readonly loadingSites = signal(false);
  readonly loadingMaterials = signal(false);

  readonly materialSearchQuery = signal("");
  readonly editingRowId = signal<string | null>(null);
  readonly nameError = signal<string | null>(null);
  readonly showAddColumnInput = signal(false);
  readonly newColumnName = signal("");

  readonly customColumns = signal<string[]>([]);
  readonly billLinks = signal<Record<string, BillLinkEntry>>({});
  readonly draftBillLinks = signal<Record<string, string>>({});
  private draftLoaded = new Set<string>();

  readonly showAddSitePicker = signal(false);
  readonly availableSites = signal<{ id: string; name: string }[]>([]);
  readonly loadingAvailableSites = signal(false);

  readonly previewImageUrl = signal<string | null>(null);

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

    const siteNamesFromIds = new Set<string>();
    if (vendor.siteIds?.length) {
      // vendor.siteIds are MongoDB ObjectIds from the backend. data.sites() uses
      // composite name-keys as ids, so the lookup there always fails. We also
      // check siteEntities (which carries the real _id) and the legacy `sites()`
      // list to cover all id formats the backend might return.
      const allSites = [
        ...this.data.siteEntities(),
        ...this.data.sites(),
      ];
      for (const sid of vendor.siteIds) {
        const target = String(sid);
        const s = allSites.find(
          (x) =>
            x.id === target ||
            (x as any)._id === target ||
            (x as any).siteId === target,
        );
        if (s?.name) siteNamesFromIds.add(s.name);
      }
    }
    const vendorSiteNames = [...new Set([...siteNamesFromIds, ...Array.from(materialSites.keys())])];

    return vendorSiteNames
      .map((siteName) => ({
        id: siteName,
        name: siteName,
        status: "Active" as const,
        materialEntryCount: materialSites.get(siteName)?.count ?? 0,
        materialNames: materialSites.get(siteName)?.materialNames ?? [],
        totalIssued: materialSites.get(siteName)?.totalIssued ?? 0,
        totalGiven: materialSites.get(siteName)?.totalGiven ?? 0,
        materialCount: materialSites.get(siteName)?.materialNames.length ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly siteMaterials = computed(() => {
    const vendor = this.selectedVendor();
    const site = this.selectedSite();
    if (!vendor || !site) return [] as MaterialRow[];
    return this.materialsService.materials().filter(
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

  private initialLoadDone = false;

  constructor() { this.loadVendorsFromBackend(); this.loadSitesFromBackend();
    effect(() => {
      const vendor = this.selectedVendor();
      const site = this.selectedSite();
      if (vendor && site) {
        this.loadCustomColumns(vendor.name, site.name);
        this.loadBillLinks(vendor.name, site.name);
      } else {
        this.customColumns.set([]);
        this.billLinks.set({});
        this.draftBillLinks.set({});
        this.draftLoaded.clear();
      }
    });
  }

  private loadVendorsFromBackend() {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    if (this.initialLoadDone) {
      this.refreshMessage.set("Loading vendors from backend…");
    }
    this.api.listVendors({ limit: 100 }).subscribe({
      next: (r) => {
        const mapped = (r.items || []).map((v: any) => {
          const status: VendorStatus = v.status === "Not Active" ? "Not Active" : "Active";
          return {
            id: v.vendorId || v._id,
            name: v.name || v.vendorName,
            materialType: v.materialType,
            phone: v.phone || v.phoneNumber,
            address: v.address,
            gst: v.gstNumber || v.gst,
            status,
            _id: v._id,
            siteIds: v.siteIds || [],
          } as Vendor;
        });
        this.data.vendors.set(mapped);
        this.vendorsLoaded = true;
        this.initialLoadDone = true;
        this.refreshing.set(false);
        this.refreshMessage.set(null);
      },
      error: (e) => {
        this.initialLoadDone = true;
        this.refreshing.set(false);
        this.refreshMessage.set("Failed to load vendors: " + (e?.message || "unknown"));
        setTimeout(() => this.refreshMessage.set(null), 4000);
      },
    }); } private async loadSitesFromBackend(): Promise<void> { try { const res = await this.api.listSites().toPromise(); const sites = (res?.items || []).map((s: any) => ({ id: s._id || s.id, _id: s._id, siteId: s.siteId, name: s.name, status: s.status || "Active", supervisor: s.supervisor, startDate: s.startDate, targetEndDate: s.targetEndDate, projectIds: s.projectIds || [], })); if (sites.length > 0) { this.data.siteEntities.set(sites); } } catch (e) { console.warn("Failed to load sites from backend for vendor dashboard", e); } } private refreshSiteAssignments() {
    const current = this.selectedVendor();
    if (!current) return;
    const updated = this.data.vendors().find((v) => v.id === current.id);
    if (updated) {
      this.selectedVendor.set(updated);
      const site = this.selectedSite();
      if (site && !(updated.siteIds || []).includes(site.id)) {
        this.selectedSite.set(null);
      }
    }
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

  openAddSitePicker() {
    this.showAddSitePicker.set(true);
    this.ensureSitesLoaded().then(() => this.loadAvailableSites());
  }

  async ensureSitesLoaded() {
    const entities = this.data.siteEntities();
    if (entities.length === 0) {
      await this.loadSitesFromBackend();
    }
  }

  closeAddSitePicker() {
    this.showAddSitePicker.set(false);
    this.availableSites.set([]);
  }

  private loadAvailableSites() {
    const vendor = this.selectedVendor();
    if (!vendor) return;
    this.loadingAvailableSites.set(true);
    const assignedNames = new Set(this.vendorSites().map((s) => s.name));
    // Prefer backend-loaded siteEntities (they carry the real MongoDB _id)
    // so newly-assigned sites round-trip correctly; fall back to the local
    // sites() list when no entities have been fetched yet.
    const siteEntities = this.data.siteEntities();
    const all = siteEntities.length > 0
      ? siteEntities.map((s) => ({ id: s._id || s.id, name: s.name }))
      : this.data.sites();
    // Deduplicate by site name
    const seen = new Set<string>();
    const unique = all.filter((s) => {
      const key = s.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    this.availableSites.set(unique.filter((s) => !assignedNames.has(s.name)));
    this.loadingAvailableSites.set(false);
  }

  reloadAvailableSites() {
    this.loadAvailableSites();
  }

  assignExistingSite(site: { id: string; name: string }) {
    const vendor = this.selectedVendor();
    if (!vendor) return;
    const currentIds = vendor.siteIds ? [...vendor.siteIds] : [];
    // Avoid duplicate
    if (currentIds.includes(site.id)) {
      this.closeAddSitePicker();
      return;
    }
    const newSiteIds = [...currentIds, site.id];
    this.api.patchVendor(vendor.id, { siteIds: newSiteIds }).subscribe({
      next: () => {
        const refreshed = { ...vendor, siteIds: newSiteIds };
        this.data.updateVendor(vendor.id, { siteIds: newSiteIds });
        this.selectedVendor.set(refreshed);
        this.toastController.create({
          message: `Site "${site.name}" assigned to vendor`,
          duration: 2000,
          color: "success",
          position: "top",
        }).then(t => t.present());
        this.closeAddSitePicker();
      },
      error: (err) => {
        console.error("Failed to assign site", err);
        this.toastController.create({
          message: "Failed to assign site: " + (err?.error?.message || err?.message || "Unknown error"),
          duration: 4000,
          color: "danger",
          position: "top",
        }).then(t => t.present());
      },
    });
  }

  private loadCustomColumns(vendorName: string, siteName: string) {
    this.api.listVendorCustomColumns(vendorName, siteName).subscribe({
      next: (res) => {
        const cols = (res.items || []).map((c: any) => c.label as string);
        this.customColumns.set(cols);
      },
      error: () => this.customColumns.set([]),
    });
  }

  private loadBillLinks(vendorName: string, siteName: string) {
    this.api.listMaterialBillLinks(vendorName, siteName).subscribe({
      next: (res) => {
        const map: Record<string, BillLinkEntry> = {};
        for (const it of (res.items || []) as Array<{ materialId: string; billUrl: string; billLabel?: string }>) {
          map[it.materialId] = { materialId: it.materialId, billUrl: it.billUrl, billLabel: it.billLabel };
        }
        this.billLinks.set(map);
      },
      error: () => this.billLinks.set({}),
    });
  }

  billLinkFor(materialId: string): BillLinkEntry | undefined {
    return this.billLinks()[materialId];
  }

  draftBillLink(materialId: string): string {
    return this.draftBillLinks()[materialId] ?? "";
  }

  setDraftBillLink(materialId: string, value: string) {
    this.draftBillLinks.update((state) => ({ ...state, [materialId]: value }));
  }

  shortLinkLabel(url: string): string {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return url.length > 24 ? url.slice(0, 24) + "…" : url;
    }
  }

  isDataUrl(url: string): boolean {
    return url.startsWith("data:");
  }

  openImagePreview(url: string) {
    this.previewImageUrl.set(url);
  }

  closeImagePreview() {
    this.previewImageUrl.set(null);
  }

  commitBillLink(materialId: string, value: string) {
    const vendor = this.selectedVendor();
    const site = this.selectedSite();
    if (!vendor || !site) return;
    const trimmed = value.trim();
    const existing = this.billLinks()[materialId];
    if (!trimmed) {
      if (existing) {
        this.api.removeMaterialBillLink(vendor.name, site.name, materialId).subscribe({
          next: () => {
            this.billLinks.update((state) => {
              const next = { ...state };
              delete next[materialId];
              return next;
            });
          },
        });
      }
      this.draftBillLinks.update((state) => {
        const next = { ...state };
        delete next[materialId];
        return next;
      });
      return;
    }
    this.api.upsertMaterialBillLink({
      vendorName: vendor.name,
      siteName: site.name,
      materialId,
      billUrl: trimmed,
    }).subscribe({
      next: (res) => {
        const link = res.link;
        this.billLinks.update((state) => ({
          ...state,
          [materialId]: { materialId, billUrl: link.billUrl, billLabel: link.billLabel },
        }));
        this.draftBillLinks.update((state) => {
          const next = { ...state };
          delete next[materialId];
          return next;
        });
      },
      error: () => {},
    });
  }

  addMaterialRow() {
    const vendor = this.selectedVendor();
    const site = this.selectedSite();
    if (!vendor || !site) {
      this.toastController.create({
        message: "Please select a vendor and site first",
        duration: 3000,
        color: "warning",
        position: "top",
      }).then(t => t.present());
      return;
    }
    const payload: Partial<MaterialRow> = {
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
      requestDate: new Date().toISOString().slice(0, 10),
      purchasedDate: new Date().toISOString().slice(0, 10),
      issuedAmount: 0,
      givenAmount: 0,
      paymentType: "Cash",
      deliveredOn: "",
    };
    this.materialsService.createMaterial(payload).subscribe({
      next: (material) => {
        this.editingRowId.set(material.id);
        this.nameError.set(null);
      },
      error: (err) => {
        this.toastController.create({
          message: "Failed to create material row: " + (err?.message || "Unknown error"),
          duration: 4000,
          color: "danger",
          position: "top",
        }).then(t => t.present());
      },
    });
  }

  editRow(row: MaterialRow) {
    this.editingRowId.set(row.id);
    this.nameError.set(null);
  }

  saveRow(row: MaterialRow) {
    if (!row.name?.trim()) {
      this.nameError.set("Material name is required");
      return;
    }
    this.editingRowId.set(null);
    this.nameError.set(null);
    this.materialsService.updateMaterial(row.id, row).subscribe({
      error: (err) => console.error("Failed to save material row:", err),
    });
  }

  deleteRow(materialId: string) {
    if (!confirm("Delete this material entry?")) return;
    this.materialsService.removeMaterial(materialId).subscribe({
      error: (err) => console.error("Failed to delete material row:", err),
    });
  }

  updateField(row: MaterialRow, field: string, value: any) {
    const patch: Partial<MaterialRow> = { [field]: value };
    this.materialsService.updateMaterial(row.id, patch).subscribe({
      error: (err) => console.error("Failed to update material field:", err),
    });
  }

  addCustomColumn() {
    const name = this.newColumnName().trim();
    if (!name) return;
    const vendor = this.selectedVendor();
    const site = this.selectedSite();
    if (!vendor || !site) return;
    if (this.customColumns().includes(name)) return;
    const columnKey = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `col-${Date.now()}`;
    this.customColumns.update(cols => [...cols, name]);
    this.newColumnName.set("");
    this.showAddColumnInput.set(false);
    this.api.addVendorCustomColumn({
      vendorName: vendor.name,
      siteName: site.name,
      columnKey,
      label: name,
    }).subscribe({ error: () => {} });
  }

  removeCustomColumn(colName: string) {
    const vendor = this.selectedVendor();
    const site = this.selectedSite();
    if (!vendor || !site) return;
    const columnKey = colName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    this.customColumns.update(cols => cols.filter(c => c !== colName));
    if (columnKey) {
      this.api.removeVendorCustomColumn(vendor.name, site.name, columnKey).subscribe({ error: () => {} });
    }
  }

  refreshFromBackend() {
    this.loadVendorsFromBackend();
  }

  vendorInitials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "V";
  }

  statusBadgeClass(status: string): string {
    return (status || "not-received").toLowerCase().replace(/\s+/g, "-");
  }

  async createVendor(value: VendorFormValue) {
    if (!value.name || !value.materialType || !value.phone || !value.gst || !value.address) {
      const toast = await this.toastController.create({
        message: "Please fill all required fields before saving",
        duration: 3000,
        color: "warning",
        position: "top",
      });
      await toast.present();
      return;
    }

    const statusValue: VendorStatus = value.status === "Not Active" ? "Not Active" : "Active";

    const payload = {
      name: value.name,
      materialType: value.materialType,
      phone: value.phone,
      address: value.address,
      gstNumber: value.gst,
      status: statusValue,
      siteIds: value.siteIds || [],
    };

    try {
      const res = await this.api.createVendor(payload).toPromise();
      const vendorId = res?.vendorId || res?._id || res?.id;
      const serverSiteIds = Array.isArray(res?.siteIds)
        ? res.siteIds.map((id: any) => String(id))
        : (value.siteIds || []).map((id) => String(id));

      this.data.addVendor({
        id: vendorId,
        name: value.name,
        materialType: value.materialType,
        phone: value.phone,
        address: value.address,
        gst: value.gst,
        status: statusValue,
        siteIds: serverSiteIds,
        _id: res?._id,
      } as Vendor);

      this.showVendorForm.set(false);
      this.refreshSiteAssignments();

      const toast = await this.toastController.create({
        message: "Vendor created successfully",
        duration: 2000,
        color: "success",
        position: "top",
      });
      await toast.present();
    } catch (err: any) {
      console.error("Failed to create vendor", err);
      const msg = this.formatVendorError(err);
      const toast = await this.toastController.create({
        message: msg,
        duration: 5000,
        color: "danger",
        position: "top",
      });
      await toast.present();
    }
  }

  private formatVendorError(err: any): string {
    const errorBody = err?.error;
    if (errorBody?.details && typeof errorBody.details === "object") {
      const entries = Object.entries(errorBody.details as Record<string, unknown>);
      const messages: string[] = [];
      for (const [field, val] of entries) {
        if (Array.isArray(val)) {
          for (const item of val) {
            const text = typeof item === "string" ? item : item?.message || JSON.stringify(item);
            messages.push(`${field}: ${text}`);
          }
        } else if (val) {
          const text = typeof val === "string" ? val : (val as any)?.message || JSON.stringify(val);
          messages.push(`${field}: ${text}`);
        }
      }
      if (messages.length) return messages.join("; ");
    }
    if (errorBody?.details && Array.isArray(errorBody.details)) {
      const text = (errorBody.details as any[])
        .map((d) => typeof d === "string" ? d : d?.message || JSON.stringify(d))
        .join("; ");
      if (text) return text;
    }
    return errorBody?.message || err?.message || "Failed to save vendor. Please check your input.";
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
      status: vendor.status === "Not Active" ? "Not Active" : "Active",
      siteIds: (vendor as any).siteIds || [],
    };
  }

  async updateVendor(value: VendorFormValue) {
    const vendor = this.editingVendor();
    if (!vendor || !value.name || !value.materialType || !value.phone || !value.gst || !value.address) {
      if (!vendor) return;
      const toast = await this.toastController.create({
        message: "Please fill all required fields before saving",
        duration: 3000,
        color: "warning",
        position: "top",
      });
      await toast.present();
      return;
    }

    const statusValue: VendorStatus = value.status === "Not Active" ? "Not Active" : "Active";

    const payload = {
      name: value.name,
      materialType: value.materialType,
      phone: value.phone,
      address: value.address,
      gstNumber: value.gst,
      status: statusValue,
      siteIds: value.siteIds || [],
    };

    try {
      const res = await this.api.patchVendor(vendor.id, payload).toPromise();
      const serverSiteIds = Array.isArray(res?.siteIds)
        ? res.siteIds.map((id: any) => String(id))
        : (value.siteIds || []).map((id) => String(id));

      this.data.updateVendor(vendor.id, {
        ...value,
        status: statusValue,
        siteIds: serverSiteIds,
      });
      const refreshed = this.data.vendors().find((v) => v.id === vendor.id);
      if (refreshed) this.selectedVendor.set(refreshed);
      this.closeVendorForm();
      this.refreshSiteAssignments();

      const toast = await this.toastController.create({
        message: "Vendor updated successfully",
        duration: 2000,
        color: "success",
        position: "top",
      });
      await toast.present();
    } catch (err: any) {
      console.error("Failed to update vendor", err);
      const msg = this.formatVendorError(err);
      const toast = await this.toastController.create({
        message: msg,
        duration: 5000,
        color: "danger",
        position: "top",
      });
      await toast.present();
    }
  }

  deleteVendor(vendorId: string) {
    if (!confirm("Delete this vendor?")) return;
    this.data.vendors.update((list) => list.filter((v) => v.id !== vendorId));
    if (this.selectedVendor()?.id === vendorId) {
      this.selectedVendor.set(null);
      this.selectedSite.set(null);
    }
    this.api.deleteVendor(vendorId).subscribe({
      error: (err) => {
        console.error("Failed to delete vendor on backend", err);
      },
    });
  }

  trackVendor(_: number, vendor: Vendor) {
    return vendor.id;
  }
}


