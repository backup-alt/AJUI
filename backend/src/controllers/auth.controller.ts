import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import * as authService from "../services/auth.service.js";
import * as inviteService from "../services/invite.service.js";
import { getRefreshCookieName } from "../services/auth.service.js";
import { AccessSchedule } from "../models/AccessSchedule.js";
import { ActivityLog } from "../models/ActivityLog.js";
import {
  verifyInviteSchema,
  supervisorSignupSchema,
  changePasswordSchema,
} from "../schemas/auth.schema.js";
import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { hashPassword, verifyPassword, compareToken } from "../utils/password.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateQRDataURL } from "../utils/qr-code.js";
import { sendEmail } from "../config/email.js";
import { env } from "../config/env.js";
import { PasswordResetToken } from "../models/PasswordResetToken.js";
import { hashToken } from "../utils/password.js";
import crypto from "crypto";

async function checkAccessRestriction(userRole: string): Promise<{ isRestricted: boolean; currentWindow?: { startTime: string; endTime: string; reason: string } }> {
  try {
    const schedule = await AccessSchedule.findOne().lean();
    if (!schedule || !schedule.enabled) {
      return { isRestricted: false };
    }

    const now = new Date();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMinutes = (utcMinutes + 330) % (24 * 60);
    const dayOffset = Math.floor((utcMinutes + 330) / (24 * 60));
    const currentDayIndex = (now.getUTCDay() + dayOffset) % 7;
    const currentDay = dayNames[currentDayIndex];

    for (const window of schedule.windows) {
      if (!window.isActive) continue;
      if (!window.days.includes(currentDay)) continue;
      if (window.appliesTo.length > 0 && !window.appliesTo.includes(userRole)) continue;

      const [sh, sm] = window.startTime.split(":").map(Number);
      const [eh, em] = window.endTime.split(":").map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      let isWithin = false;
      if (startMinutes < endMinutes) {
        isWithin = istMinutes >= startMinutes && istMinutes < endMinutes;
      } else {
        isWithin = istMinutes >= startMinutes || istMinutes < endMinutes;
      }

      if (isWithin) {
        return {
          isRestricted: true,
          currentWindow: {
            startTime: window.startTime,
            endTime: window.endTime,
            reason: window.note || "Access restricted during scheduled window",
          },
        };
      }
    }

    return { isRestricted: false };
  } catch {
    return { isRestricted: false };
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, phone, email, password } = req.body as {
      identifier?: string;
      phone?: string;
      email?: string;
      password: string;
    };
    const loginId = identifier || phone || email;
    if (!loginId) throw new AppError(400, "Email or phone is required");
    const { result, refreshCookie } = await authService.loginUser(loginId, password, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    if (result.user.role !== "supervisor" && result.user.role !== "admin"
        && result.user.role !== "project_manager" && result.user.role !== "accountant") {
      const accessStatus = await checkAccessRestriction(result.user.role);
      if (accessStatus.isRestricted) {
        throw new AppError(403, `Access restricted until ${accessStatus.currentWindow?.endTime || "scheduled end"}. Contact admin if you need access.`);
      }
    }

    await ActivityLog.create({
      userId: result.user.id,
      userRole: result.user.role,
      action: "sign_in",
      description: "Email + password sign-in",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.cookie(getRefreshCookieName(), result.tokens.refreshToken, refreshCookie);

    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresAt: result.tokens.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cookieName = getRefreshCookieName();
    let refreshToken = req.cookies?.[cookieName];
    if (!refreshToken && req.body?.refreshToken) {
      refreshToken = req.body.refreshToken;
    }
    if (!refreshToken) throw new AppError(401, "No refresh token");

    const { tokens, refreshCookie } = await authService.refreshSession(refreshToken, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    res.cookie(cookieName, tokens.refreshToken, refreshCookie);
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cookieName = getRefreshCookieName();
    const refreshToken = req.cookies?.[cookieName];
    let userId: string | null = null;
    if (refreshToken) {
      try {
        const { verifyRefreshToken } = await import("../utils/jwt.js");
        const payload = verifyRefreshToken(refreshToken);
        userId = payload.sub;
      } catch {}
    }
    await authService.logout(refreshToken);

    if (userId) {
      await ActivityLog.create({
        userId: new Types.ObjectId(userId),
        action: "sign_out",
        description: "Signed out",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      }).catch(() => {});
    }

    res.clearCookie(cookieName, { path: "/api/auth" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");
    const { RefreshToken } = await import("../models/RefreshToken.js");
    const { User } = await import("../models/User.js");

    const user = await User.findById(req.user.sub).select("name").lean();
    const userName = user?.name || "Unknown";

    const sessions = await RefreshToken.find({
      userId: req.user.sub,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select("userAgent ip createdAt expiresAt")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      sessions: sessions.map((s, index) => ({
        id: s._id.toString(),
        device: s.userAgent || "Unknown",
        ip: s.ip || "Unknown",
        location: userName,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: index === 0,
        lastActiveAt: s.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");
    const { sessionId } = req.params;
    const { RefreshToken } = await import("../models/RefreshToken.js");
    const session = await RefreshToken.findOneAndUpdate(
      { _id: sessionId, userId: req.user.sub },
      { revokedAt: new Date() }
    );
    if (!session) throw new AppError(404, "Session not found");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function revokeAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");
    const { RefreshToken } = await import("../models/RefreshToken.js");
    await RefreshToken.updateMany(
      { userId: req.user.sub, revokedAt: null },
      { revokedAt: new Date() }
    );
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

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body).body;
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");

    const user = await User.findById(req.user.sub).select("+passwordHash");
    if (!user) throw new AppError(404, "User not found");

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) throw new AppError(400, "Current password is incorrect");

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as { email: string };
    const user = await User.findOne({ email: email.toLowerCase().trim() });
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

    // Use BACKEND_PUBLIC_URL or FRONTEND_URL; strip trailing slash
    const baseUrl = (process.env.BACKEND_PUBLIC_URL || process.env.FRONTEND_URL || "https://backup-alt.github.io/AJUI")
      .replace(/\/+$/, "");
    const resetUrl = `${baseUrl}/#/login?token=${rawToken}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your AGB password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <!-- Brand header -->
          <tr>
            <td style="background-color:#002263;padding:28px 32px;text-align:center;">
              <div style="display:inline-block;background:#c9a227;color:#2a230a;width:48px;height:48px;line-height:48px;border-radius:12px;font-weight:800;font-size:18px;letter-spacing:1px;">AGB</div>
              <h1 style="margin:14px 0 0;color:#ffffff;font-size:20px;font-weight:600;">Annai Golden Builders</h1>
              <p style="margin:4px 0 0;color:#9bb3e0;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;">Operations Workspace</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;color:#1d2939;font-size:22px;font-weight:700;">Reset your password</h2>
              <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">
                Hi <strong>${user.name}</strong>, we received a request to reset the password for your AGB account.
              </p>
              <p style="margin:0 0 24px;color:#475467;font-size:15px;line-height:1.6;">
                Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#002263;border-radius:8px;">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.02em;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#98a2b3;font-size:12px;line-height:1.5;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:8px 0 0;padding:12px;background-color:#f8fafc;border:1px solid #e6eaf2;border-radius:6px;word-break:break-all;font-size:12px;color:#475467;font-family:monospace;">
                ${resetUrl}
              </p>
              <hr style="border:none;border-top:1px solid #e6eaf2;margin:24px 0;">
              <p style="margin:0;color:#98a2b3;font-size:12px;line-height:1.5;">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e6eaf2;">
              <p style="margin:0;color:#98a2b3;font-size:11px;line-height:1.5;">
                © ${new Date().getFullYear()} Annai Golden Builders. All rights reserved.<br>
                <span style="color:#cfd8e6;">This is an automated security message.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `Hi ${user.name},

We received a request to reset the password for your AGB account.

Click the link below to set a new password. This link expires in 1 hour:

${resetUrl}

If you didn't request this password reset, you can safely ignore this email.

---
Annai Golden Builders
Operations Workspace`;

    await sendEmail({
      to: user.email,
      subject: "Reset your AGB password",
      html,
      text,
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
    let matched: (typeof tokens)[number] | undefined;
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
      requiresOtp: true,
      role: invite.role,
      projectId: invite.projectId,
      siteIds: (invite.siteIds || []).map((id) => id.toString()),
      supervisorName: inviteService.extractSupervisorName(invite),
      supervisorEmail: invite.supervisorEmail || "",
      supervisorPhone: invite.supervisorPhone || "",
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function supervisorSignup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = supervisorSignupSchema.parse({ body: req.body }).body;

    const invite = await inviteService.verifyInviteOtp(input.token, input.otp);

    // If the mobile app didn't supply an email/phone (e.g. it relied on
    // whatever the QR carried), pre-fill from the invite so the supervisor
    // can sign up even when the OTP email itself failed to send.
    const fallbackEmail = invite.supervisorEmail || "";
    const fallbackName = inviteService.extractSupervisorName(invite);
    const finalEmail = (input.email && input.email.length > 0) ? input.email : fallbackEmail;
    const finalName = (input.name && input.name.length > 0) ? input.name : fallbackName;
    const finalPhone = input.phone && input.phone.length > 0 ? input.phone : `+910000000000`;

    if (!finalEmail) {
      throw new AppError(400, "Email is required to complete signup");
    }

    const existing = await User.findOne({ $or: [{ email: finalEmail }, { phone: finalPhone }] });
    if (existing) throw new AppError(409, "User with this email or phone already exists");

    const passwordHash = await hashPassword(input.password);

    // Resolve assigned sites and primary project
    const siteIds: Types.ObjectId[] = (invite.siteIds || []).map((id) => id);
    const { Project } = await import("../models/Project.js");
    const { Site } = await import("../models/Site.js");
    const { generateId } = await import("../services/id-generator.service.js");
    const { Supervisor } = await import("../models/Supervisor.js");

    let managedProjectIds: Types.ObjectId[] = [];
    if (invite.projectId) managedProjectIds.push(invite.projectId);
    if (siteIds.length > 0) {
      const sites = await Site.find({ _id: { $in: siteIds } }).select("projectIds").lean();
      for (const s of sites) {
        for (const pid of s.projectIds || []) {
          if (!managedProjectIds.some((m) => m.toString() === pid.toString())) {
            managedProjectIds.push(pid);
          }
        }
      }
    }

    const user = await User.create({
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      passwordHash,
      role: "supervisor",
      status: "active",
      createdBy: invite.createdByAdmin,
      managedProjectIds,
    });

    // Create the Supervisor profile with multi-site assignment
    if (siteIds.length > 0 || managedProjectIds.length > 0) {
      const supervisorProfile = await Supervisor.create({
        supervisorId: await generateId("SUP"),
        userId: user._id,
        name: finalName,
        phone: finalPhone,
        email: finalEmail.toLowerCase(),
        address: (invite.metadata as any)?.address || undefined,
        role: "Site Supervisor",
        assignedProjectId: managedProjectIds[0] || undefined,
        assignedProjects: managedProjectIds,
        assignedProject: undefined,
        assignedSiteIds: siteIds,
        assignedSites: siteIds.map((id) => id.toString()),
        cashLimit: Number((invite.metadata as any)?.cashLimit || 0),
        approvalAuthority: 0,
        status: "Active",
      });
      user.supervisorProfileId = supervisorProfile._id;
      await user.save();
    }

    // Backfill site.supervisorId so the site is discoverable from the site side
    if (siteIds.length > 0) {
      await Site.updateMany(
        { _id: { $in: siteIds } },
        { $set: { supervisor: finalName, supervisorId: user.supervisorProfileId } }
      );
    }

    await inviteService.consumeInvite(input.token, user._id.toString());

    const tokens = await authService.issueTokens(user);
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
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
        supervisorProfileId: user.supervisorProfileId?.toString(),
        siteIds: siteIds.map((id) => id.toString()),
        projectIds: managedProjectIds.map((id) => id.toString()),
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

const adminCreateInviteSchema = z.object({
  supervisorName: z.string().trim().min(2, "Supervisor name is required").max(80),
  supervisorEmail: z.string().email("Valid email is required"),
  supervisorPhone: z.string().min(8, "Phone must be at least 8 characters").max(20),
  projectId: z.string().optional(),
  siteIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i, "Invalid site id")).min(1, "Select at least one site").optional(),
  cashLimit: z.coerce.number().nonnegative().optional(),
  address: z.string().trim().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function adminCreateInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = adminCreateInviteSchema.parse(req.body);
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");

    const { invite, qrUrl, qrPayload, expiresAt, otp, emailSent } = await inviteService.createInvite({
      createdByAdmin: req.user.sub,
      supervisorName: body.supervisorName,
      supervisorEmail: body.supervisorEmail,
      supervisorPhone: body.supervisorPhone,
      projectId: body.projectId,
      siteIds: body.siteIds,
      cashLimit: body.cashLimit,
      address: body.address,
      metadata: body.metadata,
      expiryMinutes: 5,
    });

    const qrDataUrl = await generateQRDataURL(JSON.stringify(qrPayload));

    res.status(201).json({
      inviteId: invite._id.toString(),
      token: invite.token,
      qrUrl,
      qrPayload,
      qrDataUrl,
      supervisorName: body.supervisorName,
      supervisorEmail: body.supervisorEmail,
      supervisorPhone: body.supervisorPhone,
      role: invite.role,
      projectId: invite.projectId,
      siteIds: body.siteIds || [],
      cashLimit: body.cashLimit || 0,
      address: body.address || "",
      expiresAt,
      createdAt: invite.createdAt,
      otp,
      emailSent,
    });
  } catch (err) {
    next(err);
  }
}

export async function listActiveInvites(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");
    const invites = await inviteService.listActiveInvites(req.user.sub);
    res.json({
      invites: invites.map((inv) => ({
        inviteId: inv._id.toString(),
        token: inv.token,
        supervisorName: inviteService.extractSupervisorName(inv),
        supervisorEmail: inv.supervisorEmail,
        supervisorPhone: inv.supervisorPhone,
        role: inv.role,
        projectId: inv.projectId,
        siteIds: (inv.siteIds || []).map((id) => id.toString()),
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        remainingMs: inviteService.getInviteRemainingMs(inv),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function listActiveEmployeeInvites(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");
    const invites = await inviteService.listActiveEmployeeInvites(req.user.sub);
    res.json({
      invites: invites.map((inv) => ({
        inviteId: inv._id.toString(),
        token: inv.token,
        name: inv.inviteeName || inviteService.extractInviteeName(inv),
        email: inv.inviteeEmail,
        phone: inv.inviteePhone,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        remainingMs: inviteService.getInviteRemainingMs(inv),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function resendInviteOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");
    const { otp, emailSent } = await inviteService.resendOtp(token);
    res.json({ success: true, message: "New OTP generated", otp, emailSent });
  } catch (err) {
    next(err);
  }
}

export async function verifySupervisorOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inviteToken, otp } = z
      .object({ inviteToken: z.string().min(1), otp: z.string().length(6) })
      .parse(req.body);
    await inviteService.verifyInviteOtp(inviteToken, otp);
    res.json({ valid: true });
  } catch (err) {
    next(err);
  }
}

export async function supervisorResendInviteOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inviteToken } = z
      .object({ inviteToken: z.string().min(1) })
      .parse(req.body);
    const { otp, emailSent } = await inviteService.resendOtp(inviteToken);
    res.json({ success: true, message: "New OTP generated", otp, emailSent });
  } catch (err) {
    next(err);
  }
}

// =================== EMPLOYEE INVITE FLOW (Admin / Project Manager / Accountant) ===================

const adminCreateEmployeeInviteSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().email("Valid email is required").transform((v) => v.toLowerCase()),
  phone: z.string().trim().min(8).max(20).optional(),
  role: z.enum(["admin", "project_manager", "accountant"]),
  projectIds: z
    .array(z.string().trim().min(1, "Invalid project id"))
    .min(1, "Select at least one project for this employee")
    .optional(),
});

async function resolveProjectObjectIds(projectIds: string[]): Promise<string[]> {
  const requestedIds = [...new Set(projectIds.map((id) => id.trim()).filter(Boolean))];
  if (requestedIds.length === 0) {
    throw new AppError(400, "Select at least one project for this employee");
  }

  const objectIds = requestedIds
    .filter((id) => /^[0-9a-fA-F]{24}$/.test(id))
    .map((id) => new Types.ObjectId(id));

  const humanReadableIds = requestedIds.filter((id) => !/^[0-9a-fA-F]{24}$/.test(id));

  const query: Record<string, unknown>[] = [];
  if (objectIds.length > 0) {
    query.push({ _id: { $in: objectIds } });
  }
  if (humanReadableIds.length > 0) {
    query.push({ projectId: { $in: humanReadableIds } });
  }

  if (query.length === 0) {
    throw new AppError(400, `Invalid project id format: ${requestedIds.join(", ")}`);
  }

  const projects = await Project.find({ $or: query }).select("_id projectId").lean();
  const foundIds = new Set<string>();
  const foundProjectIds = new Set<string>();
  for (const project of projects) {
    foundIds.add(project._id.toString());
    foundProjectIds.add(project.projectId);
  }

  const missingObjectIds = objectIds.filter((id) => !foundIds.has(id.toString())).map((id) => id.toString());
  const missingHumanReadable = humanReadableIds.filter((id) => !foundProjectIds.has(id));

  if (missingObjectIds.length > 0 || missingHumanReadable.length > 0) {
    const allMissing = [...missingObjectIds, ...missingHumanReadable];
    throw new AppError(400, `Project(s) not found: ${allMissing.join(", ")}. Please refresh the project list and try again.`);
  }

  return foundIds ? [...foundIds] : [];
}

function allocatedProjectObjectIds(invite: { metadata?: unknown }): Types.ObjectId[] {
  const meta = (invite.metadata as Record<string, unknown>) || {};
  const allocatedProjectIds = Array.isArray(meta.allocatedProjectIds)
    ? (meta.allocatedProjectIds as string[])
    : [];
  const ids = allocatedProjectIds
    .filter((id) => typeof id === "string" && Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (ids.length === 0) {
    throw new AppError(400, "This invite does not have any project access assigned");
  }

  return ids;
}

export async function adminCreateEmployeeInvite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = adminCreateEmployeeInviteSchema.parse(req.body);
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");

    const existingUser = await User.findOne({
      $or: [
        { email: body.email },
        ...(body.phone ? [{ phone: body.phone }] : []),
      ],
    });
    if (existingUser) {
      res.status(409).json({
        error: "A user with this email or phone already exists.",
        duplicate: true,
        field: existingUser.email === body.email ? "email" : "phone",
      });
      return;
    }

const projectIds = body.role === "admin" ? [] : await resolveProjectObjectIds(body.projectIds || []);
    const result = await inviteService.createEmployeeInvite({
      createdByAdmin: req.user.sub,
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      projectIds,
    });

    res.status(201).json({
      inviteId: result.invite._id.toString(),
      token: result.invite.token,
      inviteUrl: result.inviteUrl,
      supervisorName: result.recipientName,
      supervisorEmail: result.recipientEmail,
      role: result.invite.role,
      expiresAt: result.expiresAt,
      createdAt: result.invite.createdAt,
      emailSent: result.emailSent,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendSupervisorInviteEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    if (!req.user?.sub) throw new AppError(401, "Not authenticated");

    const result = await inviteService.sendSupervisorInviteEmail(token);
    res.json({
      success: true,
      emailSent: result.emailSent,
      recipient: result.recipient,
      deepLink: result.deepLink,
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmployeeInvite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
    const invite = await inviteService.verifyInvite(token);
    if (invite.role === "supervisor") {
      throw new AppError(400, "This invite is not an employee invite");
    }
    res.json({
      valid: true,
      role: invite.role,
      name: inviteService.extractInviteeName(invite),
      email: invite.inviteeEmail || "",
      phone: invite.inviteePhone || "",
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

const employeeSignupSchema = z.object({
  token: z.string().min(1),
  otp: z.string().length(6, "OTP must be 6 digits"),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(6).max(128),
});

export async function verifyEmployeeOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = z
      .object({
        token: z.string().min(1),
        otp: z.string().length(6, "OTP must be 6 digits"),
        password: z.string().min(6).max(128).optional(),
        name: z.string().trim().min(2).max(100).optional(),
        phone: z.string().trim().min(8).max(20).optional(),
      })
      .parse(req.body);
    const invite = await inviteService.verifyInvite(input.token);
    if (invite.role === "supervisor") {
      throw new AppError(400, "This invite is not an employee invite");
    }
    if (invite.usedAt) throw new AppError(410, "Invite already used");
    if (!invite.otpHash) throw new AppError(400, "No OTP associated with this invite");
    if (invite.otpExpiresAt && invite.otpExpiresAt < new Date()) {
      throw new AppError(410, "OTP has expired. Please request a new code.");
    }
    const valid = await compareToken(input.otp, invite.otpHash);
    if (!valid) throw new AppError(400, "Invalid OTP");

    // If password is provided, complete signup in this same call so the
    // single-page signup flow can finish in one round-trip.
    if (input.password) {
      const fallbackEmail = invite.inviteeEmail || "";
      const fallbackName = inviteService.extractInviteeName(invite);
      const finalEmail = fallbackEmail;
      const finalName = input.name && input.name.length > 0 ? input.name : fallbackName;
      const finalPhone =
        input.phone ||
        (invite.inviteePhone && invite.inviteePhone.length > 0
          ? invite.inviteePhone
          : `+910000000000`);

      if (!finalEmail) {
        throw new AppError(400, "Email is required to complete signup");
      }

      const existing = await User.findOne({
        $or: [{ email: finalEmail }, { phone: finalPhone }],
      });
      if (existing) throw new AppError(409, "User with this email or phone already exists");

      const passwordHash = await hashPassword(input.password);
const user = await User.create({
        name: finalName,
        email: finalEmail,
        phone: finalPhone,
        passwordHash,
        role: invite.role,
        status: "active",
        createdBy: invite.createdByAdmin,
        managedProjectIds: invite.role === "admin" ? [] : allocatedProjectObjectIds(invite),
      });

      await inviteService.consumeInvite(input.token, user._id.toString());

      const tokens = await authService.issueTokens(user);
      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: "none" as const,
        expires: tokens.expiresAt,
        path: "/api/auth",
      };

      res.cookie(getRefreshCookieName(), tokens.refreshToken, cookieOptions);
      res.json({
        success: true,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          managedProjectIds: (user.managedProjectIds || []).map((id: Types.ObjectId) => id.toString()),
        },
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        message: "Account created successfully",
      });
      return;
    }

    res.json({ valid: true, role: invite.role });
  } catch (err) {
    next(err);
  }
}

export async function employeeResendOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const invite = await inviteService.verifyInvite(token);
    if (invite.role === "supervisor") {
      throw new AppError(400, "This invite is not an employee invite");
    }

    const newOtp = crypto.randomInt(0, 10 ** 6).toString().padStart(6, "0");
    const otpHash = await hashToken(newOtp);
    invite.otpHash = otpHash;
    invite.otpExpiresAt = invite.expiresAt;
    await invite.save();

    let emailSent = false;
    if (invite.inviteeEmail) {
      const name = inviteService.extractInviteeName(invite);
      const baseUrl = env.FRONTEND_URL.replace(/\/+$/, "");
      const inviteUrl = `${baseUrl}/signup/employee?token=${encodeURIComponent(token)}`;
      const roleLabel =
        invite.role === "project_manager"
          ? "Project Manager"
          : invite.role === "admin"
          ? "Admin"
          : "Accountant";
      try {
        await sendEmail({
          to: invite.inviteeEmail,
          subject: `Your AGB ${roleLabel} setup code`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px">
            <div style="background:#002263;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
              <h2 style="margin:0;color:white">AGB ${roleLabel} Setup</h2>
            </div>
            <div style="padding:24px">
              <p style="font-size:16px">Hello <strong>${name}</strong>,</p>
              <p style="font-size:14px;color:#555">A new one-time code has been generated for your AGB account. Your code is:</p>
              <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:16px;text-align:center;margin:20px 0">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#002263">${newOtp}</span>
              </div>
              <p style="font-size:14px;color:#555;line-height:1.6">Open the setup page below, enter this code, and choose your password.</p>
              <p style="margin:20px 0">
                <a href="${inviteUrl}" target="_blank" style="display:inline-block;background:#002263;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Set Up My Account</a>
              </p>
              <p style="font-size:12px;color:#888;word-break:break-all">If the button does not work, copy this link: ${inviteUrl}</p>
              <p style="font-size:12px;color:#888">This code expires when your invite expires.</p>
            </div>
          </div>`,
          text: `Hi ${name},

You have been invited to join AGB as a ${roleLabel}.

Open this setup link, enter the code below, and choose your password:
${inviteUrl}

Your one-time code: ${newOtp}

This code expires when your invite expires.
`,
        });
        emailSent = true;
      } catch (err) {
        console.error("[Auth] Failed to resend employee OTP email:", err);
      }
    }

    const expiresIn = Math.max(
      0,
      Math.floor((invite.expiresAt.getTime() - Date.now()) / 1000)
    );
    res.json({ success: true, message: "New OTP generated", otp: newOtp, emailSent, expiresIn });
  } catch (err) {
    next(err);
  }
}

export async function employeeSignup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = employeeSignupSchema.parse(req.body);

    const invite = await inviteService.verifyInvite(input.token);
    if (invite.role === "supervisor") {
      throw new AppError(400, "This invite is not an employee invite");
    }

    if (invite.otpHash) {
      if (invite.otpExpiresAt && invite.otpExpiresAt < new Date()) {
        throw new AppError(410, "OTP has expired. Please request a new code.");
      }
      const valid = await compareToken(input.otp, invite.otpHash);
      if (!valid) throw new AppError(400, "Invalid OTP");
    }

    const fallbackEmail = invite.inviteeEmail || "";
    const fallbackName = inviteService.extractInviteeName(invite);
    const finalEmail = fallbackEmail;
    const finalName = input.name && input.name.length > 0 ? input.name : fallbackName;
    const finalPhone = input.phone;

    if (!finalEmail) {
      throw new AppError(400, "Email is required to complete signup");
    }

    const existing = await User.findOne({ $or: [{ email: finalEmail }, { phone: finalPhone }] });
    if (existing) throw new AppError(409, "User with this email or phone already exists");

    const passwordHash = await hashPassword(input.password);
    const user = await User.create({
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      passwordHash,
      role: invite.role,
      status: "active",
      createdBy: invite.createdByAdmin,
      managedProjectIds: allocatedProjectObjectIds(invite),
    });

    await inviteService.consumeInvite(input.token, user._id.toString());

    const tokens = await authService.issueTokens(user);
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      expires: tokens.expiresAt,
      path: "/api/auth",
    };

    res.status(201).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        managedProjectIds: (user.managedProjectIds || []).map((id) => id.toString()),
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

// =================== SUPERVISOR OTP LOGIN ===================
export async function requestSupervisorLoginOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { identifier } = z
      .object({ identifier: z.string().trim().min(3) })
      .parse(req.body);

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
    });
    if (!user) throw new AppError(404, "No supervisor account found with this email or phone");
    if (user.role !== "supervisor") {
      throw new AppError(403, "Only supervisor accounts can use OTP login");
    }

    const otp = crypto.randomInt(0, 10 ** 6).toString().padStart(6, "0");
    const otpHash = await hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.loginOtpHash = otpHash;
    user.loginOtpExpiresAt = expiresAt;
    await user.save();

    if (user.email) {
      const { buildOtpEmail } = await import("../services/email-templates/index.js");
      const { subject, html } = buildOtpEmail({
        name: user.name,
        code: otp,
        purpose: "sign in to your AGB supervisor account",
        expiresMinutes: 10,
      });
      await sendEmail({ to: user.email, subject, html }).catch(() => {});
    }

    res.json({ success: true, message: "OTP sent to registered email" });
  } catch (err) {
    next(err);
  }
}

export async function verifySupervisorLoginOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { identifier, otp } = z
      .object({
        identifier: z.string().trim().min(3),
        otp: z.string().length(6),
      })
      .parse(req.body);

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
    });
    if (!user) throw new AppError(404, "No supervisor account found with this email or phone");
    if (user.role !== "supervisor") {
      throw new AppError(403, "Only supervisor accounts can use OTP login");
    }
    if (!user.loginOtpHash || !user.loginOtpExpiresAt) {
      throw new AppError(400, "No active OTP. Please request a new one.");
    }
    if (user.loginOtpExpiresAt < new Date()) {
      throw new AppError(410, "OTP has expired. Please request a new one.");
    }

    const valid = await compareToken(otp, user.loginOtpHash);
    if (!valid) throw new AppError(400, "Invalid OTP");

    user.loginOtpHash = undefined;
    user.loginOtpExpiresAt = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    await ActivityLog.create({
      userId: user._id,
      action: "sign_in",
      description: "Signed in via OTP",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const tokens = await authService.issueTokens(user);
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      expires: tokens.expiresAt,
      path: "/api/auth",
    };
    res.cookie(getRefreshCookieName(), tokens.refreshToken, cookieOptions);

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        supervisorProfileId: user.supervisorProfileId?.toString(),
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}
