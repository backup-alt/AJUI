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
  settingsOutline,
  logOutOutline,
  chevronDownOutline,
  notificationsOutline,
  businessOutline,
  logOutSharp,
  shieldCheckmarkOutline,
  constructOutline,
  locationOutline,
  locationSharp,
  appsOutline,
  gridOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Site, Project } from '../../shared/models';

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
    <ion-menu content-id="main-content" type="overlay">
      <ion-header>
        <ion-toolbar class="agb-toolbar">
          <div class="brand-wrap">
            <div class="brand-logo-wrap">
              <img src="assets/logo.png" alt="AGB" class="brand-logo-img" />
            </div>
            <div class="brand-text">
              <div class="brand-title">Annai Golden Builders</div>
              <div class="brand-sub">Supervisor Portal</div>
            </div>
          </div>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        @if (currentUser()) {
          <div class="user-card">
            <div class="user-avatar-wrap">
              <div class="user-avatar">
                {{ userInitials() }}
              </div>
              <div class="online-indicator"></div>
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

        <ion-list lines="none" class="menu-list">
          <ion-item routerLink="/tabs/dashboard" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/dashboard') ? 'home-sharp' : 'home-outline'" slot="start"></ion-icon>
            <ion-label>Dashboard</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/sites" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/sites') ? 'location-sharp' : 'location-outline'" slot="start"></ion-icon>
            <ion-label>My Sites</ion-label>
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

        <div class="menu-divider"></div>

        <ion-list lines="none" class="menu-list menu-secondary">
          <ion-item routerLink="/tabs/profile" routerLinkActive="selected" button detail="false">
            <ion-icon [name]="isActiveRoute('/tabs/profile') ? 'person-circle' : 'person-circle-outline'" slot="start"></ion-icon>
            <ion-label>Profile</ion-label>
          </ion-item>
          <ion-item button detail="false" class="logout-item" (click)="logout()">
            <ion-icon name="log-out-outline" slot="start"></ion-icon>
            <ion-label>Logout</ion-label>
          </ion-item>
        </ion-list>

        <div class="menu-footer">
          <div class="menu-footer-content">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <span>AGB Supervisor v1.0</span>
          </div>
        </div>
      </ion-content>
    </ion-menu>

    <div class="ion-page" id="main-content">
      <ion-header class="agb-header">
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-menu-button color="primary"></ion-menu-button>
          </ion-buttons>

          <ion-title>
            <button class="site-selector" (click)="toggleSitePopover($event)">
              <ion-icon name="location-outline" slot="start"></ion-icon>
              <span class="site-name">{{ selectedSiteName() || 'Select Site' }}</span>
              <ion-icon name="chevron-down-outline" slot="end"></ion-icon>
            </button>
          </ion-title>

          <ion-buttons slot="end">
            <ion-button class="notification-btn">
              <ion-icon name="notifications-outline"></ion-icon>
              @if (pendingApprovalCount() > 0) {
                <span class="notification-badge"></span>
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
                <ion-label>Select Site</ion-label>
              </ion-list-header>
              @if (isLoadingSites()) {
                <ion-item>
                  <ion-spinner name="crescent"></ion-spinner>
                </ion-item>
              } @else {
                @for (site of sites(); track site.id) {
                  <ion-item button detail (click)="selectSite(site)" [class.selected-site]="site.id === selectedSiteId()">
                    <ion-icon name="location-outline" slot="start" color="primary"></ion-icon>
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
    /* Toolbar with gradient */
    .agb-toolbar {
      --background: linear-gradient(135deg, #002263 0%, #003380 100%);
      --color: #ffffff;
      --border-color: transparent;
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 4px;
    }
    .brand-logo-wrap {
      width: 44px;
      height: 44px;
      background: rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .brand-logo-img {
      width: 36px;
      height: 36px;
      object-fit: contain;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
    }
    .brand-title {
      font-weight: 700;
      font-size: 14px;
      color: #ffffff;
      line-height: 1.2;
    }
    .brand-sub {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.7);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }

    /* User Card */
    .user-card {
      margin: 16px;
      padding: 16px;
      background: linear-gradient(135deg, #002263 0%, #003380 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .user-avatar-wrap {
      position: relative;
    }
    .user-avatar {
      width: 48px;
      height: 48px;
      background: #c9a227;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 16px;
    }
    .online-indicator {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      background: #22c55e;
      border: 2px solid #002263;
    }
    .user-name {
      font-weight: 700;
      font-size: 15px;
      color: #ffffff;
      line-height: 1.3;
    }
    .user-role {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.75);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .user-project {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
    }
    .user-project ion-icon {
      font-size: 12px;
    }

    /* Menu List */
    .menu-list {
      padding: 0;
      background: transparent;
    }
    .menu-list ion-item {
      --background: transparent;
      --color: #111827;
      --border-radius: 0 !important;
      --inner-border-radius: 0 !important;
      --padding-start: 20px;
      --padding-end: 20px;
      --min-height: 48px;
      font-size: 14px;
      font-weight: 500;
      border-bottom: 1px solid #f1f3f5;
      margin: 0;
    }
    .menu-list ion-item ion-icon {
      font-size: 20px;
      color: #002263;
      margin-right: 12px;
    }
    .menu-list ion-item.selected {
      --background: #002263;
      --color: #ffffff;
    }
    .menu-list ion-item.selected ion-icon {
      color: #ffffff;
    }
    .menu-divider {
      height: 1px;
      background: #e5e7eb;
      margin: 8px 0;
    }
    .menu-secondary {
      opacity: 1;
    }
    .logout-item {
      --color: #dc3545;
    }
    .logout-item ion-icon {
      color: #dc3545;
    }

    /* Menu Footer */
    .menu-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 16px;
      border-top: 1px solid #e5e7eb;
    }
    .menu-footer-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .menu-footer-content ion-icon {
      font-size: 12px;
    }

    /* Main Header */
    .agb-header {
      --background: #ffffff;
      --border-color: #e5e7eb;
    }
    .site-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f5f6f8;
      border: 1px solid #d1d5db;
      padding: 8px 12px;
      cursor: pointer;
      max-width: 220px;
    }
    .site-selector:hover {
      background: #e5e7eb;
    }
    .site-selector ion-icon {
      color: #002263;
      font-size: 16px;
    }
    .site-name {
      font-weight: 600;
      font-size: 13px;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 150px;
    }
    .notification-btn {
      position: relative;
    }
    .notification-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 8px;
      height: 8px;
      background: #dc3545;
    }

    /* Popover */
    .popover-header {
      font-size: 10px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .selected-site {
      --background: #f5f6f8;
    }
    .empty-sites {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px;
      color: #9ca3af;
    }
    .empty-sites ion-icon {
      font-size: 36px;
      margin-bottom: 8px;
      opacity: 0.6;
    }
    .empty-sites p {
      font-size: 13px;
      margin: 0;
    }
  `],
})
export class ShellComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private supervisor = inject(SupervisorService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private platform = inject(Platform);

  currentUser = signal<{ name: string; email: string } | null>(null);
  sites = signal<Site[]>([]);
  selectedSiteId = signal<string | null>(null);
  selectedSiteName = signal<string | null>(null);
  isSitePopoverOpen = signal(false);
  isLoadingSites = signal(false);
  pendingApprovalCount = signal(0);
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
      settingsOutline,
      logOutOutline,
      logOutSharp,
      chevronDownOutline,
      notificationsOutline,
      businessOutline,
      constructOutline,
      shieldCheckmarkOutline,
      locationOutline,
      locationSharp,
      appsOutline,
      gridOutline,
    });

    this.currentUser.set(this.auth.currentUser());
    await this.supervisor.init();
    await this.loadSites();
    await this.refreshPendingCount();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:approvals-changed', this.handleApprovalsChanged);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:approvals-changed', this.handleApprovalsChanged);
    }
  }

  private handleApprovalsChanged = (): void => {
    void this.refreshPendingCount();
  };

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
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    const toast = await this.toastCtrl.create({
      message: 'Logged out successfully',
      duration: 2000,
      position: 'top',
      color: 'success',
    });
    await toast.present();
  }
}
