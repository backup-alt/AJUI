export type LabourStatus = 'Pending' | 'Approved' | 'Rejected';
export type LabourShift = 'Day' | 'Night' | 'Evening';
export type PaymentMode = 'Cash' | 'NEFT' | 'UPI' | 'Cheque';

export interface LaborTypeEntry {
  name: string;
  dailyWage: number;
  staffCount: number;
}

export interface Labour {
  _id: string;
  labourId: string;
  projectId: string;
  projectName: string;
  clientId: string;
  siteId?: string;
  site: string;
  partyName: string;
  category: string;
  attendanceDate: string;
  presentCount: number;
  presentDays: number;
  absentDays: number;
  dailyWage: number;
  overtime: number;
  lateFine: number;
  shift: LabourShift;
  paymentMode: PaymentMode;
  wagePeriod?: string;
  laborTypes: LaborTypeEntry[];
  notes?: string;
  status: LabourStatus;
  submittedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabourRequest {
  projectId: string;
  siteId: string;
  partyName: string;
  category: string;
  attendanceDate: string;
  presentCount: number;
  presentDays: number;
  absentDays: number;
  dailyWage: number;
  overtime: number;
  lateFine: number;
  shift: LabourShift;
  paymentMode: PaymentMode;
  wagePeriod?: string;
  laborTypes: LaborTypeEntry[];
  notes?: string;
}

export interface LabourListResponse {
  labour: Labour[];
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

export interface LabourFilters {
  projectId?: string;
  siteId?: string;
  status?: LabourStatus;
  partyName?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// =================== WORKER ===================
export interface Worker {
  _id: string;
  workerId: string;
  projectId: string;
  projectName: string;
  siteId?: string;
  site: string;
  name: string;
  address?: string;
  labourType: string;
  weeklyPay: number;
  isSubcontract: boolean;
  subcontractorId?: string;
  subcontractorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkerRequest {
  projectId: string;
  siteId?: string;
  site: string;
  name: string;
  address?: string;
  labourType: string;
  // Wage field is no longer set from the mobile create form — the web
  // admin tracks per-project wage via custom fields. Keep the property
  // optional for backwards compatibility.
  weeklyPay?: number;
  isSubcontract?: boolean;
  subcontractorId?: string;
  subcontractorName?: string;
}

export interface Subcontractor {
  _id: string;
  subcontractorName: string;
  site?: string;
  projectId?: string;
}

// =================== ATTENDANCE ===================
export interface Attendance {
  _id: string;
  attendanceId: string;
  workerId: string;
  workerName: string;
  projectId: string;
  projectName: string;
  siteId?: string;
  site: string;
  labourType: string;
  weeklyPay: number;
  attendanceDate: string;
  shiftCount: number;
  overtimeHours: number;
  overtimeAmount: number;
  lateFine: number;
  paymentMode: PaymentMode;
  notes?: string;
  status?: 'Present' | 'Absent';
  createdAt: string;
}

export interface MarkAttendanceRequest {
  workerId: string;
  projectId: string;
  siteId?: string;
  site: string;
  attendanceDate: string;
  shiftCount: number;
  overtimeHours: number;
  // Overtime amount and late fine are no longer collected from the
  // supervisor's mobile form (per the latest spec). They're still on
  // the Attendance type for legacy reads from the backend.
  overtimeAmount?: number;
  lateFine?: number;
  // Payment mode was also dropped from the supervisor form — it now
  // lives only in the admin-side Payment / Vendor flow. Marked
  // optional so legacy clients don't break.
  paymentMode?: PaymentMode;
  notes?: string;
}

export interface AttendanceListResponse {
  attendances: Attendance[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface WorkerListResponse {
  items: Worker[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  nextCursor: string | null;
}

export interface LabourTypeCount {
  labourType: string;
  count: number;
}
