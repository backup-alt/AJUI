import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

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
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-field">
          <label>Default export format</label>
          <select [value]="format()" (change)="format.set($any($event.target).value)">
            <option>Excel</option>
            <option>PDF</option>
            <option>CSV</option>
          </select>
        </div>
        <div class="settings-w11-field">
          <label>File name prefix</label>
          <input type="text" [value]="prefix()" (input)="prefix.set($any($event.target).value)" />
        </div>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Include project ID in filename</strong>
            <small>Append project IDs to exported records.</small>
          </div>
          <input type="checkbox" [checked]="includeProjectId()" (change)="includeProjectId.set($any($event.target).checked)" />
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
          <input type="text" placeholder="karthik@agbuilders.com, suresh@agbuilders.com" [value]="recipients()" (input)="recipients.set($any($event.target).value)" />
        </div>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Send daily digest at 8:00 AM</strong>
            <small>Yesterday's submissions and pending items.</small>
          </div>
          <input type="checkbox" [checked]="dailyDigest()" (change)="dailyDigest.set($any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Send weekly digest every Monday</strong>
            <small>Last week's totals and pending items.</small>
          </div>
          <input type="checkbox" [checked]="weeklyDigest()" (change)="weeklyDigest.set($any($event.target).checked)" />
        </label>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsReportsComponent {
  readonly format = signal("Excel");
  readonly prefix = signal("AGB");
  readonly includeProjectId = signal(true);
  readonly recipients = signal("");
  readonly dailyDigest = signal(true);
  readonly weeklyDigest = signal(true);
}
