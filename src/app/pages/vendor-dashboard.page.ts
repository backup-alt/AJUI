import { CommonModule, CurrencyPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import { Vendor, ErpDataService, Site } from "../data/erp-data.service";
import type { MaterialRow } from "../../data/dashboardData";
import { ApiService } from "../core/api.service";
import { VendorFormDialogComponent, type VendorFormValue } from "../shared/vendor-form-dialog.component";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";

// Extended Site type for vendor sites with additional computed properties
type VendorSite = Site & { materialEntryCount: number; materialNames: string[] };

@Component({
  standalone: true,
  imports: [CommonModule, CurrencyPipe, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, VendorFormDialogComponent],
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
                              <span class="meta-item">{{ site.materialEntryCount }} material entries</span>
                              <span class="meta-item">{{ site.materialNames.length }} materials</span>
                            </p>
                          </div>
                        </div>
                        <ion-icon name="chevron-forward-outline" class="arrow-icon"></ion-icon>
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
              <section class="vendor-breadcrumb">
                <button type="button" class="back-btn" (click)="backToSites()">&larr; {{ selectedVendor()!.name }}</button>
                <h2>{{ selectedVendor()!.name }} – {{ selectedSite()!.name }}</h2>
              </section>

              @if (loadingMaterials()) {
                <div class="loading-indicator">
                  <span class="spinner-inline"></span>
                  <span>Loading materials…</span>
                </div>
              }

              <section class="table-wrap operations-table approvals-table">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Unit</th>
                      <th>Purchase Date</th>
                      <th>Issued Amount</th>
                      <th>Given Amount</th>
                      <th>Payment Type</th>
                      <th>Delivered On</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of siteMaterials(); track row.id) {
                      <tr>
                        <td><strong>{{ row.name }}</strong></td>
                        <td>{{ row.unit }}</td>
                        <td>{{ row.purchasedDate || '-' }}</td>
                        <td>{{ row.issuedAmount || 0 | currency:'INR' }}</td>
                        <td>{{ row.givenAmount || 0 | currency:'INR' }}</td>
                        <td>{{ row.paymentType || '-' }}</td>
                        <td>{{ row.deliveredOn || '-' }}</td>
                        <td><span class="approval-status-pill">{{ row.status }}</span></td>
                      </tr>
                    }
                    @if (siteMaterials().length === 0 && !loadingMaterials()) {
                      <tr>
                        <td class="empty-row" colspan="8"><span>No material purchases recorded for this site.</span></td>
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDashboardPage {
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);

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

  // Vendor-specific sites with full details - derived from materials
  readonly vendorSites = computed(() => {
    const vendor = this.selectedVendor();
    if (!vendor) return [] as VendorSite[];

    const materialSites = new Map<string, { count: number; materialNames: string[]; status?: string }>();
    for (const m of this.data.materials()) {
      if (m.vendor === vendor.name && m.site) {
        const existing = materialSites.get(m.site) || { count: 0, materialNames: [] };
        existing.count++;
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
