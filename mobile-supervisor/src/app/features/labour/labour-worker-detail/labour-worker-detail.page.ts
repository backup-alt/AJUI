import { Component, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonIcon,
  IonSkeletonText,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  personOutline,
  briefcaseOutline,
  calendarOutline,
  walletOutline,
  timeOutline,
  locationOutline,
  callOutline,
  businessOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  alertCircleOutline,
  constructOutline,
  buildOutline,
  flashOutline,
  cutOutline,
  homeOutline,
  gridOutline,
  colorPaletteOutline,
  hammerOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../../core/services/supervisor.service';
import { Worker, Attendance } from '../../../shared/models';
import { DatePipe, CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';

type Tab = 'info' | 'attendance' | 'wage';

interface WageCalculation {
  weeklyPay: number;
  dailyPay: number;
  daysWorked: number;
  totalShifts: number;
  overtimeHours: number;
  lateFineTotal: number;
  netPay: number;
}

@Component({
  selector: 'app-labour-worker-detail',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonIcon,
    IonSkeletonText,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    DatePipe,
    CurrencyPipe,
    FormsModule,
    EmptyStateComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/labour"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ worker()?.name || 'Worker Details' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="worker-detail-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (isLoading()) {
        <div class="skeleton-wrap">
          <div class="skeleton-header">
            <ion-skeleton-text animated style="width: 80px; height: 80px; border-radius: 50%;"></ion-skeleton-text>
            <div style="flex:1">
              <ion-skeleton-text animated style="width: 60%; height: 20px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 40%; height: 16px; margin-top: 8px;"></ion-skeleton-text>
            </div>
          </div>
          <div class="skeleton-section">
            @for (i of [1,2,3]; track i) {
              <ion-skeleton-text animated style="width: 100%; height: 60px; margin-bottom: 8px;"></ion-skeleton-text>
            }
          </div>
        </div>
      } @else if (!worker()) {
        <div class="empty-state">
          <ion-icon name="person-outline"></ion-icon>
          <h3>Worker not found</h3>
          <p>This worker may have been removed.</p>
        </div>
      } @else {
        <!-- Profile Header -->
        <div class="profile-header">
          <div class="avatar-wrap">
            <div class="avatar" [class]="'avatar-' + getLabourColor(worker()!.labourType)">
              {{ getInitials(worker()!.name) }}
            </div>
            <div class="status-dot" [class]="'status-' + getStatusColor(worker()!.labourType)"></div>
          </div>
          <div class="profile-info">
            <h1 class="profile-name">{{ worker()!.name }}</h1>
            <p class="profile-type">
              <ion-icon [name]="getLabourIcon(worker()!.labourType)"></ion-icon>
              {{ worker()!.labourType }}
            </p>
            <p class="profile-site">
              <ion-icon name="location-outline"></ion-icon>
              {{ worker()!.site }}
            </p>
          </div>
        </div>

        <!-- Tab Bar -->
        <div class="tab-bar">
          <ion-segment [(ngModel)]="activeTab" mode="ios">
            <ion-segment-button value="info">
              <ion-label>Info</ion-label>
            </ion-segment-button>
            <ion-segment-button value="attendance">
              <ion-label>Attendance</ion-label>
            </ion-segment-button>
            <ion-segment-button value="wage">
              <ion-label>Wage</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>

        <!-- Info Tab -->
        @if (activeTab === 'info') {
          <div class="tab-content">
            <section class="info-section">
              <h2 class="section-title">Personal Information</h2>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-icon"><ion-icon name="person-outline"></ion-icon></span>
                  <div class="info-data">
                    <span class="info-label">Name</span>
                    <span class="info-value">{{ worker()!.name }}</span>
                  </div>
                </div>
                <div class="info-row">
                  <span class="info-icon"><ion-icon name="construct-outline"></ion-icon></span>
                  <div class="info-data">
                    <span class="info-label">Labour Type</span>
                    <span class="info-value">{{ worker()!.labourType }}</span>
                  </div>
                </div>
                <div class="info-row">
                  <span class="info-icon"><ion-icon name="business-outline"></ion-icon></span>
                  <div class="info-data">
                    <span class="info-label">Site</span>
                    <span class="info-value">{{ worker()!.site }}</span>
                  </div>
                </div>
                <div class="info-row">
                  <span class="info-icon"><ion-icon name="shield-checkmark-outline"></ion-icon></span>
                  <div class="info-data">
                    <span class="info-label">Worker ID</span>
                    <span class="info-value mono">{{ worker()!.workerId }}</span>
                  </div>
                </div>
                @if (worker()!.address) {
                  <div class="info-row">
                    <span class="info-icon"><ion-icon name="location-outline"></ion-icon></span>
                    <div class="info-data">
                      <span class="info-label">Address</span>
                      <span class="info-value">{{ worker()!.address }}</span>
                    </div>
                  </div>
                }
              </div>
            </section>

            <section class="info-section">
              <h2 class="section-title">Employment Information</h2>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-icon"><ion-icon name="wallet-outline"></ion-icon></span>
                  <div class="info-data">
                    <span class="info-label">Weekly Salary</span>
                    <span class="info-value highlight">{{ worker()!.weeklyPay | currency:'INR':'symbol':'1.0-0' }}</span>
                  </div>
                </div>
                <div class="info-row">
                  <span class="info-icon"><ion-icon name="time-outline"></ion-icon></span>
                  <div class="info-data">
                    <span class="info-label">Daily Wage (calculated)</span>
                    <span class="info-value">{{ dailyWage() | currency:'INR':'symbol':'1.0-0' }}</span>
                  </div>
                </div>
                <div class="info-row">
                  <span class="info-icon"><ion-icon name="briefcase-outline"></ion-icon></span>
                  <div class="info-data">
                    <span class="info-label">Shift Type</span>
                    <span class="info-value">Day Shift</span>
                  </div>
                </div>
                @if (worker()!.isSubcontract && worker()!.subcontractorName) {
                  <div class="info-row highlight-row">
                    <span class="info-icon"><ion-icon name="business-outline"></ion-icon></span>
                    <div class="info-data">
                      <span class="info-label">Subcontractor</span>
                      <span class="info-value">{{ worker()!.subcontractorName }}</span>
                    </div>
                  </div>
                }
              </div>
            </section>
          </div>
        }

        <!-- Attendance Tab -->
        @if (activeTab === 'attendance') {
          <div class="tab-content">
            <div class="attendance-summary">
              <div class="summary-stat">
                <span class="stat-value">{{ attendanceDays().length }}</span>
                <span class="stat-label">Days Worked</span>
              </div>
              <div class="summary-stat">
                <span class="stat-value">{{ totalShifts() }}</span>
                <span class="stat-label">Total Shifts</span>
              </div>
              <div class="summary-stat">
                <span class="stat-value">{{ totalOvertime() }}h</span>
                <span class="stat-label">Overtime</span>
              </div>
              <div class="summary-stat">
                <span class="stat-value">{{ totalLateFines() | currency:'INR':'symbol':'1.0-0' }}</span>
                <span class="stat-label">Late Fines</span>
              </div>
            </div>

            @if (groupedAttendance().length === 0) {
              <app-empty-state
                icon="calendar-outline"
                title="No attendance yet"
                message="Mark attendance to see the worker's history here."
              ></app-empty-state>
            } @else {
              <div class="attendance-log">
                @for (week of groupedAttendance(); track week.weekLabel) {
                  <div class="week-group">
                    <div class="week-header">{{ week.weekLabel }}</div>
                    @for (day of week.days; track day.attendanceId) {
                      <div class="att-day" [class]="'att-' + day.status.toLowerCase()">
                        <div class="day-header">
                          <span class="day-name">{{ day.dayName }}</span>
                          <span class="day-status" [class]="'status-' + day.status.toLowerCase()">
                            {{ day.status }}
                          </span>
                        </div>
                        <div class="day-details">
                          @if (day.status === 'Present') {
                            <span class="shifts">Shift {{ day.shiftCount }}</span>
                            @if (day.overtimeHours > 0) {
                              <span class="ot">+{{ day.overtimeHours }}h OT</span>
                            }
                            @if (day.lateFine > 0) {
                              <span class="late">-{{ day.lateFine | currency:'INR':'symbol':'1.0-0' }} late</span>
                            }
                          } @else {
                            <span class="absent-reason">Absent</span>
                          }
                        </div>
                        <div class="day-date">{{ day.attendanceDate | date:'MMM d' }}</div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Wage Tab -->
        @if (activeTab === 'wage') {
          <div class="tab-content">
            <div class="wage-card">
              <h2 class="wage-title">Weekly Wage Breakdown</h2>

              <div class="wage-input-group">
                <label>Weekly Salary (INR)</label>
                <div class="wage-input-row">
                  <span class="currency">₹</span>
                  <input
                    type="number"
                    [value]="weeklyPayInput()"
                    (input)="onWeeklyPayChange($event)"
                    class="wage-input"
                    placeholder="Enter weekly wage"
                  />
                </div>
              </div>

              <div class="wage-divider"></div>

              <div class="wage-row">
                <span class="wage-label">Daily Wage</span>
                <span class="wage-value">{{ calculatedWage().dailyPay | currency:'INR':'symbol':'1.0-0' }}</span>
              </div>
              <div class="wage-row">
                <span class="wage-label">Days Worked</span>
                <span class="wage-value">{{ calculatedWage().daysWorked }}</span>
              </div>
              <div class="wage-row">
                <span class="wage-label">Total Shifts</span>
                <span class="wage-value">{{ calculatedWage().totalShifts }}</span>
              </div>
              <div class="wage-row">
                <span class="wage-label">Overtime Hours</span>
                <span class="wage-value">{{ calculatedWage().overtimeHours }}h</span>
              </div>
              <div class="wage-row fine">
                <span class="wage-label">Late Fine</span>
                <span class="wage-value">-{{ calculatedWage().lateFineTotal | currency:'INR':'symbol':'1.0-0' }}</span>
              </div>

              <div class="wage-divider"></div>

              <div class="wage-row net">
                <span class="wage-label">Net Weekly Pay</span>
                <span class="wage-value net-value">{{ calculatedWage().netPay | currency:'INR':'symbol':'1.0-0' }}</span>
              </div>
            </div>

            <div class="wage-rules">
              <h3>Wage Calculation Rules</h3>
              <ul>
                <li>One shift = <strong>50%</strong> of daily wage</li>
                <li>Two shifts = <strong>100%</strong> of daily wage (full day)</li>
                <li>Overtime is added on top of base wage</li>
                <li>Late fine is deducted from net pay</li>
              </ul>
              <div class="formula">
                <strong>Formula:</strong><br/>
                Net = Attendance Pay + Overtime − Late Fine<br/>
                Attendance Pay = Days × (Shifts/Day × Daily Wage/2)
              </div>
            </div>
          </div>
        }
      }
    </ion-content>
  `,
  styles: [`
    .worker-detail-content { --background: var(--m3-surface); }

    .skeleton-wrap { padding: var(--md-space-4); }
    .skeleton-header {
      display: flex;
      align-items: center;
      gap: var(--md-space-4);
      margin-bottom: var(--md-space-6);
    }
    .skeleton-section {
      background: var(--m3-surface-bright);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px var(--md-space-4);
      text-align: center;
    }
    .empty-state ion-icon { font-size: 64px; color: var(--m3-on-surface-muted); opacity: 0.4; }
    .empty-state h3 { font-size: 18px; font-weight: 700; color: var(--m3-on-surface); margin: 16px 0 4px; }
    .empty-state p { font-size: 14px; color: var(--m3-on-surface-muted); margin: 0; }

    /* Profile Header */
    .profile-header {
      display: flex;
      align-items: center;
      gap: var(--md-space-4);
      padding: var(--md-space-3) var(--md-space-4);
      background: var(--m3-primary);
      background-image: linear-gradient(135deg, var(--m3-primary) 0%, #003380 100%);
      color: var(--m3-on-primary);
    }
    .avatar-wrap { position: relative; }
    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 800;
      border: 3px solid rgba(255,255,255,0.25);
    }
    .avatar.avatar-carpenter { background: rgba(249, 115, 22, 0.25); color: #fed7aa; }
    .avatar.avatar-plumber { background: rgba(34, 197, 94, 0.25); color: #bbf7d0; }
    .avatar.avatar-electrician { background: rgba(234, 179, 8, 0.25); color: #fef08a; }
    .avatar.avatar-mason { background: rgba(168, 85, 247, 0.25); color: #e9d5ff; }
    .avatar.avatar-helper { background: rgba(14, 165, 233, 0.25); color: #bae6fd; }
    .avatar.avatar-painter { background: rgba(236, 72, 153, 0.25); color: #fbcfe8; }
    .avatar.avatar-steelfixer { background: rgba(156, 163, 175, 0.25); color: #d1d5db; }
    .avatar.avatar-tiles { background: rgba(245, 158, 11, 0.25); color: #fde68a; }
    .avatar.avatar-welder { background: rgba(239, 68, 68, 0.25); color: #fecaca; }
    .avatar.avatar-default { background: rgba(201, 162, 39, 0.25); color: #fef3c7; }
    .status-dot {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2.5px solid var(--m3-primary);
    }
    .status-dot.status-active { background: var(--m3-success); }
    .status-dot.status-inactive { background: var(--m3-on-surface-muted); }

    .profile-info { flex: 1; min-width: 0; }
    .profile-name {
      font-size: 20px;
      font-weight: 800;
      color: var(--m3-on-primary);
      margin: 0 0 4px;
      letter-spacing: -0.2px;
    }
    .profile-type {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.8);
      margin: 0 0 2px;
    }
    .profile-type ion-icon { font-size: 14px; }
    .profile-site {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      margin: 0;
    }
    .profile-site ion-icon { font-size: 12px; }

    /* Tab Bar */
    .tab-bar {
      padding: var(--md-space-3) var(--md-space-4);
      background: var(--m3-surface-bright);
    }
    .tab-bar ion-segment {
      --background: var(--m3-surface-container);
      border-radius: var(--md-radius-lg);
      padding: 3px;
    }
    .tab-bar ion-segment-button {
      --padding-top: 8px;
      --padding-bottom: 8px;
      min-height: 36px;
      font-size: 13px;
      font-weight: 600;
    }

    .tab-content { padding: var(--md-space-4); }

    /* Info Tab */
    .info-section { margin-bottom: var(--md-space-5); }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--m3-on-surface-muted);
      margin: 0 0 var(--md-space-3);
    }
    .info-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      overflow: hidden;
    }
    .info-row {
      display: flex;
      align-items: center;
      gap: var(--md-space-3);
      padding: var(--md-space-3) var(--md-space-4);
      border-bottom: 1px solid var(--m3-outline-variant);
    }
    .info-row:last-child { border-bottom: none; }
    .info-row.highlight-row { background: var(--m3-secondary-container); }
    .info-icon {
      width: 36px;
      height: 36px;
      border-radius: var(--md-radius-md);
      background: var(--m3-surface-container);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .info-icon ion-icon { font-size: 18px; color: var(--m3-on-surface-variant); }
    .info-row.highlight-row .info-icon { background: var(--m3-secondary); }
    .info-row.highlight-row .info-icon ion-icon { color: var(--m3-on-secondary); }
    .info-data { flex: 1; }
    .info-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: var(--m3-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: var(--m3-on-surface);
      margin-top: 2px;
    }
    .info-value.highlight { color: var(--m3-primary); font-size: 16px; font-weight: 800; }
    .info-value.mono { font-family: var(--m3-font-mono); font-size: 12px; }

    /* Attendance Tab */
    .attendance-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--md-space-2);
      margin-bottom: var(--md-space-4);
    }
    .summary-stat {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-3);
      text-align: center;
    }
    .stat-value {
      display: block;
      font-size: 18px;
      font-weight: 800;
      color: var(--m3-primary);
    }
    .stat-label {
      display: block;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: var(--m3-on-surface-muted);
      margin-top: 2px;
    }

    .attendance-log { }
    .week-group { margin-bottom: var(--md-space-4); }
    .week-header {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--m3-on-surface-muted);
      margin-bottom: var(--md-space-2);
      padding-left: 2px;
    }
    .att-day {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-3) var(--md-space-4);
      margin-bottom: var(--md-space-2);
    }
    .att-day.att-present { border-left: 3px solid var(--m3-success); }
    .att-day.att-absent { border-left: 3px solid var(--m3-error); opacity: 0.75; }
    .att-day.att-late { border-left: 3px solid var(--m3-warning); }

    .day-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .day-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--m3-on-surface);
    }
    .day-status {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .status-present { background: var(--m3-success-container); color: var(--m3-on-success-container); }
    .status-absent { background: var(--m3-error-container); color: var(--m3-on-error-container); }
    .status-late { background: var(--m3-warning-container); color: var(--m3-on-warning-container); }

    .day-details {
      display: flex;
      align-items: center;
      gap: var(--md-space-2);
      flex-wrap: wrap;
    }
    .shifts, .ot, .late, .absent-reason {
      font-size: 11px;
      font-weight: 600;
    }
    .shifts { color: var(--m3-primary); }
    .ot { color: var(--m3-success); }
    .late { color: var(--m3-error); }
    .absent-reason { color: var(--m3-on-surface-muted); }

    .day-date {
      font-size: 10px;
      color: var(--m3-on-surface-muted);
      margin-top: 4px;
    }

    /* Wage Tab */
    .wage-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-5);
      margin-bottom: var(--md-space-4);
    }
    .wage-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 var(--md-space-4);
    }
    .wage-input-group { margin-bottom: var(--md-space-4); }
    .wage-input-group label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--m3-on-surface-muted);
      margin-bottom: var(--md-space-2);
    }
    .wage-input-row {
      display: flex;
      align-items: center;
      background: var(--m3-surface-container);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-3) var(--md-space-4);
      gap: var(--md-space-2);
    }
    .currency {
      font-size: 20px;
      font-weight: 800;
      color: var(--m3-primary);
    }
    .wage-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      font-size: 22px;
      font-weight: 800;
      color: var(--m3-on-surface);
      font-family: inherit;
      width: 100%;
    }
    .wage-input::placeholder { color: var(--m3-outline); }
    .wage-divider {
      height: 1px;
      background: var(--m3-outline-variant);
      margin: var(--md-space-4) 0;
    }
    .wage-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--md-space-2) 0;
    }
    .wage-row.fine .wage-value { color: var(--m3-error); }
    .wage-row.net {
      padding-top: var(--md-space-3);
    }
    .wage-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--m3-on-surface-variant);
    }
    .wage-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--m3-on-surface);
    }
    .net-value {
      font-size: 20px;
      font-weight: 800;
      color: var(--m3-primary);
    }

    .wage-rules {
      background: var(--m3-surface-container);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
    }
    .wage-rules h3 {
      font-size: 13px;
      font-weight: 700;
      color: var(--m3-on-surface);
      margin: 0 0 var(--md-space-3);
    }
    .wage-rules ul {
      margin: 0 0 var(--md-space-4);
      padding-left: var(--md-space-5);
      color: var(--m3-on-surface-variant);
      font-size: 13px;
    }
    .wage-rules li { margin-bottom: var(--md-space-2); }
    .formula {
      background: var(--m3-primary-container);
      border-radius: var(--md-radius-lg);
      padding: var(--md-space-3) var(--md-space-4);
      font-size: 12px;
      color: var(--m3-on-primary-container);
      line-height: 1.6;
    }
    .formula strong { font-weight: 700; }

    /* Ionic empty state */
    :host ::ng-deep app-empty-state {
      display: block;
      padding: 24px 0;
    }
  `],
})
export class LabourWorkerDetailPage implements OnInit {
  private supervisor = inject(SupervisorService);
  private route = inject(ActivatedRoute);
  private toastCtrl = inject(ToastController);

  worker = signal<Worker | null>(null);
  attendance = signal<Attendance[]>([]);
  isLoading = signal(true);
  activeTab: Tab = 'info';
  weeklyPayInput = signal<number>(0);

  dailyWage = computed(() => {
    const w = this.worker();
    if (!w) return 0;
    return Math.round(w.weeklyPay / 7);
  });

  attendanceDays = computed(() => this.attendance());

  totalShifts = computed(() =>
    this.attendance().reduce((sum, a) => sum + a.shiftCount, 0)
  );

  totalOvertime = computed(() =>
    this.attendance().reduce((sum, a) => sum + a.overtimeHours, 0)
  );

  totalLateFines = computed(() =>
    this.attendance().reduce((sum, a) => sum + a.lateFine, 0)
  );

  calculatedWage = computed<WageCalculation>(() => {
    const weekly = this.weeklyPayInput() || this.worker()?.weeklyPay || 0;
    const daily = Math.round(weekly / 7);
    const attendances = this.attendance();
    let daysWorked = 0;
    let totalShifts = 0;

    for (const a of attendances) {
      if (a.status === 'Present' || (a as any).attendanceStatus === 'Present') {
        daysWorked++;
        totalShifts += a.shiftCount;
      }
    }

    const wageForShifts = daily * 0.5 * totalShifts;
    const overtimeAmt = this.totalOvertime() * (daily * 0.5);
    const net = Math.max(0, wageForShifts + overtimeAmt - this.totalLateFines());

    return {
      weeklyPay: weekly,
      dailyPay: daily,
      daysWorked,
      totalShifts,
      overtimeHours: this.totalOvertime(),
      lateFineTotal: this.totalLateFines(),
      netPay: Math.round(net),
    };
  });

  groupedAttendance = computed(() => {
    const atts = [...this.attendance()].sort(
      (a, b) => b.attendanceDate.localeCompare(a.attendanceDate)
    );

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeks = new Map<string, Attendance[]>();

    for (const a of atts) {
      const d = new Date(a.attendanceDate);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekLabel = weekStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (!weeks.has(weekLabel)) weeks.set(weekLabel, []);
      weeks.get(weekLabel)!.push(a);
    }

    return Array.from(weeks.entries()).map(([weekLabel, days]) => ({
      weekLabel,
      days: days.map((d) => {
        const date = new Date(d.attendanceDate);
        const dayName = date.toLocaleDateString('en-IN', { weekday: 'short' });
        return {
          ...d,
          dayName,
          status: d.shiftCount > 0 ? 'Present' : 'Absent',
        };
      }),
    }));
  });

  private workerId = '';

  async ngOnInit(): Promise<void> {
    addIcons({
      chevronBackOutline, personOutline, briefcaseOutline, calendarOutline,
      walletOutline, timeOutline, locationOutline, callOutline, businessOutline,
      checkmarkCircleOutline, closeCircleOutline, alertCircleOutline,
      constructOutline, buildOutline, flashOutline, cutOutline, homeOutline,
      gridOutline, colorPaletteOutline, hammerOutline,
      sparklesOutline,
    });

    this.workerId = this.route.snapshot.paramMap.get('workerId') || '';
    if (this.workerId) {
      await Promise.all([this.loadWorker(), this.loadAttendance()]);
    }
  }

  async refresh(event: CustomEvent): Promise<void> {
    await Promise.all([this.loadWorker(), this.loadAttendance()]);
    (event.target as HTMLIonRefresherElement).complete();
  }

  private async loadWorker(): Promise<void> {
    console.log('[WorkerDetail] Loading worker:', this.workerId);
    this.supervisor.getWorkerDetail(this.workerId).subscribe({
      next: (res) => {
        console.log('[WorkerDetail] Worker loaded:', res.worker);
        this.worker.set(res.worker);
        this.weeklyPayInput.set(res.worker.weeklyPay);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('[WorkerDetail] Error loading worker:', err);
        this.worker.set(null);
        this.isLoading.set(false);
      },
    });
  }

  private async loadAttendance(): Promise<void> {
    console.log('[WorkerDetail] Loading attendance for worker:', this.workerId);
    this.supervisor.getAttendanceForWorker(this.workerId).subscribe({
      next: (res) => {
        console.log('[WorkerDetail] Attendance loaded:', res.items?.length || 0, 'records');
        this.attendance.set(res.items || []);
      },
      error: (err) => {
        console.error('[WorkerDetail] Error loading attendance:', err);
        this.attendance.set([]);
      },
    });
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getLabourIcon(type: string): string {
    const icons: Record<string, string> = {
      'Carpenter': 'construct-outline',
      'Plumber': 'build-outline',
      'Electrician': 'flash-outline',
      'Painter': 'colorPalette-outline',
      'Mason': 'ersh-outline',
      'Helper': 'hammer-outline',
      'Steel Fixer': 'car-outline',
      'Tiles Worker': 'grid-outline',
      'Welder': 'sparkles-outline',
      'Civil': 'home-outline',
    };
    return icons[type] || 'briefcase-outline';
  }

  getLabourColor(type: string): string {
    const colors: Record<string, string> = {
      'Carpenter': 'carpenter',
      'Plumber': 'plumber',
      'Electrician': 'electrician',
      'Painter': 'painter',
      'Mason': 'mason',
      'Helper': 'helper',
      'Steel Fixer': 'steelfixer',
      'Tiles Worker': 'tiles',
      'Welder': 'welder',
      'Civil': 'default',
    };
    return colors[type] || 'default';
  }

  getStatusColor(type: string): string {
    return 'active';
  }

  onWeeklyPayChange(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.weeklyPayInput.set(isNaN(val) ? 0 : val);
  }
}