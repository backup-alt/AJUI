import crypto from "crypto";
import { Types } from "mongoose";
import { InviteToken, IInviteToken } from "../models/InviteToken.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { compareToken } from "../utils/password.js";
import { sendEmail } from "../config/email.js";

const QR_EXPIRY_MINUTES = 5;
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
    otpHash: "", // will update after hashing
    otpExpiresAt,
  });

  // Hash and save OTP
  const { hashToken } = await import("../utils/password.js");
  const otpHash = await hashToken(otp);
  invite.otpHash = otpHash;
  await invite.save();

  // Send OTP email to supervisor. This is fire-and-forget so the request
  // that created the invite returns the QR code immediately.
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
  // Kick off delivery in the background. We don't await it.
  let emailSent = false;
  sendEmail(emailBody)
    .then(() => { /* delivered */ })
    .catch((emailErr) => {
      console.error("[InviteService] Failed to send OTP email (non-blocking):", emailErr);
    });

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
  const { hashToken } = await import("../utils/password.js");
  const otpHash = await hashToken(otp);
  invite.otpHash = otpHash;
  invite.otpExpiresAt = invite.expiresAt;
  await invite.save();

  // Fire-and-forget email so the API returns instantly. `emailSent` is
  // set to false on the response so the caller can show the OTP on
  // screen if the SMTP call eventually fails.
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
    sendEmail(emailBody)
      .then(() => { /* delivered */ })
      .catch((emailErr) => {
        console.error("[InviteService] Failed to resend OTP email (non-blocking):", emailErr);
      });
  }

  return { otp, emailSent };
}