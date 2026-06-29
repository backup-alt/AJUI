import { Router } from "express";
import * as ctrl from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

router.post("/invites/supervisor", ctrl.adminCreateInvite);

export default router;
