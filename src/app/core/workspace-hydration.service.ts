import { Injectable, inject } from "@angular/core";
import { forkJoin } from "rxjs";
import { ErpDataService } from "../data/erp-data.service";
import {
  mapClient,
  mapExpense,
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

  hydrateFromBackend(): void {
    this.clearWorkspaceData();

    forkJoin({
      clients: this.api.listClients({ limit: 100 }),
      projects: this.api.listProjects({ limit: 100 }),
    }).subscribe({
      next: ({ clients, projects }) => {
        const mappedProjects = (projects.items || []).map(mapProject);
        const projectIds = new Set(mappedProjects.map((project: any) => String(project.id)));
        const businessIdToProjectId = new Map(
          mappedProjects.map((project: any) => [String(project.projectId || project.id), String(project.id)])
        );
        const mappedClients = (clients.items || []).map(mapClient).map((client) => ({
          ...client,
          projectIds: (client.projectIds || [])
            .map((projectId) => businessIdToProjectId.get(String(projectId)) || String(projectId))
            .filter((projectId) => projectIds.has(projectId)),
        }));

        this.setSignalAndStorage("projects", mappedProjects, this.erp.projects);
        this.setSignalAndStorage("clients", mappedClients, this.erp.clients);
      },
      error: () => {},
    });
    this.api.listSites().subscribe({
      next: (res: any) => this.writeState("sites", (res.items || res.sites || []).map(mapSite)),
      error: () => {},
    });
    this.api.listVendors({ limit: 100 }).subscribe({
      next: (res) => this.setSignalAndStorage("vendors", (res.items || []).map(mapVendor), this.erp.vendors),
      error: () => {},
    });
    this.api.listSupervisors().subscribe({
      next: (res: any) => this.setSignalAndStorage("supervisors", (res.items || res.supervisors || []).map(mapSupervisor), this.erp.supervisors),
      error: () => {},
    });
    this.api.listMaterials({ limit: 100 }).subscribe({
      next: (res) => this.setSignalAndStorage("materials", (res.items || []).map(mapMaterial), this.erp.materials),
      error: () => {},
    });
    this.api.listLabour({ limit: 100 }).subscribe({
      next: (res) => this.setSignalAndStorage("labour", (res.items || []).map(mapLabour), this.erp.labour),
      error: () => {},
    });
    this.api.listExpenses({ limit: 100 }).subscribe({
      next: (res) => this.setSignalAndStorage("expenses", (res.items || []).map(mapExpense), this.erp.expenses),
      error: () => {},
    });
    this.api.listPayments({ limit: 100 }).subscribe({
      next: (res) => this.setSignalAndStorage("payments", (res.items || []).map(mapPayment), this.erp.payments),
      error: () => {},
    });
    this.api.listSubcontractors({ limit: 100 }).subscribe({
      next: (res) => this.setSignalAndStorage("subcontractors", (res.items || []).map(mapSubcontractor), this.erp.subcontractors),
      error: () => {},
    });
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
