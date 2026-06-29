import { Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page.component';
import { addIcons } from 'ionicons';
import { briefcaseOutline } from 'ionicons/icons';

@Component({
  selector: 'app-subcontracts',
  standalone: true,
  imports: [PlaceholderPage],
  template: `
    <app-placeholder-page
      title="Subcontracts"
      subtitle="Engage subcontractors with a formal agreement."
      iconName="briefcase-outline"
      [phase]="6"
      note="Phase 6 will add the subcontract agreement form (party name, scope, agreement value, advance, dates), a list view with payment-progress bars, and approval flow integration."
      [previewItems]="previewItems">
    </app-placeholder-page>
  `,
})
export class SubcontractsPage {
  previewItems = [
    { title: 'Ravi Plumbing Works', subtitle: 'AB-1024 · ₹1,80,000', status: 'Approved', chipClass: 'agb-chip-success' },
    { title: 'Anu Electricals', subtitle: 'GH-220 · ₹95,000', status: 'Pending', chipClass: 'agb-chip-warning' },
  ];
  constructor() {
    addIcons({ 'briefcase-outline': briefcaseOutline });
  }
}