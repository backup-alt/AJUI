import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subject, debounceTime, takeUntil } from "rxjs";
import { ApiService } from "../../core/api.service";

@Component({
  selector: "agb-settings-reports",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Reports Settings</strong>
      </nav>
      <h1>Reports Settings</h1>
      <p>Default formats, date ranges, and email recipients for reports.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Default Export</h2>
          <p>Used when generating a report without specifying a format.</p>
        </div>
        @if (saving()) {
          <span class="settings-w11-saving">Saving…</span>
        } @else if (lastSaved()) {
          <span class="settings-w11-saved">Saved</span>
        }
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-field">
          <label>Default export format</label>
          <select [value]="format()" (change)="onChange('format', $any($event.target).value)">
            <option value="Excel">Excel</option>
            <option value="PDF">PDF</option>
            <option value="CSV">CSV</option>
          </select>
        </div>
        <div class="settings-w11-field">
          <label>File name prefix</label>
          <input type="text" [value]="prefix()" (input)="onChange('prefix', $any($event.target).value)" />
        </div>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Include project ID in filename</strong>
            <small>Append project IDs to exported records.</small>
          </div>
          <input type="checkbox" [checked]="includeProjectId()" (change)="onChange('includeProjectId', $any($event.target).checked)" />
        </label>
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Email Digests</h2>
          <p>Send scheduled reports to a list of recipients.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-field">
          <label>Recipient emails (comma separated)</label>
          <input
            type="text"
            placeholder="karthik@agbuilders.com, suresh@agbuilders.com"
            [value]="recipients()"
            (input)="onChange('recipients', $any($event.target).value)"
          />
        </div>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Send daily digest at 8:00 AM</strong>
            <small>Yesterday's submissions and pending items.</small>
          </div>
          <input type="checkbox" [checked]="dailyDigest()" (change)="onChange('dailyDigest', $any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Send weekly digest every Monday</strong>
            <small>Last week's totals and pending items.</small>
          </div>
          <input type="checkbox" [checked]="weeklyDigest()" (change)="onChange('weeklyDigest', $any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Send monthly report on the 1st</strong>
            <small>Full financial summary for the previous month.</small>
          </div>
          <input type="checkbox" [checked]="monthlyDigest()" (change)="onChange('monthlyDigest', $any($event.target).checked)" />
        </label>
      </div>
    </section>
  `,
  styles: [`
    .settings-w11-saving, .settings-w11-saved {
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 12px;
    }
    .settings-w11-saving { background: #fef3c7; color: #92400e; }
    .settings-w11-saved { background: #d1fae5; color: #065f46; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsReportsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly destroy$ = new Subject<void>();
  private readonly saveSubject = new Subject<Record<string, any>>();

  readonly format = signal<"Excel" | "PDF" | "CSV">("Excel");
  readonly prefix = signal("AGB");
  readonly includeProjectId = signal(true);
  readonly recipients = signal("");
  readonly dailyDigest = signal(true);
  readonly weeklyDigest = signal(true);
  readonly monthlyDigest = signal(false);

  readonly saving = signal(false);
  readonly lastSaved = signal(false);

  ngOnInit() {
    this.loadSettings();

    this.saveSubject
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe((patch) => this.saveSettings(patch));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSettings() {
    this.api.getReportsSettings().subscribe({
      next: (s) => {
        this.format.set(s.format || "Excel");
        this.prefix.set(s.fileNamePrefix || "AGB");
        this.includeProjectId.set(!!s.includeProjectId);
        this.recipients.set((s.recipients || []).join(", "));
        this.dailyDigest.set(!!s.dailyDigest);
        this.weeklyDigest.set(!!s.weeklyDigest);
        this.monthlyDigest.set(!!s.monthlyDigest);
      },
      error: () => {
        // Keep defaults
      },
    });
  }

  onChange(key: string, value: any) {
    switch (key) {
      case "format": this.format.set(value); break;
      case "prefix": this.prefix.set(value); break;
      case "includeProjectId": this.includeProjectId.set(!!value); break;
      case "recipients": this.recipients.set(value); break;
      case "dailyDigest": this.dailyDigest.set(!!value); break;
      case "weeklyDigest": this.weeklyDigest.set(!!value); break;
      case "monthlyDigest": this.monthlyDigest.set(!!value); break;
    }

    this.lastSaved.set(false);
    this.saveSubject.next({ [key]: value });
  }

  private saveSettings(patch: Record<string, any>) {
    this.saving.set(true);

    const payload: any = { ...patch };
    if ("recipients" in patch) {
      payload.recipients = String(patch.recipients || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    this.api.saveReportsSettings(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.lastSaved.set(true);
        setTimeout(() => this.lastSaved.set(false), 2000);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
