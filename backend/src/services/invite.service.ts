import crypto from "crypto";
import { Types } from "mongoose";
import { InviteToken, IInviteToken } from "../models/InviteToken";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";

const DEFAULT_EXPIRY_HOURS = 24;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export interface CreateInviteParams {
  createdByAdmin: string;
  supervisorName: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  expiryHours?: number;
}

export async function createInvite(params: CreateInviteParams): Promise<{
  invite: IInviteToken;
  qrUrl: string;
  qrPayload: { token: string; supervisorName: string; expiresAt: number };
  expiresAt: Date;
}> {
  const token = generateToken();
  const expiryHours = params.expiryHours ?? DEFAULT_EXPIRY_HOURS;
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

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
  });

  // QR URL is kept for backward compatibility; in production we encode the
  // structured payload (token + supervisorName + expiry) directly so the mobile
  // scanner doesn't need to hit the URL — it parses JSON in one step.
  const separator = env.QR_BASE_URL.includes("?") ? "&" : "?";
  const qrUrl = `${env.QR_BASE_URL}${separator}token=${token}`;

  const qrPayload = {
    token,
    supervisorName: params.supervisorName,
    expiresAt: expiresAt.getTime(),
  };

  return { invite, qrUrl, qrPayload, expiresAt };
}

export async function verifyInvite(token: string): Promise<IInviteToken> {
  const invite = await InviteToken.findOne({ token });
  if (!invite) throw new AppError(404, "Invite token not found");
  if (invite.usedAt) throw new AppError(410, "Invite token already used");
  if (invite.expiresAt < new Date()) throw new AppError(410, "Invite token expired");
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
