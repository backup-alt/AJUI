import { Resend } from "resend";
import { env } from "./env.js";

let client: Resend | null = null;
let initialized = false;
let mockMode = false;
let fromAddress = "AGB <onboarding@resend.dev>";

export function initEmail(): void {
  if (!env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set - email sending will be mocked");
    initialized = false;
    mockMode = true;
    return;
  }

  client = new Resend(env.RESEND_API_KEY);
  initialized = true;
  mockMode = false;

  if (env.RESEND_FROM_EMAIL) {
    fromAddress = env.RESEND_FROM_EMAIL;
  }
  console.log(`[Email] Resend client initialized (from: ${fromAddress})`);
}

export function isEmailMocked(): boolean {
  return mockMode;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Email send timeout after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export async function verifyEmailConnection(): Promise<boolean> {
  if (!client) return false;
  try {
    // Resend doesn't have a verify endpoint; just confirm the client exists
    // and the API key is set. A real send will surface auth errors.
    console.log("[Email] Resend client ready");
    return true;
  } catch (err: any) {
    console.error("[Email] Resend client check failed:", err?.message || err);
    return false;
  }
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  if (!initialized) {
    console.log(`[Email:Mock] To: ${to} | Subject: ${subject}`);
    return;
  }

  if (!client) {
    throw new Error("Email client not initialized");
  }

  try {
    const result = await withTimeout(
      client.emails.send({
        from: fromAddress,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ""),
      }),
      15000
    );
    if (result.error) {
      console.error("[Email] Resend API error:", result.error);
      throw new Error(result.error.message || "Resend API error");
    }
    console.log(`[Email] Sent to ${to} (id: ${result.data?.id})`);
  } catch (err: any) {
    console.error("[Email] Send failed:", err?.message || err);
    throw err;
  }
}
