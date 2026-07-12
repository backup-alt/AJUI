import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subject, debounceTime, takeUntil } from "rxjs";
import { ApiService } from "../../core/api.service";

interface NotificationPrefs {
  pushNewSubmission: boolean;
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
        <strong>General Settings</strong>
      </nav>
      <h1>General Settings</h1>
      <p>Configure notifications and approval behavior for your workspace.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Approvals</h2>
          <p>Control how approvals work across the system.</p>
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
          <input type="checkbox" [checked]="pushNewSubmission()" (change)="onToggle('pushNewSubmission', $any($event.target).checked)" />
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
        this.singleApprovalForSiteExpenseMaterials.set(prefs.singleApprovalForSiteExpenseMaterials ?? false);
      },
      error: () => {
        // Fallback: keep defaults
      },
    });
  }

  onToggle(key: keyof NotificationPrefs, value: boolean) {
    if (key === "pushNewSubmission") this.pushNewSubmission.set(value);
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
