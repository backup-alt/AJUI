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
            ></circle>
          }
          <text x="18" y="17" text-anchor="middle" font-size="6" font-weight="800" fill="#0f172a">{{ totalLabel }}</text>
          <text x="18" y="22" text-anchor="middle" font-size="2.6" fill="#64748b">{{ caption || 'Total' }}</text>
        </svg>
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
    :host { display: block; }
    .donut-chart {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .donut-canvas {
      width: 140px;
      height: 140px;
      flex: 0 0 auto;
    }
    .donut-svg { width: 100%; height: 100%; }
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
  `],
})
export class DashboardDonutChartComponent {
  @Input() segments: DonutSegment[] = [];
  @Input() caption = "Total";
  @Input() ariaLabel = "Distribution chart";
  @Input() valueFormatter: (v: number) => string = (v) => new Intl.NumberFormat("en-IN").format(Math.round(v));

  private readonly palette = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#0ea5e9", "#ec4899", "#14b8a6"];

  private readonly _segments = signal<DonutSegment[]>([]);
  readonly computedSegments = computed(() => this.buildSegments(this._segments()));

  ngOnChanges() {
    this._segments.set(this.segments || []);
  }

  get totalLabel(): string {
    const total = (this.segments || []).reduce((acc, s) => acc + (s.value || 0), 0);
    if (total >= 10000000) return `${(total / 10000000).toFixed(1)}Cr`;
    if (total >= 100000) return `${(total / 100000).toFixed(1)}L`;
    if (total >= 1000) return `${(total / 1000).toFixed(1)}K`;
    return Math.round(total).toString();
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