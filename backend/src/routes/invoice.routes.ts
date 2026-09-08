import { Router } from "express";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { createInvoiceSchema, updateInvoiceSchema, listInvoicesSchema } from "../schemas/invoice.schema.js";
import * as ctrl from "../controllers/invoice.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listInvoicesSchema, "query"), ctrl.listInvoices);
router.get("/:id", ctrl.getInvoice);
router.post("/", validate(createInvoiceSchema), ctrl.createInvoice);
router.patch("/:id", requireRole("admin"), validate(updateInvoiceSchema), ctrl.updateInvoice);

export default router;
