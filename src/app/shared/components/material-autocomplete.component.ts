import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import {
  IonInput,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, closeCircle } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { SupervisorService } from '../../core/services/supervisor.service';

/**
 * Compact projection of a Material / Inventory record that the autocomplete
 * uses for autofill. Keeps the component decoupled from the full Material
 * type — callers pass only the fields they want auto-populated.
 */
export interface MaterialAutocompleteMatch {
  name: string;
  unit?: string;
  vendor?: string;
  vendorId?: string;
  poNumber?: string;
  minimumQuantity?: number | null;
  remainingStock?: number | null;
  approvedQuantity?: number | null;
}

/**
 * Reusable Material Name autocomplete.
 *
 * Behaviour matches the Inventory → Add Existing Material screen:
 *   - loads the distinct list of material names from the backend once on
 *     mount;
 *   - shows a clickable suggestion list under the input as the user types;
 *   - closes on outside click / Escape / blur;
 *   - selecting a suggestion emits `matchSelected` with the matching
 *     `MaterialAutocompleteMatch` (or `null` if the typed name doesn't
 *     match any catalog item) so the host can autofill unit / vendor /
 *     stock.
 *
 * Implements `ControlValueAccessor` so it can be used directly with
 * `[(ngModel)]` like a regular `<ion-input>`.
 */
@Component({
  selector: 'app-material-autocomplete',
  standalone: true,
  imports: [IonInput, IonIcon, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MaterialAutocompleteComponent),
      multi: true,
    },
  ],
  template: `
    <div class="search-wrap" #wrap (pointerdown)="onSearchWrapClick($event)">
      <ion-input
        #input
        class="form-input"
        [(ngModel)]="value"
        [clearInput]="true"
        [placeholder]="placeholder"
        [disabled]="disabled"
        (ionInput)="onNameInput($event)"
        (ionBlur)="onBlur()"
        (keydown.escape)="hideSuggestions()"
      ></ion-input>

      @if (filteredNames().length > 0 && showSuggestions() && !disabled) {
        <div class="suggestions-list" role="listbox">
          @for (n of filteredNames(); track n) {
            <button
              type="button"
              class="suggestion-item"
              role="option"
              (pointerdown)="onSelectSuggestion($event, n)"
            >
              <ion-icon name="search-outline"></ion-icon>
              <span class="suggestion-text">{{ n }}</span>
            </button>
          }
        </div>
      }

      @if (loading()) {
        <span class="loading-dot" aria-hidden="true"></span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .search-wrap {
      position: relative;
      width: 100%;
    }
    ion-input { width: 100%; }
    .suggestions-list {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 1000;
      background: var(--m3-surface-bright, #ffffff);
      border: 1px solid var(--m3-outline-variant, #e2e8f0);
      border-top: none;
      border-radius: 0 0 var(--md-radius-lg, 12px) var(--md-radius-lg, 12px);
      max-height: 220px;
      overflow-y: auto;
      box-shadow: var(--md-elevation-3, 0 4px 12px rgba(0, 0, 0, 0.12));
      animation: slideDown 0.15s ease;
      margin-top: -1px;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .suggestion-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 12px 16px;
      font-size: 14px;
      color: var(--m3-on-surface, #111827);
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--m3-outline-variant, #f1f5f9);
      text-align: left;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.1s ease;
    }
    .suggestion-item:last-child { border-bottom: none; }
    .suggestion-item:hover,
    .suggestion-item:focus,
    .suggestion-item:active {
      background: var(--m3-primary-container, rgba(0, 34, 99, 0.08));
      outline: none;
    }
    .suggestion-item ion-icon {
      font-size: 14px;
      color: var(--m3-on-surface-muted, #64748b);
      flex-shrink: 0;
    }
    .suggestion-text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .loading-dot {
      position: absolute;
      right: 36px;
      top: 50%;
      transform: translateY(-50%);
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--m3-primary, #2563eb);
      animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `],
})
export class MaterialAutocompleteComponent implements OnInit, OnDestroy, ControlValueAccessor {
  private supervisor = inject(SupervisorService);
  private el = inject(ElementRef<HTMLElement>);

  /** List of distinct material names + related fields used for autofill. */
  @Input() catalog: MaterialAutocompleteMatch[] = [];
  /** Placeholder text for the input. */
  @Input() placeholder = 'Search or enter material name';
  /** When true, the input is disabled and the dropdown is hidden. */
  @Input() disabled = false;
  /** Maximum number of suggestions shown. */
  @Input() maxSuggestions = 10;

  @Output() matchSelected = new EventEmitter<MaterialAutocompleteMatch | null>();
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('wrap') wrapEl?: ElementRef<HTMLDivElement>;

  /** Current input value (also accessible via ngModel). */
  value = '';
  /** Full list of names fetched from the backend. */
  materialNames = signal<string[]>([]);
  /** Subset currently shown in the suggestion list. */
  filteredNames = signal<string[]>([]);
  showSuggestions = signal(false);
  loading = signal(false);

  private subs = new Subscription();
  private selectingName = false;
  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    addIcons({ 'search-outline': searchOutline, 'close-circle': closeCircle });
    this.loadMaterialNames();
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', this.onDocClick);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', this.onDocClick);
    }
  }

  // ---------------- ControlValueAccessor ----------------

  writeValue(value: string | null | undefined): void {
    this.value = value ?? '';
  }
  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // ---------------- Event handlers ----------------

  onNameInput(event: Event): void {
    if (this.selectingName) return;
    const detail = (event as CustomEvent<{ value: string }>).detail;
    const value = (detail?.value ?? '').toLowerCase();
    this.value = detail?.value ?? '';
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.refreshSuggestions(value);
    this.showSuggestions.set(true);
    // Don't autofill on every keystroke — typing "C" would otherwise
    // match "Cement", "Cements", "Chamber Bricks" via .includes() and
    // force-populate the host form's unit/vendor/stock fields. Autofill
    // should only fire when the user actually picks a suggestion
    // (see `selectName`). Hosts that still want to react to typed text
    // can subscribe to `valueChange` and do their own lookup.
  }

  onBlur(): void {
    this.onTouched();
    // Only emit a match on blur if the typed value is an EXACT match
    // (case-insensitive). Partial matches are rejected so we don't
    // auto-populate fields for a still-being-typed name.
    const typed = this.value?.trim();
    if (typed) {
      const exact = this.catalog.find(
        (c) => c.name?.trim().toLowerCase() === typed.toLowerCase()
      );
      if (exact) this.matchSelected.emit({ ...exact });
    }
    this.hideSuggestions();
  }

  onSearchWrapClick(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.showSuggestions.set(true);
    if (this.filteredNames().length === 0) {
      this.filteredNames.set(this.materialNames().slice(0, this.maxSuggestions));
    }
  }

  onSelectSuggestion(event: Event, n: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectName(n);
  }

  hideSuggestions(): void {
    this.showSuggestions.set(false);
  }

  // ---------------- Internals ----------------

  private loadMaterialNames(): void {
    this.loading.set(true);
    this.subs.add(
      this.supervisor.getMaterialNames().subscribe({
        next: (res) => {
          const names = Array.isArray(res?.names) ? res.names : [];
          this.materialNames.set(names);
          this.filteredNames.set(names.slice(0, this.maxSuggestions));
          this.loading.set(false);
        },
        error: () => {
          this.materialNames.set([]);
          this.filteredNames.set([]);
          this.loading.set(false);
        },
      })
    );
  }

  private refreshSuggestions(lower: string): void {
    const all = this.materialNames();
    if (!lower) {
      this.filteredNames.set(all.slice(0, this.maxSuggestions));
      return;
    }
    this.filteredNames.set(
      all.filter((n) => n.toLowerCase().includes(lower)).slice(0, this.maxSuggestions)
    );
  }

  private selectName(n: string): void {
    this.selectingName = true;
    this.value = n;
    this.onChange(n);
    this.valueChange.emit(n);
    this.showSuggestions.set(false);
    this.filteredNames.set([]);
    // The user explicitly clicked this suggestion — look up the
    // catalog by EXACT name match (not .includes()) and emit the
    // autofill payload. If the host page didn't pass a catalog, or
    // there's no match, emit null so the host clears any prior fill.
    const typed = n.trim();
    if (typed) {
      const exact = this.catalog.find(
        (c) => c.name?.trim().toLowerCase() === typed.toLowerCase()
      );
      this.matchSelected.emit(exact ? { ...exact } : null);
    } else {
      this.matchSelected.emit(null);
    }
    setTimeout(() => {
      this.selectingName = false;
    }, 120);
  }

  private emitMatchForValue(): void {
    // Kept for backwards compatibility — used to be called on every
    // keystroke, which produced the over-eager autofill bug. Now only
    // `selectName` (click) and `onBlur` (exact-typed value) emit
    // matches. Hosts should subscribe to `matchSelected` and react
    // there; they shouldn't rely on keystroke-driven autofill.
    const typed = this.value?.trim();
    if (!typed) {
      this.matchSelected.emit(null);
      return;
    }
    const lower = typed.toLowerCase();
    const exact = this.catalog.find(
      (c) => c.name?.trim().toLowerCase() === lower
    );
    this.matchSelected.emit(exact ? { ...exact } : null);
  }

  private onDocClick = (event: Event): void => {
    const target = event.target as Node | null;
    const host = this.el?.nativeElement;
    if (!host || !target) return;
    if (host.contains(target)) return;
    this.hideSuggestions();
  };
}