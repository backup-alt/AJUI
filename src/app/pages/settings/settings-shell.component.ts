import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { ApiService } from "../../core/api.service";

type SettingsItem = {
  id: string;
  label: string;
  subtitle?: string;
  icon: string;
  route: string;
  badge?: number;
};

type SettingsGroup = {
  label: string;
  items: SettingsItem[];
};

@Component({
  selector: "agb-settings-shell",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  template: `
    <div class="settings-w11-fullscreen">
      <!-- Top bar with back button -->
      <header class="settings-w11-topbar">
        <button
          type="button"
          class="settings-w11-back-btn"
          (click)="goBack()"
          aria-label="Back to dashboard"
          title="Back"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12 4 6 10l6 6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="settings-w11-topbar-title">
          <strong>Settings</strong>
          <small>Manage your account, team, and workspace</small>
        </div>
        <div class="settings-w11-topbar-user">
          <div class="settings-w11-profile-wrapper">
            <button
              type="button"
              class="settings-w11-profile-trigger"
              (click)="toggleProfileMenu()"
              [class.active]="profileMenuOpen()"
              aria-label="Open user menu"
              [attr.aria-expanded]="profileMenuOpen()"
            >
              <span class="settings-w11-avatar-circle" [style.background]="avatarColor()">
                {{ userInitials() }}
              </span>
              <span class="settings-w11-profile-info">
                <strong>{{ userName() }}</strong>
                <span>{{ userRole() }}</span>
              </span>
              <svg class="settings-w11-profile-chevron" [class.rotated]="profileMenuOpen()" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            @if (profileMenuOpen()) {
              <div class="settings-w11-profile-menu">
                <div class="settings-w11-menu-header">
                  <div class="settings-w11-menu-user">
                    <span class="settings-w11-avatar-circle lg" [style.background]="avatarColor()">
                      {{ userInitials() }}
                    </span>
                    <div class="settings-w11-menu-user-info">
                      <strong>{{ userName() }}</strong>
                      <span>{{ userEmail() }}</span>
                    </div>
                  </div>
                  <div class="settings-w11-menu-status-row">
                    <span class="settings-w11-role-badge">{{ userRole() }}</span>
                    <span class="settings-w11-status-indicator" [class.active]="true">
                      <span class="settings-w11-status-dot-sm"></span>
                      Active
                    </span>
                  </div>
                </div>
                <a class="settings-w11-menu-item" [routerLink]="['/settings']" (click)="profileMenuOpen.set(false)">
                  <svg viewBox="0 0 24 24" class="settings-w11-menu-icon" aria-hidden="true">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  <span>Settings</span>
                </a>
                <button type="button" class="settings-w11-menu-item settings-w11-menu-logout" (click)="logout()">
                  <svg viewBox="0 0 24 24" class="settings-w11-menu-icon" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  <span>Sign out</span>
                </button>
              </div>
            }
          </div>
        </div>
      </header>

      <div class="settings-w11-shell">
        <!-- LEFT PANE: Navigation -->
        <aside class="settings-w11-nav" aria-label="Settings navigation">
          <div class="settings-w11-search">
            <svg viewBox="0 0 20 20" aria-hidden="true" class="settings-w11-search-icon">
              <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.5" />
              <path d="m13.5 13.5 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Find a setting"
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event.target).value)"
              aria-label="Search settings"
            />
          </div>

          <nav class="settings-w11-nav-list" role="navigation">
            @for (group of filteredGroups(); track group.label) {
              <div class="settings-w11-group">
                <div class="settings-w11-group-label">{{ group.label }}</div>
                @for (item of group.items; track item.id) {
                  <a
                    class="settings-w11-nav-item"
                    [routerLink]="item.route"
                    routerLinkActive="active"
                    [routerLinkActiveOptions]="{ exact: false }"
                    [attr.aria-label]="item.label"
                  >
                    <span class="settings-w11-nav-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path [attr.d]="item.icon" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                    <span class="settings-w11-nav-text">
                      <strong>{{ item.label }}</strong>
                      @if (item.subtitle) {
                        <small>{{ item.subtitle }}</small>
                      }
                    </span>
                    @if (item.badge) {
                      <span class="settings-w11-nav-badge">{{ item.badge }}</span>
                    }
                  </a>
                }
              </div>
            }

            @if (filteredGroups().length === 0) {
              <div class="settings-w11-empty">
                <p>No settings match "{{ searchQuery() }}"</p>
              </div>
            }
          </nav>
        </aside>

        <!-- RIGHT PANE: Content -->
        <main class="settings-w11-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsShellComponent {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  readonly searchQuery = signal("");
  readonly profileMenuOpen = signal(false);

  readonly currentUser = this.api.user;

  readonly userName = computed(() => this.currentUser()?.name || "User");
  readonly userRole = computed(() => {
    const roleMap: Record<string, string> = {
      admin: "Admin",
      project_manager: "Project Manager",
      accountant: "Accountant",
      supervisor: "Supervisor",
    };
    const role = this.currentUser()?.role || "admin";
    return roleMap[role] || role;
  });

  readonly userEmail = computed(() => {
    const raw = localStorage.getItem("ajui_user");
    if (!raw) return "";
    try {
      return JSON.parse(raw)?.email || "";
    } catch {
      return "";
    }
  });

  readonly avatarColor = computed(() => {
    const colors = [
      "linear-gradient(135deg, #002263, #1a4499)",
      "linear-gradient(135deg, #1a5c2e, #2d8a4e)",
      "linear-gradient(135deg, #7a3d00, #b86310)",
      "linear-gradient(135deg, #5c1a5c, #8a2d8a)",
      "linear-gradient(135deg, #1a3d5c, #2d608a)",
      "linear-gradient(135deg, #5c1a1a, #8a2d2d)",
    ];
    const name = this.userName() || "A";
    return colors[name.charCodeAt(0) % colors.length];
  });

  readonly userInitials = computed(() => {
    const name = this.userName();
    return name.split(/\s+/).slice(0, 2).map((p: string) => p[0] || "").join("").toUpperCase() || "U";
  });

  // Icon path library (24x24 viewBox, currentColor stroke)
  private readonly icons = {
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 20a8 8 0 0 1 16 0",
    bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M9 20a3 3 0 0 0 6 0",
    palette: "M12 22a10 10 0 1 1 10-10c0 2-1 3-3 3h-2a2 2 0 0 0-2 2v1c0 1-1 2-3 2Z M7 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M12 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M17 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z M9 12l2 2 4-4",
    pin: "M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    check: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2",
    lock: "M5 11h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z M7 11V7a5 5 0 0 1 10 0v4",
    doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z M14 2v6h6 M9 13h6 M9 17h6",
  };

  readonly groups = signal<SettingsGroup[]>([
    {
      label: "Personal",
      items: [
        { id: "account", label: "Account", subtitle: "Profile and password", icon: this.icons.user, route: "/settings/account" },
        { id: "notifications", label: "General Settings", subtitle: "Approvals and notifications", icon: this.icons.bell, route: "/settings/notifications" },
        { id: "appearance", label: "Appearance", subtitle: "Theme and display", icon: this.icons.palette, route: "/settings/appearance" },
      ],
    },
    {
      label: "Management",
      items: [
        { id: "roles", label: "Roles and Employees", subtitle: "Team access and permissions", icon: this.icons.people, route: "/settings/roles" },
        { id: "sites", label: "Sites Directory", subtitle: "All sites and their activity", icon: this.icons.pin, route: "/settings/sites" },
        { id: "access-schedule", label: "Access Schedule", subtitle: "Restrict access windows", icon: this.icons.clock, route: "/settings/access-schedule" },
      ],
    },
    {
      label: "System",
      items: [
        { id: "sessions", label: "Sessions", subtitle: "Active sign-ins", icon: this.icons.lock, route: "/settings/sessions" },
      ],
    },
  ]);

  readonly filteredGroups = computed<SettingsGroup[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const role = this.currentUser()?.role;
    const isAdmin = role === "admin";

    let groups = this.groups();

    // Filter out admin-only sections for non-admins
    if (!isAdmin) {
      groups = groups.map((g) => ({
        ...g,
        items: g.items.filter((item) => {
          // These sections are admin-only
          if (item.id === "roles" || item.id === "access-schedule" || item.id === "sessions") {
            return false;
          }
          return true;
        }),
      })).filter((g) => g.items.length > 0);
    }

    if (!query) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(query))
        ),
      }))
      .filter((g) => g.items.length > 0);
  });

  goBack() {
    this.router.navigateByUrl("/dashboard");
  }

  toggleProfileMenu() {
    this.profileMenuOpen.update((v) => !v);
  }

  logout() {
    this.profileMenuOpen.set(false);
    this.api.logout().subscribe({
      next: () => void this.router.navigate(["/login"]),
      error: () => void this.router.navigate(["/login"]),
    });
  }
}
