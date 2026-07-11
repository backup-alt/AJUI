import { Request, Response, NextFunction } from "express";
import * as materialService from "../services/material.service.js";
import * as labourService from "../services/labour.service.js";
import * as expenseService from "../services/expense.service.js";
import * as paymentService from "../services/payment.service.js";
import * as vendorService from "../services/vendor.service.js";
import * as subcontractorService from "../services/subcontractor.service.js";
import * as approvalService from "../services/approval.service.js";
import { getScopedProjectIds } from "../middleware/rbac.js";

// =================== MATERIALS ===================
export async function createMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await materialService.createMaterial(req.body);
    res.status(201).json({ material });
  } catch (e) { next(e); }
}

export async function listMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await materialService.listMaterials({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      vendorId: req.query.vendorId as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      scopeProjectIds,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await materialService.getMaterialById(req.params.id);
    res.json({ material });
  } catch (e) { next(e); }
}

export async function updateMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await materialService.updateMaterial(req.params.id, req.body);
    res.json({ material });
  } catch (e) { next(e); }
}

export async function deleteMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    await materialService.deleteMaterial(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getPendingMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const materials = await materialService.getPendingMaterials(scopeProjectIds);
    res.json({ materials });
  } catch (e) { next(e); }
}

// =================== LABOUR ===================
export async function createLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const labour = await labourService.createLabour(req.body);
    res.status(201).json({ labour });
  } catch (e) { next(e); }
}

export async function listLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await labourService.listLabour({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      category: req.query.category as string | undefined,
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      scopeProjectIds,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const labour = await labourService.getLabourById(req.params.id);
    res.json({ labour });
  } catch (e) { next(e); }
}

export async function updateLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const labour = await labourService.updateLabour(req.params.id, req.body);
    res.json({ labour });
  } catch (e) { next(e); }
}

export async function deleteLabour(req: Request, res: Response, next: NextFunction) {
  try {
    await labourService.deleteLabour(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getLabourSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const summary = await labourService.getLabourSummary(req.params.projectId, scopeProjectIds);
    res.json({ summary });
  } catch (e) { next(e); }
}

export async function getPendingLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const labour = await labourService.getPendingLabour(scopeProjectIds);
    res.json({ labour });
  } catch (e) { next(e); }
}

// =================== EXPENSES ===================
export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.createExpense(req.body);
    res.status(201).json({ expense });
  } catch (e) { next(e); }
}

export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await expenseService.listExpenses({
      type: req.query.type as string | undefined,
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      scopeProjectIds,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.getExpenseById(req.params.id);
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.updateExpense(req.params.id, req.body);
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    await expenseService.deleteExpense(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getExpenseLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const ledger = await expenseService.getExpenseLedger(req.params.projectId, req.params.site, scopeProjectIds);
    res.json({ ledger });
  } catch (e) { next(e); }
}

export async function getPendingExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const expenses = await expenseService.getPendingExpenses(scopeProjectIds);
    res.json({ expenses });
  } catch (e) { next(e); }
}

// =================== PAYMENTS ===================
export async function createPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).json({ payment });
  } catch (e) { next(e); }
}

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await paymentService.listPayments({
      projectId: req.query.projectId as string | undefined,
      clientId: req.query.clientId as string | undefined,
      status: req.query.status as string | undefined,
      mode: req.query.mode as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      scopeProjectIds,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    res.json({ payment });
  } catch (e) { next(e); }
}

export async function updatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.updatePayment(req.params.id, req.body);
    res.json({ payment });
  } catch (e) { next(e); }
}

export async function deletePayment(req: Request, res: Response, next: NextFunction) {
  try {
    await paymentService.deletePayment(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getPaymentCollectionSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const summary = await paymentService.getCollectionSummary({
      projectId: req.query.projectId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      scopeProjectIds,
    });
    res.json({ summary });
  } catch (e) { next(e); }
}

export async function getPendingPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const payments = await paymentService.getPendingPayments(scopeProjectIds);
    res.json({ payments });
  } catch (e) { next(e); }
}

// =================== VENDORS ===================
export async function createVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const vendor = await vendorService.createVendor(req.body);
    res.status(201).json({ vendor });
  } catch (e) { next(e); }
}

export async function listVendors(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vendorService.listVendors({
      materialType: req.query.materialType as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const vendor = await vendorService.getVendorById(req.params.id);
    res.json({ vendor });
  } catch (e) { next(e); }
}

export async function updateVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const vendor = await vendorService.updateVendor(req.params.id, req.body);
    res.json({ vendor });
  } catch (e) { next(e); }
}

export async function deleteVendor(req: Request, res: Response, next: NextFunction) {
  try {
    await vendorService.deleteVendor(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getVendorPurchaseHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vendorService.getVendorPurchaseHistory(req.params.id);
    res.json(result);
  } catch (e) { next(e); }
}

// =================== SUBCONTRACTORS ===================
export async function createSubcontractor(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await subcontractorService.createSubcontractor(req.body);
    res.status(201).json({ subcontractor: sub });
  } catch (e) { next(e); }
}

export async function listSubcontractors(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await subcontractorService.listSubcontractors({
      projectId: req.query.projectId as string | undefined,
      approvalStatus: req.query.approvalStatus as string | undefined,
      paymentStatus: req.query.paymentStatus as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      scopeProjectIds,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getSubcontractor(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await subcontractorService.getSubcontractorById(req.params.id);
    res.json({ subcontractor: sub });
  } catch (e) { next(e); }
}

export async function updateSubcontractor(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await subcontractorService.updateSubcontractor(req.params.id, req.body);
    res.json({ subcontractor: sub });
  } catch (e) { next(e); }
}

export async function deleteSubcontractor(req: Request, res: Response, next: NextFunction) {
  try {
    await subcontractorService.deleteSubcontractor(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getPendingSubcontractors(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const subs = await subcontractorService.getPendingSubcontractors(scopeProjectIds);
    res.json({ subcontractors: subs });
  } catch (e) { next(e); }
}

// =================== APPROVALS ===================
export async function listApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await approvalService.listApprovals({
      type: req.query.type as never,
      projectId: req.query.projectId as string | undefined,
      status: req.query.status as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      scopeProjectIds,
      userRole: req.user?.role,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const approval = await approvalService.getApprovalById(req.params.id);
    res.json({ approval });
  } catch (e) { next(e); }
}

export async function approveApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewer = req.user?.sub || "unknown";
    const approval = await approvalService.approveRequest(req.params.id, reviewer);
    res.json({ approval });
  } catch (e) { next(e); }
}

export async function rejectApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewer = req.user?.sub || "unknown";
    const approval = await approvalService.rejectRequest(req.params.id, reviewer);
    res.json({ approval });
  } catch (e) { next(e); }
}

export async function getApprovalCount(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const count = await approvalService.getApprovalCount({
      projectId: req.query.projectId as string | undefined,
      type: req.query.type as never,
      scopeProjectIds,
      userRole: req.user?.role,
    });
    res.json(count);
  } catch (e) { next(e); }
}
