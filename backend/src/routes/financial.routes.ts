import { Router } from "express";
import * as ctrl from "../controllers/financial.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole, canCreateMaterials, canCreateLabour, canCreateExpenses, canCreatePayments, canCreateVendors, canCreateSubcontractors } from "../middleware/rbac.js";
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
router.get("/materials", validate(listMaterialsSchema, "query"), ctrl.listMaterials);
router.get("/materials/pending", requireRole("admin", "project_manager"), ctrl.getPendingMaterials);
router.get("/materials/:id", ctrl.getMaterial);
router.patch("/materials/:id", validate(updateMaterialSchema), ctrl.updateMaterial);
router.post("/materials/:id/receipt", validate(uploadExpenseReceiptSchema), ctrl.uploadMaterialReceipt);
router.delete("/materials/:id", requireRole("admin", "project_manager"), ctrl.deleteMaterial);

// =================== LABOUR ===================
router.post(
  "/labour",
  validate(createLabourSchema),
  requireRole("admin", "project_manager", "supervisor"),
  ctrl.createLabour
);
router.get("/labour", validate(listLabourSchema, "query"), ctrl.listLabour);
router.get("/labour/pending", requireRole("admin", "project_manager"), ctrl.getPendingLabour);
router.get("/labour/summary/:projectId", ctrl.getLabourSummary);
router.get("/labour/:id", ctrl.getLabour);
router.patch("/labour/:id", validate(updateLabourSchema), ctrl.updateLabour);
router.delete("/labour/:id", requireRole("admin", "project_manager"), ctrl.deleteLabour);

// =================== EXPENSES ===================
router.post(
  "/expenses",
  validate(createExpenseSchema),
  requireRole("admin", "accountant", "supervisor"),
  ctrl.createExpense
);
router.get("/expenses", validate(listExpensesSchema, "query"), ctrl.listExpenses);
router.get("/expenses/pending", requireRole("admin", "accountant", "project_manager"), ctrl.getPendingExpenses);
router.get("/expenses/ledger/:projectId/:site", ctrl.getExpenseLedger);
router.get("/expenses/:id", ctrl.getExpense);
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
router.get("/payments", validate(listPaymentsSchema, "query"), ctrl.listPayments);
router.get("/payments/pending", requireRole("admin", "accountant"), ctrl.getPendingPayments);
router.get("/payments/collection-summary", requireRole("admin", "accountant"), ctrl.getPaymentCollectionSummary);
router.get("/payments/:id", ctrl.getPayment);
router.patch("/payments/:id", validate(updatePaymentSchema), ctrl.updatePayment);
router.delete("/payments/:id", requireRole("admin", "accountant"), ctrl.deletePayment);

// =================== VENDORS ===================
router.post(
  "/vendors",
  validate(createVendorSchema),
  requireRole("admin", "project_manager"),
  ctrl.createVendor
);
router.get("/vendors", validate(listVendorsSchema, "query"), ctrl.listVendors);
router.get("/vendors/:id/purchase-history", ctrl.getVendorPurchaseHistory);
router.get("/vendors/:id", ctrl.getVendor);
router.patch("/vendors/:id", validate(updateVendorSchema), ctrl.updateVendor);
router.delete("/vendors/:id", requireRole("admin", "project_manager"), ctrl.deleteVendor);

// =================== SUBCONTRACTORS ===================
router.post(
  "/subcontractors",
  validate(createSubcontractorSchema),
  requireRole("admin", "project_manager"),
  ctrl.createSubcontractor
);
router.get("/subcontractors", validate(listSubcontractorsSchema, "query"), ctrl.listSubcontractors);
router.get("/subcontractors/pending", requireRole("admin", "project_manager"), ctrl.getPendingSubcontractors);
router.get("/subcontractors/:id", ctrl.getSubcontractor);
router.patch("/subcontractors/:id", validate(updateSubcontractorSchema), ctrl.updateSubcontractor);
router.delete("/subcontractors/:id", requireRole("admin", "project_manager"), ctrl.deleteSubcontractor);

// =================== APPROVALS ===================
router.get("/approvals", validate(listApprovalsSchema, "query"), ctrl.listApprovals);
router.get("/approvals/count", ctrl.getApprovalCount);
router.get("/approvals/:id", ctrl.getApproval);
router.put("/approvals/:id/approve", requireRole("admin", "project_manager", "accountant"), ctrl.approveApproval);
router.put("/approvals/:id/reject", requireRole("admin", "project_manager", "accountant"), ctrl.rejectApproval);

export default router;
