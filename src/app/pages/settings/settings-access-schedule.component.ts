import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../core/api.service";

type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

interface AccessWindow {
  id: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  days: DayOfWeek[];
  appliesTo: ("project_manager" | "accountant")[];
  note: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  result: string;
  ip?: string;
}

@Component({
  selector: "agb-settings-access-schedule",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-w11-page-head">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Access Schedule</strong>
      </nav>
      <div class="settings-w11-page-head-row">
        <div>
          <h1>Access Schedule</h1>
          <p>Define time windows where only admins can log in. Useful for maintenance, payroll, or sensitive data updates.</p>
        </div>
        <button type="button" class="settings-w11-btn settings-w11-btn-primary" [class.settings-w11-btn-dirty]="dirty()" (click)="save()">Save Schedule</button>
      </div>
    </div>

    <div class="settings-w11-callout">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 1 18h18L10 2Z M10 8v4 M10 14h.01" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div>
        <strong>How it works</strong>
        <p>During restricted windows, project managers and accountants cannot log in or access settings. Admins always have access.</p>
      </div>
    </div>

    <section class="settings-w11-card">
      <div class="settings-w11-enable-row">
        <div class="settings-w11-enable-text">
          <strong>Enable Access Schedule</strong>
          <small>When ON, the schedule below is enforced. When OFF, all users can access at any time.</small>
        </div>
        <label class="settings-w11-switch">
          <input type="checkbox" [checked]="enabled()" (change)="setEnabled($any($event.target).checked)" />
          <span class="settings-w11-switch-slider"></span>
        </label>
      </div>
      <div class="settings-w11-status-line">
        <span class="settings-w11-status-dot" [class.green]="!isCurrentlyRestricted()" [class.red]="isCurrentlyRestricted()"></span>
        <span class="settings-w11-status-current">
          Currently:
          <strong>{{ isCurrentlyRestricted() ? 'Restricted — only admins' : 'Open access' }}</strong>
        </span>
        <span class="settings-w11-status-time">
          {{ currentTime() }} &middot; next change {{ nextChange() }}
        </span>
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Restricted Windows</h2>
          <p>Define time periods when only admins can access the app.</p>
        </div>
        <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="addWindow()">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10 M3 8h10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
          Add Window
        </button>
      </div>
      <div class="settings-w11-card-body">
        @for (w of windows(); track w.id; let i = $index) {
          <div class="settings-w11-window-card" [class.disabled]="!w.isActive">
            <header class="settings-w11-window-head">
              <div>
                <strong>Window {{ i + 1 }}</strong>
                <small>Created {{ w.createdAt }} by {{ w.createdBy }}</small>
              </div>
              <div class="settings-w11-window-head-actions">
                <label class="settings-w11-mini-toggle">
                  <input type="checkbox" [checked]="w.isActive" (change)="toggleWindow(w.id, $any($event.target).checked)" />
                  <span>{{ w.isActive ? 'Active' : 'Inactive' }}</span>
                </label>
                <button type="button" class="settings-w11-icon-btn" (click)="deleteWindow(w.id)" aria-label="Delete window">
                  <svg viewBox="0 0 16 16"><path d="M4 4h8 M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1 M5 4l1 9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l1-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </div>
            </header>

            <div class="settings-w11-window-body">
              <div class="settings-w11-field-row">
                <div class="settings-w11-field">
                  <label>Start time</label>
                  <input type="time" [value]="w.startTime" (change)="updateWindow(w.id, { startTime: $any($event.target).value })" />
                </div>
                <div class="settings-w11-field">
                  <label>End time</label>
                  <input type="time" [value]="w.endTime" (change)="updateWindow(w.id, { endTime: $any($event.target).value })" />
                </div>
              </div>

              <div class="settings-w11-field">
                <label>Days</label>
                <div class="settings-w11-day-row">
                  @for (d of allDays; track d) {
                    <label class="settings-w11-day-chip" [class.active]="w.days.includes(d)">
                      <input type="checkbox" [checked]="w.days.includes(d)" (change)="toggleDay(w.id, d)" />
                      <span>{{ d }}</span>
                    </label>
                  }
                </div>
              </div>

              <div class="settings-w11-field">
                <label>Applies to</label>
                <div class="settings-w11-day-row">
                  <label class="settings-w11-day-chip" [class.active]="w.appliesTo.includes('project_manager')">
                    <input type="checkbox" [checked]="w.appliesTo.includes('project_manager')" (change)="toggleRole(w.id, 'project_manager')" />
                    <span>Project Manager</span>
                  </label>
                  <label class="settings-w11-day-chip" [class.active]="w.appliesTo.includes('accountant')">
                    <input type="checkbox" [checked]="w.appliesTo.includes('accountant')" (change)="toggleRole(w.id, 'accountant')" />
                    <span>Accountant</span>
                  </label>
                </div>
              </div>

              <div class="settings-w11-field">
                <label>Note (optional)</label>
                <input type="text" [value]="w.note" (input)="updateWindow(w.id, { note: $any($event.target).value })" placeholder="e.g. Monthly payroll processing" />
              </div>
            </div>
          </div>
        } @empty {
          <div class="settings-w11-empty">
            <p>No restricted windows defined. All users can access at any time.</p>
          </div>
        }
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Notifications</h2>
          <p>Stay informed about access changes.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <label class="settings-w11-toggle-row">
          <div>
            <strong>New submission notifications</strong>
            <small>When a new approval request is submitted, the supervisor on duty will be notified immediately in the app and via email digest.</small>
          </div>
          <input type="checkbox" [checked]="notifyBefore()" (change)="setNotifyBefore($any($event.target).checked)" />
        </label>
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Audit Log</h2>
          <p>Logins, logouts, and approval decisions from the last 7 days.</p>
        </div>
        <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="exportLog()" [disabled]="exporting()">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v9 M4 9l4 4 4-4 M3 14h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {{ exporting() ? 'Exporting…' : 'Export log' }}
        </button>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-table-wrap" style="margin-top: 8px">
          @if (auditLogLoading()) {
            <p class="settings-w11-empty-hint">Loading audit log…</p>
          } @else if (auditLog().length === 0) {
            <p class="settings-w11-empty-hint">No audit entries in the last 7 days.</p>
          } @else {
            <table class="settings-w11-table">
              <thead>
                <tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Result</th><th>IP</th></tr>
              </thead>
              <tbody>
                @for (entry of auditLog(); track entry.id) {
                  <tr>
                    <td>{{ formatLogTime(entry.timestamp) }}</td>
                    <td>{{ entry.user }}</td>
                    <td>{{ entry.role }}</td>
                    <td>{{ entry.action }}</td>
                    <td>
                      <span class="settings-w11-status-pill" [attr.data-status]="(entry.result || '').toLowerCase()">{{ entry.result }}</span>
                    </td>
                    <td>{{ entry.ip || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAccessScheduleComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly enabled = signal(false);
  readonly notifyBefore = signal(true);
  readonly logAttempts = signal(true);
  readonly dirty = signal(false);
  readonly saving = signal(false);

  readonly auditLog = signal<AuditLogEntry[]>([]);
  readonly auditLogLoading = signal(false);
  readonly exporting = signal(false);

  private markDirty() {
    this.dirty.set(true);
  }

  ngOnInit() {
    this.loadSchedule();
    this.loadAuditLog();
  }

  private loadSchedule() {
    this.api.getAccessSchedule().subscribe({
      next: (res) => {
        this.enabled.set(!!res?.enabled);
        this.notifyBefore.set(true);
        if (Array.isArray(res?.windows)) {
          this.windows.set(res.windows.map((w: any) => ({
            id: w.id || `W-${Date.now()}`,
            startTime: w.startTime || "00:00",
            endTime: w.endTime || "00:00",
            days: (w.days || []) as DayOfWeek[],
            appliesTo: (w.appliesTo || ["project_manager", "accountant"]) as ("project_manager" | "accountant")[],
            note: w.note || "",
            isActive: w.isActive !== false,
            createdAt: w.createdAt || new Date().toISOString().slice(0, 10),
            createdBy: w.createdBy || "You",
          })));
        }
      },
      error: () => {
        // Keep defaults
      },
    });
  }

  private loadAuditLog() {
    this.auditLogLoading.set(true);
    this.api.listAuditLogs({ days: 7, limit: 50 }).subscribe({
      next: (res) => {
        const items = (res?.items || []).map((row: any) => ({
          id: row.id || row._id || `log-${Date.now()}-${Math.random()}`,
          timestamp: row.timestamp || row.createdAt || row.date || "",
          user: row.user || row.userName || row.email || "—",
          role: row.role || row.userRole || "—",
          action: row.action || row.event || "—",
          result: row.result || row.status || "—",
          ip: row.ip || row.ipAddress || "—",
        }));
        this.auditLog.set(items);
        this.auditLogLoading.set(false);
      },
      error: () => {
        this.auditLog.set([]);
        this.auditLogLoading.set(false);
      },
    });
  }

  setEnabled(value: boolean) {
    this.enabled.set(value);
    this.markDirty();
  }

  setNotifyBefore(value: boolean) {
    this.notifyBefore.set(value);
    this.markDirty();
  }

  setLogAttempts(value: boolean) {
    this.logAttempts.set(value);
    this.markDirty();
  }

  readonly allDays: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  readonly windows = signal<AccessWindow[]>([
    {
      id: "W-1",
      startTime: "23:00",
      endTime: "07:00",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      appliesTo: ["project_manager", "accountant"],
      note: "Daily maintenance window",
      isActive: true,
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: "You",
    },
  ]);

  readonly isCurrentlyRestricted = computed(() => {
    if (!this.enabled()) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    return this.windows().some((w) => {
      if (!w.isActive) return false;
      const [sh, sm] = w.startTime.split(":").map(Number);
      const [eh, em] = w.endTime.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      return start < end ? cur >= start && cur < end : cur >= start || cur < end;
    });
  });

  currentTime(): string {
    return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  nextChange(): string {
    return "—";
  }

  formatLogTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      return `Today ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (days === 1) {
      return `Yesterday ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  addWindow() {
    this.windows.update((list) => [
      ...list,
      {
        id: `W-${Date.now()}`,
        startTime: "22:00",
        endTime: "06:00",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        appliesTo: ["project_manager", "accountant"],
        note: "",
        isActive: true,
        createdAt: new Date().toISOString().slice(0, 10),
        createdBy: "You",
      },
    ]);
    this.markDirty();
  }

  deleteWindow(id: string) {
    if (confirm("Delete this restricted window?")) {
      this.windows.update((list) => list.filter((w) => w.id !== id));
      this.markDirty();
    }
  }

  toggleWindow(id: string, value: boolean) {
    this.windows.update((list) => list.map((w) => (w.id === id ? { ...w, isActive: value } : w)));
    this.markDirty();
  }

  updateWindow(id: string, patch: Partial<AccessWindow>) {
    this.windows.update((list) => list.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    this.markDirty();
  }

  toggleDay(id: string, day: DayOfWeek) {
    this.windows.update((list) =>
      list.map((w) =>
        w.id === id
          ? {
              ...w,
              days: w.days.includes(day) ? w.days.filter((d) => d !== day) : [...w.days, day],
            }
          : w
      )
    );
    this.markDirty();
  }

  toggleRole(id: string, role: "project_manager" | "accountant") {
    this.windows.update((list) =>
      list.map((w) =>
        w.id === id
          ? {
              ...w,
              appliesTo: w.appliesTo.includes(role) ? w.appliesTo.filter((r) => r !== role) : [...w.appliesTo, role],
            }
          : w
      )
    );
    this.markDirty();
  }

  exportLog() {
    this.exporting.set(true);
    this.api.exportAuditLog({ days: 7 }).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.exporting.set(false);
        alert("Failed to export audit log.");
      },
    });
  }

  save() {
    this.saving.set(true);
    this.api.saveAccessSchedule({
      enabled: this.enabled(),
      windows: this.windows().map((w) => ({
        id: w.id,
        startTime: w.startTime,
        endTime: w.endTime,
        days: w.days,
        appliesTo: w.appliesTo,
        note: w.note,
        isActive: w.isActive,
      })),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dirty.set(false);
      },
      error: () => {
        this.saving.set(false);
        alert("Failed to save access schedule.");
      },
    });
  }
}
