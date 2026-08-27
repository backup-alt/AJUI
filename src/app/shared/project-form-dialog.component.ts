import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnInit,
  Output,
  signal,
  ViewChild,
} from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";
import { firstValueFrom } from "rxjs";
import { ApiService } from "../core/api.service";
import type { ProjectStatus } from "../../data/dashboardData";
import { SearchableSelectComponent } from "./searchable-select.component";

export type ProjectFormValue = {
  clientId?: string;
  name: string;
  sites: string[];
  startDate: string;
  supervisor: string;
  supervisorId?: string;
  status: ProjectStatus;
  totalValue: number;
};

type SupervisorOption = { id: string; name: string };

@Component({
  selector: "agb-project-form-dialog",
  standalone: true,
  imports: [CommonModule, IonIcon, SearchableSelectComponent],
  template: `
    <div class="form-overlay" role="presentation">
      <section class="erp-dialog" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
        <div class="dialog-head">
          <div>
            <span>{{ eyebrow }}</span>
            <h2 id="project-form-title">{{ title }}</h2>
            <p>{{ description || clientName + ' project records will open with material, labour, expense, and payment ledgers.' }}</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close project form" (click)="cancel.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form class="erp-form" (submit)="submit($event)">
          <label>
            <span>Client</span>
            @if (lockClient) {
              <input class="client-locked" type="text" [value]="clientName" readonly aria-readonly="true" />
              <input type="hidden" name="clientId" [value]="initialValue?.clientId || currentClientId" />
            } @else {
              <agb-searchable-select
                name="clientId"
                [value]="initialValue?.clientId || currentClientId"
                [options]="clientOptions()"
                placeholder="Select client"
              />
            }
          </label>
          <label>
            <span>Project Name</span>
            <input name="name" required [value]="initialValue?.name || ''" placeholder="Example: Green Nest Villas Phase 2" />
          </label>
          <label>
            <span>Start Date</span>
            <input name="startDate" type="date" required [value]="initialValue?.startDate || today" />
          </label>
          <label>
            <span>Supervisor</span>
            <div class="supervisor-dropdown" [class.open]="showSupervisorPanel()">
              <input
                #supervisorInput
                type="text"
                required
                autocomplete="off"
                [value]="supervisorDisplayValue()"
                (input)="onSupervisorSearchInput($event)"
                (focus)="openSupervisorPanel()"
                placeholder="Select supervisor"
                aria-label="Supervisor"
                aria-autocomplete="list"
                [attr.aria-expanded]="showSupervisorPanel()"
                aria-controls="supervisor-options"
              />
              <input type="hidden" name="supervisor" [value]="selectedSupervisorName()" />
              @if (showSupervisorPanel()) {
                <ul id="supervisor-options" class="supervisor-options" role="listbox">
                  @if (supervisorsLoading()) {
                    <li class="supervisor-empty">Loading supervisors…</li>
                  } @else if (filteredSupervisors().length === 0) {
                    <li class="supervisor-empty">No supervisors available</li>
                  } @else {
                    @for (s of filteredSupervisors(); track s.id) {
                      <li
                        role="option"
                        class="supervisor-option"
                        [class.selected]="s.id === selectedSupervisorId()"
                        (mousedown)="selectSupervisor(s, $event)"
                      >
                        {{ s.name }}
                      </li>
                    }
                  }
                </ul>
              }
            </div>
          </label>
          <label>
            <span>Status</span>
            <agb-searchable-select name="status" [value]="initialValue?.status || 'Active'" [options]="statusOptions" />
          </label>
          <label>
            <span>Estimated Project Value</span>
            <input name="totalValue" required type="number" min="0" step="1" [value]="initialValue?.totalValue || ''" placeholder="8200000" />
          </label>

          <div class="dialog-actions span-2">
            <button type="button" class="secondary-action" (click)="cancel.emit()" [disabled]="submitting">Cancel</button>
            <button type="submit" class="primary-action" [disabled]="submitting" [attr.aria-busy]="submitting ? 'true' : null">
              @if (submitting) {
                <span class="agb-loading-spinner" aria-hidden="true"></span>
              }
              {{ submitting ? 'Saving…' : submitLabel }}
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
  styles: [
    `
      .client-locked {
        min-height: 38px;
        background: #f8fafc;
        color: #0f172a;
        cursor: default;
      }
      .supervisor-dropdown {
        position: relative;
        width: 100%;
      }
      .supervisor-dropdown input[type="text"] {
        width: 100%;
      }
      .supervisor-options {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 200px;
        overflow-y: auto;
        margin: 0;
        padding: 4px 0;
        list-style: none;
        background: var(--agb-surface, #fff);
        border: 1px solid var(--agb-border, #d4dae3);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        z-index: 50;
      }
      .supervisor-option {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 0.92rem;
      }
      .supervisor-option:hover,
      .supervisor-option:focus {
        background: rgba(0, 0, 0, 0.05);
      }
      .supervisor-option.selected {
        background: rgba(0, 0, 0, 0.08);
        font-weight: 600;
      }
      .supervisor-empty {
        padding: 8px 12px;
        color: var(--agb-text-muted, #6b7280);
        font-size: 0.9rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFormDialogComponent implements OnInit {
  readonly statusOptions = ["Active", "On Hold", "Completed"];
  readonly today = this.localIsoDate(new Date());
  @Input() eyebrow = "Project Setup";
  @Input() title = "Create New Project";
  @Input() description = "";
  @Input() submitLabel = "Create Project";
  @Input() initialValue: ProjectFormValue | null = null;
  @Input() clientName = "Selected client";
  @Input() lockClient = false;
  @Input() defaultSupervisor = "";
  @Input() clients: Array<{ id?: string; _id?: string; name: string }> = [];
  @Input() currentClientId = "";
  @Input() submitting = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<ProjectFormValue>();

  private readonly api = inject(ApiService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly supervisors = signal<SupervisorOption[]>([]);
  readonly supervisorsLoading = signal(false);
  readonly supervisorSearch = signal("");
  readonly selectedSupervisorId = signal<string | null>(null);
  readonly selectedSupervisorName = signal<string>("");
  readonly showSupervisorPanel = signal(false);
  private initialSupervisorHandled = false;

  readonly filteredSupervisors = computed<SupervisorOption[]>(() => {
    const q = this.supervisorSearch().trim().toLowerCase();
    const list = this.supervisors();
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q));
  });

  clientOptions() {
    return this.clients.map((client) => ({ label: client.name, value: client._id || client.id || "" }));
  }

  @ViewChild("supervisorInput") private supervisorInput?: ElementRef<HTMLInputElement>;

  async ngOnInit() {
    await this.loadSupervisors();
    this.prefillSupervisor();
  }

  private async loadSupervisors() {
    this.supervisorsLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.listEmployees({ limit: 100, role: "supervisor" })
      );
      const items = (res?.items || []) as any[];
      const mapped: SupervisorOption[] = items
        .filter((row) => {
          const r = String(row?.role || "").toLowerCase();
          return r === "supervisor";
        })
        .map((row) => ({
          id: row._id ? String(row._id) : String(row.id || ""),
          name: String(row.name || "").trim(),
        }))
        .filter((s) => s.id && s.name);
      const unique = new Map<string, SupervisorOption>();
      mapped.forEach((s) => {
        if (!unique.has(s.id)) unique.set(s.id, s);
      });
      this.supervisors.set(Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      this.supervisors.set([]);
    } finally {
      this.supervisorsLoading.set(false);
    }
  }

  private prefillSupervisor() {
    if (this.initialSupervisorHandled) return;
    this.initialSupervisorHandled = true;
    const initialName =
      String(this.initialValue?.supervisor || "").trim() ||
      String(this.defaultSupervisor || "").trim();
    if (!initialName) return;
    const match = this.supervisors().find(
      (s) => s.name.toLowerCase() === initialName.toLowerCase()
    );
    if (match) {
      this.selectedSupervisorId.set(match.id);
      this.selectedSupervisorName.set(match.name);
    } else {
      this.selectedSupervisorName.set(initialName);
      this.supervisorSearch.set(initialName);
    }
  }

  supervisorDisplayValue(): string {
    if (this.selectedSupervisorId()) return this.selectedSupervisorName();
    return this.supervisorSearch();
  }

  onSupervisorSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.supervisorSearch.set(value);
    if (this.selectedSupervisorId()) {
      this.selectedSupervisorId.set(null);
      this.selectedSupervisorName.set("");
    }
    this.showSupervisorPanel.set(true);
  }

  openSupervisorPanel() {
    this.showSupervisorPanel.set(true);
  }

  selectSupervisor(s: SupervisorOption, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.selectedSupervisorId.set(s.id);
    this.selectedSupervisorName.set(s.name);
    this.supervisorSearch.set("");
    this.showSupervisorPanel.set(false);
  }

  @HostListener("document:mousedown", ["$event"])
  handleOutsideClick(event: MouseEvent) {
    if (!this.showSupervisorPanel()) return;
    const root = this.host.nativeElement.querySelector(".supervisor-dropdown");
    if (root && !root.contains(event.target as Node)) {
      this.showSupervisorPanel.set(false);
    }
  }

  submit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const supervisor = String(formData.get("supervisor") ?? "").trim();

    this.create.emit({
      clientId: String(formData.get("clientId") ?? this.currentClientId).trim() || undefined,
      name: String(formData.get("name") ?? "").trim(),
      startDate: String(formData.get("startDate") ?? "").trim(),
      supervisor,
      supervisorId: this.selectedSupervisorId() || undefined,
      status: this.projectStatusFor(String(formData.get("status") ?? "Active")),
      sites: [],
      totalValue: Number(formData.get("totalValue") ?? 0),
    });
  }

  private projectStatusFor(value: string): ProjectStatus {
    return value === "On Hold" || value === "Completed" ? value : "Active";
  }

  private localIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
