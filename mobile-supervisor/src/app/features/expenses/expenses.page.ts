import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardContent,
  IonFab, IonFabButton, IonIcon, IonBadge, IonSkeletonText,
  IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { addOutline, walletOutline, timeOutline, receiptOutline } from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Expense, ExpenseStatus } from '../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar,
    IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardContent,
    IonFab, IonFabButton, IonIcon, IonBadge, IonSkeletonText,
    IonRefresher, IonRefresherContent, FormsModule, DatePipe, CurrencyPipe
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar><ion-title>Site Expenses</ion-title></ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Search expenses..." [(ngModel)]="searchQuery" (ionInput)="filterExpenses()"></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [(ngModel)]="statusFilter" (ionChange)="filterExpenses()" [value]="''">
          <ion-segment-button [value]="''"><ion-label>All</ion-label></ion-segment-button>
          <ion-segment-button value="Pending"><ion-label>Pending</ion-label></ion-segment-button>
          <ion-segment-button value="Approved"><ion-label>Approved</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="expenses-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshExpenses($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Cash Ledger Card -->
      <ion-card class="ledger-card">
        <ion-card-content>
          <div class="ledger-head">
            <div class="ledger-title">
              <ion-icon name="wallet-outline"></ion-icon>
              <span>Cash Ledger</span>
            </div>
            <span class="ledger-site">{{ selectedSiteName() || '' }}</span>
          </div>
          <div class="ledger-stats">
            <div class="ledger-stat ledger-added">
              <span class="stat-label">Cash Added</span>
              <span class="stat-value">{{ cashAdded() | currency:'INR':'symbol':'1.0-0' }}</span>
            </div>
            <div class="ledger-stat ledger-spent">
              <span class="stat-label">Spent</span>
              <span class="stat-value">{{ cashSpent() | currency:'INR':'symbol':'1.0-0' }}</span>
            </div>
            <div class="ledger-stat ledger-balance" [class.negative]="balance() < 0">
              <span class="stat-label">Balance</span>
              <span class="stat-value">{{ balance() | currency:'INR':'symbol':'1.0-0' }}</span>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      @if (isLoading() && expenses().length === 0) {
        @for (i of [1,2,3]; track i) {
          <ion-card class="skeleton">
            <ion-card-content>
              <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </ion-card-content>
          </ion-card>
        }
      } @else if (filteredExpenses().length === 0) {
        <div class="empty-state">
          <ion-icon name="wallet-outline"></ion-icon>
          <h3>No Expenses</h3>
          <p>Log a site expense to get started</p>
        </div>
      } @else {
        @for (expense of filteredExpenses(); track expense._id) {
          <ion-card
            class="expense-card"
            [class.cash-added]="expense.transactionType === 'Cash Added'"
            (click)="viewExpense(expense)"
          >
            <ion-card-content>
              <div class="expense-header">
                <div class="expense-info">
                  @if (expense.transactionType === 'Cash Added') {
                    <span class="type-pill cash-added">
                      <ion-icon name="cash-outline"></ion-icon>
                      Cash Added
                    </span>
                  } @else {
                    <span class="type-pill purchase">
                      <ion-icon name="card-outline"></ion-icon>
                      {{ expense.transactionType || 'Purchase' }}
                    </span>
                  }
                  <h3 class="expense-desc">{{ expense.description }}</h3>
                  <p class="expense-meta">{{ expense.site || 'General' }} • {{ expense.projectName || 'N/A' }}</p>
                </div>
                <ion-badge [color]="getStatusColor(expense.status)">{{ expense.status }}</ion-badge>
              </div>

              <div
                class="expense-amount"
                [class.cash-added]="expense.transactionType === 'Cash Added'"
              >
                {{ expense.amount | currency:'INR':'symbol':'1.0-0' }}
              </div>

              <div class="expense-details">
                @if (expense.reference) {
                  <span class="detail-tag">Ref: {{ expense.reference }}</span>
                }
                @if (expense.amountPaidBy) {
                  <span class="detail-tag">By: {{ expense.amountPaidBy }}</span>
                }
              </div>

              <div class="expense-footer">
                <div class="expense-date">
                  <ion-icon name="time-outline"></ion-icon>
                  {{ expense.date | date:'MMM d, yyyy' }}
                </div>
                @if (expense.status === 'Pending') {
                  <ion-badge color="warning">Awaiting Approval</ion-badge>
                }
                @if (expense.status === 'Approved') {
                  <ion-icon name="checkmark-circle-outline" color="success" class="approved-icon"></ion-icon>
                }
              </div>
            </ion-card-content>
          </ion-card>
        }
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="createExpense()">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); }
    .expenses-content { --background: var(--agb-off-white); }
    .expense-card {
      margin: 12px 16px;
      transition: all var(--agb-transition-fast);
      border-left: 3px solid #002263;
    }
    .expense-card.cash-added {
      border-left-color: #c9a227;
      background: #fffbeb;
    }
    .expense-card:active { transform: scale(0.98); }
    .expense-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px; }
    .expense-info { min-width: 0; flex: 1; }
    .type-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 9px;
      border-radius: 8px;
      margin-bottom: 6px;
    }
    .type-pill ion-icon { font-size: 12px; }
    .type-pill.cash-added { background: rgba(201, 162, 39, 0.18); color: #a8861f; }
    .type-pill.purchase { background: rgba(0, 34, 99, 0.08); color: #002263; }
    .expense-desc { font-size: 15px; font-weight: 600; color: var(--agb-navy); margin: 0 0 4px; }
    .expense-meta { font-size: 12px; color: var(--agb-gray); margin: 0; }
    .expense-amount { font-size: 26px; font-weight: 700; color: var(--agb-navy); margin-bottom: 12px; }
    .expense-amount.cash-added { color: #a8861f; }
    .expense-details { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .detail-tag { font-size: 11px; padding: 4px 8px; background: var(--agb-off-white); border-radius: var(--agb-radius-sm); color: var(--agb-dark-gray); }
    .expense-footer { display: flex; justify-content: space-between; align-items: center; }
    .expense-date { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--agb-gray); }
    .approved-icon { font-size: 20px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 32px; text-align: center; }
    .empty-state ion-icon { font-size: 64px; color: var(--agb-light-gray); margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; font-weight: 600; color: var(--agb-navy); margin: 0 0 8px; }
    .empty-state p { font-size: 14px; color: var(--agb-gray); margin: 0; }
    .skeleton { margin: 12px 16px; }
    ion-fab-button { --background: var(--agb-primary); --color: var(--agb-white); }

    /* Cash Ledger */
    .ledger-card {
      margin: 12px 16px 0;
      background: linear-gradient(135deg, #002263 0%, #0a3a8a 100%);
      color: #fff;
      border: 1px solid #001a4d;
    }
    .ledger-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .ledger-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; }
    .ledger-title ion-icon { font-size: 18px; color: #c9a227; }
    .ledger-site { font-size: 11px; opacity: 0.7; }
    .ledger-stats { display: flex; gap: 8px; }
    .ledger-stat { flex: 1; background: rgba(255, 255, 255, 0.08); padding: 10px 8px; border-radius: 8px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1); }
    .ledger-stat .stat-label { display: block; font-size: 10px; opacity: 0.7; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.3px; }
    .ledger-stat .stat-value { display: block; font-size: 14px; font-weight: 700; }
    .ledger-added .stat-value { color: #6ee7b7; }
    .ledger-spent .stat-value { color: #fca5a5; }
    .ledger-balance { background: rgba(201, 162, 39, 0.15); border-color: #c9a227; }
    .ledger-balance .stat-value { color: #f4d35e; }
    .ledger-balance.negative { background: rgba(220, 38, 38, 0.15); border-color: #dc2626; }
    .ledger-balance.negative .stat-value { color: #fca5a5; }
  `],
})
export class ExpensesPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);

  expenses = signal<Expense[]>([]);
  filteredExpenses = signal<Expense[]>([]);
  isLoading = signal(true);
  searchQuery = '';
  statusFilter: ExpenseStatus | '' = '';
  selectedSiteName = signal<string | null>(null);

  cashAdded = computed(() => this.expenses()
    .filter((e) => e.status === 'Approved' && e.transactionType === 'Cash Added')
    .reduce((sum, e) => sum + (e.amount || 0), 0)
  );

  cashSpent = computed(() => this.expenses()
    .filter((e) => e.status === 'Approved' && e.transactionType !== 'Cash Added')
    .reduce((sum, e) => sum + (e.amount || 0), 0)
  );

  balance = computed(() => this.cashAdded() - this.cashSpent());

  async ngOnInit(): Promise<void> {
    addIcons({ addOutline, walletOutline, timeOutline, receiptOutline });
    await this.supervisor.init();
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    await this.loadExpenses();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:site-changed', this.handleSiteChange);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:site-changed', this.handleSiteChange);
    }
  }

  private handleSiteChange = (): void => {
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    void this.loadExpenses();
  };

  async loadExpenses(): Promise<void> {
    this.isLoading.set(true);
    try {
      const projectId = this.supervisor.selectedProjectId();
      const siteId = this.supervisor.selectedSiteId();
      this.supervisor
        .getExpenses({
          projectId: projectId ?? undefined,
          siteId: siteId ?? undefined,
          type: 'site',
          limit: 100,
        })
        .subscribe({
          next: (r) => {
            this.expenses.set(r.expenses || []);
            this.filterExpenses();
            this.isLoading.set(false);
          },
          error: (err) => {
            console.error('[Expenses] failed to load', err);
            this.expenses.set([]);
            this.filterExpenses();
            this.isLoading.set(false);
          },
        });
    } catch (e) {
      console.error(e);
      this.isLoading.set(false);
    }
  }

  async refreshExpenses(event: CustomEvent): Promise<void> {
    await this.loadExpenses();
    (event.target as HTMLIonRefresherElement).complete();
  }

  filterExpenses(): void {
    let filtered = this.expenses();
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter((e) => e.description.toLowerCase().includes(q) || e.site?.toLowerCase().includes(q));
    }
    if (this.statusFilter) filtered = filtered.filter((e) => e.status === this.statusFilter);
    this.filteredExpenses.set(filtered);
  }

  viewExpense(expense: Expense): void { this.router.navigate(['/tabs/expenses', expense._id]); }
  createExpense(): void { this.router.navigate(['/tabs/expenses/create']); }

  getStatusColor(status: ExpenseStatus): string {
    return status === 'Pending' ? 'warning' : status === 'Approved' ? 'success' : 'danger';
  }
}