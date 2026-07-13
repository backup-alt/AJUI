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
  total: number;
  page: number;
  limit: number;
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