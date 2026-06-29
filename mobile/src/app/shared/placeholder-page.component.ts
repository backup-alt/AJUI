import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButtons,
  IonMenuButton,
  IonChip,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonButtons,
    IonMenuButton,
    IonChip,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar class="agb-header">
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="agb-page-header">
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </div>

      <div class="container">
        <div class="agb-list-card">
          <div class="agb-list-item" *ngFor="let item of previewItems">
            <div class="icon-bubble">
              <ion-icon [name]="iconName"></ion-icon>
            </div>
            <div class="body">
              <p class="title">{{ item.title }}</p>
              <p class="subtitle">{{ item.subtitle }}</p>
            </div>
            <div class="trailing">
              <ion-chip [class]="'agb-chip ' + item.chipClass">{{ item.status }}</ion-chip>
            </div>
          </div>
        </div>

        <div class="phase-note">
          <ion-icon [name]="iconName"></ion-icon>
          <div>
            <strong>Phase {{ phase }}</strong>
            <p>{{ note }}</p>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .container { padding: 18px; }
    .phase-note {
      display: flex;
      gap: 14px;
      padding: 16px;
      margin-top: 18px;
      border-radius: var(--agb-radius);
      background: linear-gradient(135deg, rgba(0,34,99,0.05), rgba(18,59,133,0.10));
      border: 1px dashed rgba(0,34,99,0.25);
      color: var(--agb-text);
    }
    .phase-note ion-icon {
      font-size: 28px;
      color: var(--agb-primary);
      flex-shrink: 0;
    }
    .phase-note strong {
      display: block;
      color: var(--agb-primary);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .phase-note p {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--agb-text-muted);
      line-height: 1.45;
    }
  `],
})
export class PlaceholderPage {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() iconName = 'cube-outline';
  @Input() phase = 1;
  @Input() note = 'Full form, list & details coming in the next phase.';
  @Input() previewItems: { title: string; subtitle: string; status: string; chipClass: string }[] = [];

  constructor() {
    addIcons({
      'cube-outline': () => null as any,
      'people-outline': () => null as any,
      'wallet-outline': () => null as any,
      'card-outline': () => null as any,
      'briefcase-outline': () => null as any,
      'checkmark-done-circle-outline': () => null as any,
      'folder-outline': () => null as any,
    } as any);
  }
}