import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import * as authService from "../services/auth.service.js";
import * as inviteService from "../services/invite.service.js";
import { getRefreshCookieName } from "../services/auth.service.js";
import {
  verifyInviteSchema,
  supervisorSignupSchema,
} from "../schemas/auth.schema.js";
import { User } from "../models/User.js";
import { hashPassword, compareToken } from "../utils/password.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateQRDataURL } from "../utils/qr-code.js";
import { sendEmail } from "../config/email.js";
import { PasswordResetToken } from "../models/PasswordResetToken.js";
import { hashToken } from "../utils/password.js";
import crypto from "crypto";

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, phone, email, password } = req.body as {
      identifier?: string;
      phone?: string;
      email?: string;
      password: string;
    };
    // Support both old {phone} and new {identifier/email} payloads
    const loginId = identifier || phone || email;
    if (!loginId) throw new AppError(400, "Email or phone is required");
    const { result, refreshCookie } = await authService.loginUser(loginId, password, {
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
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

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
    await invite.populate("projectId");

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
    const user = await User.create({
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
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
  supervisorEmail: z.string().email("Valid email is required"),
  supervisorPhone: z.string().min(8, "Phone must be at least 8 characters").max(20),
  projectId: z.string().optional(),
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
        role: inv.role,
        projectId: inv.projectId,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        remainingMs: Math.max(0, inv.expiresAt.getTime() - Date.now()),
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
        remainingMs: Math.max(0, inv.expiresAt.getTime() - Date.now()),
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
  projectIds: z.array(z.string()).optional(),
});

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

    const result = await inviteService.createEmployeeInvite({
      createdByAdmin: req.user.sub,
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      projectIds: body.projectIds,
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
      const meta = (invite.metadata as Record<string, unknown>) || {};
      const allocatedProjectIds: string[] = Array.isArray(meta.allocatedProjectIds)
        ? (meta.allocatedProjectIds as string[])
        : [];
      const user = await User.create({
        name: finalName,
        email: finalEmail,
        phone: finalPhone,
        passwordHash,
        role: invite.role,
        status: "active",
        createdBy: invite.createdByAdmin,
        managedProjectIds: allocatedProjectIds.map((id) => new Types.ObjectId(id)),
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
              <p style="font-size:12px;color:#888">This code expires when your invite expires.</p>
            </div>
          </div>`,
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
    const meta = (invite.metadata as Record<string, unknown>) || {};
    const allocatedProjectIds: string[] = Array.isArray(meta.allocatedProjectIds)
      ? (meta.allocatedProjectIds as string[])
      : [];
    const user = await User.create({
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      passwordHash,
      role: invite.role,
      status: "active",
      createdBy: invite.createdByAdmin,
      managedProjectIds: allocatedProjectIds.map((id) => new Types.ObjectId(id)),
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
      expiresAt: tokens.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}
