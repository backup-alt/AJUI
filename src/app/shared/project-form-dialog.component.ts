import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";
import type { ProjectStatus } from "../../data/dashboardData";

export type ProjectFormValue = {
  name: string;
  sites: string[];
  startDate: string;
  supervisor: string;
  status: ProjectStatus;
  totalValue: number;
  advanceAmount: number;
  receivedAmount: number;
  openingBalance: number;
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
            <span>{{ eyebrow }}</span>
            <h2 id="project-form-title">{{ title }}</h2>
            <p>{{ description || clientName + ' project records will open with site-wise material, labour, expense, and payment ledgers.' }}</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close project form" (click)="cancel.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form class="erp-form" (submit)="submit($event)">
          <label class="span-2">
            <span>Project Name</span>
            <input name="name" required [value]="initialValue?.name || ''" placeholder="Example: Green Nest Villas Phase 2" />
          </label>
          <label>
            <span>Start Date</span>
            <input name="startDate" type="date" required [value]="initialValue?.startDate || '2026-06-07'" />
          </label>
          <label>
            <span>Supervisor</span>
            <input name="supervisor" required [value]="initialValue?.supervisor || defaultSupervisor" placeholder="Supervisor name" />
          </label>
          <label>
            <span>Status</span>
            <select name="status" [value]="initialValue?.status || 'Active'">
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>
          </label>
          <label class="span-2">
            <span>Sites / Areas</span>
            <input name="sites" required [value]="initialValue?.sites?.join(', ') || ''" placeholder="Area 1, Area 2, Terrace" />
          </label>
          <label>
            <span>Estimated Project Value</span>
            <input name="totalValue" required type="number" min="0" step="1" [value]="initialValue?.totalValue || ''" placeholder="8200000" />
          </label>
          <label>
            <span>Advance Amount</span>
            <input name="advanceAmount" required type="number" min="0" step="1" [value]="initialValue?.advanceAmount || ''" placeholder="1000000" />
          </label>
          <label>
            <span>Received Amount</span>
            <input name="receivedAmount" type="number" min="0" step="1" [value]="initialValue?.receivedAmount || initialValue?.advanceAmount || ''" placeholder="2200000" />
          </label>
          <label>
            <span>Opening Expense Balance</span>
            <input name="openingBalance" type="number" min="0" step="1" [value]="initialValue?.openingBalance || ''" placeholder="25000" />
          </label>

          <div class="dialog-actions span-2">
            <button type="button" class="secondary-action" (click)="cancel.emit()">Cancel</button>
            <button type="submit" class="primary-action">{{ submitLabel }}</button>
          </div>
        </form>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFormDialogComponent {
  @Input() eyebrow = "Project Setup";
  @Input() title = "Create New Project";
  @Input() description = "";
  @Input() submitLabel = "Create Project";
  @Input() initialValue: ProjectFormValue | null = null;
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
      status: this.projectStatusFor(String(formData.get("status") ?? "Active")),
      sites,
      totalValue: Number(formData.get("totalValue") ?? 0),
      advanceAmount: Number(formData.get("advanceAmount") ?? 0),
      receivedAmount: Number(formData.get("receivedAmount") ?? formData.get("advanceAmount") ?? 0),
      openingBalance: Number(formData.get("openingBalance") ?? 0),
    });
  }

  private projectStatusFor(value: string): ProjectStatus {
    return value === "On Hold" || value === "Completed" ? value : "Active";
  }
}
