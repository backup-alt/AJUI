import nodemailer from "nodemailer";
import { env } from "./env.js";

let transporter: nodemailer.Transporter | null = null;
let initialized = false;
let mockMode = false;

export function initEmail(): void {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    console.warn("[Email] Gmail credentials not set - email sending will be mocked");
    initialized = false;
    mockMode = true;
    return;
  }

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });

  initialized = true;
  mockMode = false;
  console.log("[Email] Gmail SMTP transport initialized (port 587, STARTTLS)");
}

export async function verifyEmailConnection(): Promise<boolean> {
  if (!transporter) return false;
  try {
    await transporter.verify();
    console.log("[Email] SMTP connection verified successfully");
    return true;
  } catch (err: any) {
    console.error("[Email] SMTP connection verification failed:", err?.message || err);
    return false;
  }
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

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  if (!initialized) {
    console.log(`[Email:Mock] To: ${to} | subject } | Subject: ${ subject }`);
    return;
  }

  if (!transporter) {
    throw new Error("Email transport not initialized");
  }

  try {
    const result = await withTimeout(
      transporter.sendMail({
        from: env.GMAIL_USER,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ""),
      }),
      15000
    );
    console.log(`[Email] Sent to ${to} (messageId: ${result.messageId})`);
  } catch (err: any) {
    const status = err?.responseCode || err?.statusCode;
    if (status === 535 || status === 401) {
      console.error("[Email] Authentication failed - check GMAIL_APP_PASSWORD (must be an App Password, not regular password)");
    } else if (status === 550 || status === 421) {
      console.error("[Email] Sender rejected - verify the From address is correct");
    } else if (status === 429) {
      console.error("[Email] Rate limit hit - Gmail free tier is 500/day");
    }
    throw err;
  }
}