export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected';

export interface Expense {
  _id: string;
  expenseId: string;
  type: 'site' | 'general';
  projectId?: string;
  projectName?: string;
  siteId?: string;
  site?: string;
  supervisor?: string;
  supervisorId?: string;
  transactionType?: 'Purchase' | 'Cash Added';
  amount: number;
  siteMaterialBalance?: number;
  poNumber?: string;
  receiptImage?: string;
  receiptImageMimeType?: string;
  receiptImageName?: string;
  runningBalance: number;
  date: string;
  description: string;
  status: ExpenseStatus;
  notes?: string;
  issuedAmount?: number;
  submittedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  type: 'site' | 'general';
  projectId: string;
  siteId: string;
  transactionType?: string;
  amount: number;
  date: string;
  description: string;
  site?: string;
  isSiteMaterial?: boolean;
  materialName?: string;
  materialUnit?: string;
  materialQuantity?: number;
  materialVendor?: string;
  materialVendorId?: string;
  remainingStock?: number;
  issuedAmount?: number;
  customFields?: Record<string, unknown>;
}

export interface ExpenseListResponse {
  expenses: Expense[];
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

export interface ExpenseFilters {
  projectId?: string;
  siteId?: string;
  status?: ExpenseStatus;
  type?: 'site' | 'general';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface UploadReceiptResponse {
  expense: Expense;
}