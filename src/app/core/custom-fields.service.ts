import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
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
}

@Injectable({ providedIn: "root" })
export class CustomFieldsService {
  private api = inject(ApiService);

  list(entityType: CustomFieldEntityType, entityId: string): Observable<{ fields: CustomField[] }> {
    return this.api.listCustomFields({ entityType, entityId });
  }

  create(input: {
    entityType: CustomFieldEntityType;
    entityId: string;
    key: string;
    label: string;
    value?: string | number | boolean | null;
    fieldType: CustomFieldType;
    order?: number;
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
    }
  ): Observable<{ field: CustomField }> {
    return this.api.updateCustomField(id, patch);
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.api.deleteCustomField(id);
  }
}
