import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

router.post("/invites/supervisor", ctrl.adminCreateInvite);

export default router;
