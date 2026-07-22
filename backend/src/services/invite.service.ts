import crypto from "crypto";
import { Types } from "mongoose";
import { InviteToken, IInviteToken, InviteRole } from "../models/InviteToken.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { compareToken, hashToken } from "../utils/password.js";
import { sendEmail } from "../config/email.js";
import {
  buildOtpEmail,
  buildSupervisorInviteEmail,
  buildEmployeeInviteEmail,
  buildCreateAccountEmail,
  buildResetPasswordEmail,
} from "./email-templates/index.js";

const QR_EXPIRY_MINUTES = 30;
const INVITE_EXPIRY_MINUTES = 30;
const OTP_LENGTH = 6;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateOtp(): string {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

function inviteWindowExpiresAt(invite: Pick<IInviteToken, "createdAt" | "expiresAt">): Date {
  const createdAt = new Date(invite.createdAt);
  const configuredExpiresAt = new Date(invite.expiresAt);
  const windowExpiresAt = new Date(createdAt.getTime() + INVITE_EXPIRY_MINUTES * 60 * 1000);
  return configuredExpiresAt.getTime() < windowExpiresAt.getTime()
    ? configuredExpiresAt
    : windowExpiresAt;
}

function inviteActiveCutoff(now = new Date()): Date {
  return new Date(now.getTime() - INVITE_EXPIRY_MINUTES * 60 * 1000);
}

export function getInviteRemainingMs(invite: Pick<IInviteToken, "createdAt" | "expiresAt">): number {
  return Math.max(0, inviteWindowExpiresAt(invite).getTime() - Date.now());
}

async function markStaleInvitesExpired(createdByAdmin: string, roleFilter: Record<string, unknown>): Promise<void> {
  const now = new Date();
  await InviteToken.updateMany(
    {
      createdByAdmin: new Types.ObjectId(createdByAdmin),
      status: "pending",
      ...roleFilter,
      $or: [
        { expiresAt: { $lte: now } },
        { createdAt: { $lt: inviteActiveCutoff(now) } },
      ],
    },
    { $set: { status: "expired" } }
  );
}

async function expireInviteIfNeeded(invite: IInviteToken): Promise<void> {
  if (inviteWindowExpiresAt(invite).getTime() > Date.now()) return;
  if (invite.status === "pending") {
    invite.status = "expired";
    await invite.save();
  }
  throw new AppError(410, "Invite token expired");
}

export interface CreateInviteParams {
  createdByAdmin: string;
  supervisorName: string;
  supervisorEmail: string;
  supervisorPhone: string;
  projectId?: string;
  siteIds?: string[];
  cashLimit?: number;
  address?: string;
  metadata?: Record<string, unknown>;
  expiryMinutes?: number;
  sendEmail?: boolean; // if true, send deep link email; if false, generate QR only
}

export interface CreateEmployeeInviteParams {
  createdByAdmin: string;
  name: string;
  email: string;
  phone?: string;
  role: InviteRole;
  projectIds?: string[];
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
  qrPayload: {
    token: string;
    supervisorName: string;
    supervisorPhone: string;
    supervisorEmail: string;
    siteIds: string[];
    projectId?: string;
    expiresAt: number;
  };
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
    cashLimit: params.cashLimit ?? 0,
    address: params.address || "",
  };

  const invite = await InviteToken.create({
    token,
    createdByAdmin: new Types.ObjectId(params.createdByAdmin),
    projectId: params.projectId ? new Types.ObjectId(params.projectId) : undefined,
    siteIds: (params.siteIds || []).map((id) => new Types.ObjectId(id)),
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

  let emailSent = false;
  if (params.sendEmail) {
    // Send deep link email instead of OTP email
    const separator = env.QR_BASE_URL.includes("?") ? "&" : "?";
    const deepLink = `${env.QR_BASE_URL}${separator}token=${encodeURIComponent(token)}`;
const webFallbackUrl = `${env.FRONTEND_URL.replace(/\/+$/, "")}/#/signup/employee?token=${encodeURIComponent(token)}`;

    const { subject, html, text } = buildSupervisorInviteEmail({
      name: params.supervisorName,
      deepLink,
      expiresMinutes: expiryMinutes,
      webFallbackUrl,
    });

    try {
      await sendEmail({
        to: params.supervisorEmail,
        subject,
        html,
        text,
      });
      emailSent = true;
    } catch (emailErr) {
      console.error("[InviteService] Failed to send supervisor invite email:", emailErr);
    }
  } else {
    // Send OTP email as before for QR flow
    const { subject, html, text } = buildOtpEmail({
      name: params.supervisorName,
      code: otp,
      purpose: "complete your supervisor account setup",
      expiresMinutes: expiryMinutes,
    });
    const emailBody = {
      to: params.supervisorEmail,
      subject,
      html,
      text,
    };
    try {
      await sendEmail(emailBody);
      emailSent = true;
    } catch (emailErr) {
      console.error("[InviteService] Failed to send OTP email (returning OTP for fallback):", emailErr);
    }
  }

  const separator = env.QR_BASE_URL.includes("?") ? "&" : "?";
  const qrUrl = `${env.QR_BASE_URL}${separator}token=${token}`;

  const qrPayload = {
    token,
    supervisorName: params.supervisorName,
    supervisorPhone: params.supervisorPhone,
    supervisorEmail: params.supervisorEmail,
    siteIds: params.siteIds || [],
    projectId: params.projectId,
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
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MINUTES * 60 * 1000);
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
      allocatedProjectIds: params.projectIds || [],
    },
    otpHash: "",
    otpExpiresAt,
  });

  const otpHash = await hashToken(otp);
  invite.otpHash = otpHash;
  await invite.save();

  const baseUrl = env.FRONTEND_URL.replace(/\/+$/, "");
  const inviteUrl = `${baseUrl}/#/signup/employee?token=${token}`;

  const { subject, html, text } = buildEmployeeInviteEmail({
    name: params.name,
    role: formatRole(params.role),
    setupUrl: inviteUrl,
  });

  let emailSent = false;
  try {
    await sendEmail({
      to: params.email.toLowerCase(),
      subject,
      html,
      text,
    });
    emailSent = true;
    console.log(`[InviteService] Employee invite email SENT successfully to ${params.email}`);
    console.log(`[InviteService] Invite URL: ${inviteUrl}`);
  } catch (err: any) {
    console.error("[InviteService] FAILED to send employee invite email:", err?.message || err);
    console.log(`[InviteService] Manual share URL: ${inviteUrl}`);
  }

  if (!emailSent) {
    console.warn(`[InviteService] Email was NOT sent. Admin should share link manually: ${inviteUrl}`);
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

export async function verifyInvite(token: string): Promise<IInviteToken> {
  const invite = await InviteToken.findOne({ token });
  if (!invite) throw new AppError(404, "Invite token not found");
  if (invite.usedAt) throw new AppError(410, "Invite token already used");
  await expireInviteIfNeeded(invite);
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
  if (invite.status === "accepted") throw new AppError(410, "Invite token already used");
  await expireInviteIfNeeded(invite);

  invite.status = "accepted";
  invite.usedAt = new Date();
  invite.usedBy = new Types.ObjectId(usedBy);
  await invite.save();
  return invite;
}

export async function revokeInvite(token: string): Promise<void> {
  await InviteToken.deleteOne({ token });
}

export async function listActiveInvites(createdByAdmin: string): Promise<Array<IInviteToken & { _id: Types.ObjectId }>> {
  await markStaleInvitesExpired(createdByAdmin, { role: "supervisor" });
  const now = new Date();
  return InviteToken.find({
    createdByAdmin: new Types.ObjectId(createdByAdmin),
    role: "supervisor",
    status: "pending",
    expiresAt: { $gt: now },
    createdAt: { $gte: inviteActiveCutoff(now) },
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec() as unknown as Promise<Array<IInviteToken & { _id: Types.ObjectId }>>;
}

export async function listActiveEmployeeInvites(createdByAdmin: string): Promise<Array<IInviteToken & { _id: Types.ObjectId }>> {
  await markStaleInvitesExpired(createdByAdmin, { role: { $in: ["admin", "project_manager", "accountant"] } });
  const now = new Date();
  return InviteToken.find({
    createdByAdmin: new Types.ObjectId(createdByAdmin),
    role: { $in: ["admin", "project_manager", "accountant"] },
    status: "pending",
    expiresAt: { $gt: now },
    createdAt: { $gte: inviteActiveCutoff(now) },
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec() as unknown as Promise<Array<IInviteToken & { _id: Types.ObjectId }>>;
}

export async function resendOtp(token: string): Promise<{ otp: string; emailSent: boolean }> {
  const invite = await InviteToken.findOne({ token });
  if (!invite) throw new AppError(404, "Invite token not found");
  if (invite.usedAt) throw new AppError(410, "Invite already used");
  await expireInviteIfNeeded(invite);

  const otp = generateOtp();
  const otpHash = await hashToken(otp);
  invite.otpHash = otpHash;
  invite.otpExpiresAt = invite.expiresAt;
  await invite.save();

  let emailSent = false;
  if (invite.supervisorEmail) {
    const name = extractSupervisorName(invite);
    const { subject, html, text } = buildOtpEmail({
      name,
      code: otp,
      purpose: "verify your supervisor account",
      expiresMinutes: Math.max(1, Math.floor((invite.otpExpiresAt.getTime() - Date.now()) / 60000)),
    });
    try {
      await sendEmail({
        to: invite.supervisorEmail,
        subject,
        html,
        text,
      });
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
 * QR_BASE_URL (default `agb-supervisor://invite`) and includes the
 * invite token. Also provides a web fallback URL.
 */
export async function sendSupervisorInviteEmail(
  token: string
): Promise<{ emailSent: boolean; recipient: string | null; deepLink: string }> {
  const invite = await InviteToken.findOne({ token });
  if (!invite) throw new AppError(404, "Invite token not found");
  if (invite.usedAt) throw new AppError(410, "Invite already used");
  await expireInviteIfNeeded(invite);
  if (invite.role !== "supervisor") {
    throw new AppError(400, "This invite is not a supervisor invite");
  }

  const recipient = invite.supervisorEmail;
  if (!recipient) {
    throw new AppError(400, "No email on file for this supervisor invite");
  }

  const separator = env.QR_BASE_URL.includes("?") ? "&" : "?";
  const deepLink = `${env.QR_BASE_URL}${separator}token=${encodeURIComponent(token)}`;

  // Web fallback URL for browsers that can't open the deep link
  const webFallbackUrl = `${env.FRONTEND_URL.replace(/\/+$/, "")}/#/signup/employee?token=${encodeURIComponent(token)}`;

  const name = extractSupervisorName(invite);
  const expiryMinutes = Math.max(
    1,
    Math.round((invite.expiresAt.getTime() - Date.now()) / 60000)
  );

  const { subject, html, text } = buildSupervisorInviteEmail({
    name,
    deepLink,
    expiresMinutes: expiryMinutes,
    webFallbackUrl,
  });

  let emailSent = false;
  try {
    await sendEmail({
      to: recipient,
      subject,
      html,
      text,
    });
    emailSent = true;
  } catch (err) {
    console.error("[InviteService] Failed to send supervisor invite email:", err);
  }

  return { emailSent, recipient, deepLink };
}


