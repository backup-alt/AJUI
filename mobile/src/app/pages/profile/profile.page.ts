import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonChip,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personCircleOutline,
  callOutline,
  mailOutline,
  briefcaseOutline,
  locationOutline,
  logOutOutline,
  createOutline,
  checkmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { MockDataService } from '../../core/services/mock-data.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonButtons,
    IonBackButton,
    IonChip,
    IonButton,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar class="agb-header">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Profile</ion-title>
        <ion-buttons slot="end">
          <ion-button *ngIf="!editMode" fill="clear" (click)="toggleEdit()">
            <ion-icon slot="icon-only" name="create-outline"></ion-icon>
          </ion-button>
          <ion-button *ngIf="editMode" fill="clear" (click)="saveEdit()">
            <ion-icon slot="icon-only" name="checkmark-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="profile-hero">
        <div class="avatar">{{ initials }}</div>
        <h2>{{ user()?.name }}</h2>
        <p>{{ user()?.email }}</p>
        <ion-chip class="agb-chip agb-chip-success">{{ user()?.status | titlecase }}</ion-chip>
      </div>

      <div class="container">
        <!-- Account section -->
        <div class="agb-section-title">Account</div>
        <div class="agb-list-card">
          <div class="agb-list-item" *ngIf="!editMode">
            <div class="icon-bubble"><ion-icon name="person-circle-outline"></ion-icon></div>
            <div class="body">
              <p class="title">Full Name</p>
              <p class="subtitle">{{ user()?.name }}</p>
            </div>
          </div>
          <ion-item *ngIf="editMode" class="agb-field">
            <ion-label position="stacked">Full Name</ion-label>
            <ion-input [(ngModel)]="edit.name"></ion-input>
          </ion-item>

          <div class="agb-list-item" *ngIf="!editMode">
            <div class="icon-bubble"><ion-icon name="call-outline"></ion-icon></div>
            <div class="body">
              <p class="title">Phone</p>
              <p class="subtitle">{{ user()?.phone }}</p>
            </div>
          </div>
          <ion-item *ngIf="editMode" class="agb-field">
            <ion-label position="stacked">Phone</ion-label>
            <ion-input [(ngModel)]="edit.phone"></ion-input>
          </ion-item>

          <div class="agb-list-item" *ngIf="!editMode">
            <div class="icon-bubble"><ion-icon name="mail-outline"></ion-icon></div>
            <div class="body">
              <p class="title">Email</p>
              <p class="subtitle">{{ user()?.email }}</p>
            </div>
          </div>
          <ion-item *ngIf="editMode" class="agb-field">
            <ion-label position="stacked">Email</ion-label>
            <ion-input [(ngModel)]="edit.email" type="email"></ion-input>
          </ion-item>

          <div class="agb-list-item">
            <div class="icon-bubble"><ion-icon name="location-outline"></ion-icon></div>
            <div class="body">
              <p class="title">Base Location</p>
              <p class="subtitle">{{ user()?.baseLocation }}</p>
            </div>
          </div>
        </div>

        <!-- Work section -->
        <div class="agb-section-title">Work</div>
        <div class="agb-list-card">
          <div class="agb-list-item">
            <div class="icon-bubble"><ion-icon name="briefcase-outline"></ion-icon></div>
            <div class="body">
              <p class="title">Role</p>
              <p class="subtitle">Site Supervisor</p>
            </div>
          </div>
          <div class="agb-list-item">
            <div class="icon-bubble"><ion-icon name="briefcase-outline"></ion-icon></div>
            <div class="body">
              <p class="title">Assigned Projects</p>
              <p class="subtitle">{{ user()?.assignedProjectIds?.length }} active projects</p>
            </div>
          </div>
          <div class="agb-list-item">
            <div class="icon-bubble"><ion-icon name="checkmark-done-circle-outline"></ion-icon></div>
            <div class="body">
              <p class="title">Member Since</p>
              <p class="subtitle">{{ user()?.createdAt | date:'mediumDate' }}</p>
            </div>
          </div>
        </div>

        <div *ngIf="editMode" style="margin-top: 18px;">
          <ion-button expand="block" class="agb-primary" (click)="saveEdit()">
            <ion-icon name="checkmark-outline" slot="start"></ion-icon>
            Save Changes
          </ion-button>
          <ion-button expand="block" fill="clear" class="agb-text-btn" (click)="cancelEdit()">
            Cancel
          </ion-button>
        </div>

        <div *ngIf="!editMode" style="margin-top: 18px;">
          <ion-button expand="block" class="agb-primary" (click)="logout()">
            <ion-icon name="log-out-outline" slot="start"></ion-icon>
            Logout
          </ion-button>
        </div>

        <p class="phase-note">App version v0.2.0-phase2 · AGB Supervisor</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .profile-hero {
      background: var(--agb-gradient-primary);
      color: #ffffff;
      padding: 32px 18px 40px;
      border-radius: 0 0 28px 28px;
      text-align: center;
      margin-bottom: -22px;
    }
    .profile-hero h2 {
      margin: 12px 0 4px;
      font-size: 22px;
      font-weight: 700;
    }
    .profile-hero p {
      margin: 0 0 10px;
      opacity: 0.85;
      font-size: 13px;
    }
    .profile-hero ion-chip {
      --background: rgba(255,255,255,0.18);
      --color: #ffffff;
    }
    .avatar {
      width: 84px;
      height: 84px;
      border-radius: 50%;
      background: var(--agb-gradient-gold);
      color: #2a230a;
      font-weight: 800;
      font-size: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      box-shadow: 0 12px 24px rgba(0,0,0,0.25);
    }
    .container { padding: 18px; }
    .phase-note {
      margin-top: 18px;
      padding: 12px;
      font-size: 12px;
      color: var(--agb-text-muted);
      text-align: center;
      font-style: italic;
    }
    .agb-text-btn {
      --color: var(--agb-primary);
      font-weight: 600;
      text-transform: none;
      margin-top: 6px;
    }
    ion-item.agb-field {
      --background: transparent;
      --inner-padding-end: 0;
      --padding-start: 0;
      --border-color: transparent;
    }
  `],
})
export class ProfilePage {
  user = this.auth.currentUser;
  editMode = false;
  edit = { name: '', phone: '', email: '' };

  get initials() {
    const name = this.user()?.name || 'Supervisor';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  constructor(
    private auth: AuthService,
    private mock: MockDataService,
    private toastCtrl: ToastController,
  ) {
    addIcons({
      'person-circle-outline': personCircleOutline,
      'call-outline': callOutline,
      'mail-outline': mailOutline,
      'briefcase-outline': briefcaseOutline,
      'location-outline': locationOutline,
      'log-out-outline': logOutOutline,
      'create-outline': createOutline,
      'checkmark-outline': checkmarkOutline,
      'checkmark-done-circle-outline': () => null as any,
    } as any);
  }

  toggleEdit() {
    const u = this.user();
    if (!u) return;
    this.edit = { name: u.name, phone: u.phone, email: u.email };
    this.editMode = true;
  }

  cancelEdit() {
    this.editMode = false;
  }

  async saveEdit() {
    this.mock.updateUser({ ...this.edit });
    this.auth.setUser(this.mock.currentUser());
    this.editMode = false;
    const toast = await this.toastCtrl.create({
      message: 'Profile updated',
      duration: 1500,
      position: 'top',
      cssClass: 'agb-toast',
    });
    await toast.present();
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
    location.href = '/login';
  }
}