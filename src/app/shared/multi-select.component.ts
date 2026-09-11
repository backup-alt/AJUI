import { CommonModule } from "@angular/common";
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, forwardRef, inject, signal } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

export type MultiSelectOption = string | number | { label: string; value: string | number };

@Component({
  selector: "agb-multi-select",
  standalone: true,
  imports: [CommonModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MultiSelectComponent), multi: true }],
  template: `
    <div class="agb-multi-select" [class.open]="open()" [class.disabled]="disabled">
      <input *ngIf="name" type="hidden" [attr.name]="name" [value]="currentValue.join(',')" />
      <button
        #trigger
        type="button"
        class="agb-multi-select-trigger"
        [disabled]="disabled"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        (click)="toggle()"
      >
        <span [class.placeholder]="!selectedLabels().length">
          {{ selectedLabels().length ? selectedLabels().join(', ') : placeholder }}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" /></svg>
      </button>
      @if (open()) {
        <div
          #panel
          class="agb-multi-select-panel"
          [class.contained-panel]="contained"
          role="listbox"
          [attr.aria-multiselectable]="true"
          [style.top.px]="panelTop()"
          [style.left.px]="panelLeft()"
          [style.width.px]="panelWidth()"
        >
          <input
            class="agb-multi-select-search"
            type="text"
            autocomplete="off"
            [placeholder]="allowCustom ? 'Search or type a custom value' : 'Search options'"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            (keydown.enter)="commitCustom($event)"
          />
          <div class="agb-multi-select-options">
            @for (option of filteredOptions(); track option.value) {
              <button
                type="button"
                role="option"
                [class.selected]="isSelected(option.value)"
                [attr.aria-selected]="isSelected(option.value)"
                (click)="toggleOption(option.value)"
              >
                <span>{{ option.label }}</span>
                @if (isSelected(option.value)) { <span class="check">✓</span> }
              </button>
            }
            @if (allowCustom && customCandidate(); as custom) {
              <button type="button" class="custom-option" (click)="toggleOption(custom)">
                <span>Add "{{ custom }}"</span><strong>Custom</strong>
              </button>
            }
            @if (!filteredOptions().length && !customCandidate()) {
              <p class="empty">No matching options</p>
            }
          </div>
          @if (currentValue.length) {
            <div class="multi-select-actions">
              <button type="button" class="clear-all" (click)="clearAll()">Clear All</button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .agb-multi-select { position: relative; width: 100%; }
    .agb-multi-select-trigger { display: flex; width: 100%; min-height: 42px; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; color: #0f172a; font: inherit; text-align: left; cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; }
    .agb-multi-select-trigger:hover { border-color: #94a3b8; }
    .open .agb-multi-select-trigger { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, .13); }
    .agb-multi-select-trigger .placeholder { color: #64748b; }
    .agb-multi-select-trigger svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; transition: transform .15s ease; }
    .open .agb-multi-select-trigger svg { transform: rotate(180deg); }
    .disabled { opacity: .65; }
    .agb-multi-select-panel { position: fixed; z-index: 9999; padding: 7px; border: 1px solid #d0d5dd; border-radius: 11px; background: #fff; box-shadow: 0 16px 36px rgba(15, 23, 42, .16), 0 3px 8px rgba(15, 23, 42, .08); }
    .agb-multi-select-panel.contained-panel { position: absolute; top: calc(100% + 6px) !important; left: 0 !important; width: 100% !important; box-sizing: border-box; }
    .agb-multi-select-search { width: 100%; min-height: 38px; box-sizing: border-box; padding: 8px 10px; border: 1px solid #dbe3ee; border-radius: 7px; outline: 0; font: inherit; font-size: 13px; }
    .agb-multi-select-search:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, .1); }
    .agb-multi-select-options { display: grid; max-height: 230px; gap: 2px; margin-top: 6px; overflow-y: auto; }
    .agb-multi-select-options button { display: flex; width: 100%; min-height: 38px; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border: 0; border-radius: 7px; background: transparent; color: #334155; font: inherit; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; }
    .agb-multi-select-options button:hover { background: #f1f5f9; color: #0f172a; }
    .agb-multi-select-options button.selected { background: #eff6ff; color: #1d4ed8; }
    .custom-option { border-top: 1px solid #e2e8f0 !important; color: #1d4ed8 !important; }
    .custom-option strong { padding: 2px 6px; border-radius: 999px; background: #dbeafe; font-size: 10px; text-transform: uppercase; }
    .check { color: #2563eb; }
    .empty { margin: 10px; color: #64748b; font-size: 12px; text-align: center; }
    .multi-select-actions { display: flex; justify-content: flex-end; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; }
    .clear-all { padding: 6px 12px; border: 0; border-radius: 6px; background: #f1f5f9; color: #475569; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .clear-all:hover { background: #e2e8f0; color: #334155; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiSelectComponent implements ControlValueAccessor, AfterViewInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  @Input() options: MultiSelectOption[] = [];
  @Input() placeholder = "Select";
  @Input() allowCustom = false;
  @Input() name = "";
  @Input() disabled = false;
  @Input() contained = false;
  @Output() valueChange = new EventEmitter<string[]>();

  @ViewChild("trigger", { static: false }) trigger?: ElementRef<HTMLButtonElement>;

  readonly open = signal(false);
  readonly search = signal("");
  readonly panelTop = signal<number>(0);
  readonly panelLeft = signal<number>(0);
  readonly panelWidth = signal<number>(0);
  currentValue: string[] = [];
  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  @Input()
  set value(value: string[] | null | undefined) {
    this.currentValue = value ?? [];
  }

  ngAfterViewInit(): void {
    // No-op; positioning runs when the panel is opened.
  }

  private updatePanelPosition() {
    const trigger = this.trigger?.nativeElement;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 6;
    const panelHeight = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= panelHeight + margin
      ? rect.bottom + margin
      : Math.max(margin, rect.top - panelHeight - margin);
    this.panelTop.set(top);
    this.panelLeft.set(rect.left);
    this.panelWidth.set(rect.width);
  }

  normalizedOptions() {
    return this.options.map((option) => typeof option === "object"
      ? option
      : { label: String(option), value: String(option) });
  }

  filteredOptions() {
    const query = this.search().trim().toLowerCase();
    return this.normalizedOptions().filter((option) => !query || option.label.toLowerCase().includes(query));
  }

  selectedLabels() {
    const normalized = this.normalizedOptions();
    return this.currentValue
      .map(val => normalized.find(opt => String(opt.value) === String(val))?.label || val)
      .filter(Boolean);
  }

  customCandidate() {
    const value = this.search().trim();
    if (!this.allowCustom || !value) return "";
    return this.normalizedOptions().some((option) => option.label.toLowerCase() === value.toLowerCase()) ? "" : value;
  }

  isSelected(value: string | number) {
    return this.currentValue.some(v => String(v) === String(value));
  }

  toggle() {
    if (this.disabled) return;
    const willOpen = !this.open();
    this.open.set(willOpen);
    if (willOpen) {
      queueMicrotask(() => this.updatePanelPosition());
    } else {
      this.search.set("");
    }
  }

  toggleOption(value: string | number) {
    const strValue = String(value);
    const index = this.currentValue.findIndex(v => String(v) === strValue);
    if (index >= 0) {
      this.currentValue = this.currentValue.filter((_, i) => i !== index);
    } else {
      this.currentValue = [...this.currentValue, strValue];
    }
    this.onChange(this.currentValue);
    this.valueChange.emit(this.currentValue);
    this.search.set("");
  }

  clearAll() {
    this.currentValue = [];
    this.onChange(this.currentValue);
    this.onTouched();
    this.valueChange.emit(this.currentValue);
    this.open.set(false);
    this.search.set("");
  }

  commitCustom(event: Event) {
    event.preventDefault();
    const custom = this.customCandidate();
    if (custom) this.toggleOption(custom);
  }

  writeValue(value: string[] | null | undefined): void {
    this.currentValue = value ?? [];
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  @HostListener("document:pointerdown", ["$event"])
  closeOnOutsideClick(event: PointerEvent) {
    const host = this.elementRef.nativeElement;
    const panel = (event.target as HTMLElement | null)?.closest?.(".agb-multi-select-panel");
    if (this.open() && !host.contains(event.target as Node) && !panel) {
      this.open.set(false);
      this.search.set("");
      this.onTouched();
    }
  }

  @HostListener("window:resize")
  @HostListener("window:scroll")
  repositionOnMove() {
    if (this.open()) this.updatePanelPosition();
  }

  @HostListener("document:keydown.escape")
  closeOnEscape() {
    this.open.set(false);
    this.search.set("");
  }
}
