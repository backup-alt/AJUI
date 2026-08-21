import { Injectable, Injector, inject, signal } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";
import { ErpDataService } from "../data/erp-data.service";
import type { MaterialRow } from "../../data/dashboardData";

@Injectable({ providedIn: "root" })
export class MaterialsService {
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  private get data(): ErpDataService {
    return this.injector.get(ErpDataService);
  }

  // Backend is the single source of truth for materials — no localStorage
  // read or write. Signal starts at [] and is populated by hydration
  // and every API call. This eliminates the entire class of "stale
  // localStorage showing placeholder data" bugs the dashboard has been
  // hitting (e.g. AB-1024 / AB-1024 / AB-1024 / Area 1 / Area 2 / Area 3
  // / First Floor static rows overriding the real backend data).
  readonly materials = signal<MaterialRow[]>([]);

  getAll(params?: { projectId?: string; siteId?: string; vendorId?: string; status?: string }) {
    this.api.listMaterials({ ...params, limit: 200, page: 1 }).subscribe({
      next: (r) => {
        const backendItems = (r.items || []).map(this.mapMaterial);
        const items = params
          ? backendItems
          : this.mergeRowsByStableId(this.materials(), backendItems);
        this.materials.set(items);
        this.data.materials.set(items);
      },
      error: () => {
        // Network error: keep whatever we last had.
      },
    });
    return this.materials();
  }

  async refresh() {
    return new Promise<MaterialRow[]>((resolve) => {
      this.api.listMaterials({ limit: 200, page: 1 }).subscribe({
        next: (r) => {
          const backendItems = (r.items || []).map(this.mapMaterial);
          const items = this.mergeRowsByStableId(this.materials(), backendItems);
          this.materials.set(items);
          this.data.materials.set(items);
          resolve(items);
        },
        error: () => resolve(this.materials()),
      });
    });
  }

  createMaterial(input: Partial<MaterialRow>): Observable<MaterialRow> {
    return new Observable((observer) => {
      const payload: any = {
        projectId: input.projectId || undefined,
        site: input.site,
        name: input.name,
        unit: input.unit,
        requestedQuantity: input.requested ?? 0,
        approvedQuantity: input.approved ?? 0,
        purchasedQuantity: input.purchased ?? 0,
        consumedQuantity: input.consumed ?? 0,
        vendor: input.vendor,
        poNumber: input.poNumber,
        requestDate: input.requestDate || new Date().toISOString().slice(0, 10),
        receivedDate: input.receivedDate,
        issuedAmount: input.issuedAmount,
        givenAmount: input.givenAmount,
        isExistingMaterial: input.isExistingMaterial,
        orderedDate: input.orderedDate,
        notes: (input as any).notes,
      };
      this.api.createMaterial(payload).subscribe({
        next: (res: any) => {
          const material: MaterialRow = {
            _id: res.material?._id || res._id,
            id: res.material?.materialId || res.material?._id || res.materialId || res._id,
            materialId: res.material?.materialId || res.materialId,
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
            receivedDate: input.receivedDate,
            purchasedDate: input.purchasedDate,
            issuedAmount: input.issuedAmount,
            givenAmount: input.givenAmount,
            isExistingMaterial: input.isExistingMaterial,
            orderedDate: input.orderedDate,
            paymentType: input.paymentType,
            deliveredOn: input.deliveredOn,
          };
          this.materials.update((list) => [material, ...list]);
          this.data.materials.update((list) => [material, ...list]);
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
          this.data.materials.update((list) => list.filter((m) => String(m.id) !== String(id)));
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  private mapMaterial = (row: any): MaterialRow => ({
    _id: row._id,
    id: row.materialId || row._id || row.id,
    materialId: row.materialId,
    projectId: row.projectId,
    site: row.site || row.siteId,
    name: row.name,
    unit: row.unit,
    requested: row.requested ?? row.requestedQuantity ?? 0,
    approved: row.approved ?? row.approvedQuantity ?? 0,
    purchased: row.purchased ?? row.purchasedQuantity ?? 0,
    consumed: row.consumed ?? row.consumedQuantity ?? 0,
    quantity: row.approved ?? row.quantity ?? row.remainingStock ?? Math.max(0, (row.purchasedQuantity ?? row.purchased ?? 0) - (row.consumedQuantity ?? row.consumed ?? 0)),
    vendor: row.vendor,
    poNumber: row.poNumber,
    // notes may be empty on legacy rows; the supervisor's "Add existing
    // material" note (when the row was synced from the inventory) lands
    // here as well as in the latest purchaseHistory entry.
    notes: row.notes || (Array.isArray(row.purchaseHistory) && row.purchaseHistory.length
      ? (row.purchaseHistory[row.purchaseHistory.length - 1]?.notes || "")
      : "") || "",
    status: row.status,
    requestDate: row.requestDate,
    receivedDate: row.receivedDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    purchasedDate: row.orderedDate || row.purchasedDate,
    orderedDate: row.orderedDate,
    isExistingMaterial: Boolean(row.isExistingMaterial),
    issuedAmount: row.issuedAmount,
    givenAmount: row.givenAmount,
    paymentType: row.paymentType,
    deliveredOn: row.receivedDate || row.deliveredOn,
    billUrl: row.billUrl || (row.receiptImage ? `data:${row.receiptImageMimeType || 'image/jpeg'};base64,${row.receiptImage}` : undefined),
    receiptImage: row.receiptImage,
    receiptImageMimeType: row.receiptImageMimeType,
  });

  private mergeRowsByStableId(existing: MaterialRow[], incoming: MaterialRow[]): MaterialRow[] {
    const keyFor = (row: MaterialRow) => String((row as any).id || (row as any)._id || "").trim();
    const existingByKey = new Map(existing.map((row) => [keyFor(row), row]));
    const output: MaterialRow[] = [];
    const seen = new Set<string>();

    for (const row of incoming) {
      const key = keyFor(row);
      if (!key) {
        output.push(row);
        continue;
      }
      output.push({ ...(existingByKey.get(key) || {}), ...row });
      seen.add(key);
    }

    for (const row of existing) {
      const key = keyFor(row);
      if (key && seen.has(key)) continue;
      output.push(row);
    }

    return output;
  }
}
