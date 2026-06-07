import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Output } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";

export type ClientFormValue = {
  name: string;
  mobile: string;
  address: string;
  supervisor: string;
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
            <span>Client Setup</span>
            <h2 id="client-form-title">Add New Client</h2>
            <p>Create the client record first. Projects, ledgers, and site records stay separated under this client.</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close client form" (click)="cancel.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form class="erp-form" (submit)="submit($event)">
          <label>
            <span>Client Name</span>
            <input name="name" required placeholder="Enter client or company name" />
          </label>
          <label>
            <span>Mobile Number</span>
            <input name="mobile" required placeholder="+91 98765 43210" />
          </label>
          <label class="span-2">
            <span>Address</span>
            <textarea name="address" required rows="3" placeholder="Door no, street, area, city"></textarea>
          </label>
          <label>
            <span>Assigned Supervisor</span>
            <input name="supervisor" required placeholder="Supervisor name" />
          </label>
          <label>
            <span>Status</span>
            <input value="Active" readonly />
          </label>

          <div class="dialog-actions span-2">
            <button type="button" class="secondary-action" (click)="cancel.emit()">Cancel</button>
            <button type="submit" class="primary-action">Create Client</button>
          </div>
        </form>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientFormDialogComponent {
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<ClientFormValue>();

  submit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    this.create.emit({
      name: String(formData.get("name") ?? "").trim(),
      mobile: String(formData.get("mobile") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      supervisor: String(formData.get("supervisor") ?? "").trim(),
    });
  }
}
