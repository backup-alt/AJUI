import { Injectable, inject } from "@angular/core";
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

/** In-memory cache TTL — skip re-fetch if data was loaded less than this long ago. */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable({ providedIn: "root" })
export class WorkspaceHydrationService {
  private readonly api = inject(ApiService);
  private readonly erp = inject(ErpDataService);

  /** Timestamps of last successful hydration per resource. */
  private lastHydrated: Record<string, number> = {};

  private isFresh(key: string): boolean {
    const last = this.lastHydrated[key] ?? 0;
    return Date.now() - last < CACHE_TTL_MS;
  }

  async hydrateCritical(): Promise<void> {
    if (this.isFresh("clients") && this.isFresh("projects")) {
      console.log("[hydrateCritical] skipping — cache is fresh");
      return;
    }
    const [clients, projects, vendors, supervisors] = await Promise.all([
      this.safeList(() => this.api.listClients({ limit: 100 }), "clients"),
      this.safeList(() => this.api.listProjects({ limit: 100 }), "projects"),
      this.safeList(() => this.api.listVendors({ limit: 100 }), "vendors"),
      this.safeList(() => this.api.listSupervisors(), "supervisors"),
    ]);

    const mappedProjects = ((clients && projects) ? (projects.items || []) : []).map(mapProject);
    const projectIds = new Set(mappedProjects.map((p: any) => String(p.id)));
    const businessIdToProjectId = new Map(
      mappedProjects.map((p: any) => [String(p.projectId || p.id), String(p.id)])
    );
    const mappedClients = ((clients && projects) ? (clients.items || []) : []).map(mapClient).map((client) => ({
      ...client,
      projectIds: (client.projectIds || [])
        .map((pid) => businessIdToProjectId.get(String(pid)) || String(pid))
        .filter((pid) => projectIds.has(pid)),
    }));

    this.setSignal("projects", mappedProjects, this.erp.projects);
    this.setSignal("clients", mappedClients, this.erp.clients);
    this.setSignal("vendors", (vendors?.items || []).map(mapVendor), this.erp.vendors);
    this.setSignal("supervisors", (supervisors?.items || []).map(mapSupervisor), this.erp.supervisors);
    this.lastHydrated["clients"] = Date.now();
    this.lastHydrated["projects"] = Date.now();
    this.lastHydrated["vendors"] = Date.now();
    this.lastHydrated["supervisors"] = Date.now();
  }

  async hydrateDeferred(): Promise<void> {
    const t0 = Date.now();
    console.log(`[hydrateDeferred] starting — materials=${this.erp.materials().length}, inventory=${this.erp.inventory().length}, expenses=${this.erp.expenses().length}`);

    // Sites — single page, no cursor
    if (!this.isFresh("sites")) {
      const sites = await this.safeList(() => this.api.listSites(), "sites");
      this.setSignal("sites", (sites?.items || []).map(mapSite), this.erp.siteEntities);
      this.lastHydrated["sites"] = Date.now();
    }

    // Materials — cursor-paginated, warmup called before EVERY page
    if (!this.isFresh("materials")) {
      const materials = await this.loadAllPages(
        (cursor) => this.api.listMaterials({ limit: 5, cursor }),
        () => this.api.warmupMaterials(),
        "materials"
      );
      this.setSignal("materials", materials.map(mapMaterial), this.erp.materials);
      this.lastHydrated["materials"] = Date.now();
    }

    // Inventory — cursor-paginated, warmup called before EVERY page
    if (!this.isFresh("inventory")) {
      const inventory = await this.loadAllPages(
        (cursor) => this.api.listInventory({ limit: 5, cursor }),
        () => this.api.warmupInventory(),
        "inventory"
      );
      this.setSignal("inventory", inventory.map(mapInventory), this.erp.inventory);
      this.lastHydrated["inventory"] = Date.now();
    }

    // Expenses — cursor-paginated, warmup called before EVERY page
    if (!this.isFresh("expenses")) {
      const expenses = await this.loadAllPages(
        (cursor) => this.api.listExpenses({ limit: 5, cursor }),
        () => this.api.warmupExpenses(),
        "expenses"
      );
      this.setSignal("expenses", expenses.map(mapExpense), this.erp.expenses);
      this.lastHydrated["expenses"] = Date.now();
    }

    // Smaller collections — single page
    if (!this.isFresh("labour")) {
      const labour = await this.safeList(() => this.api.listLabour({ limit: 5 }), "labour");
      this.setSignal("labour", (labour?.items || []).map(mapLabour), this.erp.labour);
      this.lastHydrated["labour"] = Date.now();
    }
    if (!this.isFresh("payments")) {
      const payments = await this.safeList(() => this.api.listPayments({ limit: 5 }), "payments");
      this.setSignal("payments", (payments?.items || []).map(mapPayment), this.erp.payments);
      this.lastHydrated["payments"] = Date.now();
    }
    if (!this.isFresh("subcontractors")) {
      const subcontractors = await this.safeList(() => this.api.listSubcontractors({ limit: 5 }), "subcontractors");
      this.setSignal("subcontractors", (subcontractors?.items || []).map(mapSubcontractor), this.erp.subcontractors);
      this.lastHydrated["subcontractors"] = Date.now();
    }
    if (!this.isFresh("taxInvoices")) {
      const invoices = await this.safeList(() => this.api.listInvoices({ limit: 5 }), "invoices");
      this.setSignal("taxInvoices", (invoices?.items || []).map(mapInvoice), this.erp.taxInvoices);
      this.lastHydrated["taxInvoices"] = Date.now();
    }

    const dt = Date.now() - t0;
    console.log(`[hydrateDeferred] complete in ${dt}ms — materials=${this.erp.materials().length}, inventory=${this.erp.inventory().length}, expenses=${this.erp.expenses().length}`);
  }

  /**
   * Load all pages of a cursor-paginated endpoint. Calls the warmup endpoint
   * BEFORE every page request to prime the M0 connection. This is what makes
   * `?limit=5` work reliably — the diagnostic-find-one query forces a fresh
   * connection, then the small data query can piggyback on it.
   */
  private async loadAllPages<T>(
    factory: (cursor: string | undefined) => import("rxjs").Observable<{ items: T[]; nextCursor?: string | null }>,
    warmup: () => import("rxjs").Observable<any>,
    label: string
  ): Promise<T[]> {
    const MAX_PAGES = 40;
    const PAGE_RETRY_LIMIT = 3;
    const PAGE_RETRY_DELAY_MS = 2000;
    const allItems: T[] = [];
    let cursor: string | undefined = undefined;
    let pagesFetched = 0;
    let totalReported = 0;

    while (pagesFetched < MAX_PAGES) {
      pagesFetched++;
      let pageData: { items: T[]; nextCursor?: string | null } | null = null;

      // Per-page retry loop — warmup before EACH attempt
      for (let pageAttempt = 1; pageAttempt <= PAGE_RETRY_LIMIT; pageAttempt++) {
        if (pageAttempt > 1) {
          console.warn(`[loadAllPages] ${label} page ${pagesFetched} retry ${pageAttempt}/${PAGE_RETRY_LIMIT}`);
          await new Promise((r) => setTimeout(r, PAGE_RETRY_DELAY_MS));
        }

        // Warm up M0 connection BEFORE every page query
        try {
          await firstValueFrom(warmup().pipe(timeout({ each: 10_000, meta: `warmup.${label}.page${pagesFetched}` })));
        } catch {
          // warmup failed — still try the data query
        }

        pageData = await this.safeList(
          () => factory(cursor),
          `${label}/page${pagesFetched}/attempt${pageAttempt}`
        );

        if (pageData && Array.isArray(pageData.items) && pageData.items.length > 0) {
          break; // got data, stop retrying this page
        }
      }

      if (!pageData || !Array.isArray(pageData.items) || pageData.items.length === 0) {
        console.warn(`[loadAllPages] ${label} page ${pagesFetched} failed after ${PAGE_RETRY_LIMIT} attempts, stopping`);
        break;
      }

      allItems.push(...pageData.items);

      if (pagesFetched === 1 && typeof (pageData as any).total === "number") {
        totalReported = (pageData as any).total;
      }

      const nextCursor = pageData.nextCursor ?? null;
      if (!nextCursor) {
        break;
      }
      cursor = String(nextCursor);

      // Delay between pages to let M0 recover
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(
      `[loadAllPages] ${label}: fetched ${allItems.length}/${totalReported || "?"} items across ${pagesFetched} page(s)`
    );
    return allItems;
  }

  async hydrateFromBackend(): Promise<void> {
    await this.hydrateCritical();
    await this.hydrateDeferred();
  }

  /** Force a full re-fetch on next hydration (clears TTL cache). */
  invalidateCache(): void {
    this.lastHydrated = {};
  }

  /**
   * Safe list wrapper. Returns null on failure. 45s timeout.
   */
  private async safeList<T>(
    factory: () => import("rxjs").Observable<T>,
    label: string
  ): Promise<T | null> {
    try {
      return await firstValueFrom(
        factory().pipe(timeout({ each: 45_000, meta: `hydration.${label}` }))
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

  private setSignal<T>(
    _key: string,
    value: T[],
    target: { set(value: T[]): void }
  ): void {
    if (!Array.isArray(value)) {
      return;
    }
    target.set(value);
  }
}
