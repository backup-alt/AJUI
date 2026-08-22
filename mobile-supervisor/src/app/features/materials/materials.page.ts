import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  IonContent,
  IonSearchbar,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  cubeOutline,
  timeOutline,
  chevronForwardOutline,
  chevronDownOutline,
  businessOutline,
  cloudOfflineOutline,
  refreshOutline,
} from 'ionicons/icons';
import { SupervisorService } from '../../core/services/supervisor.service';
import { Material } from '../../shared/models';
import { DatePipe } from '@angular/common';
import {
  PageHeaderComponent,
  EmptyStateComponent,
} from '../../shared/components';

interface ConsolidatedMaterial {
  key: string;
  name: string;
  unit: string;
  totalConsumed: number;
  projectNames: string[];
  items: Material[];
}

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonSearchbar,
    IonIcon,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    DatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <ion-content class="materials-content">
      <ion-refresher slot="fixed" (ionRefresh)="refreshMaterials($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <app-page-header
        title="Inventory"
        subtitle="Consumed quantities and consumption logs."
      >
        <span actions class="count-chip">{{ consolidatedMaterials().length }} item{{ consolidatedMaterials().length === 1 ? '' : 's' }}</span>
      </app-page-header>

      <div class="filter-stack">
        <ion-searchbar
          placeholder="Search by material, project, vendor"
          [ngModel]="searchQuery"
          (ngModelChange)="onSearchChange($event)"
          class="search"
        ></ion-searchbar>
      </div>

      <div class="cards">
        @if (errorMessage()) {
          <div class="error-state">
            <ion-icon name="cloud-offline-outline" class="error-icon"></ion-icon>
            <span class="error-title">Something went wrong</span>
            <span class="error-text">{{ errorMessage() }}</span>
            <button class="retry-btn" (click)="loadMaterials()">
              <ion-icon name="refresh-outline"></ion-icon>
              Retry
            </button>
          </div>
        } @else if (isLoading() && materials().length === 0) {
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width: 60%; height: 18px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 80%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 40%; height: 14px; margin-top: 8px;"></ion-skeleton-text>
            </div>
          }
        } @else if (consolidatedMaterials().length === 0) {
          <app-empty-state
            icon="cube-outline"
            [title]="searchQuery ? 'No matches' : 'No consumption logs yet'"
            [message]="searchQuery
              ? 'No consumption logs match your search.'
              : 'Consumed material entries will appear here.'"
          ></app-empty-state>
        } @else {
          @for (group of consolidatedMaterials(); track group.key) {
            <div class="material-group" [class.expanded]="expandedKey() === group.key">
              <button class="material-card" (click)="toggleGroup(group)">
                <header class="material-head">
                  <span class="material-tile">
                    <ion-icon name="cube-outline"></ion-icon>
                  </span>
                  <div class="material-info">
                    <h3 class="material-name">{{ group.name }}</h3>
                    <p class="material-site">
                      <ion-icon name="business-outline"></ion-icon>
                      <span class="site-text">{{ group.projectNames.slice(0, 2).join(', ') }}{{ group.projectNames.length > 2 ? ' +' + (group.projectNames.length - 2) : '' }}</span>
                    </p>
                  </div>
                  <ion-icon class="expand-chevron" name="chevron-down-outline"></ion-icon>
                </header>

                <div class="material-stats">
                  <div class="stat consumed">
                    <div class="stat-label">Consumed</div>
                    <div class="stat-value">{{ group.totalConsumed }} {{ group.unit }}</div>
                  </div>
                </div>

                <footer class="material-footer">
                  <div class="material-date">
                    <ion-icon name="time-outline"></ion-icon>
                    {{ group.items[0].requestDate | date:'MMM d, yyyy' }}
                  </div>
                  <span class="view-link">
                    {{ expandedKey() === group.key ? 'Collapse' : 'View ' + group.items.length + ' entries' }}
                    <ion-icon [name]="expandedKey() === group.key ? 'chevron-down-outline' : 'chevron-forward-outline'"></ion-icon>
                  </span>
                </footer>
              </button>

              @if (expandedKey() === group.key) {
                <div class="group-breakdown">
                  @for (item of group.items; track item._id) {
                    <div class="breakdown-item">
                      <div class="breakdown-info">
                        <span class="breakdown-site">{{ item.projectName }}</span>
                        <span class="breakdown-project">{{ item.vendor || 'Vendor not recorded' }}</span>
                      </div>
                      <div class="breakdown-stats">
                        <span class="breakdown-qty">{{ item.consumedQuantity || 0 }} {{ item.unit }} consumed</span>
                      </div>
                      <div class="consumption-log">
                        <div class="consumption-log-title">Consumption logs</div>
                        @if (loadingConsumptionKeys().has(item._id)) {
                          <div class="consumption-empty">Loading logs...</div>
                        } @else if (item.consumptionHistory?.length) {
                          @for (log of item.consumptionHistory; track $index) {
                            <div class="consumption-entry">
                              <span>{{ log.quantity }} {{ item.unit }}</span>
                              <time>{{ log.date | date:'MMM d, yyyy, h:mm a' }}</time>
                            </div>
                          }
                        } @else {
                          <div class="consumption-empty">No consumption recorded.</div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        }
      </div>

      <ion-infinite-scroll
        threshold="160px"
        [disabled]="!nextCursor() || isLoading() || isLoadingMore()"
        (ionInfinite)="loadMoreMaterials($event)"
      >
        <ion-infinite-scroll-content loadingSpinner="dots"></ion-infinite-scroll-content>
      </ion-infinite-scroll>
    </ion-content>
  `,
  styles: [`
    .materials-content { --background: var(--m3-surface); }
    .count-chip {
      display: inline-flex; align-items: center;
      background: rgba(0, 34, 99, 0.08);
      color: var(--m3-primary);
      font-size: 11px;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 999px;
    }
    .filter-stack { padding: 0 var(--md-space-4) var(--md-space-2); }
    .search { --background: var(--m3-surface-bright); padding: 0; }
    .seg-wrap { padding: 4px 4px 6px; }
    .filter-row { display: flex; align-items: center; gap: var(--md-space-3); }
    .stock-filter {
      flex: 1;
      min-width: 0;
      min-height: 38px;
      --background: var(--m3-surface-bright);
      --padding-start: var(--md-space-3);
      --padding-end: var(--md-space-3);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      font-size: 12px;
      color: var(--m3-on-surface-variant);
    }

    .cards { padding: var(--md-space-3) var(--md-space-4) 96px; }
    .material-group { margin-bottom: var(--md-space-3); }
    .material-card {
      width: 100%;
      text-align: left;
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-5);
      box-shadow: var(--md-elevation-1);
      cursor: pointer;
      font-family: inherit;
      transition: transform var(--md-motion-duration-short1) var(--md-motion-easing-standard),
                  box-shadow var(--md-motion-duration-short1) var(--md-motion-easing-standard);
      display: block;
    }
    .material-group.expanded .material-card {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom: none;
    }
    .material-card:active { transform: scale(0.99); }

    .material-head { display: flex; align-items: center; gap: 14px; margin-bottom: 0; }
    .material-tile {
      width: 48px; height: 48px;
      border-radius: var(--md-radius-lg);
      background: rgba(220, 38, 38, 0.08);
      color: var(--m3-error);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .material-tile ion-icon { font-size: 22px; }
    .material-info { flex: 1; min-width: 0; }
    .material-name { font-size: 16px; font-weight: 700; color: var(--m3-on-surface); margin: 0 0 4px; }
    .material-site {
      font-size: 13px; color: var(--m3-on-surface-muted); margin: 0;
      display: inline-flex; align-items: center; gap: 5px;
      max-width: 100%;
    }
    .material-site ion-icon { font-size: 13px; flex-shrink: 0; }
    .site-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .expand-chevron {
      font-size: 18px;
      color: var(--m3-on-surface-muted);
      transition: transform 200ms ease;
      flex-shrink: 0;
    }
    .material-group.expanded .expand-chevron { transform: rotate(180deg); }

    .material-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: var(--md-space-4);
      margin-top: var(--md-space-2);
    }
    .low-stock-flag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 3px 7px;
      background: rgba(245, 158, 11, 0.14);
      color: #b45309;
      border-radius: 999px;
    }
    .low-stock-flag ion-icon { font-size: 12px; }

    .material-stats {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
      background: var(--m3-surface-container);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-lg);
      padding: 14px 12px;
      margin-bottom: var(--md-space-4);
    }
    .stat { text-align: center; }
    .stat-label { font-size: 11px; color: var(--m3-on-surface-muted); text-transform: uppercase; letter-spacing: 0.3px; }
    .stat-value { font-size: 15px; font-weight: 700; color: var(--m3-on-surface); margin-top: 3px; }
    .stat.highlight .stat-value { color: var(--m3-success); }
    .stat.consumed .stat-value { color: var(--m3-error); }

    .material-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 2px; }
    .material-date { display: flex; align-items: center; gap: 5px; font-size: 13px; color: var(--m3-on-surface-muted); }
    .material-date ion-icon { font-size: 14px; }
    .view-link { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 700; color: var(--m3-primary); }
    .view-link ion-icon { font-size: 15px; }

    .group-breakdown {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-top: none;
      border-bottom-left-radius: var(--md-radius-xl);
      border-bottom-right-radius: var(--md-radius-xl);
      overflow: hidden;
    }
    .breakdown-item {
      width: 100%;
      display: flex; align-items: center; gap: 12px;
      padding: var(--md-space-4) var(--md-space-5);
      border-bottom: 1px solid var(--m3-outline-variant);
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      transition: background 120ms ease;
      flex-wrap: wrap;
    }
    .breakdown-item:last-child { border-bottom: none; }
    .breakdown-item:active { background: var(--m3-surface-container); }
    .breakdown-info { flex: 1; min-width: 0; text-align: left; }
    .breakdown-site { display: block; font-size: 14px; font-weight: 600; color: var(--m3-on-surface); }
    .breakdown-project { font-size: 12px; color: var(--m3-on-surface-muted); margin-top: 2px; }
    .breakdown-stats { display: flex; align-items: center; gap: 10px; }
    .breakdown-qty { font-size: 14px; font-weight: 600; color: var(--m3-on-surface); }
    .breakdown-chevron { font-size: 16px; color: var(--m3-on-surface-muted); }
    .consumption-log {
      width: 100%;
      margin-top: 4px;
      padding: 10px 12px;
      border-radius: var(--md-radius-md);
      background: var(--m3-surface-container);
      text-align: left;
    }
    .consumption-log-title {
      margin-bottom: 6px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: var(--m3-on-surface-muted);
    }
    .consumption-entry {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;
      font-size: 12px;
      font-weight: 700;
      color: var(--m3-on-surface);
    }
    .consumption-entry time { font-weight: 500; color: var(--m3-on-surface-muted); }
    .consumption-empty { font-size: 12px; color: var(--m3-on-surface-muted); }

    .skeleton-card {
      background: var(--m3-surface-bright);
      border: 1px solid var(--m3-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: var(--md-space-4);
      margin-bottom: var(--md-space-2);
    }

    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--md-space-8) var(--md-space-4);
      text-align: center;
    }
    .error-icon { font-size: 48px; color: var(--m3-error); opacity: 0.7; margin-bottom: var(--md-space-3); }
    .error-title { font-size: 16px; font-weight: 700; color: var(--m3-on-surface); margin-bottom: var(--md-space-1); }
    .error-text { font-size: 13px; color: var(--m3-on-surface-muted); margin-bottom: var(--md-space-4); max-width: 280px; }
    .retry-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 20px; border-radius: var(--md-radius-pill);
      background: var(--m3-primary); color: var(--m3-on-primary);
      border: none; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .retry-btn ion-icon { font-size: 16px; }

    ion-fab-button { --background: var(--m3-primary); --color: var(--m3-on-primary); }
  `],
})
export class MaterialsPage implements OnInit {
  private destroyRef = inject(DestroyRef);
  private supervisor = inject(SupervisorService);

  materials = signal<Material[]>([]);
  consolidatedMaterials = signal<ConsolidatedMaterial[]>([]);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  errorMessage = signal<string>('');
  expandedKey = signal<string>('');
  loadingConsumptionKeys = signal<Set<string>>(new Set());
  nextCursor = signal<string | null>(null);
  searchQuery = '';
  private loadGeneration = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    addIcons({
      cubeOutline, timeOutline, chevronForwardOutline, chevronDownOutline, businessOutline,
      cloudOfflineOutline, refreshOutline,
    });
    await this.supervisor.init().catch(() => {});
    await this.loadMaterials();

    this.supervisor.siteChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.loadMaterials());

    if (typeof window !== 'undefined') {
      window.addEventListener('agb:inventory-changed', this.handleInventoryChange);
    }

    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('agb:inventory-changed', this.handleInventoryChange);
      }
    });
  }

  private handleInventoryChange = (): void => {
    void this.loadMaterials(true);
  };

  async loadMaterials(force = false): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    const gen = ++this.loadGeneration;
    try {
      const projectId = this.supervisor.selectedProjectId();
      const response = await firstValueFrom(
        this.supervisor.getMaterials({
          projectId: projectId || undefined,
          status: 'Approved',
          receivedOnly: true,
          view: 'inventory',
          limit: 100,
          search: this.searchQuery.trim() || undefined,
        }, force)
      );
      if (gen !== this.loadGeneration) return;
      this.materials.set(response?.materials || []);
      this.nextCursor.set(response?.pagination?.nextCursor ?? null);
      this.filterMaterials();
      this.isLoading.set(false);
    } catch (error) {
      if (gen !== this.loadGeneration) return;
      console.error('[Materials] failed to load', error);
      this.errorMessage.set((error as Error)?.message || 'Failed to load materials');
      this.filterMaterials();
      this.isLoading.set(false);
    }
  }

  async loadMoreMaterials(event: CustomEvent): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.isLoadingMore()) {
      (event.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }

    this.isLoadingMore.set(true);
    try {
      const response = await firstValueFrom(
        this.supervisor.getMaterials({
          projectId: this.supervisor.selectedProjectId() || undefined,
          status: 'Approved',
          receivedOnly: true,
          view: 'inventory',
          limit: 100,
          cursor,
          search: this.searchQuery.trim() || undefined,
        })
      );
      const existing = this.materials();
      const existingIds = new Set(existing.map((material) => material._id));
      const appended = (response?.materials || []).filter((material) => !existingIds.has(material._id));
      this.materials.set([...existing, ...appended]);
      this.nextCursor.set(response?.pagination?.nextCursor ?? null);
      this.filterMaterials();
    } catch (error) {
      console.error('[Materials] failed to load next page', error);
    } finally {
      this.isLoadingMore.set(false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    }
  }

  async refreshMaterials(event: CustomEvent): Promise<void> {
    await this.loadMaterials(true);
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 300);
  }

  onSearchChange(value: string): void {
    this.searchQuery = value || '';
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadMaterials(true), 350);
  }

  filterMaterials(): void {
    this.consolidatedMaterials.set(this.consolidateByName(this.materials()));
  }

  private consolidateByName(materials: Material[]): ConsolidatedMaterial[] {
    const map = new Map<string, ConsolidatedMaterial>();
    const inventoryKeys = new Set(
      materials
        .filter((material) => material._id === material.materialId)
        .map((material) => this.normalizedMaterialName(material.name))
    );

    for (const m of materials) {
      if (!m.name) continue;
      const key = this.normalizedMaterialName(m.name);
      if (!key) continue;
      if (inventoryKeys.has(key) && m._id !== m.materialId) continue;
      const existing = map.get(key);
      if (existing) {
        existing.totalConsumed += m.consumedQuantity ?? 0;
        if (!existing.projectNames.includes(m.projectName)) {
          existing.projectNames.push(m.projectName);
        }
        existing.items.push(m);
      } else {
        map.set(key, {
          key,
          name: m.name.trim(),
          unit: m.unit,
          totalConsumed: m.consumedQuantity ?? 0,
          projectNames: [m.projectName],
          items: [m],
        });
      }
    }

    const latestActivity = (group: ConsolidatedMaterial): number => Math.max(
      ...group.items.map((item) => new Date(item.updatedAt || item.requestDate).getTime())
    );
    return Array.from(map.values()).sort((a, b) => latestActivity(b) - latestActivity(a));
  }

  private normalizedMaterialName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  toggleGroup(group: ConsolidatedMaterial): void {
    if (this.expandedKey() === group.key) {
      this.expandedKey.set('');
    } else {
      this.expandedKey.set(group.key);
      void this.loadConsumptionLogs(group.items);
    }
  }

  private async loadConsumptionLogs(items: Material[]): Promise<void> {
    const pending = items.filter(
      (item) => (item.consumedQuantity || 0) > 0
        && item.consumptionHistory === undefined
        && !this.loadingConsumptionKeys().has(item._id)
    );
    if (pending.length === 0) return;

    this.loadingConsumptionKeys.update((current) => new Set([
      ...current,
      ...pending.map((item) => item._id),
    ]));

    const detailResults = await Promise.all(pending.map(async (item) => {
      try {
        const response = await firstValueFrom(this.supervisor.getMaterialDetail(item._id));
        return [item._id, response.material.consumptionHistory || []] as const;
      } catch {
        return [item._id, [] as NonNullable<Material['consumptionHistory']>] as const;
      }
    }));
    const histories = new Map(detailResults);

    this.materials.update((current) => current.map((item) =>
      histories.has(item._id)
        ? { ...item, consumptionHistory: histories.get(item._id) }
        : item
    ));
    this.filterMaterials();
    this.loadingConsumptionKeys.update((current) => {
      const next = new Set(current);
      for (const item of pending) next.delete(item._id);
      return next;
    });
  }

}
