import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import * as ctrl from "../controllers/quotation.controller.js";

const router = Router();
router.use(requireAuth);

router.post("/quotations", requireRole("admin", "project_manager"), ctrl.createQuotation);
router.get("/quotations", ctrl.listQuotations);
router.get("/quotations/:id", ctrl.getQuotation);
router.patch("/quotations/:id", requireRole("admin", "project_manager"), ctrl.updateQuotation);
router.delete("/quotations/:id", requireRole("admin"), ctrl.deleteQuotation);

export default router;