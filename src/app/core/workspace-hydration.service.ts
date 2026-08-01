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
}

const SNAPSHOT_VERSION = 2;
const SNAPSHOT_KEY = "agb-erp:hydrationSnapshotV1";
/** Persist for 24h — long enough to survive a refresh, short enough that
 *  the user doesn't see truly stale data after a multi-day gap. */
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: "root" })
export class WorkspaceHydrationService {
  private readonly api = inject(ApiService);
  private readonly erp = inject(ErpDataService);

  /**
   * Set to true once hydrateFromBackend() completes successfully (or
   * fails permanently). Dashboard pages can subscribe to this signal
   * and show a spinner until hydration is done. This prevents the
   * "data disappears on refresh" bug where tables render with empty
   * data BEFORE hydration finishes.
   */
  readonly hydrationStatus = signal<"idle" | "loading" | "ready" | "error">("idle");
  readonly hydrationError = signal<string | null>(null);

  /**
   * Track which module datasets have been loaded. Pages check this
   * to decide whether to fetch or use cached data.
   */
  readonly loadedModules = signal<Set<string>>(new Set());

  constructor() {
    // On boot: immediately rehydrate signals from localStorage so the UI
    // never shows an empty state on refresh. The user sees their last-known
    // data within milliseconds while we kick off a fresh backend fetch in
    // the background. When the backend fetch completes, we swap in the
    // fresh data. This is what eliminates the "data disappears on refresh"
    // bug — the data is never gone, it's just stale until refresh.
    this.restoreFromSnapshot();
  }

  /**
   * BLOCKING hydration — call from app.component's ngOnInit. Returns when
   * all collections are loaded (or have failed permanently). UI can show a
   * spinner during this time. Subsequent refreshes from the dashboard's
   * "Refresh" button call refreshFromBackend() which is non-blocking.
   */
  async hydrateFromBackend(): Promise<void> {
    if (this.hydrationStatus() === "loading") {
      // Already in flight — wait for the existing one to settle
      return this.waitUntilSettled();
    }
    this.hydrationStatus.set("loading");
    this.hydrationError.set(null);

    try {
      // Step 1: Load critical data first (clients, projects, vendors,
      // supervisors) — this is fast (4 parallel requests) and needed
      // for navigation dropdowns, project selectors, and sidebar.
      await this.hydrateCritical();

      // Step 2: Mark critical as loaded, set ready — the dashboard can
      // now render with critical data while module data loads lazily.
      this.hydrationStatus.set("ready");
      this.loadedModules.update(s => { s.add("critical"); return s; });
      this.persistSnapshot();
      console.log(
        `[hydrateFromBackend] critical OK — clients=${this.erp.clients().length}, projects=${this.erp.projects().length}, vendors=${this.erp.vendors().length}`
      );

      // Step 3: Load module data in background (non-blocking).
      // Each module is loaded independently — failure in one doesn't
      // block others. Pages that need specific module data call
      // loadModule() themselves.
      this.hydrateModulesBackground();
    } catch (err: any) {
      console.error("[hydrateFromBackend] failed:", err?.message ?? err);
      this.hydrationStatus.set("error");
      this.hydrationError.set(err?.message ?? String(err));
    }
  }

  /**
   * Load a specific module's data on demand. Called by pages when they
   * need data that hasn't been loaded yet. Uses the same cursor-walk
   * logic but only for the requested module.
   *
   * Returns immediately if the module is already loaded or in-flight.
   */
  async loadModule(module: "materials" | "inventory" | "expenses" | "labour" | "payments" | "subcontractors" | "sites" | "invoices"): Promise<void> {
    if (this.loadedModules().has(module)) return;
    // Mark as in-flight immediately to prevent duplicate calls
    this.loadedModules.update(s => { s.add(module); return s; });

    try {
      switch (module) {
        case "materials":
          await this.loadAllByCursor(
            "materials",
            (cursor) => this.api.listMaterials({ limit: 25, cursor }),
            mapMaterial,
            this.erp.materials
          );
          break;
        case "inventory":
          await this.loadAllByCursor(
            "inventory",
            (cursor) => this.api.listInventory({ limit: 25, cursor }),
            mapInventory,
            this.erp.inventory
          );
          break;
        case "expenses":
          await this.loadAllByCursor(
            "expenses",
            (cursor) => this.api.listExpenses({ limit: 25, cursor }),
            mapExpense,
            this.erp.expenses
          );
          break;
        case "labour": {
          const labour = await this.safeList(() => this.api.listLabour({ limit: 25 }), "labour");
          if (labour && Array.isArray(labour.items)) {
            this.replaceIfLarger(this.erp.labour, (labour.items || []).map(mapLabour), "labour");
          }
          break;
        }
        case "payments": {
          const payments = await this.safeList(() => this.api.listPayments({ limit: 25 }), "payments");
          if (payments && Array.isArray(payments.items)) {
            this.replaceIfLarger(this.erp.payments, (payments.items || []).map(mapPayment), "payments");
          }
          break;
        }
        case "subcontractors": {
          const subs = await this.safeList(() => this.api.listSubcontractors({ limit: 25 }), "subcontractors");
          if (subs && Array.isArray(subs.items)) {
            this.replaceIfLarger(this.erp.subcontractors, (subs.items || []).map(mapSubcontractor), "subcontractors");
          }
          break;
        }
        case "sites": {
          const sites = await this.safeList(() => this.api.listSites(), "sites");
          if (sites && Array.isArray(sites.items)) {
            this.replaceIfLarger(this.erp.siteEntities, (sites.items || []).map(mapSite), "sites");
          }
          break;
        }
        case "invoices": {
          const invoices = await this.safeList(() => this.api.listInvoices({ limit: 25 }), "invoices");
          if (invoices && Array.isArray(invoices.items)) {
            this.replaceIfLarger(this.erp.taxInvoices, (invoices.items || []).map(mapInvoice), "invoices");
          }
          break;
        }
      }
      this.persistSnapshot();
      console.log(`[loadModule] ${module} loaded`);
    } catch (err: any) {
      console.warn(`[loadModule] ${module} failed:`, err?.message ?? err);
    }
  }

  /**
   * Check if a module's data has been loaded and is available.
   */
  isModuleLoaded(module: string): boolean {
    return this.loadedModules().has(module);
  }

  /**
   * Refresh the snapshot in the background without blocking the UI. Used
   * by the dashboard's "Refresh" button. Updates signals atomically when
   * each collection finishes — never overwrites good data with empty
   * data on a transient failure.
   */
  async refreshFromBackend(): Promise<void> {
    try {
      // Reuse the same code path as hydrateFromBackend but mark as a
      // background refresh. We DON'T set hydrationStatus to loading
      // here so the UI stays responsive.
      await this.hydrateCritical();
      await this.hydrateModulesBackground();
      this.persistSnapshot();
    } catch (err: any) {
      console.warn("[refreshFromBackend] failed (signals preserved):", err?.message ?? err);
    }
  }

  invalidateCache(): void {
    try {
      localStorage.removeItem(SNAPSHOT_KEY);
      this.loadedModules.set(new Set());
    } catch {}
  }

  // ---------- private helpers ----------

  private async waitUntilSettled(): Promise<void> {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const status = this.hydrationStatus();
      if (status === "ready" || status === "error") return;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  /**
   * Background module hydration — fires after critical data is loaded.
   * Each module loads independently. Pages that need specific data
   * can also call loadModule() directly.
   */
  private async hydrateModulesBackground(): Promise<void> {
    const modules: Array<"sites" | "labour" | "payments" | "subcontractors" | "invoices"> = [
      "sites", "labour", "payments", "subcontractors", "invoices",
    ];
    for (const mod of modules) {
      if (!this.loadedModules().has(mod)) {
        await this.loadModule(mod);
      }
    }
    // Materials, inventory, expenses are NOT pre-loaded — they're
    // loaded on demand when the user opens those pages. This reduces
    // login time and avoids saturating the M0 connection pool.
  }

  private async hydrateCritical(): Promise<void> {
    const [clients, projects, vendors, supervisors] = await Promise.all([
      this.safeList(() => this.api.listClients({ limit: 100 }), "clients"),
      this.safeList(() => this.api.listProjects({ limit: 100 }), "projects"),
      this.safeList(() => this.api.listVendors({ limit: 100 }), "vendors"),
      this.safeList(() => this.api.listSupervisors(), "supervisors"),
    ]);

    if (projects) {
      const mappedProjects = (projects.items || []).map(mapProject);
      const projectIds = new Set(mappedProjects.map((p: any) => String(p.id)));
      const businessIdToProjectId = new Map(
        mappedProjects.map((p: any) => [String(p.projectId || p.id), String(p.id)])
      );
      this.replaceIfLarger(this.erp.projects, mappedProjects, "projects");

      if (clients) {
        const mappedClients = (clients.items || []).map(mapClient).map((client) => ({
          ...client,
          projectIds: (client.projectIds || [])
            .map((pid) => businessIdToProjectId.get(String(pid)) || String(pid))
            .filter((pid) => projectIds.has(pid)),
        }));
        this.replaceIfLarger(this.erp.clients, mappedClients, "clients");
      }
    }

    if (vendors) {
      this.replaceIfLarger(this.erp.vendors, (vendors.items || []).map(mapVendor), "vendors");
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
   * Walk cursor pages to fetch ALL records from a paginated endpoint.
   * Each page fetches up to 25 rows (the max allowed by the schema).
   * Uses `nextCursor` from each response to advance. Stops when the
   * response has no nextCursor or returns an empty items array.
   *
   * Updates the signal atomically with replaceIfLarger so partial
   * failures never wipe out good data the user is already viewing.
   */
  private async loadAllByCursor<T>(
    label: string,
    factory: (cursor: string | undefined) => import("rxjs").Observable<{ items: any[]; nextCursor?: string | null }>,
    mapper: (row: any) => T,
    target: { set(value: T[]): void; (): T[] }
  ): Promise<void> {
    const MAX_PAGES = 40;
    const PAGE_DELAY_MS = 500;
    const allItems: any[] = [];
    let cursor: string | undefined = undefined;
    let pagesFetched = 0;
    let walkCompleted = false; // true if we got a null nextCursor on the last page

    while (pagesFetched < MAX_PAGES) {
      pagesFetched++;
      let response = await this.safeList(
        () => factory(cursor),
        `${label}/page${pagesFetched}`
      );
      // Retry once on failure — M0 cold starts and connection pool
      // exhaustion cause transient failures on the second page.
      if (response === null || response === undefined) {
        console.warn(`[loadAllByCursor] ${label} page ${pagesFetched} failed — retrying in 2s`);
        await new Promise((r) => setTimeout(r, 2000));
        response = await this.safeList(
          () => factory(cursor),
          `${label}/page${pagesFetched}/retry`
        );
      }
      // safeList returned null (timeout/error) — abort the walk
      if (response === null || response === undefined) {
        console.warn(`[loadAllByCursor] ${label} page ${pagesFetched} returned null after retry — aborting walk`);
        break;
      }
      const items = (response as any)?.items;
      const nextCursor = (response as any)?.nextCursor;
      console.log(
        `[loadAllByCursor] ${label} page ${pagesFetched}: items=${Array.isArray(items) ? items.length : "?"} nextCursor=${nextCursor ? "yes" : "no"}`
      );
      if (!Array.isArray(items) || items.length === 0) break;
      allItems.push(...items);
      if (!nextCursor) {
        walkCompleted = true;
        break;
      }
      cursor = String(nextCursor);
      // Small delay between pages to let M0 recover
      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }

    if (allItems.length > 0) {
      const mapped = allItems.map(mapper);
      // If the walk completed all pages (nextCursor was null), ALWAYS
      // replace the signal — even if the new count is smaller than the
      // existing signal. This ensures the final page is applied.
      // If the walk was incomplete (timed out), only replace if we have
      // MORE items than existing (replaceIfLarger guard).
      if (walkCompleted) {
        target.set(mapped);
        console.log(`[loadAllByCursor] ${label}: walk COMPLETED — set ${mapped.length} items`);
      } else {
        this.replaceIfLarger(target, mapped, label);
        console.log(`[loadAllByCursor] ${label}: walk INCOMPLETE — replaceIfLarger with ${mapped.length} items`);
      }
    }
    console.log(`[loadAllByCursor] ${label}: ${allItems.length} items across ${pagesFetched} page(s) (completed=${walkCompleted})`);
  }

  /**
   * Atomic update — only overwrites the signal if the new array has at
   * least as many rows as the existing one. This is what prevents the
   * "partial fetch wipes good data" bug: if M0 returns 10 rows when we
   * already have 50, we keep the 50 and wait for the next attempt.
   *
   * The exception is the very first hydration where the signal is empty
   * (length 0) — then we accept whatever the server returns so the UI
   * shows something instead of staying blank.
   */
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
        `[hydrate] ${label}: existing has ${existing.length} rows, new fetch returned only ${newRows.length} — keeping existing to avoid data loss`
      );
    }
  }

  /**
   * Save the current ERP data to localStorage. Called after every
   * successful hydration so that refresh / new tab open shows data
   * immediately while a fresh fetch runs in the background.
   */
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
      };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn("[hydrate] persistSnapshot failed (non-fatal):", err);
    }
  }

  /**
   * Read the snapshot back into the signals on boot. Runs synchronously
   * in the constructor so the very first render of the dashboard shows
   * real data instead of empty rows.
   */
  private restoreFromSnapshot(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as PersistedSnapshot;
      if (snap.version !== SNAPSHOT_VERSION) return;
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
      // Mark all restored modules as loaded so pages don't re-fetch
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
