import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
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
    const [sites, materials, labour, expenses, payments, subcontractors, invoices, inventory] = await Promise.all([
      this.safeList(() => this.api.listSites(), "sites"),
      this.safeList(() => this.api.listMaterials({ limit: 100 }), "materials"),
      this.safeList(() => this.api.listLabour({ limit: 100 }), "labour"),
      this.safeList(() => this.api.listExpenses({ limit: 100 }), "expenses"),
      this.safeList(() => this.api.listPayments({ limit: 100 }), "payments"),
      this.safeList(() => this.api.listSubcontractors({ limit: 100 }), "subcontractors"),
      this.safeList(() => this.api.listInvoices({ limit: 100 }), "invoices"),
      this.safeList(() => this.api.listInventory({ limit: 100 }), "inventory"),
    ]);

    this.setSignalAndStorage("sites", (sites?.items || []).map(mapSite), this.erp.siteEntities);
    this.setSignalAndStorage("materials", (materials?.items || []).map(mapMaterial), this.erp.materials);
    this.setSignalAndStorage("labour", (labour?.items || []).map(mapLabour), this.erp.labour);
    this.setSignalAndStorage("expenses", (expenses?.items || []).map(mapExpense), this.erp.expenses);
    this.setSignalAndStorage("payments", (payments?.items || []).map(mapPayment), this.erp.payments);
    this.setSignalAndStorage("subcontractors", (subcontractors?.items || []).map(mapSubcontractor), this.erp.subcontractors);
    this.setSignalAndStorage("taxInvoices", (invoices?.items || []).map(mapInvoice), this.erp.taxInvoices);
    this.setSignalAndStorage("inventory", (inventory?.items || []).map(mapInventory), this.erp.inventory);
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
   */
  private async safeList<T>(
    factory: () => import("rxjs").Observable<T>,
    label: string
  ): Promise<T | null> {
    try {
      return await firstValueFrom(factory());
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const message = err?.error?.error || err?.error?.message || err?.message || String(err);
      console.warn(
        `[WorkspaceHydration] Skipping ${label} refresh — API failed (status=${status}): ${message}. Keeping existing cached data.`
      );
      return null;
    }
  }

  private setSignalAndStorage<T>(
    key: string,
    value: T[],
    target: { set(value: T[]): void }
  ): void {
    if (!Array.isArray(value) || value.length === 0) {
      return;
    }
    target.set(value);
    this.writeState(key, value);
  }

  private writeState<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.storageKey(key), JSON.stringify(value));
    } catch {}
  }

  private storageKey(key: string): string {
    return `agb-erp:${key}`;
  }
}
