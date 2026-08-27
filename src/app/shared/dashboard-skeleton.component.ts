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
      } @else if (variant === "card-grid") {
        <div class="skeleton-card-grid">
          @for (i of counter(cardCount); track i) {
            <div class="skeleton-card">
              <div class="skeleton-card-head">
                <span class="skeleton-line w-30 tag"></span>
                <span class="skeleton-line w-70 large"></span>
                <span class="skeleton-line w-50"></span>
              </div>
              <div class="skeleton-card-meta">
                <span class="skeleton-line w-40"></span>
                <span class="skeleton-line w-30"></span>
              </div>
              <div class="skeleton-card-ledger">
                <div><span class="skeleton-line w-50"></span><span class="skeleton-line w-70 large"></span></div>
                <div><span class="skeleton-line w-50"></span><span class="skeleton-line w-70 large"></span></div>
                <div><span class="skeleton-line w-50"></span><span class="skeleton-line w-70 large"></span></div>
                <div><span class="skeleton-line w-50"></span><span class="skeleton-line w-70 large"></span></div>
              </div>
              <div class="skeleton-card-footer">
                <span class="skeleton-line w-30 pill"></span>
                <span class="skeleton-line w-50 pill"></span>
              </div>
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
    /* Card-grid variant — used on the projects directory, client
       workspace project-select grid, and similar rich-card lists.
       Mirrors the layout of .projects-directory-card /
       .project-select-card so the transition from skeleton → real
       cards doesn't shift the page. */
    .skeleton-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 22px;
      width: 100%;
      box-sizing: border-box;
    }
    .skeleton-card {
      display: grid;
      gap: 16px;
      padding: 20px;
      border: 1px solid var(--line, #e2e8f0);
      border-radius: 4px;
      background: #ffffff;
      box-sizing: border-box;
    }
    .skeleton-card-head {
      display: grid;
      gap: 10px;
      min-width: 0;
    }
    .skeleton-card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .skeleton-card-meta .skeleton-line {
      height: 12px;
    }
    .skeleton-card-ledger {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 16px;
    }
    .skeleton-card-ledger > div {
      display: grid;
      gap: 6px;
    }
    .skeleton-card-footer {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      padding-top: 6px;
    }
    .skeleton-line.tag {
      height: 18px;
      width: 60px;
      border-radius: 999px;
    }
    .skeleton-line.pill {
      height: 32px;
      width: 100px;
      border-radius: 6px;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class DashboardSkeletonComponent {
  @Input() variant: "kpi" | "chart" | "donut" | "row" | "block" | "card-grid" = "block";
  @Input() kpiCount = 4;
  @Input() rowCount = 4;
  @Input() cardCount = 6;
  @Input() blockHeight = 120;
  @Input() ariaLabel = "Loading";

  counter(n: number): number[] {
    const count = Math.max(0, Math.floor(n) || 0);
    return Array.from({ length: count }, (_, i) => i);
  }
}