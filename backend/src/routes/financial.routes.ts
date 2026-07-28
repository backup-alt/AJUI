import { Router } from "express";
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
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsSchema,
  createVendorSchema,
  updateVendorSchema,
  listVendorsSchema,
  createSubcontractorSchema,
  updateSubcontractorSchema,
  listSubcontractorsSchema,
  listApprovalsSchema,
  listInventorySchema,
  missingMaterialsForSiteSchema,
  initializeInventorySchema,
} from "../schemas/financial.schema.js";

const router = Router();
router.use(requireAuth);

// =================== MATERIALS ===================
router.post(
  "/materials",
  validate(createMaterialSchema),
  requireRole("admin", "project_manager", "supervisor"),
  ctrl.createMaterial
);
router.get("/materials", validate(listMaterialsSchema, "query"), cache(15), ctrl.listMaterials);
router.get("/materials/pending", requireRole("admin", "project_manager"), cache(10), ctrl.getPendingMaterials);
router.get("/materials/:id", cache(30), ctrl.getMaterial);
router.patch("/materials/:id", validate(updateMaterialSchema), ctrl.updateMaterial);
router.post("/materials/:id/receipt", validate(uploadExpenseReceiptSchema), ctrl.uploadMaterialReceipt);
router.delete("/materials/:id", requireRole("admin", "project_manager"), ctrl.deleteMaterial);

// =================== INVENTORY ===================
router.get("/inventory", validate(listInventorySchema, "query"), cache(20), ctrl.listInventory);
router.get(
  "/inventory/missing",
  validate(missingMaterialsForSiteSchema, "query"),
  requireRole("admin", "project_manager", "supervisor"),
  ctrl.getMissingMaterials
);
router.post(
  "/inventory/initialize",
  validate(initializeInventorySchema),
  requireRole("admin", "project_manager"),
  ctrl.initializeInventory
);

// =================== LABOUR ===================
router.post(
  "/labour",
  validate(createLabourSchema),
  requireRole("admin", "project_manager", "supervisor"),
  ctrl.createLabour
);
router.get("/labour", validate(listLabourSchema, "query"), cache(15), ctrl.listLabour);
router.get("/labour/pending", requireRole("admin", "project_manager"), cache(10), ctrl.getPendingLabour);
router.get("/labour/summary/:projectId", cache(30), ctrl.getLabourSummary);
router.get("/labour/:id", cache(30), ctrl.getLabour);
router.patch("/labour/:id", validate(updateLabourSchema), ctrl.updateLabour);
router.delete("/labour/:id", requireRole("admin", "project_manager"), ctrl.deleteLabour);

// =================== ATTENDANCE (New Model) ===================
router.get("/attendance/grouped", attendanceCtrl.getGroupedAttendance);
router.get("/attendance/report", attendanceCtrl.getLabourReportHandler);

// =================== EXPENSES ===================
router.post(
  "/expenses",
  validate(createExpenseSchema),
  requireRole("admin", "accountant", "supervisor"),
  ctrl.createExpense
);
router.get("/expenses", validate(listExpensesSchema, "query"), cache(15), ctrl.listExpenses);
router.get("/expenses/pending", requireRole("admin", "accountant", "project_manager"), cache(10), ctrl.getPendingExpenses);
router.get("/expenses/ledger/:projectId/:site", cache(30), ctrl.getExpenseLedger);
router.get("/expenses/:id", cache(30), ctrl.getExpense);
router.patch("/expenses/:id", validate(updateExpenseSchema), ctrl.updateExpense);
router.post("/expenses/:id/receipt", validate(uploadExpenseReceiptSchema), ctrl.uploadExpenseReceipt);
router.post("/expenses/:id/received", ctrl.markAsReceived);
router.delete("/expenses/:id", requireRole("admin", "accountant"), ctrl.deleteExpense);

// =================== PAYMENTS ===================
router.post(
  "/payments",
  validate(createPaymentSchema),
  requireRole("admin", "accountant"),
  ctrl.createPayment
);
router.get("/payments", validate(listPaymentsSchema, "query"), cache(20), ctrl.listPayments);
router.get("/payments/pending", requireRole("admin", "accountant"), cache(10), ctrl.getPendingPayments);
router.get("/payments/collection-summary", requireRole("admin", "accountant"), cache(30), ctrl.getPaymentCollectionSummary);
router.get("/payments/:id", cache(30), ctrl.getPayment);
router.patch("/payments/:id", validate(updatePaymentSchema), ctrl.updatePayment);
router.delete("/payments/:id", requireRole("admin", "accountant"), ctrl.deletePayment);

// =================== VENDORS ===================
router.post(
  "/vendors",
  validate(createVendorSchema),
  requireRole("admin", "project_manager"),
  ctrl.createVendor
);
router.get("/vendors", validate(listVendorsSchema, "query"), cache(20), ctrl.listVendors);
router.get("/vendors/:id/purchase-history", cache(20), ctrl.getVendorPurchaseHistory);
router.get("/vendors/:id", cache(30), ctrl.getVendor);
router.patch("/vendors/:id", validate(updateVendorSchema), ctrl.updateVendor);
router.delete("/vendors/:id", requireRole("admin", "project_manager"), ctrl.deleteVendor);

// =================== SUBCONTRACTORS ===================
router.post(
  "/subcontractors",
  validate(createSubcontractorSchema),
  requireRole("admin", "project_manager"),
  ctrl.createSubcontractor
);
router.get("/subcontractors", validate(listSubcontractorsSchema, "query"), cache(20), ctrl.listSubcontractors);
router.get("/subcontractors/pending", requireRole("admin", "project_manager"), cache(10), ctrl.getPendingSubcontractors);
router.get("/subcontractors/:id", cache(30), ctrl.getSubcontractor);
router.patch("/subcontractors/:id", validate(updateSubcontractorSchema), ctrl.updateSubcontractor);
router.delete("/subcontractors/:id", requireRole("admin", "project_manager"), ctrl.deleteSubcontractor);

// =================== APPROVALS ===================
router.get("/approvals", validate(listApprovalsSchema, "query"), cache(10), ctrl.listApprovals);
router.get("/approvals/count", cache(10), ctrl.getApprovalCount);
router.get("/approvals/:id", ctrl.getApproval);
router.put("/approvals/:id/approve", requireRole("admin", "project_manager", "accountant"), ctrl.approveApproval);
router.put("/approvals/:id/reject", requireRole("admin", "project_manager", "accountant"), ctrl.rejectApproval);

export default router;
