import sgMail from "@sendgrid/mail";
import { env } from "./env.js";

let initialized = false;

export function initSendGrid(): void {
  if (!env.SENDGRID_API_KEY || env.SENDGRID_API_KEY.startsWith("SG.placeholder")) {
    console.warn("[SendGrid] API key not set - email sending will be mocked");
    initialized = false;
    return;
  }
  sgMail.setApiKey(env.SENDGRID_API_KEY);
  initialized = true;
  console.log("[SendGrid] Initialized");
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  if (!initialized) {
    console.log(`[SendGrid:Mock] To: ${to} | Subject: ${subject}`);
    return;
  }

  await sgMail.send({
    to,
    from: env.SENDGRID_FROM_EMAIL,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ""),
  });
}
