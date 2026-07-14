import { Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IonIcon, NgIf],
  template: `
    <div class="agb-empty-state">
      <div class="icon-wrap" [style.background]="iconBg || 'rgba(0, 34, 99, 0.06)'" [style.color]="iconColor || '#002263'">
        <ion-icon [name]="icon"></ion-icon>
      </div>
      <h3>{{ title }}</h3>
      @if (message) {
        <p>{{ message }}</p>
      }
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .agb-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 56px 24px;
    }
    .icon-wrap {
      width: 72px;
      height: 72px;
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }
    .icon-wrap ion-icon {
      font-size: 36px;
    }
    h3 {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 6px;
    }
    p {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 8px;
      max-width: 320px;
      line-height: 1.5;
    }
  `],
})
export class EmptyStateComponent {
  @Input() icon = 'cube-outline';
  @Input() title = 'Nothing here yet';
  @Input() message?: string;
  @Input() iconBg?: string;
  @Input() iconColor?: string;
}
