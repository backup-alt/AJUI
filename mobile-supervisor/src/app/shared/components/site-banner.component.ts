import { Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { NgIf } from '@angular/common';

@Component({
  selector: 'agb-site-banner',
  standalone: true,
  imports: [IonIcon, NgIf],
  template: `
    <div class="agb-info-banner" [style.borderLeftColor]="accentColor">
      <ion-icon [name]="icon" [style.color]="accentColor"></ion-icon>
      <div class="content">
        <div class="label">{{ label }}</div>
        <div class="value">{{ value }}</div>
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .content { flex: 1; min-width: 0; }
  `],
})
export class SiteBannerComponent {
  @Input() label = 'Site';
  @Input() value = '';
  @Input() icon = 'location-outline';
  @Input() accentColor = '#c9a227';
}
