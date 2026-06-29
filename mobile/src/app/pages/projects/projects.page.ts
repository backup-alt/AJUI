import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButtons,
  IonMenuButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSearchbar,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { folderOutline, locationOutline, trendingUpOutline, chevronForwardOutline } from 'ionicons/icons';
import { MockDataService } from '../../core/services/mock-data.service';
import { ProjectStatus } from '../../core/models/types';

@Component({
  selector: 'app-projects',
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
    IonMenuButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonChip,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonSearchbar,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar class="agb-header">
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>My Projects</ion-title>
      </ion-toolbar>
      <ion-toolbar class="agb-sub-toolbar">
        <ion-searchbar
          [(ngModel)]="searchTerm"
          placeholder="Search projects or clients"
          mode="ios"
          animated>
        </ion-searchbar>
        <ion-segment [(ngModel)]="filter" mode="ios">
          <ion-segment-button value="all">
            <ion-label>All</ion-label>
          </ion-segment-button>
          <ion-segment-button value="active">
            <ion-label>Active</ion-label>
          </ion-segment-button>
          <ion-segment-button value="hold">
            <ion-label>On Hold</ion-label>
          </ion-segment-button>
          <ion-segment-button value="done">
            <ion-label>Completed</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="container">
        <div class="summary-row">
          <div class="summary-tile">
            <span class="label">Total</span>
            <span class="value">{{ projects().length }}</span>
          </div>
          <div class="summary-tile">
            <span class="label">Active</span>
            <span class="value active">{{ activeCount() }}</span>
          </div>
          <div class="summary-tile">
            <span class="label">Value (INR)</span>
            <span class="value">{{ totalValue() | number:'1.0-0' }}</span>
          </div>
        </div>

        <div *ngIf="filtered().length === 0" class="agb-empty">
          <ion-icon name="folder-outline"></ion-icon>
          <h3>No projects found</h3>
          <p>Try changing the filter or search term.</p>
        </div>

        <ion-card
          *ngFor="let p of filtered()"
          class="agb-card agb-card-elevated project-card"
          button
          (click)="openProject(p.id)">
          <ion-card-header>
            <div class="project-head">
              <div>
                <div class="project-id">{{ p.projectId }}</div>
                <ion-card-title>{{ p.name }}</ion-card-title>
                <ion-card-subtitle>{{ p.client }} · {{ p.mobile }}</ion-card-subtitle>
              </div>
              <ion-chip [class]="projectStatusClass(p.status)">{{ p.status }}</ion-chip>
            </div>
          </ion-card-header>
          <ion-card-content>
            <div class="address">
              <ion-icon name="location-outline"></ion-icon>
              <span>{{ p.address }}</span>
            </div>
            <div class="stats-row">
              <div class="stat">
                <span class="label">Sites</span>
                <span class="value">{{ p.sites.length }}</span>
              </div>
              <div class="stat">
                <span class="label">Material</span>
                <span class="value">{{ p.materialSpend | number:'1.0-0' }}</span>
              </div>
              <div class="stat">
                <span class="label">Labour</span>
                <span class="value">{{ p.labourPayable | number:'1.0-0' }}</span>
              </div>
              <div class="stat">
                <span class="label">Balance</span>
                <span class="value">{{ p.pendingBalance | number:'1.0-0' }}</span>
              </div>
            </div>
            <div class="agb-progress" style="margin-top: 14px;">
              <span [style.width.%]="p.completion"></span>
            </div>
            <div class="progress-row">
              <span class="muted">{{ p.completion }}% complete</span>
              <span class="muted">Started {{ p.startDate | date:'MMM yyyy' }}</span>
            </div>
            <div class="chevron">
              <ion-icon name="chevron-forward-outline"></ion-icon>
            </div>
          </ion-card-content>
        </ion-card>

        <div style="height: 80px;"></div>
      </div>
    </ion-content>
  `,
  styles: [`
    .agb-sub-toolbar {
      --background: var(--agb-gradient-primary);
      --color: #ffffff;
      padding: 0;
    }
    .agb-sub-toolbar ion-searchbar {
      --background: rgba(255,255,255,0.15);
      --color: #ffffff;
      --placeholder-color: rgba(255,255,255,0.7);
      --icon-color: #ffffff;
      padding: 0;
    }
    .agb-sub-toolbar ion-segment {
      --background: transparent;
      margin: 0 8px 8px;
    }
    .agb-sub-toolbar ion-segment-button {
      --color: rgba(255,255,255,0.7);
      --color-checked: #ffffff;
      --indicator-color: var(--agb-gold);
      --border-radius: 10px;
      min-height: 32px;
      font-size: 12px;
      text-transform: none;
      font-weight: 600;
    }
    .container { padding: 18px; }
    .summary-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
    }
    .summary-tile {
      background: var(--agb-surface);
      border: 1px solid var(--agb-border);
      border-radius: var(--agb-radius);
      padding: 12px;
      text-align: center;
      box-shadow: var(--agb-shadow-sm);
    }
    .summary-tile .label {
      display: block;
      font-size: 10px;
      color: var(--agb-text-muted);
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .summary-tile .value {
      display: block;
      font-size: 18px;
      font-weight: 800;
      color: var(--agb-primary);
      margin-top: 4px;
    }
    .summary-tile .value.active { color: var(--agb-success); }
    .project-card {
      margin-bottom: 14px;
      position: relative;
    }
    .project-head {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
    }
    .project-id {
      font-size: 11px;
      font-weight: 700;
      color: var(--agb-primary);
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .project-head ion-card-title { font-size: 15px; line-height: 1.3; }
    .project-head ion-card-subtitle { font-size: 12px; margin-top: 4px; }
    .address {
      display: flex; align-items: center; gap: 6px;
      color: var(--agb-text-muted);
      font-size: 12px;
      margin: 6px 0 14px;
    }
    .address ion-icon { flex-shrink: 0; font-size: 14px; }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 10px;
      background: rgba(0,34,99,0.04);
      border-radius: 10px;
    }
    .stat { text-align: center; }
    .stat .label {
      display: block;
      font-size: 9px;
      color: var(--agb-text-muted);
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .stat .value {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: var(--agb-primary);
      margin-top: 2px;
    }
    .progress-row {
      display: flex; justify-content: space-between;
      margin-top: 8px;
    }
    .muted { color: var(--agb-text-muted); font-size: 11px; }
    .chevron {
      position: absolute;
      right: 14px;
      bottom: 12px;
      color: var(--agb-text-muted);
    }
  `],
})
export class ProjectsPage {
  projects = this.mock.projects;
  filter: 'all' | 'active' | 'hold' | 'done' = 'all';
  searchTerm = '';

  activeCount = computed(() => this.projects().filter((p) => p.status === 'Active').length);
  totalValue = computed(() => this.projects().reduce((sum, p) => sum + p.totalValue, 0));

  filtered = computed(() => {
    const term = this.searchTerm.trim().toLowerCase();
    return this.projects().filter((p) => {
      if (this.filter === 'active' && p.status !== 'Active') return false;
      if (this.filter === 'hold' && p.status !== 'On Hold') return false;
      if (this.filter === 'done' && p.status !== 'Completed') return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        p.client.toLowerCase().includes(term) ||
        p.projectId.toLowerCase().includes(term)
      );
    });
  });

  constructor(private mock: MockDataService, private router: Router) {
    addIcons({
      'folder-outline': folderOutline,
      'location-outline': locationOutline,
      'trending-up-outline': trendingUpOutline,
      'chevron-forward-outline': chevronForwardOutline,
    });
  }

  openProject(id: string) {
    this.router.navigate(['/project', id]);
  }

  projectStatusClass(s: ProjectStatus) {
    return {
      Active: 'agb-chip agb-chip-info',
      'On Hold': 'agb-chip agb-chip-warning',
      Completed: 'agb-chip agb-chip-success',
    }[s] || 'agb-chip';
  }
}