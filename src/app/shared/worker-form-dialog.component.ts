import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonIcon } from "@ionic/angular/standalone";
import { SearchableSelectComponent } from "./searchable-select.component";

export type WorkerFormValue = {
  name: string;
  phone: string;
  labourType: string;
  address: string;
  notes: string;
  subcontractorId: string;
  subcontractorName: string;
};

const PRESET_LABOUR_TYPES = [
  "Bar bender",
  "Carpenter",
  "Centring",
  "Concrete worker",
  "Construction labourer",
  "Electrician",
  "Fitter",
  "Foreman",
  "Helper",
  "Machine operator",
  "Mason",
  "Painter",
  "Plumber",
  "Scaffolder",
  "Site engineer",
  "Surveyor",
  "Tile mason",
  "Welder",
];

@Component({
  selector: "agb-worker-form-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, SearchableSelectComponent],
  template: `
    <div class="form-overlay" role="presentation">
      <section class="erp-dialog" role="dialog" aria-modal="true" aria-labelledby="worker-form-title">
        <div class="dialog-head">
          <div>
            <span>{{ eyebrow }}</span>
            <h2 id="worker-form-title">{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close worker form" (click)="cancel.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form class="erp-form" (submit)="submit($event)">
          <label>
            <span>Name</span>
            <input name="name" [(ngModel)]="nameValue" placeholder="Worker full name" required />
          </label>
          <label>
            <span>Phone</span>
            <input name="phone" [(ngModel)]="phoneValue" placeholder="+91 98765 43210" />
          </label>
          <label class="role-field">
            <span>Role</span>
            <agb-searchable-select
              name="labourType"
              [(ngModel)]="labourTypeValue"
              [options]="labourTypeOptions()"
              [allowCustom]="true"
              placeholder="Search or enter a construction role"
            ></agb-searchable-select>
          </label>
          <label>
            <span>Subcontractor</span>
            <agb-searchable-select
              name="subcontractorId"
              [(ngModel)]="subcontractorIdValue"
              [options]="subcontractorSelectOptions()"
              placeholder="Search subcontractors"
            ></agb-searchable-select>
          </label>
          <label class="span-2">
            <span>Address</span>
            <textarea
              name="address"
              [(ngModel)]="addressValue"
              rows="2"
              placeholder="Door no, street, area, city"
            ></textarea>
          </label>
          <label class="span-2">
            <span>Notes</span>
            <textarea
              name="notes"
              [(ngModel)]="notesValue"
              rows="2"
              placeholder="Any remarks about this worker"
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
    :host { display: contents; }
    .role-field { position: relative; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkerFormDialogComponent implements OnInit {
  @Input() eyebrow = "Worker Setup";
  @Input() title = "Add New Worker";
  @Input() description = "Create the worker record and assign it to a subcontractor for this project.";
  @Input() submitLabel = "Add Worker";
  @Input() initialValue: WorkerFormValue | null = null;
  @Input() submitting = false;
  @Input() subcontractorOptions: Array<{ id: string; name: string }> = [];
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<WorkerFormValue>();

  // Local mirror state for ngModel — typed manually so the dialog doesn't
  // depend on the parent for two-way binding.
  nameValue = "";
  phoneValue = "";
  labourTypeValue = "";
  addressValue = "";
  notesValue = "";
  subcontractorIdValue = "";
  readonly validationError = signal<string | null>(null);

  ngOnInit() {
    if (this.initialValue) {
      this.nameValue = this.initialValue.name || "";
      this.phoneValue = this.initialValue.phone || "";
      this.labourTypeValue = this.initialValue.labourType || "";
      this.addressValue = this.initialValue.address || "";
      this.notesValue = this.initialValue.notes || "";
      this.subcontractorIdValue = this.initialValue.subcontractorId || "";
    }
  }

  /** Construction-only roles shown by the worker form. */
  labourTypeOptions(): string[] {
    return [...PRESET_LABOUR_TYPES].sort((a, b) => a.localeCompare(b));
  }

  subcontractorSelectOptions() {
    return this.subcontractorOptions.map((option) => ({ label: option.name, value: option.id }));
  }

  submit(event: Event) {
    event.preventDefault();
    const name = this.nameValue.trim();
    if (!name) {
      this.validationError.set("Worker name is required.");
      return;
    }
    const labourType = this.labourTypeValue.trim();
    if (!labourType) {
      this.validationError.set("Role is required.");
      return;
    }
    const subcontractor = this.subcontractorOptions.find((option) => option.id === this.subcontractorIdValue);
    if (!subcontractor) {
      this.validationError.set("Subcontractor is required.");
      return;
    }
    this.validationError.set(null);
    this.create.emit({
      name,
      phone: this.phoneValue.trim(),
      labourType,
      address: this.addressValue.trim(),
      notes: this.notesValue.trim(),
      subcontractorId: subcontractor.id,
      subcontractorName: subcontractor.name,
    });
  }
}
