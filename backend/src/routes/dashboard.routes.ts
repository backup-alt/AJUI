import { Router } from "express";
import * as ctrl from "../controllers/dashboard.controller.js";
import * as batchCtrl from "../controllers/batch-dashboard.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { cache } from "../middleware/cache.js";
import {
  dashboardQuerySchema,
  createReportSchema,
  updateReportSchema,
  listReportsSchema,
} from "../schemas/dashboard.schema.js";

const router = Router();
router.use(requireAuth);

// Dashboard - admin, accountant, project_manager
// Short TTL — data changes frequently as approvals come in
router.get("/dashboard/kpis", requireRole("admin", "accountant", "project_manager"), cache(15), ctrl.getKPIs);
router.get("/dashboard/universal", requireRole("admin", "accountant", "project_manager"), validate(dashboardQuerySchema, "query"), cache(15), ctrl.getUniversalDashboard);

// BATCH: Single endpoint that returns ALL dashboard data at once.
// Replaces 10+ parallel API calls with 1 call. Cached for 15s.
router.get("/dashboard/batch", requireRole("admin", "accountant", "project_manager", "supervisor"), cache(15), batchCtrl.getBatchDashboard);

// Reports
router.post("/reports", validate(createReportSchema), requireRole("admin", "accountant"), ctrl.createReport);
router.get("/reports", validate(listReportsSchema, "query"), cache(30), ctrl.listReports);
router.get("/reports/:id", cache(30), ctrl.getReport);
router.patch("/reports/:id", validate(updateReportSchema), requireRole("admin", "accountant"), ctrl.updateReport);
router.delete("/reports/:id", requireRole("admin"), ctrl.deleteReport);
router.post("/reports/:id/generate", requireRole("admin", "accountant", "project_manager"), ctrl.generateReport);

export default router;
