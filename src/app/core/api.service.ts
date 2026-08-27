import { Injectable, signal, computed, inject } from "@angular/core";
import { HttpClient, HttpHeaders, HttpInterceptorFn, HttpHandlerFn, HttpRequest, HttpEvent, HttpErrorResponse } from "@angular/common/http";
import { Observable, from, throwError, catchError, switchMap, tap, of, shareReplay, expand, EMPTY, firstValueFrom, map, reduce } from "rxjs";
import { environment } from "../../environments/environment";

/**
 * Simple in-memory GET response cache. Prevents duplicate requests when
 * multiple components request the same data simultaneously (e.g. during
 * hydration). TTL-based — stale entries are evicted on access.
 */
class ResponseCache {
  private store = new Map<string, { data: any; expiresAt: number }>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
    // Prevent unbounded growth
    if (this.store.size > 200) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

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
  refreshToken?: string;
  expiresAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
  page?: number;
  pages?: number;
  limit?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
}

// =================== SUBCONTRACTOR PAYMENTS ===================
// Payments live in their own collection so the project workspace
// table and the main subcontractor page can share the same records
// without double-counting.
export interface SubcontractorPayment {
  _id: string;
  subcontractorId: string;
  projectId: string;
  siteId?: string;
  subcontractorName: string;
  projectName: string;
  siteName?: string;
  date: string;
  paymentType: string;
  labourType: string;
  description: string;
  employeeCount: number;
  amount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSubcontractorPaymentPayload {
  subcontractorId: string;
  projectId: string;
  siteId?: string;
  date: string;
  paymentType: string;
  labourType?: string;
  description?: string;
  employeeCount: number;
  amount: number;
  notes?: string;
}

export interface SubcontractorLabor {
  _id: string;
  subcontractorId: string;
  /** Optional project linkage — when set, the labour row mirrors into
   * that project's worker roster. */
  projectId?: string;
  projectName?: string;
  name: string;
  address?: string;
  phone: string;
  role: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderItem {
  materialId: string;
  source: "existing" | "manual";
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  itemAmount: number;
  gstPercent: number;
  gstAmount: number;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  projectId: string;
  projectName: string;
  vendorId: string;
  vendorName: string;
  date: string;
  paymentMode: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  totalGst: number;
  roundOff: number;
  grandTotal: number;
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
  private cache = new ResponseCache();

  /** Keep pages already visited during this app session for five minutes. */
  private LIST_TTL = 5 * 60_000;

  // Reactive state
  private accessTokenSignal = signal<string | null>(this.getStored(STORAGE_KEYS.ACCESS_TOKEN));
  private userSignal = signal<ApiUser | null>(this.getStoredUser());
  private expiresAtSignal = signal<string | null>(this.getStored(STORAGE_KEYS.EXPIRES_AT));

  accessToken = this.accessTokenSignal.asReadonly();
  user = this.userSignal.asReadonly();
  expiresAt = this.expiresAtSignal.asReadonly();
  isAuthenticated = computed(() => !!this.accessTokenSignal() && !!this.userSignal());

  // =================== DIAGNOSTIC WARMUP ===================
  warmupMaterials(): Observable<any> {
    return this.http.get(`${this.baseUrl}/materials/diagnostic-find-one`, { headers: this.authHeaders() });
  }
  warmupInventory(): Observable<any> {
    return this.http.get(`${this.baseUrl}/inventory/diagnostic-find-one`, { headers: this.authHeaders() });
  }
  warmupExpenses(): Observable<any> {
    return this.http.get(`${this.baseUrl}/expenses/diagnostic-find-one`, { headers: this.authHeaders() });
  }

  // =================== AUTH ===================
  login(identifier: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, { identifier, password }).pipe(
      tap((res) => {
        // The ResponseCache is keyed by URL only — not by user. So the
        // previous session's data (admin's full project list, PM's empty
        // list, etc.) would be replayed on the new login unless we drop
        // every cached entry on a session change. This was the cause of
        // PMs seeing no projects after logging in behind an admin.
        this.cache.clear();
        this.setSession(res);
      }),
      catchError(this.handleError)
    );
  }

  setEmployeeSession(user: ApiUser, accessToken: string, expiresAt: string): void {
    this.accessTokenSignal.set(accessToken);
    this.userSignal.set(user);
    this.expiresAtSignal.set(expiresAt);
    try {
      // Use localStorage so the session survives browser/tab close.
      // sessionStorage was wiping sessions on every Render redeploy
      // (which forced the user back to the dashboard with no token),
      // causing every list endpoint to 401.
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
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/clients${query}`);
  }

  deleteClient(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/clients/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/clients")),
      catchError(this.handleError)
    );
  }

  createClient(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/clients`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/clients")),
      catchError(this.handleError)
    );
  }

  // =================== SUPERVISOR INVITES ===================
  createSupervisorInvite(payload: {
    supervisorName: string;
    supervisorEmail: string;
    supervisorPhone?: string;
    projectId?: string;
    projectIds?: string[];
    siteIds?: string[];
    sendEmail?: boolean; // true = send deep link email, false = generate QR only
  }): Observable<{
    inviteId: string;
    token: string;
    qrUrl: string;
    qrPayload: { token: string; supervisorName: string; supervisorPhone?: string; projectIds?: string[]; expiresAt: number };
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
      tap(() => this.cache.invalidate("/materials")),
      catchError(this.handleError)
    );
  }
  patchMaterial(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/materials/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/materials")),
      catchError(this.handleError)
    );
  }
  uploadMaterialReceipt(id: string, payload: { data: string; mimeType: string; fileName?: string }): Observable<{ material: any }> {
    return this.http.post<{ material: any }>(`${this.baseUrl}/materials/${id}/receipt`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => {
        this.cache.invalidate("/materials");
        this.cache.invalidate("/dashboard/batch");
      }),
      catchError(this.handleError)
    );
  }
  createMaterial(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/materials`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/materials")),
      catchError(this.handleError)
    );
  }

  // =================== LABOUR ===================
  deleteLabour(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/labour/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/labour")),
      catchError(this.handleError)
    );
  }
  patchLabour(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/labour/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/labour")),
      catchError(this.handleError)
    );
  }

  // =================== EXPENSES ===================
  deleteExpense(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/expenses/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/expenses")),
      catchError(this.handleError)
    );
  }
  patchExpense(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/expenses/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/expenses")),
      catchError(this.handleError)
    );
  }

  // =================== GENERAL EXPENSES (project-level "Expense") ===================
  listGeneralExpenses(params?: {
    projectId?: string;
    siteId?: string;
    category?: string;
    status?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
    cursor?: string;
  }): Observable<{ items: any[]; total: number; page: number; limit: number; pages: number; queryFailed?: boolean }> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<{ items: any[]; total: number; page: number; limit: number; pages: number; queryFailed?: boolean }>(
      `${this.baseUrl}/general-expenses${query}`
    );
  }
  listAllGeneralExpenses(params?: {
    projectId?: string;
    siteId?: string;
    category?: string;
    status?: string;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
  }): Observable<{ items: any[]; total: number }> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<{ items: any[]; total: number }>(`${this.baseUrl}/general-expenses/all${query}`);
  }
  createGeneralExpense(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/general-expenses`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/general-expenses")),
      catchError(this.handleError)
    );
  }
  uploadGeneralExpenseReceipt(id: string, payload: { data: string; mimeType: string; fileName?: string }): Observable<{ expense: any }> {
    return this.http.post<{ expense: any }>(`${this.baseUrl}/general-expenses/${id}/receipt`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => {
        this.cache.invalidate("/general-expenses");
        this.cache.invalidate("/dashboard/batch");
      }),
      catchError(this.handleError)
    );
  }
  patchGeneralExpense(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/general-expenses/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/general-expenses")),
      catchError(this.handleError)
    );
  }
  deleteGeneralExpense(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/general-expenses/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/general-expenses")),
      catchError(this.handleError)
    );
  }

  // =================== PAYMENTS ===================
  deletePayment(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/payments/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidatePaymentCaches()),
      catchError(this.handleError)
    );
  }
  patchPayment(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/payments/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidatePaymentCaches()),
      catchError(this.handleError)
    );
  }

  private invalidatePaymentCaches(): void {
    this.cache.invalidate("/payments");
    this.cache.invalidate("/projects");
    this.cache.invalidate("/clients");
    this.cache.invalidate("/dashboard/kpis");
    this.cache.invalidate("/dashboard/batch");
  }

  // =================== VENDORS ===================
  deleteVendor(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/vendors/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/vendors")),
      catchError(this.handleError)
    );
  }
  patchVendor(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/vendors/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/vendors")),
      catchError(this.handleError)
    );
  }
  createVendor(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/vendors`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/vendors")),
      catchError(this.handleError)
    );
  }

  // =================== VENDOR CUSTOM COLUMNS ===================
  listVendorCustomColumns(vendorName: string, siteName: string): Observable<{ items: Array<{ columnKey: string; label: string; order: number }> }> {
    const q = new URLSearchParams({ vendorName, siteName }).toString();
    return this.http.get<{ items: any[] }>(`${this.baseUrl}/vendor-custom-columns?${q}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  addVendorCustomColumn(payload: { vendorName: string; siteName: string; columnKey: string; label: string; order?: number }): Observable<{ column: any }> {
    return this.http.post<{ column: any }>(`${this.baseUrl}/vendor-custom-columns`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  removeVendorCustomColumn(vendorName: string, siteName: string, columnKey: string): Observable<any> {
    const q = new URLSearchParams({ vendorName, siteName, columnKey }).toString();
    return this.http.delete(`${this.baseUrl}/vendor-custom-columns?${q}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== MATERIAL BILL LINKS ===================
  listMaterialBillLinks(vendorName: string, siteName: string): Observable<{ items: Array<{ materialId: string; billUrl: string; billLabel?: string }> }> {
    const q = new URLSearchParams({ vendorName, siteName }).toString();
    return this.http.get<{ items: any[] }>(`${this.baseUrl}/material-bill-links?${q}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  upsertMaterialBillLink(payload: { vendorName: string; siteName: string; materialId: string; billUrl: string; billLabel?: string }): Observable<{ link: any }> {
    return this.http.post<{ link: any }>(`${this.baseUrl}/material-bill-links`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  removeMaterialBillLink(vendorName: string, siteName: string, materialId: string): Observable<any> {
    const q = new URLSearchParams({ vendorName, siteName, materialId }).toString();
    return this.http.delete(`${this.baseUrl}/material-bill-links?${q}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== QUOTATIONS ===================
  deleteQuotation(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/quotations/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache()),
      catchError(this.handleError)
    );
  }
  patchQuotation(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/quotations/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache()),
      catchError(this.handleError)
    );
  }
  createQuotation(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/quotations`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache()),
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
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/quotations${query}`);
  }

  // =================== INVOICES ===================
  deleteInvoice(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/invoices/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache()),
      catchError(this.handleError)
    );
  }
  patchInvoice(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/invoices/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache()),
      catchError(this.handleError)
    );
  }
  createInvoice(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/invoices`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache()),
      catchError(this.handleError)
    );
  }
  getInvoice(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/invoices/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  listInvoices(params?: { page?: number; limit?: number; search?: string; status?: string }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/invoices${query}`);
  }

  // =================== SUBCONTRACTORS ===================
  listSubcontractors(params?: { projectId?: string; status?: string; search?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/subcontractors${query}`);
  }

  createSubcontractor(payload: {
    projectId: string;
    subcontractorName: string;
    description?: string;
    employeeCount?: number;
    note?: string;
    address?: string;
    phone?: string;
    gstType?: "GST" | "Non-GST";
    gstNumber?: string;
    status?: "active" | "inactive";
  }): Observable<{ subcontractor: any }> {
    return this.http.post<{ subcontractor: any }>(`${this.baseUrl}/subcontractors`, payload, {
      headers: this.authHeaders(),
    }).pipe(
      tap(() => this.cache.invalidate("/subcontractors")),
      catchError(this.handleError)
    );
  }

  /**
   * Spend rollup — used by the project workspace "total expense" line
   * to fold subcontractor payments into the project total.
   */
  getSubcontractorSpendRollup(projectId?: string): Observable<{ totalPaid: number; perProject: Record<string, number> }> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return this.http
      .get<{ totalPaid: number; perProject: Record<string, number> }>(
        `${this.baseUrl}/subcontractors/spend-rollup${query}`,
        { headers: this.authHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  // =================== SUBCONTRACTOR PAYMENTS ===================
  // Payments live in their own collection so the project workspace
  // table and the main subcontractor page can share the same records
  // without double-counting.

  listSubcontractorPayments(params?: {
    subcontractorId?: string;
    projectId?: string;
    siteId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    cursor?: string;
  }): Observable<PaginatedResponse<SubcontractorPayment>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http
      .get<PaginatedResponse<SubcontractorPayment>>(
        `${this.baseUrl}/subcontractor-payments${query}`,
        { headers: this.authHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  getSubcontractorPaymentSummary(subcontractorId: string): Observable<{
    totalPaid: number;
    recordCount: number;
    projectCount: number;
    siteCount: number;
  }> {
    return this.http
      .get<{ totalPaid: number; recordCount: number; projectCount: number; siteCount: number }>(
        `${this.baseUrl}/subcontractor-payments/summary/${subcontractorId}`,
        { headers: this.authHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  createSubcontractorPayment(payload: CreateSubcontractorPaymentPayload): Observable<{ payment: SubcontractorPayment }> {
    return this.http
      .post<{ payment: SubcontractorPayment }>(
        `${this.baseUrl}/subcontractor-payments`,
        payload,
        { headers: this.authHeaders() }
      )
      .pipe(
        tap(() => {
          this.cache.invalidate("/subcontractor-payments");
          this.cache.invalidate("/subcontractors");
          this.cache.invalidate("/dashboard/batch");
        }),
        catchError(this.handleError)
      );
  }

  updateSubcontractorPayment(
    id: string,
    payload: Partial<CreateSubcontractorPaymentPayload>
  ): Observable<{ payment: SubcontractorPayment }> {
    return this.http
      .patch<{ payment: SubcontractorPayment }>(
        `${this.baseUrl}/subcontractor-payments/${id}`,
        payload,
        { headers: this.authHeaders() }
      )
      .pipe(
        tap(() => {
          this.cache.invalidate("/subcontractor-payments");
          this.cache.invalidate("/subcontractors");
          this.cache.invalidate("/dashboard/batch");
        }),
        catchError(this.handleError)
      );
  }

  deleteSubcontractorPayment(id: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ success: boolean }>(
        `${this.baseUrl}/subcontractor-payments/${id}`,
        { headers: this.authHeaders() }
      )
      .pipe(
        tap(() => {
          this.cache.invalidate("/subcontractor-payments");
          this.cache.invalidate("/subcontractors");
          this.cache.invalidate("/dashboard/batch");
        }),
        catchError(this.handleError)
      );
  }

  listSubcontractorLabor(subcontractorId: string): Observable<{ items: SubcontractorLabor[]; total: number }> {
    return this.http.get<{ items: SubcontractorLabor[]; total: number }>(
      `${this.baseUrl}/subcontractor-labor?subcontractorId=${encodeURIComponent(subcontractorId)}`,
      { headers: this.authHeaders() },
    ).pipe(catchError(this.handleError));
  }

  createSubcontractorLabor(payload: Omit<SubcontractorLabor, "_id">): Observable<{ labor: SubcontractorLabor }> {
    return this.http.post<{ labor: SubcontractorLabor }>(`${this.baseUrl}/subcontractor-labor`, payload, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  updateSubcontractorLabor(id: string, payload: Partial<Omit<SubcontractorLabor, "_id" | "subcontractorId">>): Observable<{ labor: SubcontractorLabor }> {
    return this.http.patch<{ labor: SubcontractorLabor }>(`${this.baseUrl}/subcontractor-labor/${id}`, payload, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  listPurchaseOrders(params?: { projectId?: string; page?: number; limit?: number }): Observable<PaginatedResponse<PurchaseOrder>> {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => value !== undefined && q.set(key, String(value)));
    const query = q.toString() ? `?${q.toString()}` : "";
    return this.http.get<PaginatedResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders${query}`, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  getPurchaseOrder(idOrNumber: string): Observable<{ purchaseOrder: PurchaseOrder }> {
    return this.http.get<{ purchaseOrder: PurchaseOrder }>(
      `${this.baseUrl}/purchase-orders/${encodeURIComponent(idOrNumber)}`,
      { headers: this.authHeaders() },
    ).pipe(catchError(this.handleError));
  }

  createPurchaseOrder(payload: {
    projectId: string;
    vendorId: string;
    date: string;
    paymentMode: string;
    roundOff: number;
    items: Array<{
      source: "existing" | "manual";
      materialId?: string;
      description?: string;
      unit?: string;
      quantity?: number;
      rate: number;
      gstPercent: number;
    }>;
  }): Observable<{ purchaseOrder: PurchaseOrder }> {
    return this.http.post<{ purchaseOrder: PurchaseOrder }>(`${this.baseUrl}/purchase-orders`, payload, {
      headers: this.authHeaders(),
    }).pipe(
      tap(() => {
        this.cache.invalidate("/purchase-orders");
        this.cache.invalidate("/materials");
      }),
      catchError(this.handleError),
    );
  }

  updatePurchaseOrder(id: string, payload: {
    vendorId: string;
    date: string;
    paymentMode: string;
    roundOff: number;
    items: Array<{
      source: "existing" | "manual";
      materialId?: string;
      description?: string;
      unit?: string;
      quantity?: number;
      rate: number;
      gstPercent: number;
    }>;
  }): Observable<{ purchaseOrder: PurchaseOrder }> {
    return this.http.put<{ purchaseOrder: PurchaseOrder }>(`${this.baseUrl}/purchase-orders/${encodeURIComponent(id)}`, payload, {
      headers: this.authHeaders(),
    }).pipe(
      tap(() => {
        this.cache.invalidate("/purchase-orders");
        this.cache.invalidate("/materials");
      }),
      catchError(this.handleError),
    );
  }

  listPurchaseOrderGstRates(): Observable<{ rates: number[] }> {
    return this.http.get<{ rates: number[] }>(`${this.baseUrl}/purchase-orders/gst-rates`, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  addPurchaseOrderGstRate(rate: number): Observable<{ rate: number }> {
    return this.http.post<{ rate: number }>(`${this.baseUrl}/purchase-orders/gst-rates`, { rate }, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  deleteSubcontractor(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/subcontractors/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/subcontractors")),
      catchError(this.handleError)
    );
  }
  patchSubcontractor(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/subcontractors/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.cache.invalidate("/subcontractors")),
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
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/projects${query}`);
  }

  createProject(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/projects`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => {
        this.cache.invalidate("/projects");
        this.cache.invalidate("/admin/users");
      }),
      catchError(this.handleError)
    );
  }

  updateProject(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/projects/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => {
        this.cache.invalidate("/projects");
        this.cache.invalidate("/admin/users");
      }),
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

  approveApproval(id: string, payload: any = {}): Observable<{ approval: any }> {
    return this.http.put<{ approval: any }>(`${this.baseUrl}/approvals/${id}/approve`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => {
        // Approving an approval mutates the source record (Material / Labour /
        // Expense / Payment / Subcontractor) and recomputes project totals.
        // Invalidate every cached list that may have shown the stale state so
        // the next visit (Dashboard, Universal Dashboard, Project Workspace)
        // fetches fresh data instead of returning a stale cached response.
        this.invalidateCache("/approvals");
        this.invalidateCache("/materials");
        this.invalidateCache("/labour");
        this.invalidateCache("/expenses");
        this.invalidateCache("/payments");
        this.invalidateCache("/subcontractors");
        this.invalidateCache("/inventory");
      }),
      catchError(this.handleError)
    );
  }

  rejectApproval(id: string): Observable<{ approval: any }> {
    return this.http.put<{ approval: any }>(`${this.baseUrl}/approvals/${id}/reject`, {}, { headers: this.authHeaders() }).pipe(
      tap(() => {
        this.invalidateCache("/approvals");
        this.invalidateCache("/materials");
        this.invalidateCache("/labour");
        this.invalidateCache("/expenses");
        this.invalidateCache("/payments");
        this.invalidateCache("/subcontractors");
      }),
      catchError(this.handleError)
    );
  }

  // =================== SITES ===================
  listSites(): Observable<PaginatedResponse<any>> {
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/sites?limit=25&page=1`);
  }

  createSite(payload: { name: string; projectIds?: string[]; openingBalance?: number; status?: string }): Observable<{ site: any }> {
    return this.http.post<{ site: any }>(`${this.baseUrl}/sites`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache()),
      catchError(this.handleError)
    );
  }

  updateSite(id: string, payload: { name?: string; status?: string; openingBalance?: number }): Observable<{ site: any }> {
    return this.http.patch<{ site: any }>(`${this.baseUrl}/sites/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache()),
      catchError(this.handleError)
    );
  }

  listSitesAdmin(): Observable<{ sites: any[] }> {
    return this.cachedGet<{ sites: any[] }>(`${this.baseUrl}/admin/sites`);
  }

  /**
   * Fetch ALL sites for picker UIs. Uses cursor-paginated /sites to collect
   * all pages. The backend caps /sites at 25 items per page, so we must paginate.
   *
   * We avoid /admin/sites because the deployed backend's listAllSites controller
   * is currently returning a subset of sites (only 14 of 30), breaking the picker.
   * The /sites endpoint with cursor pagination is reliable and returns all sites
   * for admin users (no scope filter applied).
   *
   * Always invalidates the relevant cache entries before fetching to ensure
   * fresh data (sites created in another tab/session are visible).
   */
  listSitesAll(): Observable<{ sites: any[] }> {
    // Invalidate caches so we don't return stale entries for /sites
    this.invalidateCache("/admin/sites");
    this.invalidateCache("/sites");
    return this.paginateAllSites();
  }

  private paginateAllSites(maxPages = 50): Observable<{ sites: any[] }> {
    const fetchPage = (cursor: string | null): Observable<PaginatedResponse<any>> => {
      const params = new URLSearchParams();
      params.set("limit", "25");
      if (cursor) {
        params.set("cursor", cursor);
      } else {
        params.set("page", "1");
      }
      const url = `${this.baseUrl}/sites?${params.toString()}`;
      this.invalidateCache(`GET:${url}`);
      return this.http.get<PaginatedResponse<any>>(url, { headers: this.authHeaders() });
    };

    return fetchPage(null).pipe(
      expand((res, idx) => {
        if (idx + 1 >= maxPages || !res?.nextCursor) {
          return EMPTY;
        }
        return fetchPage(res.nextCursor);
      }),
      reduce((acc, res) => {
        if (res?.items?.length) {
          acc.items.push(...res.items);
        }
        return acc;
      }, { items: [] as any[] }),
      map((acc) => ({ sites: acc.items }))
    );
  }

  getSiteMaterials(siteId: string): Observable<{ materials: any[] }> {
    return this.http.get<{ materials: any[] }>(`${this.baseUrl}/admin/sites/${siteId}/materials`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== VENDORS ===================
  listVendors(params?: { materialType?: string; status?: string; search?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/vendors${query}`);
  }

  // =================== SUPERVISORS ===================
  listSupervisors(params?: { status?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/supervisors${query}`);
  }

  getSupervisor(id: string): Observable<{ supervisor: any }> {
    return this.http.get<{ supervisor: any }>(`${this.baseUrl}/supervisors/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  updateSupervisor(id: string, patch: any): Observable<{ supervisor: any }> {
    return this.http.patch<{ supervisor: any }>(`${this.baseUrl}/supervisors/${id}`, patch, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  fundSupervisor(id: string, payload: { projectId: string; siteId?: string; amount: number; note?: string }): Observable<{ funding: any }> {
    return this.http.post<{ funding: any }>(`${this.baseUrl}/supervisors/${id}/fund`, payload, {
      headers: this.authHeaders(),
    }).pipe(
      tap(() => {
        this.cache.invalidate("/supervisors");
        this.cache.invalidate("/sites");
        this.cache.invalidate("/expenses");
      }),
      catchError(this.handleError),
    );
  }

  // =================== MATERIALS ===================
  listMaterials(params?: { projectId?: string; siteId?: string; vendorId?: string; type?: string; status?: string; search?: string; page?: number; limit?: number; cursor?: string }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/materials${query}`);
  }

  // =================== INVENTORY ===================
  listInventory(params?: { projectId?: string; siteId?: string; search?: string; page?: number; limit?: number; cursor?: string }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/inventory${query}`);
  }

  getMissingMaterials(siteId: string): Observable<{ site: any; materials: any[] }> {
    return this.http.get<{ site: any; materials: any[] }>(`${this.baseUrl}/inventory/missing?siteId=${encodeURIComponent(siteId)}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  initializeInventory(payload: { siteId: string; items: Array<{ materialId: string; quantity: number }> }): Observable<{ site: any; results: any[] }> {
    return this.http.post<{ site: any; results: any[] }>(`${this.baseUrl}/inventory/initialize`, payload, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  addInventoryMaterial(payload: {
    siteId: string;
    projectId?: string;
    name: string;
    unit: string;
    quantity: number;
    isExistingMaterial?: boolean;
    issuedAmount?: number;
    givenAmount?: number;
    remarks?: string;
    requestDate?: string;
  }): Observable<{ material: any; created: boolean }> {
    return this.http.post<{ material: any; created: boolean }>(`${this.baseUrl}/inventory/material`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => {
        this.cache.invalidate("/materials");
        this.cache.invalidate("/inventory");
      }),
      catchError(this.handleError)
    );
  }
  listAllActiveSubcontractors(): Observable<{ items: any[] }> {
    return this.http.get<{ items: any[] }>(`${this.baseUrl}/subcontractors/all-active`, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  // =================== LABOUR ===================
  listLabour(params?: { projectId?: string; siteId?: string; category?: string; status?: string; search?: string; page?: number; limit?: number }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/labour${query}`);
  }

  // =================== WORKERS (web admin) ===================
  // Used by the project workspace "Labour" tab. The same collection the
  // mobile supervisor app maintains via /api/mobile/supervisor/workers.
  listWorkers(params?: { projectId?: string; siteId?: string; labourType?: string; page?: number; limit?: number; cursor?: string }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/workers${query}`);
  }

  createWorker(payload: any): Observable<{ worker: any }> {
    return this.http.post<{ worker: any }>(`${this.baseUrl}/workers`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => {
        this.cache.invalidate("/workers");
        this.cache.invalidate("/dashboard/batch");
      }),
      catchError(this.handleError)
    );
  }

  patchWorker(id: string, payload: any): Observable<{ worker: any }> {
    return this.http.patch<{ worker: any }>(`${this.baseUrl}/workers/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => {
        this.cache.invalidate("/workers");
        this.cache.invalidate("/dashboard/batch");
      }),
      catchError(this.handleError)
    );
  }

  deleteWorker(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/workers/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => {
        this.cache.invalidate("/workers");
        this.cache.invalidate("/dashboard/batch");
      }),
      catchError(this.handleError)
    );
  }

  // =================== ATTENDANCE (New Model) ===================
  listGroupedAttendance(params?: { projectId?: string; from?: string; to?: string; page?: number; limit?: number }): Observable<{ items: any[]; total: number }> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<{ items: any[]; total: number }>(`${this.baseUrl}/attendance/grouped${query}`);
  }

  /**
   * Bulk subcontractor attendance (one row per (subcontractor, project, date)
   * — what the supervisor mobile app submits). Each `entries` item carries a
   * labour type and headcount, so a roster with 3 labour types is still a
   * single record rather than 3 separate ones.
   */
  listSubcontractorAttendance(params?: { projectId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }): Observable<{ items: any[]; total: number; page: number; limit: number; pages: number }> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<{ items: any[]; total: number; page: number; limit: number; pages: number }>(`${this.baseUrl}/subcontractor-attendance${query}`);
  }

  getLabourReport(params?: { projectId?: string; from?: string; to?: string }): Observable<{ items: any[]; weeklySummaries: any[]; grandTotal: any }> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.http.get<{ items: any[]; weeklySummaries: any[]; grandTotal: any }>(`${this.baseUrl}/attendance/report${query}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // =================== EXPENSES ===================
  listExpenses(params?: { type?: string; projectId?: string; siteId?: string; status?: string; from?: string; to?: string; search?: string; page?: number; limit?: number; cursor?: string }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/expenses${query}`);
  }

  createExpense(payload: {
    type: "site" | "general";
    projectId?: string;
    siteId?: string;
    site?: string;
    transactionType?: string;
    amount: number;
    date: string;
    description: string;
    notes?: string;
    reference?: string;
    amountPaidBy?: string;
    submittedBy?: string;
    customFields?: Record<string, unknown>;
  }): Observable<{ expense: any }> {
    return this.http.post<{ expense: any }>(`${this.baseUrl}/expenses`, payload, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  // =================== PAYMENTS ===================
  listPayments(params?: { projectId?: string; clientId?: string; status?: string; mode?: string; from?: string; to?: string; search?: string; page?: number; limit?: number; cursor?: string }): Observable<PaginatedResponse<any>> {
    let query = "";
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      query = `?${q.toString()}`;
    }
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/payments${query}`);
  }

  createPayment(payload: {
    projectId: string;
    clientId: string;
    date: string;
    amount: number;
    mode: string;
    receiptNumber?: string;
    transactionReference?: string;
    collectedBy: string;
    notes?: string;
  }): Observable<{ payment: any }> {
    return this.http.post<{ payment: any }>(`${this.baseUrl}/payments`, payload, {
      headers: this.authHeaders(),
    }).pipe(
      tap(() => this.invalidatePaymentCaches()),
      catchError(this.handleError),
    );
  }

  // =================== ACCOUNT ===================
  patchMe(payload: { name?: string; email?: string; phone?: string }): Observable<{ user: ApiUser }> {
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
    return this.cachedGet<PaginatedResponse<any>>(`${this.baseUrl}/admin/users${query}`);
  }

  getEmployee(id: string): Observable<{ employee: any }> {
    return this.http.get<{ employee: any }>(`${this.baseUrl}/admin/users/${id}`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  patchEmployee(id: string, payload: any): Observable<{ employee: any }> {
    return this.http.patch<{ employee: any }>(`${this.baseUrl}/admin/users/${id}`, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache()),
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

  /**
   * Replace a non-admin user's project scope. Use this from the
   * employee detail drawer to (re)assign projects to a project manager
   * or accountant after they've already accepted their invite.
   */
  saveEmployeeManagedProjects(
    id: string,
    managedProjectIds: string[]
  ): Observable<{ employee: { _id: string; managedProjectIds: string[] } }> {
    return this.http.put<{ employee: { _id: string; managedProjectIds: string[] } }>(
      `${this.baseUrl}/admin/users/${id}/managed-projects`,
      { managedProjectIds },
      { headers: this.authHeaders() }
    ).pipe(catchError(this.handleError));
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
    supervisorOnly?: boolean;
  }): Observable<{ fields: any[] }> {
    const q = new URLSearchParams();
    q.set("entityType", params.entityType);
    q.set("entityId", params.entityId);
    if (params.supervisorOnly) q.set("supervisorOnly", "true");
    return this.http.get<{ fields: any[] }>(`${this.baseUrl}/custom-fields?${q.toString()}`, {
      headers: this.authHeaders(),
    }).pipe(catchError(this.handleError));
  }

  /**
   * Bulk list — accepts an array of entityIds and returns a map of
   * `entityId -> fields[]`. Used by the admin dashboard's custom field
   * loader to avoid the (entityType × N_sites) request storm.
   */
  listCustomFieldsBulk(params: {
    entityType: string;
    entityIds: string[];
    supervisorOnly?: boolean;
  }): Observable<{ grouped: Record<string, any[]> }> {
    const q = new URLSearchParams();
    if (params.supervisorOnly) q.set("supervisorOnly", "true");
    const qs = q.toString();
    return this.http.post<{ grouped: Record<string, any[]> }>(
      `${this.baseUrl}/custom-fields/list${qs ? `?${qs}` : ""}`,
      { entityType: params.entityType, entityIds: params.entityIds },
      { headers: this.authHeaders() }
    ).pipe(catchError(this.handleError));
  }

  createCustomField(payload: {
    entityType: string;
    entityId: string;
    key: string;
    label: string;
    value?: string | number | boolean | null;
    fieldType: "text" | "number" | "date" | "boolean";
    order?: number;
    askSupervisor?: boolean;
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
      askSupervisor?: boolean;
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

  /**
   * Build the cache key for a request URL. Namespaced by the current
   * user ID so concurrent role-switches (e.g. logging out of one
   * account and into another) can't leak cached data between users.
   */
  private cacheKeyFor(url: string): string {
    const userId = this.userSignal()?.id || "anon";
    return `GET:${userId}:${url}`;
  }

  /**
   * GET with in-memory caching. Prevents duplicate requests when multiple
   * components request the same data simultaneously. Returns a shared
   * observable so concurrent subscribers share one HTTP call.
   */
  private cachedGet<T>(url: string, ttlMs: number = this.LIST_TTL): Observable<T> {
    const cacheKey = this.cacheKeyFor(url);
    const cached = this.cache.get<T>(cacheKey);
    if (cached) return of(cached);

    return this.http.get<T>(url, { headers: this.authHeaders() }).pipe(
      tap((data) => {
        if (!this.isEmptyListResponse(data)) this.cache.set(cacheKey, data, ttlMs);
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  /**
   * Invalidate cached responses matching a URL pattern. Call after
   * POST/PATCH/DELETE to ensure subsequent GETs fetch fresh data.
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      this.cache.invalidate(pattern);
    } else {
      this.cache.clear();
    }
  }

  private isEmptyListResponse(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;
    const response = data as Record<string, unknown>;
    return ["items", "materials", "expenses", "labour"].some(
      (key) => Array.isArray(response[key]) && response[key].length === 0
    );
  }

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
      // localStorage so the session survives browser/tab close.
      // sessionStorage wiped the session on every Render redeploy,
      // sending the user back to the dashboard with no token and
      // causing every list endpoint to 401.
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.accessToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, res.expiresAt);
      if (res.refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.refreshToken);
      }
    } catch {}
  }

  private refreshInFlight: Promise<{ accessToken: string; refreshToken?: string; expiresAt: string } | null> | null = null;

  refreshTokens(): Promise<{ accessToken: string; refreshToken?: string; expiresAt: string } | null> {
    if (this.refreshInFlight) return this.refreshInFlight;

    // localStorage so the refresh token survives browser/tab close.
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return Promise.resolve(null);

    this.refreshInFlight = new Promise((resolve) => {
      this.http.post<{ accessToken: string; refreshToken?: string; expiresAt: string }>(
        `${this.baseUrl}/auth/refresh`, { refreshToken }
      ).subscribe({
        next: (res) => {
          this.accessTokenSignal.set(res.accessToken);
          this.expiresAtSignal.set(res.expiresAt);
          try {
            localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.accessToken);
            localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, res.expiresAt);
            if (res.refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.refreshToken);
          } catch {}
          this.refreshInFlight = null;
          resolve(res);
        },
        error: () => {
          this.refreshInFlight = null;
          resolve(null);
        },
      });
    });
    return this.refreshInFlight;
  }

  // =================== COMPANY PROFILE ===================
  getCompanyProfile(): Observable<{ name: string; address: string; state: string; gstin: string; bankName: string; accountNumber: string; ifsc: string; branch: string }> {
    return this.http.get<any>(`${this.baseUrl}/company-profile`, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  saveCompanyProfile(profile: { name: string; address: string; state: string; gstin: string; bankName: string; accountNumber: string; ifsc: string; branch: string }): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/company-profile`, profile, { headers: this.authHeaders() }).pipe(
      catchError(this.handleError)
    );
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
      // localStorage so the token survives browser/tab close. We migrate
      // from any prior sessionStorage entry on the fly.
      const fromLocal = localStorage.getItem(key);
      if (fromLocal) return fromLocal;
      const fromSession = sessionStorage.getItem(key);
      if (fromSession) {
        localStorage.setItem(key, fromSession);
        sessionStorage.removeItem(key);
        return fromSession;
      }
      return null;
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
