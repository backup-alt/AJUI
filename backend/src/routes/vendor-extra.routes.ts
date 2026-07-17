import { Router } from "express";
import * as ctrl from "../controllers/vendor-extra.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createVendorCustomColumnSchema,
  deleteVendorCustomColumnSchema,
  listVendorCustomColumnsSchema,
  upsertMaterialBillLinkSchema,
  listMaterialBillLinksSchema,
  deleteMaterialBillLinkSchema,
} from "../schemas/vendor-extra.schema.js";

const router = Router();
router.use(requireAuth);

// Custom columns for vendor site purchase details
router.get("/vendor-custom-columns", validate(listVendorCustomColumnsSchema, "query"), ctrl.listCustomColumns);
router.post("/vendor-custom-columns", validate(createVendorCustomColumnSchema), ctrl.addCustomColumn);
router.delete("/vendor-custom-columns", validate(deleteVendorCustomColumnSchema, "query"), ctrl.removeCustomColumn);

// Bill/Reference links for material purchase rows
router.get("/material-bill-links", validate(listMaterialBillLinksSchema, "query"), ctrl.listBillLinks);
router.post("/material-bill-links", validate(upsertMaterialBillLinkSchema), ctrl.upsertBillLink);
router.delete("/material-bill-links", validate(deleteMaterialBillLinkSchema, "query"), ctrl.removeBillLink);

export default router;
