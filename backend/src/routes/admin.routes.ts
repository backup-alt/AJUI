import { Router } from "express";
import * as authCtrl from "../controllers/auth.controller.js";
import * as adminCtrl from "../controllers/admin.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

router.post("/invites/supervisor", authCtrl.adminCreateInvite);
router.get("/invites/active", authCtrl.listActiveInvites);
router.post("/invites/supervisor/resend-otp", authCtrl.resendInviteOtp);
router.post("/users/deactivate", adminCtrl.deactivateSupervisor);

export default router;