import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";

export type ClientFormValue = {
  name: string;
  mobile: string;
  address: string;
  gstNumber?: string;
  state?: string;
  supervisor?: string;
  supervisorId?: string;
  status?: "Active" | "On Hold" | "Completed";
};

const INDIAN_STATES = [
  "Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana",
  "Maharashtra", "Gujarat", "Rajasthan", "Madhya Pradesh", "Uttar Pradesh",
  "Bihar", "West Bengal", "Odisha", "Punjab", "Haryana", "Delhi",
  "Chandigarh", "Goa", "Other",
];

@Component({
  selector: "agb-client-form-dialog",
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="form-overlay" role="presentation">
      <section class="erp-dialog" role="dialog" aria-modal="true" aria-labelledby="client-form-title">
        <div class="dialog-head">
          <div>
            <span>{{ eyebrow }}</span>
            <h2 id="client-form-title">{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close client form" (click)="cancel.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form class="erp-form" (submit)="submit($event)">
          <label>
            <span>Client Name</span>
            <input name="name" required [value]="initialValue?.name || ''" placeholder="Enter client or company name" />
          </label>
          <label>
            <span>Mobile Number</span>
            <input name="mobile" required [value]="initialValue?.mobile || ''" placeholder="+91 98765 43210" />
          </label>
          <label class="span-2">
            <span>Address</span>
            <textarea name="address" required rows="3" [value]="initialValue?.address || ''" placeholder="Door no, street, area, city"></textarea>
          </label>
          <label>
            <span>GSTIN</span>
            <input name="gstNumber" [value]="initialValue?.gstNumber || ''" placeholder="22AAAAA0000A1Z5" maxlength="15" />
          </label>
          <label>
            <span>State</span>
            <select name="state" [value]="initialValue?.state || ''">
              <option value="">Select state</option>
              @for (state of states; track state) {
                <option [value]="state">{{ state }}</option>
              }
            </select>
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
export class ClientFormDialogComponent {
  @Input() eyebrow = "Client Setup";
  @Input() title = "Add New Client";
  @Input() description = "Create the client record first. Projects and ledgers stay separated under this client.";
  @Input() submitLabel = "Create Client";
  @Input() initialValue: ClientFormValue | null = null;
  @Input() defaultSupervisor = "";
  @Input() submitting = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<ClientFormValue>();

  readonly states = INDIAN_STATES;

  submit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    this.create.emit({
      name: String(formData.get("name") ?? "").trim(),
      mobile: String(formData.get("mobile") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      gstNumber: String(formData.get("gstNumber") ?? "").trim(),
      state: String(formData.get("state") ?? "").trim() || undefined,
    });
  }
}
