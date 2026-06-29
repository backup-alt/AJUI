import { Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page.component';
import { addIcons } from 'ionicons';
import { peopleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-labour',
  standalone: true,
  imports: [PlaceholderPage],
  template: `
    <app-placeholder-page
      title="Labour Attendance"
      subtitle="Daily attendance for all worker categories and parties."
      iconName="people-outline"
      [phase]="4"
      note="Phase 4 will add the dynamic labor-types form (multiple categories in one entry), attendance history grouped by date, and a per-project summary tile on the dashboard."
      [previewItems]="previewItems">
    </app-placeholder-page>
  `,
})
export class LabourPage {
  previewItems = [
    { title: '14 Workers · Mason + Helper', subtitle: 'AB-1024 · Today', status: 'Approved', chipClass: 'agb-chip-success' },
    { title: '8 Workers · Plumber', subtitle: 'GH-220 · Today', status: 'Pending', chipClass: 'agb-chip-warning' },
    { title: '6 Workers · Electrician', subtitle: 'AB-1024 · Yesterday', status: 'Approved', chipClass: 'agb-chip-success' },
  ];
  constructor() {
    addIcons({ 'people-outline': peopleOutline });
  }
}