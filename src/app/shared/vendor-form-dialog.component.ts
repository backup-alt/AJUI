import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";

export type VendorFormValue = {
  name: string;
  materialType: string;
  phone: string;
  address: string;
  gst: string;
};

@Component({
  selector: "agb-vendor-form-dialog",
  standalone: true,
  imports: [CommonModule, IonIcon],
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

          <div class="dialog-actions span-2">
            <button type="button" class="secondary-action" (click)="cancel.emit()">Cancel</button>
            <button type="submit" class="primary-action">{{ submitLabel }}</button>
          </div>
        </form>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorFormDialogComponent {
  @Input() eyebrow = "Vendor Setup";
  @Input() title = "Add New Vendor";
  @Input() description = "Create the vendor record to track material purchases, PO numbers, and payment history.";
  @Input() submitLabel = "Create Vendor";
  @Input() initialValue: VendorFormValue | null = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<VendorFormValue>();

  submit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    this.create.emit({
      name: String(formData.get("name") ?? "").trim(),
      materialType: String(formData.get("materialType") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      gst: String(formData.get("gst") ?? "").trim(),
    });
  }
}