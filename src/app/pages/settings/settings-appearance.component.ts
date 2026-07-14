import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "agb-settings-appearance",
  standalone: true,
  imports: [],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Appearance</strong>
      </nav>
      <h1>Appearance</h1>
      <p>Theme settings have been disabled for a consistent experience.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Theme</h2>
          <p>Light mode is always enabled for a consistent experience.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-theme-grid">
          <div class="settings-w11-theme-card active" style="opacity:0.6; cursor:default;">
            <div class="settings-w11-theme-preview settings-w11-theme-preview-light">
              <div class="settings-w11-theme-preview-bar"></div>
              <div class="settings-w11-theme-preview-content">
                <div class="settings-w11-theme-preview-line"></div>
                <div class="settings-w11-theme-preview-line short"></div>
                <div class="settings-w11-theme-preview-line"></div>
              </div>
            </div>
            <div class="settings-w11-theme-meta">
              <strong>Light</strong>
              <small>Classic look with white background</small>
            </div>
            <span class="settings-w11-theme-check" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAppearanceComponent {}