import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonBadge,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonIcon,
  ToastController,
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  locationOutline,
  businessOutline,
  timeOutline,
  peopleOutline,
  alertCircleOutline,
  cashOutline,
  calendarOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Labour } from '../../../shared/models';

@Component({
  selector: 'app-labour-detail',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonBadge,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonIcon,
    DatePipe,
    CurrencyPipe,
    TitleCasePipe,
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Labour Details</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="detail-content">
      @if (loading()) {
        <div class="loading">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (!labour()) {
        <div class="empty-state">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <p>Labour entry not found.</p>
        </div>
      } @else {
        <div class="container">
          <div class="head">
            <h2 class="party">{{ labour()!.partyName }}</h2>
            <ion-badge [color]="getStatusColor(labour()!.status)">
              {{ labour()!.status | titlecase }}
            </ion-badge>
          </div>
          <p class="site">
            <ion-icon name="location-outline"></ion-icon>
            {{ labour()!.site }} · {{ labour()!.projectName }}
          </p>

          <ion-card>
            <ion-card-content>
              <ion-list lines="none">
                <ion-item>
                  <ion-icon name="calendar-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>Attendance Date</p>
                    <h3>{{ labour()!.attendanceDate | date: 'EEE, MMM d, y' }}</h3>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-icon name="people-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>Present</p>
                    <h3>{{ labour()!.presentCount }} worker{{ labour()!.presentCount !== 1 ? 's' : '' }}</h3>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-icon name="cash-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>Daily Wage</p>
                    <h3>{{ labour()!.dailyWage | currency: 'INR': 'symbol': '1.0-0' }}</h3>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-icon name="time-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>Shift</p>
                    <h3>{{ labour()!.shift }}</h3>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-icon name="business-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>Category</p>
                    <h3>{{ labour()!.category }}</h3>
                  </ion-label>
                </ion-item>
                @if (labour()!.paymentMode) {
                  <ion-item>
                    <ion-icon name="card-outline" slot="start" color="primary"></ion-icon>
                    <ion-label>
                      <p>Payment Mode</p>
                      <h3>{{ labour()!.paymentMode }}</h3>
                    </ion-label>
                  </ion-item>
                }
              </ion-list>
            </ion-card-content>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>Summary</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="summary-row">
                <div class="summary-stat">
                  <span class="stat-label">Days</span>
                  <span class="stat-value">{{ labour()!.presentDays }}</span>
                </div>
                <div class="summary-stat">
                  <span class="stat-label">Absent</span>
                  <span class="stat-value">{{ labour()!.absentDays }}</span>
                </div>
                <div class="summary-stat">
                  <span class="stat-label">Overtime</span>
                  <span class="stat-value">{{ labour()!.overtime }}</span>
                </div>
                <div class="summary-stat">
                  <span class="stat-label">Late Fine</span>
                  <span class="stat-value">{{ labour()!.lateFine | currency: 'INR': 'symbol': '1.0-0' }}</span>
                </div>
              </div>
              <div class="total-amount">
                <span>Total</span>
                <strong>{{ totalAmount() | currency: 'INR': 'symbol': '1.0-0' }}</strong>
              </div>
            </ion-card-content>
          </ion-card>

          @if (labour()!.notes) {
            <ion-card>
              <ion-card-header>
                <ion-card-title>Notes</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <p class="notes">{{ labour()!.notes }}</p>
              </ion-card-content>
            </ion-card>
          }

          @if (labourTypes().length > 0) {
            <ion-card>
              <ion-card-header>
                <ion-card-title>Labour Types</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="type-chips">
                  @for (t of labourTypes(); track t.name) {
                    <span class="type-chip">
                      <strong>{{ t.name }}</strong>
                      <span class="type-meta">
                        {{ t.staffCount || 0 }} · {{ t.dailyWage | currency: 'INR': 'symbol': '1.0-0' }}/day
                      </span>
                    </span>
                  }
                </div>
              </ion-card-content>
            </ion-card>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); --border-color: var(--agb-light-gray); }
    .detail-content { --background: #f5f6f8; }
    .container { padding: 16px; }
    .loading { display: flex; justify-content: center; padding: 48px; }
    .empty-state {
      text-align: center;
      padding: 64px 24px;
      color: #6b7280;
    }
    .empty-state ion-icon { font-size: 48px; color: #9ca3af; margin-bottom: 12px; }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 4px;
    }
    .party {
      font-size: 22px;
      font-weight: 700;
      color: #002263;
      margin: 0;
    }
    .site {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #6b7280;
      margin: 0 0 16px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .site ion-icon { font-size: 13px; }
    ion-card {
      margin: 0 0 12px;
      border: 1px solid #e5e7eb;
      box-shadow: none;
    }
    ion-card-title { font-size: 14px; font-weight: 700; color: #002263; }
    ion-item h3 { font-size: 14px; font-weight: 500; color: #111827; margin: 2px 0 0; }
    ion-item p { font-size: 11px; color: #6b7280; margin: 0; text-transform: uppercase; letter-spacing: 0.3px; }
    .summary-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .summary-stat {
      background: #f8f9fa;
      padding: 10px 6px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-label { display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
    .stat-value { display: block; font-size: 14px; font-weight: 700; color: #002263; }
    .total-amount {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0 0;
      border-top: 1px solid #f1f3f5;
      font-size: 13px;
      color: #6b7280;
    }
    .total-amount strong {
      font-size: 22px;
      color: #002263;
      font-weight: 700;
    }
    .notes { font-size: 14px; color: #111827; margin: 0; line-height: 1.5; }
    .type-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .type-chip {
      display: flex;
      flex-direction: column;
      padding: 8px 12px;
      background: #f8f9fa;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .type-chip strong { font-size: 12px; color: #002263; }
    .type-meta { font-size: 11px; color: #6b7280; }
  `],
})
export class LabourDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supervisor = inject(SupervisorService);
  private toastCtrl = inject(ToastController);

  labour = signal<Labour | null>(null);
  loading = signal(true);

  async ngOnInit(): Promise<void> {
    addIcons({
      locationOutline,
      businessOutline,
      timeOutline,
      peopleOutline,
      alertCircleOutline,
      cashOutline,
      calendarOutline,
    });
    await this.load();
  }

  ngOnDestroy(): void {
    // No-op for now.
  }

  totalAmount = (): number => {
    const l = this.labour();
    if (!l) return 0;
    return (l.dailyWage || 0) * (l.presentCount || 0) + (l.overtime || 0) - (l.lateFine || 0);
  };

  labourTypes = (): { name: string; dailyWage?: number; staffCount?: number }[] => {
    const l = this.labour();
    if (!l || !l.laborTypes) return [];
    return l.laborTypes;
  };

  getStatusColor(status: string): string {
    switch (status) {
      case 'Pending': return 'warning';
      case 'Approved': return 'success';
      case 'Rejected': return 'danger';
      default: return 'medium';
    }
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.supervisor.getLabourDetail(id).subscribe({
      next: (res) => {
        this.labour.set(res.labour);
        this.loading.set(false);
      },
      error: async (err) => {
        this.loading.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to load labour entry',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
