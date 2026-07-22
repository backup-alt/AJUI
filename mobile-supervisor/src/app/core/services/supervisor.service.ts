import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import {
  DashboardData,
  Approval,
  ApprovalsListResponse,
  Material,
  MaterialsListResponse,
  CreateMaterialRequest,
  Labour,
  LabourListResponse,
  CreateLabourRequest,
  Expense,
  ExpenseListResponse,
  CreateExpenseRequest,
  ApprovalActionRequest,
  Site,
  SitesResponse,
  Vendor,
  Worker,
  CreateWorkerRequest,
  Subcontractor,
  Attendance,
  MarkAttendanceRequest,
  AttendanceListResponse,
  WorkerListResponse,
  LabourTypeCount,
} from '../../shared/models';

export interface SiteSelection {
  siteId: string;
  projectId: string;
  projectName: string;
  siteName: string;
}

@Injectable({ providedIn: 'root' })
export class SupervisorService {
  private api = inject(ApiService);
  private _selection = signal<SiteSelection | null>(null);
  readonly selection = this._selection.asReadonly();

  async init(): Promise<void> {
    const [siteId, projectId, projectName, siteName] = await Promise.all([
      this.api.getSelectedSiteId(),
      this.api.getSelectedProjectId(),
      this.api.getSelectedProjectName(),
      this.api.getSelectedSiteName(),
    ]);
    if (siteId && projectId) {
      this._selection.set({ siteId, projectId, projectName: projectName || '', siteName: siteName || '' });
    }
  }

  // ---------------- Profile ----------------
  getProfile() {
    return this.api.get<{ user: unknown; profile: unknown }>('/supervisor/profile');
  }

  // ---------------- Dashboard ----------------
  getDashboard() {
    return this.api.get<{ dashboard: DashboardData }>('/supervisor/dashboard');
  }

  // ---------------- Sites ----------------
  getSites() {
    return this.api.get<SitesResponse>('/supervisor/sites');
  }

  // ---------------- Approvals ----------------
  getApprovals() {
    return this.api.get<ApprovalsListResponse>('/supervisor/approvals');
  }

  getApprovalDetail(approvalId: string) {
    return this.api.get<{ approval: Approval }>(`/supervisor/approvals/${approvalId}`);
  }

  takeApprovalAction(approvalId: string, action: ApprovalActionRequest) {
    return this.api.patch<{ approval: Approval }>(
      `/supervisor/approvals/${approvalId}`,
      action
    );
  }

  // ---------------- Materials ----------------
  getMaterials(filters?: {
    projectId?: string;
    siteId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    return this.api.get<MaterialsListResponse>('/supervisor/materials', filters);
  }

  getMaterialDetail(materialId: string) {
    return this.api.get<{ material: Material }>(`/supervisor/materials/${materialId}`);
  }

  createMaterial(request: CreateMaterialRequest) {
    return this.api.post<{ material: Material }>('/supervisor/materials', request);
  }

  updateMaterialStock(
    materialId: string,
    updates: { purchasedQuantity?: number; consumedQuantity?: number }
  ) {
    return this.api.patch<{ material: Material }>(
      `/supervisor/materials/${materialId}/stock`,
      updates
    );
  }

  uploadMaterialReceipt(
    materialId: string,
    payload: { data: string; mimeType: string; fileName?: string; givenAmount?: number }
  ) {
    return this.api.post<{ material: Material }>(
      `/supervisor/materials/${materialId}/receipt`,
      payload
    );
  }

  // ---------------- Labour ----------------
  getLabourEntries(filters?: {
    projectId?: string;
    siteId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    return this.api.get<LabourListResponse>('/supervisor/labour', filters);
  }

  getLabourDetail(labourId: string) {
    return this.api.get<{ labour: Labour }>(`/supervisor/labour/${labourId}`);
  }

  createLabour(request: CreateLabourRequest) {
    return this.api.post<{ labour: Labour }>('/supervisor/labour', request);
  }

  // ---------------- Workers ----------------
  createWorker(request: CreateWorkerRequest) {
    return this.api.post<{ worker: Worker }>('/supervisor/workers', request);
  }

  getWorkers(filters?: {
    projectId?: string;
    siteId?: string;
    labourType?: string;
    page?: number;
    limit?: number;
  }) {
    return this.api.get<WorkerListResponse>('/supervisor/workers', filters);
  }

  getWorkerDetail(workerId: string) {
    return this.api.get<{ worker: Worker }>(`/supervisor/workers/${workerId}`);
  }

  // ---------------- Attendance ----------------
  markAttendance(request: MarkAttendanceRequest) {
    return this.api.post<{ attendance: Attendance }>('/supervisor/attendance', request);
  }

  getAttendanceForDate(date: string, siteId?: string, projectId?: string) {
    const params: Record<string, string> = { date };
    if (siteId) params['siteId'] = siteId;
    if (projectId) params['projectId'] = projectId;
    return this.api.get<AttendanceListResponse>('/supervisor/attendance', params);
  }

  getAttendanceForWorker(workerId: string, page?: number, limit?: number) {
    const params: Record<string, string | number> = {};
    if (page) params['page'] = page;
    if (limit) params['limit'] = limit;
    return this.api.get<{ items: Attendance[]; total: number; page: number; limit: number; pages: number }>(
      `/supervisor/attendance/worker/${workerId}`,
      params
    );
  }

  getAttendanceDetail(attendanceId: string) {
    return this.api.get<{ attendance: Attendance }>(`/supervisor/attendance/${attendanceId}`);
  }

  updateAttendance(attendanceId: string, patch: Partial<MarkAttendanceRequest>) {
    return this.api.patch<{ attendance: Attendance }>(`/supervisor/attendance/${attendanceId}`, patch);
  }

  deleteAttendance(attendanceId: string) {
    return this.api.delete(`/supervisor/attendance/${attendanceId}`);
  }

  getLabourTypeCounts(siteId: string, date: string) {
    return this.api.get<{ counts: LabourTypeCount[] }>('/supervisor/labour-types', { siteId, date });
  }

  // ---------------- Subcontractors ----------------
  getSubcontractors(projectId: string, siteId?: string) {
    const params: Record<string, string> = { projectId };
    if (siteId) params['siteId'] = siteId;
    return this.api.get<{ subcontractors: Subcontractor[] }>('/supervisor/subcontractors', params);
  }

  // ---------------- Expenses ----------------
  getExpenses(filters?: {
    projectId?: string;
    siteId?: string;
    status?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    return this.api.get<ExpenseListResponse>('/supervisor/expenses', filters);
  }

  getExpenseDetail(expenseId: string) {
    return this.api.get<{ expense: Expense }>(`/supervisor/expenses/${expenseId}`);
  }

  createExpense(request: CreateExpenseRequest) {
    return this.api.post<{ expense: Expense }>('/supervisor/expenses', request);
  }

  uploadReceipt(
    expenseId: string,
    payload: { data: string; mimeType: string; fileName?: string; givenAmount?: number }
  ) {
    return this.api.post<{ expense: Expense }>(
      `/supervisor/expenses/${expenseId}/receipt`,
      payload
    );
  }

  async setSelectedSite(
    siteId: string,
    projectId: string,
    projectName: string,
    siteName?: string
  ): Promise<void> {
    const sel: SiteSelection = {
      siteId,
      projectId,
      projectName,
      siteName: siteName || projectName,
    };
    this._selection.set(sel);
    await this.api.setSelectedSiteId(siteId);
    await this.api.setSelectedProjectId(projectId);
    await this.api.setSelectedProjectName(projectName);
    if (siteName) await this.api.setSelectedSiteName(siteName);
  }

  selectedSiteId(): string | null {
    return this._selection()?.siteId ?? null;
  }

  selectedProjectId(): string | null {
    return this._selection()?.projectId ?? null;
  }

  selectedProjectName(): string | null {
    return this._selection()?.projectName ?? null;
  }

  selectedSiteName(): string | null {
    return this._selection()?.siteName ?? null;
  }

  async clearSiteSelection(): Promise<void> {
    this._selection.set(null);
    await this.api.clearSiteSelection();
  }

  // ---------------- Vendors ----------------
  getVendors(filters?: {
    materialType?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.api.get<{ items: Vendor[]; total: number; page: number; limit: number; pages: number }>('/supervisor/vendors', filters);
  }

  getVendorById(vendorId: string) {
    return this.api.get<{ item: Vendor }>(`/supervisor/vendors/${vendorId}`);
  }
}
