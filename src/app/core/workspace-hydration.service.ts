import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ErpDataService } from "../data/erp-data.service";
import {
  mapClient,
  mapExpense,
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

  async hydrateFromBackend(): Promise<void> {
    this.clearWorkspaceData();

    const [clients, projects, sites, vendors, supervisors, materials, labour, expenses, payments, subcontractors, invoices] = await Promise.all([
      firstValueFrom(this.api.listClients({ limit: 100 })).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listProjects({ limit: 100 })).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listSites()).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listVendors({ limit: 100 })).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listSupervisors()).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listMaterials({ limit: 100 })).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listLabour({ limit: 100 })).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listExpenses({ limit: 100 })).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listPayments({ limit: 100 })).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listSubcontractors({ limit: 100 })).catch(() => ({ items: [] })),
      firstValueFrom(this.api.listInvoices({ limit: 100 })).catch(() => ({ items: [] })),
    ]);

    const mappedProjects = (projects.items || []).map(mapProject);
    const projectIds = new Set(mappedProjects.map((p: any) => String(p.id)));
    const businessIdToProjectId = new Map(
      mappedProjects.map((p: any) => [String(p.projectId || p.id), String(p.id)])
    );
    const mappedClients = (clients.items || []).map(mapClient).map((client) => ({
      ...client,
      projectIds: (client.projectIds || [])
        .map((pid) => businessIdToProjectId.get(String(pid)) || String(pid))
        .filter((pid) => projectIds.has(pid)),
    }));

    this.setSignalAndStorage("projects", mappedProjects, this.erp.projects);
    this.setSignalAndStorage("clients", mappedClients, this.erp.clients);
    this.setSignalAndStorage("sites", (sites.items || []).map(mapSite), this.erp.siteEntities);
    this.setSignalAndStorage("vendors", (vendors.items || []).map(mapVendor), this.erp.vendors);
    this.setSignalAndStorage("supervisors", (supervisors.items || []).map(mapSupervisor), this.erp.supervisors);
    this.setSignalAndStorage("materials", (materials.items || []).map(mapMaterial), this.erp.materials);
    this.setSignalAndStorage("labour", (labour.items || []).map(mapLabour), this.erp.labour);
    this.setSignalAndStorage("expenses", (expenses.items || []).map(mapExpense), this.erp.expenses);
    this.setSignalAndStorage("payments", (payments.items || []).map(mapPayment), this.erp.payments);
    this.setSignalAndStorage("subcontractors", (subcontractors.items || []).map(mapSubcontractor), this.erp.subcontractors);
    this.setSignalAndStorage("taxInvoices", (invoices.items || []).map(mapInvoice), this.erp.taxInvoices);
  }

  private clearWorkspaceData(): void {
    this.erp.clients.set([]);
    this.erp.projects.set([]);
    this.erp.materials.set([]);
    this.erp.labour.set([]);
    this.erp.expenses.set([]);
    this.erp.payments.set([]);
    this.erp.vendors.set([]);
    this.erp.supervisors.set([]);
    this.erp.subcontractors.set([]);

    this.erp.taxInvoices.set([]);
    [
      "clients",
      "projects",
      "sites",
      "materials",
      "labour",
      "expenses",
      "payments",
      "vendors",
      "supervisors",
      "subcontractors",
      "taxInvoices",
    ].forEach((key) => {
      try {
        localStorage.removeItem(this.storageKey(key));
      } catch {}
    });
  }

  private setSignalAndStorage<T>(
    key: string,
    value: T[],
    target: { set(value: T[]): void }
  ): void {
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
