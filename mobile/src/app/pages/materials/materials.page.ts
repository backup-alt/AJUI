import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cubeOutline, addOutline } from 'ionicons/icons';

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [IonButton, IonIcon],
  template: `
    <div class="materials-wrapper">
      <div class="hero">
        <ion-icon name="cube-outline" class="hero-icon"></ion-icon>
        <h2>Material Requests</h2>
        <p>Log material requests for approval by admin / project manager.</p>
      </div>

      <ion-button
        expand="block"
        class="add-existing-btn"
        (click)="openAddExisting()">
        <ion-icon name="add-outline" slot="start"></ion-icon>
        Add Existing Material
      </ion-button>

      <p class="hint">
        Use "Add Existing Material" to record materials that <strong>already exist</strong>
        at the site. No approval is needed — saved directly to inventory.
      </p>

      <div class="placeholder-list">
        <h3>Coming Soon</h3>
        <ul>
          <li>Full material request form</li>
          <li>List with filters and status</li>
          <li>Detail view with timeline</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .materials-wrapper {
      padding: 20px 16px;
      max-width: 600px;
      margin: 0 auto;
    }
    .hero {
      text-align: center;
      margin-bottom: 24px;
    }
    .hero-icon {
      font-size: 56px;
      color: var(--agb-primary, #2563eb);
      margin-bottom: 8px;
    }
    .hero h2 {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
      margin: 8px 0;
    }
    .hero p {
      font-size: 14px;
      color: #64748b;
    }
    .add-existing-btn {
      --background: var(--agb-gradient-primary, linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%));
      font-weight: 700;
      height: 52px;
      margin-bottom: 16px;
    }
    .hint {
      font-size: 13px;
      color: #475569;
      text-align: center;
      margin-bottom: 24px;
      padding: 12px;
      background: #f1f5f9;
      border-radius: 8px;
    }
    .placeholder-list {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    .placeholder-list h3 {
      font-size: 14px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .placeholder-list ul {
      margin: 0;
      padding-left: 20px;
      color: #64748b;
      font-size: 13px;
      line-height: 1.6;
    }
  `],
})
export class MaterialsPage {
  constructor(private router: Router) {
    addIcons({ 'cube-outline': cubeOutline, 'add-outline': addOutline });
  }

  openAddExisting() {
    this.router.navigate(['/add-existing-material']);
  }
}