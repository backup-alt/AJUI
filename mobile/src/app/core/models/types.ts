export type UserRole = 'admin' | 'accountant' | 'project_manager' | 'supervisor';
export type UserStatus = 'active' | 'inactive' | 'on_leave';
export type ProjectStatus = 'Active' | 'On Hold' | 'Completed';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
export type MaterialUnit = 'Bag' | 'Kg' | 'Ton' | 'Cum' | 'Sqft' | 'Rmt' | 'Nos' | 'Ltr';
export type MaterialCategory = 'Cement' | 'Steel' | 'Sand' | 'Aggregate' | 'Bricks' | 'Tiles' | 'Paint' | 'Others';
export type LabourCategory = 'Mason' | 'Helper' | 'Plumber' | 'Electrician' | 'Carpenter' | 'Painter' | 'Welder' | 'Other';
export type ExpenseCategory =
  | 'Diesel'
  | 'Material Purchase'
  | 'Equipment Rental'
  | 'Transport'
  | 'Site Tea'
  | 'Labour Payment'
  | 'Petty Cash'
  | 'Office'
  | 'Other';
export type ExpenseType = 'site' | 'general';
export type PaymentMode = 'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI' | 'NEFT';
export type EntrySource = 'material' | 'labour' | 'expense' | 'payment' | 'subcontract';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  baseLocation?: string;
  assignedProjectIds: string[];
  createdAt: string;
  lastLoginAt?: string;
}

export interface Site {
  id: string;
  name: string;
  projectId: string;
  status: 'Active' | 'Completed';
}

export interface Project {
  id: string;
  projectId: string;
  name: string;
  client: string;
  clientId: string;
  mobile: string;
  address: string;
  supervisor: string;
  status: ProjectStatus;
  startDate: string;
  totalValue: number;
  receivedAmount: number;
  pendingBalance: number;
  materialSpend: number;
  labourPayable: number;
  expenseBalance: number;
  completion: number;
  sites: Site[];
}

export interface MaterialRequest {
  id: string;
  materialId: string;
  projectId: string;
  projectName: string;
  site: string;
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  requestedQuantity: number;
  vendor?: string;
  vendorId?: string;
  poNumber?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  status: ApprovalStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface LabourType {
  name: string;
  dailyWage: number;
  staffCount: number;
}

export interface LabourAttendance {
  id: string;
  labourId: string;
  projectId: string;
  projectName: string;
  site: string;
  attendanceDate: string;
  category?: LabourCategory;
  partyName?: string;
  laborTypes: LabourType[];
  totalWorkers: number;
  totalWages: number;
  weather?: string;
  notes?: string;
  status: ApprovalStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface SiteExpense {
  id: string;
  expenseId: string;
  type: ExpenseType;
  projectId: string;
  projectName: string;
  site: string;
  category: ExpenseCategory;
  amount: number;
  reference?: string;
  description?: string;
  mode?: PaymentMode;
  expenseDate: string;
  receiptPhotos?: string[];
  status: ApprovalStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface PaymentRecord {
  id: string;
  paymentId: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  amount: number;
  mode: PaymentMode;
  receiptNumber?: string;
  transactionReference?: string;
  collectedBy: string;
  paymentDate: string;
  notes?: string;
  status: ApprovalStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface Subcontract {
  id: string;
  contractId: string;
  projectId: string;
  projectName: string;
  site?: string;
  name: string;
  scope: string;
  agreementAmount: number;
  advanceAmount: number;
  paidAmount: number;
  startDate?: string;
  endDate?: string;
  phone?: string;
  gstNumber?: string;
  notes?: string;
  status: ApprovalStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface ActivityItem {
  id: string;
  source: EntrySource;
  title: string;
  subtitle: string;
  amount?: number;
  status: ApprovalStatus;
  submittedAt: string;
}

export interface DashboardStats {
  activeProjects: number;
  todayExpense: number;
  todayExpenseCount: number;
  pendingApprovals: number;
  materialsLoggedThisWeek: number;
  workersToday: number;
}