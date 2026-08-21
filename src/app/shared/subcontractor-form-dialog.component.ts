import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonIcon } from "@ionic/angular/standalone";

export type SubcontractorFormValue = {
  subcontractorName: string;
  address: string;
  phone: string;
  paymentMode: string;
  notes: string;
  status: "active" | "inactive";
};

@Component({
  selector: "agb-subcontractor-form-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon],
  template: `
    <div class="form-overlay" role="presentation">
      <section class="erp-dialog" role="dialog" aria-modal="true" aria-labelledby="subcontractor-form-title">
        <div class="dialog-head">
          <div>
            <span>{{ eyebrow }}</span>
            <h2 id="subcontractor-form-title">{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close subcontractor form" (click)="cancel.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form class="erp-form" (submit)="submit($event)">
          <label class="span-2">
            <span>Subcontractor name</span>
            <input
              name="subcontractorName"
              [(ngModel)]="nameValue"
              placeholder="e.g. Lakshmi Electricals"
              required
            />
          </label>
          <label class="span-2">
            <span>Address</span>
            <textarea
              name="address"
              [(ngModel)]="addressValue"
              rows="2"
              placeholder="Office address"
            ></textarea>
          </label>
          <label>
            <span>Phone</span>
            <input
              name="phone"
              type="tel"
              [(ngModel)]="phoneValue"
              placeholder="+91 90000 00000"
            />
          </label>
          <label>
            <span>Status</span>
            <select name="status" [(ngModel)]="statusValue">
              <option value="active">Active</option>
              <option value="inactive">Not Active</option>
            </select>
          </label>
          <label>
            <span>Payment Mode</span>
            <select name="paymentMode" [(ngModel)]="paymentModeValue" required>
              <option *ngFor="let option of paymentModeOptions" [value]="option">{{ option }}</option>
            </select>
          </label>
          <label class="span-2">
            <span>Notes</span>
            <textarea
              name="notes"
              [(ngModel)]="notesValue"
              rows="3"
              placeholder="Any extra detail about this sub-contractor (work scope, terms, contacts, etc.)"
            ></textarea>
          </label>

          @if (validationError()) {
            <p class="form-error span-2" role="alert">{{ validationError() }}</p>
          }

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
export class SubcontractorFormDialogComponent implements OnInit {
  @Input() eyebrow = "Sub-contractor";
  @Input() title = "Add Sub-contractor";
  @Input() description = "Add a sub-contractor to the project roster. They'll show up here and on the universal sub-contractors page.";
  @Input() submitLabel = "Add sub-contractor";
  @Input() initialValue: SubcontractorFormValue | null = null;
  @Input() submitting = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<SubcontractorFormValue>();

  nameValue = "";
  addressValue = "";
  phoneValue = "";
  paymentModeValue = "Bank Transfer";
  notesValue = "";
  readonly paymentModeOptions = ["Cash", "UPI", "Bank Transfer", "NEFT", "RTGS", "IMPS", "Cheque", "Credit Card", "Debit Card", "Net Banking", "Demand Draft", "Wallet", "Other"];
  statusValue: "active" | "inactive" = "active";
  readonly validationError = signal<string | null>(null);

  ngOnInit() {
    if (this.initialValue) {
      this.nameValue = this.initialValue.subcontractorName || "";
      this.addressValue = this.initialValue.address || "";
      this.phoneValue = this.initialValue.phone || "";
      this.paymentModeValue = this.initialValue.paymentMode || "Bank Transfer";
      this.notesValue = this.initialValue.notes || "";
      this.statusValue = this.initialValue.status || "active";
    }
  }

  submit(event: Event) {
    event.preventDefault();
    const subcontractorName = this.nameValue.trim();
    if (!subcontractorName) {
      this.validationError.set("Subcontractor's name is required.");
      return;
    }
    this.validationError.set(null);
    this.create.emit({
      subcontractorName,
      address: this.addressValue.trim(),
      phone: this.phoneValue.trim(),
      paymentMode: this.paymentModeValue,
      notes: this.notesValue.trim(),
      status: this.statusValue,
    });
  }
}
