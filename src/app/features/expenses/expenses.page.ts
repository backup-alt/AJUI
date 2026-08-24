import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonContent, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonFab, IonFabButton,
  IonIcon, IonSkeletonText, IonRefresher, IonRefresherContent,
  IonInfiniteScroll, IonInfiniteScrollContent,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  addOutline, walletOutline, timeOutline, receiptOutline,
  chevronForwardOutline, cashOutline, cardOutline, locationOutline,
  close, documentTextOutline,
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
    IonInfiniteScroll, IonInfiniteScrollContent,
    FormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, EmptyStateComponent, StatusPillComponent,
  ],
  template: `
    <ion-content class="expenses-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshExpenses($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <app-page-header
        title="Project expenses"
        subtitle="Across all assigned projects"
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
            <span class="ledger-site">All assigned projects</span>
        </header>
        <div class="ledger-stats">
          <div class="ledger-stat added">
            <div class="stat-label">Cash Added</div>
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
            message="Log a project expense or cash top-up to get started."
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
                    {{ expense.transactionType === 'Cash Added' ? 'Add Cash' : (expense.transactionType || 'Purchase') }}
                 </app-status-pill>
                  <h3 class="expense-desc">{{ expense.description }}</h3>
                  <p class="expense-meta">
                    <ion-icon name="location-outline"></ion-icon>
                  {{ expense.projectName || 'General' }}
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

              @if (expense.billUrl) {
                <div class="expense-bill-thumb" (click)="openBillViewer(expense.billUrl!); $event.stopPropagation(); $event.preventDefault()">
                  <img [src]="expense.billUrl" alt="Bill" class="expense-bill-img" />
                  <span class="expense-bill-label">
                    <ion-icon name="document-text-outline"></ion-icon>
                    View Bill
                  </span>
                </div>
              }

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

      <ion-infinite-scroll
        threshold="160px"
        [disabled]="!nextCursor() || isLoading() || isLoadingMore()"
        (ionInfinite)="loadMoreExpenses($event)"
      >
        <ion-infinite-scroll-content loadingSpinner="dots"></ion-infinite-scroll-content>
      </ion-infinite-scroll>

      @if (viewerUrl()) {
        <div class="bill-viewer-overlay" (click)="closeBillViewer($event)">
          <button class="bill-viewer-close" (click)="closeBillViewer($event)">
            <ion-icon name="close"></ion-icon>
          </button>
          <div class="bill-viewer-img-wrap"
               (touchstart)="onPinchStart($event)"
               (touchmove)="onPinchMove($event)"
               (touchend)="onPinchEnd($event)"
               (touchcancel)="onPinchEnd($event)"
               (mousedown)="onDragStart($event)"
               (mousemove)="onDragMove($event)"
               (mouseup)="onDragEnd()"
               (mouseleave)="onDragEnd()"
               (dblclick)="toggleZoom($event)">
            <img [src]="viewerUrl()" alt="Bill" class="bill-viewer-img"
                 [style.transform]="'translate(' + panX + 'px,' + panY + 'px) scale(' + zoomScale + ')'"
                 (dragstart)="$event.preventDefault()" />
          </div>
        </div>
      }
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

    .expense-bill-thumb {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 12px; padding: 8px;
      background: #f8f9fb; border-radius: 12px;
      border: 1px solid #eef0f3; cursor: pointer;
    }
    .expense-bill-thumb:active { background: #eef0f3; }
    .expense-bill-img {
      width: 44px; height: 44px; border-radius: 8px;
      object-fit: cover; flex-shrink: 0;
    }
    .expense-bill-label {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 600; color: #002263;
    }
    .expense-bill-label ion-icon { font-size: 14px; }

    .bill-viewer-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.92);
      display: flex; align-items: center; justify-content: center;
      animation: expBillFadeIn 0.2s ease;
    }
    @keyframes expBillFadeIn { from { opacity: 0; } to { opacity: 1; } }
    .bill-viewer-close {
      position: absolute; top: 12px; right: 12px; z-index: 10;
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255,255,255,0.15); border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #fff;
    }
    .bill-viewer-close ion-icon { font-size: 24px; }
    .bill-viewer-img-wrap {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; touch-action: none;
      -webkit-user-select: none; user-select: none;
    }
    .bill-viewer-img {
      max-width: 92vw; max-height: 88vh;
      object-fit: contain; border-radius: 4px;
      transition: transform 0.15s ease;
      transform-origin: center center;
      will-change: transform;
      pointer-events: none;
    }
  `],
})
export class ExpensesPage implements OnInit {
  private destroyRef = inject(DestroyRef);
  private supervisor = inject(SupervisorService);
  private router = inject(Router);

  expenses = signal<Expense[]>([]);
  filteredExpenses = signal<Expense[]>([]);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  nextCursor = signal<string | null>(null);
  searchQuery = '';
  statusFilter: ExpenseStatus | '' = '';
  selectedSiteName = signal<string | null>(null);
  openingBalance = signal(0);

  viewerUrl = signal<string | null>(null);
  zoomScale = 1;
  panX = 0;
  panY = 0;
  private pinchStartDist = 0;
  private pinchStartScale = 1;
  private dragStartX = 0;
  private dragStartY = 0;
  private isDragging = false;

  /**
   * Cash Added balance: only counts Cash Added expenses that have been
   * APPROVED by an admin. Pending or rejected requests must NEVER affect
   * the running balance, so a supervisor sees their balance move only
   * after the admin approves the request.
   */
  cashAdded = computed(() => this.expenses()
    .filter((e) => e.status === 'Approved' && e.transactionType === 'Cash Added')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  );

  /**
   * Spent balance: only counts Purchase (non-Cash-Added) expenses that
   * have been APPROVED. Same rules as cashAdded above.
   */
  cashSpent = computed(() => this.expenses()
    .filter((e) => e.status === 'Approved' && e.transactionType !== 'Cash Added')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  );

  balance = computed(() => this.openingBalance() + this.cashAdded() - this.cashSpent());

  async ngOnInit(): Promise<void> {
    addIcons({
      addOutline, walletOutline, timeOutline, receiptOutline, chevronForwardOutline,
      cashOutline, cardOutline, locationOutline, close, documentTextOutline,
    });
    await this.supervisor.init();
    this.selectedSiteName.set(this.supervisor.selectedSiteName());
    this.openingBalance.set(await this.supervisor.getSelectedSiteOpeningBalance());
    await this.loadExpenses();

    this.supervisor.siteChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.selectedSiteName.set(this.supervisor.selectedSiteName());
        void this.supervisor.getSelectedSiteOpeningBalance().then((value) => this.openingBalance.set(value));
        void this.loadExpenses();
      });
  }

  async loadExpenses(force = false): Promise<void> {
    this.isLoading.set(true);
    try {
      const siteId = this.supervisor.selectedSiteId();
      const projectId = this.supervisor.selectedProjectId();
      const r = await this.supervisor
        .getExpenses({
          siteId: siteId || undefined,
          projectId: projectId || undefined,
          type: 'site',
          limit: 25,
        })
        .toPromise();
      this.expenses.set((r?.expenses || []).map((expense) => ({
        ...expense,
        amount: Number(expense.amount) || 0,
      })));
      this.nextCursor.set(r?.pagination?.nextCursor ?? null);
      this.filterExpenses();
      this.isLoading.set(false);
    } catch (e) {
      console.error('[Expenses] failed to load', e);
      this.filterExpenses();
      this.isLoading.set(false);
    }
  }

  async refreshExpenses(event: CustomEvent): Promise<void> {
    await this.loadExpenses(true);
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }

  async loadMoreExpenses(event: CustomEvent): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.isLoadingMore()) {
      (event.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }

    this.isLoadingMore.set(true);
    try {
      const response = await this.supervisor.getExpenses({
        siteId: this.supervisor.selectedSiteId() || undefined,
        projectId: this.supervisor.selectedProjectId() || undefined,
        type: 'site',
        limit: 25,
        cursor,
      }).toPromise();
      const existing = this.expenses();
      const existingIds = new Set(existing.map((expense) => expense._id));
      const appended = (response?.expenses || [])
        .filter((expense) => !existingIds.has(expense._id))
        .map((expense) => ({ ...expense, amount: Number(expense.amount) || 0 }));
      this.expenses.set([...existing, ...appended]);
      this.nextCursor.set(response?.pagination?.nextCursor ?? null);
      this.filterExpenses();
    } catch (error) {
      console.error('[Expenses] failed to load next page', error);
    } finally {
      this.isLoadingMore.set(false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    }
  }

  filterExpenses(): void {
    let filtered = this.expenses();
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter((e) => e.description.toLowerCase().includes(q) || e.projectName?.toLowerCase().includes(q));
    }
    if (this.statusFilter) filtered = filtered.filter((e) => e.status === this.statusFilter);
    this.filteredExpenses.set(filtered);
  }

  viewExpense(expense: Expense): void { this.router.navigate(['/tabs/expenses', expense._id]); }
  createExpense(): void { this.router.navigate(['/tabs/expenses/create']); }

  getStatusTone(status: ExpenseStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    return status === 'Pending' ? 'warning' : status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'neutral';
  }

  openBillViewer(url: string): void {
    this.viewerUrl.set(url);
    this.resetZoom();
  }

  closeBillViewer(event: Event): void {
    event.stopPropagation();
    this.viewerUrl.set(null);
    this.resetZoom();
  }

  private resetZoom(): void {
    this.zoomScale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  toggleZoom(event: Event): void {
    event.stopPropagation();
    if (this.zoomScale > 1) {
      this.resetZoom();
    } else {
      this.zoomScale = 2.5;
    }
  }

  onPinchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault();
      this.pinchStartDist = this.getTouchDistance(event.touches);
      this.pinchStartScale = this.zoomScale;
    }
  }

  onPinchMove(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault();
      const dist = this.getTouchDistance(event.touches);
      const ratio = dist / this.pinchStartDist;
      this.zoomScale = Math.min(Math.max(this.pinchStartScale * ratio, 0.5), 5);
      if (this.zoomScale <= 1) {
        this.panX = 0;
        this.panY = 0;
      }
    }
  }

  onPinchEnd(event: TouchEvent): void {
    if (event.touches.length < 2 && this.zoomScale < 1) {
      this.resetZoom();
    }
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  onDragStart(event: MouseEvent): void {
    if (this.zoomScale <= 1) return;
    event.preventDefault();
    this.isDragging = true;
    this.dragStartX = event.clientX - this.panX;
    this.dragStartY = event.clientY - this.panY;
  }

  onDragMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    event.preventDefault();
    this.panX = event.clientX - this.dragStartX;
    this.panY = event.clientY - this.dragStartY;
  }

  onDragEnd(): void {
    this.isDragging = false;
  }
}
