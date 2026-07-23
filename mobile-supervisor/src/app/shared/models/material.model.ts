export type MaterialStatus = 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Received' | 'Not Received';

export interface Material {
  _id: string;
  materialId: string;
  projectId: string;
  projectName: string;
  clientId: string;
  siteId?: string;
  site: string;
  name: string;
  unit: string;
  requestedQuantity: number;
  approvedQuantity: number;
  purchasedQuantity: number;
  consumedQuantity: number;
  remainingStock: number;
  vendor?: string;
  vendorId?: string;
  poNumber?: string;
  billUrl?: string;
  requestDate: string;
  approvalDate?: string;
  status: MaterialStatus;
  notes?: string;
  issuedAmount?: number;
  givenAmount?: number;
  customFields?: Record<string, string | number | boolean | null>;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  purchaseHistory?: PurchaseHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseHistoryEntry {
  vendor: string;
  quantity: number;
  date: string;
}

export interface CustomField {
  id: string;
  key: string;
  label: string;
  value: string | number | boolean | null;
  fieldType: 'text' | 'number' | 'date' | 'boolean';
  order: number;
  askSupervisor: boolean;
}

export interface CreateMaterialRequest {
  projectId: string;
  siteId: string;
  site?: string;
  name: string;
  unit: string;
  requestedQuantity: number;
  remainingStock?: number;
  vendor?: string;
  vendorId?: string;
  poNumber?: string;
  requestDate: string;
  notes?: string;
  issuedAmount?: number;
  customFields?: Record<string, string | number | boolean | null>;
}

export interface MaterialsListResponse {
  materials: Material[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  total?: number;
  page?: number;
  limit?: number;
}

export interface MaterialFilters {
  projectId?: string;
  siteId?: string;
  status?: MaterialStatus;
  search?: string;
  page?: number;
  limit?: number;
}
