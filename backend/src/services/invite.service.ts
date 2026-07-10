import crypto from "crypto";
import { Types } from "mongoose";
import { InviteToken, IInviteToken, InviteRole } from "../models/InviteToken.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { compareToken, hashToken } from "../utils/password.js";
import { sendEmail } from "../config/email.js";

const QR_EXPIRY_MINUTES = 5;
const INVITE_EXPIRY_HOURS = 48;
const OTP_LENGTH = 6;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateOtp(): string {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

export interface CreateInviteParams {
  createdByAdmin: string;
  supervisorName: string;
  supervisorEmail: string;
  supervisorPhone: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  expiryMinutes?: number;
}

export interface CreateEmployeeInviteParams {
  createdByAdmin: string;
  name: string;
  email: string;
  phone?: string;
  role: InviteRole;
}

export interface CreateEmployeeInviteResult {
  invite: IInviteToken;
  inviteUrl: string;
  expiresAt: Date;
  emailSent: boolean;
  recipientEmail: string;
  recipientName: string;
}

export async function createInvite(params: CreateInviteParams): Promise<{
  invite: IInviteToken;
  qrUrl: string;
  qrPayload: { token: string; supervisorName: string; expiresAt: number };
  expiresAt: Date;
  otpExpiresAt: Date;
  otp: string;
  emailSent: boolean;
}> {
  const token = generateToken();
  const otp = generateOtp();
  const expiryMinutes = params.expiryMinutes ?? QR_EXPIRY_MINUTES;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  const otpExpiresAt = expiresAt;

  const metadata = {
    ...(params.metadata || {}),
    supervisorName: params.supervisorName,
  };

  const invite = await InviteToken.create({
    token,
    createdByAdmin: new Types.ObjectId(params.createdByAdmin),
    projectId: params.projectId ? new Types.ObjectId(params.projectId) : undefined,
    role: "supervisor",
    expiresAt,
    metadata,
    supervisorEmail: params.supervisorEmail,
    supervisorPhone: params.supervisorPhone,
    otpHash: "",
    otpExpiresAt,
  });

  const otpHash = await hashToken(otp);
  invite.otpHash = otpHash;
  await invite.save();

  const emailBody = {
    to: params.supervisorEmail,
    subject: "Your AGB Supervisor activation code",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px">
        <div style="background:#002263;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;color:white">AGB Supervisor Invitation</h2>
        </div>
        <div style="padding:24px">
          <p style="font-size:16px">Hello <strong>${params.supervisorName}</strong>,</p>
          <p style="font-size:14px;color:#555">You have been invited to join AGB (Annai Golden Builders) as a supervisor. Your one-time activation code is:</p>
          <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:16px;text-align:center;margin:20px 0">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#002263">${otp}</span>
          </div>
          <p style="font-size:12px;color:#888">This code expires in <strong>${expiryMinutes} minutes</strong>. Open the AGB app, tap "Scan QR", and enter this code to complete your setup.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p style="font-size:12px;color:#aaa;text-align:center">AGB (Annai Golden Builders) — Internal Use Only</p>
        </div>
      </div>
    `,
    text: `Hello ${params.supervisorName},\n\nYou have been invited to join AGB (Annai Golden Builders) as a supervisor.\n\nYour activation code: ${otp}\n\nThis code expires in ${expiryMinutes} minutes. Open the AGB app, tap "Scan QR", and enter this code to complete your setup.\n\n---\nAGB (Annai Golden Builders) — Internal Use Only`,
  };
  let emailSent = false;
  try {
    await sendEmail(emailBody);
    emailSent = true;
  } catch (emailErr) {
    console.error("[InviteService] Failed to send OTP email (returning OTP for fallback):", emailErr);
  }

  const separator = env.QR_BASE_URL.includes("?") ? "&" : "?";
  const qrUrl = `${env.QR_BASE_URL}${separator}token=${token}`;

  const qrPayload = {
    token,
    supervisorName: params.supervisorName,
    supervisorPhone: params.supervisorPhone,
    expiresAt: expiresAt.getTime(),
  };

  return { invite, qrUrl, qrPayload, expiresAt, otpExpiresAt, otp, emailSent };
}

export async function createEmployeeInvite(
  params: CreateEmployeeInviteParams
): Promise<CreateEmployeeInviteResult> {
  if (!["admin", "project_manager", "accountant"].includes(params.role)) {
    throw new AppError(400, "Invalid role for employee invite");
  }

  const token = generateToken();
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
  const otpExpiresAt = expiresAt;

  const invite = await InviteToken.create({
    token,
    createdByAdmin: new Types.ObjectId(params.createdByAdmin),
    role: params.role,
    expiresAt,
    inviteeName: params.name,
    inviteeEmail: params.email.toLowerCase(),
    inviteePhone: params.phone,
    metadata: {
      inviteeName: params.name,
    },
    otpHash: "",
    otpExpiresAt,
  });

  const otpHash = await hashToken(otp);
  invite.otpHash = otpHash;
  await invite.save();

  const baseUrl = (env.BACKEND_PUBLIC_URL || env.FRONTEND_URL).replace(/\/+$/, "");
  const inviteUrl = `${baseUrl}/signup/employee?token=${token}`;

  const html = buildEmployeeInviteEmail({
    name: params.name,
    role: params.role,
    inviteUrl,
    otp,
    expiresHours: INVITE_EXPIRY_HOURS,
  });
  const text = buildEmployeeInviteEmailText({
    name: params.name,
    role: params.role,
    inviteUrl,
    otp,
    expiresHours: INVITE_EXPIRY_HOURS,
  });

  let emailSent = false;
  try {
    await sendEmail({
      to: params.email.toLowerCase(),
      subject: `You're invited to join AGB as ${formatRole(params.role)}`,
      html,
      text,
    });
    emailSent = true;
  } catch (err) {
    console.error("[InviteService] Failed to send employee invite email:", err);
  }

  return {
    invite,
    inviteUrl,
    expiresAt,
    emailSent,
    recipientEmail: params.email.toLowerCase(),
    recipientName: params.name,
  };
}

function formatRole(role: InviteRole): string {
  switch (role) {
    case "project_manager":
      return "Project Manager";
    case "admin":
      return "Admin";
    case "accountant":
      return "Accountant";
    case "supervisor":
      return "Supervisor";
    default:
      return role;
  }
}

function buildEmployeeInviteEmail(params: {
  name: string;
  role: InviteRole;
  inviteUrl: string;
  otp: string;
  expiresHours: number;
}): string {
  const roleLabel = formatRole(params.role);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to AGB</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color:#002263;padding:28px 32px;text-align:center;">
              <div style="display:inline-block;background:#c9a227;color:#2a230a;width:48px;height:48px;line-height:48px;border-radius:12px;font-weight:800;font-size:18px;letter-spacing:1px;">AGB</div>
              <h1 style="margin:14px 0 0;color:#ffffff;font-size:20px;font-weight:600;">Annai Golden Builders</h1>
              <p style="margin:4px 0 0;color:#9bb3e0;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;">Operations Workspace</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;color:#1d2939;font-size:22px;font-weight:700;">You've been invited</h2>
              <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">
                Hi <strong>${params.name}</strong>, you have been invited to join AGB (Annai Golden Builders) as a <strong>${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 12px;color:#475467;font-size:15px;line-height:1.6;">
                Your one-time verification code is:
              </p>
              <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:16px;text-align:center;margin:0 0 20px 0">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#002263">${params.otp}</span>
              </div>
              <p style="margin:0 0 24px;color:#475467;font-size:15px;line-height:1.6;">
                Click the button below to open the setup page, enter this code, and choose a password. This link expires in <strong>${params.expiresHours} hours</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#002263;border-radius:8px;">
                    <a href="${params.inviteUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.02em;">Set Up My Account</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#98a2b3;font-size:12px;line-height:1.5;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:8px 0 0;padding:12px;background-color:#f8fafc;border:1px solid #e6eaf2;border-radius:6px;word-break:break-all;font-size:12px;color:#475467;font-family:monospace;">
                ${params.inviteUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e6eaf2;">
              <p style="margin:0;color:#98a2b3;font-size:11px;line-height:1.5;">
                © ${new Date().getFullYear()} Annai Golden Builders. All rights reserved.<br>
                <span style="color:#cfd8e6;">This is an automated invitation message.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmployeeInviteEmailText(params: {
  name: string;
  role: InviteRole;
  inviteUrl: string;
  otp: string;
  expiresHours: number;
}): string {
  return `Hi ${params.name},

You have been invited to join AGB (Annai Golden Builders) as a ${formatRole(params.role)}.

Your one-time verification code: ${params.otp}

Click the link below to open the setup page, enter this code, and choose a password. This link expires in ${params.expiresHours} hours:

${params.inviteUrl}

If you didn't expect this invitation, you can safely ignore this email.

---
Annai Golden Builders
Operations Workspace`;
}

export async function verifyInvite(token: string): Promise<IInviteToken> {
  const invite = await InviteToken.findOne({ token });
  if (!invite) throw new AppError(404, "Invite token not found");
  if (invite.usedAt) throw new AppError(410, "Invite token already used");
  if (invite.expiresAt < new Date()) throw new AppError(410, "Invite token expired");
  return invite;
}

export async function verifyInviteOtp(token: string, otp: string): Promise<IInviteToken> {
  const invite = await verifyInvite(token);
  if (!invite.otpHash) throw new AppError(400, "No OTP associated with this invite");
  if (invite.otpExpiresAt && invite.otpExpiresAt < new Date()) {
    throw new AppError(410, "OTP has expired. Please request a new QR code.");
  }
  const valid = await compareToken(otp, invite.otpHash);
  if (!valid) throw new AppError(400, "Invalid OTP");
  return invite;
}

export function extractSupervisorName(invite: IInviteToken): string {
  const meta = invite.metadata as Record<string, unknown> | undefined;
  const name = meta?.supervisorName;
  if (typeof name === "string" && name.trim().length > 0) return name.trim();
  return "Supervisor";
}

export function extractInviteeName(invite: IInviteToken): string {
  if (invite.inviteeName && invite.inviteeName.trim().length > 0) {
    return invite.inviteeName.trim();
  }
  return extractSupervisorName(invite);
}

export async function consumeInvite(token: string, usedBy: string): Promise<IInviteToken> {
  const invite = await InviteToken.findOne({ token });
  if (!invite) throw new AppError(404, "Invite token not found");
  if (invite.usedAt) throw new AppError(410, "Invite token already used");
  if (invite.expiresAt < new Date()) throw new AppError(410, "Invite token expired");

  invite.usedAt = new Date();
  invite.usedBy = new Types.ObjectId(usedBy);
  await invite.save();
  return invite;
}

export async function revokeInvite(token: string): Promise<void> {
  await InviteToken.deleteOne({ token });
}

export async function listActiveInvites(createdByAdmin: string): Promise<Array<IInviteToken & { _id: Types.ObjectId }>> {
  return InviteToken.find({
    createdByAdmin: new Types.ObjectId(createdByAdmin),
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec() as unknown as Promise<Array<IInviteToken & { _id: Types.ObjectId }>>;
}

export async function resendOtp(token: string): Promise<{ otp: string; emailSent: boolean }> {
  const invite = await InviteToken.findOne({ token });
  if (!invite) throw new AppError(404, "Invite token not found");
  if (invite.usedAt) throw new AppError(410, "Invite already used");
  if (invite.expiresAt < new Date()) throw new AppError(410, "Invite expired");

  const otp = generateOtp();
  const otpHash = await hashToken(otp);
  invite.otpHash = otpHash;
  invite.otpExpiresAt = invite.expiresAt;
  await invite.save();

  let emailSent = false;
  if (invite.supervisorEmail) {
    const name = extractSupervisorName(invite);
    const emailBody = {
      to: invite.supervisorEmail,
      subject: "Your AGB Supervisor Invite — New OTP Code",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px">
          <div style="background:#002263;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0;color:white">AGB Supervisor Invite — New OTP</h2>
          </div>
          <div style="padding:24px">
            <p style="font-size:16px">Hello <strong>${name}</strong>,</p>
            <p style="font-size:14px;color:#555">A new OTP has been generated for your AGB supervisor account. Your code is:</p>
            <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:16px;text-align:center;margin:20px 0">
              <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#002263">${otp}</span>
            </div>
            <p style="font-size:12px;color:#888">This code expires when the QR code expires.</p>
          </div>
        </div>
      `,
    };
    try {
      await sendEmail(emailBody);
      emailSent = true;
    } catch (emailErr) {
      console.error("[InviteService] Failed to resend OTP email (returning OTP for fallback):", emailErr);
    }
  }

  return { otp, emailSent };
}

/**
 * Sends a deep link via email to a supervisor so they can open the mobile
 * app and complete the OTP/QR flow. The link uses the configured
 * QR_BASE_URL (default `ajui://supervisor/signup`) and includes the
 * invite token plus the OTP so the mobile app can pre-fill it.
 */
export async function sendSupervisorInviteEmail(
  token: string
): Promise<{ emailSent: boolean; recipient: string | null; deepLink: string }> {
  const invite = await InviteToken.findOne({ token });
  if (!invite) throw new AppError(404, "Invite token not found");
  if (invite.usedAt) throw new AppError(410, "Invite already used");
  if (invite.expiresAt < new Date()) throw new AppError(410, "Invite expired");
  if (invite.role !== "supervisor") {
    throw new AppError(400, "This invite is not a supervisor invite");
  }

  const recipient = invite.supervisorEmail;
  if (!recipient) {
    throw new AppError(400, "No email on file for this supervisor invite");
  }

  const separator = env.QR_BASE_URL.includes("?") ? "&" : "?";
  const deepLink = `${env.QR_BASE_URL}${separator}token=${encodeURIComponent(token)}`;

  const name = extractSupervisorName(invite);
  const expiryMinutes = Math.max(
    1,
    Math.round((invite.expiresAt.getTime() - Date.now()) / 60000)
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AGB Supervisor Activation Link</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color:#002263;padding:28px 32px;text-align:center;">
              <div style="display:inline-block;background:#c9a227;color:#2a230a;width:48px;height:48px;line-height:48px;border-radius:12px;font-weight:800;font-size:18px;letter-spacing:1px;">AGB</div>
              <h1 style="margin:14px 0 0;color:#ffffff;font-size:20px;font-weight:600;">Annai Golden Builders</h1>
              <p style="margin:4px 0 0;color:#9bb3e0;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;">Supervisor Activation</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;color:#1d2939;font-size:22px;font-weight:700;">Activate your supervisor account</h2>
              <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">
                Hi <strong>${name}</strong>, tap the button below on your phone to open the AGB supervisor app and complete your activation. The link expires in <strong>${expiryMinutes} minutes</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#002263;border-radius:8px;">
                    <a href="${deepLink}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.02em;">Open AGB App &amp; Activate</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#98a2b3;font-size:12px;line-height:1.5;">
                If the button doesn't open the app, copy and paste this link into your phone's browser:
              </p>
              <p style="margin:8px 0 0;padding:12px;background-color:#f8fafc;border:1px solid #e6eaf2;border-radius:6px;word-break:break-all;font-size:12px;color:#475467;font-family:monospace;">
                ${deepLink}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e6eaf2;">
              <p style="margin:0;color:#98a2b3;font-size:11px;line-height:1.5;">
                © ${new Date().getFullYear()} Annai Golden Builders. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${name},

You have been invited to join AGB (Annai Golden Builders) as a supervisor.

Tap the link below on your phone to open the AGB supervisor app and complete activation. The link expires in ${expiryMinutes} minutes:

${deepLink}

If the link doesn't open the app, paste it into your phone's browser.

---
Annai Golden Builders
Operations Workspace`;

  let emailSent = false;
  try {
    await sendEmail({
      to: recipient,
      subject: "Activate your AGB Supervisor account",
      html,
      text,
    });
    emailSent = true;
  } catch (err) {
    console.error("[InviteService] Failed to send supervisor invite email:", err);
  }

  return { emailSent, recipient, deepLink };
}
