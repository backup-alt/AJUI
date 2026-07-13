export type ApprovalType = 'material' | 'labour' | 'expense' | 'payment';
export type ApprovalAction = 'approve' | 'reject';

export interface Approval {
  _id?: string;
  approvalId: string;
  type: ApprovalType;
  title: string;
  projectId: string;
  projectName: string;
  site?: string;
  amount?: number;
  submittedAt: string;
  sourceCollection: string;
  sourceId: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  submittedBy?: string;
}

export interface ApprovalActionRequest {
  action: ApprovalAction;
  notes?: string;
  comment?: string;
}

export interface ApprovalsListResponse {
  approvals: Approval[];
  total: number;
  page: number;
  limit: number;
}

export interface ApprovalFilters {
  projectId?: string;
  type?: ApprovalType;
  status?: 'Pending' | 'Approved' | 'Rejected';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface ApprovalDetailResponse {
  approval: Approval;
  details: Record<string, unknown>;
}