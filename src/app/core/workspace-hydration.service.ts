import { Injectable, inject, signal } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";
import { ErpDataService } from "../data/erp-data.service";
import {
  mapClient,
  mapExpense,
  mapInventory,
  mapInvoice,
  mapLabour,
  mapMaterial,
  mapPayment,
  mapProject,
  mapSite,
  mapSubcontractor,
  mapSupervisor,
  mapVendor,
} from "./mappers";
import { ApiService } from "./api.service";

interface PersistedSnapshot {
  version: number;
  savedAt: number;
  data: {
    materials: any[];
    inventory: any[];
    expenses: any[];
    labour: any[];
    payments: any[];
    subcontractors: any[];
    sites: any[];
    vendors: any[];
    supervisors: any[];
    clients: any[];
    projects: any[];
    taxInvoices: any[];
  };
  cursors: Record<string, string | null>;
  totals: Record<string, number>;
}

const SNAPSHOT_VERSION = 7;
const SNAPSHOT_KEY = "agb-erp:hydrationSnapshotV1";
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PageModule =
  | "materials"
  | "inventory"
  | "expenses"
  | "labour"
  | "payments"
  | "subcontractors"
  | "sites"
  | "invoices";

@Injectable({ providedIn: "root" })
export class WorkspaceHydrationService {
  private readonly api = inject(ApiService);
  private readonly erp = inject(ErpDataService);

  readonly hydrationStatus = signal<"idle" | "loading" | "ready" | "error">("idle");
  readonly hydrationError = signal<string | null>(null);
  readonly loadedModules = signal<Set<string>>(new Set());

  /** Next page number per module, stored as a string for snapshot compatibility. null = no more pages. */
  readonly pageCursors = signal<Record<string, string | null>>({});
  /** Total document count from MongoDB per module. */
  readonly pageTotals = signal<Record<string, number>>({});
  /** True while fetching the next page for a module. */
  readonly loadingNextPage = signal<Record<string, boolean>>({});
  private readonly moduleLoads = new Map<PageModule, Promise<boolean>>();

  private readonly PAGE_SIZE = 25;

  constructor() {
    this.restoreFromSnapshot();
  }

  // =================== PUBLIC API ===================

  /**
   * BLOCKING hydration — called once from app.component on login/refresh.
   * Loads ONLY the first 25 records per module. The dashboard renders
   * immediately with this data; additional pages load on scroll.
   */
  async hydrateFromBackend(): Promise<void> {
    if (this.hydrationStatus() === "loading") {
      return this.waitUntilSettled();
    }
    this.hydrationStatus.set("loading");
    this.hydrationError.set(null);

    try {
      await this.hydrateCritical();
      this.hydrationStatus.set("ready");
      this.loadedModules.update(s => { s.add("critical"); return s; });
      this.persistSnapshot();
      console.log(
        `[hydrateFromBackend] critical OK — clients=${this.erp.clients().length}, projects=${this.erp.projects().length}, vendors=${this.erp.vendors().length}`
      );
      // Fire-and-forget: load first page of remaining modules in background.
      this.hydrateModulesFirstPage();
    } catch (err: any) {
      console.error("[hydrateFromBackend] failed:", err?.message ?? err);
      this.hydrationStatus.set("error");
      this.hydrationError.set(err?.message ?? String(err));
    }
  }

  /**
   * Load first page of a module on demand. Returns immediately if
   * already loaded or in-flight.
   */
  async loadModule(module: PageModule): Promise<void> {
    if (this.loadedModules().has(module)) return;

    let load = this.moduleLoads.get(module);
    if (!load) {
      load = this.loadFirstPageByModule(module);
      this.moduleLoads.set(module, load);
    }

    try {
      const loaded = await load;
      if (!loaded) return;
      this.loadedModules.update((modules) => new Set([...modules, module]));
      this.persistSnapshot();
      console.log(`[loadModule] ${module} loaded`);
    } catch (err: any) {
      console.warn(`[loadModule] ${module} failed:`, err?.message ?? err);
    } finally {
      if (this.moduleLoads.get(module) === load) this.moduleLoads.delete(module);
    }
  }

  /**
   * Load the NEXT page for a module. Appends items to the
   * existing signal. Called by infinite scroll when the user reaches
   * the bottom of the table.
   */
  async loadNextPage(module: PageModule): Promise<void> {
    const cursors = this.pageCursors();
    const nextCursor = cursors[module];
    // Already at the end — no more pages
    if (nextCursor === null || nextCursor === undefined) return;
    // Already loading — don't fire a duplicate
    if (this.loadingNextPage()[module]) return;

    this.loadingNextPage.update(s => ({ ...s, [module]: true }));
    try {
      const result = await this.fetchPage(module, nextCursor);
      if (!result) return;

      const mapped = result.items.map(this.mapperForModule(module));
      // Append to existing data
      const signal = this.signalForModule(module);
      signal.set(this.appendUniqueRows(signal(), mapped));

      // Update cursor and total
      this.pageCursors.update(s => ({ ...s, [module]: result.nextCursor ?? null }));
      this.pageTotals.update(s => ({ ...s, [module]: result.total }));

      console.log(
        `[loadNextPage] ${module}: appended ${mapped.length} items, nextPage=${result.nextCursor ?? "end"}, total=${result.total}`
      );
    } catch (err: any) {
      console.warn(`[loadNextPage] ${module} failed:`, err?.message ?? err);
    } finally {
      this.loadingNextPage.update(s => ({ ...s, [module]: false }));
    }
  }

  isModuleLoaded(module: string): boolean {
    return this.loadedModules().has(module);
  }

  hasMorePages(module: string): boolean {
    const cursor = this.pageCursors()[module];
    return cursor !== null && cursor !== undefined;
  }

  getTotalCount(module: string): number {
    return this.pageTotals()[module] ?? 0;
  }

  private refreshingInFlight: Promise<void> | null = null;

  async refreshFromBackend(): Promise<void> {
    if (this.refreshingInFlight) return this.refreshingInFlight;

    this.refreshingInFlight = (async () => {
      try {
        // Reset all cursors and totals
        this.pageCursors.set({});
        this.pageTotals.set({});
        await this.hydrateCritical();
        await this.hydrateModulesFirstPage();
        this.persistSnapshot();
      } catch (err: any) {
        console.warn("[refreshFromBackend] failed (signals preserved):", err?.message ?? err);
      } finally {
        this.refreshingInFlight = null;
      }
    })();

    return this.refreshingInFlight;
  }

  invalidateCache(): void {
    try {
      this.api.invalidateCache();
      localStorage.removeItem(SNAPSHOT_KEY);
      this.loadedModules.set(new Set());
      this.moduleLoads.clear();
      this.pageCursors.set({});
      this.pageTotals.set({});
      this.erp.resetCustomFieldsLoaded();
    } catch {}
  }

  // =================== PRIVATE: FIRST PAGE LOADS ===================

  /**
   * Load critical data (clients, projects, vendors, supervisors) —
   * first page only (25 records). Fast (4 parallel requests).
   */
  private async hydrateCritical(): Promise<void> {
    const [clients, projects, vendors, supervisors] = await Promise.all([
      this.safeList(() => this.api.listClients({ limit: this.PAGE_SIZE }), "clients"),
      this.safeList(() => this.api.listProjects({ limit: this.PAGE_SIZE }), "projects"),
      this.safeList(() => this.api.listVendors({ limit: this.PAGE_SIZE }), "vendors"),
      this.safeList(() => this.api.listSupervisors({ limit: this.PAGE_SIZE }), "supervisors"),
    ]);

    if (projects) {
      const mappedProjects = (projects.items || []).map(mapProject);
      const projectIds = new Set(mappedProjects.map((p: any) => String(p.id)));
      const businessIdToProjectId = new Map(
        mappedProjects.map((p: any) => [String(p.projectId || p.id), String(p.id)])
      );
      this.replaceIfLarger(this.erp.projects, mappedProjects, "projects");
      this.pageTotals.update(s => ({ ...s, projects: projects.total ?? 0 }));

      if (clients) {
        const mappedClients = (clients.items || []).map(mapClient).map((client) => ({
          ...client,
          projectIds: (client.projectIds || [])
            .map((pid) => businessIdToProjectId.get(String(pid)) || String(pid))
            .filter((pid) => projectIds.has(pid)),
        }));
        this.replaceIfLarger(this.erp.clients, mappedClients, "clients");
        this.pageTotals.update(s => ({ ...s, clients: clients.total ?? 0 }));
      }
    }

    if (vendors) {
      this.replaceIfLarger(this.erp.vendors, (vendors.items || []).map(mapVendor), "vendors");
      this.pageTotals.update(s => ({ ...s, vendors: vendors.total ?? 0 }));
    }
    if (supervisors) {
      this.replaceIfLarger(
        this.erp.supervisors,
        (supervisors.items || []).map(mapSupervisor),
        "supervisors"
      );
    }
  }

  /**
   * Load first page of remaining modules in background.
   * Each module is independent — failure in one doesn't block others.
   */
  private async hydrateModulesFirstPage(): Promise<void> {
    const modules: PageModule[] = [
      "sites", "labour", "payments", "subcontractors", "invoices",
      "materials", "expenses", "inventory",
    ];
    for (const mod of modules) {
      await this.loadModule(mod);
    }
  }

  /**
   * Fetch and set the first page (limit=25) for a module. Stores the
   * next page and total count for infinite scroll.
   */
  private async loadFirstPageByModule(module: PageModule): Promise<boolean> {
    const result = await this.fetchPage(module, undefined);
    if (!result) return false;

    const mapped = result.items.map(this.mapperForModule(module));
    const signal = this.signalForModule(module);
    this.replaceIfLarger(signal, mapped, module);

    this.pageCursors.update(s => ({ ...s, [module]: result.nextCursor ?? null }));
    this.pageTotals.update(s => ({ ...s, [module]: result.total }));

    console.log(
      `[loadFirstPage] ${module}: ${mapped.length} items, total=${result.total}, nextPage=${result.nextCursor ?? "end"}`
    );
    return true;
  }

  /**
   * Fetch a single page from a module's list endpoint.
   * Returns null on failure.
   */
  private async fetchPage(
    module: PageModule,
    pageToken: string | undefined
  ): Promise<{ items: any[]; nextCursor: string | null; total: number } | null> {
    const factory = this.apiFactoryForModule(module);
    if (!factory) return null;
    const page = Math.max(Number(pageToken || 1) || 1, 1);

    if (module === "expenses") {
      const [siteResponse, generalResponse] = await Promise.all([
        this.safeList(
          () => this.api.listExpenses({ limit: this.PAGE_SIZE, page, type: "site" }),
          "expenses/site/page"
        ),
        this.safeList(
          () => this.api.listExpenses({ limit: this.PAGE_SIZE, page, type: "general" }),
          "expenses/general/page"
        ),
      ]);
      if (!siteResponse && !generalResponse) return null;

      const siteItems = ((siteResponse as any)?.items || []);
      const generalItems = ((generalResponse as any)?.items || []);
      const siteTotal = (siteResponse as any)?.total ?? 0;
      const generalTotal = (generalResponse as any)?.total ?? 0;
      const sitePages = (siteResponse as any)?.pages ?? 0;
      const generalPages = (generalResponse as any)?.pages ?? 0;
      const nextPage = page < Math.max(sitePages, generalPages) ? String(page + 1) : null;
      return {
        items: [...siteItems, ...generalItems],
        nextCursor: nextPage,
        total: siteTotal + generalTotal,
      };
    }

    const response = await this.safeList(
      () => factory({ limit: this.PAGE_SIZE, page }),
      `${module}/page`
    );
    if (!response) return null;

    const items = (response as any)?.items || [];
    const responsePage = (response as any)?.page ?? page;
    const pages = (response as any)?.pages ?? 0;
    const nextCursor = responsePage < pages ? String(responsePage + 1) : null;
    const total = (response as any)?.total ?? 0;
    return { items, nextCursor, total };
  }

  // =================== PRIVATE: HELPERS ===================

  private apiFactoryForModule(module: PageModule): ((opts: any) => import("rxjs").Observable<any>) | null {
    const map: Record<string, (opts: any) => import("rxjs").Observable<any>> = {
      materials: (opts) => this.api.listMaterials(opts),
      inventory: (opts) => this.api.listInventory(opts),
      expenses: (opts) => this.api.listExpenses(opts),
      labour: (opts) => this.api.listLabour(opts),
      payments: (opts) => this.api.listPayments(opts),
      subcontractors: (opts) => this.api.listSubcontractors(opts),
      sites: () => this.api.listSites(),
      invoices: (opts) => this.api.listInvoices(opts),
    };
    return map[module] ?? null;
  }

  private mapperForModule(module: PageModule): (row: any) => any {
    const map: Record<string, (row: any) => any> = {
      materials: mapMaterial,
      inventory: mapInventory,
      expenses: mapExpense,
      labour: mapLabour,
      payments: mapPayment,
      subcontractors: mapSubcontractor,
      sites: mapSite,
      invoices: mapInvoice,
    };
    return map[module] ?? ((r: any) => r);
  }

  private signalForModule(module: PageModule): { set(value: any[]): void; (): any[] } {
    const map: Record<string, { set(value: any[]): void; (): any[] }> = {
      materials: this.erp.materials,
      inventory: this.erp.inventory,
      expenses: this.erp.expenses,
      labour: this.erp.labour,
      payments: this.erp.payments,
      subcontractors: this.erp.subcontractors,
      sites: this.erp.siteEntities,
      invoices: this.erp.taxInvoices,
    };
    return map[module];
  }

  private replaceIfLarger<T>(
    target: { set(value: T[]): void; (): T[] },
    newRows: T[],
    label: string
  ): void {
    if (!Array.isArray(newRows)) return;
    const existing = target();
    if (existing.length === 0 || newRows.length >= existing.length) {
      target.set(newRows);
    } else {
      console.warn(
        `[hydrate] ${label}: existing has ${existing.length} rows, new fetch returned only ${newRows.length} — keeping existing`
      );
    }
  }

  private appendUniqueRows<T extends Record<string, any>>(existing: T[], next: T[]): T[] {
    const seen = new Set(existing.map((row) => String(row.id || row._id || "")));
    const uniqueNext = next.filter((row) => {
      const key = String(row.id || row._id || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...existing, ...uniqueNext];
  }

  private persistSnapshot(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const snapshot: PersistedSnapshot = {
        version: SNAPSHOT_VERSION,
        savedAt: Date.now(),
        data: {
          materials: this.erp.materials(),
          inventory: this.erp.inventory(),
          expenses: this.erp.expenses(),
          labour: this.erp.labour(),
          payments: this.erp.payments(),
          subcontractors: this.erp.subcontractors(),
          sites: this.erp.siteEntities(),
          vendors: this.erp.vendors(),
          supervisors: this.erp.supervisors(),
          clients: this.erp.clients(),
          projects: this.erp.projects(),
          taxInvoices: this.erp.taxInvoices(),
        },
        cursors: this.pageCursors(),
        totals: this.pageTotals(),
      };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn("[hydrate] persistSnapshot failed (non-fatal):", err);
    }
  }

  private restoreFromSnapshot(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as PersistedSnapshot;
      if (snap.version !== SNAPSHOT_VERSION) {
        // Version mismatch — clear old snapshot
        localStorage.removeItem(SNAPSHOT_KEY);
        return;
      }
      if (Date.now() - snap.savedAt > SNAPSHOT_MAX_AGE_MS) {
        localStorage.removeItem(SNAPSHOT_KEY);
        return;
      }
      const d = snap.data;
      if (Array.isArray(d.materials) && d.materials.length) this.erp.materials.set(d.materials);
      if (Array.isArray(d.inventory) && d.inventory.length) this.erp.inventory.set(d.inventory);
      if (Array.isArray(d.expenses) && d.expenses.length) this.erp.expenses.set(d.expenses);
      if (Array.isArray(d.labour) && d.labour.length) this.erp.labour.set(d.labour);
      if (Array.isArray(d.payments) && d.payments.length) this.erp.payments.set(d.payments);
      if (Array.isArray(d.subcontractors) && d.subcontractors.length) this.erp.subcontractors.set(d.subcontractors);
      if (Array.isArray(d.sites) && d.sites.length) this.erp.siteEntities.set(d.sites);
      if (Array.isArray(d.vendors) && d.vendors.length) this.erp.vendors.set(d.vendors);
      if (Array.isArray(d.supervisors) && d.supervisors.length) this.erp.supervisors.set(d.supervisors);
      if (Array.isArray(d.clients) && d.clients.length) this.erp.clients.set(d.clients);
      if (Array.isArray(d.projects) && d.projects.length) this.erp.projects.set(d.projects);
      if (Array.isArray(d.taxInvoices) && d.taxInvoices.length) this.erp.taxInvoices.set(d.taxInvoices);
      // Restore cursor and total state
      if (snap.cursors) this.pageCursors.set(snap.cursors);
      if (snap.totals) this.pageTotals.set(snap.totals);
      // Mark restored modules as loaded
      const restored = new Set<string>(["critical", "sites", "labour", "payments", "subcontractors", "invoices"]);
      if (d.materials.length) restored.add("materials");
      if (d.inventory.length) restored.add("inventory");
      if (d.expenses.length) restored.add("expenses");
      this.loadedModules.set(restored);
      console.log(
        `[hydrate] restored snapshot from ${new Date(snap.savedAt).toISOString()} — materials=${d.materials.length}, inventory=${d.inventory.length}, expenses=${d.expenses.length}`
      );
    } catch (err) {
      console.warn("[hydrate] restoreFromSnapshot failed (non-fatal):", err);
    }
  }

  private async waitUntilSettled(): Promise<void> {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const status = this.hydrationStatus();
      if (status === "ready" || status === "error") return;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private async safeList<T>(
    factory: () => import("rxjs").Observable<T>,
    label: string
  ): Promise<T | null> {
    try {
      return await firstValueFrom(
        factory().pipe(timeout({ each: 60_000, meta: `hydration.${label}` }))
      );
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const isTimeout = err?.name === "TimeoutError" || /timeout/i.test(err?.message || "");
      const message = err?.error?.error || err?.error?.message || err?.message || String(err);
      console.warn(
        `[WorkspaceHydration] ${label} failed — ${isTimeout ? "TIMEOUT" : `status=${status}`}: ${message}`
      );
      return null;
    }
  }
}
