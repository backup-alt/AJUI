import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import {
  IonContent, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
  IonFab, IonFabButton, IonIcon, IonBadge, IonSkeletonText,
  IonRefresher, IonRefresherContent, IonInput, IonButton,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  addOutline, peopleOutline, timeOutline, personAddOutline, checkmarkOutline,
  chevronForwardOutline, businessOutline, briefcaseOutline, ribbonOutline,
  addCircleOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Labour, LabourStatus } from '../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';
import {
  EmptyStateComponent,
  StatusPillComponent,
} from '../../shared/components';

const DEFAULT_LABOUR_TYPES = ['Mason', 'Helper', 'Electrician', 'Plumber', 'Civil'];

interface Employee {
  name: string;
  labourTypes: string[];
  lastSeen: string;
  entryCount: number;
}

@Component({
  selector: 'app-labour',
  standalone: true,
  imports: [
    IonContent, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
    IonFab, IonFabButton, IonIcon, IonBadge, IonSkeletonText,
    IonRefresher, IonRefresherContent, FormsModule, DatePipe, CurrencyPipe,
    IonInput, IonButton, EmptyStateComponent, StatusPillComponent,
  ],
  template: `
    <ion-content class="labour-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshAll($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="page-head">
        <h1>Labour</h1>
        <p>Manage your workers and daily attendance.</p>
      </div>

      <div class="filter-stack">
        <ion-searchbar
          [placeholder]="activeTab === 'employees' ? 'Search employees' : 'Search attendance'"
          [(ngModel)]="searchQuery"
          (ionInput)="onSearch()"
        ></ion-searchbar>
        <div class="seg-wrap">
          <ion-segment [(ngModel)]="activeTab" (ionChange)="onTabChange()" [value]="'employees'">
            <ion-segment-button value="employees">
              <ion-label>Employees</ion-label>
            </ion-segment-button>
            <ion-segment-button value="attendance">
              <ion-label>Attendance</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>
      </div>

      @if (activeTab === 'employees') {
        <div class="cards">
          @if (isLoading() && employees().length === 0) {
            @for (i of [1,2,3]; track i) {
              <div class="skeleton-card">
                <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
                <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              </div>
            }
          } @else if (filteredEmployees().length === 0) {
            <app-empty-state
              icon="people-outline"
              title="No employees yet"
              message="Log a worker's first attendance to start tracking them."
            ></app-empty-state>
          } @else {
            @for (emp of filteredEmployees(); track emp.name) {
              <article class="emp-card">
                <header class="emp-head">
                  <span class="emp-tile">
                    <ion-icon name="briefcase-outline"></ion-icon>
                  </span>
                  <div class="emp-info">
                    <h3 class="emp-name">{{ emp.name }}</h3>
                    <p class="emp-meta">
                      <ion-icon name="ribbon-outline"></ion-icon>
                      {{ emp.entryCount }} {{ emp.entryCount === 1 ? 'entry' : 'entries' }}
                    </p>
                  </div>
                </header>
                <div class="emp-types">
                  @for (type of emp.labourTypes; track type) {
                    <span class="type-chip">{{ type }}</span>
                  }
                  @if (emp.labourTypes.length === 0) {
                    <span class="type-chip neutral">No categories yet</span>
                  }
                </div>
              </article>
            }
          }
        </div>

        <ion-fab slot="fixed" vertical="bottom" horizontal="end">
          <ion-fab-button (click)="showAddEmployee = true">
            <ion-icon name="person-add-outline"></ion-icon>
          </ion-fab-button>
        </ion-fab>

        @if (showAddEmployee) {
          <div class="modal-backdrop" (click)="showAddEmployee = false"></div>
          <div class="add-emp-modal">
            <div class="modal-tile">
              <ion-icon name="person-add-outline"></ion-icon>
            </div>
            <h3>How new employees are tracked</h3>
            <p>
              In AGB, employees are tracked as
              <strong>labour entries</strong> by party name and category.
            </p>
            <p>
              To add a new employee, log their first day's attendance using the
              <strong>Log attendance</strong> button. They'll appear here once recorded.
            </p>
            <div class="modal-actions">
              <button class="btn ghost" (click)="showAddEmployee = false">Got it</button>
              <button class="btn primary" (click)="logFirstAttendance()">Log first attendance</button>
            </div>
          </div>
        }
      }

      @if (activeTab === 'attendance') {
        <div class="filter-bar">
          <ion-segment [(ngModel)]="statusFilter" (ionChange)="filterLabour()" [value]="''">
            <ion-segment-button [value]="''"><ion-label>All</ion-label></ion-segment-button>
            <ion-segment-button value="Pending"><ion-label>Pending</ion-label></ion-segment-button>
            <ion-segment-button value="Approved"><ion-label>Approved</ion-label></ion-segment-button>
          </ion-segment>
        </div>

        <div class="cards">
          @if (isLoading() && labour().length === 0) {
            @for (i of [1,2,3]; track i) {
              <div class="skeleton-card">
                <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
                <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              </div>
            }
          } @else if (filteredLabour().length === 0) {
            <app-empty-state
              icon="time-outline"
              title="No attendance records"
              message="Log today's attendance to get started."
            ></app-empty-state>
          } @else {
            @for (entry of filteredLabour(); track entry.labourId) {
              <button class="labour-card" (click)="viewLabour(entry)">
                <header class="labour-head">
                  <div class="labour-info">
                    <h3 class="labour-party">{{ entry.partyName }}</h3>
                    <p class="labour-site">
                      <ion-icon name="business-outline"></ion-icon>
                      {{ entry.site }} - {{ entry.projectName }}
                    </p>
                  </div>
                  <app-status-pill [tone]="getStatusTone(entry.status)">{{ entry.status }}</app-status-pill>
                </header>

                <div class="labour-stats">
                  <div class="stat">
                    <div class="stat-value">{{ entry.presentCount }}</div>
                    <div class="stat-label">Present</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">{{ entry.presentDays }}</div>
                    <div class="stat-label">Days</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">{{ entry.dailyWage | currency:'INR':'symbol':'1.0-0' }}</div>
                    <div class="stat-label">Daily wage</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">{{ entry.shift }}</div>
                    <div class="stat-label">Shift</div>
                  </div>
                </div>

                <footer class="labour-footer">
                  <div class="labour-date">
                    <ion-icon name="time-outline"></ion-icon>
                    {{ entry.attendanceDate | date:'MMM d, yyyy' }}
                  </div>
                  <span class="view-link">
                    View
                    <ion-icon name="chevron-forward-outline"></ion-icon>
                  </span>
                </footer>
              </button>
            }
          }
        </div>

        <ion-fab slot="fixed" vertical="bottom" horizontal="end">
          <ion-fab-button (click)="createLabour()">
            <ion-icon name="add-outline"></ion-icon>
          </ion-fab-button>
        </ion-fab>
      }
    </ion-content>
  `,
  styles: [`
    .labour-content { --background: #f5f6f8; }

    .page-head { padding: 16px 16px 0; }
    .page-head h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 2px; letter-spacing: -0.2px; }
    .page-head p { font-size: 13px; color: #64748b; margin: 0 0 12px; }

    .filter-stack { padding: 0 16px 8px; }
    .seg-wrap { padding: 4px 4px 8px; }
    .filter-bar { padding: 0 16px 4px; }

    .cards { padding: 4px 16px 96px; }
    .emp-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 10px;
      box-shadow: var(--agb-shadow-2xs);
    }
    .emp-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .emp-tile {
      width: 40px; height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(14, 165, 233, 0.04));
      color: #0369a1;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .emp-tile ion-icon { font-size: 18px; }
    .emp-info { flex: 1; min-width: 0; }
    .emp-name { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
    .emp-meta { font-size: 12px; color: #64748b; margin: 0; display: inline-flex; align-items: center; gap: 4px; }
    .emp-meta ion-icon { font-size: 12px; }
    .emp-types { display: flex; flex-wrap: wrap; gap: 6px; }
    .type-chip {
      font-size: 11px;
      padding: 4px 10px;
      background: rgba(201, 162, 39, 0.10);
      border: 1px solid rgba(201, 162, 39, 0.20);
      color: #a8861f;
      border-radius: 999px;
      font-weight: 600;
    }
    .type-chip.neutral { background: #f1f5f9; border-color: #e2e8f0; color: #64748b; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.50); z-index: 100; backdrop-filter: blur(2px); }
    .add-emp-modal {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: calc(100% - 32px); max-width: 360px;
      background: #ffffff; border-radius: 22px; padding: 22px 20px;
      z-index: 101;
      box-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.30);
      text-align: center;
    }
    .modal-tile {
      width: 56px; height: 56px;
      margin: 0 auto 14px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(14, 165, 233, 0.04));
      color: #0369a1;
      display: flex; align-items: center; justify-content: center;
    }
    .modal-tile ion-icon { font-size: 26px; }
    .add-emp-modal h3 { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    .add-emp-modal p { font-size: 13px; color: #475569; margin: 0 0 10px; line-height: 1.55; text-align: left; }
    .add-emp-modal p strong { color: #0f172a; }
    .modal-actions { display: flex; gap: 8px; margin-top: 16px; }
    .btn {
      flex: 1; min-width: 0;
      padding: 12px 14px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
      border: 0;
      transition: filter var(--agb-transition-fast);
    }
    .btn.ghost { background: #f1f5f9; color: #002263; border: 1px solid #e2e8f0; }
    .btn.primary { background: #002263; color: #ffffff; }

    .skeleton-card {
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 10px;
    }

    /* Labour attendance card */
    .labour-card {
      width: 100%;
      text-align: left;
      background: #ffffff;
      border: 1px solid #eef0f3;
      border-radius: 20px;
      padding: 14px 16px;
      margin-bottom: 10px;
      box-shadow: var(--agb-shadow-2xs);
      cursor: pointer;
      font-family: inherit;
      transition: transform var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
    }
    .labour-card:active { transform: scale(0.99); }
    .labour-card:hover { box-shadow: var(--agb-shadow-sm); }
    .labour-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .labour-info { flex: 1; min-width: 0; }
    .labour-party { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
    .labour-site { font-size: 12px; color: #64748b; margin: 0; display: inline-flex; align-items: center; gap: 4px; }
    .labour-site ion-icon { font-size: 12px; }

    .labour-stats {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 12px;
      padding: 10px 8px;
      margin-bottom: 10px;
    }
    .stat { text-align: center; }
    .stat-value { font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.1; }
    .stat-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 3px; }

    .labour-footer { display: flex; align-items: center; justify-content: space-between; }
    .labour-date { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .labour-date ion-icon { font-size: 13px; }
    .view-link { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; color: #002263; }
    .view-link ion-icon { font-size: 14px; }

    ion-fab-button { --background: #002263; --color: #ffffff; }
  `],
})
export class LabourPage implements OnInit, OnDestroy {
  private supervisor = inject(SupervisorService);
  private router = inject(Router);

  activeTab = 'employees';
  searchQuery = '';
  statusFilter: LabourStatus | '' = '';

  labour = signal<Labour[]>([]);
  filteredLabour = signal<Labour[]>([]);
  isLoading = signal(true);

  employees = computed<Employee[]>(() => {
    const map = new Map<string, Employee>();
    for (const entry of this.labour()) {
      if (!map.has(entry.partyName)) {
        map.set(entry.partyName, {
          name: entry.partyName,
          labourTypes: [...new Set(entry.laborTypes?.map((t) => t.name) || [])],
          lastSeen: entry.attendanceDate,
          entryCount: 1,
        });
      } else {
        const existing = map.get(entry.partyName)!;
        existing.entryCount++;
        if (entry.attendanceDate > existing.lastSeen) existing.lastSeen = entry.attendanceDate;
        for (const t of entry.laborTypes || []) {
          if (!existing.labourTypes.includes(t.name)) existing.labourTypes.push(t.name);
        }
      }
    }
    return Array.from(map.values());
  });

  filteredEmployees = computed<Employee[]>(() => {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.employees();
    return this.employees().filter((e) => e.name.toLowerCase().includes(q));
  });

  showAddEmployee = false;
  newEmployeeName = '';
  newEmployeeTypes: string[] = [];
  defaultTypes = DEFAULT_LABOUR_TYPES;

  async ngOnInit(): Promise<void> {
    addIcons({
      addOutline, peopleOutline, timeOutline, personAddOutline, checkmarkOutline,
      chevronForwardOutline, businessOutline, briefcaseOutline, ribbonOutline, addCircleOutline,
    });
    await this.loadLabour();

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:site-changed', this.handleSiteChange);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('agb:site-changed', this.handleSiteChange);
    }
  }

  private handleSiteChange = (): void => {
    void this.loadLabour();
  };

  async loadLabour(): Promise<void> {
    this.isLoading.set(true);
    try {
      const projectId = this.supervisor.selectedProjectId();
      const siteId = this.supervisor.selectedSiteId();
      this.supervisor
        .getLabourEntries({
          projectId: projectId ?? undefined,
          siteId: siteId ?? undefined,
          limit: 100,
        })
        .subscribe({
          next: (r) => {
            this.labour.set(r.labour || []);
            this.filterLabour();
            this.isLoading.set(false);
          },
          error: (err) => {
            console.error('[Labour] failed to load', err);
            this.labour.set([]);
            this.filterLabour();
            this.isLoading.set(false);
          },
        });
    } catch (e) {
      console.error(e);
      this.isLoading.set(false);
    }
  }

  async refreshAll(event: CustomEvent): Promise<void> {
    await this.loadLabour();
    (event.target as HTMLIonRefresherElement).complete();
  }

  onTabChange() {
    this.searchQuery = '';
    this.filterLabour();
  }

  onSearch() {
    if (this.activeTab === 'attendance') this.filterLabour();
  }

  filterLabour(): void {
    let filtered = this.labour();
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter((l) => l.partyName.toLowerCase().includes(q) || l.site.toLowerCase().includes(q));
    }
    if (this.statusFilter) filtered = filtered.filter((l) => l.status === this.statusFilter);
    this.filteredLabour.set(filtered);
  }

  toggleNewType(t: string) {
    const idx = this.newEmployeeTypes.indexOf(t);
    if (idx >= 0) this.newEmployeeTypes.splice(idx, 1);
    else this.newEmployeeTypes.push(t);
  }

  logFirstAttendance(): void {
    this.showAddEmployee = false;
    this.createLabour();
  }

  viewLabour(entry: Labour): void { this.router.navigate(['/tabs/labour', entry._id]); }
  createLabour(): void { this.router.navigate(['/tabs/labour/create']); }

  getStatusTone(status: LabourStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    return status === 'Pending' ? 'warning' : status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'neutral';
  }
}
