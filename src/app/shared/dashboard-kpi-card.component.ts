import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

export type KpiAccent = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

@Component({
  selector: "agb-kpi-card",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="kpi-card" [attr.data-accent]="accent" [class.loading]="loading">
      <header class="kpi-head">
        <span class="kpi-label">{{ label }}</span>
        @if (icon) {
          <span class="kpi-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
              <path [attr.d]="iconPath"></path>
            </svg>
          </span>
        }
      </header>
      <div class="kpi-body">
        <strong class="kpi-value">{{ display }}</strong>
        @if (subtitle) {
          <span class="kpi-subtitle">{{ subtitle }}</span>
        }
      </div>
      @if (delta !== null && delta !== undefined) {
        <footer class="kpi-foot">
          <span class="kpi-delta" [class.up]="delta >= 0" [class.down]="delta < 0">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
              @if (delta >= 0) {
                <path d="M5 14l7-7 7 7" />
              } @else {
                <path d="M5 10l7 7 7-7" />
              }
            </svg>
            {{ deltaLabel }}
          </span>
          @if (deltaContext) {
            <span class="kpi-delta-context">{{ deltaContext }}</span>
          }
        </footer>
      }
    </article>
  `,
  styles: [`
    :host { display: block; }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e5eaf1;
      border-radius: 16px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      position: relative;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      transition: box-shadow 160ms ease, transform 160ms ease;
    }
    .kpi-card:hover {
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    .kpi-card[data-accent="primary"] { border-top: 3px solid var(--ui-accent, #2563eb); }
    .kpi-card[data-accent="success"] { border-top: 3px solid #16a34a; }
    .kpi-card[data-accent="warning"] { border-top: 3px solid #f59e0b; }
    .kpi-card[data-accent="danger"]  { border-top: 3px solid #dc2626; }
    .kpi-card[data-accent="info"]    { border-top: 3px solid #0ea5e9; }
    .kpi-card[data-accent="neutral"] { border-top: 3px solid #94a3b8; }
    .kpi-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .kpi-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748b;
    }
    .kpi-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--ui-accent-soft, #eff6ff);
      color: var(--ui-accent-dark, #1d4ed8);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .kpi-icon .svg-icon { width: 16px; height: 16px; }
    .kpi-card[data-accent="success"] .kpi-icon { background: #ecfdf5; color: #047857; }
    .kpi-card[data-accent="warning"] .kpi-icon { background: #fffbeb; color: #b45309; }
    .kpi-card[data-accent="danger"]  .kpi-icon { background: #fef2f2; color: #b91c1c; }
    .kpi-card[data-accent="info"]    .kpi-icon { background: #f0f9ff; color: #0369a1; }
    .kpi-card[data-accent="neutral"] .kpi-icon { background: #f1f5f9; color: #475569; }
    .kpi-body { display: flex; flex-direction: column; gap: 2px; }
    .kpi-value {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
      letter-spacing: -0.01em;
    }
    .kpi-subtitle {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .kpi-foot {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 2px;
    }
    .kpi-delta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
    }
    .kpi-delta .svg-icon { width: 12px; height: 12px; }
    .kpi-delta.up   { background: #ecfdf5; color: #047857; }
    .kpi-delta.down { background: #fef2f2; color: #b91c1c; }
    .kpi-delta-context { font-size: 11px; color: #94a3b8; font-weight: 600; }
    .kpi-card.loading .kpi-value {
      background: linear-gradient(90deg, #eef0f3 0%, #f7f8fa 50%, #eef0f3 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite linear;
      color: transparent;
      border-radius: 6px;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class DashboardKpiCardComponent {
  @Input() label = "";
  @Input() value: string | number = "—";
  @Input() display = "—";
  @Input() subtitle?: string;
  @Input() delta: number | null | undefined = null;
  @Input() deltaContext = "vs last period";
  @Input() accent: KpiAccent = "primary";
  @Input() icon?: string;
  @Input() iconPath?: string;
  @Input() loading = false;

  get deltaLabel(): string {
    if (this.delta === null || this.delta === undefined) return "";
    const pct = Math.abs(this.delta);
    return `${pct.toFixed(1)}%`;
  }

  ngOnChanges() {
    if (!this.display || this.display === "—") {
      this.display = typeof this.value === "number"
        ? this.value.toLocaleString("en-IN")
        : String(this.value);
    }
  }
}