import { Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cubeOutline, documentTextOutline, closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-inventory-action-sheet',
  standalone: true,
  imports: [IonIcon],
  template: `
    <div class="action-sheet-container">
      <div class="action-sheet-header">
        <h2>Add to Inventory</h2>
        <p>Choose how you'd like to add materials</p>
        <button class="close-btn" (click)="dismiss()" aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <div class="action-cards">
        <button class="action-card" (click)="selectAction('existing')">
          <div class="action-icon existing-icon">
            <ion-icon name="cube-outline"></ion-icon>
          </div>
          <div class="action-content">
            <h3>Add Existing Material</h3>
            <p>Record materials already present at the site</p>
          </div>
          <div class="action-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </button>

        <button class="action-card" (click)="selectAction('request')">
          <div class="action-icon request-icon">
            <ion-icon name="document-text-outline"></ion-icon>
          </div>
          <div class="action-content">
            <h3>Raise Material Request</h3>
            <p>Submit a new material request for approval</p>
          </div>
          <div class="action-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .action-sheet-container {
      width: 100%;
      background: var(--m3-surface-bright);
      border-radius: var(--md-radius-2xl) var(--md-radius-2xl) 0 0;
      padding: var(--md-space-6) var(--md-space-4) var(--md-space-8);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .action-sheet-header {
      position: relative;
      text-align: center;
      margin-bottom: var(--md-space-6);
      padding: 0 var(--md-space-8);
    }

    .action-sheet-header h2 {
      font-size: 20px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 var(--md-space-1);
      letter-spacing: -0.3px;
    }

    .action-sheet-header p {
      font-size: 14px;
      color: var(--m3-on-surface-muted);
      margin: 0;
      line-height: 1.4;
    }

    .close-btn {
      position: absolute;
      top: -4px;
      right: -8px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--m3-surface-container);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .close-btn:hover {
      background: var(--m3-surface-container-high);
    }

    .close-btn ion-icon {
      font-size: 18px;
      color: var(--m3-on-surface-variant);
    }

    .action-cards {
      display: flex;
      flex-direction: column;
      gap: var(--md-space-3);
    }

    .action-card {
      display: flex;
      align-items: center;
      gap: var(--md-space-4);
      width: 100%;
      padding: var(--md-space-4);
      background: var(--m3-surface);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .action-card:hover {
      border-color: var(--m3-primary);
      background: rgba(0, 34, 99, 0.03);
      transform: translateY(-1px);
      box-shadow: var(--md-elevation-2);
    }

    .action-card:active {
      transform: scale(0.98);
    }

    .action-icon {
      width: 52px;
      height: 52px;
      border-radius: var(--md-radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }

    .action-card:hover .action-icon {
      transform: scale(1.05);
    }

    .existing-icon {
      background: rgba(0, 34, 99, 0.08);
      color: var(--m3-primary);
    }

    .request-icon {
      background: rgba(220, 53, 69, 0.08);
      color: #dc3545;
    }

    .action-icon ion-icon {
      font-size: 26px;
    }

    .action-content {
      flex: 1;
      min-width: 0;
    }

    .action-content h3 {
      font-size: 15px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 3px;
      letter-spacing: -0.1px;
    }

    .action-content p {
      font-size: 13px;
      color: var(--m3-on-surface-muted);
      margin: 0;
      line-height: 1.4;
    }

    .action-arrow {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      color: var(--m3-on-surface-muted);
      opacity: 0.5;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .action-card:hover .action-arrow {
      opacity: 1;
      transform: translateX(2px);
    }

    .action-arrow svg {
      width: 100%;
      height: 100%;
    }

    /* Safe area for iOS */
    @supports (padding-bottom: env(safe-area-inset-bottom)) {
      .action-sheet-container {
        padding-bottom: calc(var(--md-space-8) + env(safe-area-inset-bottom));
      }
    }
  `],
})
export class InventoryActionSheetComponent {
  private modalCtrl = inject(ModalController);

  constructor() {
    addIcons({ cubeOutline, documentTextOutline, closeOutline });
  }

  selectAction(type: 'existing' | 'request'): void {
    this.modalCtrl.dismiss({ action: type });
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }
}
