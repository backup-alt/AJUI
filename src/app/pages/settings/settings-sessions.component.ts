import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

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
        <button type="button" class="settings-w11-btn settings-w11-btn-danger-outline">Sign out all other sessions</button>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-device-row">
          <div class="settings-w11-device-icon">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div class="settings-w11-device-info">
            <strong>Current session</strong>
            <small>Chrome 120 · Windows 11 · 103.21.x.x · Started 2 hours ago</small>
          </div>
          <span class="settings-w11-status-pill" data-status="active">Active now</span>
        </div>
        <div class="settings-w11-device-row">
          <div class="settings-w11-device-icon">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div class="settings-w11-device-info">
            <strong>Edge on Windows</strong>
            <small>103.45.x.x · Last active yesterday at 6:14 PM</small>
          </div>
          <button type="button" class="settings-w11-btn settings-w11-btn-danger-outline small">Revoke</button>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSessionsComponent {}
