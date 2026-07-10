import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { ApiService } from "../../core/api.service";

interface Session {
  id: string;
  device: string;
  ip: string;
  location?: string;
  lastActiveAt: string;
  isCurrent: boolean;
  createdAt: string;
}

@Component({
  selector: "agb-settings-sessions",
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Sessions</strong>
      </nav>
      <h1>Sessions</h1>
      <p>Active sign-in sessions across the web app.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Active Sessions</h2>
          <p>Sign out other sessions if you see activity you don't recognize.</p>
        </div>
        <button
          type="button"
          class="settings-w11-btn settings-w11-btn-danger-outline"
          (click)="revokeAllOthers()"
          [disabled]="revokingAll() || nonCurrentSessions().length === 0"
        >
          {{ revokingAll() ? 'Signing out…' : 'Sign out all other sessions' }}
        </button>
      </div>
      <div class="settings-w11-card-body">
        @if (loading()) {
          <p class="settings-w11-empty-hint">Loading sessions…</p>
        } @else if (sessions().length === 0) {
          <p class="settings-w11-empty-hint">No active sessions.</p>
        } @else {
          @for (s of sessions(); track s.id) {
            <div class="settings-w11-device-row">
              <div class="settings-w11-device-icon">
                <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </div>
              <div class="settings-w11-device-info">
                <strong>{{ s.device }}</strong>
                <small>{{ s.ip }}{{ s.location ? ' · ' + s.location : '' }} · Last active {{ formatRelative(s.lastActiveAt) }}</small>
              </div>
              @if (s.isCurrent) {
                <span class="settings-w11-status-pill" data-status="active">Active now</span>
              } @else {
                <button
                  type="button"
                  class="settings-w11-btn settings-w11-btn-danger-outline small"
                  (click)="revoke(s.id)"
                  [disabled]="revoking() === s.id"
                >
                  {{ revoking() === s.id ? 'Signing out…' : 'Revoke' }}
                </button>
              }
            </div>
          }
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSessionsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly sessions = signal<Session[]>([]);
  readonly loading = signal(false);
  readonly revoking = signal<string | null>(null);
  readonly revokingAll = signal(false);

  readonly nonCurrentSessions = () => this.sessions().filter((s) => !s.isCurrent);

  ngOnInit() {
    this.loadSessions();
  }

  private loadSessions() {
    this.loading.set(true);
    this.api.listSessions().subscribe({
      next: (res) => {
        this.sessions.set(res?.sessions || []);
        this.loading.set(false);
      },
      error: () => {
        this.sessions.set([]);
        this.loading.set(false);
      },
    });
  }

  revoke(id: string) {
    if (!confirm("Sign out this session? You will need to sign in again on that device.")) return;
    this.revoking.set(id);
    this.api.revokeSession(id).subscribe({
      next: () => {
        this.revoking.set(null);
        this.sessions.update((list) => list.filter((s) => s.id !== id));
      },
      error: () => {
        this.revoking.set(null);
        alert("Failed to sign out this session.");
      },
    });
  }

  revokeAllOthers() {
    if (!confirm("Sign out all other sessions? You will remain signed in on this device.")) return;
    this.revokingAll.set(true);
    this.api.revokeAllOtherSessions().subscribe({
      next: () => {
        this.revokingAll.set(false);
        this.sessions.update((list) => list.filter((s) => s.isCurrent));
      },
      error: () => {
        this.revokingAll.set(false);
        alert("Failed to sign out other sessions.");
      },
    });
  }

  formatRelative(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  }
}
