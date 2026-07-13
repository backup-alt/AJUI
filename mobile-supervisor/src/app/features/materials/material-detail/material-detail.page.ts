import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons,
  IonCard, IonCardContent, IonBadge, IonItem, IonLabel, IonList,
  IonInput, IonButton, IonSpinner
} from '@ionic/angular/standalone';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Material } from '../../../shared/models';

@Component({
  selector: 'app-material-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons,
    IonCard, IonCardContent, IonBadge, IonItem, IonLabel, IonList,
    IonInput, IonButton, IonSpinner
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/materials"></ion-back-button>
        </ion-buttons>
        <ion-title>Material Details</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="detail-content">
      @if (loading()) {
        <div class="loading-wrap"><ion-spinner name="crescent"></ion-spinner></div>
      } @else if (!material()) {
        <div class="empty-state"><p>Material not found.</p></div>
      } @else {
        <div class="detail-container">
          <div class="head">
            <h2 class="material-name">{{ material()!.name }}</h2>
            <ion-badge [color]="getStatusColor(material()!.status)">{{ material()!.status }}</ion-badge>
          </div>
          <p class="meta">{{ material()!.site }} • {{ material()!.projectName }}</p>

          <ion-card>
            <ion-card-content>
              <ion-list lines="none">
                <ion-item>
                  <ion-label>
                    <p>Requested</p>
                    <h3>{{ material()!.requestedQuantity }} {{ material()!.unit }}</h3>
                  </ion-label>
                </ion-item>
                @if (material()!.approvedQuantity) {
                  <ion-item>
                    <ion-label>
                      <p>Approved</p>
                      <h3>{{ material()!.approvedQuantity }} {{ material()!.unit }}</h3>
                    </ion-label>
                  </ion-item>
                }
                @if (material()!.vendor) {
                  <ion-item>
                    <ion-label>
                      <p>Vendor</p>
                      <h3>{{ material()!.vendor }}</h3>
                    </ion-label>
                  </ion-item>
                }
                @if (material()!.notes) {
                  <ion-item>
                    <ion-label>
                      <p>Notes</p>
                      <h3>{{ material()!.notes }}</h3>
                    </ion-label>
                  </ion-item>
                }
                <ion-item>
                  <ion-label>
                    <p>Request Date</p>
                    <h3>{{ material()!.requestDate | date:'MMM d, yyyy' }}</h3>
                  </ion-label>
                </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>

          <ion-card class="stock-card">
            <ion-card-content>
              <h3 class="stock-title">Update Stock</h3>
              <p class="stock-hint">Track purchased and consumed quantities. Remaining is calculated automatically.</p>

              <div class="stock-current">
                <div class="stock-stat">
                  <span class="stat-label">Purchased</span>
                  <span class="stat-val">{{ material()!.purchasedQuantity }} {{ material()!.unit }}</span>
                </div>
                <div class="stock-stat">
                  <span class="stat-label">Consumed</span>
                  <span class="stat-val">{{ material()!.consumedQuantity }} {{ material()!.unit }}</span>
                </div>
                <div class="stock-stat highlight">
                  <span class="stat-label">Remaining</span>
                  <span class="stat-val">{{ material()!.remainingStock }} {{ material()!.unit }}</span>
                </div>
              </div>

              <ion-item class="stock-input">
                <ion-label position="stacked">Purchased Quantity</ion-label>
                <ion-input
                  type="number"
                  placeholder="0"
                  [(ngModel)]="purchasedInput"
                  [clearInput]="true"
                ></ion-input>
              </ion-item>

              <ion-item class="stock-input">
                <ion-label position="stacked">Consumed Quantity</ion-label>
                <ion-input
                  type="number"
                  placeholder="0"
                  [(ngModel)]="consumedInput"
                  [clearInput]="true"
                ></ion-input>
              </ion-item>

              <ion-button
                expand="block"
                class="save-btn"
                [disabled]="saving()"
                (click)="saveStock()"
              >
                {{ saving() ? 'Saving…' : 'Save Stock' }}
              </ion-button>
            </ion-card-content>
          </ion-card>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .detail-content { --background: #f9fafb; }
    .detail-container { padding: 16px; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .empty-state { text-align: center; padding: 40px; color: #6b7280; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
    .material-name { font-size: 22px; font-weight: 700; color: #002263; margin: 0; }
    .meta { font-size: 12px; color: #6b7280; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.3px; }
    ion-card { margin: 0 0 12px; border: 1px solid #e5e7eb; box-shadow: none; border-radius: 8px; }
    .stock-title { font-size: 16px; font-weight: 600; color: #002263; margin: 0 0 4px; }
    .stock-hint { font-size: 12px; color: #6b7280; margin: 0 0 14px; }
    .stock-current { display: flex; gap: 8px; margin-bottom: 16px; }
    .stock-stat { flex: 1; background: #f3f4f6; padding: 10px 8px; border-radius: 8px; text-align: center; }
    .stock-stat.highlight { background: #fffbeb; border: 1px solid #c9a227; }
    .stock-stat .stat-label { display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
    .stock-stat .stat-val { display: block; font-size: 14px; font-weight: 700; color: #002263; }
    .stock-stat.highlight .stat-val { color: #c9a227; }
    .stock-input { --background: #fff; --border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px; }
    .save-btn { --background: #002263; --color: #fff; --border-radius: 8px; margin-top: 8px; font-weight: 600; }
  `],
})
export class MaterialDetailPage implements OnInit {
  material = signal<Material | null>(null);
  loading = signal(true);
  saving = signal(false);
  purchasedInput: number | null = null;
  consumedInput: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supervisor: SupervisorService,
    private toast: ToastController,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.load(id);
  }

  load(id: string) {
    this.loading.set(true);
    this.supervisor.getMaterialDetail(id).subscribe({
      next: (res) => {
        this.material.set(res.material);
        this.purchasedInput = res.material.purchasedQuantity || 0;
        this.consumedInput = res.material.consumedQuantity || 0;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Failed to load material', true);
      },
    });
  }

  saveStock() {
    const m = this.material();
    if (!m) return;
    this.saving.set(true);
    this.supervisor.updateMaterialStock(m._id, {
      purchasedQuantity: this.purchasedInput || 0,
      consumedQuantity: this.consumedInput || 0,
    }).subscribe({
      next: (res) => {
        this.material.set(res.material);
        this.saving.set(false);
        this.showToast('Stock updated', false);
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Failed to update stock', true);
      },
    });
  }

  getStatusColor(status: string): string {
    if (status === 'Pending') return 'warning';
    if (status === 'Approved') return 'success';
    return 'danger';
  }

  private async showToast(message: string, isError: boolean) {
    const t = await this.toast.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: isError ? 'danger' : 'success',
    });
    t.present();
  }
}
