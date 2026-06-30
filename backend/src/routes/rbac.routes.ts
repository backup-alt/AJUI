import { Router } from "express";
import * as ctrl from "../controllers/rbac.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { updatePermissionSchema, getPermissionsSchema } from "../schemas/rbac.schema.js";

const router = Router();
router.use(requireAuth);

// Any authenticated user can see their own effective permissions
router.get("/me/permissions", ctrl.getMyPermissions);

// Admin-only: configure permissions
router.get("/permissions/defaults", ctrl.getDefaults);
router.get("/permissions", ctrl.getAllPermissions);
router.get("/permissions/:role", validate(getPermissionsSchema, "params"), ctrl.getPermissionsForRole);
router.patch(
  "/permissions/:role/:module",
  validate(updatePermissionSchema),
  ctrl.updatePermission
);
router.post("/permissions/:role/reset", ctrl.resetPermissions);

export default router;
