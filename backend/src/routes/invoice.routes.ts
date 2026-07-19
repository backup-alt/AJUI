import { Router } from "express";
import { validate } from "../middleware/validation.js";
import { createInvoiceSchema, updateInvoiceSchema, listInvoicesSchema } from "../schemas/invoice.schema.js";
import * as ctrl from "../controllers/invoice.controller.js";

const router = Router();

router.get("/", validate(listInvoicesSchema, "query"), ctrl.listInvoices);
router.get("/:id", ctrl.getInvoice);
router.post("/", validate(createInvoiceSchema), ctrl.createInvoice);
router.patch("/:id", validate(updateInvoiceSchema), ctrl.updateInvoice);
router.delete("/:id", ctrl.deleteInvoice);

export default router;