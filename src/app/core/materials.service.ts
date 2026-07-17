import { Injectable, inject, signal } from "@angular/core";
import { Observable } from "rxjs";
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

  createMaterial(input: Partial<MaterialRow>): Observable<MaterialRow> {
    return new Observable((observer) => {
      this.api.createMaterial(input).subscribe({
        next: (res: any) => {
          const material: MaterialRow = {
            id: res.material?.materialId || res.material?._id || res.materialId || res._id,
            projectId: input.projectId || "",
            site: input.site || "",
            name: input.name || "",
            unit: input.unit || "",
            requested: input.requested ?? 0,
            approved: input.approved ?? 0,
            purchased: input.purchased ?? 0,
            consumed: input.consumed ?? 0,
            quantity: input.quantity ?? 0,
            vendor: input.vendor || "",
            poNumber: input.poNumber || "",
            status: input.status || "Pending",
            requestDate: input.requestDate,
            purchasedDate: input.purchasedDate,
            issuedAmount: input.issuedAmount,
            givenAmount: input.givenAmount,
            paymentType: input.paymentType,
            deliveredOn: input.deliveredOn,
          };
          this.materials.update((list) => [material, ...list]);
          this.persist(this.materials());
          observer.next(material);
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  updateMaterial(id: string, patch: Partial<MaterialRow>): Observable<void> {
    return new Observable((observer) => {
      this.api.patchMaterial(id, patch).subscribe({
        next: () => {
          this.materials.update((list) =>
            list.map((m) => (String(m.id) === String(id) ? { ...m, ...patch } : m)),
          );
          this.persist(this.materials());
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  removeMaterial(id: string): Observable<void> {
    return new Observable((observer) => {
      this.api.deleteMaterial(id).subscribe({
        next: () => {
          this.materials.update((list) => list.filter((m) => String(m.id) !== String(id)));
          this.persist(this.materials());
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  private mapMaterial = (row: any): MaterialRow => ({
    id: row.materialId || row._id || row.id,
    projectId: row.projectId,
    site: row.site || row.siteId,
    name: row.name,
    unit: row.unit,
    requested: row.requested ?? row.requestedQuantity ?? 0,
    approved: row.approved ?? row.approvedQuantity ?? 0,
    purchased: row.purchased ?? row.purchasedQuantity ?? 0,
    consumed: row.consumed ?? row.consumedQuantity ?? 0,
    quantity: row.quantity ?? 0,
    vendor: row.vendor,
    poNumber: row.poNumber,
    status: row.status,
    requestDate: row.requestDate,
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