import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validation.js";
import * as ctrl from "../controllers/quotation.controller.js";
import { createQuotationSchema, updateQuotationSchema, listQuotationsSchema } from "../schemas/quotation.schema.js";

const router = Router();
router.use(requireAuth);

router.post("/quotations", requireRole("admin", "project_manager"), validate(createQuotationSchema), ctrl.createQuotation);
router.get("/quotations", validate(listQuotationsSchema, "query"), ctrl.listQuotations);
router.get("/quotations/:id", ctrl.getQuotation);
router.patch("/quotations/:id", requireRole("admin", "project_manager"), validate(updateQuotationSchema), ctrl.updateQuotation);
router.delete("/quotations/:id", requireRole("admin"), ctrl.deleteQuotation);

export default router;
