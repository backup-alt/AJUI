import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [],
  template: `
    <div class="agb-page-header">
      <div class="title-row">
        <div class="title-wrap">
          <h1>{{ title }}</h1>
          @if (subtitle) {
            <p>{{ subtitle }}</p>
          }
        </div>
        <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .agb-page-header {
      padding: 16px 16px 8px;
    }
    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .title-wrap { min-width: 0; }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 2px;
      letter-spacing: -0.2px;
    }
    p {
      font-size: 13px;
      color: var(--m3-on-surface-muted);
      margin: 0;
      line-height: 1.45;
    }
  `],
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle?: string;
}
