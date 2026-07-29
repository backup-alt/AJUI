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

@Injectable({ providedIn: "root" })
export class WorkspaceHydrationService {
  private readonly api = inject(ApiService);
  private readonly erp = inject(ErpDataService);

  async hydrateCritical(): Promise<void> {
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

    this.setSignalAndStorage("projects", mappedProjects, this.erp.projects);
    this.setSignalAndStorage("clients", mappedClients, this.erp.clients);
    this.setSignalAndStorage("vendors", (vendors?.items || []).map(mapVendor), this.erp.vendors);
    this.setSignalAndStorage("supervisors", (supervisors?.items || []).map(mapSupervisor), this.erp.supervisors);
  }

  async hydrateDeferred(): Promise<void> {
    // M0 free-tier MongoDB pool can only handle a few concurrent ops at a
    // time. Chaining these calls (instead of Promise.all of 8) keeps the
    // pool healthy and prevents every call from timing out simultaneously.
    //
    // Materials / Inventory / Expenses are loaded via cursor pagination —
    // each batch is at most 25 rows so we don't hit the M0 timeout we saw
    // on the user's deployment. The loop walks pages until nextCursor is
    // null, then merges all rows into the signal.
    const t0 = Date.now();
    const initialMaterials = this.erp.materials().length;
    console.log(`[hydrateDeferred] starting — existing materials signal has ${initialMaterials} entries`);

    const sites = await this.safeList(() => this.api.listSites(), "sites");
    this.setSignalAndStorage("sites", (sites?.items || []).map(mapSite), this.erp.siteEntities);

    const materials = await this.fetchAllByCursor(
      (cursor) => this.api.listMaterials({ limit: 25, cursor }),
      mapMaterial,
      "materials"
    );
    this.setSignalAndStorage("materials", materials, this.erp.materials);

    const inventory = await this.fetchAllByCursor(
      (cursor) => this.api.listInventory({ limit: 25, cursor }),
      mapInventory,
      "inventory"
    );
    this.setSignalAndStorage("inventory", inventory, this.erp.inventory);

    const expenses = await this.fetchAllByCursor(
      (cursor) => this.api.listExpenses({ limit: 25, cursor }),
      mapExpense,
      "expenses"
    );
    this.setSignalAndStorage("expenses", expenses, this.erp.expenses);

    const labour = await this.safeList(() => this.api.listLabour({ limit: 25 }), "labour");
    this.setSignalAndStorage("labour", (labour?.items || []).map(mapLabour), this.erp.labour);

    const payments = await this.safeList(() => this.api.listPayments({ limit: 25 }), "payments");
    this.setSignalAndStorage("payments", (payments?.items || []).map(mapPayment), this.erp.payments);

    const subcontractors = await this.safeList(() => this.api.listSubcontractors({ limit: 25 }), "subcontractors");
    this.setSignalAndStorage("subcontractors", (subcontractors?.items || []).map(mapSubcontractor), this.erp.subcontractors);

    const invoices = await this.safeList(() => this.api.listInvoices({ limit: 25 }), "invoices");
    this.setSignalAndStorage("taxInvoices", (invoices?.items || []).map(mapInvoice), this.erp.taxInvoices);

    const dt = Date.now() - t0;
    console.log(`[hydrateDeferred] complete in ${dt}ms — materials signal now has ${this.erp.materials().length} entries`);
  }

  /**
   * Walk all pages of a cursor-paginated endpoint and accumulate the rows.
   * Each batch is at most 25 rows (the limit M0 can serve without timing
   * out) so we never hold a connection long enough to starve the pool.
   * Returns [] if any page fails — the caller decides whether to preserve
   * the existing signal or overwrite with the empty result.
   */
  private async fetchAllByCursor<T>(
    factory: (cursor: string | undefined) => import("rxjs").Observable<{ items: T[]; nextCursor?: string | null }>,
    mapper: (row: any) => T,
    label: string
  ): Promise<T[]> {
    const PAGE_LIMIT = 25;
    const MAX_PAGES = 20; // safety cap — 20 * 25 = 500 rows max per resource
    const allItems: T[] = [];
    let cursor: string | undefined = undefined;
    let pagesFetched = 0;
    let totalReported = 0;

    while (pagesFetched < MAX_PAGES) {
      pagesFetched++;
      const page = await this.safeList(() => factory(cursor), `${label}/page${pagesFetched}`);
      if (!page || !Array.isArray(page.items)) {
        console.warn(
          `[hydrateDeferred] ${label} page ${pagesFetched} failed; returning ${allItems.length} items fetched so far`
        );
        break;
      }
      const mapped = page.items.map(mapper);
      allItems.push(...mapped);
      if (pagesFetched === 1 && typeof (page as any).total === "number") {
        totalReported = (page as any).total;
      }
      const nextCursor = page.nextCursor ?? null;
      if (!nextCursor || mapped.length === 0) {
        break;
      }
      cursor = String(nextCursor);
    }

    console.log(
      `[hydrateDeferred] ${label}: fetched ${allItems.length} items across ${pagesFetched} page(s)${totalReported ? ` (backend reports ${totalReported} total)` : ""}`
    );
    return allItems;
  }

  async hydrateFromBackend(): Promise<void> {
    await this.hydrateCritical();
    await this.hydrateDeferred();
  }

  /**
   * Safe list wrapper. Returns null on failure (instead of an empty array)
   * so the caller can preserve existing localStorage data instead of
   * overwriting it with empty arrays when the API is temporarily
   * unreachable (e.g. 401 expired token, M0 slow query timeout).
   *
   * Wraps the observable in a 20s timeout. Without this, firstValueFrom()
   * will wait forever on a hung HTTP request (Render cold start + M0
   * pool can hang the underlying socket indefinitely), and the entire
   * hydration chain freezes at the first await. The timeout converts
   * "hung forever" into "fails fast" so the next collection in the
   * sequential chain still gets a chance to hydrate.
   */
  private async safeList<T>(
    factory: () => import("rxjs").Observable<T>,
    label: string
  ): Promise<T | null> {
    try {
      // TEMPORARY: 110s per-page timeout while we test Atlas M0 with the
      // 5-minute global backend ceiling. This lets a slow M0 page complete
      // rather than cancelling at 45s. Revert to 45_000 once M0 is healthy.
      return await firstValueFrom(
        factory().pipe(timeout({ each: 110_000, meta: `hydration.${label}` }))
      );
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const isTimeout = err?.name === "TimeoutError" || /timeout/i.test(err?.message || "");
      const message = err?.error?.error || err?.error?.message || err?.message || String(err);
      console.warn(
        `[WorkspaceHydration] Skipping ${label} refresh — ${isTimeout ? "TIMEOUT after 20s" : `API failed (status=${status})`}: ${message}. Keeping existing cached data.`
      );
      return null;
    }
  }

  private setSignalAndStorage<T>(
    key: string,
    value: T[],
    target: { set(value: T[]): void }
  ): void {
    // Backend is the source of truth — always overwrite the signal, even
    // when the value is an empty array. We no longer mirror to localStorage
    // because the dashboard removed all agb-erp:* data-table caching; the
    // backend is queried on every signal update and the response is the
    // authoritative value.
    //
    // We still defend against undefined / non-array responses so a bug in
    // the API response shape can't wipe the signal to an unrenderable value.
    if (!Array.isArray(value)) {
      return;
    }
    target.set(value);
  }
}
