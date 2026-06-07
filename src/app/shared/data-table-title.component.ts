import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

@Component({
  selector: "agb-data-table-title",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="data-table-title">
      <h3>{{ title }}</h3>
      <span>{{ countText }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableTitleComponent {
  @Input() title = "";
  @Input() countText = "";
}
