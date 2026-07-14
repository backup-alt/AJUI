import { Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [IonIcon, NgIf],
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
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: var(--agb-radius-lg);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: var(--agb-shadow-2xs);
      transition: box-shadow var(--agb-transition-fast), transform var(--agb-transition-fast);
      font-family: inherit;
    }
    .agb-stat-card.interactive { cursor: pointer; }
    .agb-stat-card.interactive:hover { box-shadow: var(--agb-shadow-md); }
    .agb-stat-card.interactive:active { transform: scale(0.985); }
    .content { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .value { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.1; }
    .label { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 500; }
    .sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .chev { color: #94a3b8; font-size: 18px; flex-shrink: 0; }
  `],
})
export class StatCardComponent {
  @Input() icon = 'cube-outline';
  @Input() iconBg = 'rgba(0, 34, 99, 0.08)';
  @Input() iconColor = '#002263';
  @Input() value: string | number = '';
  @Input() label = '';
  @Input() sub?: string;
  @Input() clickable = true;
}
