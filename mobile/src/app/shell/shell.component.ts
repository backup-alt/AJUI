import { Component, computed } from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonNote,
  IonList,
  IonButton,
  IonButtons,
  IonMenuButton,
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
  checkmarkDoneCircleOutline,
  checkmarkDoneCircleSharp,
  personCircleOutline,
  folderOutline,
  cardOutline,
  briefcaseOutline,
  logOutOutline,
  notificationsOutline,
  settingsOutline,
} from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
import { MockDataService } from '../core/services/mock-data.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonNote,
    IonList,
    IonButton,
    IonButtons,
    IonMenuButton,
    RouterLink,
    RouterLinkActive,
  ],
  template: `
    <ion-menu contentId="main-content" type="overlay">
      <ion-header>
        <ion-toolbar class="agb-header">
          <ion-title>
            <div class="brand-wrap">
              <div class="brand-mark">AGB</div>
              <div>
                <div class="brand-title">Annai Golden Builders</div>
                <div class="brand-sub">Supervisor Console</div>
              </div>
            </div>
          </ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <div class="user-card">
          <div class="user-avatar">{{ userInitials() }}</div>
          <div class="user-info">
            <div class="user-name">{{ user()?.name || 'Supervisor' }}</div>
            <div class="user-role">Site Supervisor</div>
            <div class="user-meta">{{ projectCount() }} projects assigned</div>
          </div>
        </div>

        <ion-list lines="none" class="menu-list">
          <ion-item routerLink="/tabs/home" routerLinkActive="selected" button detail="false">
            <ion-icon name="home-outline" slot="start"></ion-icon>
            <ion-label>Home</ion-label>
          </ion-item>
          <ion-item routerLink="/projects" routerLinkActive="selected" button detail="false">
            <ion-icon name="folder-outline" slot="start"></ion-icon>
            <ion-label>My Projects</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/materials" routerLinkActive="selected" button detail="false">
            <ion-icon name="cube-outline" slot="start"></ion-icon>
            <ion-label>Material Requests</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/labour" routerLinkActive="selected" button detail="false">
            <ion-icon name="people-outline" slot="start"></ion-icon>
            <ion-label>Labour Attendance</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/expense" routerLinkActive="selected" button detail="false">
            <ion-icon name="wallet-outline" slot="start"></ion-icon>
            <ion-label>Site Expenses</ion-label>
          </ion-item>
          <ion-item routerLink="/payments" routerLinkActive="selected" button detail="false">
            <ion-icon name="card-outline" slot="start"></ion-icon>
            <ion-label>Payments</ion-label>
          </ion-item>
          <ion-item routerLink="/subcontracts" routerLinkActive="selected" button detail="false">
            <ion-icon name="briefcase-outline" slot="start"></ion-icon>
            <ion-label>Subcontracts</ion-label>
          </ion-item>
          <ion-item routerLink="/tabs/approvals" routerLinkActive="selected" button detail="false">
            <ion-icon name="checkmark-done-circle-outline" slot="start"></ion-icon>
            <ion-label>Approvals</ion-label>
          </ion-item>
        </ion-list>

        <ion-list lines="none" class="menu-list menu-secondary">
          <ion-item routerLink="/profile" routerLinkActive="selected" button detail="false">
            <ion-icon name="person-circle-outline" slot="start"></ion-icon>
            <ion-label>Profile</ion-label>
          </ion-item>
          <ion-item button detail="false">
            <ion-icon name="notifications-outline" slot="start"></ion-icon>
            <ion-label>Notifications</ion-label>
            <ion-note slot="end" class="badge">3</ion-note>
          </ion-item>
          <ion-item button detail="false">
            <ion-icon name="settings-outline" slot="start"></ion-icon>
            <ion-label>Settings</ion-label>
          </ion-item>
          <ion-item button detail="false" class="logout-item" (click)="logout()">
            <ion-icon name="log-out-outline" slot="start"></ion-icon>
            <ion-label>Logout</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-menu>

    <div class="ion-page" id="main-content">
      <ion-tabs>
        <ion-router-outlet></ion-router-outlet>

        <ion-tab-bar slot="bottom">
          <ion-tab-button tab="home" (click)="goToTab('home', $event)">
            <ion-icon [name]="homeIcon"></ion-icon>
            <ion-label>Home</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="materials" (click)="goToTab('materials', $event)">
            <ion-icon [name]="materialsIcon"></ion-icon>
            <ion-label>Material</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="labour" (click)="goToTab('labour', $event)">
            <ion-icon [name]="labourIcon"></ion-icon>
            <ion-label>Labour</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="expense" (click)="goToTab('expense', $event)">
            <ion-icon [name]="expenseIcon"></ion-icon>
            <ion-label>Expense</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="approvals" (click)="goToTab('approvals', $event)">
            <ion-icon [name]="approvalsIcon"></ion-icon>
            <ion-label>Approvals</ion-label>
          </ion-tab-button>
        </ion-tab-bar>
      </ion-tabs>
    </div>
  `,
  styles: [`
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
    }
    .brand-mark {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--agb-gradient-gold);
      color: #2a230a;
      font-weight: 800;
      font-size: 14px;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    }
    .brand-title {
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.3px;
    }
    .brand-sub {
      font-size: 11px;
      opacity: 0.8;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .user-card {
      margin: 14px;
      padding: 16px;
      border-radius: var(--agb-radius);
      background: var(--agb-gradient-primary-soft);
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: var(--agb-shadow);
    }
    .user-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--agb-gradient-gold);
      color: #2a230a;
      font-weight: 800;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .user-name {
      font-weight: 700;
      font-size: 15px;
    }
    .user-role {
      font-size: 12px;
      opacity: 0.9;
    }
    .user-meta {
      font-size: 11px;
      opacity: 0.8;
      margin-top: 2px;
    }
    .menu-list {
      padding: 4px 8px;
    }
    .menu-list ion-item {
      --border-radius: 12px;
      margin: 3px 4px;
      font-size: 14px;
    }
    .menu-list ion-item ion-icon {
      color: var(--agb-primary);
      font-size: 20px;
    }
    .menu-secondary {
      margin-top: 14px;
      border-top: 1px solid var(--agb-border);
      padding-top: 10px;
    }
    .badge {
      background: var(--agb-danger);
      color: #ffffff;
      border-radius: 10px;
      padding: 2px 8px;
      font-weight: 700;
      font-size: 11px;
    }
    .logout-item {
      --color: var(--agb-danger);
    }
    .logout-item ion-icon {
      color: var(--agb-danger);
    }
  `],
})
export class ShellComponent {
  homeIcon: string = 'home-sharp';
  materialsIcon: string = 'cube-outline';
  labourIcon: string = 'people-outline';
  expenseIcon: string = 'wallet-outline';
  approvalsIcon: string = 'checkmark-done-circle-outline';

  user = this.auth.currentUser;
  projectCount = computed(() => this.user()?.assignedProjectIds.length ?? 0);
  userInitials = computed(() => {
    const name = this.user()?.name || 'Supervisor';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  constructor(
    private auth: AuthService,
    private mock: MockDataService,
    private router: Router,
    private toastCtrl: ToastController,
  ) {
    addIcons({
      'home-outline': homeOutline,
      'home-sharp': homeSharp,
      'cube-outline': cubeOutline,
      'cube-sharp': cubeSharp,
      'people-outline': peopleOutline,
      'people-sharp': peopleSharp,
      'wallet-outline': walletOutline,
      'wallet-sharp': walletSharp,
      'checkmark-done-circle-outline': checkmarkDoneCircleOutline,
      'checkmark-done-circle-sharp': checkmarkDoneCircleSharp,
      'person-circle-outline': personCircleOutline,
      'folder-outline': folderOutline,
      'card-outline': cardOutline,
      'briefcase-outline': briefcaseOutline,
      'log-out-outline': logOutOutline,
      'notifications-outline': notificationsOutline,
      'settings-outline': settingsOutline,
    });
  }

  /**
   * Programmatic tab selection that ALWAYS navigates.
   * Using `<ion-tab-button href="...">` is broken when the same tab is
   * clicked twice in a row; Angular's router treats it as a no-op.
   * We force a navigateByUrl on every click instead.
   */
  goToTab(tab: 'home' | 'materials' | 'labour' | 'expense' | 'approvals', event: Event) {
    event.preventDefault();
    const target = `/tabs/${tab}`;
    this.router.navigateByUrl(target);
  }

  onTabChange(event: any) {
    // no-op; reserved for analytics later
  }

  async logout() {
    this.auth.logout();
    const toast = await this.toastCtrl.create({
      message: 'Signed out successfully',
      duration: 1500,
      position: 'top',
      cssClass: 'agb-toast',
    });
    await toast.present();
    this.router.navigate(['/login']);
  }
}