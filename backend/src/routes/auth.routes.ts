import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as ctrl from "../controllers/auth.controller.js";
import { validate } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyInviteSchema,
  supervisorSignupSchema,
} from "../schemas/auth.schema.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", authLimiter, validate(loginSchema), ctrl.login);
router.post("/refresh", ctrl.refresh);
router.post("/logout", ctrl.logout);
router.get("/me", requireAuth, ctrl.me);
router.get("/sessions", requireAuth, ctrl.getSessions);
router.delete("/sessions/:sessionId", requireAuth, ctrl.revokeSession);
router.delete("/sessions", requireAuth, ctrl.revokeAllSessions);

router.post(
  "/forgot-password",
  strictLimiter,
  validate(forgotPasswordSchema),
  ctrl.forgotPassword
);
router.post(
  "/reset-password",
  strictLimiter,
  validate(resetPasswordSchema),
  ctrl.resetPassword
);

router.get(
  "/supervisor/verify/:token",
  validate(verifyInviteSchema, "params"),
  ctrl.verifySupervisorInvite
);
router.post("/supervisor/verify-otp", ctrl.verifySupervisorOtp);
router.post("/supervisor/resend-otp", ctrl.supervisorResendInviteOtp);
router.post(
  "/supervisor/signup",
  strictLimiter,
  validate(supervisorSignupSchema),
  ctrl.supervisorSignup
);

// Employee (admin / project_manager / accountant) invite routes
router.get("/employee/verify/:token", ctrl.verifyEmployeeInvite);
router.post("/employee/verify-otp", ctrl.verifyEmployeeOtp);
router.post("/employee/resend-otp", strictLimiter, ctrl.employeeResendOtp);
router.post("/employee/signup", strictLimiter, ctrl.employeeSignup);

export default router;
