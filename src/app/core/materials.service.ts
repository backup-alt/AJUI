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
        const backendItems = (r.items || []).map(this.mapMaterial);
        const localItems = this.materials();
        const backendIds = new Set(backendItems.map((i) => i.id));
        const merged = [...backendItems, ...localItems.filter((i) => !backendIds.has(i.id))];
        this.materials.set(merged);
        this.persist(merged);
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
          const backendItems = (r.items || []).map(this.mapMaterial);
          const localItems = this.materials();
          const backendIds = new Set(backendItems.map((i) => i.id));
          const merged = [...backendItems, ...localItems.filter((i) => !backendIds.has(i.id))];
          this.materials.set(merged);
          this.persist(merged);
          resolve(merged);
        },
        error: () => resolve(this.materials()),
      });
    });
  }

  private mapMaterial = (row: any): MaterialRow => ({
    id: row.materialId || row._id || row.id,
    projectId: row.projectId,
    site: row.site || row.siteId,
    name: row.name,
    unit: row.unit,
    requested: row.requestedQuantity ?? 0,
    approved: row.approvedQuantity ?? 0,
    purchased: row.purchasedQuantity ?? 0,
    consumed: row.consumedQuantity ?? 0,
    vendor: row.vendor,
    poNumber: row.poNumber,
    status: row.status,
    purchasedDate: row.purchasedDate,
    issuedAmount: row.issuedAmount,
    givenAmount: row.givenAmount,
    paymentType: row.paymentType,
    deliveredOn: row.deliveredOn,
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
