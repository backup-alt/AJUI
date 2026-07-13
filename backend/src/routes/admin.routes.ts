import { Router } from "express";
import * as authCtrl from "../controllers/auth.controller.js";
import * as adminCtrl from "../controllers/admin.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

router.get("/users", adminCtrl.listAllUsers);
router.get("/users/:id", adminCtrl.getUserById);
router.get("/users/:id/request-permissions", adminCtrl.getUserRequestPermissions);
router.put("/users/:id/request-permissions", adminCtrl.saveUserRequestPermissions);
router.get("/users/:id/activity", adminCtrl.getEmployeeActivity);
router.get("/sessions", adminCtrl.getAllSessions);
router.get("/access-schedule", adminCtrl.getAccessSchedule);
router.put("/access-schedule", adminCtrl.saveAccessSchedule);
router.get("/access-schedule/status", adminCtrl.getAccessScheduleStatus);
router.get("/sites", adminCtrl.listAllSites);
router.get("/sites/:id/materials", adminCtrl.getSiteMaterials);
router.post("/invites/supervisor", authCtrl.adminCreateInvite);
router.get("/invites/active", authCtrl.listActiveInvites);
router.get("/invites/employee/active", authCtrl.listActiveEmployeeInvites);
router.post("/invites/supervisor/resend-otp", authCtrl.resendInviteOtp);
router.post("/invites/supervisor/send-email", authCtrl.sendSupervisorInviteEmail);
router.post("/invites/employee", authCtrl.adminCreateEmployeeInvite);
router.post("/users/deactivate", adminCtrl.deactivateSupervisor);

// Access Templates
router.get("/access-templates", adminCtrl.listAccessTemplates);
router.get("/access-templates/role/:role", adminCtrl.getAccessTemplateByRole);
router.patch("/access-templates/role/:role", adminCtrl.updateAccessTemplateByRole);
router.get("/access-templates/:id", adminCtrl.getAccessTemplate);
router.post("/access-templates", adminCtrl.createAccessTemplate);
router.patch("/access-templates/:id", adminCtrl.updateAccessTemplate);
router.delete("/access-templates/:id", adminCtrl.deleteAccessTemplate);

export default router;
