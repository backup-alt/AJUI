import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(userId: string, role: string): string {
  const payload: AccessTokenPayload = { sub: userId, role };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as SignOptions);
}

export function signRefreshToken(userId: string, jti: string): string {
  const payload: RefreshTokenPayload = { sub: userId, jti };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export function refreshTokenExpiryDate(): Date {
  const days = parseInt(env.JWT_REFRESH_EXPIRY.replace("d", ""), 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
