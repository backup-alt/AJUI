import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSegment,
  IonSegmentButton, IonLabel, IonCard, IonCardContent, IonIcon,
  IonBadge, IonSkeletonText, IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  checkmarkDoneCircleOutline, timeOutline, arrowForwardOutline,
  cubeOutline, peopleOutline, walletOutline, cardOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Approval, ApprovalType } from '../../shared/models';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSegment,
    IonSegmentButton, IonLabel, IonCard, IonCardContent, IonIcon,
    IonBadge, IonSkeletonText, IonRefresher, IonRefresherContent,
    DatePipe, CurrencyPipe, TitleCasePipe
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar><ion-title>Approvals</ion-title></ion-toolbar>
      <ion-toolbar>
        <ion-segment [(ngModel)]="typeFilter" (ionChange)="filterApprovals()" [value]="''">
          <ion-segment-button [value]="''"><ion-label>All</ion-label></ion-segment-button>
          <ion-segment-button value="material"><ion-label>Materials</ion-label></ion-segment-button>
          <ion-segment-button value="labour"><ion-label>Labour</ion-label></ion-segment-button>
          <ion-segment-button value="expense"><ion-label>Expense</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="approvals-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshApprovals($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (isLoading() && approvals().length === 0) {
        @for (i of [1,2,3]; track i) {
          <ion-card class="skeleton">
            <ion-card-content>
              <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </ion-card-content>
          </ion-card>
        }
      } @else if (filteredApprovals().length === 0) {
        <div class="empty-state">
          <ion-icon name="checkmark-done-circle-outline"></ion-icon>
          <h3>All Caught Up!</h3>
          <p>No pending approvals at the moment</p>
        </div>
      } @else {
        @for (approval of filteredApprovals(); track approval.approvalId) {
          <ion-card class="approval-card" (click)="viewApproval(approval)">
            <ion-card-content>
              <div class="approval-header">
                <div class="approval-type-badge" [class]="approval.type">
                  <ion-icon [name]="getTypeIcon(approval.type)"></ion-icon>
                  {{ approval.type | titlecase }}
                </div>
                <ion-badge color="warning">Pending</ion-badge>
              </div>

              <h3 class="approval-title">{{ approval.title }}</h3>

              <div class="approval-meta">
                <div class="meta-item">
                  <span class="meta-label">Project</span>
                  <span class="meta-value">{{ approval.projectName }}</span>
                </div>
                @if (approval.site) {
                  <div class="meta-item">
                    <span class="meta-label">Site</span>
                    <span class="meta-value">{{ approval.site }}</span>
                  </div>
                }
                @if (approval.amount) {
                  <div class="meta-item">
                    <span class="meta-label">Amount</span>
                    <span class="meta-value amount">{{ approval.amount | currency:'INR':'symbol':'1.0-0' }}</span>
                  </div>
                }
              </div>

              <div class="approval-footer">
                <div class="approval-date">
                  <ion-icon name="time-outline"></ion-icon>
                  {{ approval.submittedAt | date:'MMM d, h:mm a' }}
                </div>
                <div class="approval-action">
                  Review
                  <ion-icon name="arrow-forward-outline"></ion-icon>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        }
      }
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); }
    .approvals-content { --background: var(--agb-off-white); }
    .approval-card { margin: 12px 16px; transition: all var(--agb-transition-fast); }
    .approval-card:active { transform: scale(0.98); }
    .approval-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .approval-type-badge {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600; text-transform: uppercase;
      padding: 6px 12px; border-radius: var(--agb-radius-full);
      background: var(--agb-light-gray); color: var(--agb-dark-gray);
    }
    .approval-type-badge.material { background: rgba(220,53,69,0.1); color: var(--agb-danger); }
    .approval-type-badge.labour { background: rgba(13,202,240,0.1); color: var(--agb-info); }
    .approval-type-badge.expense { background: rgba(255,193,7,0.15); color: #b38600; }
    .approval-type-badge.payment { background: rgba(25,135,84,0.1); color: var(--agb-success); }
    .approval-title { font-size: 16px; font-weight: 600; color: var(--agb-navy); margin: 0 0 12px; }
    .approval-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 12px; padding: 12px; background: var(--agb-off-white); border-radius: var(--agb-radius-md); }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 11px; color: var(--agb-gray); text-transform: uppercase; margin-bottom: 2px; }
    .meta-value { font-size: 14px; font-weight: 600; color: var(--agb-navy); }
    .meta-value.amount { color: var(--agb-gold-dark); }
    .approval-footer { display: flex; justify-content: space-between; align-items: center; }
    .approval-date { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--agb-gray); }
    .approval-action { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--agb-primary); }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 32px; text-align: center; }
    .empty-state ion-icon { font-size: 64px; color: var(--agb-success); margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; font-weight: 600; color: var(--agb-navy); margin: 0 0 8px; }
    .empty-state p { font-size: 14px; color: var(--agb-gray); margin: 0; }
    .skeleton { margin: 12px 16px; }
  `],
})
export class ApprovalsPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);

  approvals = signal<Approval[]>([]);
  filteredApprovals = signal<Approval[]>([]);
  isLoading = signal(true);
  typeFilter: ApprovalType | '' = '';

  async ngOnInit(): Promise<void> {
    addIcons({ checkmarkDoneCircleOutline, timeOutline, arrowForwardOutline, cubeOutline, peopleOutline, walletOutline, cardOutline });
    await this.loadApprovals();
  }

  async loadApprovals(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await new Promise<{ approvals: Approval[] }>((resolve) => {
        this.supervisor.getApprovals().subscribe({
          next: (r) => resolve(r as { approvals: Approval[] }),
          error: () => resolve({ approvals: [] }),
        });
      });
      this.approvals.set(data.approvals || []);
      this.filterApprovals();
    } catch (e) { console.error(e); }
    finally { this.isLoading.set(false); }
  }

  async refreshApprovals(event: CustomEvent): Promise<void> {
    await this.loadApprovals();
    (event.target as HTMLIonRefresherElement).complete();
  }

  filterApprovals(): void {
    let filtered = this.approvals();
    if (this.typeFilter) filtered = filtered.filter((a) => a.type === this.typeFilter);
    this.filteredApprovals.set(filtered);
  }

  viewApproval(approval: Approval): void { this.router.navigate(['/tabs/approvals', approval.approvalId]); }

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