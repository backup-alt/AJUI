import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

@Component({
  selector: "agb-dashboard-skeleton",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard-skeleton" [attr.aria-busy]="true" [attr.aria-label]="ariaLabel">
      @if (variant === "kpi") {
        <div class="skeleton-kpi-grid">
          @for (i of counter(kpiCount); track i) {
            <div class="skeleton-kpi-card">
              <span class="skeleton-line w-40"></span>
              <span class="skeleton-line w-70 large"></span>
              <span class="skeleton-line w-30"></span>
            </div>
          }
        </div>
      } @else if (variant === "chart") {
        <div class="skeleton-chart">
          <span class="skeleton-line w-50"></span>
          <div class="skeleton-bars">
            @for (i of counter(5); track i) {
              <span class="skeleton-bar"></span>
            }
          </div>
        </div>
      } @else if (variant === "donut") {
        <div class="skeleton-donut">
          <div class="skeleton-circle"></div>
          <div class="skeleton-legend">
            @for (i of counter(4); track i) {
              <span class="skeleton-line w-80"></span>
            }
          </div>
        </div>
      } @else if (variant === "row") {
        <div class="skeleton-rows">
          @for (i of counter(rowCount); track i) {
            <div class="skeleton-row">
              <span class="skeleton-line w-30"></span>
              <span class="skeleton-line w-50"></span>
              <span class="skeleton-line w-20"></span>
            </div>
          }
        </div>
      } @else {
        <div class="skeleton-block" [style.height.px]="blockHeight"></div>
      }
    </div>
  `,
  styles: [`
    .dashboard-skeleton {
      display: block;
      width: 100%;
    }
    .skeleton-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
    }
    .skeleton-kpi-card {
      background: #ffffff;
      border: 1px solid #e5eaf1;
      border-radius: 14px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .skeleton-chart {
      background: #ffffff;
      border: 1px solid #e5eaf1;
      border-radius: 14px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .skeleton-bars {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      height: 140px;
    }
    .skeleton-bar {
      flex: 1;
      height: 70%;
      background: linear-gradient(90deg, #eef0f3 0%, #f7f8fa 50%, #eef0f3 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite linear;
      border-radius: 6px;
    }
    .skeleton-donut {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .skeleton-circle {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      background: linear-gradient(90deg, #eef0f3 0%, #f7f8fa 50%, #eef0f3 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite linear;
      flex: 0 0 auto;
    }
    .skeleton-legend {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .skeleton-rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .skeleton-row {
      display: grid;
      grid-template-columns: 1fr 2fr 1fr;
      gap: 12px;
      padding: 10px 14px;
      background: #ffffff;
      border: 1px solid #e5eaf1;
      border-radius: 10px;
    }
    .skeleton-line {
      display: block;
      height: 10px;
      border-radius: 999px;
      background: linear-gradient(90deg, #eef0f3 0%, #f7f8fa 50%, #eef0f3 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite linear;
    }
    .skeleton-line.w-20 { width: 20%; }
    .skeleton-line.w-30 { width: 30%; }
    .skeleton-line.w-40 { width: 40%; }
    .skeleton-line.w-50 { width: 50%; }
    .skeleton-line.w-70 { width: 70%; }
    .skeleton-line.w-80 { width: 80%; }
    .skeleton-line.large { height: 18px; }
    .skeleton-block {
      width: 100%;
      border-radius: 12px;
      background: linear-gradient(90deg, #eef0f3 0%, #f7f8fa 50%, #eef0f3 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite linear;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class DashboardSkeletonComponent {
  @Input() variant: "kpi" | "chart" | "donut" | "row" | "block" = "block";
  @Input() kpiCount = 4;
  @Input() rowCount = 4;
  @Input() blockHeight = 120;
  @Input() ariaLabel = "Loading";

  counter(n: number): number[] {
    const count = Math.max(0, Math.floor(n) || 0);
    return Array.from({ length: count }, (_, i) => i);
  }
}