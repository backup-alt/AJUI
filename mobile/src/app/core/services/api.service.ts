import { Injectable, signal, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import {
  Project,
  MaterialRequest,
  LabourAttendance,
  SiteExpense,
  PaymentRecord,
  Subcontract,
  ActivityItem,
  DashboardStats,
} from '../models/types';

interface DashboardPayload {
  counts?: {
    projects?: number;
    sites?: number;
    pendingApprovals?: number;
    pendingMaterials?: number;
    pendingLabour?: number;
    pendingExpenses?: number;
  };
  todayExpense?: { total?: number; count?: number };
  projects?: Project[];
  pendingApprovals?: ActivityItem[];
}

interface ApiProject {
  id: string;
  projectId: string;
  name: string;
  client?: string;
  mobile?: string;
  address?: string;
  status: Project['status'];
  startDate: string;
  totalValue: number;
  receivedAmount?: number;
  pendingBalance: number;
  materialSpend?: number;
  labourPayable?: number;
  expenseBalance?: number;
  completion: number;
  siteNames?: string[];
  sites?: Project['sites'];
  lastActivityAt?: string;
}

function projectFromApi(p: ApiProject): Project {
  const sites: Project['sites'] = p.sites && p.sites.length
    ? p.sites
    : (p.siteNames || []).map((name, i) => ({
        id: `site-${p.id}-${i}`,
        name,
        projectId: p.id,
        status: 'Active' as const,
      }));
  return {
    id: p.id,
    projectId: p.projectId,
    name: p.name,
    client: p.client || 'Client',
    clientId: '',
    mobile: p.mobile || '',
    address: p.address || '',
    supervisor: '',
    status: p.status,
    startDate: p.startDate,
    totalValue: p.totalValue,
    receivedAmount: p.receivedAmount ?? 0,
    pendingBalance: p.pendingBalance,
    materialSpend: p.materialSpend ?? 0,
    labourPayable: p.labourPayable ?? 0,
    expenseBalance: p.expenseBalance ?? 0,
    completion: p.completion,
    sites,
  };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private auth = inject(AuthService);

  readonly projects = signal<Project[]>([]);
  readonly project = signal<Project | null>(null);
  readonly dashboard = signal<DashboardPayload | null>(null);
  readonly activity = signal<ActivityItem[]>([]);
  readonly approvals = signal<ActivityItem[]>([]);
  readonly sites = signal<Project['sites']>([]);
  readonly stats = signal<DashboardStats>({
    activeProjects: 0,
    todayExpense: 0,
    todayExpenseCount: 0,
    pendingApprovals: 0,
    materialsLoggedThisWeek: 0,
    workersToday: 0,
  });
  readonly materials = signal<MaterialRequest[]>([]);
  readonly labour = signal<LabourAttendance[]>([]);
  readonly expenses = signal<SiteExpense[]>([]);
  readonly payments = signal<PaymentRecord[]>([]);
  readonly subcontracts = signal<Subcontract[]>([]);

  loading = signal(false);
  error = signal<string | null>(null);

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.auth.accessToken ? { Authorization: `Bearer ${this.auth.accessToken}` } : {}),
    };
  }

  private async fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${environment.backendUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...(options.headers as Record<string, string> | undefined) },
      credentials: 'include',
    });
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        msg = body?.message || body?.error || msg;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  async loadDashboard() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.fetchJson<{ dashboard: DashboardPayload }>('/api/supervisor/dashboard');
      const d = data?.dashboard || {};
      this.dashboard.set(d);
      this.projects.set((d.projects || []).map(projectFromApi));
      this.activity.set(d.pendingApprovals || []);
      this.stats.set({
        activeProjects: d.counts?.projects ?? 0,
        todayExpense: d.todayExpense?.total ?? 0,
        todayExpenseCount: d.todayExpense?.count ?? 0,
        pendingApprovals: d.counts?.pendingApprovals ?? 0,
        materialsLoggedThisWeek: d.counts?.pendingMaterials ?? 0,
        workersToday: 0,
      });
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  async loadProjects(): Promise<Project[]> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.fetchJson<{ projects: ApiProject[] }>('/api/supervisor/projects');
      const list = (data.projects || []).map(projectFromApi);
      this.projects.set(list);
      return list;
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load projects');
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  async loadProject(id: string): Promise<Project | null> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.fetchJson<{ project: ApiProject }>(`/api/supervisor/projects/${id}`);
      const proj = projectFromApi(data.project);
      this.project.set(proj);
      return proj;
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load project');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  getProjectById(id: string): Project | undefined {
    return this.projects().find((p) => p.id === id) || (this.project()?.id === id ? this.project()! : undefined);
  }

  async loadSites() {
    try {
      const data = await this.fetchJson<{ sites: Project['sites'] }>('/api/supervisor/sites');
      this.sites.set(data.sites || []);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load sites');
    }
  }

  async loadApprovals() {
    try {
      const data = await this.fetchJson<{ approvals: ActivityItem[] }>('/api/supervisor/approvals');
      this.approvals.set(data.approvals || []);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load approvals');
    }
  }

  async updateProfile(patch: { name?: string; phone?: string; email?: string }): Promise<boolean> {
    try {
      const data = await this.fetchJson<{ user: { id: string; name: string; email: string; phone: string; role: string; status: string } }>(
        '/api/supervisor/profile',
        { method: 'PATCH', body: JSON.stringify(patch) }
      );
      if (data?.user) {
        const u = data.user;
        await this.auth.setUser({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: (u.role as any) || 'supervisor',
          status: (u.status as any) || 'active',
          assignedProjectIds: this.auth.currentUser()?.assignedProjectIds || [],
          createdAt: this.auth.currentUser()?.createdAt || new Date().toISOString(),
        });
      }
      return true;
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to update profile');
      return false;
    }
  }
}
