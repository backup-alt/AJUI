import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonContent,
  IonIcon,
  IonSkeletonText,
  IonRefresher, IonRefresherContent,
  IonSearchbar,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  peopleOutline, timeOutline,
  chevronForwardOutline, closeOutline, checkmarkOutline,
  constructOutline, buildOutline, flashOutline, cutOutline,
  homeOutline, colorPaletteOutline, hammerOutline, gridOutline,
  layersOutline, carOutline, sparklesOutline, briefcaseOutline,
  calendarOutline, ellipsisHorizontalOutline, searchOutline,
  businessOutline, locationOutline, checkmarkCircleOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Subcontractor, SubcontractorAttendance } from '../../shared/models';
import { DatePipe } from '@angular/common';
import { EmptyStateComponent } from '../../shared/components';

interface SubcontractorDayStatus {
  subcontractor: Subcontractor;
  attendance: SubcontractorAttendance | null;
  totalCount: number;
}

const LABOUR_TYPE_ICONS: Record<string, string> = {
  'Helper': 'hammer-outline',
  'Mason': 'layers-outline',
  'Plumber': 'build-outline',
  'Electrician': 'flash-outline',
  'Carpenter': 'construct-outline',
  'Painter': 'color-palette-outline',
  'Civil': 'home-outline',
  'Tiles Worker': 'grid-outline',
  'Steel Fixer': 'car-outline',
  'Welder': 'sparkles-outline',
  'Fabricator': 'construct-outline',
  'Other': 'briefcase-outline',
};

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    IonContent,
    IonIcon, IonSkeletonText,
    IonRefresher, IonRefresherContent,
    IonSearchbar,
    FormsModule, DatePipe,
    EmptyStateComponent,
  ],
  template: `
    <ion-content class="attendance-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshAll($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="page-head">
        <h1>Attendance</h1>
        <p>Mark today's muster for every sub-contractor on site.</p>
      </div>

      <div class="today-bar">
        <div class="today-icon">
          <ion-icon name="calendar-outline"></ion-icon>
        </div>
        <div class="today-text">
          <span class="today-label">Today</span>
          <span class="today-date">{{ todayDate | date:'EEEE, MMMM d, yyyy' }}</span>
        </div>
        <div class="today-count" [class.has-count]="totalMarkedToday() > 0">
          <span class="count-num">{{ totalMarkedToday() }}</span>
          <span class="count-label">Attendance Marked</span>
        </div>
      </div>

      <div class="search-wrap">
        <ion-searchbar
          [value]="searchQuery()"
          (ionInput)="onSearchInput($event)"
          (ionClear)="clearSearch()"
          placeholder="Search sub-contractor by name..."
          mode="ios"
        ></ion-searchbar>
      </div>

      <div class="section-header">
        <h2>Sub-contractors</h2>
      </div>

      <div class="cards">
        @if (isLoading() && subcontractorStatuses().length === 0) {
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width: 50%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </div>
          }
        } @else if (filteredSubcontractorStatuses().length === 0) {
          <app-empty-state
            icon="people-outline"
            [title]="searchQuery() ? 'No matches' : 'No sub-contractors yet'"
            [message]="searchQuery() ? 'Try a different search term.' : 'Add a sub-contractor or pull one from the web admin to start marking daily attendance.'"
          ></app-empty-state>
        } @else {
          @for (status of filteredSubcontractorStatuses(); track status.subcontractor._id) {
            <button
              type="button"
              class="sub-card"
              [class.marked]="!!status.attendance"
              (click)="markAttendanceFor(status.subcontractor)"
            >
              <div class="sub-avatar">
                <ion-icon name="business-outline"></ion-icon>
              </div>
              <div class="sub-body">
                <div class="sub-name-row">
                  <h3 class="sub-name">{{ status.subcontractor.subcontractorName }}</h3>
                  @if (status.attendance) {
                    <span class="marked-pill">
                      <ion-icon name="checkmark-circle-outline"></ion-icon>
                      Marked
                    </span>
                  } @else {
                    <span class="pending-pill">Pending</span>
                  }
                </div>
                @if (status.attendance && status.attendance.entries.length > 0) {
                  <div class="sub-entries">
                    @for (entry of status.attendance.entries; track entry.labourType) {
                      <span class="entry-pill">
                        <ion-icon [name]="getTypeIcon(entry.labourType)"></ion-icon>
                        {{ entry.count }} {{ entry.labourType }}
                      </span>
                    }
                  </div>
                } @else {
                  <p class="sub-meta">
                    <ion-icon name="time-outline"></ion-icon>
                    Tap to mark today's attendance
                  </p>
                }
                @if (status.attendance && status.attendance.totalCount > 0) {
                  <div class="sub-total">
                    <strong>{{ status.attendance.totalCount }}</strong>
                    {{ status.attendance.totalCount === 1 ? 'worker' : 'workers' }} on site
                  </div>
                }
              </div>
              <ion-icon name="chevron-forward-outline" class="sub-arrow"></ion-icon>
            </button>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .attendance-content { --background: var(--m3-surface); }

    .page-head { padding: var(--md-space-4) var(--md-space-4) 0; }
    .page-head h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 2px;
      letter-spacing: -0.2px;
    }
    .page-head p { font-size: 13px; color: var(--m3-on-surface-muted); margin: 0 0 12px; }

    .today-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0 var(--md-space-4) 12px;
      padding: 12px 14px;
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-left: 3px solid var(--m3-primary);
      border-radius: var(--md-radius-lg);
      box-shadow: var(--md-elevation-1);
    }
    .today-icon {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(0, 34, 99, 0.1);
      color: var(--m3-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .today-icon ion-icon { font-size: 20px; }
    .today-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .today-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .today-date { font-size: 14px; font-weight: 700; color: var(--m3-on-surface); }
    .today-count {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 10px;
      border-radius: var(--md-radius-md);
      background: var(--m3-surface-container);
      color: var(--m3-on-surface-muted);
      min-width: 64px;
    }
    .today-count.has-count { background: rgba(34, 197, 94, 0.12); color: #15803d; }
    .count-num { font-size: 18px; font-weight: 800; line-height: 1; }
    .count-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }

    .search-wrap { padding: 0 var(--md-space-4) 0; }
    .search-wrap ion-searchbar {
      --background: var(--m3-surface-bright);
      --border-radius: var(--md-radius-xl);
      --box-shadow: var(--md-elevation-1);
      padding: 0;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px var(--md-space-4) 8px;
    }
    .section-header h2 {
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin: 0;
    }
    .add-sub-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: var(--m3-primary-container);
      color: var(--m3-on-primary-container);
      border: 0;
      border-radius: var(--md-radius-pill);
      font-size: 12px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
    }
    .add-sub-btn ion-icon { font-size: 14px; }
    .add-sub-btn:active { transform: scale(0.97); }

    .cards { padding: 4px var(--md-space-4) 96px; }

    .skeleton-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-3);
    }

    .sub-card {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 14px;
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      margin-bottom: var(--md-space-3);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      box-shadow: var(--md-elevation-1);
      transition: transform var(--md-motion-duration-short1), box-shadow var(--md-motion-duration-short1);
    }
    .sub-card:active { transform: scale(0.99); }
    .sub-card.marked {
      border-left: 3px solid #22c55e;
    }
    .sub-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(0, 34, 99, 0.1);
      color: var(--m3-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sub-avatar ion-icon { font-size: 20px; }
    .sub-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .sub-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
    }
    .sub-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .marked-pill, .pending-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 7px;
      border-radius: var(--md-radius-pill);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      flex-shrink: 0;
    }
    .marked-pill {
      background: rgba(34, 197, 94, 0.14);
      color: #15803d;
    }
    .marked-pill ion-icon { font-size: 12px; }
    .pending-pill {
      background: rgba(234, 179, 8, 0.14);
      color: #a86c02;
    }
    .sub-meta {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .sub-meta ion-icon { font-size: 13px; }
    .sub-entries {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .entry-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 7px;
      background: var(--m3-surface-container);
      color: var(--m3-on-surface-variant);
      border-radius: var(--md-radius-sm);
    }
    .entry-pill ion-icon { font-size: 12px; }
    .sub-total {
      font-size: 12px;
      color: var(--m3-on-surface-muted);
      margin-top: 4px;
    }
    .sub-total strong { color: var(--m3-on-surface); font-size: 13px; }
    .sub-arrow { color: var(--m3-on-surface-muted); font-size: 18px; flex-shrink: 0; }

    ion-fab-button { --background: var(--m3-primary); --color: var(--m3-on-primary); }
  `],
})
export class AttendancePage implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private supervisor = inject(SupervisorService);
  private router = inject(Router);

  todayDate = new Date().toISOString().slice(0, 10);

  subcontractors = signal<Subcontractor[]>([]);
  todayAttendance = signal<SubcontractorAttendance[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');

  subcontractorStatuses = computed<SubcontractorDayStatus[]>(() => {
    const attBySub = new Map<string, SubcontractorAttendance>();
    for (const att of this.todayAttendance()) {
      attBySub.set(String(att.subcontractorId), att);
    }
    return this.subcontractors().map((sub) => {
      const att = attBySub.get(String(sub._id)) || null;
      return {
        subcontractor: sub,
        attendance: att,
        totalCount: att?.totalCount ?? 0,
      };
    });
  });

  filteredSubcontractorStatuses = computed<SubcontractorDayStatus[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.subcontractorStatuses();
    return this.subcontractorStatuses().filter((s) =>
      (s.subcontractor.subcontractorName || '').toLowerCase().includes(q) ||
      (s.subcontractor.phone || '').toLowerCase().includes(q)
    );
  });

  totalMarkedToday = computed(() =>
    this.subcontractorStatuses().filter((s) => !!s.attendance).length
  );

  async ngOnInit(): Promise<void> {
    addIcons({
      peopleOutline, timeOutline,
      chevronForwardOutline, closeOutline, checkmarkOutline,
      constructOutline, buildOutline, flashOutline, cutOutline,
      homeOutline, colorPaletteOutline, hammerOutline, gridOutline,
      layersOutline, carOutline, sparklesOutline, briefcaseOutline,
      calendarOutline, ellipsisHorizontalOutline, searchOutline,
      businessOutline, locationOutline, checkmarkCircleOutline,
    });
    await this.supervisor.init().catch(() => {});
    await this.loadData();

    this.supervisor.siteChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.loadData());

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:labour-changed', this.handleLabourChange);
      window.addEventListener('agb:attendance-changed', this.handleLabourChange);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:labour-changed', this.handleLabourChange);
      window.removeEventListener('agb:attendance-changed', this.handleLabourChange);
    }
  }

  private handleLabourChange = (): void => {
    void this.loadData();
  };

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [subsRes, attRes] = await Promise.all([
        this.supervisor.getSubcontractors().toPromise(),
        this.supervisor.getBulkAttendanceForDate(this.todayDate).toPromise(),
      ]);
      this.subcontractors.set(subsRes?.subcontractors || []);
      this.todayAttendance.set(attRes?.attendances || []);
    } catch (e) {
      console.error('[Attendance] failed to load', e);
      this.subcontractors.set([]);
      this.todayAttendance.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshAll(event: CustomEvent): Promise<void> {
    await this.loadData();
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }

  onSearchInput(event: any): void {
    this.searchQuery.set(event.detail.value || '');
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  getTypeIcon(type: string): string {
    return LABOUR_TYPE_ICONS[type] || 'briefcase-outline';
  }

  markAttendanceFor(sub: Subcontractor): void {
    this.router.navigate(['/tabs/labour/mark-bulk', sub._id]);
  }
}
