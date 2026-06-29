import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as ctrl from "../controllers/auth.controller";
import { validate } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyInviteSchema,
  supervisorSignupSchema,
} from "../schemas/auth.schema";

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
router.post(
  "/supervisor/signup",
  strictLimiter,
  validate(supervisorSignupSchema),
  ctrl.supervisorSignup
);

export default router;
