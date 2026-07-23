import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";
import { FormsModule } from "@angular/forms";
import { ErpDataService, type Site, type VendorStatus } from "../data/erp-data.service";
import { ApiService } from "../core/api.service";

export type VendorFormValue = {
  name: string;
  materialType: string;
  phone: string;
  address: string;
  gst: string;
  status: VendorStatus;
  siteIds: string[];
};

@Component({
  selector: "agb-vendor-form-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon],
  template: `
    <div class="form-overlay" role="presentation">
      <section class="erp-dialog" role="dialog" aria-modal="true" aria-labelledby="vendor-form-title">
        <div class="dialog-head">
          <div>
            <span>{{ eyebrow }}</span>
            <h2 id="vendor-form-title">{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close vendor form" (click)="cancel.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form class="erp-form" (submit)="submit($event)">
          <label>
            <span>Vendor Name</span>
            <input name="name" [(ngModel)]="nameValue" placeholder="Enter vendor or company name" />
          </label>
          <label>
            <span>Material Type</span>
            <input name="materialType" [(ngModel)]="materialTypeValue" placeholder="e.g. Cement, Bricks, Steel" />
          </label>
          <label>
            <span>Phone Number</span>
            <input name="phone" [(ngModel)]="phoneValue" placeholder="+91 98765 43210" />
          </label>
          <label>
            <span>GST Number</span>
            <input name="gst" [(ngModel)]="gstValue" placeholder="33AABCS1402P1Z8" />
          </label>
          <label class="span-2">
            <span>Address</span>
            <textarea name="address" [(ngModel)]="addressValue" rows="3" placeholder="Door no, street, area, city"></textarea>
          </label>
          <label class="span-2">
            <span>Status</span>
            <select name="status" [(ngModel)]="statusValue" class="form-select">
              <option value="Active">Active</option>
              <option value="Not Active">Not Active</option>
            </select>
          </label>

          <label class="span-2">
            <span>Site Assigned</span>
            <div class="site-field">
              <div class="site-chips">
                @for (siteId of selectedSiteIds; track siteId) {
                  @let site = siteName(siteId);
                  <span class="site-chip">
                    {{ site || siteId }}
                    <button type="button" class="chip-remove" (click)="toggleSite(siteId)" aria-label="Remove site">×</button>
                  </span>
                }
                @if (selectedSiteIds.length === 0) {
                  <span class="site-chip-empty">No site assigned</span>
                }
                <button type="button" class="site-add-btn" (click)="showPicker.set(true)">
                  <ion-icon name="add-outline"></ion-icon> Add Site
                </button>
              </div>
            </div>
          </label>

          <div class="dialog-actions span-2">
            <button type="button" class="secondary-action" (click)="cancel.emit()">Cancel</button>
            <button type="submit" class="primary-action">{{ submitLabel }}</button>
          </div>
        </form>
      </section>
    </div>

    @if (showPicker()) {
      <div class="picker-overlay" role="presentation" (click)="closePicker($event)">
        <div class="picker-panel" role="dialog" aria-modal="true" aria-labelledby="picker-title">
          <div class="picker-head">
            <h3 id="picker-title">Assign Sites</h3>
            <button type="button" class="icon-button" aria-label="Close" (click)="showPicker.set(false)">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <div class="picker-list">
            @if (unselectedSites().length === 0) {
              <p class="picker-empty">All sites are already assigned.</p>
            }
            @for (site of unselectedSites(); track site.id) {
              <button type="button" class="picker-row" (click)="pickSite(site.id)">
                <div class="picker-row-info">
                  <ion-icon name="location-outline"></ion-icon>
                  <span>{{ site.name }}</span>
                </div>
                <ion-icon name="add-circle-outline"></ion-icon>
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .req { color: #dc2626; }

    .site-field { padding: 6px 0; }
    .site-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 36px; }
    .site-chip {
      display: inline-flex; align-items: center; gap: 4px;
      background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe;
      border-radius: 16px; padding: 3px 10px; font-size: 12px; font-weight: 500;
    }
    .chip-remove {
      background: none; border: none; cursor: pointer; color: #1d4ed8;
      font-size: 14px; line-height: 1; padding: 0; display: flex; align-items: center;
    }
    .chip-remove:hover { color: #dc2626; }
    .site-chip-empty { font-size: 12px; color: #94a3b8; font-style: italic; }
    .site-add-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: none; border: 1.5px dashed #94a3b8; color: #64748b;
      border-radius: 16px; padding: 3px 10px; font-size: 12px; cursor: pointer;
    }
    .site-add-btn:hover { border-color: #2c5cff; color: #2c5cff; }
    .site-add-btn ion-icon { font-size: 14px; }

    .picker-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 10000;
      display: flex; align-items: flex-start; justify-content: center; padding: 60px 20px;
    }
    .picker-panel {
      background: #fff; border-radius: 10px; width: 100%; max-width: 380px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25); overflow: hidden;
    }
    .picker-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid #e2e8f0;
    }
    .picker-head h3 { margin: 0; font-size: 15px; color: #1a2540; }
    .picker-list { max-height: 320px; overflow-y: auto; }
    .picker-row {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; padding: 11px 18px; background: none; border: none;
      border-bottom: 1px solid #f1f5f9; cursor: pointer; text-align: left;
    }
    .picker-row:hover { background: #f8fafc; }
    .picker-row:last-child { border-bottom: none; }
    .picker-row-info { display: flex; align-items: center; gap: 8px; }
    .picker-row-info ion-icon { color: #64748b; font-size: 18px; }
    .picker-row-info span { font-size: 14px; color: #1a2540; }
    .picker-row ion-icon:last-child { color: #2c5cff; font-size: 20px; }
    .picker-empty { padding: 20px 18px; color: #94a3b8; font-size: 13px; text-align: center; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorFormDialogComponent implements OnInit {
  @Input() eyebrow = "Vendor Setup";
  @Input() title = "Add New Vendor";
  @Input() description = "Create the vendor record to track material purchases, PO numbers, and payment history.";
  @Input() submitLabel = "Create Vendor";
  @Input() initialValue: VendorFormValue | null = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<VendorFormValue>();

  private readonly data = inject(ErpDataService);
  private readonly api = inject(ApiService);

  statusValue: VendorStatus = "Active";
  nameValue = "";
  materialTypeValue = "";
  phoneValue = "";
  gstValue = "";
  addressValue = "";
  readonly selectedSiteIds: string[] = [];
  readonly showPicker = signal(false);

  readonly allSiteEntities = this.data.siteEntities;

  readonly unselectedSites = computed(() => {
    const entities = this.allSiteEntities();
    const source = entities.length > 0
      ? entities
      : this.data.sites().map(s => ({ id: s.id, name: s.name } as Site));
    return source.filter((s) => !this.selectedSiteIds.includes(s.id));
  });

  async ngOnInit() {
    // Load sites from backend first so siteEntities is populated for name lookup
    await this.loadSitesFromBackend();

    this.statusValue = this.initialValue?.status ?? "Active";
    this.nameValue = this.initialValue?.name ?? "";
    this.materialTypeValue = this.initialValue?.materialType ?? "";
    this.phoneValue = this.initialValue?.phone ?? "";
    this.gstValue = this.initialValue?.gst ?? "";
    this.addressValue = this.initialValue?.address ?? "";
    if (this.initialValue?.siteIds?.length) {
      this.selectedSiteIds.push(...this.initialValue.siteIds);
    }
  }

  private async loadSitesFromBackend(): Promise<void> {
    try {
      const res = await this.api.listSites().toPromise();
      const sites = (res?.items || []).map((s: any) => ({
        id: s._id || s.id,
        _id: s._id,
        siteId: s.siteId,
        name: s.name,
        status: s.status || "Active",
        supervisor: s.supervisor,
        startDate: s.startDate,
        targetEndDate: s.targetEndDate,
        projectIds: s.projectIds || [],
      })) as Site[];
      // Only update if we got results and it's different from current
      if (sites.length > 0) {
        this.data.siteEntities.set(sites);
      }
    } catch (e) {
      console.warn("Failed to load sites from backend for vendor dialog", e);
    }
  }

  siteName(id: string): string {
    if (!id) return "Unassigned site";

    const entities = this.allSiteEntities();
    const directMatch = entities.find((s) =>
      s._id === id || s.id === id || s.siteId === id
    );
    if (directMatch?.name) return directMatch.name;

    const projectMatch = this.findSiteInProjects(id);
    if (projectMatch) return projectMatch;

    const materialMatch = this.findSiteInMaterials(id);
    if (materialMatch) return materialMatch;

    return `Site (${id.slice(0, 8)}...)`;
  }

  private findSiteInProjects(id: string): string | null {
    for (const project of this.data.projects()) {
      if (project?.id === id && project.name) return project.name;
      // Check siteIds array (may contain ObjectId strings)
      const siteIds = (project as any)?.siteIds;
      if (Array.isArray(siteIds) && siteIds.includes(id)) {
        // Try to find matching site name from siteNames array
        const siteNames = (project as any)?.siteNames;
        const idx = siteIds.indexOf(id);
        if (Array.isArray(siteNames) && siteNames[idx]) return siteNames[idx];
        if (project.name) return project.name;
      }
      if (Array.isArray(project?.sites)) {
        for (const siteName of project.sites) {
          if (siteName === id) return siteName;
        }
      }
    }
    return null;
  }

  private findSiteInMaterials(id: string): string | null {
    try {
      const materials = this.data.materials?.() ?? [];
      const match = materials.find((m: any) => m?.site === id || m?.siteId === id);
      if (match?.site) return match.site;
    } catch {}
    return null;
  }

  toggleSite(id: string) {
    const idx = this.selectedSiteIds.indexOf(id);
    if (idx >= 0) {
      this.selectedSiteIds.splice(idx, 1);
    } else {
      this.selectedSiteIds.push(id);
    }
  }

  pickSite(id: string) {
    if (!this.selectedSiteIds.includes(id)) {
      this.selectedSiteIds.push(id);
    }
    if (this.unselectedSites().length === 0) {
      this.showPicker.set(false);
    }
  }

  closePicker(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains("picker-overlay")) {
      this.showPicker.set(false);
    }
  }

  submit(event: Event) {
    event.preventDefault();
    this.create.emit({
      name: this.nameValue.trim(),
      materialType: this.materialTypeValue.trim(),
      phone: this.phoneValue.trim(),
      address: this.addressValue.trim(),
      gst: this.gstValue.trim(),
      status: this.statusValue,
      siteIds: this.selectedSiteIds.slice(),
    });
  }
}