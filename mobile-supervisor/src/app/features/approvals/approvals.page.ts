import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import {
  IonContent, IonSegment, IonSegmentButton, IonLabel, IonIcon,
  IonSkeletonText, IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  checkmarkDoneCircleOutline, timeOutline, chevronForwardOutline,
  cubeOutline, peopleOutline, walletOutline, cardOutline,
  documentTextOutline, businessOutline, locationOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Approval, ApprovalType } from '../../shared/models';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import {
  EmptyStateComponent,
  StatusPillComponent,
} from '../../shared/components';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    FormsModule,
    IonContent, IonSegment, IonSegmentButton, IonLabel, IonIcon,
    IonSkeletonText, IonRefresher, IonRefresherContent,
    DatePipe, CurrencyPipe, TitleCasePipe,
    EmptyStateComponent, StatusPillComponent,
  ],
  template: `
    <ion-content class="approvals-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshApprovals($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="page-head">
        <h1>Approvals</h1>
        <p>Review and track every request sent to your admin or project manager.</p>
      </div>

      <div class="filter-stack">
        <div class="seg-wrap">
          <ion-segment [(ngModel)]="typeFilter" (ionChange)="filterApprovals()" [value]="'all'">
            <ion-segment-button value="all"><ion-label>All</ion-label></ion-segment-button>
            <ion-segment-button value="material"><ion-label>Materials</ion-label></ion-segment-button>
            <ion-segment-button value="labour"><ion-label>Labour</ion-label></ion-segment-button>
            <ion-segment-button value="expense"><ion-label>Expenses</ion-label></ion-segment-button>
            <ion-segment-button value="payment"><ion-label>Payments</ion-label></ion-segment-button>
          </ion-segment>
        </div>
        <div class="seg-wrap">
          <ion-segment [(ngModel)]="statusFilter" (ionChange)="filterApprovals()" [value]="'pending'">
            <ion-segment-button value="pending"><ion-label>Pending</ion-label></ion-segment-button>
            <ion-segment-button value="approved"><ion-label>Approved</ion-label></ion-segment-button>
            <ion-segment-button value="rejected"><ion-label>Rejected</ion-label></ion-segment-button>
          </ion-segment>
        </div>
      </div>

      <div class="cards">
        @if (isLoading() && approvals().length === 0) {
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </div>
          }
        } @else if (filteredApprovals().length === 0) {
          <app-empty-state
            [icon]="statusFilter === 'pending' ? 'checkmark-done-circle-outline' : 'document-text-outline'"
            [iconBg]="statusFilter === 'pending' ? 'rgba(22, 163, 74, 0.14)' : 'rgba(14, 165, 233, 0.12)'"
            [iconColor]="statusFilter === 'pending' ? '#15803d' : '#0369a1'"
            [title]="emptyTitle()"
            [message]="emptyMessage()"
          ></app-empty-state>
        } @else {
          @for (approval of filteredApprovals(); track approval._id || approval.approvalId) {
            <button class="approval-card" (click)="viewApproval(approval)">
              <header class="approval-head">
                <app-status-pill [tone]="getTypeTone(approval.type)" [icon]="getTypeIcon(approval.type)">
                  {{ approval.type | titlecase }}
                </app-status-pill>
                <app-status-pill [tone]="getStatusTone(approval.status || 'Pending')">
                  {{ approval.status || 'Pending' }}
                </app-status-pill>
              </header>

              <h3 class="approval-title">{{ approval.title }}</h3>

              <div class="approval-meta">
                <div class="meta-item">
                  <ion-icon name="business-outline"></ion-icon>
                  <div>
                    <div class="meta-label">Project</div>
                    <div class="meta-value">{{ approval.projectName }}</div>
                  </div>
                </div>
                @if (approval.site) {
                  <div class="meta-item">
                    <ion-icon name="location-outline"></ion-icon>
                    <div>
                      <div class="meta-label">Site</div>
                      <div class="meta-value">{{ approval.site }}</div>
                    </div>
                  </div>
                }
                @if (approval.amount) {
                  <div class="meta-item">
                    <ion-icon name="wallet-outline"></ion-icon>
                    <div>
                      <div class="meta-label">Amount</div>
                      <div class="meta-value amount">{{ approval.amount | currency:'INR':'symbol':'1.0-0' }}</div>
                    </div>
                  </div>
                }
              </div>

              <footer class="approval-footer">
                <div class="approval-date">
                  <ion-icon name="time-outline"></ion-icon>
                  {{ approval.submittedAt | date:'MMM d, h:mm a' }}
                </div>
                <span class="view-link">
                  Review
                  <ion-icon name="chevron-forward-outline"></ion-icon>
                </span>
              </footer>
            </button>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .approvals-content { --background: #f5f6f8; }

    .page-head { padding: 16px 16px 0; }
    .page-head h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 2px; letter-spacing: -0.2px; }
    .page-head p { font-size: 13px; color: #64748b; margin: 0 0 12px; }

    .filter-stack { padding: 0 16px 8px; }
    .seg-wrap { padding: 4px 4px 6px; }

    .cards { padding: 8px 16px 24px; }
    .approval-card {
      width: 100%;
      text-align: left;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 14px 16px;
      margin-bottom: 10px;
      box-shadow: var(--agb-shadow-2xs);
      cursor: pointer;
      font-family: inherit;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .approval-card:active { transform: scale(0.99); }
    .approval-card:hover { box-shadow: var(--agb-shadow-sm); }

    .approval-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    .approval-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    .approval-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 14px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }
    .meta-item { display: flex; align-items: flex-start; gap: 8px; }
    .meta-item ion-icon { color: #94a3b8; font-size: 16px; flex-shrink: 0; margin-top: 2px; }
    .meta-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
    .meta-value { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .meta-value.amount { color: #a8861f; }

    .approval-footer { display: flex; align-items: center; justify-content: space-between; }
    .approval-date { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .approval-date ion-icon { font-size: 13px; }
    .view-link { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; color: #002263; }
    .view-link ion-icon { font-size: 14px; }

    .skeleton-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 10px;
    }
  `],
})
export class ApprovalsPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);

  approvals = signal<Approval[]>([]);
  filteredApprovals = signal<Approval[]>([]);
  isLoading = signal(true);
  typeFilter: 'all' | ApprovalType = 'all';
  statusFilter: 'pending' | 'approved' | 'rejected' = 'pending';

  async ngOnInit(): Promise<void> {
    addIcons({
      checkmarkDoneCircleOutline, timeOutline, chevronForwardOutline, cubeOutline,
      peopleOutline, walletOutline, cardOutline, documentTextOutline, businessOutline,
      locationOutline,
    });
    await this.loadApprovals();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:approvals-changed', this.handleApprovalsChanged);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:approvals-changed', this.handleApprovalsChanged);
    }
  }

  private handleApprovalsChanged = (): void => {
    void this.loadApprovals();
  };

  ionViewWillEnter(): void {
    void this.loadApprovals();
  }

  async loadApprovals(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.supervisor.getApprovals().subscribe({
        next: (r) => {
          this.approvals.set(r.approvals || []);
          this.filterApprovals();
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[Approvals] failed to load', err);
          this.approvals.set([]);
          this.filterApprovals();
          this.isLoading.set(false);
        },
      });
    } catch (e) {
      console.error(e);
      this.isLoading.set(false);
    }
  }

  async refreshApprovals(event: CustomEvent): Promise<void> {
    await this.loadApprovals();
    (event.target as HTMLIonRefresherElement).complete();
  }

  filterApprovals(): void {
    let filtered = this.approvals();
    if (this.typeFilter !== 'all') {
      filtered = filtered.filter((a) => a.type === this.typeFilter);
    }
    if (this.statusFilter !== 'pending') {
      const target = this.statusFilter === 'approved' ? 'Approved' : 'Rejected';
      filtered = filtered.filter((a) => (a.status || 'Pending') === target);
    } else {
      filtered = filtered.filter((a) => !a.status || a.status === 'Pending');
    }
    this.filteredApprovals.set(filtered);
  }

  emptyTitle(): string {
    if (this.statusFilter === 'pending') return 'All caught up';
    if (this.statusFilter === 'approved') return 'No approved items';
    return 'No rejected items';
  }

  emptyMessage(): string {
    if (this.statusFilter === 'pending') return 'No pending approvals at the moment.';
    if (this.typeFilter !== 'all') return `No ${this.typeFilter} items in this status.`;
    return 'No items in this status.';
  }

  viewApproval(approval: Approval): void {
    this.router.navigate(['/tabs/approvals', approval._id || approval.approvalId]);
  }

  getTypeTone(type: ApprovalType): 'info' | 'warning' | 'danger' | 'success' {
    switch (type) {
      case 'material': return 'danger';
      case 'labour': return 'info';
      case 'expense': return 'warning';
      case 'payment': return 'success';
      default: return 'info';
    }
  }

  getStatusTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'Approved': return 'success';
      case 'Rejected': return 'danger';
      case 'Pending':
      default: return 'warning';
    }
  }

  getTypeIcon(type: ApprovalType): string {
    switch (type) {
      case 'material': return 'cube-outline';
      case 'labour': return 'people-outline';
      case 'expense': return 'wallet-outline';
      case 'payment': return 'card-outline';
      default: return 'checkmark-done-circle-outline';
    }
  }
}
