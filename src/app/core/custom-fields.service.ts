import { Injectable, inject } from "@angular/core";
import { Observable, of } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { ApiService } from "./api.service";

export type CustomFieldEntityType =
  | "clients"
  | "projects"
  | "materials"
  | "labour"
  | "expenses"
  | "payments"
  | "vendors"
  | "subcontractors";

export type CustomFieldType = "text" | "number" | "date" | "boolean";

export interface CustomField {
  id: string;
  key: string;
  label: string;
  value: string | number | boolean | null;
  fieldType: CustomFieldType;
  order: number;
  askSupervisor: boolean;
}

@Injectable({ providedIn: "root" })
export class CustomFieldsService {
  private api = inject(ApiService);

  /**
   * Per-(entityType, entityId) in-flight cache. Multiple callers asking
   * for the same fields get the same Observable — and the same backend
   * response — instead of triggering duplicate HTTP calls (which is what
   * was hammering the rate limiter when the dashboard hydrated many
   * tables at once).
   */
  private listCache = new Map<string, Observable<{ fields: CustomField[] }>>();
  private listBulkCache = new Map<string, Observable<{ grouped: Record<string, CustomField[]> }>>();

  private listKey(entityType: string, entityId: string, supervisorOnly: boolean): string {
    return `${entityType}|${entityId}|${supervisorOnly ? 1 : 0}`;
  }
  private bulkKey(entityType: string, ids: string[], supervisorOnly: boolean): string {
    return `${entityType}|${ids.slice().sort().join(",")}|${supervisorOnly ? 1 : 0}`;
  }

  list(entityType: CustomFieldEntityType, entityId: string, supervisorOnly = false): Observable<{ fields: CustomField[] }> {
    const key = this.listKey(entityType, entityId, supervisorOnly);
    const cached = this.listCache.get(key);
    if (cached) return cached;
    if (!entityId) {
      // Skip the HTTP call entirely for empty IDs — protects against the
      // legacy code path looping over rows with no _id field.
      return of({ fields: [] });
    }
    const req = this.api.listCustomFields({ entityType, entityId, supervisorOnly }).pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.listCache.set(key, req);
    return req;
  }

  listBulk(
    entityType: CustomFieldEntityType,
    entityIds: string[],
    supervisorOnly = false
  ): Observable<{ grouped: Record<string, CustomField[]> }> {
    const cleaned = entityIds.map((id) => String(id || "").trim()).filter((id) => id);
    const key = this.bulkKey(entityType, cleaned, supervisorOnly);
    const cached = this.listBulkCache.get(key);
    if (cached) return cached;
    if (!cleaned.length) {
      return of({ grouped: {} });
    }
    const req = this.api.listCustomFieldsBulk({ entityType, entityIds: cleaned, supervisorOnly }).pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.listBulkCache.set(key, req);
    return req;
  }

  create(input: {
    entityType: CustomFieldEntityType;
    entityId: string;
    key: string;
    label: string;
    value?: string | number | boolean | null;
    fieldType: CustomFieldType;
    order?: number;
    askSupervisor?: boolean;
  }): Observable<{ field: CustomField }> {
    return this.api.createCustomField(input);
  }

  update(
    id: string,
    patch: {
      label?: string;
      value?: string | number | boolean | null;
      fieldType?: CustomFieldType;
      order?: number;
      askSupervisor?: boolean;
    }
  ): Observable<{ field: CustomField }> {
    return this.api.updateCustomField(id, patch);
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.api.deleteCustomField(id);
  }

  /**
   * Drop the per-(entityType, entityId) in-flight caches. Called by the
   * ERP data service when the workspace hydration cache is invalidated
   * (e.g. after a user-triggered full refresh).
   */
  clearCache(): void {
    this.listCache.clear();
    this.listBulkCache.clear();
  }
}
