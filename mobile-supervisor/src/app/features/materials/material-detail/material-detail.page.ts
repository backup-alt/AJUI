import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons,
  IonInput, IonButton, IonSpinner, IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cubeOutline, timeOutline, businessOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Material } from '../../../shared/models';
import { DatePipe } from '@angular/common';
import { StatusPillComponent } from '../../../shared/components';

@Component({
  selector: 'app-material-detail',
  standalone: true,
  imports: [
    FormsModule, DatePipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons,
    IonInput, IonButton, IonSpinner, IonIcon,
    StatusPillComponent,
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/materials" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Material</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="detail-content">
      @if (loading()) {
        <div class="loading-wrap"><ion-spinner name="crescent"></ion-spinner></div>
      } @else if (!material()) {
        <div class="empty-state"><p>Material not found.</p></div>
      } @else {
        <div class="detail-container">
          <div class="hero">
            <span class="hero-tile"><ion-icon name="cube-outline"></ion-icon></span>
            <div class="hero-body">
              <h2 class="material-name">{{ material()!.name }}</h2>
              <p class="meta">
                <ion-icon name="business-outline"></ion-icon>
                {{ material()!.site }} - {{ material()!.projectName }}
              </p>
            </div>
            <app-status-pill [tone]="getStatusTone(material()!.status)">{{ material()!.status }}</app-status-pill>
          </div>

          <div class="card">
            <h3 class="card-title">Request details</h3>
            <div class="kv-list">
              <div class="kv">
                <span class="kv-label">Requested</span>
                <span class="kv-value">{{ material()!.requestedQuantity }} {{ material()!.unit }}</span>
              </div>
              @if (material()!.approvedQuantity) {
                <div class="kv">
                  <span class="kv-label">Approved</span>
                  <span class="kv-value">{{ material()!.approvedQuantity }} {{ material()!.unit }}</span>
                </div>
              }
              @if (material()!.vendor) {
                <div class="kv">
                  <span class="kv-label">Vendor</span>
                  <span class="kv-value">{{ material()!.vendor }}</span>
                </div>
              }
              @if (material()!.poNumber) {
                <div class="kv">
                  <span class="kv-label">PO Number</span>
                  <span class="kv-value po-value">{{ material()!.poNumber }}</span>
                </div>
              }
              <div class="kv">
                <span class="kv-label">Request date</span>
                <span class="kv-value">{{ material()!.requestDate | date:'MMM d, yyyy' }}</span>
              </div>
              @if (material()!.notes) {
                <div class="kv">
                  <span class="kv-label">Notes</span>
                  <span class="kv-value">{{ material()!.notes }}</span>
                </div>
              }
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">Live stock</h3>
            <p class="card-sub">Track purchased and consumed quantities. Remaining is calculated automatically.</p>
            <div class="stock-grid">
              <div class="stock-stat">
                <div class="stat-label">Purchased</div>
                <div class="stat-val">{{ material()!.purchasedQuantity }} {{ material()!.unit }}</div>
              </div>
              <div class="stock-stat">
                <div class="stat-label">Consumed</div>
                <div class="stat-val">{{ material()!.consumedQuantity }} {{ material()!.unit }}</div>
              </div>
              <div class="stock-stat highlight">
                <div class="stat-label">Remaining</div>
                <div class="stat-val">{{ material()!.remainingStock }} {{ material()!.unit }}</div>
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Purchased quantity</label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="purchasedInput"
                [clearInput]="true"
              ></ion-input>
            </div>
            <div class="form-field">
              <label class="form-label">Consumed quantity</label>
              <ion-input
                type="number"
                placeholder="0"
                [(ngModel)]="consumedInput"
                [clearInput]="true"
              ></ion-input>
            </div>

            <ion-button
              expand="block"
              class="primary-btn"
              [disabled]="saving()"
              (click)="saveStock()"
            >
              @if (saving()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                <ion-icon name="checkmark-circle-outline" slot="end"></ion-icon>
                <span>Save stock</span>
              }
            </ion-button>
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); --border-color: var(--agb-light-gray); }
    .detail-content { --background: #f5f6f8; }
    .detail-container { padding: 16px; max-width: 560px; margin: 0 auto; }

    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .empty-state { text-align: center; padding: 60px 20px; color: #64748b; }

    .hero {
      display: flex; align-items: flex-start; gap: 12px;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 14px 16px;
      margin-bottom: 12px;
      box-shadow: var(--agb-shadow-2xs);
    }
    .hero-tile {
      width: 44px; height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(220, 38, 38, 0.10), rgba(220, 38, 38, 0.04));
      color: #b91c1c;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .hero-tile ion-icon { font-size: 20px; }
    .hero-body { flex: 1; min-width: 0; }
    .material-name { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px; letter-spacing: -0.2px; }
    .meta { font-size: 12px; color: #64748b; margin: 0; display: inline-flex; align-items: center; gap: 4px; }
    .meta ion-icon { font-size: 12px; }

    .card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 16px 18px;
      margin-bottom: 12px;
      box-shadow: var(--agb-shadow-2xs);
    }
    .card-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .card-sub { font-size: 13px; color: #64748b; margin: 0 0 14px; line-height: 1.5; }

    .kv-list { display: flex; flex-direction: column; gap: 8px; }
    .kv {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 10px 12px;
      background: #f8fafc;
      border-radius: 12px;
    }
    .kv-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; }
    .kv-value { font-size: 14px; font-weight: 600; color: #0f172a; text-align: right; }
    .kv-value.po-value {
      color: #15803d;
      background: rgba(22, 163, 74, 0.10);
      padding: 3px 10px;
      border-radius: 999px;
      font-weight: 700;
    }

    .stock-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
    .stock-stat {
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 12px;
      padding: 12px 8px;
      text-align: center;
    }
    .stock-stat .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
    .stock-stat .stat-val { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .stock-stat.highlight { background: #fffbeb; border-color: rgba(201, 162, 39, 0.30); }
    .stock-stat.highlight .stat-val { color: #a8861f; }

    .form-field { margin-bottom: 12px; }
    .form-label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin: 0 4px 6px; }

    .primary-btn {
      --background: #002263; --color: #ffffff; --border-radius: 14px;
      font-weight: 700; height: 50px; margin-top: 4px;
    }
    .primary-btn:hover { --background: #001a4d; }
  `],
})
export class MaterialDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supervisor = inject(SupervisorService);
  private toast = inject(ToastController);

  material = signal<Material | null>(null);
  loading = signal(true);
  saving = signal(false);
  purchasedInput: number | null = null;
  consumedInput: number | null = null;

  ngOnInit() {
    addIcons({ cubeOutline, timeOutline, businessOutline, checkmarkCircleOutline });
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
      next: (res: { material: Material }) => {
        this.material.set(res.material);
        this.purchasedInput = res.material.purchasedQuantity || 0;
        this.consumedInput = res.material.consumedQuantity || 0;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        void this.showToast('Failed to load material', true);
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
      next: (res: any) => {
        const updated = res?.material || res;
        if (updated && updated._id) {
          this.material.set(updated);
        }
        this.saving.set(false);
        void this.showToast('Stock updated', false);
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to update stock';
        void this.showToast(msg, true);
      },
    });
  }

  getStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
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
    await t.present();
  }
}
