import { Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page.component';
import { addIcons } from 'ionicons';
import { cardOutline } from 'ionicons/icons';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [PlaceholderPage],
  template: `
    <app-placeholder-page
      title="Payments"
      subtitle="Record client payments received at the site."
      iconName="card-outline"
      [phase]="6"
      note="Phase 6 will add the payment form (project, client, amount, mode, receipt number, transaction reference), a receipt-styled list grouped by project, and a total-collected tile."
      [previewItems]="previewItems">
    </app-placeholder-page>
  `,
})
export class PaymentsPage {
  previewItems = [
    { title: 'Cash — ₹50,000', subtitle: 'AB-1024 · Mr. Karthik', status: 'Pending', chipClass: 'agb-chip-warning' },
    { title: 'UPI — ₹1,20,000', subtitle: 'GH-220 · Mr. Suresh', status: 'Approved', chipClass: 'agb-chip-success' },
  ];
  constructor() {
    addIcons({ 'card-outline': cardOutline });
  }
}