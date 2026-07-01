import crypto from "crypto";
import { User, IUser } from "../models/User.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { hashPassword, verifyPassword, hashToken, compareToken } from "../utils/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshTokenExpiryDate,
} from "../utils/jwt.js";
import { AppError } from "../middleware/errorHandler.js";
import { env, isProduction } from "../config/env.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    status: string;
  };
  tokens: AuthTokens;
}

function generateTokenId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function buildRefreshCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    expires: expiresAt,
    path: "/api/auth",
  };
}

export async function loginUser(
  phone: string,
  password: string,
  meta: { userAgent?: string; ip?: string } = {}
): Promise<{ result: AuthResult; refreshCookie: ReturnType<typeof buildRefreshCookieOptions> }> {
  const user = await User.findOne({ phone });
  if (!user) throw new AppError(401, "Invalid phone or password");
  if (user.status !== "active") throw new AppError(403, "Account is not active");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AppError(401, "Invalid phone or password");

  const tokens = await issueTokens(user, meta);
  user.lastLoginAt = new Date();
  await user.save();

  const result: AuthResult = {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
    tokens,
  };

  return { result, refreshCookie: buildRefreshCookieOptions(tokens.expiresAt) };
}

export async function issueTokens(
  user: IUser,
  meta: { userAgent?: string; ip?: string } = {}
): Promise<AuthTokens> {
  const jti = generateTokenId();
  const accessToken = signAccessToken(user._id.toString(), user.role);
  const refreshToken = signRefreshToken(user._id.toString(), jti);
  const expiresAt = refreshTokenExpiryDate();

  const tokenHash = await hashToken(refreshToken);

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  return { accessToken, refreshToken, expiresAt };
}

export async function refreshSession(
  refreshToken: string,
  meta: { userAgent?: string; ip?: string } = {}
): Promise<{ tokens: AuthTokens; refreshCookie: ReturnType<typeof buildRefreshCookieOptions> }> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid refresh token");
  }

  const stored = await RefreshToken.findOne({ userId: payload.sub });
  const match = stored ? await compareToken(refreshToken, stored.tokenHash) : false;
  if (!stored || !match || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AppError(401, "Refresh token revoked or expired");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "active") throw new AppError(403, "User not active");

  stored.revokedAt = new Date();
  await stored.save();

  const tokens = await issueTokens(user, meta);
  return { tokens, refreshCookie: buildRefreshCookieOptions(tokens.expiresAt) };
}

export async function logout(refreshToken?: string): Promise<void> {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    const stored = await RefreshToken.findOne({ userId: payload.sub });
    if (stored) {
      stored.revokedAt = new Date();
      await stored.save();
    }
  } catch {
    // ignore - token already invalid
  }
}

export async function getUserById(id: string) {
  const user = await User.findById(id);
  if (!user) throw new AppError(404, "User not found");
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  createdBy?: string;
}): Promise<IUser> {
  const existing = await User.findOne({ $or: [{ email: input.email }, { phone: input.phone }] });
  if (existing) throw new AppError(409, "User with this email or phone already exists");

  const passwordHash = await hashPassword(input.password);
  return User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
    role: input.role,
    status: "active",
    createdBy: input.createdBy,
  });
}

export function getRefreshCookieName(): string {
  return `${isProduction ? "__Secure-" : ""}ajui_refresh`;
}
