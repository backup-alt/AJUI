import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service.js";
import * as inviteService from "../services/invite.service.js";
import { getRefreshCookieName } from "../services/auth.service.js";
import { verifyInviteSchema, supervisorSignupSchema } from "../schemas/auth.schema.js";
import { User } from "../models/User.js";
import { hashPassword, compareToken } from "../utils/password.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateQRDataURL } from "../utils/qr-code.js";
import { sendEmail } from "../config/sendgrid.js";
import { PasswordResetToken } from "../models/PasswordResetToken.js";
import { hashToken } from "../utils/password.js";
import crypto from "crypto";

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, password } = req.body as { phone: string; password: string };
    const { result, refreshCookie } = await authService.loginUser(phone, password, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    res.cookie(getRefreshCookieName(), result.tokens.refreshToken, refreshCookie);

    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresAt: result.tokens.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cookieName = getRefreshCookieName();
    const refreshToken = req.cookies?.[cookieName];
    if (!refreshToken) throw new AppError(401, "No refresh token");

    const { tokens, refreshCookie } = await authService.refreshSession(refreshToken, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    res.cookie(cookieName, tokens.refreshToken, refreshCookie);
    res.json({ accessToken: tokens.accessToken, expiresAt: tokens.expiresAt });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cookieName = getRefreshCookieName();
    const refreshToken = req.cookies?.[cookieName];
    await authService.logout(refreshToken);
    res.clearCookie(cookieName, { path: "/api/auth" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");
    const user = await authService.getUserById(req.user.sub);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as { email: string };
    const user = await User.findOne({ email });
    if (!user) {
      res.json({ success: true, message: "If the email exists, a reset link has been sent" });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:4200"}/reset-password?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your Annai Builders password",
      html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password (expires in 1 hour):</p><a href="${resetUrl}">${resetUrl}</a>`,
    });

    res.json({ success: true, message: "If the email exists, a reset link has been sent" });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password } = req.body as { token: string; password: string };

    const tokens = await PasswordResetToken.find({ usedAt: { $exists: false } });
    let matched: typeof tokens[number] | undefined;
    for (const t of tokens) {
      const ok = await compareToken(token, t.tokenHash);
      if (ok && t.expiresAt > new Date()) {
        matched = t;
        break;
      }
    }

    if (!matched) throw new AppError(400, "Invalid or expired reset token");

    const user = await User.findById(matched.userId);
    if (!user) throw new AppError(404, "User not found");

    user.passwordHash = await hashPassword(password);
    await user.save();

    matched.usedAt = new Date();
    await matched.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    next(err);
  }
}

export async function verifySupervisorInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = verifyInviteSchema.parse({ params: req.params }).params;
    const invite = await inviteService.verifyInvite(token);
    await invite.populate("projectId");
    res.json({
      valid: true,
      role: invite.role,
      projectId: invite.projectId,
      supervisorName: inviteService.extractSupervisorName(invite),
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function supervisorSignup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = supervisorSignupSchema.parse({ body: req.body }).body;

    const invite = await inviteService.verifyInvite(input.token);
    await invite.populate("projectId");

    const existing = await User.findOne({ $or: [{ email: input.email }, { phone: input.phone }] });
    if (existing) throw new AppError(409, "User with this email or phone already exists");

    const passwordHash = await hashPassword(input.password);
    const user = await User.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: "supervisor",
      status: "active",
      createdBy: invite.createdByAdmin,
      managedProjectIds: invite.projectId ? [invite.projectId] : [],
    });

    await inviteService.consumeInvite(input.token, user._id.toString());

    const tokens = await authService.issueTokens(user);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      expires: tokens.expiresAt,
      path: "/api/auth",
    };

    res.cookie(getRefreshCookieName(), tokens.refreshToken, cookieOptions);
    res.status(201).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

const adminCreateInviteSchema = z.object({
  supervisorName: z.string().trim().min(2, "Supervisor name is required").max(80),
  projectId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  expiryHours: z.number().min(1).max(168).optional(),
});

export async function adminCreateInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = adminCreateInviteSchema.parse(req.body);
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");

    const { invite, qrUrl, qrPayload, expiresAt } = await inviteService.createInvite({
      createdByAdmin: req.user.sub,
      supervisorName: body.supervisorName,
      projectId: body.projectId,
      metadata: body.metadata,
      expiryHours: body.expiryHours,
    });

    // QR encodes the structured JSON payload (token + supervisorName + expiry)
    // so the mobile app can extract all info from a single scan.
    const qrDataUrl = await generateQRDataURL(JSON.stringify(qrPayload));

    res.status(201).json({
      inviteId: invite._id.toString(),
      token: invite.token,
      qrUrl,
      qrPayload,
      qrDataUrl,
      supervisorName: body.supervisorName,
      role: invite.role,
      projectId: invite.projectId,
      expiresAt,
      createdAt: invite.createdAt,
    });
  } catch (err) {
    next(err);
  }
}
