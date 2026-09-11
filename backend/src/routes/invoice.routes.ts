import { Router } from "express";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { createInvoiceSchema, updateInvoiceSchema, listInvoicesSchema } from "../schemas/invoice.schema.js";
import * as ctrl from "../controllers/invoice.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();
router.use(requireAuth);

router.get("/", requireRole("admin", "project_manager", "accountant"), validate(listInvoicesSchema, "query"), ctrl.listInvoices);
router.get("/:id", requireRole("admin", "project_manager", "accountant"), ctrl.getInvoice);
router.post("/", requireRole("admin", "project_manager", "accountant"), validate(createInvoiceSchema), ctrl.createInvoice);
router.patch("/:id", requireRole("admin", "project_manager", "accountant"), validate(updateInvoiceSchema), ctrl.updateInvoice);

export default router;
