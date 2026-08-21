import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, computed, signal } from "@angular/core";

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

@Component({
  selector: "agb-donut-chart",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-chart">
      <div class="donut-canvas">
        <svg viewBox="0 0 36 36" class="donut-svg" role="img" [attr.aria-label]="ariaLabel">
          <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#f1f5f9" stroke-width="3.5"></circle>
          @for (seg of computedSegments(); track $index) {
            <circle
              class="donut-segment"
              cx="18"
              cy="18"
              r="15.91549430918954"
              fill="transparent"
              [attr.stroke]="seg.color"
              stroke-width="3.5"
              [attr.stroke-dasharray]="seg.dash"
              [attr.stroke-dashoffset]="seg.offset"
              [attr.stroke-linecap]="'butt'"
              [attr.transform]="'rotate(' + seg.rotate + ' 18 18)'"
              [attr.aria-label]="seg.label + ': ' + seg.display + ', ' + seg.percent.toFixed(1) + '%'"
              (mouseenter)="showTooltip($event, seg)"
              (mousemove)="showTooltip($event, seg)"
              (mouseleave)="hideTooltip()"
            ></circle>
          }
          <text x="18" y="17" text-anchor="middle" font-size="6" font-weight="800" fill="#0f172a">{{ totalLabel }}</text>
          <text x="18" y="22" text-anchor="middle" font-size="2.6" fill="#64748b">{{ caption || 'Total' }}</text>
        </svg>
        @if (tooltip; as tip) {
          <div class="donut-tooltip" [style.left.px]="tip.x" [style.top.px]="tip.y" role="tooltip">
            <span><i [style.background]="tip.color"></i>{{ tip.label }}</span>
            <strong>{{ tip.display }}</strong>
            <small>{{ tip.percent.toFixed(1) }}% of total</small>
          </div>
        }
      </div>
      <ul class="donut-legend">
        @for (seg of computedSegments(); track $index) {
          <li>
            <span class="donut-legend-row">
              <span class="donut-legend-swatch" [style.background]="seg.color"></span>
              <span class="donut-legend-label">{{ seg.label }}</span>
            </span>
            <span class="donut-legend-meta">
              <strong>{{ seg.display }}</strong>
              <small>{{ seg.percent.toFixed(1) }}%</small>
            </span>
          </li>
        } @empty {
          <li class="donut-empty">No data</li>
        }
      </ul>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
      container-type: inline-size;
    }
    .donut-chart {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .donut-canvas {
      position: relative;
      width: 140px;
      height: 140px;
      flex: 0 0 auto;
    }
    .donut-svg { width: 100%; height: 100%; }
    .donut-segment { cursor: pointer; transition: opacity 120ms ease; }
    .donut-segment:hover { opacity: .82; }
    .donut-tooltip {
      position: absolute;
      z-index: 4;
      display: grid;
      min-width: 124px;
      gap: 3px;
      padding: 9px 11px;
      pointer-events: none;
      border: 1px solid #344054;
      border-radius: 8px;
      background: #101828;
      color: #fff;
      box-shadow: 0 8px 20px rgba(16, 24, 40, .2);
      transform: translateX(-50%);
    }
    .donut-tooltip span { display: flex; align-items: center; gap: 6px; color: #d0d5dd; font-size: 11px; font-weight: 650; }
    .donut-tooltip span i { width: 8px; height: 8px; border-radius: 2px; }
    .donut-tooltip strong { font-size: 14px; line-height: 1.25; }
    .donut-tooltip small { color: #98a2b3; font-size: 11px; }
    .donut-legend {
      list-style: none;
      margin: 0;
      padding: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .donut-legend li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px dashed #f1f5f9;
    }
    .donut-legend li:last-child { border-bottom: 0; }
    .donut-legend-row {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .donut-legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    .donut-legend-label {
      font-size: 12px;
      color: #334155;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .donut-legend-meta {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
    }
    .donut-legend-meta strong {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .donut-legend-meta small {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
    }
    .donut-empty {
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
    }
    @container (max-width: 440px) {
      .donut-chart {
        flex-direction: column;
        align-items: stretch;
        gap: 20px;
      }
      .donut-canvas {
        width: min(170px, 52vw);
        height: min(170px, 52vw);
        align-self: center;
      }
      .donut-legend { width: 100%; }
      .donut-legend-label {
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
      }
    }
    @container (max-width: 290px) {
      .donut-legend li {
        align-items: flex-start;
        flex-direction: column;
      }
      .donut-legend-meta { padding-left: 18px; }
    }
  `],
})
export class DashboardDonutChartComponent {
  @Input() segments: DonutSegment[] = [];
  @Input() caption = "Total";
  @Input() ariaLabel = "Distribution chart";
  @Input() valueFormatter: (v: number) => string = (v) => new Intl.NumberFormat("en-IN").format(Math.round(v));

  tooltip: { x: number; y: number; label: string; display: string; percent: number; color: string } | null = null;

  private readonly palette = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#0ea5e9", "#ec4899", "#14b8a6"];

  private readonly _segments = signal<DonutSegment[]>([]);
  readonly computedSegments = computed(() => this.buildSegments(this._segments()));

  ngOnChanges() {
    this._segments.set(this.segments || []);
  }

  get totalLabel(): string {
    const total = (this.segments || []).reduce((acc, s) => acc + (s.value || 0), 0);
    if (total >= 10000000) return this.compactValue(total, 10000000, "Cr");
    if (total >= 100000) return this.compactValue(total, 100000, "L");
    if (total >= 1000) return this.compactValue(total, 1000, "K");
    return Math.round(total).toString();
  }

  showTooltip(
    event: MouseEvent,
    segment: { label: string; display: string; percent: number; color: string },
  ): void {
    const target = event.currentTarget as SVGCircleElement | null;
    const canvas = target?.closest(".donut-canvas") as HTMLElement | null;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.max(62, Math.min(bounds.width - 62, event.clientX - bounds.left));
    const y = Math.max(8, Math.min(bounds.height - 68, event.clientY - bounds.top + 12));
    this.tooltip = { x, y, ...segment };
  }

  hideTooltip(): void { this.tooltip = null; }

  private compactValue(total: number, divisor: number, suffix: string): string {
    const truncated = Math.floor((total / divisor) * 100) / 100;
    const display = truncated.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return `${display}${suffix}`;
  }

  private buildSegments(segments: DonutSegment[]) {
    const total = segments.reduce((acc, s) => acc + (s.value || 0), 0) || 1;
    let cumulative = 0;
    return segments.map((seg, idx) => {
      const value = seg.value || 0;
      const percent = (value / total) * 100;
      const color = seg.color || this.palette[idx % this.palette.length];
      const dash = `${percent} ${100 - percent}`;
      const offset = 25 - cumulative;
      cumulative += percent;
      return {
        label: seg.label,
        value,
        color,
        dash,
        offset,
        rotate: -90,
        percent,
        display: this.valueFormatter(value),
      };
    });
  }
}
