import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, signal, inject } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import {
  IonHeader,
  IonToolbar,
} from "@ionic/angular/standalone";
import { ApiService } from "../core/api.service";

@Component({
  selector: "agb-enterprise-header",
  standalone: true,
  imports: [CommonModule, RouterLink, IonHeader, IonToolbar],
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

            <button
              type="button"
              class="header-profile-trigger"
              (click)="toggleProfileMenu()"
              [class.active]="profileMenuOpen()"
              [attr.aria-label]="'Open user menu'"
              [attr.aria-expanded]="profileMenuOpen()"
            >
              <span class="header-avatar" [style.background]="avatarColor">
                {{ userInitial }}
              </span>
              <span class="header-user-info">
                <strong class="header-user-name">{{ userName }}</strong>
                <span class="header-user-role">{{ role }}</span>
              </span>
              <svg class="header-chevron" [class.rotated]="profileMenuOpen()" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            <div class="header-profile-menu" *ngIf="profileMenuOpen()">
              <div class="header-menu-header">
                <div class="header-menu-user">
                  <span class="header-avatar small" [style.background]="avatarColor">{{ userInitial }}</span>
                  <div class="header-menu-user-info">
                    <strong>{{ userName }}</strong>
                    <span>{{ currentUser()?.email || '' }}</span>
                  </div>
                </div>
                <div class="header-menu-status-row">
                  <span class="header-role-badge">{{ role }}</span>
                  <span class="header-status" [class.active]="currentUser()?.status === 'active'">
                    <span class="status-dot"></span>
                    {{ currentUser()?.status === 'active' ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </div>
              <a class="header-menu-item" [routerLink]="['/settings']" (click)="closeProfileMenu()">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="menu-icon">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                <span>Settings</span>
              </a>
              <button type="button" class="header-menu-item header-menu-logout" (click)="logout()">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="menu-icon">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </ion-toolbar>
    </ion-header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnterpriseHeaderComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  @Input() title = "Dashboard";
  @Input() eyebrow = "Annai Golden Builders";
  @Input() metaLabel = "";
  @Input() role = "Admin";
  @Input() dark = false;
  @Input() blurred = false;
  @Input() showLogo = false;
  @Input() showTitle = true;
  @Input() showMenu = false;
  @Input() searchPlaceholder = "Search";

  readonly darkMode = signal(false);
  readonly profileMenuOpen = signal(false);
  readonly logoPath = "assets/logo.png";

  readonly currentUser = this.api.user;

  get userName(): string {
    return this.currentUser()?.name || "User";
  }

  get userInitial(): string {
    return (this.userName || "A").trim().charAt(0).toUpperCase() || "A";
  }

  get avatarColor(): string {
    const colors = [
      "linear-gradient(135deg, #002263, #1a4499)",
      "linear-gradient(135deg, #1a5c2e, #2d8a4e)",
      "linear-gradient(135deg, #7a3d00, #b86310)",
      "linear-gradient(135deg, #5c1a5c, #8a2d8a)",
      "linear-gradient(135deg, #1a3d5c, #2d608a)",
      "linear-gradient(135deg, #5c1a1a, #8a2d2d)",
    ];
    const name = this.userName || "A";
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  constructor() {
    const enabled = this.readDarkModePreference();
    this.setDarkMode(enabled);
  }

  toggleDarkMode() {
    this.setDarkMode(!this.darkMode());
  }

  toggleProfileMenu() {
    this.profileMenuOpen.update((v) => !v);
  }

  closeProfileMenu() {
    this.profileMenuOpen.set(false);
  }

  logout() {
    this.closeProfileMenu();
    this.api.logout().subscribe({
      next: () => void this.router.navigate(["/login"]),
      error: () => void this.router.navigate(["/login"]),
    });
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
