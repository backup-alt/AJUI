import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

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

@Component({
  selector: "agb-settings-access-schedule",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Access Schedule</strong>
      </nav>
      <h1>Access Schedule</h1>
      <p>Define time windows where only admins can log in. Useful for maintenance, payroll, or sensitive data updates.</p>
    </header>

    <div class="settings-w11-callout">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 1 18h18L10 2Z M10 8v4 M10 14h.01" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div>
        <strong>How it works</strong>
        <p>During restricted windows, project managers and accountants cannot log in or access settings. Admins always have access.</p>
      </div>
    </div>

    <section class="settings-w11-card">
      <div class="settings-w11-toggle-row big">
        <div>
          <strong>Enable Access Schedule</strong>
          <small>When ON, the schedule below is enforced. When OFF, all users can access at any time.</small>
        </div>
        <label class="settings-w11-switch">
          <input type="checkbox" [checked]="enabled()" (change)="enabled.set($any($event.target).checked)" />
          <span class="settings-w11-switch-slider"></span>
        </label>
      </div>
      <div class="settings-w11-status-line">
        <span class="settings-w11-status-dot" [class.green]="!isCurrentlyRestricted()" [class.red]="isCurrentlyRestricted()"></span>
        <span>
          Currently:
          <strong>{{ isCurrentlyRestricted() ? 'Restricted — only admins' : 'Open access' }}</strong>
        </span>
        <small> · {{ currentTime() }} · next change {{ nextChange() }}</small>
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
          <h2>Today's Timeline</h2>
          <p>Visual overview of when access is restricted today.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-timeline">
          @for (h of hours; track h) {
            <div class="settings-w11-timeline-hour" [class.restricted]="isHourRestricted(h)">
              <span>{{ formatHour(h) }}</span>
            </div>
          }
        </div>
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
            <strong>Notify users 15 minutes before a restricted window</strong>
            <small>Push and email warning before access is blocked.</small>
          </div>
          <input type="checkbox" [checked]="notifyBefore()" (change)="notifyBefore.set($any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Notify admin when a user is blocked</strong>
            <small>Get notified about blocked login attempts.</small>
          </div>
          <input type="checkbox" [checked]="notifyAdmin()" (change)="notifyAdmin.set($any($event.target).checked)" />
        </label>
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Audit Log</h2>
          <p>Record of access attempts during restricted windows.</p>
        </div>
        <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="exportLog()">Export log</button>
      </div>
      <div class="settings-w11-card-body">
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Log all access attempts during restricted windows</strong>
            <small>Keep a record of who tried to log in and when.</small>
          </div>
          <input type="checkbox" [checked]="logAttempts()" (change)="logAttempts.set($any($event.target).checked)" />
        </label>
        <div class="settings-w11-table-wrap" style="margin-top: 16px">
          <table class="settings-w11-table">
            <thead>
              <tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Result</th><th>IP</th></tr>
            </thead>
            <tbody>
              <tr><td>Today 23:42</td><td>suresh@agbuilders.com</td><td>PM</td><td>Login attempt</td><td><span class="settings-w11-status-pill" data-status="rejected">Blocked</span></td><td>103.21.x.x</td></tr>
              <tr><td>Today 23:15</td><td>anitha@agbuilders.com</td><td>PM</td><td>Settings access</td><td><span class="settings-w11-status-pill" data-status="rejected">Blocked</span></td><td>103.21.x.x</td></tr>
              <tr><td>Yesterday 23:50</td><td>vinoth@agbuilders.com</td><td>Accountant</td><td>Login attempt</td><td><span class="settings-w11-status-pill" data-status="rejected">Blocked</span></td><td>157.45.x.x</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div class="settings-w11-sticky-actions">
      <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="save()">Save schedule</button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAccessScheduleComponent {
  readonly enabled = signal(false);
  readonly notifyBefore = signal(true);
  readonly notifyAdmin = signal(true);
  readonly logAttempts = signal(true);

  readonly allDays: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  readonly windows = signal<AccessWindow[]>([
    {
      id: "W-1",
      startTime: "23:00",
      endTime: "07:00",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      appliesTo: ["project_manager", "accountant"],
      note: "Daily maintenance window",
      isActive: true,
      createdAt: "2024-09-12",
      createdBy: "Karthik Raja",
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
    return "in 2h 14m";
  }

  isHourRestricted(h: number): boolean {
    if (!this.enabled()) return false;
    return this.windows().some((w) => {
      if (!w.isActive) return false;
      const [sh] = w.startTime.split(":").map(Number);
      const [eh] = w.endTime.split(":").map(Number);
      if (sh < eh) return h >= sh && h < eh;
      return h >= sh || h < eh;
    });
  }

  formatHour(h: number): string {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
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
  }

  deleteWindow(id: string) {
    if (confirm("Delete this restricted window?")) {
      this.windows.update((list) => list.filter((w) => w.id !== id));
    }
  }

  toggleWindow(id: string, value: boolean) {
    this.windows.update((list) => list.map((w) => (w.id === id ? { ...w, isActive: value } : w)));
  }

  updateWindow(id: string, patch: Partial<AccessWindow>) {
    this.windows.update((list) => list.map((w) => (w.id === id ? { ...w, ...patch } : w)));
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
  }

  exportLog() {
    alert("Exporting audit log. (UI placeholder)");
  }

  save() {
    alert("Schedule saved. (UI placeholder — wire to backend in next step.)");
  }
}
