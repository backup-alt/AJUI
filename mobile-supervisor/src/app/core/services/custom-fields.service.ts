import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

  async listForEntity(
    entityType: CustomFieldEntityType,
    entityId: string
  ): Promise<CustomField[]> {
    const response = await firstValueFrom(
      this.api.get<{ fields: CustomField[] }>('/custom-fields', {
        entityType,
        entityId,
        supervisorOnly: 'true',
      })
    );
    return response.fields || [];
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
