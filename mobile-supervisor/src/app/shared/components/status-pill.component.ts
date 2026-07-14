import { Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { NgIf, NgSwitch, NgSwitchCase } from '@angular/common';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  imports: [IonIcon, NgIf, NgSwitch, NgSwitchCase],
  template: `
    <span class="agb-pill" [class.success]="tone === 'success'" [class.warning]="tone === 'warning'" [class.danger]="tone === 'danger'" [class.info]="tone === 'info'" [class.neutral]="tone === 'neutral'">
      @if (icon) {
        <ion-icon [name]="icon"></ion-icon>
      }
      <ng-content></ng-content>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
  `],
})
export class StatusPillComponent {
  @Input() tone: StatusTone = 'neutral';
  @Input() icon?: string;
}
