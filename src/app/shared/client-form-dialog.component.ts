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

export type ClientFormValue = {
  name: string;
  mobile: string;
  address: string;
  gstNumber?: string;
  supervisor: string;
  supervisorId?: string;
  status?: "Active" | "On Hold" | "Completed";
};

type SupervisorOption = { id: string; name: string };

@Component({
  selector: "agb-client-form-dialog",
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="form-overlay" role="presentation">
      <section class="erp-dialog" role="dialog" aria-modal="true" aria-labelledby="client-form-title">
        <div class="dialog-head">
          <div>
            <span>{{ eyebrow }}</span>
            <h2 id="client-form-title">{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close client form" (click)="cancel.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form class="erp-form" (submit)="submit($event)">
          <label>
            <span>Client Name</span>
            <input name="name" required [value]="initialValue?.name || ''" placeholder="Enter client or company name" />
          </label>
          <label>
            <span>Mobile Number</span>
            <input name="mobile" required [value]="initialValue?.mobile || ''" placeholder="+91 98765 43210" />
          </label>
          <label class="span-2">
            <span>Address</span>
            <textarea name="address" required rows="3" [value]="initialValue?.address || ''" placeholder="Door no, street, area, city"></textarea>
          </label>
          <label>
            <span>GSTIN</span>
            <input name="gstNumber" [value]="initialValue?.gstNumber || ''" placeholder="22AAAAA0000A1Z5" maxlength="15" />
          </label>
          <label>
            <span>Assigned Supervisor</span>
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
                aria-label="Assigned Supervisor"
                aria-autocomplete="list"
                [attr.aria-expanded]="showSupervisorPanel()"
                aria-controls="client-supervisor-options"
              />
              <input type="hidden" name="supervisor" [value]="selectedSupervisorName()" />
              @if (showSupervisorPanel()) {
                <ul id="client-supervisor-options" class="supervisor-options" role="listbox">
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
            <select name="status" [value]="initialValue?.status || 'Active'">
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>
          </label>

          <div class="dialog-actions span-2">
            <button type="button" class="secondary-action" (click)="cancel.emit()">Cancel</button>
            <button type="submit" class="primary-action">{{ submitLabel }}</button>
          </div>
        </form>
      </section>
    </div>
  `,
  styles: [
    `
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
export class ClientFormDialogComponent implements OnInit {
  @Input() eyebrow = "Client Setup";
  @Input() title = "Add New Client";
  @Input() description = "Create the client record first. Projects, ledgers, and site records stay separated under this client.";
  @Input() submitLabel = "Create Client";
  @Input() initialValue: ClientFormValue | null = null;
  @Input() defaultSupervisor = "";
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<ClientFormValue>();

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
    const status = formData.get("status") as string || "Active";

    this.create.emit({
      name: String(formData.get("name") ?? "").trim(),
      mobile: String(formData.get("mobile") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      gstNumber: String(formData.get("gstNumber") ?? "").trim(),
      supervisor: String(formData.get("supervisor") ?? "").trim(),
      supervisorId: this.selectedSupervisorId() || undefined,
      status: status as "Active" | "On Hold" | "Completed",
    });
  }
}
