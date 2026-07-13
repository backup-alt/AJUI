export type PaymentStatus = 'Pending' | 'Approved' | 'Rejected';
export type PaymentMode = 'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI' | 'NEFT';

export interface Payment {
  _id: string;
  paymentId: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  receiptNumber?: string;
  transactionReference?: string;
  collectedBy: string;
  status: PaymentStatus;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  projectId: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  receiptNumber?: string;
  transactionReference?: string;
  collectedBy: string;
  notes?: string;
}

export interface PaymentListResponse {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
}

export interface PaymentFilters {
  projectId?: string;
  status?: PaymentStatus;
  mode?: PaymentMode;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}