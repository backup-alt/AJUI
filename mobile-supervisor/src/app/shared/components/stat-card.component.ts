import { Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [IonIcon],
  template: `
    <button class="agb-stat-card" type="button" [class.interactive]="!!clickable">
      <div class="agb-icon-tile" [style.background]="iconBg" [style.color]="iconColor">
        <ion-icon [name]="icon"></ion-icon>
      </div>
      <div class="content">
        <span class="value">{{ value }}</span>
        <span class="label">{{ label }}</span>
        @if (sub) {
          <span class="sub">{{ sub }}</span>
        }
      </div>
      @if (clickable) {
        <ion-icon class="chev" name="chevron-forward-outline"></ion-icon>
      }
    </button>
  `,
  styles: [`
    .agb-stat-card {
      width: 100%;
      text-align: left;
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      box-shadow: var(--md-elevation-1);
      transition: box-shadow var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  transform var(--md-motion-duration-short1) var(--md-motion-easing-standard);
      font-family: inherit;
    }
    .agb-stat-card.interactive { cursor: pointer; }
    .agb-stat-card.interactive:hover { box-shadow: var(--md-elevation-2); }
    .agb-stat-card.interactive:active { transform: scale(0.985); }
    .content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .value {
      font-size: 22px;
      font-weight: 700;
      color: var(--m3-on-surface);
      line-height: 1.1;
    }
    .label {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      margin-top: var(--md-space-1);
      font-weight: 500;
    }
    .sub {
      font-size: 11px;
      color: var(--m3-on-surface-muted);
      margin-top: 2px;
      opacity: 0.8;
    }
    .chev {
      color: var(--m3-on-surface-muted);
      font-size: 18px;
      flex-shrink: 0;
    }
  `],
})
export class StatCardComponent {
  @Input() icon = 'cube-outline';
  @Input() iconBg = 'var(--m3-primary-container)';
  @Input() iconColor = 'var(--m3-on-primary-container)';
  @Input() value: string | number = '';
  @Input() label = '';
  @Input() sub?: string;
  @Input() clickable = true;
}
