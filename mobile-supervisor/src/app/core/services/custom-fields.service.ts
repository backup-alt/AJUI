import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { CustomField } from '../../shared/models';

export type CustomFieldEntityType =
  | 'clients'
  | 'projects'
  | 'materials'
  | 'labour'
  | 'expenses'
  | 'payments'
  | 'vendors'
  | 'subcontractors';

@Injectable({ providedIn: 'root' })
export class CustomFieldsService {
  private api = inject(ApiService);

  /**
   * Get fields for a single (entityType, entityId). Internally routes
   * through the bulk endpoint so we never hit the legacy single-entity
   * GET (`/custom-fields?entityType=X&entityId=Y`) — that endpoint was
   * removed server-side because an N×M call storm tripped Render's
   * rate limiter (HTTP 429). The bulk endpoint handles all callers
   * uniformly and caches per-(entityType, sortedEntityIds,
   * supervisorOnly) so a request for just `[siteId]` shares a cache
   * entry with a request for `[siteId, neighbourSiteId, ...]`.
   */
  async listForEntity(
    entityType: CustomFieldEntityType,
    entityId: string
  ): Promise<CustomField[]> {
    if (!entityId) return [];
    const res = await firstValueFrom(this.listBulk(entityType, [entityId], true));
    return res[entityId] || [];
  }

  listBulk(
    entityType: CustomFieldEntityType,
    entityIds: string[],
    supervisorOnly = false
  ): Observable<Record<string, CustomField[]>> {
    const cleaned = entityIds
      .map((id) => String(id || '').trim())
      .filter((id) => id);
    if (!cleaned.length) return of({});
    return this.api
      .post<{ grouped: Record<string, CustomField[]> }>('/custom-fields/list', {
        entityType: entityType,
        entityIds: cleaned,
        supervisorOnly: supervisorOnly ? 'true' : undefined
      })
      .pipe(map((res) => res.grouped || {}));
  }

  async createField(input: {
    entityType: CustomFieldEntityType;
    entityId: string;
    key: string;
    label: string;
    value?: string | number | boolean | null;
    fieldType: 'text' | 'number' | 'date' | 'boolean';
    order?: number;
  }): Promise<CustomField> {
    const response = await firstValueFrom(
      this.api.post<{ field: CustomField }>('/custom-fields', input)
    );
    return response.field;
  }

  async updateField(
    id: string,
    patch: {
      label?: string;
      value?: string | number | boolean | null;
      fieldType?: 'text' | 'number' | 'date' | 'boolean';
      order?: number;
    }
  ): Promise<CustomField> {
    const response = await firstValueFrom(
      this.api.patch<{ field: CustomField }>(`/custom-fields/${id}`, patch)
    );
    return response.field;
  }

  async deleteField(id: string): Promise<void> {
    await firstValueFrom(this.api.delete(`/custom-fields/${id}`));
  }
}
