import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

export interface BarChartSeries {
  label: string;
  values: number[];
  color?: string;
  accent?: string;
}

@Component({
  selector: "agb-bar-chart",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar-chart" [class.horizontal]="orientation === 'horizontal'" [class.vertical]="orientation === 'vertical'">
      @if (orientation === 'vertical') {
        <div class="bar-chart-axis-y">
          @for (label of yAxisLabels; track $index) {
            <span class="bar-chart-tick">{{ label }}</span>
          }
        </div>
      }
      <div class="bar-chart-canvas">
        @if (orientation === 'vertical') {
          <svg [attr.viewBox]="'0 0 ' + svgWidth + ' ' + svgHeight" preserveAspectRatio="none" class="bar-chart-svg">
            @for (line of gridLines; track line) {
              <line [attr.x1]="0" [attr.x2]="svgWidth" [attr.y1]="line" [attr.y2]="line" stroke="#e9edf3" stroke-width="1" />
            }
            @for (group of groupedBars(); track $index; let gi = $index) {
              <g [attr.transform]="'translate(' + (gi * groupWidth + paddingX + groupOffset) + ',0)'">
                @for (bar of group.bars; track $index; let bi = $index) {
                  <rect
                    class="bar-chart-bar"
                    [attr.x]="bi * (barWidth + innerGap)"
                    [attr.y]="(svgHeight - axisPadding) - bar.height"
                    [attr.width]="barWidth"
                    [attr.height]="bar.height"
                    [attr.fill]="bar.color"
                    [attr.aria-label]="bar.seriesLabel + ' on ' + bar.label + ': ' + tooltipValueFormatter(bar.value)"
                    (mouseenter)="showTooltip($event, bar)"
                    (mousemove)="showTooltip($event, bar)"
                    (mouseleave)="hideTooltip()"
                    rx="4"
                  ></rect>
                }
              </g>
            }
          </svg>
          <div class="bar-chart-x-axis">
            @for (label of labels; track $index) {
              <span class="bar-chart-x-label">{{ label }}</span>
            }
          </div>
          @if (tooltip; as tip) {
            <div class="bar-chart-tooltip" [style.left.px]="tip.x" [style.top.px]="tip.y" role="tooltip">
              <span><i [style.background]="tip.color"></i>{{ tip.seriesLabel }}</span>
              <strong>{{ tooltipValueFormatter(tip.value) }}</strong>
              <small>{{ tip.label }}</small>
            </div>
          }
        } @else {
          <div class="bar-chart-rows">
            @for (row of horizontalRows(); track $index) {
              <div class="bar-chart-row">
                <span class="bar-chart-row-label">{{ row.label }}</span>
                <div class="bar-chart-row-bar">
                  @for (seg of row.segments; track $index) {
                    <span class="bar-chart-row-segment" [style.width.%]="seg.percent" [style.background]="seg.color" [attr.title]="seg.title"></span>
                  }
                </div>
                <span class="bar-chart-row-value">{{ row.total }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
    @if (legend.length) {
      <ul class="bar-chart-legend">
        @for (item of legend; track item.label) {
          <li>
            <span class="bar-chart-legend-dot" [style.background]="item.color"></span>
            {{ item.label }}
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; }
    .bar-chart {
      display: flex;
      gap: 8px;
      width: 100%;
    }
    .bar-chart.vertical {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      column-gap: 10px;
      align-items: start;
    }
    .bar-chart.horizontal { flex-direction: column; }
    .bar-chart-axis-y {
      display: flex;
      height: 200px;
      flex-direction: column;
      justify-content: space-between;
      padding: 0 0 7px;
      color: #667085;
      text-align: right;
    }
    .bar-chart-tick {
      font-size: 10px;
      font-weight: 600;
      line-height: 1;
    }
    .bar-chart-canvas {
      position: relative;
      flex: 1;
      min-width: 0;
    }
    .bar-chart-svg {
      width: 100%;
      height: 200px;
      display: block;
    }
    .bar-chart-bar {
      cursor: pointer;
      transition: opacity 120ms ease;
    }
    .bar-chart-bar:hover { opacity: .84; }
    .bar-chart-tooltip {
      position: absolute;
      z-index: 4;
      display: grid;
      min-width: 118px;
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
    .bar-chart-tooltip span { display: flex; align-items: center; gap: 6px; color: #d0d5dd; font-size: 11px; font-weight: 650; }
    .bar-chart-tooltip span i { width: 8px; height: 8px; border-radius: 2px; }
    .bar-chart-tooltip strong { font-size: 14px; line-height: 1.25; }
    .bar-chart-tooltip small { color: #98a2b3; font-size: 11px; }
    .bar-chart-x-axis {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      gap: 4px;
    }
    .bar-chart-x-label {
      flex: 1;
      text-align: center;
      font-size: 11px;
      color: #667085;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bar-chart-rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bar-chart-row {
      display: grid;
      grid-template-columns: 130px 1fr 90px;
      gap: 10px;
      align-items: center;
    }
    .bar-chart-row-label {
      font-size: 12px;
      color: #334155;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bar-chart-row-bar {
      height: 10px;
      border-radius: 999px;
      background: #f1f5f9;
      overflow: hidden;
      display: flex;
    }
    .bar-chart-row-segment {
      height: 100%;
      transition: width 320ms ease;
    }
    .bar-chart-row-value {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bar-chart-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
    }
    .bar-chart-legend li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #475569;
      font-weight: 600;
    }
    .bar-chart-legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    @media (max-width: 700px) {
      .bar-chart-row {
        grid-template-columns: 90px 1fr 70px;
      }
    }
  `],
})
export class DashboardBarChartComponent {
  @Input() orientation: "horizontal" | "vertical" = "vertical";
  @Input() series: BarChartSeries[] = [];
  @Input() labels: string[] = [];
  @Input() legend: Array<{ label: string; color: string }> = [];
  @Input() axisValueFormatter: (value: number) => string = (value) => this.formatNumber(value);
  @Input() tooltipValueFormatter: (value: number) => string = (value) => this.formatNumber(value);

  tooltip: { x: number; y: number; label: string; seriesLabel: string; value: number; color: string } | null = null;

  svgWidth = 320;
  svgHeight = 200;
  paddingX = 8;
  axisPadding = 10;
  barWidth = 14;
  innerGap = 2;
  groupWidth = 0;
  groupOffset = 0;

  get yAxisLabels(): string[] {
    const max = this.computeMax();
    return [1, 0.75, 0.5, 0.25, 0].map((ratio) => this.axisValueFormatter(max * ratio));
  }

  get gridLines(): number[] {
    const top = 6;
    const bottom = this.svgHeight - this.axisPadding;
    return [0, 0.25, 0.5, 0.75, 1].map((ratio) => top + (bottom - top) * ratio);
  }

  groupedBars(): Array<{ bars: Array<{ height: number; color: string; value: number; label: string; seriesLabel: string }> }> {
    const max = this.computeMax();
    const usableHeight = this.svgHeight - this.axisPadding - 6;
    const count = this.labels.length || (this.series[0]?.values.length ?? 0);
    const seriesCount = Math.max(1, this.series.length);
    this.groupWidth = (this.svgWidth - this.paddingX * 2) / Math.max(1, count);
    this.barWidth = Math.min(14, Math.max(5, (this.groupWidth - 8) / seriesCount - this.innerGap));
    const barsWidth = seriesCount * this.barWidth + Math.max(0, seriesCount - 1) * this.innerGap;
    this.groupOffset = Math.max(0, (this.groupWidth - barsWidth) / 2);

    const groups: Array<{ bars: Array<{ height: number; color: string; value: number; label: string; seriesLabel: string }> }> = [];
    for (let i = 0; i < count; i++) {
      const bars: Array<{ height: number; color: string; value: number; label: string; seriesLabel: string }> = [];
      for (let s = 0; s < seriesCount; s++) {
        const series = this.series[s];
        const value = series?.values[i] ?? 0;
        const height = max > 0 ? (value / max) * usableHeight : 0;
        const color = series?.color ?? this.defaultColor(s);
        bars.push({
          height: Math.max(0, height),
          color,
          value,
          label: this.labels[i] || `Period ${i + 1}`,
          seriesLabel: series?.label || `Series ${s + 1}`,
        });
      }
      groups.push({ bars });
    }
    return groups;
  }

  showTooltip(
    event: MouseEvent,
    bar: { label: string; seriesLabel: string; value: number; color: string },
  ): void {
    const target = event.currentTarget as SVGRectElement | null;
    const canvas = target?.closest(".bar-chart-canvas") as HTMLElement | null;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.max(64, Math.min(bounds.width - 64, event.clientX - bounds.left));
    const y = Math.max(8, Math.min(bounds.height - 72, event.clientY - bounds.top + 12));
    this.tooltip = { x, y, ...bar };
  }

  hideTooltip(): void { this.tooltip = null; }

  horizontalRows(): Array<{ label: string; total: string; segments: Array<{ percent: number; color: string; title: string }> }> {
    const rows: Array<{ label: string; total: string; segments: Array<{ percent: number; color: string; title: string }> }> = [];
    const grandTotal = this.series.reduce((acc, s) => acc + s.values.reduce((a, b) => a + b, 0), 0) || 1;
    this.labels.forEach((label, idx) => {
      const segments: Array<{ percent: number; color: string; title: string }> = [];
      let total = 0;
      this.series.forEach((s, sIdx) => {
        const v = s.values[idx] ?? 0;
        total += v;
        segments.push({
          percent: grandTotal > 0 ? (v / grandTotal) * 100 : 0,
          color: s.color ?? this.defaultColor(sIdx),
          title: `${s.label}: ${this.formatNumber(v)}`,
        });
      });
      rows.push({ label, total: this.formatNumber(total), segments });
    });
    return rows;
  }

  private computeMax(): number {
    let max = 0;
    for (const s of this.series) {
      for (const v of s.values) {
        if (v > max) max = v;
      }
    }
    return max;
  }

  private defaultColor(idx: number): string {
    const palette = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#0ea5e9"];
    return palette[idx % palette.length];
  }

  private formatNumber(v: number): string {
    return new Intl.NumberFormat("en-IN").format(Math.round(v));
  }
}
