import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  signal,
} from "@angular/core";

export type CalendarMode = "single" | "range";

export interface CalendarDay {
  date: Date;
  day: number;
  iso: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  disabled: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number; // 0-11
  label: string; // "March 2026"
  weeks: CalendarDay[][];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

@Component({
  selector: "agb-calendar-popup",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="calendar-root" role="dialog" aria-label="Choose dates">
      <div class="calendar-tabs" role="tablist" aria-label="Date selection mode">
        <button
          type="button"
          role="tab"
          class="calendar-tab"
          [class.active]="mode() === 'single'"
          [attr.aria-selected]="mode() === 'single'"
          (click)="setMode('single')"
        >Single date</button>
        <button
          type="button"
          role="tab"
          class="calendar-tab"
          [class.active]="mode() === 'range'"
          [attr.aria-selected]="mode() === 'range'"
          (click)="setMode('range')"
        >Date range</button>
      </div>

      @if (mode() === "single") {
        <div class="calendar-pane">
          <div class="calendar-readout">
            <small>Selected date</small>
            <strong>{{ singleReadout() }}</strong>
          </div>
        </div>
      } @else {
        <div class="calendar-pane">
          <div class="calendar-readout range">
            <div>
              <small>From</small>
              <strong>{{ rangeFromReadout() }}</strong>
            </div>
            <span class="readout-arrow" aria-hidden="true">→</span>
            <div>
              <small>To</small>
              <strong>{{ rangeToReadout() }}</strong>
            </div>
          </div>
        </div>
      }

      <div class="calendar-months" [class.dual]="mode() === 'range'">
        @for (month of visibleMonths(); track month.label) {
          <section class="calendar-month" [attr.aria-label]="month.label">
            <header class="calendar-month-header">
              <button
                type="button"
                class="calendar-nav prev"
                aria-label="Previous month"
                [disabled]="!canGoBack(month)"
                (click)="shiftMonth(month, -1)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>
              </button>
              <h3>{{ month.label }}</h3>
              <button
                type="button"
                class="calendar-nav next"
                aria-label="Next month"
                [disabled]="!canGoForward(month)"
                (click)="shiftMonth(month, 1)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
              </button>
            </header>

            <div class="calendar-weekdays" aria-hidden="true">
              @for (weekday of weekdayLabels; track weekday) {
                <span>{{ weekday }}</span>
              }
            </div>

            <div class="calendar-grid" role="grid">
              @for (week of month.weeks; track $index) {
                @for (day of week; track day.iso) {
                  <button
                    type="button"
                    role="gridcell"
                    class="calendar-day"
                    [class.muted]="!day.inCurrentMonth"
                    [class.today]="day.isToday"
                    [class.disabled]="day.disabled"
                    [class.selected]="isSelected(day)"
                    [class.range-start]="isRangeStart(day)"
                    [class.range-end]="isRangeEnd(day)"
                    [class.in-range]="isInRange(day)"
                    [attr.aria-selected]="isSelected(day)"
                    [attr.aria-disabled]="day.disabled"
                    [attr.aria-label]="dayAriaLabel(day)"
                    [disabled]="day.disabled"
                    (click)="onPickDay(day)"
                  >
                    <span>{{ day.day }}</span>
                  </button>
                }
              }
            </div>
          </section>
        }
      </div>

      <footer class="calendar-footer">
        <div class="calendar-quick">
          <button type="button" class="quick-action" (click)="setToday()">Today</button>
          <button type="button" class="quick-action" (click)="clearSelection()">Clear</button>
          <button type="button" class="quick-action" (click)="setLast7()">Last 7 days</button>
          <button type="button" class="quick-action" (click)="setThisMonth()">This month</button>
        </div>
        <div class="calendar-actions">
          <button type="button" class="cal-btn cal-btn-ghost" (click)="cancel.emit()">Cancel</button>
          <button
            type="button"
            class="cal-btn cal-btn-primary"
            [disabled]="!canApply()"
            (click)="applySelection()"
          >Apply filter</button>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; }
    * { box-sizing: border-box; }
    .calendar-root {
      display: grid;
      gap: 14px;
      width: 100%;
      max-width: 640px;
      padding: 16px;
      border: 1px solid #d0d5dd;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 18px 40px rgba(16, 24, 40, 0.17), 0 4px 10px rgba(16, 24, 40, 0.08);
      color: #101828;
      font-family: var(--ion-font-family, Inter, ui-sans-serif, system-ui, sans-serif);
      font-size: 13px;
    }
    svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .calendar-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 4px;
      border-radius: 10px;
      background: #f2f4f7;
    }
    .calendar-tab {
      min-height: 36px;
      padding: 7px 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #667085;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
    }
    .calendar-tab:hover { color: #344054; }
    .calendar-tab.active {
      background: #ffffff;
      color: #175cd3;
      box-shadow: 0 1px 3px rgba(16, 24, 40, 0.12);
    }

    .calendar-pane { padding: 2px 4px; }
    .calendar-readout {
      display: inline-flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 14px;
      border: 1px dashed #d0d5dd;
      border-radius: 10px;
      background: #f9fafb;
    }
    .calendar-readout small { color: #667085; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .calendar-readout strong { color: #101828; font-size: 14px; font-weight: 700; }
    .calendar-readout.range { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: center; width: 100%; }
    .calendar-readout.range > div { display: grid; gap: 4px; }
    .calendar-readout.range > div:last-child { text-align: right; }
    .readout-arrow { color: #98a2b3; font-size: 16px; }

    .calendar-months {
      display: grid;
      gap: 16px;
    }
    .calendar-months.dual { grid-template-columns: 1fr 1fr; }
    @media (max-width: 720px) {
      .calendar-months.dual { grid-template-columns: 1fr; }
      .calendar-root { max-width: 100%; }
    }

    .calendar-month {
      display: grid;
      gap: 8px;
    }
    .calendar-month-header {
      display: grid;
      grid-template-columns: 32px 1fr 32px;
      align-items: center;
      gap: 6px;
    }
    .calendar-month-header h3 {
      margin: 0;
      text-align: center;
      color: #101828;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .calendar-nav {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid #e4e7ec;
      border-radius: 8px;
      background: #ffffff;
      color: #344054;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }
    .calendar-nav:hover:not(:disabled) { background: #f2f4f7; border-color: #d0d5dd; color: #101828; }
    .calendar-nav:disabled { opacity: 0.4; cursor: not-allowed; }

    .calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
      color: #98a2b3;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .calendar-weekdays span { text-align: center; padding: 6px 0; }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }

    .calendar-day {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      padding: 0;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: #344054;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }
    .calendar-day span { position: relative; z-index: 1; }
    .calendar-day:hover:not(.disabled):not(.selected) {
      background: #f2f4f7;
      color: #101828;
    }
    .calendar-day.muted { color: #cbd5e1; }
    .calendar-day.today:not(.selected) {
      color: #175cd3;
      font-weight: 700;
    }
    .calendar-day.today:not(.selected)::after {
      content: "";
      position: absolute;
      bottom: 4px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #175cd3;
    }
    .calendar-day.disabled {
      color: #cbd5e1;
      cursor: not-allowed;
      text-decoration: line-through;
      text-decoration-color: #cbd5e1;
    }
    .calendar-day.selected,
    .calendar-day.range-start,
    .calendar-day.range-end {
      background: #175cd3;
      color: #ffffff;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(23, 92, 211, 0.25);
    }
    .calendar-day.in-range {
      background: #eef4ff;
      color: #175cd3;
      border-radius: 0;
    }
    .calendar-day.range-start { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .calendar-day.range-end { border-top-left-radius: 0; border-bottom-left-radius: 0; }
    .calendar-day.range-start.range-end { border-radius: 8px; }

    .calendar-footer {
      display: grid;
      gap: 12px;
      padding-top: 10px;
      border-top: 1px solid #eaecf0;
    }
    .calendar-quick {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .quick-action {
      min-height: 32px;
      padding: 6px 11px;
      border: 1px solid #e4e7ec;
      border-radius: 999px;
      background: #ffffff;
      color: #344054;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    }
    .quick-action:hover { background: #f2f4f7; color: #101828; border-color: #d0d5dd; }

    .calendar-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .cal-btn {
      min-height: 38px;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
    }
    .cal-btn-ghost { border: 1px solid #d0d5dd; background: #ffffff; color: #344054; }
    .cal-btn-ghost:hover { background: #f9fafb; }
    .cal-btn-primary {
      border: 1px solid #175cd3;
      background: #175cd3;
      color: #ffffff;
      box-shadow: 0 2px 5px rgba(23, 92, 211, 0.18);
    }
    .cal-btn-primary:hover:not(:disabled) { background: #1849a9; border-color: #1849a9; }
    .cal-btn-primary:disabled {
      border-color: #d0d5dd;
      background: #e4e7ec;
      color: #98a2b3;
      box-shadow: none;
      cursor: not-allowed;
    }
  `],
})
export class CalendarPopupComponent {
  @Input() set initialSingle(value: string | null | undefined) {
    const iso = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toIsoDate(new Date());
    this.singleSelection.set(iso);
  }
  @Input() set initialRangeFrom(value: string | null | undefined) {
    const iso = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
    this.rangeFrom.set(iso);
  }
  @Input() set initialRangeTo(value: string | null | undefined) {
    const iso = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
    this.rangeTo.set(iso);
  }
  @Input() set initialMode(value: CalendarMode | null | undefined) {
    this.mode.set(value === "range" ? "range" : "single");
  }
  @Input() maxDate: string | null = null; // ISO date string, defaults to today

  @Output() cancel = new EventEmitter<void>();
  @Output() apply = new EventEmitter<{ mode: CalendarMode; single?: string; from?: string; to?: string }>();

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly mode = signal<CalendarMode>("single");
  readonly singleSelection = signal<string>(toIsoDate(new Date()));
  readonly rangeFrom = signal<string>("");
  readonly rangeTo = signal<string>("");

  // Left-month anchor. When in dual mode we render [anchor, anchor + 1].
  readonly anchorYear = signal<number>(new Date().getFullYear());
  readonly anchorMonth = signal<number>(new Date().getMonth());

  readonly effectiveMax = computed<string>(() => {
    if (this.maxDate && /^\d{4}-\d{2}-\d{2}$/.test(this.maxDate)) return this.maxDate;
    return toIsoDate(new Date());
  });

  readonly visibleMonths = computed<CalendarMonth[]>(() => {
    const months: CalendarMonth[] = [];
    const anchors = this.mode() === "range"
      ? [{ year: this.anchorYear(), month: this.anchorMonth() }, this.nextMonth(this.anchorYear(), this.anchorMonth())]
      : [{ year: this.anchorYear(), month: this.anchorMonth() }];
    for (const a of anchors) {
      months.push(this.buildMonth(a.year, a.month));
    }
    return months;
  });

  readonly singleReadout = computed(() => this.formatLongDate(this.singleSelection()));
  readonly rangeFromReadout = computed(() => this.rangeFrom() ? this.formatLongDate(this.rangeFrom()) : "Select start");
  readonly rangeToReadout = computed(() => this.rangeTo() ? this.formatLongDate(this.rangeTo()) : "Select end");

  setMode(mode: CalendarMode): void {
    this.mode.set(mode);
    // Snap anchor so both months make sense
    if (mode === "range") {
      // If the current anchor is in the future relative to max, pull it back
      const max = this.effectiveMax();
      const anchorIso = `${this.anchorYear()}-${String(this.anchorMonth() + 1).padStart(2, "0")}-01`;
      if (anchorIso > max) {
        const today = new Date(`${max}T00:00:00`);
        this.anchorYear.set(today.getFullYear());
        this.anchorMonth.set(today.getMonth());
      }
    }
  }

  shiftMonth(month: CalendarMonth, direction: -1 | 1): void {
    const next = direction === 1
      ? this.nextMonth(month.year, month.month)
      : this.prevMonth(month.year, month.month);
    this.anchorYear.set(next.year);
    this.anchorMonth.set(next.month);
  }

  canGoBack(month: CalendarMonth): boolean {
    // Always allow going backwards in time
    return !(month.year === 1970 && month.month === 0);
  }

  canGoForward(month: CalendarMonth): boolean {
    if (!month.weeks.length) return false;
    const lastDay = month.weeks[month.weeks.length - 1].slice().reverse().find((d) => d.inCurrentMonth) ?? month.weeks[month.weeks.length - 1].at(-1)!;
    if (lastDay.iso > this.effectiveMax()) return false;
    return lastDay.iso <= this.effectiveMax();
  }

  onPickDay(day: CalendarDay): void {
    if (day.disabled) return;
    if (this.mode() === "single") {
      this.singleSelection.set(day.iso);
      return;
    }
    // Range selection: two-click behavior, with swap if user picks an earlier end.
    const from = this.rangeFrom();
    const to = this.rangeTo();
    if (!from || (from && to)) {
      this.rangeFrom.set(day.iso);
      this.rangeTo.set("");
      return;
    }
    if (from && !to) {
      if (day.iso < from) {
        // Pick before start -> swap into the new "from" position
        this.rangeTo.set(from);
        this.rangeFrom.set(day.iso);
      } else {
        this.rangeTo.set(day.iso);
      }
    }
  }

  isSelected(day: CalendarDay): boolean {
    if (this.mode() === "single") return day.iso === this.singleSelection();
    return day.iso === this.rangeFrom() || day.iso === this.rangeTo();
  }
  isRangeStart(day: CalendarDay): boolean { return this.mode() === "range" && day.iso === this.rangeFrom() && this.rangeFrom() !== this.rangeTo(); }
  isRangeEnd(day: CalendarDay): boolean { return this.mode() === "range" && day.iso === this.rangeTo() && this.rangeFrom() !== this.rangeTo(); }
  isInRange(day: CalendarDay): boolean {
    if (this.mode() !== "range") return false;
    const from = this.rangeFrom();
    const to = this.rangeTo();
    if (!from || !to) return false;
    return day.iso > from && day.iso < to;
  }

  setToday(): void {
    const today = this.effectiveMax();
    this.singleSelection.set(today);
    this.rangeFrom.set(today);
    this.rangeTo.set(today);
    this.jumpAnchorTo(today);
  }

  clearSelection(): void {
    this.singleSelection.set(toIsoDate(new Date()));
    this.rangeFrom.set("");
    this.rangeTo.set("");
  }

  setLast7(): void {
    const today = startOfDay(new Date(`${this.effectiveMax()}T00:00:00`));
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    this.rangeFrom.set(toIsoDate(from));
    this.rangeTo.set(toIsoDate(today));
    this.jumpAnchorTo(toIsoDate(today));
  }

  setThisMonth(): void {
    const today = startOfDay(new Date(`${this.effectiveMax()}T00:00:00`));
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    this.rangeFrom.set(toIsoDate(from));
    this.rangeTo.set(toIsoDate(today));
    this.jumpAnchorTo(toIsoDate(today));
  }

  canApply(): boolean {
    if (this.mode() === "single") return Boolean(this.singleSelection());
    return Boolean(this.rangeFrom() && this.rangeTo() && this.rangeFrom() <= this.rangeTo());
  }

  applySelection(): void {
    if (!this.canApply()) return;
    if (this.mode() === "single") {
      this.apply.emit({ mode: "single", single: this.singleSelection() });
    } else {
      this.apply.emit({ mode: "range", from: this.rangeFrom(), to: this.rangeTo() });
    }
  }

  dayAriaLabel(day: CalendarDay): string {
    const formatted = new Date(`${day.iso}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    return day.disabled ? `${formatted} (unavailable)` : formatted;
  }

  @HostListener("document:keydown.escape")
  onEscape(): void { this.cancel.emit(); }

  private buildMonth(year: number, month: number): CalendarMonth {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const maxIso = this.effectiveMax();
    const todayIso = toIsoDate(new Date());

    const weeks: CalendarDay[][] = [];
    let currentWeek: CalendarDay[] = [];
    // Leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const date = new Date(year, month - 1, dayNum);
      const iso = toIsoDate(date);
      currentWeek.push({
        date,
        day: dayNum,
        iso,
        inCurrentMonth: false,
        isToday: iso === todayIso,
        disabled: iso > maxIso,
      });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const iso = toIsoDate(date);
      currentWeek.push({
        date,
        day,
        iso,
        inCurrentMonth: true,
        isToday: iso === todayIso,
        disabled: iso > maxIso,
      });
      if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
    }
    // Trailing days
    let trailing = 1;
    while (currentWeek.length < 7 && currentWeek.length > 0) {
      const date = new Date(year, month + 1, trailing);
      const iso = toIsoDate(date);
      currentWeek.push({
        date,
        day: trailing,
        iso,
        inCurrentMonth: false,
        isToday: iso === todayIso,
        disabled: iso > maxIso,
      });
      trailing += 1;
    }
    if (currentWeek.length) weeks.push(currentWeek);
    return {
      year,
      month,
      label: `${MONTH_NAMES[month]} ${year}`,
      weeks,
    };
  }

  private nextMonth(year: number, month: number): { year: number; month: number } {
    if (month === 11) return { year: year + 1, month: 0 };
    return { year, month: month + 1 };
  }
  private prevMonth(year: number, month: number): { year: number; month: number } {
    if (month === 0) return { year: year - 1, month: 11 };
    return { year, month: month - 1 };
  }
  private jumpAnchorTo(iso: string): void {
    const parts = iso.split("-");
    if (parts.length !== 3) return;
    this.anchorYear.set(Number(parts[0]));
    this.anchorMonth.set(Number(parts[1]) - 1);
  }
  private formatLongDate(iso: string): string {
    if (!iso) return "—";
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  }
}
