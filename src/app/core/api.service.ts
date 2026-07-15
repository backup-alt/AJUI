import { Injectable, signal, computed, inject } from "@angular/core";
import { HttpClient, HttpHeaders, HttpInterceptorFn, HttpHandlerFn, HttpRequest, HttpEvent, HttpErrorResponse } from "@angular/common/http";
import { Observable, from, throwError, catchError, switchMap, tap, of } from "rxjs";
import { environment } from "../../environments/environment";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  managedProjectIds?: string[];
}

export interface LoginResponse {
  user: ApiUser;
  accessToken: string;
  expiresAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: "ajui_access_token",
  REFRESH_TOKEN: "ajui_refresh_token",
  USER: "ajui_user",
  EXPIRES_AT: "ajui_expires_at",
};

@Injectable({ providedIn: "root" })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  // Reactive state
  private accessTokenSignal = signal<string | null>(this.getStored(STORAGE_KEYS.ACCESS_TOKEN));
  private userSignal = signal<ApiUser | null>(this.getStoredUser());
  private expiresAtSignal = signal<string | null>(this.getStored(STORAGE_KEYS.EXPIRES_AT));

  accessToken = this.accessTokenSignal.asReadonly();
  user = this.userSignal.asReadonly();
  expiresAt = this.expiresAtSignal.asReadonly();
  isAuthenticated = computed(() => !!this.accessTokenSignal() && !!this.userSignal());

  // =================== AUTH ===================
  login(identifier: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, { identifier, password }).pipe(
      tap((res) => this.setSession(res)),
      catchError(this.handleError)
    );
  }

  setEmployeeSession(user: ApiUser, accessToken: string, expiresAt: string): void {
    this.accessTokenSignal.set(accessToken);
    this.userSignal.set(user);
    this.expiresAtSignal.set(expiresAt);
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt);
    } catch {}
  }

  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/auth/forgot-password`,
      { email }
    ).pipe(catchError(this.handleError));
  }

  resetPassword(token: string, password: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/auth/reset-password`,
      { token, password }
    ).pipe(catchError(this.handleError));
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.clearSession()),
      catchError((err) => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  fetchMe(): Observable<{ user: ApiUser }> {
    return this.http.get<{ user: ApiUser }>(`${this.baseUrl}/auth/me`, { headers: this.authHeaders() }).pipe(
      tap((res) => this.userSignal.set(res.user)),
      catchError(this.handleError)
    );
  }

  // =================== CLIENTS ===================
  listClients(params?: { search?: string; status?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/clients${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  deleteClient(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/clients/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== SUPERVISOR INVITES ===================
  createSupervisorInvite(payload: {
    supervisorName: string;
    supervisorEmail: string;
    supervisorPhone?: string;
    projectId?: string;
    siteIds?: string[];
  }): Observable<{
    inviteId: string;
    token: string;
    qrUrl: string;
    qrPayload: { token: string; supervisorName: string; supervisorPhone?: string; siteIds?: string[]; expiresAt: number };
    qrDataUrl: string;
    supervisorName: string;
    supervisorEmail: string;
    supervisorPhone?: string;
    role: string;
    projectId?: string;
    expiresAt: string;
    createdAt: string;
    otp?: string;
    emailSent?: boolean;
  }> {
    return this.http.post<any>(`${this.baseUrl}/admin/invites/supervisor`, payload, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  listActiveInvites(): Observable<{
    invites: Array<{
      inviteId: string;
      token: string;
      supervisorName: string;
      supervisorEmail: string;
      role: string;
      projectId?: string;
      expiresAt: string;
      createdAt: string;
      remainingMs: number;
    }>;
  }> {
    return this.http.get<any>(`${this.baseUrl}/admin/invites/active`, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  listActiveEmployeeInvites(): Observable<{
    invites: Array<{
      inviteId: string;
      token: string;
      name: string;
      email: string;
      phone?: string;
      role: string;
      expiresAt: string;
      createdAt: string;
      remainingMs: number;
    }>;
  }> {
    return this.http.get<any>(`${this.baseUrl}/admin/invites/employee/active`, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  resendInviteOtp(token: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/invites/supervisor/resend-otp`, { token }, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  deactivateSupervisor(payload: { email?: string; phone?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/users/deactivate`, payload, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  // =================== MATERIALS ===================
  deleteMaterial(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/materials/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  patchMaterial(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/materials/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== LABOUR ===================
  deleteLabour(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/labour/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  patchLabour(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/labour/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== EXPENSES ===================
  deleteExpense(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/expenses/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  patchExpense(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/expenses/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== PAYMENTS ===================
  deletePayment(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/payments/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  patchPayment(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/payments/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== VENDORS ===================
  deleteVendor(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/vendors/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  patchVendor(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/vendors/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  createVendor(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== QUOTATIONS ===================
  deleteQuotation(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/quotations/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  patchQuotation(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/quotations/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  createQuotation(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/quotations`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  listQuotations(params?: { page?: number; limit?: number; search?: string }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/quotations${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== SUBCONTRACTORS ===================
  deleteSubcontractor(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/subcontractors/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  patchSubcontractor(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/subcontractors/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== CLIENTS PATCH ===================
  patchClient(id: string, payload: any): Observable<any> {
    // Backend uses PUT for client update; use PUT here for compatibility.
    return this.http.put(`${this.baseUrl}/clients/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getClient(id: string): Observable<{ client: any }> {
    return this.http.get<{ client: any }>(`${this.baseUrl}/clients/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getClientSummary(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/clients/${id}/summary`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== PROJECTS ===================
  listProjects(params?: { search?: string; status?: string; clientId?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/projects${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getProject(id: string): Observable<{ project: any }> {
    return this.http.get<{ project: any }>(`${this.baseUrl}/projects/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getProjectLedger(id: string): Observable<{ ledger: any }> {
    return this.http.get<{ ledger: any }>(`${this.baseUrl}/projects/${id}/ledger`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== DASHBOARD ===================
  getKPIs(): Observable<{ kpis: any }> {
    return this.http.get<{ kpis: any }>(`${this.baseUrl}/dashboard/kpis`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getUniversalDashboard(params?: { projectId?: string; clientId?: string; from?: string; to?: string }): Observable<any> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get(`${this.baseUrl}/dashboard/universal${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== APPROVALS ===================
  listApprovals(params?: { type?: string; status?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/approvals${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  approveApproval(id: string): Observable<{ approval: any }> {
    return this.http.put<{ approval: any }>(`${this.baseUrl}/approvals/${id}/approve`, {}, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  rejectApproval(id: string): Observable<{ approval: any }> {
    return this.http.put<{ approval: any }>(`${this.baseUrl}/approvals/${id}/reject`, {}, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== SITES ===================
  listSites(): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/sites?limit=100`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  listSitesAdmin(): Observable<{ sites: any[] }> {
    return this.http.get<{ sites: any[] }>(`${this.baseUrl}/admin/sites`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getSiteMaterials(siteId: string): Observable<{ materials: any[] }> {
    return this.http.get<{ materials: any[] }>(`${this.baseUrl}/admin/sites/${siteId}/materials`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== VENDORS ===================
  listVendors(params?: { materialType?: string; status?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/vendors${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== SUPERVISORS ===================
  listSupervisors(params?: { status?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/supervisors${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== MATERIALS ===================
  listMaterials(params?: { projectId?: string; siteId?: string; vendorId?: string; status?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/materials${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== LABOUR ===================
  listLabour(params?: { projectId?: string; siteId?: string; category?: string; status?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/labour${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== EXPENSES ===================
  listExpenses(params?: { type?: string; projectId?: string; siteId?: string; status?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/expenses${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== PAYMENTS ===================
  listPayments(params?: { projectId?: string; clientId?: string; status?: string; mode?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/payments${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== SUBCONTRACTORS ===================
  listSubcontractors(params?: { projectId?: string; approvalStatus?: string; paymentStatus?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/subcontractors${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== ACCOUNT ===================
  patchMe(payload: { name?: string; phone?: string }): Observable<{ user: ApiUser }> {
    return this.http.patch<{ user: ApiUser }>(`${this.baseUrl}/auth/me`, payload, { headers: this.authHeaders() }).pipe(
      tap((res) => this.userSignal.set(res.user)),
      catchError(this.handleError)
    );
  }

  changePassword(payload: { currentPassword: string; newPassword: string }): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(`${this.baseUrl}/auth/password`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== SESSIONS ===================
  listSessions(): Observable<{ sessions: Array<{ id: string; device: string; ip: string; location?: string; lastActiveAt: string; isCurrent: boolean; createdAt: string }> }> {
    return this.http.get<{ sessions: any[] }>(`${this.baseUrl}/auth/sessions`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  listAllSessions(): Observable<{ sessions: Array<{ id: string; device: string; ip: string; location?: string; userEmail?: string; userRole?: string; lastActiveAt: string; isCurrent: boolean; createdAt: string }> }> {
    return this.http.get<{ sessions: any[] }>(`${this.baseUrl}/admin/sessions`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  revokeSession(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/auth/sessions/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  revokeAllOtherSessions(): Observable<{ success: boolean; revokedCount: number }> {
    return this.http.delete<{ success: boolean; revokedCount: number }>(`${this.baseUrl}/auth/sessions`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== USER PREFERENCES ===================
  getNotificationPrefs(): Observable<{
    pushNewSubmission: boolean;
    singleApprovalForSiteExpenseMaterials: boolean;
  }> {
    return this.http.get<any>(`${this.baseUrl}/users/me/notifications`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  saveNotificationPrefs(prefs: {
    pushNewSubmission?: boolean;
    singleApprovalForSiteExpenseMaterials?: boolean;
  }): Observable<{ success: boolean; prefs: any }> {
    return this.http.put<{ success: boolean; prefs: any }>(`${this.baseUrl}/users/me/notifications`, prefs, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getAppearancePrefs(): Observable<{
    theme: "light" | "dark" | "system";
    density: "compact" | "comfortable" | "roomy";
    fontSize: "sm" | "md" | "lg";
  }> {
    return this.http.get<any>(`${this.baseUrl}/users/me/appearance`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  saveAppearancePrefs(prefs: {
    theme?: "light" | "dark" | "system";
    density?: "compact" | "comfortable" | "roomy";
    fontSize?: "sm" | "md" | "lg";
  }): Observable<{ success: boolean; prefs: any }> {
    return this.http.put<{ success: boolean; prefs: any }>(`${this.baseUrl}/users/me/appearance`, prefs, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== EMPLOYEES (Admin) ===================
  listEmployees(params?: { search?: string; role?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/admin/users${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getEmployee(id: string): Observable<{ employee: any }> {
    return this.http.get<{ employee: any }>(`${this.baseUrl}/admin/users/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  patchEmployee(id: string, payload: any): Observable<{ employee: any }> {
    return this.http.patch<{ employee: any }>(`${this.baseUrl}/admin/users/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getEmployeePermissions(id: string): Observable<{
    permissions: Array<{ key: string; label: string; canApprove: boolean; canReject: boolean }>;
  }> {
    return this.http.get<any>(`${this.baseUrl}/admin/users/${id}/permissions`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  saveEmployeePermissions(id: string, payload: { permissions: Array<{ key: string; canApprove: boolean; canReject: boolean }> }): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.baseUrl}/admin/users/${id}/permissions`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getEmployeeRequestPermissions(id: string): Observable<{
    canApproveMaterial: boolean;
    canApproveLabour: boolean;
    canApproveExpense: boolean;
    canApproveGeneral: boolean;
    canApproveSubcontract: boolean;
    canApprovePayment: boolean;
    canManageWorkers: boolean;
    canViewReports: boolean;
  }> {
    return this.http.get<any>(`${this.baseUrl}/admin/users/${id}/request-permissions`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  saveEmployeeRequestPermissions(id: string, payload: any): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.baseUrl}/admin/users/${id}/request-permissions`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getEmployeeActivity(id: string, params?: { days?: number; limit?: number }): Observable<{
    activity: Array<{ id: string; action: string; description: string; timestamp: string; meta?: any }>;
  }> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<any>(`${this.baseUrl}/admin/users/${id}/activity${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== EMPLOYEE INVITE FLOW (Two-Step) ===================
  createEmployeeInvite(payload: {
    name: string;
    email: string;
    phone?: string;
    role: "Admin" | "Project Manager" | "Accountant";
    projectIds?: string[];
  }): Observable<{
    inviteId: string;
    token: string;
    inviteUrl: string;
    supervisorName: string;
    supervisorEmail: string;
    role: string;
    expiresAt: string;
    createdAt: string;
    emailSent?: boolean;
  }> {
    const roleMap: Record<string, string> = {
      Admin: "admin",
      "Project Manager": "project_manager",
      Accountant: "accountant",
    };
    const backendRole = roleMap[payload.role] || "project_manager";
    return this.http.post<any>(`${this.baseUrl}/admin/invites/employee`, { ...payload, role: backendRole }, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  sendEmployeeOtp(token: string): Observable<{ success: boolean; emailSent: boolean; expiresIn: number }> {
    return this.http.post<any>(`${this.baseUrl}/auth/employee/resend-otp`, { token }, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  verifyEmployeeOtp(token: string, otp: string, password: string): Observable<{ success: boolean; user?: any; accessToken?: string; expiresAt?: string; message?: string }> {
    return this.http.post<any>(`${this.baseUrl}/auth/employee/verify-otp`, { token, otp, password }).pipe(
      catchError(this.handleError)
    );
  }

  verifyEmployeeToken(token: string): Observable<{ valid: boolean; email?: string; name?: string; role?: string; expiresAt?: string }> {
    return this.http.get<any>(`${this.baseUrl}/auth/employee/verify/${token}`).pipe(
      catchError(this.handleError)
    );
  }

  // =================== SUPERVISOR EMAIL INVITE ===================
  sendSupervisorEmail(token: string): Observable<{ success: boolean; emailSent: boolean }> {
    return this.http.post<any>(`${this.baseUrl}/admin/invites/supervisor/send-email`, { token }, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== ACCESS SCHEDULE ===================
  getAccessSchedule(): Observable<{
    enabled: boolean;
    windows: Array<{
      id: string;
      startTime: string;
      endTime: string;
      days: string[];
      appliesTo: string[];
      note?: string;
      isActive: boolean;
    }>;
  }> {
    return this.http.get<any>(`${this.baseUrl}/admin/access-schedule`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  saveAccessSchedule(payload: {
    enabled: boolean;
    windows: Array<{
      id?: string;
      startTime: string;
      endTime: string;
      days: string[];
      appliesTo: string[];
      note?: string;
      isActive: boolean;
    }>;
  }): Observable<{ success: boolean; schedule: any }> {
    return this.http.put<{ success: boolean; schedule: any }>(`${this.baseUrl}/admin/access-schedule`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getAccessScheduleStatus(): Observable<{
    isRestricted: boolean;
    currentWindow?: { id: string; startTime: string; endTime: string; reason: string };
    nextChange?: string;
  }> {
    return this.http.get<any>(`${this.baseUrl}/admin/access-schedule/status`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== ACCESS TEMPLATES ===================
  listAccessTemplates(): Observable<{ templates: any[] }> {
    return this.http.get<{ templates: any[] }>(`${this.baseUrl}/admin/access-templates`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getAccessTemplateByRole(role: string): Observable<{ template: any }> {
    return this.http.get<{ template: any }>(`${this.baseUrl}/admin/access-templates/role/${role}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  createAccessTemplate(payload: {
    name: string;
    role: string;
    approvalTypes: Record<string, { canApprove: boolean }>;
  }): Observable<{ template: any }> {
    return this.http.post<{ template: any }>(`${this.baseUrl}/admin/access-templates`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  updateAccessTemplate(id: string, payload: {
    name?: string;
    approvalTypes?: Record<string, { canApprove: boolean }>;
  }): Observable<{ template: any }> {
    return this.http.patch<{ template: any }>(`${this.baseUrl}/admin/access-templates/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  updateAccessTemplateByRole(role: string, payload: {
    name?: string;
    approvalTypes?: Record<string, { canApprove: boolean }>;
  }): Observable<{ template: any }> {
    return this.http.patch<{ template: any }>(`${this.baseUrl}/admin/access-templates/role/${role}`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  deleteAccessTemplate(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/admin/access-templates/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== AUDIT LOG ===================
  listAuditLogs(params?: { days?: number; type?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/admin/audit-log${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  exportAuditLog(params?: { days?: number; type?: string }): Observable<Blob> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get(`${this.baseUrl}/admin/audit-log/export${query}`, { headers: this.authHeaders(), responseType: "blob" }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== REPORTS SETTINGS ===================
  getReportsSettings(): Observable<{
    format: "Excel" | "PDF" | "CSV";
    fileNamePrefix: string;
    includeProjectId: boolean;
    recipients: string[];
    dailyDigest: boolean;
    weeklyDigest: boolean;
    monthlyDigest: boolean;
  }> {
    return this.http.get<any>(`${this.baseUrl}/admin/reports/settings`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  saveReportsSettings(payload: {
    format?: "Excel" | "PDF" | "CSV";
    fileNamePrefix?: string;
    includeProjectId?: boolean;
    recipients?: string[];
    dailyDigest?: boolean;
    weeklyDigest?: boolean;
    monthlyDigest?: boolean;
  }): Observable<{ success: boolean; settings: any }> {
    return this.http.put<{ success: boolean; settings: any }>(`${this.baseUrl}/admin/reports/settings`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== CUSTOM FIELDS ===================
  listCustomFields(params: {
    entityType: string;
    entityId: string;
  }): Observable<{ fields: any[] }> {
    const q = new URLSearchParams();
    q.set("entityType", params.entityType);
    q.set("entityId", params.entityId);
    return this.http.get<{ fields: any[] }>(`${this.baseUrl}/custom-fields?${q.toString()}`, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  createCustomField(payload: {
    entityType: string;
    entityId: string;
    key: string;
    label: string;
    value?: string | number | boolean | null;
    fieldType: "text" | "number" | "date" | "boolean";
    order?: number;
  }): Observable<{ field: any }> {
    return this.http.post<{ field: any }>(`${this.baseUrl}/custom-fields`, payload, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  updateCustomField(
    id: string,
    patch: {
      label?: string;
      value?: string | number | boolean | null;
      fieldType?: "text" | "number" | "date" | "boolean";
      order?: number;
    }
  ): Observable<{ field: any }> {
    return this.http.patch<{ field: any }>(`${this.baseUrl}/custom-fields/${id}`, patch, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  deleteCustomField(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/custom-fields/${id}`, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  // =================== HELPERS ===================
  private authHeaders(): HttpHeaders {
    const token = this.accessTokenSignal();
    return new HttpHeaders({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }

  private setSession(res: LoginResponse): void {
    this.accessTokenSignal.set(res.accessToken);
    this.userSignal.set(res.user);
    this.expiresAtSignal.set(res.expiresAt);
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.accessToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, res.expiresAt);
    } catch {}
  }

  clearSession(): void {
    this.accessTokenSignal.set(null);
    this.userSignal.set(null);
    this.expiresAtSignal.set(null);
    try {
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    } catch {}
  }

  private getStored(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private getStoredUser(): ApiUser | null {
    const raw = this.getStored(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ApiUser;
    } catch {
      return null;
    }
  }

  private handleError = (error: HttpErrorResponse) => {
    const message = error.error?.error || error.message || "Request failed";
    console.error("[API Error]", error.status, message);
    return throwError(() => ({ status: error.status, message, details: error.error }));
  };
}
