import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";

export type ProjectFormValue = {
  name: string;
  sites: string[];
  startDate: string;
  supervisor: string;
  totalValue: number;
  advanceAmount: number;
};

@Component({
  selector: "agb-project-form-dialog",
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="form-overlay" role="presentation">
      <section class="erp-dialog" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
        <div class="dialog-head">
          <div>
            <span>Project Setup</span>
            <h2 id="project-form-title">Create New Project</h2>
            <p>{{ clientName }} project records will open with site-wise material, labour, expense, and payment ledgers.</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close project form" (click)="cancel.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form class="erp-form" (submit)="submit($event)">
          <label class="span-2">
            <span>Project Name</span>
            <input name="name" required placeholder="Example: Green Nest Villas Phase 2" />
          </label>
          <label>
            <span>Start Date</span>
            <input name="startDate" type="date" required value="2026-06-07" />
          </label>
          <label>
            <span>Supervisor</span>
            <input name="supervisor" required [value]="defaultSupervisor" placeholder="Supervisor name" />
          </label>
          <label class="span-2">
            <span>Sites / Areas</span>
            <input name="sites" required placeholder="Area 1, Area 2, Terrace" />
          </label>
          <label>
            <span>Total Project Value</span>
            <input name="totalValue" required type="number" min="0" step="1000" placeholder="8200000" />
          </label>
          <label>
            <span>Advance Amount</span>
            <input name="advanceAmount" required type="number" min="0" step="1000" placeholder="1000000" />
          </label>

          <div class="dialog-actions span-2">
            <button type="button" class="secondary-action" (click)="cancel.emit()">Cancel</button>
            <button type="submit" class="primary-action">Create Project</button>
          </div>
        </form>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFormDialogComponent {
  @Input() clientName = "Selected client";
  @Input() defaultSupervisor = "";
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<ProjectFormValue>();

  submit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const sites = String(formData.get("sites") ?? "")
      .split(",")
      .map((site) => site.trim())
      .filter(Boolean);

    this.create.emit({
      name: String(formData.get("name") ?? "").trim(),
      startDate: String(formData.get("startDate") ?? "").trim(),
      supervisor: String(formData.get("supervisor") ?? "").trim(),
      sites,
      totalValue: Number(formData.get("totalValue") ?? 0),
      advanceAmount: Number(formData.get("advanceAmount") ?? 0),
    });
  }
}
