import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "agb-settings-devices",
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Devices</strong>
      </nav>
      <h1>Devices</h1>
      <p>Devices currently signed in to your account.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Active Devices</h2>
          <p>Remove a device to sign it out of your account.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-device-row">
          <div class="settings-w11-device-icon">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div class="settings-w11-device-info">
            <strong>Chrome on Windows</strong>
            <small>Chennai, India · Last active 2 minutes ago</small>
          </div>
          <span class="settings-w11-status-pill" data-status="active">This device</span>
        </div>
        <div class="settings-w11-device-row">
          <div class="settings-w11-device-icon">
            <svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11 18h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div class="settings-w11-device-info">
            <strong>Safari on iPhone</strong>
            <small>Chennai, India · Last active 3 hours ago</small>
          </div>
          <button type="button" class="settings-w11-btn settings-w11-btn-danger-outline small">Remove</button>
        </div>
        <div class="settings-w11-device-row">
          <div class="settings-w11-device-icon">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div class="settings-w11-device-info">
            <strong>Firefox on macOS</strong>
            <small>Coimbatore, India · Last active 2 days ago</small>
          </div>
          <button type="button" class="settings-w11-btn settings-w11-btn-danger-outline small">Remove</button>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDevicesComponent {}
