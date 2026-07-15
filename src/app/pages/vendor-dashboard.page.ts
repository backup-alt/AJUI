import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import { Vendor, ErpDataService } from "../data/erp-data.service";
import type { MaterialRow } from "../../data/dashboardData";
import { ApiService } from "../core/api.service";
import { MaterialsService } from "../core/materials.service";
import { VendorFormDialogComponent, type VendorFormValue } from "../shared/vendor-form-dialog.component";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";

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

                <article
                  *ngFor="let vendor of vendors(); trackBy: trackVendor"
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
              </section>
            } @else if (!selectedSite()) {
              <section class="vendor-breadcrumb">
                <button type="button" class="back-btn" (click)="backToVendors()">&larr; Vendors</button>
                <h2>{{ selectedVendor()!.name }} – Sites</h2>
              </section>
              <section class="client-grid">
                <article
                  *ngFor="let site of vendorSites(); trackBy: trackSite"
                  class="client-card"
                  role="button"
                  tabindex="0"
                  (click)="openSite(site)"
                  (keydown.enter)="openSite(site)"
                >
                  <div class="client-card-body">
                    <div class="card-head">
                      <div class="identity">
                        <ion-icon name="location-outline" class="site-icon"></ion-icon>
                        <div>
                          <h3>{{ site }}</h3>
                          <p>{{ siteMaterialsCount(site) }} material entries</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
                <div *ngIf="vendorSites().length === 0" class="empty-state">
                  <p>No sites with material purchases for this vendor.</p>
                </div>
              </section>
            } @else {
              <section class="vendor-breadcrumb">
                <button type="button" class="back-btn" (click)="backToSites()">&larr; {{ selectedVendor()!.name }}</button>
                <h2>{{ selectedVendor()!.name }} – {{ selectedSite() }}</h2>
              </section>
              <section class="table-wrap operations-table approvals-table">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Unit</th>
                      <th>Requested</th>
                      <th>Approved</th>
                      <th>Purchased</th>
                      <th>Consumed</th>
                      <th>PO Number</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of siteMaterials(); trackBy: trackMaterial">
                      <td><strong>{{ row.name }}</strong></td>
                      <td>{{ row.unit }}</td>
                      <td>{{ row.requested }}</td>
                      <td>{{ row.approved }}</td>
                      <td>{{ row.purchased }}</td>
                      <td>{{ row.consumed }}</td>
                      <td>{{ row.poNumber }}</td>
                      <td><span class="approval-status-pill">{{ row.status }}</span></td>
                    </tr>
                    <tr *ngIf="siteMaterials().length === 0">
                      <td class="empty-row" colspan="8"><span>No material purchases recorded for this site.</span></td>
                    </tr>
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
    .site-icon {
      font-size: 24px;
      color: #2c5cff;
    }
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 32px;
      color: #64748b;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDashboardPage {
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);
  private readonly materialsService = inject(MaterialsService);
  readonly showVendorForm = signal(false);
  readonly editingVendor = signal<Vendor | null>(null);
  readonly vendors = this.data.vendors;
  readonly refreshing = signal(false);
  readonly refreshMessage = signal<string | null>(null);

  constructor() {
    this.materialsService.getAll();
    this.refreshFromBackend();
  }

  readonly selectedVendor = signal<Vendor | null>(null);
  readonly selectedSite = signal<string | null>(null);

  readonly vendorSites = computed(() => {
    const vendor = this.selectedVendor();
    if (!vendor) return [] as string[];
    const set = new Set<string>();
    for (const m of this.data.materials()) {
      if (m.vendor === vendor.name && m.site) set.add(m.site);
    }
    return Array.from(set).sort();
  });

  readonly siteMaterials = computed(() => {
    const vendor = this.selectedVendor();
    const site = this.selectedSite();
    if (!vendor || !site) return [] as MaterialRow[];
    return this.data.materials().filter((m) => m.vendor === vendor.name && m.site === site);
  });

  siteMaterialsCount(site: string): number {
    const vendor = this.selectedVendor();
    if (!vendor) return 0;
    return this.data.materials().filter((m) => m.vendor === vendor.name && m.site === site).length;
  }

  openVendor(vendor: Vendor) {
    this.selectedVendor.set(vendor);
    this.selectedSite.set(null);
  }

  openSite(site: string) {
    this.selectedSite.set(site);
  }

  backToVendors() {
    this.selectedVendor.set(null);
    this.selectedSite.set(null);
  }

  backToSites() {
    this.selectedSite.set(null);
  }

  trackSite(_: number, site: string) {
    return site;
  }

  trackMaterial(_: number, row: MaterialRow) {
    return row.id;
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
    this.data.addVendor(value);
    this.showVendorForm.set(false);
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
    this.data.updateVendor(vendor.id, value);
    this.closeVendorForm();
  }

  trackVendor(_: number, vendor: Vendor) {
    return vendor.id;
  }
}
