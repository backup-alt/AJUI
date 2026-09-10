import winston from "winston";
import { env } from "../config/env.js";

// MEDIUM-3 fix: Structured audit logging for financial operations
const auditLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: "logs/audit.log",
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30, // Keep 30 days
    }),
    ...(env.NODE_ENV !== "production"
      ? [new winston.transports.Console({ format: winston.format.simple() })]
      : []),
  ],
});

export interface AuditLogEntry {
  action: string;
  userId: string;
  userRole?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  amount?: number;
  status?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp?: string;
}

export function logFinancialOperation(entry: AuditLogEntry): void {
  auditLogger.info("Financial operation", {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
}

export function logApprovalAction(
  action: "approved" | "rejected",
  approvalId: string,
  approvalType: string,
  reviewer: string,
  reviewerRole: string,
  projectId?: string,
  amount?: number,
  metadata?: Record<string, unknown>
): void {
  logFinancialOperation({
    action: `approval_${action}`,
    userId: reviewer,
    userRole: reviewerRole,
    entityType: "approval",
    entityId: approvalId,
    projectId,
    amount,
    status: action,
    metadata: {
      approvalType,
      ...metadata,
    },
  });
}

export function logPaymentOperation(
  action: "created" | "updated" | "deleted" | "approved" | "rejected",
  paymentId: string,
  userId: string,
  userRole: string,
  projectId: string,
  clientId: string,
  amount: number,
  metadata?: Record<string, unknown>
): void {
  logFinancialOperation({
    action: `payment_${action}`,
    userId,
    userRole,
    entityType: "payment",
    entityId: paymentId,
    projectId,
    amount,
    metadata: {
      clientId,
      ...metadata,
    },
  });
}

export function logExpenseOperation(
  action: "created" | "updated" | "deleted" | "approved" | "rejected",
  expenseId: string,
  userId: string,
  userRole: string,
  projectId: string | undefined,
  amount: number,
  transactionType?: string,
  metadata?: Record<string, unknown>
): void {
  logFinancialOperation({
    action: `expense_${action}`,
    userId,
    userRole,
    entityType: "expense",
    entityId: expenseId,
    projectId,
    amount,
    metadata: {
      transactionType,
      ...metadata,
    },
  });
}

export function logMaterialOperation(
  action: "created" | "updated" | "deleted" | "approved" | "rejected",
  materialId: string,
  userId: string,
  userRole: string,
  projectId: string | undefined,
  quantity: number,
  metadata?: Record<string, unknown>
): void {
  logFinancialOperation({
    action: `material_${action}`,
    userId,
    userRole,
    entityType: "material",
    entityId: materialId,
    projectId,
    metadata: {
      quantity,
      ...metadata,
    },
  });
}

export default auditLogger;
