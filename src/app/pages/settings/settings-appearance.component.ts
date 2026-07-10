import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../core/api.service";

type Theme = "light" | "dark" | "system";
type Density = "comfortable" | "compact" | "roomy";
type FontSize = "sm" | "md" | "lg";

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

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Density</h2>
          <p>Adjust spacing in lists and tables.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-radio-row">
          @for (d of densities; track d.value) {
            <label class="settings-w11-radio-card" [class.active]="density() === d.value">
              <input type="radio" name="density" [value]="d.value" [checked]="density() === d.value" (change)="density.set(d.value)" />
              <div>
                <strong>{{ d.label }}</strong>
                <small>{{ d.note }}</small>
              </div>
            </label>
          }
        </div>
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Font size</h2>
          <p>Adjust the text size across the app.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-font-slider-wrap">
          <div class="settings-w11-font-slider-labels">
            <span>A</span>
            <span class="settings-w11-font-size-label" [class.active]="true">{{ fontSizeLabel() }}</span>
            <span>A</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            [value]="fontPercent()"
            (input)="fontPercent.set(+$any($event.target).value)"
            class="settings-w11-font-slider"
            aria-label="Font size"
          />
        </div>
        <div class="settings-w11-font-preview" [attr.data-size]="fontSize()">
          <strong>Preview text</strong>
          <p>Your text will appear like this across the app. Larger sizes improve readability on smaller screens.</p>
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

  readonly theme = signal<Theme>((localStorage.getItem("agb_theme") as Theme) || "light");
  readonly density = signal<Density>((localStorage.getItem("agb_density") as Density) || "comfortable");
  readonly fontPercent = signal<number>(parseInt(localStorage.getItem("agb_font") || "50", 10));

  readonly densities = [
    { value: "compact" as Density, label: "Compact", note: "Smaller padding and text" },
    { value: "comfortable" as Density, label: "Comfortable", note: "Default spacing" },
    { value: "roomy" as Density, label: "Roomy", note: "More breathing room" },
  ];

  readonly fontSize = (): FontSize => {
    const p = this.fontPercent();
    if (p <= 33) return "sm";
    if (p <= 66) return "md";
    return "lg";
  };

  readonly fontSizeLabel = (): string => {
    const p = this.fontPercent();
    if (p <= 33) return "Small";
    if (p <= 66) return "Medium";
    return "Large";
  };

  constructor() {
    // Load preferences from backend
    this.api.getAppearancePrefs().subscribe({
      next: (prefs) => {
        if (prefs.theme) this.theme.set(prefs.theme);
        if (prefs.density) this.density.set(prefs.density);
        if (prefs.fontSize) {
          const map: Record<string, number> = { sm: 16, md: 50, lg: 84 };
          if (prefs.fontSize in map) this.fontPercent.set(map[prefs.fontSize]);
        }
      },
      error: () => {
        // Fallback: keep localStorage defaults
      },
    });

    // Apply theme to document
    effect(() => {
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
    });

    // Apply density CSS variable to document
    effect(() => {
      const d = this.density();
      document.documentElement.dataset["density"] = d;
    });

    // Apply font scale to document (0-100 maps to 0.85x-1.15x)
    effect(() => {
      const p = this.fontPercent();
      const scale = 0.85 + (p / 100) * 0.30;
      document.documentElement.style.setProperty("--app-font-scale", scale.toFixed(2));
      const size = this.fontSize();
      document.documentElement.dataset["fontSize"] = size;
    });
  }

  apply() {
    localStorage.setItem("agb_theme", this.theme());
    localStorage.setItem("agb_density", this.density());
    localStorage.setItem("agb_font", String(this.fontPercent()));

    this.api.saveAppearancePrefs({
      theme: this.theme(),
      density: this.density(),
      fontSize: this.fontSize(),
    }).subscribe({
      next: () => {},
      error: () => {
        // Even if backend fails, local CSS application still works
      },
    });
  }
}
