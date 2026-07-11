import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../core/api.service";

type Theme = "light" | "dark" | "system";

@Component({
  selector: "agb-settings-appearance",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Appearance</strong>
      </nav>
      <h1>Appearance</h1>
      <p>Customize how the AGB Admin Console looks across your devices.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Theme</h2>
          <p>Choose your preferred color scheme. System follows your OS setting.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-theme-grid">
          <button
            type="button"
            class="settings-w11-theme-card"
            [class.active]="theme() === 'light'"
            (click)="theme.set('light')"
            aria-label="Light theme"
          >
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
            @if (theme() === 'light') {
              <span class="settings-w11-theme-check" aria-hidden="true">
                <svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            }
          </button>

          <button
            type="button"
            class="settings-w11-theme-card"
            [class.active]="theme() === 'dark'"
            (click)="theme.set('dark')"
            aria-label="Dark theme"
          >
            <div class="settings-w11-theme-preview settings-w11-theme-preview-dark">
              <div class="settings-w11-theme-preview-bar"></div>
              <div class="settings-w11-theme-preview-content">
                <div class="settings-w11-theme-preview-line"></div>
                <div class="settings-w11-theme-preview-line short"></div>
                <div class="settings-w11-theme-preview-line"></div>
              </div>
            </div>
            <div class="settings-w11-theme-meta">
              <strong>Dark</strong>
              <small>Easier on the eyes in low light</small>
            </div>
            @if (theme() === 'dark') {
              <span class="settings-w11-theme-check" aria-hidden="true">
                <svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            }
          </button>

          <button
            type="button"
            class="settings-w11-theme-card"
            [class.active]="theme() === 'system'"
            (click)="theme.set('system')"
            aria-label="System theme"
          >
            <div class="settings-w11-theme-preview settings-w11-theme-preview-system">
              <div class="settings-w11-theme-preview-half settings-w11-theme-preview-light">
                <div class="settings-w11-theme-preview-bar"></div>
              </div>
              <div class="settings-w11-theme-preview-half settings-w11-theme-preview-dark">
                <div class="settings-w11-theme-preview-bar"></div>
              </div>
            </div>
            <div class="settings-w11-theme-meta">
              <strong>System</strong>
              <small>Match your operating system</small>
            </div>
            @if (theme() === 'system') {
              <span class="settings-w11-theme-check" aria-hidden="true">
                <svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            }
          </button>
        </div>
      </div>
    </section>

    <div class="settings-w11-sticky-actions">
      <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="apply()">
        Apply changes
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAppearanceComponent {
  private readonly api = inject(ApiService);

  readonly theme = signal<Theme>((localStorage.getItem("agb_theme") as Theme) || this.getPersistedTheme());

  private getPersistedTheme(): Theme {
    const saved = localStorage.getItem("agb_theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "system";
  }

  constructor() {
    this.applyTheme();

    effect(() => {
      this.applyTheme();
    });
  }

  private applyTheme() {
    const t = this.theme();
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark-mode");
    } else if (t === "light") {
      root.classList.remove("dark-mode");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark-mode", prefersDark);
    }
  }

  apply() {
    localStorage.setItem("agb_theme", this.theme());

    this.api.saveAppearancePrefs({
      theme: this.theme(),
    }).subscribe({
      next: () => {},
      error: () => {},
    });
  }
}