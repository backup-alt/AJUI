import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, signal } from "@angular/core";
import {
  IonHeader,
  IonToolbar,
} from "@ionic/angular/standalone";

@Component({
  selector: "agb-enterprise-header",
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar],
  template: `
    <ion-header class="enterprise-header" [class.client-header]="dark" [class.modal-blurred]="blurred">
      <ion-toolbar>
        <div class="enterprise-toolbar">
          <div class="toolbar-context">
            <span>{{ eyebrow }}</span>
            <strong>{{ title }}</strong>
          </div>

          <div class="toolbar-search">
            <input [placeholder]="searchPlaceholder" />
          </div>

          <div class="toolbar-right">
            <button
              type="button"
              class="dark-mode-toggle"
              [class.active]="darkMode()"
              [attr.aria-label]="darkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
              (click)="toggleDarkMode()"
            >
              <svg *ngIf="!darkMode()" viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                <path d="M20.5 14.2A7.4 7.4 0 0 1 9.8 3.5 8.3 8.3 0 1 0 20.5 14.2Z" />
              </svg>
              <svg *ngIf="darkMode()" viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            </button>
            <div class="toolbar-meta" *ngIf="metaLabel">
              <span>{{ metaLabel }}</span>
            </div>
          </div>
        </div>
      </ion-toolbar>
    </ion-header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnterpriseHeaderComponent {
  @Input() title = "Dashboard";
  @Input() eyebrow = "Annai Golden Builders";
  @Input() metaLabel = "Live workspace";
  @Input() role = "Admin";
  @Input() dark = false;
  @Input() blurred = false;
  @Input() showLogo = false;
  @Input() showTitle = true;
  @Input() showMenu = false;
  @Input() searchPlaceholder = "Search";

  readonly darkMode = signal(false);
  readonly logoPath = "assets/logo.png";

  constructor() {
    const enabled = this.readDarkModePreference();
    this.setDarkMode(enabled);
  }

  toggleDarkMode() {
    this.setDarkMode(!this.darkMode());
  }

  private setDarkMode(enabled: boolean) {
    this.darkMode.set(enabled);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark-mode", enabled);
    }
    try {
      localStorage.setItem("agb-erp:darkMode", String(enabled));
    } catch {
      // Dark mode is a UI preference only.
    }
  }

  private readDarkModePreference(): boolean {
    try {
      return localStorage.getItem("agb-erp:darkMode") === "true";
    } catch {
      return false;
    }
  }
}
