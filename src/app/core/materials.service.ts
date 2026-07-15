import { Injectable, inject, signal } from "@angular/core";
import { ApiService } from "./api.service";
import type { MaterialRow } from "../../data/dashboardData";

@Injectable({ providedIn: "root" })
export class MaterialsService {
  private readonly api = inject(ApiService);
  private readonly storageKey = "agb-erp:materials";

  readonly materials = signal<MaterialRow[]>(this.readState());

  getAll(params?: { projectId?: string; siteId?: string; vendorId?: string; status?: string }) {
    this.api.listMaterials({ ...params, limit: 100 }).subscribe({
      next: (r) => {
        const items = (r.items || []).map(this.mapMaterial);
        this.materials.set(items);
        this.persist(items);
      },
      error: () => {
        this.materials.set(this.readState());
      },
    });
    return this.materials();
  }

  async refresh() {
    return new Promise<MaterialRow[]>((resolve) => {
      this.api.listMaterials({ limit: 100 }).subscribe({
        next: (r) => {
          const items = (r.items || []).map(this.mapMaterial);
          this.materials.set(items);
          this.persist(items);
          resolve(items);
        },
        error: () => resolve(this.materials()),
      });
    });
  }

  private mapMaterial = (row: any): MaterialRow => ({
    id: row.materialId || row._id || row.id,
    projectId: row.projectId,
    site: row.siteId,
    name: row.name,
    unit: row.unit,
    requested: row.requested,
    approved: row.approved,
    purchased: row.purchased,
    consumed: row.consumed,
    vendor: row.vendor,
    poNumber: row.poNumber,
    status: row.status,
  });

  private readState(): MaterialRow[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as MaterialRow[]) : [];
    } catch {
      return [];
    }
  }

  private persist(rows: MaterialRow[]) {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(rows));
    } catch {}
  }
}
