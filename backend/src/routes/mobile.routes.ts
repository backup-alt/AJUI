import { Router } from "express";
import * as ctrl from "../controllers/mobile.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { updateOwnProfileSchema, registerDeviceSchema, unregisterDeviceSchema } from "../schemas/mobile.schema.js";

const router = Router();
router.use(requireAuth);

// Profile
router.get("/supervisor/profile", ctrl.getOwnProfile);
router.patch("/supervisor/profile", validate(updateOwnProfileSchema), ctrl.updateOwnProfile);

// Dashboard
router.get("/supervisor/dashboard", ctrl.getDashboard);

// Projects
router.get("/supervisor/projects", ctrl.getAssignedProjects);
router.get("/supervisor/projects/detailed", ctrl.getAssignedProjectsDetailed);
router.get("/supervisor/projects/:projectId", ctrl.getProjectDetail);
router.get("/supervisor/projects/:projectId/approvals", ctrl.getProjectApprovals);

// Sites
router.get("/supervisor/sites", ctrl.getAssignedSites);

// Approvals
router.get("/supervisor/approvals", ctrl.getActionableApprovals);

// Devices (push notifications)
router.post("/supervisor/device/register", validate(registerDeviceSchema), ctrl.registerDevice);
router.post("/supervisor/device/unregister", validate(unregisterDeviceSchema), ctrl.unregisterDevice);
router.get("/supervisor/devices", ctrl.getMyDevices);

export default router;
