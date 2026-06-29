import { Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page.component';
import { addIcons } from 'ionicons';
import { cubeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [PlaceholderPage],
  template: `
    <app-placeholder-page
      title="Material Requests"
      subtitle="Log material requests for approval by admin / project manager."
      iconName="cube-outline"
      [phase]="3"
      note="Phase 3 will add the full request form (project, site, item, quantity, vendor, expected delivery), the list with filters, and the detail view with status timeline."
      [previewItems]="previewItems">
    </app-placeholder-page>
  `,
})
export class MaterialsPage {
  previewItems = [
    { title: 'Cement — 50 Bags', subtitle: 'AB-1024 · Site A', status: 'Pending', chipClass: 'agb-chip-warning' },
    { title: 'TMT Steel — 800 kg', subtitle: 'AB-1024 · Site A', status: 'Approved', chipClass: 'agb-chip-success' },
    { title: 'M-Sand — 4 units', subtitle: 'GH-220 · Site B', status: 'Pending', chipClass: 'agb-chip-warning' },
    { title: 'Bricks — 2,000 nos', subtitle: 'GH-220 · Site B', status: 'Rejected', chipClass: 'agb-chip-danger' },
  ];
  constructor() {
    addIcons({ 'cube-outline': cubeOutline });
  }
}