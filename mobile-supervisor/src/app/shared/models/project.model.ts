export interface Project {
  id: string;
  projectId: string;
  name: string;
  client: string;
  clientId: string;
  status: 'Active' | 'Completed' | 'On Hold' | 'Cancelled';
  startDate: string;
  endDate?: string;
  totalValue: number;
  receivedAmount: number;
  pendingBalance: number;
  materialSpend: number;
  labourPayable: number;
  completion: number;
  siteNames: string[];
  lastActivityAt: string;
  supervisorId?: string;
  sites?: Site[];
  stats?: ProjectStats;
}

export interface Site {
  id: string;
  siteId: string;
  name: string;
  status: 'Active' | 'Completed' | 'On Hold';
  supervisor: string;
  startDate: string;
  targetEndDate: string;
  projectId?: string;
  projectName?: string;
  employeeCount?: number;
  daysActive?: number;
  updatedAt?: string;
}

export interface ProjectStats {
  materials: { count: number; pending: number };
  labour: { count: number; pending: number };
  expenses: { count: number; total: number };
  payments: { count: number; total: number };
  subcontractors: { count: number; contractTotal: number };
}

export interface ApprovalSummary {
  approvalId: string;
  type: string;
  title: string;
  projectId: string;
  projectName: string;
  site?: string;
  amount?: number;
  submittedAt: string;
  sourceCollection: string;
  sourceId: string;
  status?: string;
}

export interface DashboardData {
  counts: {
    projects: number;
    sites: number;
    pendingApprovals: number;
    pendingMaterials: number;
    pendingLabour: number;
    pendingExpenses: number;
  };
  todayExpense: { total: number; count: number };
  projects: Project[];
  pendingApprovals: ApprovalSummary[];
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface SitesResponse {
  sites: Site[];
}

export interface DashboardResponse {
  dashboard: DashboardData;
}