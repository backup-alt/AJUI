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
   * In-flight caches.
   *
   * IMPORTANT: there is no per-(entityType, entityId) cache key. The
   * `list()` and `listBulk()` paths BOTH go through the bulk endpoint
   * (`POST /api/custom-fields/list`). The legacy single-entity GET
   * (`GET /api/custom-fields?entityType=X&entityId=Y`) was removed
   * server-side because it produced an N×M call storm that tripped
   * Render's rate limiter (HTTP 429). Every consumer — admin pages,
   * workspace hydration, supervisor mobile — must use the bulk
   * endpoint, even when they only need fields for one entityId, so
   * that the in-flight cache can dedupe across all callers.
   *
   * `listBulkCache` is keyed by the canonicalised (entityType,
   * sortedEntityIds, supervisorOnly) tuple so a request for entityIds
   * `[A]` and `[A, B]` share a cache entry when A is in both — but
   * the cached response is filtered to just `[A]` when needed.
   */
  private listBulkCache = new Map<string, Observable<{ grouped: Record<string, CustomField[]> }>>();

  private bulkKey(entityType: string, ids: string[], supervisorOnly: boolean): string {
    return `${entityType}|${ids.slice().sort().join(",")}|${supervisorOnly ? 1 : 0}`;
  }

  /**
   * Get fields for a single (entityType, entityId). Internally routes
   * through `listBulk([entityId])` so all callers share one HTTP
   * roundtrip when possible. Cached per-(entityType, sortedIds,
   * supervisorOnly).
   */
  list(entityType: CustomFieldEntityType, entityId: string, supervisorOnly = false): Observable<{ fields: CustomField[] }> {
    if (!entityId) {
      // Skip the HTTP call entirely for empty IDs — protects against
      // legacy code paths looping over rows that lack an _id field.
      return of({ fields: [] });
    }
    // Reuse the bulk cache by going through listBulk. We map the
    // grouped response back to the single-entity shape so callers
    // don't need to change their imports / types.
    return new Observable<{ fields: CustomField[] }>((subscriber) => {
      const sub = this.listBulk(entityType, [entityId], supervisorOnly).subscribe({
        next: (res) => {
          const fields = res.grouped?.[entityId] || [];
          subscriber.next({ fields });
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
      return () => sub.unsubscribe();
    });
  }

  listBulk(
    entityType: CustomFieldEntityType,
    entityIds: string[],
    supervisorOnly = false
  ): Observable<{ grouped: Record<string, CustomField[]> }> {
    const cleaned = entityIds.map((id) => String(id || "").trim()).filter((id) => id);
    if (!cleaned.length) {
      return of({ grouped: {} });
    }
    const key = this.bulkKey(entityType, cleaned, supervisorOnly);
    const cached = this.listBulkCache.get(key);
    if (cached) return cached;
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
   * Drop the in-flight bulk cache. Called by the ERP data service
   * when the workspace hydration cache is invalidated (e.g. after a
   * user-triggered full refresh).
   */
  clearCache(): void {
    this.listBulkCache.clear();
  }
}
