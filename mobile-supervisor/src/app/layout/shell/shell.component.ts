import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import {
  IonContent,
  IonMenu,
  IonMenuButton,
  IonButtons,
  IonIcon,
  IonLabel,
  IonList,
  IonItem,
  IonBadge,
  IonPopover,
  IonListHeader,
  IonSpinner,
  IonRouterOutlet,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  ToastController,
  Platform,
} from '@ionic/angular/standalone';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  homeSharp,
  cubeOutline,
  cubeSharp,
  peopleOutline,
  peopleSharp,
  walletOutline,
  walletSharp,
  checkmarkDoneCircleOutline,
  checkmarkDoneCircleSharp,
  personCircleOutline,
  personCircleSharp,
  settingsOutline,
  logOutOutline,
  chevronDownOutline,
  notificationsOutline,
  notificationsSharp,
  businessOutline,
  logOutSharp,
  shieldCheckmarkOutline,
  constructOutline,
  locationOutline,
  locationSharp,
  appsOutline,
  gridOutline,
  checkmarkOutline,
  sunnyOutline,
  moonOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Site } from '../../shared/models';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    IonContent,
    IonMenu,
    IonMenuButton,
    IonButtons,
    IonIcon,
    IonLabel,
    IonList,
    IonItem,
    IonBadge,
    IonPopover,
    IonListHeader,
    IonSpinner,
    IonRouterOutlet,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    RouterLink,
    RouterLinkActive,
  ],
  template: `
    <ion-menu content-id="main-content" type="overlay" class="agb-menu">
      <ion-header class="agb-menu-header">
        <div class="menu-brand">
          <div class="menu-brand-logo">
            <img src="assets/logo.png" alt="AGB" />
          </div>
          <div class="menu-brand-text">
            <div class="menu-brand-name">Annai Golden Builders</div>
            <div class="menu-brand-sub">Supervisor Portal</div>
          </div>
        </div>
      </ion-header>

      <ion-content class="menu-content">
        @if (currentUser()) {
          <div class="user-card">
            <div class="user-avatar-wrap">
              <div class="user-avatar">{{ userInitials() }}</div>
              <span class="online-indicator"></span>
            </div>
            <div class="user-info">
              <div class="user-name">{{ currentUser()?.name }}</div>
              <div class="user-role">Site Supervisor</div>
              @if (selectedSiteName()) {
                <div class="user-project">
                  <ion-icon name="location-outline"></ion-icon>
                  <span>{{ selectedSiteName() }}</span>
                </div>
              }
            </div>
          </div>
        }

        <div class="menu-section-label">Workspace</div>
        <ion-list lines="none" class="menu-list">
          <ion-item routerLink="/tabs/dashboard" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/dashboard') ? 'home-sharp' : 'home-outline'" slot="start"></ion-icon>
            <ion-label>Dashboard</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/sites" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/sites') ? 'location-sharp' : 'location-outline'" slot="start"></ion-icon>
            <ion-label>My sites</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/materials" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/materials') ? 'cube-sharp' : 'cube-outline'" slot="start"></ion-icon>
            <ion-label>Materials</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/labour" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/labour') ? 'people-sharp' : 'people-outline'" slot="start"></ion-icon>
            <ion-label>Labour</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/expenses" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/expenses') ? 'wallet-sharp' : 'wallet-outline'" slot="start"></ion-icon>
            <ion-label>Expenses</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/approvals" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/approvals') ? 'checkmark-done-circle-sharp' : 'checkmark-done-circle-outline'" slot="start"></ion-icon>
            <ion-label>Approvals</ion-label>
            @if (pendingApprovalCount() > 0) {
              <ion-badge slot="end" color="warning">{{ pendingApprovalCount() }}</ion-badge>
            }
          </ion-item>
        </ion-list>

        <div class="menu-section-label">Account</div>
        <ion-list lines="none" class="menu-list">
          <ion-item routerLink="/tabs/profile" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/profile') ? 'person-circle-sharp' : 'person-circle-outline'" slot="start"></ion-icon>
            <ion-label>Profile</ion-label>
          </ion-item>
          <ion-item button detail="false" class="theme-toggle" (click)="toggleTheme()">
            <ion-icon [name]="isDark() ? 'sunny-outline' : 'moon-outline'" slot="start"></ion-icon>
            <ion-label>{{ isDark() ? 'Light mode' : 'Dark mode' }}</ion-label>
          </ion-item>
        </ion-list>

        <div class="menu-spacer"></div>

        <div class="menu-footer">
          <ion-item button detail="false" class="logout-item" (click)="logout()">
            <ion-icon [name]="isLoggingOut() ? 'log-out-sharp' : 'log-out-outline'" slot="start"></ion-icon>
            <ion-label>Sign out</ion-label>
          </ion-item>
          <div class="menu-footer-meta">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <span>AGB Supervisor - v1.0</span>
          </div>
        </div>
      </ion-content>
    </ion-menu>

    <div class="ion-page" id="main-content">
      <ion-header class="agb-app-header">
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-menu-button color="primary"></ion-menu-button>
          </ion-buttons>

          <ion-title>
            <button class="site-selector" (click)="toggleSitePopover($event)">
              <span class="site-icon"><ion-icon name="location-outline"></ion-icon></span>
              <span class="site-name">{{ selectedSiteName() || 'Select site' }}</span>
              <span class="site-chev"><ion-icon name="chevron-down-outline"></ion-icon></span>
            </button>
          </ion-title>

          <ion-buttons slot="end">
            <ion-button class="notification-btn">
              <ion-icon name="notifications-outline"></ion-icon>
              @if (pendingApprovalCount() > 0) {
                <span class="notification-badge">{{ pendingApprovalCount() }}</span>
              }
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <ion-router-outlet />

      <ion-popover #sitePopover [isOpen]="isSitePopoverOpen()" (didDismiss)="closeSitePopover()">
        <ng-template>
          <ion-content>
            <ion-list lines="none">
              <ion-list-header class="popover-header">
                <ion-label>Switch site</ion-label>
              </ion-list-header>
              @if (isLoadingSites()) {
                <ion-item>
                  <ion-spinner name="crescent" slot="start"></ion-spinner>
                  <ion-label>Loading sites...</ion-label>
                </ion-item>
              } @else {
                @for (site of sites(); track site.id) {
                  <ion-item
                    button
                    detail
                    (click)="selectSite(site)"
                    [class.selected-site]="site.id === selectedSiteId()"
                  >
                    <span class="site-tile-icon" slot="start">
                      <ion-icon name="location-outline"></ion-icon>
                    </span>
                    <ion-label>
                      <h3>{{ site.name }}</h3>
                      <p>Site ID: {{ site.siteId }}</p>
                    </ion-label>
                    @if (site.id === selectedSiteId()) {
                      <ion-icon name="checkmark-circle" slot="end" color="success"></ion-icon>
                    }
                  </ion-item>
                }
                @if (sites().length === 0) {
                  <div class="empty-sites">
                    <ion-icon name="location-outline"></ion-icon>
                    <p>No sites assigned</p>
                    <span>Contact your admin to be assigned</span>
                  </div>
                }
              }
            </ion-list>
          </ion-content>
        </ng-template>
      </ion-popover>
    </div>
  `,
  styles: [`
    /* Menu header */
    .agb-menu-header {
      background: var(--agb-gradient-hero);
      color: #ffffff;
      padding: 20px 18px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.10);
    }
    .menu-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .menu-brand-logo {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .menu-brand-logo img { width: 28px; height: 28px; object-fit: contain; }
    .menu-brand-text { line-height: 1.2; }
    .menu-brand-name { font-size: 14px; font-weight: 700; }
    .menu-brand-sub { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 2px; }

    .menu-content { --background: #f8fafc; --padding-top: 0; }

    /* User card */
    .user-card {
      margin: 16px;
      padding: 16px;
      background: #002263;
      color: #ffffff;
      border-radius: 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 12px 28px -14px rgba(0, 34, 99, 0.50);
    }
    .user-avatar-wrap { position: relative; }
    .user-avatar {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #c9a227 0%, #d4b45a 100%);
      color: #1f2937;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 16px;
    }
    .online-indicator {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 12px;
      height: 12px;
      background: #22c55e;
      border: 2px solid #002263;
      border-radius: 50%;
    }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-weight: 700; font-size: 15px; line-height: 1.2; }
    .user-role { font-size: 11px; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .user-project {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 6px;
      font-size: 11px;
      opacity: 0.85;
    }
    .user-project ion-icon { font-size: 12px; color: #c9a227; }

    /* Section labels */
    .menu-section-label {
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 12px 22px 6px;
    }

    .menu-list { background: transparent; padding: 0 12px; }
    .menu-list ion-item {
      --background: transparent;
      --color: #0f172a;
      --border-radius: 12px;
      --inner-border-radius: 12px;
      --padding-start: 14px;
      --padding-end: 14px;
      --min-height: 48px;
      font-size: 14px;
      font-weight: 600;
      margin: 2px 0;
      border-bottom: none;
    }
    .menu-list ion-item ion-icon { font-size: 20px; color: #475569; margin-right: 12px; }
    .menu-list ion-item.selected {
      --background: var(--agb-gradient-primary);
      --color: #ffffff;
      box-shadow: 0 6px 16px -8px rgba(0, 34, 99, 0.50);
    }
    .menu-list ion-item.selected ion-icon { color: #ffffff; }

    .menu-spacer { flex: 1; min-height: 24px; }

    .menu-footer { padding: 12px 12px 24px; }
    .menu-footer ion-item {
      --background: transparent;
      --color: #dc2626;
      --border-radius: 12px;
      --inner-border-radius: 12px;
      --padding-start: 14px;
      --padding-end: 14px;
      --min-height: 48px;
      font-weight: 600;
      margin: 0;
    }
    .menu-footer ion-item ion-icon { color: #dc2626; font-size: 20px; }
    .menu-footer-meta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 10px;
      color: #94a3b8;
      margin-top: 14px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .menu-footer-meta ion-icon { font-size: 12px; }

    /* Top header */
    .agb-app-header {
      --background: #ffffff;
      --border-color: transparent;
    }
    .site-selector {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 6px 10px 6px 6px;
      border-radius: 14px;
      cursor: pointer;
      max-width: 240px;
      transition: background var(--agb-transition-fast), border-color var(--agb-transition-fast);
      font-family: inherit;
    }
    .site-selector:hover { background: #e2e8f0; }
    .site-selector:active { transform: scale(0.985); }
    .site-icon {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      background: rgba(0, 34, 99, 0.10);
      color: #002263;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .site-icon ion-icon { font-size: 16px; }
    .site-name {
      font-weight: 700;
      font-size: 13px;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 160px;
    }
    .site-chev ion-icon { color: #64748b; font-size: 16px; }

    .notification-btn { position: relative; --padding-end: 8px; }
    .notification-btn ion-icon { font-size: 22px; color: #475569; }
    .notification-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      background: #dc2626;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1.5px solid #ffffff;
    }

    /* Popover */
    .popover-header {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      --background: transparent;
    }
    .site-tile-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: rgba(0, 34, 99, 0.08);
      color: #002263;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .site-tile-icon ion-icon { font-size: 18px; }
    .empty-sites {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px;
      color: #94a3b8;
      text-align: center;
    }
    .empty-sites ion-icon { font-size: 40px; margin-bottom: 8px; opacity: 0.6; }
    .empty-sites p { font-size: 14px; font-weight: 600; color: #475569; margin: 0; }
    .empty-sites span { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  `],
})
export class ShellComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  currentUser = signal<{ name: string; email: string } | null>(null);
  sites = signal<Site[]>([]);
  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  isSitePopoverOpen = signal(false);
  isLoadingSites = signal(false);
  pendingApprovalCount = signal(0);
  isDark = signal<boolean>(document.documentElement.classList.contains('dark'));
  isLoggingOut = signal(false);
  siteCount = computed(() => this.sites().length);

  userInitials = computed(() => {
    const name = this.currentUser()?.name || 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  isActiveRoute(path: string): boolean {
    return this.router.url === path;
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      homeOutline, homeSharp, cubeOutline, cubeSharp, peopleOutline, peopleSharp,
      walletOutline, walletSharp, checkmarkDoneCircleOutline, checkmarkDoneCircleSharp,
      personCircleOutline, personCircleSharp, settingsOutline, logOutOutline,
      chevronDownOutline, notificationsOutline, notificationsSharp, businessOutline,
      constructOutline, shieldCheckmarkOutline, locationOutline, locationSharp,
      appsOutline, gridOutline, checkmarkOutline, sunnyOutline, moonOutline, logOutSharp,
    });

    this.currentUser.set(this.auth.currentUser());
    await this.supervisor.init();
    await this.loadSites();
    await this.refreshPendingCount();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:approvals-changed', this.handleApprovalsChanged);
      window.addEventListener('agb:theme-changed', this.handleThemeChanged);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:approvals-changed', this.handleApprovalsChanged);
      window.removeEventListener('agb:theme-changed', this.handleThemeChanged);
    }
  }

  private handleApprovalsChanged = (): void => {
    void this.refreshPendingCount();
  };

  private handleThemeChanged = (): void => {
    this.isDark.set(document.documentElement.classList.contains('dark'));
  };

  toggleTheme(): void {
    const next = !this.isDark();
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('agb:theme', next ? 'dark' : 'light');
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('agb:theme-changed'));
  }

  private async refreshPendingCount(): Promise<void> {
    this.supervisor.getApprovals().subscribe({
      next: (res) => {
        const pending = (res.approvals || []).filter(
          (a) => !a.status || a.status === 'Pending'
        ).length;
        this.pendingApprovalCount.set(pending);
      },
      error: () => this.pendingApprovalCount.set(0),
    });
  }

  async loadSites(): Promise<void> {
    this.isLoadingSites.set(true);
    try {
      const response = await new Promise<{ sites: Site[] }>((resolve) => {
        this.supervisor.getSites().subscribe({
          next: (data) => resolve(data as { sites: Site[] }),
          error: () => resolve({ sites: [] }),
        });
      });

      this.sites.set(response.sites);

      const savedSiteId = this.supervisor.selectedSiteId();
      const savedSiteName = this.supervisor.selectedSiteName();

      if (savedSiteId && savedSiteName) {
        this.selectedSiteId.set(savedSiteId);
        this.selectedSiteName.set(savedSiteName);
      } else if (response.sites.length > 0) {
        const first = response.sites[0];
        await this.selectSite(first);
      }
    } catch (error) {
      console.error('Failed to load sites:', error);
    } finally {
      this.isLoadingSites.set(false);
    }
  }

  toggleSitePopover(event: Event): void {
    event.preventDefault();
    this.isSitePopoverOpen.set(!this.isSitePopoverOpen());
  }

  closeSitePopover(): void {
    this.isSitePopoverOpen.set(false);
  }

  async selectSite(site: Site): Promise<void> {
    this.selectedSiteId.set(site.id);
    this.selectedSiteName.set(site.name);
    await this.supervisor.setSelectedSite(
      site.id,
      site.projectId || '',
      site.projectName || site.name,
      site.name
    );
    this.closeSitePopover();
    window.dispatchEvent(new CustomEvent('agb:site-changed', { detail: site.id }));
  }

  async logout(): Promise<void> {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);
    try {
      await this.auth.logout();
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}
