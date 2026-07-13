import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardContent,
  IonFab, IonFabButton, IonIcon, IonBadge, IonSkeletonText,
  IonRefresher, IonRefresherContent, IonItem, IonInput, IonButton,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { addOutline, peopleOutline, timeOutline, personAddOutline, checkmarkOutline } from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Labour, LabourStatus } from '../../shared/models';
import { DatePipe, CurrencyPipe } from '@angular/common';

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
    IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar,
    IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardContent,
    IonFab, IonFabButton, IonIcon, IonBadge, IonSkeletonText,
    IonRefresher, IonRefresherContent, FormsModule, DatePipe, CurrencyPipe,
    IonInput, IonButton,
  ],
  template: `
    <ion-header class="agb-header">
      <ion-toolbar><ion-title>Labour</ion-title></ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Search..." [(ngModel)]="searchQuery" (ionInput)="onSearch()"></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [(ngModel)]="activeTab" (ionChange)="onTabChange()" [value]="'employees'">
          <ion-segment-button value="employees"><ion-label>Employees</ion-label></ion-segment-button>
          <ion-segment-button value="attendance"><ion-label>Attendance</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="labour-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshAll($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (activeTab === 'employees') {
        @if (isLoading() && employees().length === 0) {
          @for (i of [1,2,3]; track i) {
            <ion-card class="skeleton">
              <ion-card-content>
                <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
                <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              </ion-card-content>
            </ion-card>
          }
        } @else if (filteredEmployees().length === 0) {
          <div class="empty-state">
            <ion-icon name="people-outline"></ion-icon>
            <h3>No Employees</h3>
            <p>Add employees to track their attendance</p>
          </div>
        } @else {
          @for (emp of filteredEmployees(); track emp.name) {
            <ion-card class="emp-card">
              <ion-card-content>
                <div class="emp-header">
                  <div class="emp-info">
                    <h3 class="emp-name">{{ emp.name }}</h3>
                    <p class="emp-meta">{{ emp.entryCount }} entries</p>
                  </div>
                </div>
                <div class="emp-types">
                  @for (type of emp.labourTypes; track type) {
                    <span class="type-chip">{{ type }}</span>
                  }
                  @if (addingTypeFor() === emp.name) {
                    <div class="add-type-form">
                      <ion-input
                        placeholder="Type name"
                        [(ngModel)]="newLabourType"
                        (keydown.enter)="addLabourType(emp.name)"
                        style="width: 100px; font-size: 12px;"
                      ></ion-input>
                      <ion-button size="small" (click)="addLabourType(emp.name)" [disabled]="!newLabourType.trim()">
                        <ion-icon name="checkmark-outline"></ion-icon>
                      </ion-button>
                    </div>
                  }
                  <button class="type-add-btn" (click)="startAddType(emp.name)">
                    <ion-icon name="add-outline"></ion-icon>
                    Add type
                  </button>
                </div>
              </ion-card-content>
            </ion-card>
          }
        }

        <ion-fab slot="fixed" vertical="bottom" horizontal="end">
          <ion-fab-button (click)="showAddEmployee = true">
            <ion-icon name="person-add-outline"></ion-icon>
          </ion-fab-button>
        </ion-fab>

        @if (showAddEmployee) {
          <div class="modal-backdrop" (click)="showAddEmployee = false"></div>
          <div class="add-emp-modal">
            <h3>Add Employee</h3>
            <ion-input
              placeholder="Employee name"
              [(ngModel)]="newEmployeeName"
              class="emp-name-input"
            ></ion-input>
            <div class="default-types">
              <span class="default-label">Labour types:</span>
              <div class="type-chips">
                @for (t of defaultTypes; track t) {
                  <button class="type-chip" [class.selected]="newEmployeeTypes.includes(t)" (click)="toggleNewType(t)">{{ t }}</button>
                }
              </div>
            </div>
            <div class="modal-actions">
              <ion-button fill="outline" (click)="showAddEmployee = false">Cancel</ion-button>
              <ion-button (click)="saveNewEmployee()" [disabled]="!newEmployeeName.trim()">Save</ion-button>
            </div>
          </div>
        }
      }

      @if (activeTab === 'attendance') {
        <ion-toolbar class="filter-bar">
          <ion-segment [(ngModel)]="statusFilter" (ionChange)="filterLabour()" [value]="''">
            <ion-segment-button [value]="''"><ion-label>All</ion-label></ion-segment-button>
            <ion-segment-button value="Pending"><ion-label>Pending</ion-label></ion-segment-button>
            <ion-segment-button value="Approved"><ion-label>Approved</ion-label></ion-segment-button>
          </ion-segment>
        </ion-toolbar>

        @if (isLoading() && labour().length === 0) {
          @for (i of [1,2,3]; track i) {
            <ion-card class="skeleton">
              <ion-card-content>
                <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
                <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              </ion-card-content>
            </ion-card>
          }
        } @else if (filteredLabour().length === 0) {
          <div class="empty-state">
            <ion-icon name="time-outline"></ion-icon>
            <h3>No Attendance Records</h3>
            <p>Log today's attendance to get started</p>
          </div>
        } @else {
          @for (entry of filteredLabour(); track entry.labourId) {
            <ion-card class="labour-card" (click)="viewLabour(entry)">
              <ion-card-content>
                <div class="labour-header">
                  <div class="labour-info">
                    <h3 class="labour-party">{{ entry.partyName }}</h3>
                    <p class="labour-site">{{ entry.site }} &bull; {{ entry.projectName }}</p>
                  </div>
                  <ion-badge [color]="getStatusColor(entry.status)">{{ entry.status }}</ion-badge>
                </div>
                <div class="labour-stats">
                  <div class="stat">
                    <span class="stat-value">{{ entry.presentCount }}</span>
                    <span class="stat-label">Present</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ entry.presentDays }}</span>
                    <span class="stat-label">Days</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ entry.dailyWage | currency:'INR':'symbol':'1.0-0' }}</span>
                    <span class="stat-label">Daily Wage</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ entry.shift }}</span>
                    <span class="stat-label">Shift</span>
                  </div>
                </div>
                <div class="labour-footer">
                  <div class="labour-date">
                    <ion-icon name="time-outline"></ion-icon>
                    {{ entry.attendanceDate | date:'MMM d, yyyy' }}
                  </div>
                  @if (entry.paymentMode) {
                    <ion-badge fill="outline">{{ entry.paymentMode }}</ion-badge>
                  }
                </div>
              </ion-card-content>
            </ion-card>
          }
        }

        <ion-fab slot="fixed" vertical="bottom" horizontal="end">
          <ion-fab-button (click)="createLabour()">
            <ion-icon name="add-outline"></ion-icon>
          </ion-fab-button>
        </ion-fab>
      }
    </ion-content>
  `,
  styles: [`
    .agb-header { --background: var(--agb-white); }
    .labour-content { --background: var(--agb-off-white); }
    .filter-bar { --background: var(--agb-white); padding: 0 16px; }
    .skeleton { margin: 12px 16px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 32px; text-align: center; }
    .empty-state ion-icon { font-size: 64px; color: var(--agb-light-gray); margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; font-weight: 600; color: var(--agb-navy); margin: 0 0 8px; }
    .empty-state p { font-size: 14px; color: var(--agb-gray); margin: 0; }
    .emp-card { margin: 12px 16px; }
    .emp-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .emp-name { font-size: 16px; font-weight: 600; color: var(--agb-navy); margin: 0 0 3px; }
    .emp-meta { font-size: 12px; color: var(--agb-gray); margin: 0; }
    .emp-types { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .type-chip { font-size: 11px; padding: 3px 8px; background: var(--agb-off-white); border: 1px solid #e5e7eb; border-radius: 20px; color: var(--agb-dark-gray); cursor: pointer; }
    .type-chip.selected { background: #fffbeb; border-color: #c9a227; color: #c9a227; font-weight: 600; }
    .type-add-btn { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; padding: 3px 8px; background: none; border: 1px dashed #d1d5db; border-radius: 20px; color: #6b7280; cursor: pointer; }
    .add-type-form { display: inline-flex; align-items: center; gap: 4px; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 100; }
    .add-emp-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 320px; background: #fff; border-radius: 12px; padding: 20px; z-index: 101; box-shadow: 0 16px 40px rgba(0,0,0,0.2); }
    .add-emp-modal h3 { font-size: 16px; font-weight: 700; color: var(--agb-navy); margin: 0 0 16px; }
    .emp-name-input { --background: #f9fafb; --border-radius: 8px; --padding-start: 12px; margin-bottom: 16px; }
    .default-label { display: block; font-size: 12px; font-weight: 600; color: var(--agb-dark-gray); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
    .type-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .labour-card { margin: 12px 16px; transition: all var(--agb-transition-fast); }
    .labour-card:active { transform: scale(0.98); }
    .labour-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .labour-party { font-size: 16px; font-weight: 600; color: var(--agb-navy); margin: 0 0 4px; }
    .labour-site { font-size: 13px; color: var(--agb-gray); margin: 0; }
    .labour-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; padding: 12px; background: var(--agb-off-white); border-radius: var(--agb-radius-md); }
    .stat { text-align: center; }
    .stat-value { font-size: 16px; font-weight: 700; color: var(--agb-navy); display: block; }
    .stat-label { font-size: 10px; color: var(--agb-gray); text-transform: uppercase; }
    .labour-footer { display: flex; justify-content: space-between; align-items: center; }
    .labour-date { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--agb-gray); }
    ion-fab-button { --background: var(--agb-primary); --color: var(--agb-white); }
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
  addingTypeFor = signal<string | null>(null);
  newLabourType = '';

  async ngOnInit(): Promise<void> {
    addIcons({ addOutline, peopleOutline, timeOutline, personAddOutline, checkmarkOutline });
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
            this.isLoading.set(false);
          },
          error: (err) => {
            console.error('[Labour] failed to load', err);
            this.labour.set([]);
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

  onTabChange() { this.searchQuery = ''; }
  onSearch() { /* handled by computed */ }

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

  saveNewEmployee() {
    if (!this.newEmployeeName.trim()) return;
    this.showAddEmployee = false;
    this.newEmployeeName = '';
    this.newEmployeeTypes = [];
  }

  startAddType(empName: string) {
    this.addingTypeFor.set(empName);
    this.newLabourType = '';
  }

  addLabourType(empName: string) {
    if (!this.newLabourType.trim()) return;
    const emp = this.employees().find((e) => e.name === empName);
    if (emp && !emp.labourTypes.includes(this.newLabourType.trim())) {
      emp.labourTypes.push(this.newLabourType.trim());
    }
    this.addingTypeFor.set(null);
    this.newLabourType = '';
  }

  viewLabour(entry: Labour): void { this.router.navigate(['/tabs/labour', entry._id]); }
  createLabour(): void { this.router.navigate(['/tabs/labour/create']); }

  getStatusColor(status: LabourStatus): string {
    return status === 'Pending' ? 'warning' : status === 'Approved' ? 'success' : 'danger';
  }
}