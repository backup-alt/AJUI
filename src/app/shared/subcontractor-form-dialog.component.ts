import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonIcon } from "@ionic/angular/standalone";
import { SearchableSelectComponent } from "./searchable-select.component";

export type SubcontractorFormValue = {
  subcontractorName: string;
  address: string;
  phone: string;
  gstType: "GST" | "Non-GST";
  gstNumber: string;
  notes: string;
  status: "active" | "inactive";
};

@Component({
  selector: "agb-subcontractor-form-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, SearchableSelectComponent],
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
            <agb-searchable-select name="status" [(ngModel)]="statusValue" [options]="statusOptions" />
          </label>
          <label>
            <span>GST Registration</span>
            <span class="gst-toggle" role="group" aria-label="GST registration">
              <button type="button" [class.active]="gstTypeValue === 'GST'" (click)="gstTypeValue = 'GST'">GST</button>
              <button type="button" [class.active]="gstTypeValue === 'Non-GST'" (click)="gstTypeValue = 'Non-GST'; gstNumberValue = ''">Non-GST</button>
            </span>
          </label>
          <label *ngIf="gstTypeValue === 'GST'">
            <span>GST Number</span>
            <input name="gstNumber" [(ngModel)]="gstNumberValue" placeholder="33AABCS1402P1Z8" />
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
  styles: [`
    .gst-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 3px; border: 1px solid #cbd5e1; border-radius: 9px; background: #f8fafc; }
    .gst-toggle button { min-height: 34px; border: 0; border-radius: 6px; background: transparent; color: #64748b; font: inherit; font-weight: 700; cursor: pointer; }
    .gst-toggle button.active { background: #0f3b82; color: #fff; box-shadow: 0 1px 3px rgba(15, 23, 42, .16); }
  `],
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
  gstTypeValue: "GST" | "Non-GST" = "Non-GST";
  gstNumberValue = "";
  notesValue = "";
  readonly statusOptions = [
    { label: "Active", value: "active" },
    { label: "Not Active", value: "inactive" },
  ];
  statusValue: "active" | "inactive" = "active";
  readonly validationError = signal<string | null>(null);

  ngOnInit() {
    if (this.initialValue) {
      this.nameValue = this.initialValue.subcontractorName || "";
      this.addressValue = this.initialValue.address || "";
      this.phoneValue = this.initialValue.phone || "";
      this.gstTypeValue = this.initialValue.gstType || "Non-GST";
      this.gstNumberValue = this.initialValue.gstNumber || "";
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
    const gstNumber = this.gstNumberValue.trim().toUpperCase();
    if (this.gstTypeValue === "GST" && !gstNumber) {
      this.validationError.set("GST number is required when GST is selected.");
      return;
    }
    this.validationError.set(null);
    this.create.emit({
      subcontractorName,
      address: this.addressValue.trim(),
      phone: this.phoneValue.trim(),
      gstType: this.gstTypeValue,
      gstNumber: this.gstTypeValue === "GST" ? gstNumber : "",
      notes: this.notesValue.trim(),
      status: this.statusValue,
    });
  }
}
