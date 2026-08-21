import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonIcon } from "@ionic/angular/standalone";

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
  "Mason",
  "Helper",
  "Carpenter",
  "Plumber",
  "Electrician",
  "Painter",
  "Bar bender",
  "Welder",
  "Tile mason",
  "Centring",
  "Fitter",
  "Maid",
  "Cook",
  "Watchman",
  "Cleaner",
  "Driver",
];

@Component({
  selector: "agb-worker-form-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon],
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
          <label>
            <span>Role</span>
            <input
              name="labourType"
              list="worker-labour-types"
              [(ngModel)]="labourTypeValue"
              placeholder="Mason, Helper, Carpenter…"
              required
            />
            <datalist id="worker-labour-types">
              <option *ngFor="let role of labourTypeOptions()" [value]="role"></option>
            </datalist>
          </label>
          <label>
            <span>Subcontractor</span>
            <select name="subcontractorId" [(ngModel)]="subcontractorIdValue" required>
              <option value="">Select subcontractor</option>
              <option *ngFor="let subcontractor of subcontractorOptions" [value]="subcontractor.id">
                {{ subcontractor.name }}
              </option>
            </select>
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
  /** Optional extra role suggestions — merged with the preset list. */
  @Input() extraRoleOptions: string[] = [];
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

  /** Combined role-type suggestions — preset list plus any custom roles
   * the user has typed in elsewhere, deduplicated and sorted. */
  labourTypeOptions(): string[] {
    const merged = [...PRESET_LABOUR_TYPES, ...this.extraRoleOptions];
    return [...new Set(merged.map((role) => role.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
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
