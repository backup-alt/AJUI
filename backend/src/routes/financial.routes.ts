import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as ctrl from "../controllers/financial.controller.js";
import * as attendanceCtrl from "../controllers/attendance.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole, canCreateMaterials, canCreateLabour, canCreateExpenses, canCreatePayments, canCreateVendors, canCreateSubcontractors } from "../middleware/rbac.js";
import { cache } from "../middleware/cache.js";
import {
  createMaterialSchema,
  updateMaterialSchema,
  listMaterialsSchema,
  createLabourSchema,
  updateLabourSchema,
  listLabourSchema,
  createExpenseSchema,
  updateExpenseSchema,
  uploadExpenseReceiptSchema,
  listExpensesSchema,
  createGeneralExpenseSchema,
  updateGeneralExpenseSchema,
  listGeneralExpensesSchema,
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsSchema,
  createVendorSchema,
  updateVendorSchema,
  listVendorsSchema,
  createSubcontractorSchema,
  updateSubcontractorSchema,
  listSubcontractorsSchema,
  addSubcontractorPaymentSchema,
  createSubcontractorPaymentSchema,
  updateSubcontractorPaymentSchema,
  listSubcontractorPaymentsSchema,
  createSubcontractorLaborSchema,
  updateSubcontractorLaborSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  listPurchaseOrdersSchema,
  createGstRateSchema,
  listApprovalsSchema,
  listInventorySchema,
  missingMaterialsForSiteSchema,
  initializeInventorySchema,
  addInventoryMaterialSchema,
  createWorkerSchema,
  updateWorkerSchema,
  listWorkersSchema,
} from "../schemas/financial.schema.js";
import { approveRequestSchema, rejectRequestSchema } from "../schemas/approval.schema.js";

// HIGH-1 fix: Rate limiter for approval endpoints to prevent spam/DoS
const approvalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: "Too many approval requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();
router.use(requireAuth);

// =================== MATERIALS ===================
router.post(
  "/materials",
  validate(createMaterialSchema),
  requireRole("admin", "project_manager", "accountant", "supervisor"),
  ctrl.createMaterial
);
router.get("/materials", validate(listMaterialsSchema, "query"), cache(60), ctrl.listMaterials);
router.get("/materials/pending", requireRole("admin", "project_manager", "accountant"), cache(10), ctrl.getPendingMaterials);
router.get("/materials/diagnostic-find-one", ctrl.diagnosticFindOneMaterial);
router.get("/materials/:id", cache(30), ctrl.getMaterial);
router.patch("/materials/:id", validate(updateMaterialSchema), requireRole("admin"), ctrl.updateMaterial);
router.post("/materials/:id/receipt", validate(uploadExpenseReceiptSchema), ctrl.uploadMaterialReceipt);
router.delete("/materials/:id", requireRole("admin"), ctrl.deleteMaterial);

// =================== INVENTORY ===================
router.get("/inventory", validate(listInventorySchema, "query"), cache(60), ctrl.listInventory);
router.get("/inventory/diagnostic-find-one", ctrl.diagnosticFindOneInventory);
router.get(
  "/inventory/missing",
  validate(missingMaterialsForSiteSchema, "query"),
  requireRole("admin", "project_manager", "accountant", "supervisor"),
  ctrl.getMissingMaterials
);
router.post(
  "/inventory/initialize",
  validate(initializeInventorySchema),
  requireRole("admin", "project_manager", "accountant"),
  ctrl.initializeInventory
);
router.post(
  "/inventory/material",
  validate(addInventoryMaterialSchema),
  requireRole("admin", "project_manager", "accountant", "supervisor"),
  ctrl.addInventoryMaterial
);

// =================== LABOUR ===================
router.post(
  "/labour",
  validate(createLabourSchema),
  requireRole("admin", "project_manager", "accountant", "supervisor"),
  ctrl.createLabour
);
router.get("/labour", validate(listLabourSchema, "query"), cache(30), ctrl.listLabour);
router.get("/labour/pending", requireRole("admin", "project_manager", "accountant"), cache(10), ctrl.getPendingLabour);
router.get("/labour/summary/:projectId", cache(30), ctrl.getLabourSummary);
router.get("/labour/:id", cache(30), ctrl.getLabour);
router.patch("/labour/:id", validate(updateLabourSchema), requireRole("admin"), ctrl.updateLabour);
router.delete("/labour/:id", requireRole("admin"), ctrl.deleteLabour);

// =================== ATTENDANCE (New Model) ===================
router.get("/attendance/grouped", attendanceCtrl.getGroupedAttendance);
router.get("/attendance/report", attendanceCtrl.getLabourReportHandler);

// =================== SUBCONTRACTOR ATTENDANCE (bulk headcount) ===================
router.get("/subcontractor-attendance", cache(30), ctrl.listSubcontractorAttendance);

// =================== EXPENSES ===================
router.get("/expenses/project-rollup/:projectId", ctrl.getProjectExpenseOutputRollup);
router.post(
  "/expenses",
  validate(createExpenseSchema),
  requireRole("admin", "accountant", "project_manager", "supervisor"),
  ctrl.createExpense
);
router.get("/expenses", validate(listExpensesSchema, "query"), cache(60), ctrl.listExpenses);
router.get("/expenses/diagnostic-find-one", ctrl.diagnosticFindOneExpense);
router.get("/expenses/pending", requireRole("admin", "accountant", "project_manager"), cache(10), ctrl.getPendingExpenses);
router.get("/expenses/ledger/:projectId/:site", cache(30), ctrl.getExpenseLedger);
router.get("/expenses/:id", cache(30), ctrl.getExpense);
router.patch("/expenses/:id", validate(updateExpenseSchema), requireRole("admin"), ctrl.updateExpense);
router.post("/expenses/:id/receipt", validate(uploadExpenseReceiptSchema), ctrl.uploadExpenseReceipt);
router.post("/expenses/:id/received", requireRole("admin"), ctrl.markAsReceived);
router.delete("/expenses/:id", requireRole("admin"), ctrl.deleteExpense);

// =================== GENERAL EXPENSES (project-level "Expense") ===================
router.post(
  "/general-expenses",
  validate(createGeneralExpenseSchema),
  requireRole("admin", "accountant", "project_manager"),
  ctrl.createGeneralExpense
);
router.get("/general-expenses", validate(listGeneralExpensesSchema, "query"), cache(60), ctrl.listGeneralExpenses);
router.get("/general-expenses/all", cache(60), ctrl.listAllGeneralExpenses);
router.get("/general-expenses/:id", cache(30), ctrl.getGeneralExpense);
router.patch("/general-expenses/:id", validate(updateGeneralExpenseSchema), requireRole("admin"), ctrl.updateGeneralExpense);
router.post("/general-expenses/:id/receipt", validate(uploadExpenseReceiptSchema), ctrl.uploadGeneralExpenseReceipt);
router.delete("/general-expenses/:id", requireRole("admin"), ctrl.deleteGeneralExpense);

// =================== PAYMENTS ===================
router.post(
  "/payments",
  validate(createPaymentSchema),
  requireRole("admin", "accountant", "project_manager"),
  ctrl.createPayment
);
router.get("/payments", validate(listPaymentsSchema, "query"), cache(20), ctrl.listPayments);
router.get("/payments/pending", requireRole("admin", "accountant", "project_manager"), cache(10), ctrl.getPendingPayments);
router.get("/payments/collection-summary", requireRole("admin", "accountant", "project_manager"), cache(30), ctrl.getPaymentCollectionSummary);
router.get("/payments/:id", cache(30), ctrl.getPayment);
router.patch("/payments/:id", validate(updatePaymentSchema), requireRole("admin"), ctrl.updatePayment);
router.delete("/payments/:id", requireRole("admin"), ctrl.deletePayment);

// =================== VENDORS ===================
router.post(
  "/vendors",
  validate(createVendorSchema),
  requireRole("admin", "project_manager", "accountant"),
  ctrl.createVendor
);
router.get("/vendors", validate(listVendorsSchema, "query"), cache(20), ctrl.listVendors);
router.get("/vendors/:id/purchase-history", cache(20), ctrl.getVendorPurchaseHistory);
router.get("/vendors/:id", cache(30), ctrl.getVendor);
router.patch("/vendors/:id", validate(updateVendorSchema), requireRole("admin"), ctrl.updateVendor);
router.delete("/vendors/:id", requireRole("admin"), ctrl.deleteVendor);

// =================== SUBCONTRACTORS ===================
router.post(
  "/subcontractors",
  validate(createSubcontractorSchema),
  requireRole("admin", "project_manager", "accountant"),
  ctrl.createSubcontractor
);
router.get("/subcontractors", validate(listSubcontractorsSchema, "query"), cache(20), ctrl.listSubcontractors);
router.get("/subcontractors/for-worker", cache(20), ctrl.listSubcontractorsForWorker);
router.get("/subcontractors/spend-rollup", cache(10), ctrl.getSubcontractorSpendRollup);
router.get(
  "/subcontractors/all-active",
  requireRole("admin", "project_manager", "accountant"),
  cache(20),
  ctrl.listAllActiveSubcontractors
);
router.get("/subcontractors/:id", cache(30), ctrl.getSubcontractor);
router.patch("/subcontractors/:id", validate(updateSubcontractorSchema), requireRole("admin"), ctrl.updateSubcontractor);
router.delete("/subcontractors/:id", requireRole("admin"), ctrl.deleteSubcontractor);

// =================== SUBCONTRACTOR PAYMENTS ===================
router.get(
  "/subcontractor-payments",
  validate(listSubcontractorPaymentsSchema, "query"),
  cache(10),
  ctrl.listSubcontractorPayments
);
router.get(
  "/subcontractor-payments/summary/:id",
  cache(10),
  ctrl.getSubcontractorPaymentSummary
);
router.post(
  "/subcontractor-payments",
  validate(createSubcontractorPaymentSchema),
  requireRole("admin", "project_manager", "accountant"),
  ctrl.createSubcontractorPayment
);
router.patch(
  "/subcontractor-payments/:id",
  validate(updateSubcontractorPaymentSchema),
  requireRole("admin"),
  ctrl.updateSubcontractorPayment
);
router.delete(
  "/subcontractor-payments/:id",
  requireRole("admin"),
  ctrl.deleteSubcontractorPayment
);

// =================== SUBCONTRACTOR LABOR ROSTER ===================
router.get("/subcontractor-labor", ctrl.listSubcontractorLabor);
router.post(
  "/subcontractor-labor",
  validate(createSubcontractorLaborSchema),
  requireRole("admin", "project_manager", "accountant"),
  ctrl.createSubcontractorLabor
);
router.patch(
  "/subcontractor-labor/:id",
  validate(updateSubcontractorLaborSchema),
  requireRole("admin"),
  ctrl.updateSubcontractorLabor
);

// =================== WORKER ROSTER (web admin) ===================
// Read/write endpoints for the project workspace "Labour" tab. The same
// Worker collection the mobile supervisor app maintains via
// /api/mobile/supervisor/workers.
router.get(
  "/workers",
  validate(listWorkersSchema, "query"),
  cache(30),
  ctrl.listWorkers
);
router.post(
  "/workers",
  validate(createWorkerSchema),
  requireRole("admin", "project_manager", "accountant"),
  ctrl.createWorker
);
router.patch(
  "/workers/:id",
  validate(updateWorkerSchema),
  requireRole("admin"),
  ctrl.updateWorker
);
router.delete(
  "/workers/:id",
  requireRole("admin"),
  ctrl.deleteWorker
);

// =================== PURCHASE ORDERS ===================
router.get("/purchase-orders/gst-rates", ctrl.listPurchaseOrderGstRates);
router.post(
  "/purchase-orders/gst-rates",
  validate(createGstRateSchema),
  requireRole("admin", "project_manager", "accountant"),
  ctrl.createPurchaseOrderGstRate
);
router.get("/purchase-orders", validate(listPurchaseOrdersSchema, "query"), cache(10), ctrl.listPurchaseOrders);
router.get("/purchase-orders/:id", cache(20), ctrl.getPurchaseOrder);
router.post(
  "/purchase-orders",
  validate(createPurchaseOrderSchema),
  requireRole("admin", "project_manager", "accountant"),
  ctrl.createPurchaseOrder
);
router.put(
  "/purchase-orders/:id",
  validate(updatePurchaseOrderSchema),
  requireRole("admin"),
  ctrl.updatePurchaseOrder
);
router.delete(
  "/purchase-orders/:id",
  requireRole("admin"),
  ctrl.deletePurchaseOrder
);

// =================== APPROVALS ===================
router.get("/approvals", validate(listApprovalsSchema, "query"), cache(10), ctrl.listApprovals);
router.get("/approvals/count", cache(10), ctrl.getApprovalCount);
router.get("/approvals/:id", ctrl.getApproval);
router.put(
  "/approvals/:id/approve",
  approvalLimiter,
  validate(approveRequestSchema),
  requireRole("admin"),
  ctrl.approveApproval
);
router.put(
  "/approvals/:id/reject",
  approvalLimiter,
  validate(rejectRequestSchema),
  requireRole("admin"),
  ctrl.rejectApproval
);

export default router;
