import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  DashboardResponse,
  ProjectsResponse,
  SitesResponse,
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
} from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class SupervisorService {
  private api = inject(ApiService);
  private selectedSiteId: string | null = null;
  private selectedProjectId: string | null = null;
  private selectedProjectName: string | null = null;
  private selectedSiteName: string | null = null;

  async init(): Promise<void> {
    this.selectedSiteId = await this.api.getSelectedSiteId();
    this.selectedProjectId = await this.api.getSelectedProjectId();
    this.selectedProjectName = await this.api.getSelectedProjectName();
    this.selectedSiteName = await this.api.getSelectedSiteName();
  }

  // Profile
  getProfile(): Observable<unknown> {
    return this.api.get('/mobile/supervisor/profile');
  }

  // Dashboard
  getDashboard(): Observable<DashboardResponse> {
    return this.api.get<DashboardResponse>('/mobile/supervisor/dashboard');
  }

  // Projects
  getProjects(): Observable<ProjectsResponse> {
    return this.api.get<ProjectsResponse>('/mobile/supervisor/projects');
  }

  getProjectsDetailed(): Observable<ProjectsResponse> {
    return this.api.get<ProjectsResponse>('/mobile/supervisor/projects/detailed');
  }

  getProjectDetail(projectId: string): Observable<{ project: unknown }> {
    return this.api.get<{ project: unknown }>(`/mobile/supervisor/projects/${projectId}`);
  }

  // Sites
  getSites(): Observable<SitesResponse> {
    return this.api.get<SitesResponse>('/mobile/supervisor/sites');
  }

  // Approvals
  getApprovals(): Observable<ApprovalsListResponse> {
    return this.api.get<ApprovalsListResponse>('/mobile/supervisor/approvals');
  }

  getProjectApprovals(projectId: string): Observable<{ approvals: Approval[] }> {
    return this.api.get<{ approvals: Approval[] }>(
      `/mobile/supervisor/projects/${projectId}/approvals`
    );
  }

  getApprovalDetail(approvalId: string): Observable<{ approval: Approval }> {
    return this.api.get<{ approval: Approval }>(`/mobile/supervisor/approvals/${approvalId}`);
  }

  takeApprovalAction(approvalId: string, action: ApprovalActionRequest): Observable<unknown> {
    return this.api.patch<unknown>(`/mobile/supervisor/approvals/${approvalId}`, action);
  }

  // Materials
  getMaterials(filters?: {
    projectId?: string;
    siteId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Observable<MaterialsListResponse> {
    return this.api.get<MaterialsListResponse>('/mobile/supervisor/materials', filters as Record<string, string>);
  }

  getMaterialDetail(materialId: string): Observable<{ material: Material }> {
    return this.api.get<{ material: Material }>(`/mobile/supervisor/materials/${materialId}`);
  }

  createMaterial(request: CreateMaterialRequest): Observable<{ material: Material }> {
    return this.api.post<{ material: Material }>('/mobile/supervisor/materials', request);
  }

  updateMaterialStock(materialId: string, updates: { purchasedQuantity?: number; consumedQuantity?: number }): Observable<{ material: Material }> {
    return this.api.patch<{ material: Material }>(`/mobile/supervisor/materials/${materialId}/stock`, updates);
  }

  // Labour
  getLabourEntries(filters?: {
    projectId?: string;
    siteId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Observable<LabourListResponse> {
    return this.api.get<LabourListResponse>('/mobile/supervisor/labour', filters as Record<string, string>);
  }

  getLabourDetail(labourId: string): Observable<{ labour: Labour }> {
    return this.api.get<{ labour: Labour }>(`/mobile/supervisor/labour/${labourId}`);
  }

  createLabour(request: CreateLabourRequest): Observable<{ labour: Labour }> {
    return this.api.post<{ labour: Labour }>('/mobile/supervisor/labour', request);
  }

  // Expenses
  getExpenses(filters?: {
    projectId?: string;
    siteId?: string;
    status?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Observable<ExpenseListResponse> {
    return this.api.get<ExpenseListResponse>('/mobile/supervisor/expenses', filters as Record<string, string>);
  }

  getExpenseDetail(expenseId: string): Observable<{ expense: Expense }> {
    return this.api.get<{ expense: Expense }>(`/mobile/supervisor/expenses/${expenseId}`);
  }

  createExpense(request: CreateExpenseRequest): Observable<{ expense: Expense }> {
    return this.api.post<{ expense: Expense }>('/mobile/supervisor/expenses', request);
  }

  // Site Selection
  async setSelectedSite(siteId: string, projectId: string, projectName: string, siteName?: string): Promise<void> {
    this.selectedSiteId = siteId;
    this.selectedProjectId = projectId;
    this.selectedProjectName = projectName;
    this.selectedSiteName = siteName || projectName;
    await this.api.setSelectedSiteId(siteId);
    await this.api.setSelectedProjectId(projectId);
    await this.api.setSelectedProjectName(projectName);
    if (siteName) await this.api.setSelectedSiteName(siteName);
  }

  async getSelectedSiteId(): Promise<string | null> {
    return this.selectedSiteId || this.api.getSelectedSiteId();
  }

  async getSelectedProjectId(): Promise<string | null> {
    return this.selectedProjectId || this.api.getSelectedProjectId();
  }

  async getSelectedProjectName(): Promise<string | null> {
    return this.selectedProjectName || this.api.getSelectedProjectName();
  }

  async getSelectedSiteName(): Promise<string | null> {
    return this.selectedSiteName || this.api.getSelectedSiteName();
  }

  async clearSiteSelection(): Promise<void> {
    this.selectedSiteId = null;
    this.selectedProjectId = null;
    this.selectedProjectName = null;
    this.selectedSiteName = null;
    await this.api.clearSiteSelection();
  }

  getSelectedSiteIdSync(): string | null {
    return this.selectedSiteId;
  }

  getSelectedProjectIdSync(): string | null {
    return this.selectedProjectId;
  }

  getSelectedProjectNameSync(): string | null {
    return this.selectedProjectName;
  }

  getSelectedSiteNameSync(): string | null {
    return this.selectedSiteName;
  }
}