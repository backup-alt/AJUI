import { Router } from "express";
import * as ctrl from "../controllers/mobile.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { cache } from "../middleware/cache.js";
import {
  updateOwnProfileSchema,
  registerDeviceSchema,
  unregisterDeviceSchema,
  createMaterialMobileSchema,
  createLabourMobileSchema,
  createExpenseMobileSchema,
  uploadExpenseReceiptMobileSchema,
  approvalActionSchema,
  updateMaterialStockSchema,
  createWorkerSchema,
  markAttendanceSchema,
  updateAttendanceSchema,
  addExistingMaterialMobileSchema,
} from "../schemas/mobile.schema.js";

const router = Router();
router.use(requireAuth);

// Profile
router.get("/supervisor/profile", cache(60), ctrl.getOwnProfile);
router.patch("/supervisor/profile", validate(updateOwnProfileSchema), ctrl.updateOwnProfile);

// Dashboard
router.get("/supervisor/dashboard", cache(10), ctrl.getDashboard);

// Projects
router.get("/supervisor/projects", cache(30), ctrl.getAssignedProjects);
router.get("/supervisor/projects/detailed", cache(20), ctrl.getAssignedProjectsDetailed);
router.get("/supervisor/projects/:projectId", cache(20), ctrl.getProjectDetail);
router.get("/supervisor/projects/:projectId/approvals", cache(10), ctrl.getProjectApprovals);

// Sites
router.get("/supervisor/sites", cache(30), ctrl.getAssignedSites);

// Approvals
router.get("/supervisor/approvals", cache(10), ctrl.getActionableApprovals);
router.get("/supervisor/approvals/:id", cache(20), ctrl.getApprovalDetail);
router.patch("/supervisor/approvals/:id", validate(approvalActionSchema), ctrl.takeApprovalAction);

// Materials
router.get("/supervisor/material-names", cache(60), ctrl.listMaterialNames);
router.get("/supervisor/materials", cache(15), ctrl.listMaterials);
router.get("/supervisor/material-bill-requests", cache(10), ctrl.listMaterialBillRequests);
router.get("/supervisor/materials/:id", cache(30), ctrl.getMaterial);
router.post("/supervisor/materials", validate(createMaterialMobileSchema), ctrl.createMaterial);
router.post("/supervisor/inventory/add-existing", validate(addExistingMaterialMobileSchema), ctrl.addExistingMaterial);
router.patch("/supervisor/materials/:id/stock", validate(updateMaterialStockSchema), ctrl.updateMaterialStock);
router.post("/supervisor/materials/:id/receipt", validate(uploadExpenseReceiptMobileSchema), ctrl.uploadMaterialReceipt);

// Labour
router.get("/supervisor/labour", cache(15), ctrl.listLabour);
router.get("/supervisor/labour/:id", cache(30), ctrl.getLabour);
router.post("/supervisor/labour", validate(createLabourMobileSchema), ctrl.createLabour);

// Workers
router.post("/supervisor/workers", validate(createWorkerSchema), ctrl.createWorker);
router.get("/supervisor/workers", cache(30), ctrl.listWorkers);
router.get("/supervisor/workers/:id", cache(30), ctrl.getWorker);
router.patch("/supervisor/workers/:id", ctrl.updateWorker);

// Attendance
router.post("/supervisor/attendance", validate(markAttendanceSchema), ctrl.markAttendance);
router.get("/supervisor/attendance", ctrl.listAttendanceForDate);
router.get("/supervisor/attendance/worker/:workerId", cache(20), ctrl.listAttendanceForWorker);
router.get("/supervisor/attendance/:id", ctrl.getAttendance);
router.patch("/supervisor/attendance/:id", validate(updateAttendanceSchema), ctrl.updateAttendance);
router.delete("/supervisor/attendance/:id", ctrl.deleteAttendance);
router.get("/supervisor/labour-types", cache(30), ctrl.getLabourTypeCounts);

// Subcontractors
router.get("/supervisor/subcontractors", cache(30), ctrl.listSubcontractors);

// Expenses
router.get("/supervisor/expenses", cache(15), ctrl.listExpenses);
router.get("/supervisor/expenses/:id", cache(30), ctrl.getExpense);
router.post("/supervisor/expenses", validate(createExpenseMobileSchema), ctrl.createExpense);
router.post("/supervisor/expenses/:id/receipt", validate(uploadExpenseReceiptMobileSchema), ctrl.uploadExpenseReceipt);

// Devices (push notifications)
router.post("/supervisor/device/register", validate(registerDeviceSchema), ctrl.registerDevice);
router.post("/supervisor/device/unregister", validate(unregisterDeviceSchema), ctrl.unregisterDevice);
router.get("/supervisor/devices", cache(60), ctrl.getMyDevices);

// Vendors
router.get("/supervisor/vendors", cache(30), ctrl.listVendorsForSupervisor);

// Notifications
router.get("/supervisor/notifications/recent", cache(10), ctrl.getRecentNotifications);

export default router;
