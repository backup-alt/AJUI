export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected';
export type TransactionType = 'Material' | 'Labour' | 'Transport' | 'Equipment' | 'Other' | 'Food' | 'Fuel' | 'Cash Added' | 'Purchase';

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
  transactionType?: TransactionType;
  amount: number;
  siteMaterialBalance?: number;
  reference?: string;
  runningBalance: number;
  department?: string;
  category?: string;
  amountPaidBy?: string;
  date: string;
  description: string;
  status: ExpenseStatus;
  submittedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  type: 'site' | 'general';
  projectId: string;
  siteId: string;
  transactionType?: string;
  amount: number;
  reference?: string;
  date: string;
  description: string;
  amountPaidBy?: string;
  site?: string;
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