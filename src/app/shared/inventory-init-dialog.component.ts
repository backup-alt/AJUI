import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";
import { ApiService } from "../core/api.service";

export type InventoryInitSite = { id: string; name: string };

export type InventoryInitMaterialRow = {
  name?: string;
  unit?: string;
  site?: string;
  siteId?: string;
};

@Component({
  selector: "agb-inventory-init-dialog",
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="form-overlay" role="presentation">
      <section class="erp-dialog inventory-init-dialog" role="dialog" aria-modal="true" aria-labelledby="inv-init-title">
        <div class="dialog-head">
          <div>
            <span>Add Materials</span>
            <h2 id="inv-init-title">Add a project material</h2>
            <p>Enter the material name, unit, and starting stock. New material names are saved automatically.</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close add material dialog" (click)="close()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <div class="inventory-init-body" (click)="closeMenusOnInsideClick($event)">
          @if (toast()) {
            <div class="inventory-init-toast">{{ toast() }}</div>
          }
          @if (error()) {
            <div class="inventory-init-error">{{ error() }}</div>
          }

          <div class="inventory-init-field inventory-existing-toggle">
            <div>
              <strong>Existing Material</strong>
              <small>Turn this on for stock that already exists and must not be ordered through a PO.</small>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" [checked]="form().isExistingMaterial" (change)="patchForm({ isExistingMaterial: $any($event.target).checked })" />
              <span aria-hidden="true"></span>
              <em>{{ form().isExistingMaterial ? 'Yes' : 'No' }}</em>
            </label>
          </div>

          <div class="inventory-init-field" [class.has-error]="!!fieldErrors()['name']">
            <label class="inventory-init-label">
              <span>Material Name <em class="required">*</em></span>
            </label>
            <div class="erp-select-menu" [class.open]="openMenu() === 'material'">
              <button type="button" class="erp-select-trigger" (click)="toggleMenu('material')" aria-haspopup="listbox" [attr.aria-expanded]="openMenu() === 'material'">
                <span>{{ form().name || 'Choose or type a new material name' }}</span>
                <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                  <path d="M5.5 7.5 10 12l4.5-4.5" />
                </svg>
              </button>
              <div class="erp-select-panel" *ngIf="openMenu() === 'material'">
                <input
                  type="text"
                  class="inventory-init-menu-search"
                  placeholder="Search or type a new name…"
                  (click)="$event.stopPropagation()"
                  (input)="menuSearch.set($any($event.target).value); $event.stopPropagation()"
                  [value]="menuSearch()"
                  autocomplete="off"
                />
                <button
                  *ngFor="let name of filteredMaterialNames(); track name"
                  type="button"
                  [class.selected]="form().name === name"
                  (click)="pickFromMenu('name', name)"
                >{{ name }}</button>
                @if (menuSearch().trim() && !filteredMaterialNames().includes(menuSearch().trim())) {
                  <button type="button" class="inventory-init-menu-confirm" (click)="commitFreeText('name')">
                    Use "{{ menuSearch().trim() }}"
                  </button>
                }
                <div *ngIf="filteredMaterialNames().length === 0 && !menuSearch().trim()" class="inventory-init-menu-empty">Type to add a new material name.</div>
              </div>
            </div>
            @if (fieldErrors()['name']) {
              <small class="inventory-init-field-error">{{ fieldErrors()['name'] }}</small>
            }
          </div>

          <div class="inventory-init-field" [class.has-error]="!!fieldErrors()['unit']">
            <label class="inventory-init-label">
              <span>Unit <em class="required">*</em></span>
            </label>
            <div class="erp-select-menu" [class.open]="openMenu() === 'unit'">
              <button type="button" class="erp-select-trigger" (click)="toggleMenu('unit')" aria-haspopup="listbox" [attr.aria-expanded]="openMenu() === 'unit'">
                <span>{{ form().unit || 'Choose or type a unit' }}</span>
                <svg viewBox="0 0 20 20" aria-hidden="true" class="svg-icon">
                  <path d="M5.5 7.5 10 12l4.5-4.5" />
                </svg>
              </button>
              <div class="erp-select-panel" *ngIf="openMenu() === 'unit'">
                <input
                  type="text"
                  class="inventory-init-menu-search"
                  placeholder="Search or type a custom unit…"
                  (click)="$event.stopPropagation()"
                  (input)="menuSearch.set($any($event.target).value); $event.stopPropagation()"
                  [value]="menuSearch()"
                  autocomplete="off"
                />
                <button
                  *ngFor="let u of filteredUnits(); track u"
                  type="button"
                  [class.selected]="form().unit === u"
                  (click)="pickFromMenu('unit', u)"
                >{{ u }}</button>
                @if (menuSearch().trim() && !filteredUnits().includes(menuSearch().trim())) {
                  <button type="button" class="inventory-init-menu-confirm" (click)="commitFreeText('unit')">
                    Use "{{ menuSearch().trim() }}"
                  </button>
                }
              </div>
            </div>
            @if (fieldErrors()['unit']) {
              <small class="inventory-init-field-error">{{ fieldErrors()['unit'] }}</small>
            }
          </div>

          <div class="inventory-init-field" [class.has-error]="!!fieldErrors()['quantity']">
            <label class="inventory-init-label">
              <span>Quantity / Current Stock <em class="required">*</em></span>
              <input
                type="number"
                min="0"
                step="0.01"
                class="inventory-init-input"
                [value]="form().quantity"
                (input)="patchForm({ quantity: $any($event.target).value })"
                [class.input-error]="!!fieldErrors()['quantity']"
              />
            </label>
            @if (fieldErrors()['quantity']) {
              <small class="inventory-init-field-error">{{ fieldErrors()['quantity'] }}</small>
            }
          </div>

          @if (!form().isExistingMaterial) {
            <div class="inventory-amount-grid">
              <div class="inventory-init-field">
                <label class="inventory-init-label">
                  <span>Issued Amount</span>
                  <input type="number" min="0" step="0.01" class="inventory-init-input" [value]="form().issuedAmount" (input)="patchForm({ issuedAmount: $any($event.target).value })" />
                </label>
              </div>
              <div class="inventory-init-field">
                <label class="inventory-init-label">
                  <span>Given Amount</span>
                  <input type="number" min="0" step="0.01" class="inventory-init-input" [value]="form().givenAmount" (input)="patchForm({ givenAmount: $any($event.target).value })" />
                </label>
              </div>
            </div>
          } @else {
            <div class="existing-material-note">Issued and given amount: <strong>Existing material</strong></div>
          }

          <div class="inventory-init-field">
            <label class="inventory-init-label">
              <span>Remarks</span>
              <textarea
                class="inventory-init-input inventory-init-textarea"
                rows="3"
                placeholder="Optional notes"
                [value]="form().remarks"
                (input)="patchForm({ remarks: $any($event.target).value })"
              ></textarea>
            </label>
          </div>
        </div>

        <div class="dialog-actions">
          <button type="button" class="secondary-action" (click)="close()" [disabled]="saving()">Cancel</button>
          <button
            type="button"
            class="primary-action"
            (click)="submit()"
            [disabled]="!canSubmit()"
          >
            {{ saving() ? 'Saving…' : 'Save Material' }}
          </button>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .form-overlay {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      z-index: 1000;
    }
    .erp-dialog.inventory-init-dialog {
      width: min(560px, 100%);
      max-height: 90vh;
      overflow-y: auto;
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.25);
      padding: 0;
      display: flex; flex-direction: column;
    }
    .inventory-init-dialog .dialog-head {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 16px;
      padding: 20px 24px;
      border-bottom: 1px solid #eef0f3;
    }
    .inventory-init-dialog .dialog-head span {
      display: inline-block;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: #6b7280;
    }
    .inventory-init-dialog .dialog-head h2 {
      margin: 4px 0 6px;
      font-size: 20px; font-weight: 700;
      color: #0f172a;
    }
    .inventory-init-dialog .dialog-head p {
      margin: 0;
      font-size: 13px;
      color: #4b5563;
      max-width: 38ch;
    }
    .inventory-init-dialog .icon-button {
      background: #f3f4f6; border: none;
      width: 32px; height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      color: #4b5563;
    }
    .inventory-init-dialog .icon-button ion-icon { font-size: 18px; }
    .inventory-init-body {
      padding: 20px 24px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .inventory-init-field {
      display: flex; flex-direction: column; gap: 6px;
    }
    .inventory-existing-toggle {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border: 1px solid #dbe4f0;
      border-radius: 10px;
      background: #f8fafc;
    }
    .inventory-existing-toggle strong { display: block; color: #0f172a; font-size: 13px; }
    .inventory-existing-toggle small { display: block; color: #64748b; font-size: 11px; margin-top: 3px; }
    .toggle-switch { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
    .toggle-switch input { position: absolute; opacity: 0; pointer-events: none; }
    .toggle-switch > span { width: 38px; height: 22px; border-radius: 999px; background: #cbd5e1; position: relative; transition: .2s; }
    .toggle-switch > span::after { content: ""; width: 16px; height: 16px; border-radius: 50%; background: #fff; position: absolute; left: 3px; top: 3px; transition: .2s; box-shadow: 0 1px 3px rgba(15,23,42,.3); }
    .toggle-switch input:checked + span { background: #002263; }
    .toggle-switch input:checked + span::after { transform: translateX(16px); }
    .toggle-switch em { min-width: 22px; font-size: 12px; font-style: normal; font-weight: 700; color: #334155; }
    .inventory-amount-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .existing-material-note { padding: 10px 12px; border-radius: 9px; background: #eff6ff; color: #475569; font-size: 12px; }
    .inventory-init-field.has-error .inventory-init-label > span { color: #b91c1c; }
    .inventory-init-label > span {
      font-size: 12px; font-weight: 700;
      color: #374151;
      letter-spacing: 0.02em;
    }
    .inventory-init-label em.required {
      color: #b91c1c; font-style: normal;
      margin-left: 2px;
    }
    .inventory-init-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      font-size: 14px;
      color: #0f172a;
      background: #ffffff;
      box-sizing: border-box;
    }
    .inventory-init-input.input-error { border-color: #b91c1c; }
    .inventory-init-textarea { resize: vertical; min-height: 72px; font-family: inherit; }
    .erp-select-menu { position: relative; }
    .erp-select-trigger {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      background: #ffffff;
      font-size: 14px;
      color: #0f172a;
      display: flex; align-items: center; justify-content: space-between;
      cursor: pointer;
      text-align: left;
    }
    .erp-select-trigger svg { width: 14px; height: 14px; }
    .erp-select-menu.open .erp-select-trigger { border-color: #002263; }
    .erp-select-panel {
      position: absolute; left: 0; right: 0; top: calc(100% + 4px);
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
      padding: 8px;
      max-height: 240px; overflow-y: auto;
      z-index: 5;
    }
    .inventory-init-menu-search {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 6px;
      box-sizing: border-box;
    }
    .erp-select-panel button {
      display: block; width: 100%;
      text-align: left;
      padding: 8px 10px;
      border: none; background: transparent;
      border-radius: 8px;
      font-size: 13px;
      color: #0f172a;
      cursor: pointer;
    }
    .erp-select-panel button:hover { background: #f3f4f6; }
    .erp-select-panel button.selected { background: #e0e7ff; color: #002263; font-weight: 600; }
    .inventory-init-menu-confirm {
      background: #002263 !important;
      color: #ffffff !important;
      margin-top: 4px;
      font-weight: 600;
    }
    .inventory-init-menu-confirm:hover { background: #001a4d !important; }
    .inventory-init-menu-empty {
      padding: 10px;
      font-size: 13px;
      color: #6b7280;
    }
    .inventory-init-menu-empty--friendly {
      background: #fef9c3;
      border-radius: 8px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .inventory-init-menu-empty-help {
      font-size: 12px;
      color: #6b7280;
    }
    .inventory-init-site-count {
      font-size: 11px; color: #6b7280;
    }
    .inventory-init-toast {
      background: #ecfdf5; color: #047857;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 13px; font-weight: 600;
    }
    .inventory-init-error {
      background: #fef2f2; color: #b91c1c;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 13px; font-weight: 600;
    }
    .inventory-init-field-error {
      color: #b91c1c;
      font-size: 12px;
      font-weight: 600;
    }
    .dialog-actions {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid #eef0f3;
    }
    .secondary-action, .primary-action {
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .secondary-action {
      background: #ffffff;
      color: #374151;
      border-color: #d1d5db;
    }
    .primary-action {
      background: #002263;
      color: #ffffff;
    }
    .secondary-action:disabled, .primary-action:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class InventoryInitDialogComponent {
  private readonly api = inject(ApiService);

  @Input() set sites(value: InventoryInitSite[]) {
    this._sites = value || [];
    if (!this.form().siteId && this._sites.length) {
      this.patchForm({ siteId: this.presetSiteId || this._sites[0].id });
    }
  }
  get sites(): InventoryInitSite[] {
    return this._sites;
  }
  private _sites: InventoryInitSite[] = [];

  @Input() set materialNames(value: string[]) {
    this._materialNames = (value || []).slice().sort();
  }
  get materialNames(): string[] {
    return this._materialNames;
  }
  private _materialNames: string[] = [];

  @Input() set materialRows(value: InventoryInitMaterialRow[]) {
    this._materialRows = value || [];
  }
  get materialRows(): InventoryInitMaterialRow[] {
    return this._materialRows;
  }
  private _materialRows: InventoryInitMaterialRow[] = [];

  @Input() presetSiteId = "";
  @Input() projectId = "";

  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly form = signal<{ siteId: string; name: string; unit: string; quantity: number; isExistingMaterial: boolean; issuedAmount: number; givenAmount: number; remarks: string }>({
    siteId: "",
    name: "",
    unit: "",
    quantity: 0,
    isExistingMaterial: false,
    issuedAmount: 0,
    givenAmount: 0,
    remarks: "",
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);
  readonly openMenu = signal<"" | "site" | "material" | "unit">("");
  readonly menuSearch = signal("");
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly allowedUnits = ["Nos", "Bag", "Kg", "Ton", "Load", "Cubic Feet", "Cubic Meter", "Meter", "Litre", "Roll", "Bundle", "Piece", "Box"];

  readonly filteredSites = computed(() => {
    const term = this.menuSearch().trim().toLowerCase();
    return this._sites.filter((s) => !term || s.name.toLowerCase().includes(term));
  });

  readonly filteredMaterialNames = computed(() => {
    const term = this.menuSearch().trim().toLowerCase();
    if (!term) return this._materialNames;
    return this._materialNames.filter((n) => n.toLowerCase().includes(term));
  });

  readonly filteredUnits = computed(() => {
    const term = this.menuSearch().trim().toLowerCase();
    if (!term) return this.allowedUnits;
    return this.allowedUnits.filter((u) => u.toLowerCase().includes(term));
  });

  readonly selectedSiteName = computed(() => {
    const id = this.form().siteId;
    if (!id) return "";
    return this._sites.find((s) => s.id === id)?.name || "";
  });

  trackSiteById = (_: number, site: InventoryInitSite) => site.id;

  init() {
    this.error.set(null);
    this.toast.set(null);
    this.fieldErrors.set({});
    this.openMenu.set("");
    this.menuSearch.set("");
    this.form.set({
      siteId: this.presetSiteId || "",
      name: "",
      unit: "",
      quantity: 0,
      isExistingMaterial: false,
      issuedAmount: 0,
      givenAmount: 0,
      remarks: "",
    });
  }

  close() {
    this.error.set(null);
    this.toast.set(null);
    this.fieldErrors.set({});
    this.openMenu.set("");
    this.menuSearch.set("");
    this.form.set({ siteId: "", name: "", unit: "", quantity: 0, isExistingMaterial: false, issuedAmount: 0, givenAmount: 0, remarks: "" });
    this.cancelled.emit();
  }

  patchForm(patch: Partial<{ siteId: string; name: string; unit: string; quantity: number; isExistingMaterial: boolean; issuedAmount: number; givenAmount: number; remarks: string }>) {
    this.form.update((form) => ({ ...form, ...patch }));
    if (patch.name !== undefined || patch.unit !== undefined || patch.quantity !== undefined || patch.siteId !== undefined) {
      if (this.error()) this.error.set(null);
      if (Object.keys(this.fieldErrors()).length) this.fieldErrors.set({});
    }
  }

  toggleMenu(key: "site" | "material" | "unit") {
    if (this.openMenu() === key) {
      this.openMenu.set("");
      this.menuSearch.set("");
      return;
    }
    this.openMenu.set(key);
    this.menuSearch.set("");
  }

  pickFromMenu(field: "siteId" | "name" | "unit", value: string) {
    if (field === "name") {
      this.patchForm({ name: value, unit: this.preferredUnitForMaterial(value) });
    } else if (field === "siteId") {
      const current = this.form();
      this.patchForm({
        siteId: value,
        unit: current.name ? this.preferredUnitForMaterial(current.name, value) || current.unit : current.unit,
      });
    } else {
      this.patchForm({ unit: value });
    }
    this.openMenu.set("");
    this.menuSearch.set("");
  }

  commitFreeText(field: "name" | "unit") {
    const value = this.menuSearch().trim();
    if (!value) return;
    if (field === "name") {
      this.patchForm({ name: value, unit: this.preferredUnitForMaterial(value) });
    } else {
      this.patchForm({ unit: value });
    }
    this.openMenu.set("");
    this.menuSearch.set("");
  }

  private preferredUnitForMaterial(name: string, siteId = this.form().siteId): string {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) return "";
    const siteName = this._sites.find((s) => s.id === siteId)?.name.trim().toLowerCase();
    const candidates = this._materialRows.filter(
      (row) =>
        String(row?.name || "").trim().toLowerCase() === normalizedName &&
        String(row?.unit || "").trim(),
    );
    const siteMatch = candidates.find(
      (row) =>
        String(row?.siteId || "") === siteId ||
        (siteName && String(row?.site || "").trim().toLowerCase() === siteName),
    );
    return String((siteMatch || candidates[0])?.unit || "").trim();
  }

  closeMenusOnInsideClick(event: Event) {
    const target = event.target as HTMLElement | null;
    if (target && target.closest(".erp-select-menu, .filter-combo-field")) return;
    if (this.openMenu()) {
      this.openMenu.set("");
      this.menuSearch.set("");
    }
  }

  canSubmit(): boolean {
    const f = this.form();
    return Boolean(f.siteId) && f.name.trim().length > 0 && f.unit.trim().length > 0 && !this.saving();
  }

  submit() {
    const form = this.form();
    const fieldErrors: Record<string, string> = {};
    if (!form.siteId) fieldErrors["siteId"] = "This project has no inventory scope configured.";
    const name = form.name.trim();
    const unit = form.unit.trim();
    if (!name) fieldErrors["name"] = "Material name is required.";
    if (!unit) fieldErrors["unit"] = "Unit is required.";
    const quantity = Number(form.quantity) || 0;
    if (quantity < 0) fieldErrors["quantity"] = "Quantity cannot be negative.";
    if (Object.keys(fieldErrors).length) {
      this.fieldErrors.set(fieldErrors);
      this.error.set("Please fix the highlighted fields.");
      return;
    }
    const remarks = form.remarks.trim() || undefined;
    const payload = {
      siteId: form.siteId,
      projectId: this.projectId || undefined,
      name,
      unit,
      quantity,
      isExistingMaterial: form.isExistingMaterial,
      issuedAmount: form.isExistingMaterial ? undefined : Math.max(0, Number(form.issuedAmount) || 0),
      givenAmount: form.isExistingMaterial ? undefined : Math.max(0, Number(form.givenAmount) || 0),
      remarks,
    };
    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    this.api.addInventoryMaterial(payload).subscribe({
      next: (res: any) => {
        this.saving.set(false);
        const created = res?.created !== false;
        this.toast.set(created ? "Material added." : "Existing material updated.");
        this.saved.emit();
        setTimeout(() => {
          this.close();
        }, 1200);
      },
      error: (err) => {
        this.saving.set(false);
        const serverFieldErrors = err?.error?.details?.fieldErrors;
        if (serverFieldErrors && typeof serverFieldErrors === "object") {
          const mapped: Record<string, string> = {};
          for (const [field, errs] of Object.entries(serverFieldErrors)) {
            if (Array.isArray(errs) && errs.length) {
              mapped[field] = String(errs[0]);
            }
          }
          if (Object.keys(mapped).length) {
            this.fieldErrors.set(mapped);
            this.error.set("Please fix the highlighted fields.");
            return;
          }
        }
        const detail = err?.error?.error || err?.error?.message || err?.message;
        this.error.set(
          detail && detail !== "Validation failed" ? detail : "Failed to save material. Check your inputs and try again.",
        );
      },
    });
  }
}
