import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "agb-settings-about",
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>About</strong>
      </nav>
      <h1>About</h1>
      <p>Information about this app and your account.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Application</h2>
          <p>Build details and support.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <dl class="settings-w11-dl">
          <div><dt>App name</dt><dd>AGB Admin Console</dd></div>
          <div><dt>Version</dt><dd>1.0.0</dd></div>
          <div><dt>Build</dt><dd>{{ buildId }}</dd></div>
          <div><dt>Last updated</dt><dd>{{ today }}</dd></div>
        </dl>
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Support</h2>
          <p>Help resources and contact information.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-link-row">
          <div>
            <strong>Help center</strong>
            <small>Browse guides and FAQs.</small>
          </div>
          <a href="#" class="settings-w11-btn settings-w11-btn-ghost small">Open</a>
        </div>
        <div class="settings-w11-link-row">
          <div>
            <strong>Terms of service</strong>
            <small>Read our terms.</small>
          </div>
          <a href="#" class="settings-w11-btn settings-w11-btn-ghost small">Open</a>
        </div>
        <div class="settings-w11-link-row">
          <div>
            <strong>Privacy policy</strong>
            <small>How we handle your data.</small>
          </div>
          <a href="#" class="settings-w11-btn settings-w11-btn-ghost small">Open</a>
        </div>
        <div class="settings-w11-link-row">
          <div>
            <strong>Contact support</strong>
            <small>support@annaigoldenbuilders.online</small>
          </div>
          <a href="mailto:support@annaigoldenbuilders.online" class="settings-w11-btn settings-w11-btn-ghost small">Email</a>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAboutComponent {
  readonly buildId = "2024.10.21-001";
  readonly today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
