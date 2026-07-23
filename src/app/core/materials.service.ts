import { Injectable, Injector, inject, signal } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";
import { ErpDataService } from "../data/erp-data.service";
import type { MaterialRow, MaterialStatus } from "../../data/dashboardData";

@Injectable({ providedIn: "root" })
export class MaterialsService {
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  private get data(): ErpDataService {
    return this.injector.get(ErpDataService);
  }
  private readonly storageKey = "agb-erp:materials";

  readonly materials = signal<MaterialRow[]>(this.readState());

  getAll(params?: { projectId?: string; siteId?: string; vendorId?: string; status?: string; site?: string }) {
    this.api.listMaterials({ ...params, limit: 100 }).subscribe({
      next: (r) => {
        const backendItems = (r.items || []).map(this.mapMaterial);
        const localItems = this.materials();
        const backendIds = new Set(backendItems.map((i) => i.id));
        const merged = [...backendItems, ...localItems.filter((i) => !backendIds.has(i.id))];
        this.materials.set(merged);
        this.persist(merged);
        this.data.materials.set(merged);
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
          this.data.materials.set(merged);
          resolve(merged);
        },
        error: () => resolve(this.materials()),
      });
    });
  }

  /**
   * Accepts either the local MaterialRow shape (with `requested`, `approved`,
   * `purchased`, `consumed`) or the backend Zod schema shape (with
   * `requestedQuantity`, `approvedQuantity`, `purchasedQuantity`,
   * `consumedQuantity`). Passes the payload through to the API and adapts
   * the backend response into the local MaterialRow shape before persisting.
   */
  createMaterial(input: Partial<MaterialRow> & Record<string, any>): Observable<MaterialRow> {
    const payload: any = { ...input };
    // Translate legacy field names to backend schema
    if (payload.requested !== undefined && payload.requestedQuantity === undefined) {
      payload.requestedQuantity = payload.requested;
      delete payload.requested;
    }
    if (payload.approved !== undefined && payload.approvedQuantity === undefined) {
      payload.approvedQuantity = payload.approved;
      delete payload.approved;
    }
    if (payload.purchased !== undefined && payload.purchasedQuantity === undefined) {
      payload.purchasedQuantity = payload.purchased;
      delete payload.purchased;
    }
    if (payload.consumed !== undefined && payload.consumedQuantity === undefined) {
      payload.consumedQuantity = payload.consumed;
      delete payload.consumed;
    }
    // Map old status values to the new 2-value enum
    if (payload.status && !["Received", "Not Received"].includes(payload.status)) {
      payload.status = "Not Received";
    }

    return new Observable((observer) => {
      this.api.createMaterial(payload).subscribe({
        next: (res: any) => {
          const backend = res?.material ?? res;
          const material: MaterialRow = {
            id: backend.materialId || backend._id || backend.id,
            projectId: backend.projectId || input.projectId || "",
            site: backend.site || input.site || "",
            name: backend.name || input.name || "",
            unit: backend.unit || input.unit || "",
            requested: backend.requestedQuantity ?? input.requested ?? 0,
            approved: backend.approvedQuantity ?? input.approved ?? 0,
            purchased: backend.purchasedQuantity ?? input.purchased ?? 0,
            consumed: backend.consumedQuantity ?? input.consumed ?? 0,
            quantity: backend.remainingStock ?? input.quantity ?? 0,
            vendor: backend.vendor || input.vendor || "",
            poNumber: backend.poNumber || input.poNumber || "",
            status: (["Received", "Not Received"].includes(backend.status) ? backend.status : "Not Received") as MaterialStatus,
            requestDate: backend.requestDate || input.requestDate,
            purchasedDate: input.purchasedDate,
            issuedAmount: backend.issuedAmount,
            givenAmount: backend.givenAmount,
            paymentType: input.paymentType,
            deliveredOn: input.deliveredOn,
          };
          this.materials.update((list) => [material, ...list]);
          this.persist(this.materials());
          this.data.materials.update((list) => [material, ...list]);
          observer.next(material);
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  updateMaterial(id: string, patch: Partial<MaterialRow> & Record<string, any>): Observable<void> {
    // Translate legacy field names to backend schema
    const payload: any = { ...patch };
    if (payload.requested !== undefined && payload.requestedQuantity === undefined) payload.requestedQuantity = payload.requested;
    if (payload.approved !== undefined && payload.approvedQuantity === undefined) payload.approvedQuantity = payload.approved;
    if (payload.purchased !== undefined && payload.purchasedQuantity === undefined) payload.purchasedQuantity = payload.purchased;
    if (payload.consumed !== undefined && payload.consumedQuantity === undefined) payload.consumedQuantity = payload.consumed;
    if (payload.status && !["Received", "Not Received"].includes(payload.status)) payload.status = "Not Received";

    return new Observable((observer) => {
      this.api.patchMaterial(id, payload).subscribe({
        next: () => {
          this.materials.update((list) =>
            list.map((m) => (String(m.id) === String(id) ? { ...m, ...patch } : m)),
          );
          this.persist(this.materials());
          this.data.materials.update((list) =>
            list.map((m) => (String(m.id) === String(id) ? { ...m, ...patch } : m)),
          );
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
          this.data.materials.update((list) => list.filter((m) => String(m.id) !== String(id)));
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
    quantity: row.quantity ?? row.remainingStock ?? Math.max(0, (row.purchasedQuantity ?? row.purchased ?? 0) - (row.consumedQuantity ?? row.consumed ?? 0)),
    vendor: row.vendor,
    poNumber: row.poNumber,
    status: (["Received", "Not Received"].includes(row.status) ? row.status : "Not Received") as MaterialStatus,
    requestDate: row.requestDate,
    purchasedDate: row.purchasedDate,
    issuedAmount: row.issuedAmount,
    givenAmount: row.givenAmount,
    paymentType: row.paymentType,
    deliveredOn: row.deliveredOn,
    billUrl: row.billUrl || (row.receiptImage ? `data:${row.receiptImageMimeType || 'image/jpeg'};base64,${row.receiptImage}` : undefined),
    receiptImage: row.receiptImage,
    receiptImageMimeType: row.receiptImageMimeType,
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