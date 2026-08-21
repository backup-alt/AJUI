import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, inject, signal } from "@angular/core";
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
          <label class="role-field">
            <span>Role</span>
            <div class="role-select" [class.open]="roleMenuOpen()">
              <button
                type="button"
                class="role-select-trigger"
                aria-haspopup="listbox"
                aria-controls="construction-role-options"
                [attr.aria-expanded]="roleMenuOpen()"
                (click)="roleMenuOpen.set(!roleMenuOpen())"
              >
                <span [class.placeholder]="!labourTypeValue">{{ labourTypeValue || 'Select a construction role' }}</span>
                <ion-icon name="chevron-down-outline" aria-hidden="true"></ion-icon>
              </button>
              @if (roleMenuOpen()) {
                <div id="construction-role-options" class="role-select-panel" role="listbox" aria-label="Construction roles">
                  @for (role of labourTypeOptions(); track role) {
                    <button
                      type="button"
                      role="option"
                      [class.selected]="role === labourTypeValue"
                      [attr.aria-selected]="role === labourTypeValue"
                      (click)="selectRole(role)"
                    >
                      <span>{{ role }}</span>
                      @if (role === labourTypeValue) {
                        <ion-icon name="checkmark-outline" aria-hidden="true"></ion-icon>
                      }
                    </button>
                  }
                </div>
              }
            </div>
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
  styles: [`
    :host { display: contents; }
    .role-field { position: relative; }
    .role-select { position: relative; width: 100%; }
    .role-select-trigger {
      display: flex;
      width: 100%;
      min-height: 44px;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 13px;
      border: 1px solid #cbd5e1;
      border-radius: 9px;
      background: #fff;
      color: #0f172a;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }
    .role-select-trigger:hover { border-color: #94a3b8; }
    .role-select.open .role-select-trigger {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, .13);
    }
    .role-select-trigger .placeholder { color: #64748b; }
    .role-select-trigger ion-icon { color: #475569; transition: transform 140ms ease; }
    .role-select.open .role-select-trigger ion-icon { transform: rotate(180deg); }
    .role-select-panel {
      position: absolute;
      top: calc(100% + 7px);
      right: 0;
      left: 0;
      z-index: 30;
      display: grid;
      max-height: 246px;
      gap: 2px;
      padding: 6px;
      overflow-y: auto;
      border: 1px solid #d0d5dd;
      border-radius: 11px;
      background: #fff;
      box-shadow: 0 16px 36px rgba(15, 23, 42, .16), 0 3px 8px rgba(15, 23, 42, .08);
    }
    .role-select-panel button {
      display: flex;
      width: 100%;
      min-height: 38px;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #334155;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
    }
    .role-select-panel button:hover { background: #f1f5f9; color: #0f172a; }
    .role-select-panel button.selected { background: #eff6ff; color: #1d4ed8; }
    .role-select-panel button ion-icon { font-size: 17px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkerFormDialogComponent implements OnInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
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
  readonly roleMenuOpen = signal(false);

  @HostListener("document:click", ["$event"])
  closeRoleMenuOnOutsideClick(event: MouseEvent) {
    if (this.roleMenuOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.roleMenuOpen.set(false);
    }
  }

  @HostListener("document:keydown.escape")
  closeRoleMenuOnEscape() {
    this.roleMenuOpen.set(false);
  }

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

  selectRole(role: string) {
    this.labourTypeValue = role;
    this.roleMenuOpen.set(false);
    this.validationError.set(null);
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
    if (!PRESET_LABOUR_TYPES.includes(labourType)) {
      this.validationError.set("Select one of the construction roles in the list.");
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
