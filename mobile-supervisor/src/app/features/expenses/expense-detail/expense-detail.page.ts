import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
  alertCircleOutline,
  cashOutline,
  calendarOutline,
  documentTextOutline,
  cardOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Expense } from '../../../shared/models';

@Component({
  selector: 'app-expense-detail',
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
          <ion-back-button default-href="/tabs/expenses" color="primary"></ion-back-button>
        </ion-buttons>
        <ion-title>Expense Details</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="detail-content">
      @if (loading()) {
        <div class="loading">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (!expense()) {
        <div class="empty-state">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <p>Expense not found.</p>
        </div>
      } @else {
        <div class="container">
          <div class="head">
            <div class="head-left">
              <span class="type-badge" [class.cash-added]="isCashAdded()" [class.purchase]="isPurchase()">
                <ion-icon [name]="isCashAdded() ? 'cash-outline' : 'card-outline'"></ion-icon>
                {{ transactionLabel() | titlecase }}
              </span>
              <h2 class="desc">{{ expense()!.description }}</h2>
              <p class="site">
                <ion-icon name="location-outline"></ion-icon>
                {{ expense()!.site || 'General' }} - {{ expense()!.projectName || 'N/A' }}
              </p>
            </div>
            <ion-badge [color]="getStatusColor(expense()!.status)">
              {{ expense()!.status | titlecase }}
            </ion-badge>
          </div>

          <div class="amount-block" [class.cash-added]="isCashAdded()">
            <div class="amount-label">
              @if (isCashAdded()) {
                Cash Added
              } @else {
                Purchase Amount
              }
            </div>
            <div class="amount-value">
              {{ expense()!.amount | currency: 'INR': 'symbol': '1.0-0' }}
            </div>
          </div>

          <ion-card>
            <ion-card-content>
              <ion-list lines="none">
                <ion-item>
                  <ion-icon name="calendar-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>Date</p>
                    <h3>{{ expense()!.date | date: 'EEE, MMM d, y' }}</h3>
                  </ion-label>
                </ion-item>
                @if (expense()!.transactionType && isPurchase()) {
                  <ion-item>
                    <ion-icon name="card-outline" slot="start" color="primary"></ion-icon>
                    <ion-label>
                      <p>Category</p>
                      <h3>{{ expense()!.transactionType }}</h3>
                    </ion-label>
                  </ion-item>
                }
                @if (expense()!.reference) {
                  <ion-item>
                    <ion-icon name="document-text-outline" slot="start" color="primary"></ion-icon>
                    <ion-label>
                      <p>Reference</p>
                      <h3>{{ expense()!.reference }}</h3>
                    </ion-label>
                  </ion-item>
                }
                @if (expense()!.amountPaidBy) {
                  <ion-item>
                    <ion-icon name="wallet-outline" slot="start" color="primary"></ion-icon>
                    <ion-label>
                      <p>Paid By</p>
                      <h3>{{ expense()!.amountPaidBy }}</h3>
                    </ion-label>
                  </ion-item>
                }
                <ion-item>
                  <ion-icon name="time-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>Submitted</p>
                    <h3>{{ expense()!.createdAt | date: 'MMM d, y, h:mm a' }}</h3>
                  </ion-label>
                </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>

          @if (expense()!.notes) {
            <ion-card>
              <ion-card-header>
                <ion-card-title>Notes</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <p class="notes">{{ expense()!.notes }}</p>
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
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }
    .head-left { flex: 1; min-width: 0; }
    .type-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 11px;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .type-badge ion-icon { font-size: 13px; }
    .type-badge.cash-added {
      background: rgba(201, 162, 39, 0.15);
      color: #a8861f;
    }
    .type-badge.purchase {
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
    }
    .desc {
      font-size: 22px;
      font-weight: 700;
      color: #002263;
      margin: 0 0 4px;
    }
    .site {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #6b7280;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .site ion-icon { font-size: 13px; }
    .amount-block {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-left: 3px solid #002263;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 12px;
    }
    .amount-block.cash-added {
      border-left-color: #c9a227;
    }
    .amount-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .amount-value {
      font-size: 32px;
      font-weight: 700;
      color: #002263;
      line-height: 1;
    }
    .amount-block.cash-added .amount-value { color: #a8861f; }
    ion-card {
      margin: 0 0 12px;
      border: 1px solid #e5e7eb;
      box-shadow: none;
    }
    ion-card-title { font-size: 14px; font-weight: 700; color: #002263; }
    ion-item h3 { font-size: 14px; font-weight: 500; color: #111827; margin: 2px 0 0; }
    ion-item p { font-size: 11px; color: #6b7280; margin: 0; text-transform: uppercase; letter-spacing: 0.3px; }
    .notes { font-size: 14px; color: #111827; margin: 0; line-height: 1.5; }
  `],
})
export class ExpenseDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supervisor = inject(SupervisorService);
  private toastCtrl = inject(ToastController);

  expense = signal<Expense | null>(null);
  loading = signal(true);

  isCashAdded = computed(() => this.expense()?.transactionType === 'Cash Added');
  isPurchase = computed(() =>
    !!this.expense() && this.expense()!.transactionType !== 'Cash Added'
  );

  transactionLabel = computed(() => {
    if (!this.expense()) return '';
    if (this.expense()!.transactionType === 'Cash Added') return 'Cash Added';
    return this.expense()!.transactionType || 'Purchase';
  });

  async ngOnInit(): Promise<void> {
    addIcons({
      locationOutline,
      businessOutline,
      timeOutline,
      alertCircleOutline,
      cashOutline,
      calendarOutline,
      documentTextOutline,
      cardOutline,
    });
    await this.load();
  }

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
    this.supervisor.getExpenseDetail(id).subscribe({
      next: (res) => {
        this.expense.set(res.expense);
        this.loading.set(false);
      },
      error: async (err) => {
        this.loading.set(false);
        const toast = await this.toastCtrl.create({
          message: err?.message || 'Failed to load expense',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }
}
