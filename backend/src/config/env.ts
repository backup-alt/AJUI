import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform((val) => parseInt(val, 10)).default("4000"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_ACCESS_EXPIRY: z.string().default("4h"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),


  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),

  GMAIL_USER: z.string().email().default("antigravity20263.0.3.0@gmail.com"),
  GMAIL_APP_PASSWORD: z.string().min(16, "GMAIL_APP_PASSWORD must be at least 16 chars").optional(),

  FRONTEND_URL: z.string().url().default("http://localhost:4200"),
  MOBILE_APP_URL: z.string().default("*"),
  QR_BASE_URL: z.string().default("agb-supervisor://invite"),
  BACKEND_PUBLIC_URL: z.string().url().optional(),

  PCLOUD_BEARER_TOKEN: z.string().optional(),
  PCLOUD_FOLDER_ID: z.string().optional(),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[ENV] Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";

/**
 * Resolve the backend base URL for email links.
 *
 * Email links that point to backend-served HTML pages (e.g. /reset-password.html,
 * /signup.html) MUST use the backend's public URL — not the frontend URL.
 *
 * Priority:
 *   1. Request origin (most reliable — works regardless of env misconfiguration)
 *   2. BACKEND_PUBLIC_URL env var (if request is unavailable, e.g. background jobs)
 *   3. FRONTEND_URL as last resort (may be wrong if misconfigured, but better than nothing)
 *
 * Use this whenever building links that should open on the backend-served pages.
 */
export function resolveBackendBaseUrl(req?: { protocol?: string; get?: (h: string) => string | undefined }): string {
  if (req && req.protocol && req.get) {
    const host = req.get("host");
    if (host) {
      const proto = req.protocol;
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  }
  if (env.BACKEND_PUBLIC_URL) {
    return env.BACKEND_PUBLIC_URL.replace(/\/+$/, "");
  }
  return env.FRONTEND_URL.replace(/\/+$/, "");
}
