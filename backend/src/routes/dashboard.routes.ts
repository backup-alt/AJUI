import { Router } from "express";
import * as ctrl from "../controllers/dashboard.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import {
  dashboardQuerySchema,
  createReportSchema,
  updateReportSchema,
  listReportsSchema,
} from "../schemas/dashboard.schema.js";

const router = Router();
router.use(requireAuth);

// Dashboard - admin, accountant, project_manager
router.get("/dashboard/kpis", requireRole("admin", "accountant", "project_manager"), ctrl.getKPIs);
router.get("/dashboard/universal", requireRole("admin", "accountant", "project_manager"), validate(dashboardQuerySchema, "query"), ctrl.getUniversalDashboard);

// Reports
router.post("/reports", validate(createReportSchema), requireRole("admin", "accountant"), ctrl.createReport);
router.get("/reports", validate(listReportsSchema, "query"), ctrl.listReports);
router.get("/reports/:id", ctrl.getReport);
router.patch("/reports/:id", validate(updateReportSchema), requireRole("admin", "accountant"), ctrl.updateReport);
router.delete("/reports/:id", requireRole("admin"), ctrl.deleteReport);
router.post("/reports/:id/generate", requireRole("admin", "accountant", "project_manager"), ctrl.generateReport);

export default router;
