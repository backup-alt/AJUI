export type MaterialStatus = 'Pending' | 'Approved' | 'Rejected';

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
  requestDate: string;
  approvalDate?: string;
  status: MaterialStatus;
  notes?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
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