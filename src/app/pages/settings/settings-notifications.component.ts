import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "agb-settings-notifications",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Notifications</strong>
      </nav>
      <h1>Notifications</h1>
      <p>Choose what you want to be notified about and how.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Push notifications</h2>
          <p>Sent to your browser or mobile when something important happens.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <label class="settings-w11-toggle-row">
          <div>
            <strong>New submission</strong>
            <small>When a supervisor submits materials, labour, expenses, or payments.</small>
          </div>
          <input type="checkbox" [checked]="pushSubmission()" (change)="pushSubmission.set($any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Approval decisions</strong>
            <small>When your submissions are approved or rejected by admin.</small>
          </div>
          <input type="checkbox" [checked]="pushDecisions()" (change)="pushDecisions.set($any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Schedule reminders</strong>
            <small>15-minute warning before a restricted access window starts.</small>
          </div>
          <input type="checkbox" [checked]="pushSchedule()" (change)="pushSchedule.set($any($event.target).checked)" />
        </label>
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Email digests</h2>
          <p>Receive a summary of activity by email.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Daily summary</strong>
            <small>Sent every morning at 8:00 AM with yesterday's activity.</small>
          </div>
          <input type="checkbox" [checked]="emailDaily()" (change)="emailDaily.set($any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Weekly summary</strong>
            <small>Sent every Monday with last week's totals and pending items.</small>
          </div>
          <input type="checkbox" [checked]="emailWeekly()" (change)="emailWeekly.set($any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Monthly report</strong>
            <small>Sent on the 1st of each month with full financial summary.</small>
          </div>
          <input type="checkbox" [checked]="emailMonthly()" (change)="emailMonthly.set($any($event.target).checked)" />
        </label>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsNotificationsComponent {
  readonly pushSubmission = signal(true);
  readonly pushDecisions = signal(true);
  readonly pushSchedule = signal(false);
  readonly emailDaily = signal(true);
  readonly emailWeekly = signal(true);
  readonly emailMonthly = signal(false);
}
