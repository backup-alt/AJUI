import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subject, debounceTime, takeUntil } from "rxjs";
import { ApiService } from "../../core/api.service";

interface NotificationPrefs {
  pushNewSubmission: boolean;
  emailDaily: boolean;
  emailWeekly: boolean;
  emailMonthly: boolean;
  singleApprovalForSiteExpenseMaterials: boolean;
}

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
        @if (saving()) {
          <span class="settings-w11-saving">Saving…</span>
        } @else if (lastSaved()) {
          <span class="settings-w11-saved">Saved</span>
        }
      </div>
      <div class="settings-w11-card-body">
        <label class="settings-w11-toggle-row">
          <div>
            <strong>New submission</strong>
            <small>When a supervisor submits materials, labour, expenses, or payments.</small>
          </div>
          <input type="checkbox" [checked]="pushNewSubmission()" (change)="onToggle('pushNewSubmission', $any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>One approval for material and expense</strong>
            <small>When a site material is added as expense, only one approval on either table is required.</small>
          </div>
          <input type="checkbox" [checked]="singleApprovalForSiteExpenseMaterials()" (change)="onToggle('singleApprovalForSiteExpenseMaterials', $any($event.target).checked)" />
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
          <input type="checkbox" [checked]="emailDaily()" (change)="onToggle('emailDaily', $any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Weekly summary</strong>
            <small>Sent every Monday with last week's totals and pending items.</small>
          </div>
          <input type="checkbox" [checked]="emailWeekly()" (change)="onToggle('emailWeekly', $any($event.target).checked)" />
        </label>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Monthly report</strong>
            <small>Sent on the 1st of each month with full financial summary.</small>
          </div>
          <input type="checkbox" [checked]="emailMonthly()" (change)="onToggle('emailMonthly', $any($event.target).checked)" />
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
    .settings-w11-saving {
      background: #fef3c7;
      color: #92400e;
    }
    .settings-w11-saved {
      background: #d1fae5;
      color: #065f46;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsNotificationsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly destroy$ = new Subject<void>();
  private readonly saveSubject = new Subject<Partial<NotificationPrefs>>();

  readonly pushNewSubmission = signal(true);
  readonly emailDaily = signal(true);
  readonly emailWeekly = signal(true);
  readonly emailMonthly = signal(false);
  readonly singleApprovalForSiteExpenseMaterials = signal(false);

  readonly saving = signal(false);
  readonly lastSaved = signal(false);

  ngOnInit() {
    this.loadPrefs();

    this.saveSubject
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe((prefs) => this.savePrefs(prefs));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPrefs() {
    this.api.getNotificationPrefs().subscribe({
      next: (prefs) => {
        this.pushNewSubmission.set(prefs.pushNewSubmission ?? true);
        this.emailDaily.set(prefs.emailDaily ?? true);
        this.emailWeekly.set(prefs.emailWeekly ?? true);
        this.emailMonthly.set(prefs.emailMonthly ?? false);
        this.singleApprovalForSiteExpenseMaterials.set(prefs.singleApprovalForSiteExpenseMaterials ?? false);
      },
      error: () => {
        // Fallback: keep defaults
      },
    });
  }

  onToggle(key: keyof NotificationPrefs, value: boolean) {
    if (key === "pushNewSubmission") this.pushNewSubmission.set(value);
    if (key === "emailDaily") this.emailDaily.set(value);
    if (key === "emailWeekly") this.emailWeekly.set(value);
    if (key === "emailMonthly") this.emailMonthly.set(value);
    if (key === "singleApprovalForSiteExpenseMaterials") this.singleApprovalForSiteExpenseMaterials.set(value);

    this.lastSaved.set(false);
    this.saveSubject.next({ [key]: value } as any);
  }

  private savePrefs(prefs: Partial<NotificationPrefs>) {
    this.saving.set(true);
    this.api.saveNotificationPrefs(prefs).subscribe({
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
