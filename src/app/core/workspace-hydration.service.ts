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

    this.setSignal("projects", mappedProjects, this.erp.projects);
    this.setSignal("clients", mappedClients, this.erp.clients);
    this.setSignal("vendors", (vendors?.items || []).map(mapVendor), this.erp.vendors);
    this.setSignal("supervisors", (supervisors?.items || []).map(mapSupervisor), this.erp.supervisors);
  }

  async hydrateDeferred(): Promise<void> {
    const t0 = Date.now();
    console.log(`[hydrateDeferred] starting — materials=${this.erp.materials().length}, inventory=${this.erp.inventory().length}, expenses=${this.erp.expenses().length}`);

    // Sites — single page
    const sites = await this.safeList(() => this.api.listSites(), "sites");
    this.setSignal("sites", (sites?.items || []).map(mapSite), this.erp.siteEntities);

    // Materials — cursor-paginated, warmup before EVERY page, retry until complete
    const materials = await this.loadAllPages(
      (cursor) => this.api.listMaterials({ limit: 5, cursor }),
      () => this.api.warmupMaterials(),
      "materials"
    );
    this.setSignal("materials", materials.map(mapMaterial), this.erp.materials);

    // Inventory — cursor-paginated, warmup before EVERY page, retry until complete
    const inventory = await this.loadAllPages(
      (cursor) => this.api.listInventory({ limit: 5, cursor }),
      () => this.api.warmupInventory(),
      "inventory"
    );
    this.setSignal("inventory", inventory.map(mapInventory), this.erp.inventory);

    // Expenses — cursor-paginated, warmup before EVERY page, retry until complete
    const expenses = await this.loadAllPages(
      (cursor) => this.api.listExpenses({ limit: 5, cursor }),
      () => this.api.warmupExpenses(),
      "expenses"
    );
    this.setSignal("expenses", expenses.map(mapExpense), this.erp.expenses);

    // Smaller collections — single page
    const labour = await this.safeList(() => this.api.listLabour({ limit: 5 }), "labour");
    this.setSignal("labour", (labour?.items || []).map(mapLabour), this.erp.labour);

    const payments = await this.safeList(() => this.api.listPayments({ limit: 5 }), "payments");
    this.setSignal("payments", (payments?.items || []).map(mapPayment), this.erp.payments);

    const subcontractors = await this.safeList(() => this.api.listSubcontractors({ limit: 5 }), "subcontractors");
    this.setSignal("subcontractors", (subcontractors?.items || []).map(mapSubcontractor), this.erp.subcontractors);

    const invoices = await this.safeList(() => this.api.listInvoices({ limit: 5 }), "invoices");
    this.setSignal("taxInvoices", (invoices?.items || []).map(mapInvoice), this.erp.taxInvoices);

    const dt = Date.now() - t0;
    console.log(`[hydrateDeferred] complete in ${dt}ms — materials=${this.erp.materials().length}, inventory=${this.erp.inventory().length}, expenses=${this.erp.expenses().length}`);
  }

  /**
   * Load ALL pages of a cursor-paginated endpoint. Calls warmup BEFORE every
   * page request. If the fetched count doesn't match the expected total,
   * keeps retrying from the last successful cursor until complete.
   */
  private async loadAllPages<T>(
    factory: (cursor: string | undefined) => import("rxjs").Observable<{ items: T[]; nextCursor?: string | null }>,
    warmup: () => import("rxjs").Observable<any>,
    label: string
  ): Promise<T[]> {
    const MAX_PAGES = 40;
    const PAGE_RETRY_LIMIT = 5;
    const PAGE_RETRY_DELAY_MS = 2000;
    const allItems: T[] = [];
    let cursor: string | undefined = undefined;
    let pagesFetched = 0;
    let totalReported = 0;

    while (pagesFetched < MAX_PAGES) {
      pagesFetched++;
      let pageData: { items: T[]; nextCursor?: string | null; total?: number } | null = null;

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

      if (pagesFetched === 1 && typeof pageData.total === "number") {
        totalReported = pageData.total;
      }

      const nextCursor = pageData.nextCursor ?? null;
      if (!nextCursor) {
        break;
      }
      cursor = String(nextCursor);

      // If we know the total and we've fetched all items, stop early
      if (totalReported > 0 && allItems.length >= totalReported) {
        console.log(`[loadAllPages] ${label}: reached expected total ${totalReported}`);
        break;
      }

      // Delay between pages to let M0 recover
      await new Promise((r) => setTimeout(r, 300));
    }

    // If we didn't reach the expected total, retry the whole thing from scratch
    if (totalReported > 0 && allItems.length < totalReported) {
      console.warn(`[loadAllPages] ${label}: only got ${allItems.length}/${totalReported} — retrying from scratch`);
      // Wait a bit before retrying
      await new Promise((r) => setTimeout(r, 3000));
      // Recurse with a fresh start
      return this.loadAllPages(factory, warmup, label);
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

  /** No-op kept for API compatibility — no caching, always fresh. */
  invalidateCache(): void {}

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
