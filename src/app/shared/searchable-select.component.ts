import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, forwardRef, inject, signal } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

export type SearchableSelectOption = string | number | { label: string; value: string | number };

@Component({
  selector: "agb-searchable-select",
  standalone: true,
  imports: [CommonModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchableSelectComponent), multi: true }],
  template: `
    <div class="agb-select" [class.open]="open()" [class.disabled]="disabled">
      <input *ngIf="name" type="hidden" [attr.name]="name" [value]="currentValue" />
      <button
        type="button"
        class="agb-select-trigger"
        [disabled]="disabled"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        (click)="toggle()"
      >
        <span [class.placeholder]="!selectedLabel()">{{ selectedLabel() || placeholder }}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" /></svg>
      </button>
      @if (open()) {
        <div class="agb-select-panel" role="listbox">
          <input
            class="agb-select-search"
            type="text"
            autocomplete="off"
            [placeholder]="allowCustom ? 'Search or type a custom value' : 'Search options'"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            (keydown.enter)="commitCustom($event)"
          />
          <div class="agb-select-options">
            @for (option of filteredOptions(); track option.value) {
              <button
                type="button"
                role="option"
                [class.selected]="sameValue(option.value, currentValue)"
                [attr.aria-selected]="sameValue(option.value, currentValue)"
                (click)="choose(option.value)"
              >
                <span>{{ option.label }}</span>
                @if (sameValue(option.value, currentValue)) { <span class="check">✓</span> }
              </button>
            }
            @if (allowCustom && customCandidate(); as custom) {
              <button type="button" class="custom-option" (click)="choose(custom)">
                <span>Use “{{ custom }}”</span><strong>Custom</strong>
              </button>
            }
            @if (!filteredOptions().length && !customCandidate()) {
              <p class="empty">No matching options</p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .agb-select { position: relative; width: 100%; }
    .agb-select-trigger { display: flex; width: 100%; min-height: 42px; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; color: #0f172a; font: inherit; text-align: left; cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; }
    .agb-select-trigger:hover { border-color: #94a3b8; }
    .open .agb-select-trigger { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, .13); }
    .agb-select-trigger .placeholder { color: #64748b; }
    .agb-select-trigger svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; transition: transform .15s ease; }
    .open .agb-select-trigger svg { transform: rotate(180deg); }
    .disabled { opacity: .65; }
    .agb-select-panel { position: absolute; z-index: 1000; top: calc(100% + 6px); right: 0; left: 0; padding: 7px; border: 1px solid #d0d5dd; border-radius: 11px; background: #fff; box-shadow: 0 16px 36px rgba(15, 23, 42, .16), 0 3px 8px rgba(15, 23, 42, .08); }
    .agb-select-search { width: 100%; min-height: 38px; box-sizing: border-box; padding: 8px 10px; border: 1px solid #dbe3ee; border-radius: 7px; outline: 0; font: inherit; font-size: 13px; }
    .agb-select-search:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, .1); }
    .agb-select-options { display: grid; max-height: 230px; gap: 2px; margin-top: 6px; overflow-y: auto; }
    .agb-select-options button { display: flex; width: 100%; min-height: 38px; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border: 0; border-radius: 7px; background: transparent; color: #334155; font: inherit; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; }
    .agb-select-options button:hover { background: #f1f5f9; color: #0f172a; }
    .agb-select-options button.selected { background: #eff6ff; color: #1d4ed8; }
    .custom-option { border-top: 1px solid #e2e8f0 !important; color: #1d4ed8 !important; }
    .custom-option strong { padding: 2px 6px; border-radius: 999px; background: #dbeafe; font-size: 10px; text-transform: uppercase; }
    .check { color: #2563eb; }
    .empty { margin: 10px; color: #64748b; font-size: 12px; text-align: center; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchableSelectComponent implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  @Input() options: SearchableSelectOption[] = [];
  @Input() placeholder = "Select";
  @Input() allowCustom = false;
  @Input() name = "";
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string | number>();

  readonly open = signal(false);
  readonly search = signal("");
  currentValue: string | number = "";
  private onChange: (value: string | number) => void = () => {};
  private onTouched: () => void = () => {};

  @Input()
  set value(value: string | number | null | undefined) {
    this.currentValue = value ?? "";
  }

  normalizedOptions() {
    return this.options.map((option) => typeof option === "object"
      ? option
      : { label: String(option), value: option });
  }

  filteredOptions() {
    const query = this.search().trim().toLowerCase();
    return this.normalizedOptions().filter((option) => !query || option.label.toLowerCase().includes(query));
  }

  selectedLabel() {
    return this.normalizedOptions().find((option) => this.sameValue(option.value, this.currentValue))?.label
      || (this.currentValue !== "" ? String(this.currentValue) : "");
  }

  customCandidate() {
    const value = this.search().trim();
    if (!this.allowCustom || !value) return "";
    return this.normalizedOptions().some((option) => option.label.toLowerCase() === value.toLowerCase()) ? "" : value;
  }

  sameValue(left: string | number, right: string | number) {
    return String(left) === String(right);
  }

  toggle() {
    if (this.disabled) return;
    this.open.update((value) => !value);
    if (!this.open()) this.search.set("");
  }

  choose(value: string | number) {
    this.currentValue = value;
    this.onChange(value);
    this.onTouched();
    this.valueChange.emit(value);
    this.open.set(false);
    this.search.set("");
  }

  commitCustom(event: Event) {
    event.preventDefault();
    const custom = this.customCandidate();
    if (custom) this.choose(custom);
  }

  writeValue(value: string | number | null | undefined): void { this.currentValue = value ?? ""; }
  registerOnChange(fn: (value: string | number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  @HostListener("document:pointerdown", ["$event"])
  closeOnOutsideClick(event: PointerEvent) {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
      this.search.set("");
      this.onTouched();
    }
  }

  @HostListener("document:keydown.escape")
  closeOnEscape() {
    this.open.set(false);
    this.search.set("");
  }
}
