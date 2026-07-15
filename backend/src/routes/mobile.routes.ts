import { Router } from "express";
import * as ctrl from "../controllers/mobile.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import {
  updateOwnProfileSchema,
  registerDeviceSchema,
  unregisterDeviceSchema,
  createMaterialMobileSchema,
  createLabourMobileSchema,
  createExpenseMobileSchema,
  approvalActionSchema,
  updateMaterialStockSchema,
} from "../schemas/mobile.schema.js";

const router = Router();
router.use(requireAuth);

// Profile
router.get("/supervisor/profile", ctrl.getOwnProfile);
router.patch("/supervisor/profile", validate(updateOwnProfileSchema), ctrl.updateOwnProfile);

// Dashboard
router.get("/supervisor/dashboard", ctrl.getDashboard);

// Projects
router.get("/supervisor/projects", ctrl.getAssignedProjects);
router.get("/supervisor/projects/detailed", ctrl.getAssignedProjectsDetailed);
router.get("/supervisor/projects/:projectId", ctrl.getProjectDetail);
router.get("/supervisor/projects/:projectId/approvals", ctrl.getProjectApprovals);

// Sites
router.get("/supervisor/sites", ctrl.getAssignedSites);

// Approvals
router.get("/supervisor/approvals", ctrl.getActionableApprovals);
router.get("/supervisor/approvals/:id", ctrl.getApprovalDetail);
router.patch("/supervisor/approvals/:id", validate(approvalActionSchema), ctrl.takeApprovalAction);

// Materials
router.get("/supervisor/materials", ctrl.listMaterials);
router.get("/supervisor/materials/:id", ctrl.getMaterial);
router.post("/supervisor/materials", validate(createMaterialMobileSchema), ctrl.createMaterial);
router.patch("/supervisor/materials/:id/stock", validate(updateMaterialStockSchema), ctrl.updateMaterialStock);

// Labour
router.get("/supervisor/labour", ctrl.listLabour);
router.get("/supervisor/labour/:id", ctrl.getLabour);
router.post("/supervisor/labour", validate(createLabourMobileSchema), ctrl.createLabour);

// Expenses
router.get("/supervisor/expenses", ctrl.listExpenses);
router.get("/supervisor/expenses/:id", ctrl.getExpense);
router.post("/supervisor/expenses", validate(createExpenseMobileSchema), ctrl.createExpense);

// Devices (push notifications)
router.post("/supervisor/device/register", validate(registerDeviceSchema), ctrl.registerDevice);
router.post("/supervisor/device/unregister", validate(unregisterDeviceSchema), ctrl.unregisterDevice);
router.get("/supervisor/devices", ctrl.getMyDevices);

// Vendors
router.get("/supervisor/vendors", ctrl.listVendorsForSupervisor);

export default router;
