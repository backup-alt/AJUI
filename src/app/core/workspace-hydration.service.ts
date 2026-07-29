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
    const t0 = Date.now();
    const initialMaterials = this.erp.materials().length;
    console.log(`[hydrateDeferred] starting — existing materials signal has ${initialMaterials} entries`);

    const sites = await this.safeList(() => this.api.listSites(), "sites");
    this.setSignalAndStorage("sites", (sites?.items || []).map(mapSite), this.erp.siteEntities);

    // Warm up M0 connections before each heavy cursor-paginated load,
    // then aggressively fetch until we get data.
    await this.warmupAndLoad(
      () => this.api.warmupMaterials(),
      (cursor) => this.api.listMaterials({ limit: 5, cursor }),
      mapMaterial,
      "materials"
    );

    await this.warmupAndLoad(
      () => this.api.warmupInventory(),
      (cursor) => this.api.listInventory({ limit: 5, cursor }),
      mapInventory,
      "inventory"
    );

    await this.warmupAndLoad(
      () => this.api.warmupExpenses(),
      (cursor) => this.api.listExpenses({ limit: 5, cursor }),
      mapExpense,
      "expenses"
    );

    const labour = await this.safeList(() => this.api.listLabour({ limit: 5 }), "labour");
    this.setSignalAndStorage("labour", (labour?.items || []).map(mapLabour), this.erp.labour);

    const payments = await this.safeList(() => this.api.listPayments({ limit: 5 }), "payments");
    this.setSignalAndStorage("payments", (payments?.items || []).map(mapPayment), this.erp.payments);

    const subcontractors = await this.safeList(() => this.api.listSubcontractors({ limit: 5 }), "subcontractors");
    this.setSignalAndStorage("subcontractors", (subcontractors?.items || []).map(mapSubcontractor), this.erp.subcontractors);

    const invoices = await this.safeList(() => this.api.listInvoices({ limit: 5 }), "invoices");
    this.setSignalAndStorage("taxInvoices", (invoices?.items || []).map(mapInvoice), this.erp.taxInvoices);

    const dt = Date.now() - t0;
    console.log(`[hydrateDeferred] complete in ${dt}ms — materials signal now has ${this.erp.materials().length} entries`);
  }

  /**
   * Warm up M0 by calling a diagnostic findOne endpoint, then aggressively
   * fetch all pages. If the first page returns empty, retry up to 3 times
   * with a delay between each attempt. This ensures M0 connections are
   * primed before the heavier cursor-paginated query runs.
   */
  private async warmupAndLoad<T>(
    warmup: () => import("rxjs").Observable<any>,
    factory: (cursor: string | undefined) => import("rxjs").Observable<{ items: T[]; nextCursor?: string | null }>,
    mapper: (row: any) => T,
    label: string
  ): Promise<void> {
    const MAX_WARMUP_RETRIES = 3;
    const WARMUP_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_WARMUP_RETRIES; attempt++) {
      // Step 1: warm up the connection with a trivial findOne query
      console.log(`[warmupAndLoad] ${label}: warmup attempt ${attempt}/${MAX_WARMUP_RETRIES}`);
      try {
        await firstValueFrom(warmup().pipe(timeout({ each: 15_000, meta: `warmup.${label}` })));
      } catch {
        // warmup failed — still try the real query
      }

      // Step 2: small delay to let the M0 connection settle
      await new Promise((r) => setTimeout(r, WARMUP_DELAY_MS));

      // Step 3: try fetching all pages
      const items = await this.fetchAllByCursor(factory, mapper, label);
      if (items.length > 0) {
        this.setSignalAndStorage(label, items, this.getSignalTarget(label));
        console.log(`[warmupAndLoad] ${label}: loaded ${items.length} items on attempt ${attempt}`);
        return;
      }
      console.warn(`[warmupAndLoad] ${label}: attempt ${attempt} returned 0 items, retrying...`);
    }

    // All retries exhausted — keep existing data
    console.warn(`[warmupAndLoad] ${label}: all ${MAX_WARMUP_RETRIES} attempts returned 0 items`);
  }

  private getSignalTarget(label: string): { set(value: any[]): void } {
    switch (label) {
      case "materials": return this.erp.materials;
      case "inventory": return this.erp.inventory;
      case "expenses": return this.erp.expenses;
      default: throw new Error(`Unknown signal target: ${label}`);
    }
  }

  /**
   * Walk all pages of a cursor-paginated endpoint and accumulate the rows.
   * Returns [] if any page fails — the caller decides whether to preserve
   * the existing signal or overwrite with the empty result.
   */
  private async fetchAllByCursor<T>(
    factory: (cursor: string | undefined) => import("rxjs").Observable<{ items: T[]; nextCursor?: string | null }>,
    mapper: (row: any) => T,
    label: string
  ): Promise<T[]> {
    const MAX_PAGES = 40; // safety cap — 40 * 5 = 200 rows max per resource
    const allItems: T[] = [];
    let cursor: string | undefined = undefined;
    let pagesFetched = 0;
    let totalReported = 0;

    while (pagesFetched < MAX_PAGES) {
      pagesFetched++;
      // Small delay between pages to let M0 connection recover
      if (pagesFetched > 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
      const page = await this.safeList(() => factory(cursor), `${label}/page${pagesFetched}`);
      if (!page || !Array.isArray(page.items)) {
        console.warn(
          `[fetchAllByCursor] ${label} page ${pagesFetched} failed; returning ${allItems.length} items fetched so far`
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
      `[fetchAllByCursor] ${label}: fetched ${allItems.length} items across ${pagesFetched} page(s)${totalReported ? ` (backend reports ${totalReported} total)` : ""}`
    );
    return allItems;
  }

  async hydrateFromBackend(): Promise<void> {
    await this.hydrateCritical();
    await this.hydrateDeferred();
  }

  /**
   * Safe list wrapper. Returns null on failure so the caller can preserve
   * existing data. Wraps the observable in a 45s timeout.
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
        `[WorkspaceHydration] Skipping ${label} — ${isTimeout ? "TIMEOUT" : `API failed (status=${status})`}: ${message}`
      );
      return null;
    }
  }

  private setSignalAndStorage<T>(
    key: string,
    value: T[],
    target: { set(value: T[]): void }
  ): void {
    if (!Array.isArray(value)) {
      return;
    }
    target.set(value);
  }
}
