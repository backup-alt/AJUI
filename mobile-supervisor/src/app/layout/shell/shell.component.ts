import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ViewEncapsulation,
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
  IonPopover,
  IonListHeader,
  IonSpinner,
  IonRouterOutlet,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  ToastController,
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
  clipboardOutline,
  clipboardSharp,
  grid,
  barChartOutline,
  barChartSharp,
  fileTrayOutline,
  fileTraySharp,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { SupervisorService } from '../../core/services/supervisor.service';
import { NotificationService } from '../../core/services/notification.service';
import { Site } from '../../shared/models';

@Component({
  selector: 'app-shell',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  host: { '[class.agb-shell-active]': 'true' },
  imports: [
    IonContent,
    IonMenu,
    IonMenuButton,
    IonButtons,
    IonIcon,
    IonLabel,
    IonList,
    IonItem,
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
            <img
              src="assets/logo.svg"
              alt="Annai Golden Builders"
              class="menu-brand-logo-img"
            />
         </div>
          <div class="menu-brand-text">
            <div class="menu-brand-name">Annai Golden Builders</div>
            <div class="menu-brand-sub">Supervisor Portal</div>
         </div>
       </div>
      </ion-header>

      <ion-content class="menu-content">
        <div class="menu-section-label">Main Menu</div>
        <ion-list lines="none" class="menu-list">
          <ion-item routerLink="/tabs/dashboard" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/dashboard') ? 'home-sharp' : 'home-outline'" slot="start"></ion-icon>
            <ion-label>Dashboard</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/sites" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/sites') ? 'location-sharp' : 'location-outline'" slot="start"></ion-icon>
            <ion-label>My Sites</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/inventory" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/inventory') ? 'grid-sharp' : 'grid-outline'" slot="start"></ion-icon>
            <ion-label>Inventory</ion-label>
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
          <ion-item routerLink="/tabs/requests" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/requests') ? 'clipboard-sharp' : 'clipboard-outline'" slot="start"></ion-icon>
            <ion-label>Requests</ion-label>
          </ion-item>
        </ion-list>

        <div class="menu-section-label">Account</div>
        <ion-list lines="none" class="menu-list">
          <ion-item routerLink="/tabs/profile" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/profile') ? 'person-circle-sharp' : 'person-circle-outline'" slot="start"></ion-icon>
            <ion-label>Profile</ion-label>
          </ion-item>
        </ion-list>

        <div class="menu-spacer"></div>

        <div class="menu-footer">
          <ion-item button detail="false" class="logout-item" (click)="logout()">
            <ion-icon [name]="isLoggingOut() ? 'log-out-sharp' : 'log-out-outline'" slot="start"></ion-icon>
            <ion-label>Sign Out</ion-label>
          </ion-item>
          <div class="menu-footer-meta">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <span>AGB Supervisor v1.0</span>
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
            <button class="site-selector" id="site-selector-btn">
              <span class="site-icon"><ion-icon name="location-outline"></ion-icon></span>
              <span class="site-name">{{ selectedSiteName() || 'Select site' }}</span>
              <span class="site-chev"><ion-icon name="chevron-down-outline"></ion-icon></span>
            </button>
          </ion-title>

          <ion-buttons slot="end">
            <ion-button class="notification-btn" (click)="openNotifications()">
              <ion-icon name="notifications-outline"></ion-icon>
              @if (unreadCount() > 0) {
                <span class="notification-badge">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
              }
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <ion-router-outlet />

      <ion-popover #sitePopover trigger="site-selector-btn" trigger-action="click" side="bottom" alignment="center" size="auto" (didDismiss)="closeSitePopover()" (ionPopoverWillPresent)="onSitePopoverOpen()">
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
    :host { display: block; }

    /* Menu header */
    .agb-menu-header {
      background: var(--agb-gradient-hero);
      background-image: linear-gradient(135deg, #002263 0%, #003380 100%);
      color: #ffffff;
      padding: calc(16px + env(safe-area-inset-top)) 16px 16px;
    }
    .menu-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .menu-brand-logo {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    }
    .menu-brand-logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .menu-brand-text { line-height: 1.3; }
    .menu-brand-name {
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.1px;
    }
    .menu-brand-sub {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.65);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 2px;
    }

    .menu-content {
      --background: var(--m3-surface-bright);
      --padding-top: 0;
      --padding-bottom: calc(8px + env(safe-area-inset-bottom));
    }

    /* Section labels */
    .menu-section-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 1.2px;
      padding: var(--md-space-3) var(--md-space-5) var(--md-space-2);
    }
    .menu-section-label:first-of-type {
      padding-top: var(--md-space-3);
    }

    .menu-list { background: transparent; padding: 0 var(--md-space-2); }
    .menu-list ion-item {
      --background: transparent;
      --color: var(--m3-on-surface);
      --border-radius: var(--md-radius-lg);
      --inner-border-radius: var(--md-radius-lg);
      --padding-start: var(--md-space-3);
      --padding-end: var(--md-space-3);
      --min-height: 44px;
      font-size: 14px;
      font-weight: 600;
      margin: 1px 0;
      border-bottom: none;
      transition: background var(--md-motion-duration-short1) var(--md-motion-easing-standard);
    }
    .menu-list ion-item ion-icon {
      font-size: 20px;
      color: var(--m3-on-surface-variant);
      margin-right: var(--md-space-3);
    }
    .menu-list ion-item.selected {
      --background: var(--m3-primary-container);
      --color: var(--m3-on-primary-container);
      box-shadow: none;
    }
    .menu-list ion-item.selected ion-icon { color: var(--m3-on-primary-container); }

    .menu-spacer { flex: 1; min-height: var(--md-space-2); max-height: var(--md-space-4); }

    .menu-footer {
      padding: var(--md-space-3) var(--md-space-3) calc(16px + env(safe-area-inset-bottom));
    }
    .menu-footer ion-item {
      --background: transparent;
      --color: var(--m3-error);
      --border-radius: var(--md-radius-lg);
      --inner-border-radius: var(--md-radius-lg);
      --padding-start: var(--md-space-4);
      --padding-end: var(--md-space-4);
      --min-height: 48px;
      font-weight: 600;
      margin: 0;
    }
    .menu-footer ion-item ion-icon { color: var(--m3-error); font-size: 20px; }
    .menu-footer-meta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--md-space-2);
      font-size: 10px;
      color: var(--m3-on-surface-muted);
      margin-top: var(--md-space-4);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .menu-footer-meta ion-icon { font-size: 12px; }

    /* Top header */
    .agb-app-header {
      --background: var(--m3-surface-bright);
      --border-color: transparent;
    }
    .site-selector {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      background: var(--m3-surface-container);
      border: 1px solid var(--m3-outline-variant);
      padding: var(--md-space-1) var(--md-space-3) var(--md-space-1) var(--md-space-1);
      border-radius: var(--md-radius-pill);
      cursor: pointer;
      max-width: min(52vw, 240px);
      min-width: 0;
      margin: 0 auto;
      transition:
        background var(--md-motion-duration-short1) var(--md-motion-easing-standard),
        border-color var(--md-motion-duration-short1) var(--md-motion-easing-standard);
      font-family: inherit;
    }
    .site-selector:hover {
      background: var(--m3-surface-container-high);
      border-color: var(--m3-outline);
    }
    .site-selector:active { transform: scale(0.985); }
    .site-icon {
      width: 30px;
      height: 30px;
      border-radius: var(--md-radius-pill);
      background: var(--m3-primary-container);
      color: var(--m3-on-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .site-icon ion-icon { font-size: 16px; }
    .site-name {
      font-weight: 700;
      font-size: 13px;
      color: var(--m3-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .site-chev { flex-shrink: 0; }
    .site-chev ion-icon { color: var(--m3-on-surface-muted); font-size: 16px; }

    .notification-btn { position: relative; --padding-end: var(--md-space-2); }
    .notification-btn ion-icon { font-size: 22px; color: var(--m3-on-surface-variant); }
    .notification-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      background: var(--m3-error);
      color: var(--m3-on-error);
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--md-radius-pill);
      border: 1.5px solid var(--m3-surface-bright);
    }

    /* Site-switch popover */
    .popover-header {
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      --background: transparent;
    }
    ion-popover ion-content {
      max-height: min(72vh, 520px);
      --padding-bottom: env(safe-area-inset-bottom);
    }
    .site-tile-icon {
      width: 38px;
      height: 38px;
      border-radius: var(--md-radius-md);
      background: var(--m3-primary-container);
      color: var(--m3-on-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .site-tile-icon ion-icon { font-size: 18px; }
    .empty-sites {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--md-space-8) var(--md-space-4);
      color: var(--m3-on-surface-muted);
      text-align: center;
    }
    .empty-sites ion-icon {
      font-size: 40px;
      margin-bottom: var(--md-space-3);
      opacity: 0.5;
    }
    .empty-sites p {
      font-size: 14px;
      font-weight: 600;
      color: var(--m3-on-surface-variant);
      margin: 0 0 var(--md-space-1);
    }
    .empty-sites span {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
    }

    /* Shell header overlap fix */
    app-shell.agb-shell-active ion-content {
      --padding-top: calc(var(--agb-header-height) + env(safe-area-inset-top));
      --padding-bottom: calc(24px + env(safe-area-inset-bottom));
    }
    app-shell.agb-shell-active ion-content.auth-content,
    app-shell.agb-shell-active ion-content.full-bleed {
      --padding-top: 0;
    }
    app-shell.agb-shell-active ion-content > .dashboard-container,
    app-shell.agb-shell-active ion-content > .content-stack,
    app-shell.agb-shell-active ion-content > .cards,
    app-shell.agb-shell-active ion-content > .form-container,
    app-shell.agb-shell-active ion-content > .filter-stack,
    app-shell.agb-shell-active ion-content > .ledger-card,
    app-shell.agb-shell-active ion-content > .labour-list,
    app-shell.agb-shell-active ion-content > .sites-list,
    app-shell.agb-shell-active ion-content > .materials-list,
    app-shell.agb-shell-active ion-content > .expense-list,
    app-shell.agb-shell-active ion-content > .requests-list,
    app-shell.agb-shell-active ion-content > .inventory-list {
      margin-top: var(--agb-shell-gutter);
    }
  `],
})
export class ShellComponent implements OnInit {
  private auth = inject(AuthService);
  private supervisor = inject(SupervisorService);
  private notifications = inject(NotificationService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  currentUser = signal<{ name: string; email: string } | null>(null);
  sites = signal<Site[]>([]);
  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  isSitePopoverOpen = signal(false);
  isLoadingSites = signal(false);
  isLoggingOut = signal(false);
  siteCount = computed(() => this.sites().length);
  unreadCount = computed(() => this.notifications.unreadCount());

  isActiveRoute(path: string): boolean {
    return this.router.url === path;
  }

  async ngOnInit(): Promise<void> {
    addIcons({
      homeOutline, homeSharp, cubeOutline, cubeSharp, peopleOutline, peopleSharp,
      walletOutline, walletSharp,
      personCircleOutline, personCircleSharp, settingsOutline, logOutOutline,
      chevronDownOutline, notificationsOutline, notificationsSharp, businessOutline,
      constructOutline, shieldCheckmarkOutline, locationOutline, locationSharp,
      appsOutline, gridOutline, checkmarkOutline, logOutSharp,
      clipboardOutline, clipboardSharp,
      grid, barChartOutline, barChartSharp, fileTrayOutline, fileTraySharp,
    });

    this.currentUser.set(this.auth.currentUser());
    await this.supervisor.init();
    await this.loadSites();
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

      if (savedSiteId) {
        const saved = response.sites.find((site) => site.id === savedSiteId);
        this.selectedSiteId.set(savedSiteId);
        this.selectedSiteName.set(savedSiteName || saved?.name || null);
        if (saved && !savedSiteName) {
          await this.supervisor.setSelectedSite(
            saved.id,
            saved.projectId || '',
            saved.projectName || saved.name,
            saved.name
          );
        }
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
    if (!this.isSitePopoverOpen() && this.sites().length === 0 && !this.isLoadingSites()) {
      void this.loadSites();
    }
    this.isSitePopoverOpen.set(!this.isSitePopoverOpen());
  }

  closeSitePopover(): void {
    this.isSitePopoverOpen.set(false);
  }

  onSitePopoverOpen(): void {
    if (this.sites().length === 0 && !this.isLoadingSites()) {
      void this.loadSites();
    }
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

  async openNotifications(): Promise<void> {
    await this.router.navigate(['/tabs/requests']);
  }
}
