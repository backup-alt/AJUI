import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "agb-section-card",
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section-card" [class.is-loading]="loading">
      <header class="section-card-head">
        <div class="section-card-titles">
          @if (eyebrow) {
            <span class="section-card-eyebrow">{{ eyebrow }}</span>
          }
          <h3 class="section-card-title">{{ title }}</h3>
          @if (description) {
            <p class="section-card-description">{{ description }}</p>
          }
        </div>
        @if (actionLabel && actionRoute) {
          <a class="section-card-action" [routerLink]="actionRoute">
            {{ actionLabel }}
            <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </a>
        }
      </header>
      <div class="section-card-body">
        @if (loading) {
          <ng-content select="[slot=loading]"></ng-content>
        } @else if (hasError) {
          <div class="section-empty section-error">
            <span class="section-empty-icon">!</span>
            <h4>Unable to load {{ title }}</h4>
            <p>{{ errorMessage || "Please try again in a moment." }}</p>
            @if (retryable) {
              <button type="button" class="section-retry" (click)="retry?.()">
                Retry
              </button>
            }
          </div>
        } @else if (isEmpty) {
          <div class="section-empty">
            <span class="section-empty-icon check" aria-hidden="true">
              <svg viewBox="0 0 24 24" class="svg-icon"><path d="M5 12l5 5L20 7"/></svg>
            </span>
            <h4>{{ emptyTitle || "All clear" }}</h4>
            <p>{{ emptyMessage || "No items to show." }}</p>
            @if (emptyActionLabel && emptyActionRoute) {
              <a class="section-empty-action" [routerLink]="emptyActionRoute">{{ emptyActionLabel }}</a>
            }
          </div>
        } @else {
          <ng-content></ng-content>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .section-card {
      background: #ffffff;
      border: 1px solid #e5eaf1;
      border-radius: 16px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .section-card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      padding: 18px 22px 14px;
      border-bottom: 1px solid #f1f4f9;
    }
    .section-card-titles { min-width: 0; }
    .section-card-eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ui-accent-dark, #1d4ed8);
      margin-bottom: 4px;
    }
    .section-card-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .section-card-description {
      font-size: 13px;
      color: #64748b;
      margin: 4px 0 0;
    }
    .section-card-action {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 700;
      color: var(--ui-accent-dark, #1d4ed8);
      text-decoration: none;
      white-space: nowrap;
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--ui-accent-soft, #eff6ff);
      transition: background 160ms ease;
    }
    .section-card-action:hover { background: var(--ui-accent-line, #bfdbfe); }
    .section-card-action .svg-icon { width: 14px; height: 14px; }
    .section-card-body { padding: 16px 22px 20px; }
    .section-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 24px 12px;
      text-align: center;
      color: #64748b;
    }
    .section-empty-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ecfdf5;
      color: #047857;
    }
    .section-empty-icon .svg-icon { width: 22px; height: 22px; }
    .section-empty-icon.check {
      background: #ecfdf5;
    }
    .section-empty h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .section-empty p {
      margin: 0;
      font-size: 13px;
      max-width: 36ch;
    }
    .section-empty-action {
      margin-top: 6px;
      padding: 7px 14px;
      border-radius: 8px;
      background: var(--ui-accent, #2563eb);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
    }
    .section-empty.section-error .section-empty-icon {
      background: #fef2f2;
      color: #b91c1c;
    }
    .section-empty.section-error h4 { color: #b91c1c; }
    .section-retry {
      margin-top: 6px;
      padding: 7px 14px;
      border-radius: 8px;
      background: var(--ui-accent, #2563eb);
      color: #ffffff;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
    }
  `],
})
export class DashboardSectionCardComponent {
  @Input() eyebrow = "";
  @Input() title = "";
  @Input() description?: string;
  @Input() actionLabel?: string;
  @Input() actionRoute?: string | any[];
  @Input() loading = false;
  @Input() isEmpty = false;
  @Input() emptyTitle?: string;
  @Input() emptyMessage?: string;
  @Input() emptyActionLabel?: string;
  @Input() emptyActionRoute?: string | any[];
  @Input() hasError = false;
  @Input() errorMessage?: string;
  @Input() retryable = true;
  @Input() retry?: () => void;
}