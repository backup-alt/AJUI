import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ErpDataService } from "../../data/erp-data.service";

@Component({
  selector: "agb-settings-supervisors",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Supervisors</strong>
      </nav>
      <div class="settings-w11-header-row">
        <div>
          <h1>Supervisors</h1>
          <p>Field supervisors registered via QR invite. Add new supervisors to your team.</p>
        </div>
        <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="openAddSupervisor()">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
          Add Supervisor
        </button>
      </div>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-toolbar">
        <div class="settings-w11-tabs" role="tablist">
          <button type="button" role="tab" [class.active]="activeStatus() === 'all'" (click)="activeStatus.set('all')">
            All <span class="settings-w11-tab-count">{{ supervisors().length }}</span>
          </button>
          <button type="button" role="tab" [class.active]="activeStatus() === 'Active'" (click)="activeStatus.set('Active')">
            Active <span class="settings-w11-tab-count">{{ countByStatus('Active') }}</span>
          </button>
          <button type="button" role="tab" [class.active]="activeStatus() === 'On Leave'" (click)="activeStatus.set('On Leave')">
            On Leave <span class="settings-w11-tab-count">{{ countByStatus('On Leave') }}</span>
          </button>
          <button type="button" role="tab" [class.active]="activeStatus() === 'Inactive'" (click)="activeStatus.set('Inactive')">
            Inactive <span class="settings-w11-tab-count">{{ countByStatus('Inactive') }}</span>
          </button>
        </div>
        <div class="settings-w11-toolbar-right">
          <input
            type="text"
            class="settings-w11-search-input"
            placeholder="Search supervisors"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
          />
        </div>
      </div>

      <div class="settings-w11-table-wrap">
        <table class="settings-w11-table">
          <thead>
            <tr>
              <th>Supervisor</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Assigned Project</th>
              <th>Assigned Site</th>
              <th>Cash Limit</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of filteredSupervisors(); track s.supervisorId) {
              <tr (click)="select(s)" class="settings-w11-row-clickable">
                <td>
                  <div class="settings-w11-name-cell">
                    <span class="settings-w11-avatar">{{ initials(s.name) }}</span>
                    <div>
                      <strong>{{ s.name }}</strong>
                      <small>{{ s.supervisorId }}</small>
                    </div>
                  </div>
                </td>
                <td>{{ s.phone }}</td>
                <td>{{ s.email }}</td>
                <td>{{ s.assignedProject || '—' }}</td>
                <td>{{ s.assignedSite || '—' }}</td>
                <td>₹{{ s.cashLimit | number:'1.0-0' }}</td>
                <td><span class="settings-w11-status-pill" [attr.data-status]="s.status.toLowerCase().replace(' ', '-')">{{ s.status }}</span></td>
                <td class="settings-w11-actions-cell">
                  <button type="button" class="settings-w11-icon-btn" (click)="select(s); $event.stopPropagation()" aria-label="Open details">
                    <svg viewBox="0 0 16 16"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="settings-w11-empty-row">No supervisors match your search.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    @if (selected()) {
      <div class="settings-w11-drawer-backdrop" (click)="close()" aria-hidden="true"></div>
      <aside class="settings-w11-drawer" role="dialog" aria-label="Supervisor details">
        <header class="settings-w11-drawer-head">
          <div class="settings-w11-drawer-id">
            <span class="settings-w11-avatar large">{{ initials(selected()!.name) }}</span>
            <div>
              <h2>{{ selected()!.name }}</h2>
              <small>{{ selected()!.supervisorId }}</small>
            </div>
          </div>
          <button type="button" class="settings-w11-icon-btn" (click)="close()" aria-label="Close">
            <svg viewBox="0 0 16 16"><path d="m4 4 8 8 M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </header>

        <div class="settings-w11-drawer-body">
          <h3 class="settings-w11-drawer-h3">Profile</h3>
          <dl class="settings-w11-dl">
            <div><dt>Phone</dt><dd>{{ selected()!.phone }}</dd></div>
            <div><dt>Email</dt><dd>{{ selected()!.email }}</dd></div>
            <div><dt>Status</dt><dd>{{ selected()!.status }}</dd></div>
            <div><dt>Role</dt><dd>{{ selected()!.role || 'Site Supervisor' }}</dd></div>
            <div><dt>Cash Limit</dt><dd>₹{{ selected()!.cashLimit | number:'1.0-0' }}</dd></div>
            <div><dt>Approval Authority</dt><dd>₹{{ selected()!.approvalAuthority | number:'1.0-0' }}</dd></div>
          </dl>

          <h3 class="settings-w11-drawer-h3">Assigned Projects & Sites</h3>
          <div class="settings-w11-proj-list">
            @if (selected()!.assignedProject) {
              <span class="settings-w11-proj-chip">{{ selected()!.assignedProject }}</span>
            }
            @if (selected()!.assignedSite) {
              <span class="settings-w11-proj-chip">{{ selected()!.assignedSite }}</span>
            }
          </div>

          <h3 class="settings-w11-drawer-h3">Last 10 Submissions</h3>
          <ul class="settings-w11-activity-list">
            <li><span class="dot pending"></span>Labour attendance <small>2h ago</small></li>
            <li><span class="dot approve"></span>Material request <small>yesterday</small></li>
            <li><span class="dot reject"></span>Site expense <small>2 days ago</small></li>
          </ul>
        </div>

        <footer class="settings-w11-drawer-foot">
          <button type="button" class="settings-w11-btn settings-w11-btn-danger-outline" (click)="deactivate()">Deactivate</button>
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="close()">Close</button>
        </footer>
      </aside>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSupervisorsComponent {
  private readonly data = inject(ErpDataService);
  private readonly router = inject(Router);

  readonly activeStatus = signal<"all" | "Active" | "On Leave" | "Inactive">("all");
  readonly search = signal("");
  readonly selected = signal<any | null>(null);

  readonly supervisors = computed<any[]>(() => this.data.supervisors());

  readonly filteredSupervisors = computed<any[]>(() => {
    const s = this.activeStatus();
    const q = this.search().trim().toLowerCase();
    return this.supervisors().filter((x) => {
      if (s !== "all" && x.status !== s) return false;
      if (!q) return true;
      return (
        x.name.toLowerCase().includes(q) ||
        (x.phone && x.phone.toLowerCase().includes(q)) ||
        (x.email && x.email.toLowerCase().includes(q))
      );
    });
  });

  countByStatus(status: string): number {
    return this.supervisors().filter((s) => s.status === status).length;
  }

  initials(name: string): string {
    return (name || "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
  }

  select(s: any) {
    this.selected.set(s);
  }
  close() {
    this.selected.set(null);
  }
  deactivate() {
    const s = this.selected();
    if (!s) return;
    alert(`Supervisor ${s.name} would be deactivated. (UI placeholder)`);
    this.close();
  }

  openAddSupervisor() {
    this.router.navigateByUrl("/settings/roles?addSupervisor=true");
  }
}
