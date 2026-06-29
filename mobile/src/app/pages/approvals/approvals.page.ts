import { Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page.component';
import { addIcons } from 'ionicons';
import { checkmarkDoneCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [PlaceholderPage],
  template: `
    <app-placeholder-page
      title="Approvals"
      subtitle="Track the status of every request you've submitted."
      iconName="checkmark-done-circle-outline"
      [phase]="7"
      note="Phase 7 will add a unified approvals inbox grouped by module with status chips (Pending / Approved / Rejected), detail timelines, and in-app push notifications when reviewers respond."
      [previewItems]="previewItems">
    </app-placeholder-page>
  `,
})
export class ApprovalsPage {
  previewItems = [
    { title: 'Cement — 50 Bags', subtitle: 'Submitted 2h ago', status: 'Pending', chipClass: 'agb-chip-warning' },
    { title: 'Labour — 14 workers', subtitle: 'Reviewed yesterday', status: 'Approved', chipClass: 'agb-chip-success' },
    { title: 'Diesel — ₹3,200', subtitle: 'Reviewed 3 days ago', status: 'Rejected', chipClass: 'agb-chip-danger' },
  ];
  constructor() {
    addIcons({ 'checkmark-done-circle-outline': checkmarkDoneCircleOutline });
  }
}