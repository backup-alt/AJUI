import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../core/api.service";
import { ErpDataService } from "../../data/erp-data.service";

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
  totalDays?: number;
  totalWorkers?: number;
  totalEmployees?: number;
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
        </div>
      </div>

      @if (loading()) {
        <div class="settings-w11-empty"><p>Loading sites…</p></div>
      } @else {
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
                  <span>{{ s.startDate }} → {{ s.targetEndDate }}</span>
                </div>
              </div>
              <div class="settings-w11-site-stats">
                <div class="settings-w11-stat">
                  <span class="settings-w11-stat-value">{{ s.totalDays ?? '—' }}</span>
                  <span class="settings-w11-stat-label">Days</span>
                </div>
                <div class="settings-w11-stat">
                  <span class="settings-w11-stat-value">{{ s.totalWorkers ?? 0 }}</span>
                  <span class="settings-w11-stat-label">Workers</span>
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
      }
    </section>

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

        <div class="settings-w11-drawer-body">
          <dl class="settings-w11-dl">
            <div><dt>Address</dt><dd>{{ selected()!.address }}</dd></div>
            <div><dt>Supervisor</dt><dd>{{ selected()!.supervisor }}</dd></div>
            <div><dt>Start Date</dt><dd>{{ selected()!.startDate }}</dd></div>
            <div><dt>Target End</dt><dd>{{ selected()!.targetEndDate }}</dd></div>
          </dl>
          <h3 class="settings-w11-drawer-h3">Linked Projects</h3>
          <div class="settings-w11-proj-list">
            @for (p of selected()!.projectNames; track p) {
              <span class="settings-w11-proj-chip">{{ p }}</span>
            }
          </div>
        </div>
      </aside>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSitesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly erp = inject(ErpDataService);

  readonly activeStatus = signal<"all" | SiteStatus>("all");
  readonly search = signal("");
  readonly selected = signal<Site | null>(null);
  readonly loading = signal(false);

  readonly sites = signal<Site[]>([]);

  readonly filteredSites = computed<Site[]>(() => {
    const s = this.activeStatus();
    const q = this.search().trim().toLowerCase();
    return this.sites().filter((x) => {
      if (s !== "all" && x.status !== s) return false;
      if (!q) return true;
      return x.name.toLowerCase().includes(q) || x.siteId.toLowerCase().includes(q) || x.supervisor.toLowerCase().includes(q);
    });
  });

  ngOnInit() {
    this.loadSites();
  }

  private loadSites() {
    this.loading.set(true);

    // Primary source: derive sites from local projects
    const localSites = this.buildLocalSites();
    this.sites.set(localSites);
    this.loading.set(false);

    // Also fetch remote sites and merge if available
    this.api.listSites().subscribe({
      next: (res) => {
        const remoteItems = (res?.items || []).map((row: any, index: number) => {
          const totalDays = this.computeTotalDays(row.startDate, row.targetEndDate || row.endDate);
          return {
            id: row.id || row._id || `remote-site-${index}`,
            siteId: row.siteId || row.id || `SIT-${String(localSites.length + index + 1).padStart(3, "0")}`,
            name: row.name || row.sites?.[0] || "Unnamed Site",
            status: (row.status || "Active") as SiteStatus,
            supervisor: row.supervisor || "—",
            startDate: row.startDate || "Not available",
            targetEndDate: row.targetEndDate || row.endDate || "Not available",
            projectNames: row.projectNames || (row.name ? [row.name] : []),
            address: row.address || "Not available",
            totalDays,
            totalWorkers: typeof row.totalWorkers === "number" ? row.totalWorkers : undefined,
            totalEmployees: typeof row.totalEmployees === "number" ? row.totalEmployees : undefined,
          };
        });
        // Merge: local first, then remote (dedup by name)
        const merged = [...localSites];
        for (const r of remoteItems) {
          if (!merged.some((m) => m.name === r.name)) merged.push(r);
        }
        this.sites.set(merged);
      },
      error: () => {
        // Keep local-only
      },
    });
  }

  private computeTotalDays(start: string | undefined, end: string | undefined): number | undefined {
    if (!start || !end) return undefined;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return undefined;
    const diff = Math.max(0, endDate.getTime() - startDate.getTime());
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }

  private buildLocalSites(): Site[] {
    const projects = this.erp.projects();
    const users = this.erp.users();
    const supervisors = this.erp.supervisors();
    const seen = new Set<string>();
    const out: Site[] = [];
    let counter = 1;
    for (const p of projects) {
      for (const siteName of p.sites || []) {
        const key = siteName.toLowerCase();
        if (seen.has(key)) {
          const existing = out.find((s) => s.name.toLowerCase() === key);
          if (existing && !existing.projectNames.includes(p.name)) {
            existing.projectNames.push(p.name);
          }
          continue;
        }
        seen.add(key);
        const totalDays = this.computeTotalDays(p.startDate, undefined);
        const siteSupervisors = supervisors.filter(
          (s: any) => (s.site || "").toLowerCase() === key
        ).length;
        const siteEmployees = users.filter(
          (u: any) => (u.site || "").toLowerCase() === key
        ).length;
        out.push({
          id: `local-site-${counter++}`,
          siteId: `SIT-${String(counter).padStart(3, "0")}`,
          name: siteName,
          status: (p.status === "Completed" ? "Completed" : p.status === "On Hold" ? "On Hold" : "Active") as SiteStatus,
          supervisor: p.supervisor || "—",
          startDate: p.startDate || "Not available",
          targetEndDate: "Not available",
          projectNames: [p.name],
          address: p.address || "Not available",
          totalDays,
          totalWorkers: siteSupervisors,
          totalEmployees: siteEmployees,
        });
      }
    }
    return out;
  }

  countByStatus(status: SiteStatus): number {
    return this.sites().filter((s) => s.status === status).length;
  }

  select(s: Site) {
    this.selected.set(s);
  }
  close() {
    this.selected.set(null);
  }
}
