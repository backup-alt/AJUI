import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";

export type ClientFormValue = {
  name: string;
  mobile: string;
  address: string;
  supervisor: string;
  status?: "Active" | "On Hold" | "Completed";
};

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
            <span>Assigned Supervisor</span>
            <input name="supervisor" required [value]="initialValue?.supervisor || ''" placeholder="Supervisor name" />
          </label>
          <label>
            <span>Status</span>
            <select name="status" [value]="initialValue?.status || 'Active'">
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientFormDialogComponent {
  @Input() eyebrow = "Client Setup";
  @Input() title = "Add New Client";
  @Input() description = "Create the client record first. Projects, ledgers, and site records stay separated under this client.";
  @Input() submitLabel = "Create Client";
  @Input() initialValue: ClientFormValue | null = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<ClientFormValue>();

  submit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const status = formData.get("status") as string || "Active";

    this.create.emit({
      name: String(formData.get("name") ?? "").trim(),
      mobile: String(formData.get("mobile") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      supervisor: String(formData.get("supervisor") ?? "").trim(),
      status: status as "Active" | "On Hold" | "Completed",
    });
  }
}
