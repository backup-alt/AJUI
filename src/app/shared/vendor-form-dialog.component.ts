import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../core/api.service";
import type { VendorStatus } from "../data/erp-data.service";

export type VendorFormValue = {
  name: string;
  materialType: string;
  phone: string;
  address: string;
  gst: string;
  status: VendorStatus;
  siteIds: string[];
};

type SiteOption = { _id: string; name: string; siteId: string };

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
            <input name="name" required [value]="initialValue?.name || ''" placeholder="Enter vendor or company name" />
          </label>
          <label>
            <span>Material Type</span>
            <input name="materialType" required [value]="initialValue?.materialType || ''" placeholder="e.g. Cement, Bricks, Steel" />
          </label>
          <label>
            <span>Phone Number</span>
            <input name="phone" required [value]="initialValue?.phone || ''" placeholder="+91 98765 43210" />
          </label>
          <label>
            <span>GST Number</span>
            <input name="gst" required [value]="initialValue?.gst || ''" placeholder="33AABCS1402P1Z8" />
          </label>
          <label class="span-2">
            <span>Address</span>
            <textarea name="address" required rows="3" [value]="initialValue?.address || ''" placeholder="Door no, street, area, city"></textarea>
          </label>
          <label class="span-2">
            <span>Site Assigned <em class="req">*</em></span>
            <div class="site-dropdown" [class.open]="siteDropdownOpen">
              <button type="button" class="site-trigger" (click)="toggleDropdown()">
                <span>{{ selectedLabel }}</span>
                <ion-icon [name]="siteDropdownOpen ? 'chevron-up-outline' : 'chevron-down-outline'"></ion-icon>
              </button>
              @if (siteDropdownOpen) {
                <div class="site-panel" (click)="$event.stopPropagation()">
                  <div class="site-search-wrap">
                    <input
                      type="text"
                      class="site-search-input"
                      placeholder="Search sites..."
                      [value]="siteSearchQuery()"
                      (input)="siteSearchQuery.set($any($event.target).value)"
                      (click)="$event.stopPropagation()"
                    />
                  </div>
                  @if (loadingSites()) {
                    <p class="site-msg">Loading sites...</p>
                  } @else if (filteredSiteOptions().length === 0) {
                    <p class="site-msg">No sites found.</p>
                  } @else {
                    @for (site of filteredSiteOptions(); track site._id) {
                      <label class="site-opt" (click)="$event.stopPropagation()">
                        <input
                          type="checkbox"
                          [attr.data-site-id]="site._id"
                          [checked]="isSelected(site._id)"
                          (change)="onSiteToggle(site._id, $any($event.target).checked)" />
                        <span>{{ site.name }}</span>
                      </label>
                    }
                  }
                </div>
              }
            </div>
            @if (siteError()) {
              <p class="field-error">{{ siteError() }}</p>
            }
          </label>
          <label class="span-2">
            <span>Status</span>
            <select name="status" required [(ngModel)]="statusValue" class="form-select">
              <option value="Active">Active</option>
              <option value="Not Active">Not Active</option>
            </select>
          </label>

          <div class="dialog-actions span-2">
            <button type="button" class="secondary-action" (click)="cancel.emit()">Cancel</button>
            <button type="submit" class="primary-action">{{ submitLabel }}</button>
          </div>
        </form>
      </section>
    </div>
  `,
  styles: [`
    .site-dropdown { position: relative; width: 100%; }
    .site-trigger {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; padding: 9px 12px;
      border: 1px solid #cbd5e1; border-radius: 6px;
      background: #fff; cursor: pointer;
      font-size: 14px; color: #1e293b; text-align: left;
    }
    .site-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .site-dropdown.open .site-trigger {
      border-color: #2c5cff;
      box-shadow: 0 0 0 3px rgba(44, 92, 255, 0.1);
    }
    .site-panel {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      background: #fff; border: 1px solid #cbd5e1; border-radius: 8px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); z-index: 100;
      max-height: 280px; overflow-y: auto; padding: 6px 0;
    }
    .site-search-wrap {
      padding: 6px 10px 4px;
      border-bottom: 1px solid #f0f4ff;
    }
    .site-search-input {
      width: 100%; padding: 7px 10px; font-size: 13px;
      border: 1px solid #e2e8f0; border-radius: 6px;
      background: #f8fafc; color: #1e293b;
      box-sizing: border-box;
    }
    .site-search-input:focus { outline: none; border-color: #2c5cff; background: #fff; }
    .site-opt {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px; cursor: pointer; font-size: 14px; color: #1e293b;
    }
    .site-opt:hover { background: #f8fafc; }
    .site-opt input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: #2c5cff; }
    .site-msg { padding: 12px 14px; color: #64748b; font-size: 13px; margin: 0; }
    .req { color: #dc2626; }
    .field-error { color: #dc2626; font-size: 12px; margin: 4px 0 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorFormDialogComponent implements OnInit {
  @Input() eyebrow = "Vendor Setup";
  @Input() title = "Add New Vendor";
  @Input() description = "Create the vendor record to track material purchases, PO numbers, and payment history.";
  @Input() submitLabel = "Create Vendor";
  @Input() initialValue: VendorFormValue | null = null;
  @Input() preSelectedSiteIds: string[] = [];
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<VendorFormValue>();

  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  statusValue: VendorStatus = "Active";
  readonly siteOptions = signal<SiteOption[]>([]);
  readonly loadingSites = signal(false);
  readonly siteError = signal<string | null>(null);
  readonly selectedSiteIds = signal<Set<string>>(new Set());
  readonly siteSearchQuery = signal("");
  readonly filteredSiteOptions = computed(() => {
    const q = this.siteSearchQuery().toLowerCase().trim();
    return this.siteOptions().filter((s) => s.name.toLowerCase().includes(q));
  });
  siteDropdownOpen = false;

  ngOnInit() {
    this.statusValue = this.initialValue?.status ?? "Active";
    const preSelected = new Set([...this.preSelectedSiteIds.map(String), ...(this.initialValue?.siteIds || []).map((id: any) => String(id))]);
    this.selectedSiteIds.set(preSelected);
    this.loadSites();
  }

  toggleDropdown() {
    this.siteDropdownOpen = !this.siteDropdownOpen;
    this.cdr.markForCheck();
  }

  private loadSites() {
    this.loadingSites.set(true);
    this.api.listSitesAdmin().subscribe({
      next: (res) => {
        this.siteOptions.set(res.sites || []);
        this.loadingSites.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.siteError.set("Failed to load sites");
        this.loadingSites.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  isSelected(id: string): boolean {
    return this.selectedSiteIds().has(id);
  }

  onSiteToggle(id: string, checked: boolean) {
    this.selectedSiteIds.update((set) => {
      const next = new Set(set);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    this.siteError.set(null);
    this.cdr.markForCheck();
  }

  get selectedLabel(): string {
    const count = this.selectedSiteIds().size;
    if (count === 0) return "Select sites...";
    const names = Array.from(this.selectedSiteIds())
      .map((id) => this.siteOptions().find((s) => String(s._id) === id)?.name)
      .filter(Boolean) as string[];
    if (names.length === 0) return "Select sites...";
    if (names.length === 1) return names[0]!;
    return `${names.length} sites selected`;
  }

  submit(event: Event) {
    event.preventDefault();
    if (this.selectedSiteIds().size === 0) {
      this.siteError.set("Please assign at least one site");
      this.cdr.markForCheck();
      return;
    }
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    this.create.emit({
      name: String(formData.get("name") ?? "").trim(),
      materialType: String(formData.get("materialType") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      gst: String(formData.get("gst") ?? "").trim(),
      status: (String(formData.get("status") ?? "Active") === "Not Active" ? "Not Active" : "Active") as VendorStatus,
      siteIds: Array.from(this.selectedSiteIds()),
    });
  }
}
