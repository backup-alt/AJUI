import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, signal, inject } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import {
  IonHeader,
  IonToolbar,
} from "@ionic/angular/standalone";
import { ApiService } from "../core/api.service";
import { AccessRestrictionService } from "../core/access-restriction.service";

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

          <div class="toolbar-right">
            <div class="header-profile-wrapper">
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
                    <span class="header-user-role">{{ userRole }}</span>
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
                    <span class="header-role-badge">{{ userRole }}</span>
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
        </div>
      </ion-toolbar>
      @if (accessRestriction.restricted()) {
        <div class="access-restriction-banner" role="alert">
          <span class="access-restriction-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16"><path d="M8 1.5 14.5 13h-13L8 1.5Z M8 6v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="11.8" r="0.8" fill="currentColor"/></svg>
          </span>
          <span class="access-restriction-text">{{ accessRestriction.reason() }}</span>
          <button type="button" class="access-restriction-close" aria-label="Dismiss" (click)="accessRestriction.dismiss()">
            <svg viewBox="0 0 16 16"><path d="m4 4 8 8 M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      }
    </ion-header>
  `,
  styles: [`
    .access-restriction-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 24px;
      background: #fef3c7;
      border-top: 1px solid #fcd34d;
      color: #92400e;
      font-size: 13px;
      line-height: 1.4;
    }
    .access-restriction-icon { display: inline-flex; flex: 0 0 auto; width: 18px; height: 18px; }
    .access-restriction-icon svg { width: 18px; height: 18px; }
    .access-restriction-text { flex: 1 1 auto; min-width: 0; }
    .access-restriction-close {
      flex: 0 0 auto;
      background: none;
      border: none;
      cursor: pointer;
      color: #92400e;
      padding: 4px;
      display: Inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    .access-restriction-close:hover { background: rgba(146, 64, 14, 0.1); }
    .access-restriction-close svg { width: 14px; height: 14px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnterpriseHeaderComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly accessRestriction = inject(AccessRestrictionService);

  @Input() title = "Dashboard";
  @Input() eyebrow = "Annai Golden Builders";
  @Input() metaLabel = "";
  @Input() role = "";
  @Input() dark = false;
  @Input() blurred = false;
  @Input() showLogo = false;
  @Input() showTitle = true;
  @Input() showMenu = false;
  @Input() searchPlaceholder = "Search";

  readonly profileMenuOpen = signal(false);
  readonly logoPath = "assets/logo.png";

  readonly currentUser = this.api.user;

  get userName(): string {
    return this.currentUser()?.name || "User";
  }

  get userRole(): string {
    const roleMap: Record<string, string> = {
      admin: "Admin",
      project_manager: "Project Manager",
      accountant: "Accountant",
      supervisor: "Supervisor",
    };
    if (this.role) return this.role;
    return roleMap[this.currentUser()?.role || ""] || this.currentUser()?.role || "User";
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
}
