import { Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page.component';
import { addIcons } from 'ionicons';
import { walletOutline } from 'ionicons/icons';

@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [PlaceholderPage],
  template: `
    <app-placeholder-page
      title="Site Expenses"
      subtitle="Submit site & general expenses for admin / accountant approval."
      iconName="wallet-outline"
      [phase]="5"
      note="Phase 5 will add the full expense form (project, site, category, amount, reference, mode, optional receipt photo), month-grouped list with totals, and a running-balance ledger per site."
      [previewItems]="previewItems">
    </app-placeholder-page>
  `,
})
export class ExpensePage {
  previewItems = [
    { title: 'Diesel — 40 L', subtitle: 'AB-1024 · Site A', status: 'Pending', chipClass: 'agb-chip-warning' },
    { title: 'Site Tea & Snacks', subtitle: 'GH-220 · Site B', status: 'Approved', chipClass: 'agb-chip-success' },
    { title: 'Equipment Rental', subtitle: 'AB-1024 · Site A', status: 'Pending', chipClass: 'agb-chip-warning' },
  ];
  constructor() {
    addIcons({ 'wallet-outline': walletOutline });
  }
}