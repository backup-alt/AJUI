import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import {
  IonContent, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonFab, IonFabButton,
  IonIcon, IonSkeletonText, IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  addOutline, walletOutline, timeOutline, receiptOutline,
  chevronForwardOutline, cashOutline, cardOutline, locationOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Expense, ExpenseStatus } from '../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';
import {
  PageHeaderComponent,
  EmptyStateComponent,
  StatusPillComponent,
} from '../../shared/components';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    IonContent, IonSearchbar,
    IonSegment, IonSegmentButton, IonLabel, IonFab, IonFabButton,
    IonIcon, IonSkeletonText, IonRefresher, IonRefresherContent,
    FormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, EmptyStateComponent, StatusPillComponent,
  ],
  template: `
    <ion-content class="expenses-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshExpenses($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <app-page-header
        title="Site expenses"
        subtitle="Across all assigned sites"
      ></app-page-header>

      <div class="filter-stack">
        <ion-searchbar
          placeholder="Search expenses"
          [(ngModel)]="searchQuery"
          (ionInput)="filterExpenses()"
        ></ion-searchbar>
        <div class="seg-wrap">
          <ion-segment [(ngModel)]="statusFilter" (ionChange)="filterExpenses()" [value]="''">
            <ion-segment-button [value]="''"><ion-label>All</ion-label></ion-segment-button>
            <ion-segment-button value="Pending"><ion-label>Pending</ion-label></ion-segment-button>
            <ion-segment-button value="Approved"><ion-label>Approved</ion-label></ion-segment-button>
          </ion-segment>
        </div>
      </div>

      <!-- Cash Ledger card -->
      <div class="ledger-card">
        <header class="ledger-head">
          <span class="ledger-title">
            <ion-icon name="wallet-outline"></ion-icon>
            Cash ledger
          </span>
          <span class="ledger-site">All assigned sites</span>
        </header>
        <div class="ledger-stats">
          <div class="ledger-stat added">
            <div class="stat-label">Cash added</div>
            <div class="stat-value">{{ cashAdded() | currency:'INR':'symbol':'1.0-0' }}</div>
          </div>
          <div class="ledger-stat spent">
            <div class="stat-label">Spent</div>
            <div class="stat-value">{{ cashSpent() | currency:'INR':'symbol':'1.0-0' }}</div>
          </div>
          <div class="ledger-stat balance" [class.negative]="balance() < 0">
            <div class="stat-label">Balance</div>
            <div class="stat-value">{{ balance() | currency:'INR':'symbol':'1.0-0' }}</div>
          </div>
        </div>
      </div>

      <div class="cards">
        @if (isLoading() && expenses().length === 0) {
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 40%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </div>
          }
        } @else if (filteredExpenses().length === 0) {
          <app-empty-state
            icon="wallet-outline"
            title="No expenses yet"
            message="Log a site expense or cash top-up to get started."
          ></app-empty-state>
        } @else {
          @for (expense of filteredExpenses(); track expense._id) {
            <button
              class="expense-card"
              [class.cash-added]="expense.transactionType === 'Cash Added'"
              (click)="viewExpense(expense)"
            >
              <header class="expense-head">
                <div class="expense-info">
                  <app-status-pill
                    [tone]="expense.transactionType === 'Cash Added' ? 'warning' : 'info'"
                    [icon]="expense.transactionType === 'Cash Added' ? 'cash-outline' : 'card-outline'"
                  >
                    {{ expense.transactionType || 'Purchase' }}
                  </app-status-pill>
                  <h3 class="expense-desc">{{ expense.description }}</h3>
                  <p class="expense-meta">
                    <ion-icon name="location-outline"></ion-icon>
                    {{ expense.site || 'General' }} - {{ expense.projectName || 'N/A' }}
                  </p>
                </div>
                <app-status-pill [tone]="getStatusTone(expense.status)">{{ expense.status }}</app-status-pill>
              </header>

              <div class="expense-amount-row">
                <div
                  class="expense-amount"
                  [class.cash-added]="expense.transactionType === 'Cash Added'"
                >
                  {{ expense.amount | currency:'INR':'symbol':'1.0-0' }}
                </div>
              </div>

              <footer class="expense-footer">
                <div class="expense-date">
                  <ion-icon name="time-outline"></ion-icon>
                  {{ expense.date | date:'MMM d, yyyy' }}
                </div>
                <span class="view-link">
                  View
                  <ion-icon name="chevron-forward-outline"></ion-icon>
                </span>
              </footer>
            </button>
          }
        }
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="createExpense()">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .expenses-content { --background: #f5f6f8; }
    .filter-stack { padding: 0 16px 8px; }
    .seg-wrap { padding: 4px 4px 8px; }

    .ledger-card {
      margin: 8px 16px 14px;
      background: #002263;
      color: #ffffff;
      border-radius: 20px;
      padding: 16px 18px;
      box-shadow: 0 12px 28px -12px rgba(0, 34, 99, 0.45);
    }
    .ledger-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .ledger-title {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .ledger-title ion-icon { font-size: 16px; color: #c9a227; }
    .ledger-site { font-size: 11px; opacity: 0.65; }
    .ledger-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .ledger-stat {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.10);
      padding: 10px 8px;
      border-radius: 12px;
      text-align: center;
    }
    .stat-label { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.3px; }
    .stat-value { font-size: 14px; font-weight: 700; margin-top: 4px; }
    .ledger-stat.added .stat-value { color: #86efac; }
    .ledger-stat.spent .stat-value { color: #fca5a5; }
    .ledger-stat.balance { background: rgba(201, 162, 39, 0.18); border-color: rgba(201, 162, 39, 0.40); }
    .ledger-stat.balance .stat-value { color: #f4d35e; }
    .ledger-stat.balance.negative { background: rgba(220, 38, 38, 0.20); border-color: rgba(220, 38, 38, 0.40); }
    .ledger-stat.balance.negative .stat-value { color: #fca5a5; }

    .cards { padding: 0 16px 96px; }
    .expense-card {
      width: 100%; text-align: left;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 14px 16px;
      margin-bottom: 10px;
      box-shadow: var(--agb-shadow-2xs);
      cursor: pointer;
      font-family: inherit;
      border-left: 3px solid #c9a227;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .expense-card.cash-added {
      background: linear-gradient(180deg, #fffbeb 0%, #ffffff 60%);
      border-left-color: #c9a227;
    }
    .expense-card:active { transform: scale(0.99); }
    .expense-card:hover { box-shadow: var(--agb-shadow-sm); }

    .expense-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .expense-info { flex: 1; min-width: 0; }
    .expense-desc { font-size: 15px; font-weight: 700; color: #0f172a; margin: 6px 0 4px; }
    .expense-meta { font-size: 12px; color: #64748b; margin: 0; display: inline-flex; align-items: center; gap: 4px; }
    .expense-meta ion-icon { font-size: 12px; }

    .expense-amount-row { margin-bottom: 12px; }
    .expense-amount { font-size: 24px; font-weight: 800; color: #002263; line-height: 1.1; }
    .expense-amount.cash-added { color: #a8861f; }
    .expense-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .tag {
      font-size: 11px; padding: 4px 8px; background: #f1f5f9;
      color: #475569; border-radius: 8px; font-weight: 500;
    }

    .expense-footer { display: flex; align-items: center; justify-content: space-between; }
    .expense-date { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .expense-date ion-icon { font-size: 13px; }
    .view-link { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; color: #002263; }
    .view-link ion-icon { font-size: 14px; }

    .skeleton-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 10px;
    }
    ion-fab-button { --background: #002263; --color: #ffffff; }
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
    addIcons({
      addOutline, walletOutline, timeOutline, receiptOutline, chevronForwardOutline,
      cashOutline, cardOutline, locationOutline,
    });
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
      this.supervisor
        .getExpenses({
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

  getStatusTone(status: ExpenseStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    return status === 'Pending' ? 'warning' : status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'neutral';
  }
}
