/**
 * Centralized AGB email templates.
 *
 * Design system:
 *  - Brand navy: #002263 (header, primary CTA)
 *  - Brand gold: #c9a227 (logo chip accent)
 *  - Body text:  #475467
 *  - Muted text: #98a2b3
 *  - Surface:    #ffffff on #f4f6f8 background
 *  - Max width:  560px
 *  - Radius:     12px on the card, 8px on CTAs, 6px on code chips
 *  - Font:       system font stack
 */

const SHELL_HTML = (body: string): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color:#002263;padding:28px 32px;text-align:center;">
              <img src="https://backup-alt.github.io/AJUI/assets/logo.png" alt="Annai Golden Builders" style="width:96px;height:auto;border-radius:12px;display:block;margin:0 auto;">
              <h1 style="margin:14px 0 0;color:#ffffff;font-size:20px;font-weight:600;">Annai Golden Builders</h1>
              <p style="margin:4px 0 0;color:#9bb3e0;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;">Operations Workspace</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e6eaf2;">
              <p style="margin:0;color:#98a2b3;font-size:11px;line-height:1.5;">
                © ${new Date().getFullYear()} Annai Golden Builders. All rights reserved.<br>
                <span style="color:#cfd8e6;">This is an automated message — please do not reply.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const PRIMARY_BUTTON = (label: string, href: string): string => `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:#002263;border-radius:8px;">
        <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.02em;">${label}</a>
      </td>
    </tr>
  </table>`;

const FALLBACK_LINK = (label: string, href: string): string => `
  <p style="margin:0 0 8px;color:#98a2b3;font-size:12px;line-height:1.6;word-break:break-all;">
    ${label}<br>
    <a href="${href}" style="color:#002263;text-decoration:underline;">${href}</a>
  </p>`;

// =============================================================
// 1. OTP EMAIL
// =============================================================

export interface OtpEmailInput {
  name: string;
  code: string;
  purpose: string;
  expiresMinutes: number;
}

export function buildOtpEmail(input: OtpEmailInput): { subject: string; html: string; text: string } {
  const subject = `Your AGB verification code`;
  const body = `
    <h2 style="margin:0 0 12px;color:#1d2939;font-size:22px;font-weight:700;">Verification code</h2>
    <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">
      Hi <strong>${input.name}</strong>, use the code below to ${input.purpose}.
    </p>
    <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:20px;text-align:center;margin:0 0 20px 0">
      <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#002263">${input.code}</span>
    </div>
    <p style="margin:0;color:#98a2b3;font-size:13px;line-height:1.5;">
      This code expires in <strong>${input.expiresMinutes} minutes</strong>. If you did not request this code, please ignore this email.
    </p>`;
  const html = SHELL_HTML(body);
  const text = `Hi ${input.name},

Your AGB verification code is: ${input.code}

Use this code to ${input.purpose}. It expires in ${input.expiresMinutes} minutes.

If you did not request this code, please ignore this email.

---
Annai Golden Builders`;
  return { subject, html, text };
}

// =============================================================
// 2. CREATE ACCOUNT EMAIL
// =============================================================

export interface CreateAccountEmailInput {
  name: string;
  setupUrl: string;
  ctaLabel?: string;
}

export function buildCreateAccountEmail(input: CreateAccountEmailInput): { subject: string; html: string; text: string } {
  const subject = `Create your AGB account`;
  const label = input.ctaLabel || "Create Account";
  const body = `
    <h2 style="margin:0 0 12px;color:#1d2939;font-size:22px;font-weight:700;">Welcome to AGB</h2>
    <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">
      Hi <strong>${input.name}</strong>, your AGB account is ready. Tap the button below to set up your password and finish your account.
    </p>
    ${PRIMARY_BUTTON(label, input.setupUrl)}
    ${FALLBACK_LINK("If the button doesn't work, copy and paste this link into your browser:", input.setupUrl)}`;
  const html = SHELL_HTML(body);
  const text = `Hi ${input.name},

Your AGB account is ready. Open the link below to set up your password and finish your account.

${input.setupUrl}

---
Annai Golden Builders`;
  return { subject, html, text };
}

// =============================================================
// 3. RESET PASSWORD EMAIL
// =============================================================

export interface ResetPasswordEmailInput {
  name: string;
  resetUrl: string;
  expiresMinutes?: number;
  webFallbackUrl?: string;
}

export function buildResetPasswordEmail(input: ResetPasswordEmailInput): { subject: string; html: string; text: string } {
  const subject = `Reset your AGB password`;
  const expiry = input.expiresMinutes ?? 60;
  const webUrl = input.webFallbackUrl || input.resetUrl;
  const body = `
    <h2 style="margin:0 0 12px;color:#1d2939;font-size:22px;font-weight:700;">Reset your password</h2>
    <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">
      Hi <strong>${input.name}</strong>, we received a request to reset your AGB password. Tap the button below to choose a new password.
    </p>
    ${PRIMARY_BUTTON("Reset Password", webUrl)}
    <p style="margin:0 0 8px;color:#98a2b3;font-size:13px;line-height:1.5;">
      This link expires in <strong>${expiry} minutes</strong>.
    </p>
    ${FALLBACK_LINK("If the button doesn't work, copy and paste this link into your browser:", webUrl)}
    `;
  const html = SHELL_HTML(body);
  const text = `Hi ${input.name},

We received a request to reset your AGB password. Use the link below to choose a new password. This link expires in ${expiry} minutes.

${webUrl}

If you did not request a password reset, please ignore this email.

---
Annai Golden Builders
Operations Workspace`;
  return { subject, html, text };
}

// =============================================================
// 4. EMPLOYEE INVITATION EMAIL
// =============================================================

export interface EmployeeInviteEmailInput {
  name: string;
  role: string;
  setupUrl: string;
}

export function buildEmployeeInviteEmail(input: EmployeeInviteEmailInput): { subject: string; html: string; text: string } {
  const subject = `You're invited to join AGB`;
  const body = `
    <h2 style="margin:0 0 12px;color:#1d2939;font-size:22px;font-weight:700;">You're invited</h2>
    <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">
      Hi <strong>${input.name}</strong>, you have been invited to join AGB (Annai Golden Builders) as a <strong>${input.role}</strong>.
    </p>
    <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">
      Tap the button below to set up your password and activate your account.
    </p>
    ${PRIMARY_BUTTON("Create Account", input.setupUrl)}
    ${FALLBACK_LINK("If the button doesn't work, copy and paste this link into your browser:", input.setupUrl)}`;
  const html = SHELL_HTML(body);
  const text = `Hi ${input.name},

You have been invited to join AGB (Annai Golden Builders) as a ${input.role}.

Open the link below to set up your password and activate your account:

${input.setupUrl}

---
Annai Golden Builders`;
  return { subject, html, text };
}

// =============================================================
// 5. SUPERVISOR INVITE (deep link to mobile app)
// =============================================================

export interface SupervisorInviteEmailInput {
  name: string;
  deepLink: string;
  expiresMinutes: number;
  webFallbackUrl?: string;
}

export function buildSupervisorInviteEmail(input: SupervisorInviteEmailInput): { subject: string; html: string; text: string } {
  const subject = `Activate your AGB Supervisor account`;
  const webUrl = input.webFallbackUrl || input.deepLink;
  const body = `
    <h2 style="margin:0 0 12px;color:#1d2939;font-size:22px;font-weight:700;">Activate your supervisor account</h2>
    <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">
      Hi <strong>${input.name}</strong>, you have been added to AGB (Annai Golden Builders) as a Site Supervisor. Tap the button below to open the AGB Supervisor app and finish your account setup.
    </p>
    ${PRIMARY_BUTTON("Open AGB App & Activate", webUrl)}
    <p style="margin:0 0 8px;color:#98a2b3;font-size:13px;line-height:1.5;">
      This link expires in <strong>${input.expiresMinutes} minutes</strong>.
    </p>
    ${FALLBACK_LINK("If the button doesn't open the app, copy and paste this link into your phone browser:", webUrl)}
    ${FALLBACK_LINK("Or open this link on your phone to open the AGB Supervisor app directly:", input.deepLink)}`;
  const html = SHELL_HTML(body);
  const text = `Hi ${input.name},

You have been added to AGB (Annai Golden Builders) as a Site Supervisor. Use the link below to finish account setup. This link expires in ${input.expiresMinutes} minutes.

Web link (open on any browser):
${webUrl}

Mobile app link (open on your phone to open the AGB Supervisor app):
${input.deepLink}

---
Annai Golden Builders
Operations Workspace`;
  return { subject, html, text };
}
