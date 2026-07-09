import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

type SiteStatus = "Active" | "On Hold" | "Completed";

interface Site {
  id: string;
  siteId: string;
  name: string;
  status: SiteStatus;
  supervisor: string;
  startDate: string;
  targetEndDate: string;
  projectNames: string[];
  address: string;
}

@Component({
  selector: "agb-settings-sites",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Sites Directory</strong>
      </nav>
      <h1>Sites Directory</h1>
      <p>All construction sites, with their supervisors and project links.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-toolbar">
        <div class="settings-w11-tabs" role="tablist">
          <button type="button" role="tab" [class.active]="activeStatus() === 'all'" (click)="activeStatus.set('all')">
            All <span class="settings-w11-tab-count">{{ sites().length }}</span>
          </button>
          <button type="button" role="tab" [class.active]="activeStatus() === 'Active'" (click)="activeStatus.set('Active')">
            Active <span class="settings-w11-tab-count">{{ countByStatus('Active') }}</span>
          </button>
          <button type="button" role="tab" [class.active]="activeStatus() === 'On Hold'" (click)="activeStatus.set('On Hold')">
            On Hold <span class="settings-w11-tab-count">{{ countByStatus('On Hold') }}</span>
          </button>
          <button type="button" role="tab" [class.active]="activeStatus() === 'Completed'" (click)="activeStatus.set('Completed')">
            Completed <span class="settings-w11-tab-count">{{ countByStatus('Completed') }}</span>
          </button>
        </div>
        <div class="settings-w11-toolbar-right">
          <input
            type="text"
            class="settings-w11-search-input"
            placeholder="Search sites"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
          />
          <button type="button" class="settings-w11-btn settings-w11-btn-ghost" disabled title="Sites are created via the mobile app">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10 M3 8h10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
            Add Site
          </button>
        </div>
      </div>

      <div class="settings-w11-site-grid">
        @for (s of filteredSites(); track s.id) {
          <article class="settings-w11-site-card" (click)="select(s)" tabindex="0" (keydown.enter)="select(s)">
            <header class="settings-w11-site-card-head">
              <small class="settings-w11-site-id">{{ s.siteId }}</small>
              <span class="settings-w11-status-pill" [attr.data-status]="s.status.toLowerCase().replace(' ', '-')">{{ s.status }}</span>
            </header>
            <h3>{{ s.name }}</h3>
            <div class="settings-w11-site-projects">
              @for (p of s.projectNames; track p) {
                <span class="settings-w11-proj-chip">{{ p }}</span>
              }
            </div>
            <div class="settings-w11-site-meta">
              <div class="settings-w11-site-row">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M13 14s-1-4-5-4-5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>{{ s.supervisor }}</span>
              </div>
              <div class="settings-w11-site-row">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2 M3 6h10v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z M6 9h4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>{{ formatDate(s.startDate) }} → {{ formatDate(s.targetEndDate) }}</span>
              </div>
            </div>
            <footer class="settings-w11-site-card-foot">
              <span>View details →</span>
            </footer>
          </article>
        } @empty {
          <div class="settings-w11-empty-grid">No sites match your search.</div>
        }
      </div>
    </section>

    <!-- Detail drawer -->
    @if (selected()) {
      <div class="settings-w11-drawer-backdrop" (click)="close()" aria-hidden="true"></div>
      <aside class="settings-w11-drawer wide" role="dialog" aria-label="Site details">
        <header class="settings-w11-drawer-head">
          <div>
            <small class="settings-w11-site-id">{{ selected()!.siteId }}</small>
            <h2>{{ selected()!.name }}</h2>
            <span class="settings-w11-status-pill" [attr.data-status]="selected()!.status.toLowerCase().replace(' ', '-')">{{ selected()!.status }}</span>
          </div>
          <button type="button" class="settings-w11-icon-btn" (click)="close()" aria-label="Close">
            <svg viewBox="0 0 16 16"><path d="m4 4 8 8 M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </header>

        <nav class="settings-w11-drawer-tabs" role="tablist">
          <button type="button" role="tab" [class.active]="drawerTab() === 'overview'" (click)="drawerTab.set('overview')">Overview</button>
          <button type="button" role="tab" [class.active]="drawerTab() === 'activity'" (click)="drawerTab.set('activity')">Activity</button>
          <button type="button" role="tab" [class.active]="drawerTab() === 'reports'" (click)="drawerTab.set('reports')">Reports</button>
        </nav>

        <div class="settings-w11-drawer-body">
          @if (drawerTab() === 'overview') {
            <dl class="settings-w11-dl">
              <div><dt>Address</dt><dd>{{ selected()!.address }}</dd></div>
              <div><dt>Supervisor</dt><dd>{{ selected()!.supervisor }}</dd></div>
              <div><dt>Start Date</dt><dd>{{ formatDate(selected()!.startDate) }}</dd></div>
              <div><dt>Target End</dt><dd>{{ formatDate(selected()!.targetEndDate) }}</dd></div>
            </dl>
            <h3 class="settings-w11-drawer-h3">Linked Projects</h3>
            <div class="settings-w11-proj-list">
              @for (p of selected()!.projectNames; track p) {
                <span class="settings-w11-proj-chip">{{ p }}</span>
              }
            </div>
            <div class="settings-w11-stat-row">
              <div><strong>47</strong><small>Active days</small></div>
              <div><strong>128</strong><small>Submissions this month</small></div>
              <div><strong>4</strong><small>Pending approvals</small></div>
            </div>
          }

          @if (drawerTab() === 'activity') {
            <ul class="settings-w11-activity-list">
              <li><span class="dot approve"></span>Labour attendance submitted <small>2h ago</small></li>
              <li><span class="dot pending"></span>Material request pending review <small>4h ago</small></li>
              <li><span class="dot approve"></span>Site expense approved <small>yesterday</small></li>
              <li><span class="dot login"></span>Supervisor checked in <small>2 days ago</small></li>
            </ul>
          }

          @if (drawerTab() === 'reports') {
            <p class="settings-w11-drawer-hint">Site-specific reports will appear here once available.</p>
          }
        </div>

        <footer class="settings-w11-drawer-foot">
          <button type="button" class="settings-w11-btn settings-w11-btn-ghost" disabled title="Edit coming in next iteration">Edit</button>
          <button type="button" class="settings-w11-btn settings-w11-btn-danger-outline" (click)="archive()">Archive</button>
        </footer>
      </aside>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSitesComponent {
  readonly activeStatus = signal<"all" | SiteStatus>("all");
  readonly search = signal("");
  readonly selected = signal<Site | null>(null);
  readonly drawerTab = signal<"overview" | "activity" | "reports">("overview");

  readonly sites = signal<Site[]>([
    { id: "1", siteId: "SIT-001", name: "Anna Nagar Main Site", status: "Active", supervisor: "Rajesh Kumar", startDate: "2024-01-15", targetEndDate: "2025-12-30", projectNames: ["PRJ-001", "PRJ-002"], address: "12, Anna Nagar Main Rd, Chennai" },
    { id: "2", siteId: "SIT-002", name: "T. Nagar Tower", status: "Active", supervisor: "Murugan R", startDate: "2024-03-20", targetEndDate: "2026-06-15", projectNames: ["PRJ-003"], address: "45, GN Chetty Rd, T. Nagar, Chennai" },
    { id: "3", siteId: "SIT-003", name: "Velachery Phase 2", status: "On Hold", supervisor: "Suresh Babu", startDate: "2024-02-10", targetEndDate: "2025-09-30", projectNames: ["PRJ-004"], address: "Plot 8, Velachery Bypass, Chennai" },
    { id: "4", siteId: "SIT-004", name: "OMR Tech Park", status: "Active", supervisor: "Anitha Kumari", startDate: "2024-05-01", targetEndDate: "2026-01-31", projectNames: ["PRJ-005", "PRJ-006"], address: "OMR, Sholinganallur, Chennai" },
    { id: "5", siteId: "SIT-005", name: "Coimbatore Villa", status: "Completed", supervisor: "Vinoth Kumar", startDate: "2023-06-01", targetEndDate: "2024-12-15", projectNames: ["PRJ-007"], address: "RS Puram, Coimbatore" },
    { id: "6", siteId: "SIT-006", name: "Madurai Commercial", status: "Active", supervisor: "Lakshmi Devi", startDate: "2024-08-15", targetEndDate: "2025-11-30", projectNames: ["PRJ-008"], address: "KK Nagar, Madurai" },
  ]);

  readonly filteredSites = computed<Site[]>(() => {
    const s = this.activeStatus();
    const q = this.search().trim().toLowerCase();
    return this.sites().filter((x) => {
      if (s !== "all" && x.status !== s) return false;
      if (!q) return true;
      return x.name.toLowerCase().includes(q) || x.siteId.toLowerCase().includes(q) || x.supervisor.toLowerCase().includes(q);
    });
  });

  countByStatus(status: SiteStatus): number {
    return this.sites().filter((s) => s.status === status).length;
  }

  formatDate(iso: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  select(s: Site) {
    this.selected.set(s);
    this.drawerTab.set("overview");
  }
  close() {
    this.selected.set(null);
  }
  archive() {
    alert("Site archived. (UI placeholder)");
    this.close();
  }
}
