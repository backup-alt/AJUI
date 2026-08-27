import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonIcon } from "@ionic/angular/standalone";
import { ErpDataService } from "../data/erp-data.service";
import { SearchableSelectComponent } from "./searchable-select.component";

const COMMON_VENDOR_MATERIALS = [
  "AAC Blocks",
  "Adhesives",
  "Aggregate",
  "Aluminium",
  "Bricks",
  "Cement",
  "Construction Chemicals",
  "Doors",
  "Electrical Materials",
  "Fasteners",
  "Glass",
  "Granite",
  "Hardware",
  "M-Sand",
  "Marble",
  "Paint",
  "P-Sand",
  "Pipes and Fittings",
  "Plumbing Materials",
  "Plywood",
  "Ready-Mix Concrete",
  "River Sand",
  "Roofing Sheets",
  "Safety Equipment",
  "Sanitary Ware",
  "Scaffolding",
  "Solid Blocks",
  "Steel",
  "Tiles",
  "Timber",
  "TMT Bars",
  "Waterproofing Materials",
  "Windows",
];

export type VendorFormValue = {
  name: string;
  materialType: string;
  phone: string;
  address: string;
  gst: string;
  gstType: "GST" | "Non-GST";
  status?: "Active" | "Not Active";
  siteIds?: string[];
};

@Component({
  selector: "agb-vendor-form-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, SearchableSelectComponent],
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
            <agb-searchable-select
              name="materialType"
              [(ngModel)]="materialTypeValue"
              [options]="materialTypeOptions()"
              [allowCustom]="true"
              placeholder="Search or enter a material"
            ></agb-searchable-select>
          </label>
          <label>
            <span>Phone Number</span>
            <input name="phone" [(ngModel)]="phoneValue" placeholder="+91 98765 43210" />
          </label>
          <label>
            <span>GST Registration</span>
            <agb-searchable-select name="gstType" [(ngModel)]="gstTypeValue" [options]="gstTypeOptions" />
          </label>
          <label *ngIf="gstTypeValue === 'GST'">
            <span>GST Number</span>
            <input name="gst" [(ngModel)]="gstValue" placeholder="33AABCS1402P1Z8" />
          </label>
          <label class="span-2">
            <span>Address</span>
            <textarea name="address" [(ngModel)]="addressValue" rows="3" placeholder="Door no, street, area, city"></textarea>
          </label>

          <div class="dialog-actions span-2">
            <button type="button" class="secondary-action" (click)="cancel.emit()" [disabled]="submitting">Cancel</button>
            <button type="submit" class="primary-action" [disabled]="submitting" [attr.aria-busy]="submitting ? 'true' : null">
              @if (submitting) {
                <span class="agb-loading-spinner" aria-hidden="true"></span>
              }
              {{ submitting ? 'Saving…' : submitLabel }}
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorFormDialogComponent implements OnInit {
  private readonly data = inject(ErpDataService);

  @Input() eyebrow = "Vendor Setup";
  @Input() title = "Add New Vendor";
  @Input() description = "Create the vendor record to track material purchases, GST, and payment history.";
  @Input() submitLabel = "Create Vendor";
  @Input() initialValue: VendorFormValue | null = null;
  @Input() submitting = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<VendorFormValue>();

  nameValue = "";
  materialTypeValue = "";
  phoneValue = "";
  gstValue = "";
  gstTypeValue: "GST" | "Non-GST" = "GST";
  readonly gstTypeOptions = ["GST", "Non-GST"];
  readonly materialTypeOptions = computed(() => {
    const uniqueMaterials = new Map<string, string>();
    const values = [
      ...COMMON_VENDOR_MATERIALS,
      ...this.data.materials().map((material) => material.name),
      ...this.data.vendors().map((vendor) => vendor.materialType),
    ];

    for (const value of values) {
      const materialName = String(value || "").trim();
      if (materialName) uniqueMaterials.set(materialName.toLocaleLowerCase(), materialName);
    }

    return [...uniqueMaterials.values()].sort((left, right) => left.localeCompare(right));
  });
  addressValue = "";

  ngOnInit() {
    this.nameValue = this.initialValue?.name ?? "";
    this.materialTypeValue = this.initialValue?.materialType ?? "";
    this.phoneValue = this.initialValue?.phone ?? "";
    this.gstValue = this.initialValue?.gst ?? "";
    this.gstTypeValue = this.initialValue?.gstType ?? (this.gstValue ? "GST" : "Non-GST");
    this.addressValue = this.initialValue?.address ?? "";
  }

  submit(event: Event) {
    event.preventDefault();
    this.create.emit({
      name: this.nameValue.trim(),
      materialType: this.materialTypeValue.trim(),
      phone: this.phoneValue.trim(),
      address: this.addressValue.trim(),
      gst: this.gstTypeValue === "GST" ? this.gstValue.trim() : "",
      gstType: this.gstTypeValue,
    });
  }
}
