import { env } from "./env.js";

export const RESET_PASSWORD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Annai Golden Builders</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
      background:
        radial-gradient(circle at 50% 20%, rgba(0, 34, 99, 0.12), transparent 36%),
        linear-gradient(180deg, #f6f8fb 0%, #eaf0f8 100%);
    }
    .auth-card {
      display: grid;
      gap: 22px;
      width: min(480px, 100%);
      padding: 30px;
      border: 1px solid rgba(203, 213, 225, 0.9);
      border-radius: 18px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.96)),
        #ffffff;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.14);
    }
    .auth-brand {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 18px;
      border-bottom: 1px solid #e2e8f0;
    }
    .auth-brand img {
      width: 72px;
      height: 72px;
      border-radius: 14px;
      object-fit: cover;
      box-shadow: 0 14px 30px rgba(0, 34, 99, 0.16);
    }
    .auth-brand span,
    .auth-copy span {
      display: block;
      color: #002263;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .auth-brand strong {
      display: block;
      margin-top: 4px;
      color: #101828;
      font-size: 18px;
      font-weight: 900;
    }
    .auth-copy h1 {
      margin: 8px 0;
      color: #0f172a;
      font-size: 30px;
      line-height: 1.08;
    }
    .auth-copy p {
      margin: 0;
      color: #667085;
      font-size: 14px;
      line-height: 1.5;
    }
    .login-success {
      margin: 0;
      padding: 12px 14px;
      background: #ecfdf5;
      border: 1px solid #a7e6c1;
      border-radius: 8px;
      color: #0d6b3f;
      font-size: 13px;
      line-height: 1.5;
    }
    .login-error {
      margin: 0;
      padding: 12px 14px;
      background: #fef0f0;
      border: 1px solid #f5c6c6;
      border-radius: 8px;
      color: #b03030;
      font-size: 13px;
      line-height: 1.5;
    }
    .login-loading {
      margin: 0;
      padding: 12px 14px;
      background: #eef3ff;
      border: 1px solid #b8c5e8;
      border-radius: 8px;
      color: #2c5cff;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #b8c5e8;
      border-top-color: #2c5cff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-form { display: flex; flex-direction: column; gap: 14px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field span {
      font-size: 12px;
      font-weight: 600;
      color: #475467;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .form-field input {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid #d5dcea;
      border-radius: 10px;
      background: #ffffff;
      font-size: 15px;
      color: #1d2939;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .form-field input:focus {
      outline: none;
      border-color: #2c5cff;
      box-shadow: 0 0 0 3px rgba(44, 92, 255, 0.12);
    }
    .password-row {
      position: relative;
      display: flex;
      align-items: center;
    }
    .password-row input { padding-right: 56px; }
    .eye-btn {
      position: absolute;
      right: 8px;
      background: none;
      border: none;
      color: #2c5cff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 6px;
    }
    .eye-btn:hover { background: #eef3ff; }
    .auth-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 46px;
      border: 1px solid #002263;
      border-radius: 10px;
      background: #002263;
      color: #ffffff;
      font-size: 14px;
      font-weight: 900;
      cursor: pointer;
      font-family: inherit;
      box-shadow: 0 16px 30px rgba(0, 34, 99, 0.2);
    }
    .auth-primary:hover { background: #001a4d; }
    .auth-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .footer-note {
      text-align: center;
      font-size: 12px;
      color: #98a2b3;
      line-height: 1.5;
    }
    .footer-note a { color: #2c5cff; text-decoration: none; font-weight: 600; }
    .footer-note a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <section class="auth-card">
    <div class="auth-brand">
      <img src="/assets/logo.jpg" alt="Annai Golden Builders" />
      <div>
        <span>Annai Golden Builders</span>
        <strong>Operations Workspace</strong>
      </div>
    </div>

    <div class="auth-copy" id="copy-reset">
      <span>Set new password</span>
      <h1>Create a new password</h1>
      <p>Choose a strong password (at least 8 characters) to regain access to your account.</p>
    </div>

    <div id="form-view">
      <form class="auth-form" id="reset-form">
        <label class="form-field">
          <span>New password</span>
          <div class="password-row">
            <input type="password" id="password" placeholder="At least 8 characters" autocomplete="new-password" required />
            <button type="button" class="eye-btn" onclick="togglePw('password', this)" aria-label="Toggle password visibility">Show</button>
          </div>
        </label>

        <label class="form-field">
          <span>Confirm new password</span>
          <div class="password-row">
            <input type="password" id="confirm" placeholder="Re-enter your new password" autocomplete="new-password" required />
            <button type="button" class="eye-btn" onclick="togglePw('confirm', this)" aria-label="Toggle password visibility">Show</button>
          </div>
        </label>

        <button type="submit" class="auth-primary" id="submit-btn">Update password</button>
      </form>
    </div>

    <div id="success-view" style="display:none">
      <div class="login-success"><strong>Password updated successfully</strong></div>
      <p style="margin-top:12px;color:#475467;font-size:14px;line-height:1.5;">You can now log in with your new password in the AGB app.</p>
    </div>

    <div id="error-view" style="display:none">
      <div class="login-error" id="error-msg"></div>
    </div>

    <div id="loading-view" class="login-loading" style="display:none">
      <span class="spinner"></span>
      <span>Updating your password...</span>
    </div>

    <p class="footer-note">
      Need help? Contact your administrator at
      <a href="mailto:admin@annaigoldenbuilders.online">admin@annaigoldenbuilders.online</a>
    </p>
  </section>

  <script>
    var API = window.location.origin + '/api';
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token');

    function togglePw(id, btn) {
      var el = document.getElementById(id);
      if (el.type === 'password') { el.type = 'text'; btn.textContent = 'Hide'; }
      else { el.type = 'password'; btn.textContent = 'Show'; }
    }

    function showError(m) {
      document.getElementById('form-view').style.display = 'none';
      document.getElementById('loading-view').style.display = 'none';
      document.getElementById('success-view').style.display = 'none';
      document.getElementById('error-view').style.display = 'block';
      document.getElementById('error-msg').textContent = m;
    }

    function showLoading() {
      document.getElementById('form-view').style.display = 'none';
      document.getElementById('error-view').style.display = 'none';
      document.getElementById('loading-view').style.display = 'flex';
    }

    function showSuccess() {
      document.getElementById('loading-view').style.display = 'none';
      document.getElementById('form-view').style.display = 'none';
      document.getElementById('success-view').style.display = 'block';
      document.getElementById('copy-reset').style.display = 'none';
    }

    if (!token) {
      showError('Invalid or missing reset link. Please request a new one from the app.');
    }

    document.getElementById('reset-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var pw = document.getElementById('password').value;
      var cf = document.getElementById('confirm').value;
      if (!pw || pw.length < 8) {
        var inline = document.createElement('div');
        inline.className = 'login-error';
        inline.textContent = 'Password must be at least 8 characters.';
        var formView = document.getElementById('form-view');
        var existing = formView.querySelector('.login-error');
        if (existing) existing.remove();
        formView.insertBefore(inline, formView.firstChild);
        return;
      }
      if (pw !== cf) {
        var inline2 = document.createElement('div');
        inline2.className = 'login-error';
        inline2.textContent = 'Passwords do not match.';
        var formView2 = document.getElementById('form-view');
        var existing2 = formView2.querySelector('.login-error');
        if (existing2) existing2.remove();
        formView2.insertBefore(inline2, formView2.firstChild);
        return;
      }

      showLoading();
      try {
        var r = await fetch(API + '/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, password: pw })
        });
        var d = await r.json();
        if (r.ok && d.success) {
          showSuccess();
        } else {
          var inline3 = document.createElement('div');
          inline3.className = 'login-error';
          inline3.textContent = (d.error || d.message || 'Reset failed. The link may have expired.');
          document.getElementById('form-view').style.display = 'block';
          document.getElementById('loading-view').style.display = 'none';
          var formView3 = document.getElementById('form-view');
          var existing3 = formView3.querySelector('.login-error');
          if (existing3) existing3.remove();
          formView3.insertBefore(inline3, formView3.firstChild);
        }
      } catch (err) {
        document.getElementById('form-view').style.display = 'block';
        document.getElementById('loading-view').style.display = 'none';
        var inline4 = document.createElement('div');
        inline4.className = 'login-error';
        inline4.textContent = 'Network error. Please try again.';
        var formView4 = document.getElementById('form-view');
        var existing4 = formView4.querySelector('.login-error');
        if (existing4) existing4.remove();
        formView4.insertBefore(inline4, formView4.firstChild);
      }
    });
  </script>
</body>
</html>`;

export const SIGNUP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Signup - Annai Golden Builders</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
      background:
        radial-gradient(circle at 50% 20%, rgba(0, 34, 99, 0.12), transparent 36%),
        linear-gradient(180deg, #f6f8fb 0%, #eaf0f8 100%);
    }
    .auth-card {
      display: grid;
      gap: 22px;
      width: min(480px, 100%);
      padding: 30px;
      border: 1px solid rgba(203, 213, 225, 0.9);
      border-radius: 18px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.96)),
        #ffffff;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.14);
    }
    .auth-brand {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 18px;
      border-bottom: 1px solid #e2e8f0;
    }
    .auth-brand img {
      width: 72px;
      height: 72px;
      border-radius: 14px;
      object-fit: cover;
      box-shadow: 0 14px 30px rgba(0, 34, 99, 0.16);
    }
    .auth-brand span,
    .auth-copy span {
      display: block;
      color: #002263;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .auth-brand strong {
      display: block;
      margin-top: 4px;
      color: #101828;
      font-size: 18px;
      font-weight: 900;
    }
    .auth-copy h1 {
      margin: 8px 0;
      color: #0f172a;
      font-size: 30px;
      line-height: 1.08;
    }
    .auth-copy p {
      margin: 0;
      color: #667085;
      font-size: 14px;
      line-height: 1.5;
    }
    .login-success {
      margin: 0;
      padding: 12px 14px;
      background: #ecfdf5;
      border: 1px solid #a7e6c1;
      border-radius: 8px;
      color: #0d6b3f;
      font-size: 13px;
      line-height: 1.5;
    }
    .login-error {
      margin: 0;
      padding: 12px 14px;
      background: #fef0f0;
      border: 1px solid #f5c6c6;
      border-radius: 8px;
      color: #b03030;
      font-size: 13px;
      line-height: 1.5;
    }
    .login-info {
      margin: 0;
      padding: 12px 14px;
      background: #eef3ff;
      border: 1px solid #b8c5e8;
      border-radius: 8px;
      color: #2c5cff;
      font-size: 13px;
      line-height: 1.5;
    }
    .login-loading {
      margin: 0;
      padding: 12px 14px;
      background: #eef3ff;
      border: 1px solid #b8c5e8;
      border-radius: 8px;
      color: #2c5cff;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #b8c5e8;
      border-top-color: #2c5cff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-form { display: flex; flex-direction: column; gap: 14px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field span {
      font-size: 12px;
      font-weight: 600;
      color: #475467;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .form-field input {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid #d5dcea;
      border-radius: 10px;
      background: #ffffff;
      font-size: 15px;
      color: #1d2939;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .form-field input:focus {
      outline: none;
      border-color: #2c5cff;
      box-shadow: 0 0 0 3px rgba(44, 92, 255, 0.12);
    }
    .form-field input:read-only {
      background: #f8fbff;
      color: #475467;
    }
    .password-row {
      position: relative;
      display: flex;
      align-items: center;
    }
    .password-row input { padding-right: 56px; }
    .eye-btn {
      position: absolute;
      right: 8px;
      background: none;
      border: none;
      color: #2c5cff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 6px;
    }
    .eye-btn:hover { background: #eef3ff; }
    .auth-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 46px;
      border: 1px solid #002263;
      border-radius: 10px;
      background: #002263;
      color: #ffffff;
      font-size: 14px;
      font-weight: 900;
      cursor: pointer;
      font-family: inherit;
      box-shadow: 0 16px 30px rgba(0, 34, 99, 0.2);
    }
    .auth-primary:hover { background: #001a4d; }
    .auth-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .footer-note {
      text-align: center;
      font-size: 12px;
      color: #98a2b3;
      line-height: 1.5;
    }
    .footer-note a { color: #2c5cff; text-decoration: none; font-weight: 600; }
    .footer-note a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <section class="auth-card">
    <div class="auth-brand">
      <img src="/assets/logo.jpg" alt="Annai Golden Builders" />
      <div>
        <span>Annai Golden Builders</span>
        <strong>Operations Workspace</strong>
      </div>
    </div>

    <div class="auth-copy" id="copy-signup">
      <span>Account activation</span>
      <h1 id="signup-title">Complete your signup</h1>
      <p id="signup-subtitle">Set up your password to activate your AGB account and access the workspace.</p>
    </div>

    <div id="loading-init" class="login-loading">
      <span class="spinner"></span>
      <span>Loading your invite details...</span>
    </div>

    <div id="form-view" style="display:none">
      <div id="invite-info" class="login-info" style="display:none">
        <strong id="invite-role-label"></strong>
        <span id="invite-email" style="display:block;margin-top:4px;"></span>
      </div>

      <form class="auth-form" id="signup-form">
        <label class="form-field">
          <span>Full name</span>
          <input type="text" id="name" placeholder="Enter your full name" autocomplete="name" required />
        </label>

        <label class="form-field">
          <span>Phone number</span>
          <input type="tel" id="phone" placeholder="+91 XXXXXXXXXX" autocomplete="tel" required />
        </label>

        <label class="form-field" id="email-field" style="display:none">
          <span>Email</span>
          <input type="email" id="email" placeholder="your@email.com" autocomplete="email" />
        </label>

        <label class="form-field" id="otp-field">
          <span>Verification code (6 digits)</span>
          <input type="text" id="otp" placeholder="Enter the 6-digit code from your email" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" />
        </label>

        <label class="form-field">
          <span>Password</span>
          <div class="password-row">
            <input type="password" id="password" placeholder="At least 6 characters" autocomplete="new-password" required />
            <button type="button" class="eye-btn" id="pw-toggle" aria-label="Toggle password visibility">Show</button>
          </div>
        </label>

        <label class="form-field">
          <span>Confirm password</span>
          <div class="password-row">
            <input type="password" id="confirm" placeholder="Re-enter your password" autocomplete="new-password" required />
            <button type="button" class="eye-btn" id="cf-toggle" aria-label="Toggle confirm password visibility">Show</button>
          </div>
        </label>

        <button type="submit" class="auth-primary" id="submit-btn">Create account</button>
      </form>
    </div>

    <div id="success-view" style="display:none">
      <div class="login-success"><strong>Account created</strong></div>
      <p style="margin-top:12px;color:#475467;font-size:14px;line-height:1.5;" id="success-message">You can now sign in to the AGB app.</p>
    </div>

    <p class="footer-note">
      Need help? Contact your administrator at
      <a href="mailto:admin@annaigoldenbuilders.online">admin@annaigoldenbuilders.online</a>
    </p>
  </section>

  <script>
    (function () {
      var API = window.location.origin + '/api';
      var params = new URLSearchParams(window.location.search);
      var token = params.get('token');

      var inviteType = null; // 'supervisor' | 'employee'
      var inviteData = null;

      function showErr(m) {
        var formView = document.getElementById('form-view');
        var existing = formView.querySelector('.login-error');
        if (existing) existing.remove();
        var inline = document.createElement('div');
        inline.className = 'login-error';
        inline.style.marginBottom = '12px';
        inline.textContent = m;
        formView.insertBefore(inline, formView.firstChild);
      }

      function setLoading(loading) {
        document.getElementById('loading-init').style.display = loading ? 'flex' : 'none';
        document.getElementById('form-view').style.display = loading ? 'none' : 'block';
      }

      function togglePw(inputId, btn) {
        var el = document.getElementById(inputId);
        if (el.type === 'password') { el.type = 'text'; btn.textContent = 'Hide'; }
        else { el.type = 'password'; btn.textContent = 'Show'; }
      }

      document.getElementById('pw-toggle').addEventListener('click', function () {
        togglePw('password', this);
      });
      document.getElementById('cf-toggle').addEventListener('click', function () {
        togglePw('confirm', this);
      });

      async function loadInvite() {
        if (!token) {
          setLoading(false);
          document.getElementById('form-view').innerHTML = '<div class="login-error">Invalid or missing invite link. Please contact your administrator.</div>';
          return;
        }

        // Try employee verify first (most common for admin/PM/accountant invites)
        try {
          var r = await fetch(API + '/auth/employee/verify/' + encodeURIComponent(token));
          if (r.ok) {
            var d = await r.json();
            inviteType = 'employee';
            inviteData = d;
            renderInvite();
            return;
          }
        } catch (e) { /* fall through */ }

        // Fall back to supervisor verify
        try {
          var r2 = await fetch(API + '/auth/supervisor/verify/' + encodeURIComponent(token));
          if (r2.ok) {
            var d2 = await r2.json();
            inviteType = 'supervisor';
            inviteData = d2;
            renderInvite();
            return;
          } else {
            var errBody = await r2.json().catch(function () { return {}; });
            setLoading(false);
            document.getElementById('form-view').innerHTML = '<div class="login-error">' + (errBody.error || errBody.message || 'This invite link is invalid or has expired.') + '</div>';
          }
        } catch (e) {
          setLoading(false);
          document.getElementById('form-view').innerHTML = '<div class="login-error">Network error. Please check your connection and try again.</div>';
        }
      }

      function renderInvite() {
        var d = inviteData;
        var role = d.role || (inviteType === 'supervisor' ? 'supervisor' : 'employee');
        var roleLabel = role === 'supervisor' ? 'Site Supervisor'
          : role === 'project_manager' ? 'Project Manager'
          : role === 'admin' ? 'Admin'
          : role === 'accountant' ? 'Accountant'
          : 'Team Member';

        document.getElementById('invite-role-label').textContent = roleLabel + ' account';
        var emailText = (d.email || d.supervisorEmail || '');
        if (emailText) {
          document.getElementById('invite-email').textContent = 'Invited: ' + emailText;
        } else {
          document.getElementById('invite-email').style.display = 'none';
        }
        document.getElementById('invite-info').style.display = 'block';

        // Pre-fill name and phone (editable)
        var name = d.name || d.supervisorName || '';
        var phone = d.phone || d.supervisorPhone || '';
        document.getElementById('name').value = name;
        document.getElementById('phone').value = phone;

        // For supervisor invites, email field is also required
        if (inviteType === 'supervisor') {
          document.getElementById('email-field').style.display = 'flex';
          document.getElementById('email').required = true;
          if (emailText) document.getElementById('email').value = emailText;
        }

        // Employee invites (admin/PM/accountant) don't require a verification code
        if (inviteType === 'employee') {
          document.getElementById('otp-field').style.display = 'none';
          document.getElementById('otp').required = false;
        } else {
          document.getElementById('otp-field').style.display = 'flex';
          document.getElementById('otp').required = true;
        }

        document.getElementById('signup-title').textContent = 'Welcome, ' + (name || 'there');
        if (inviteType === 'employee') {
          document.getElementById('signup-subtitle').textContent = 'Review your details and choose a password to activate your account.';
        } else {
          document.getElementById('signup-subtitle').textContent = 'Review your details, enter the verification code from your email, and choose a password.';
        }

        setLoading(false);
      }

      document.getElementById('signup-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var n = document.getElementById('name').value.trim();
        var ph = document.getElementById('phone').value.trim();
        var otp = document.getElementById('otp').value.trim();
        var pw = document.getElementById('password').value;
        var cf = document.getElementById('confirm').value;

        if (!n || n.length < 2) { showErr('Please enter your full name.'); return; }
        if (!ph || ph.length < 8) { showErr('Please enter a valid phone number (at least 8 digits).'); return; }
        if (inviteType === 'supervisor' && (!otp || otp.length !== 6)) { showErr('Please enter the 6-digit verification code from your email.'); return; }
        if (!pw || pw.length < 6) { showErr('Password must be at least 6 characters.'); return; }
        if (pw !== cf) { showErr('Passwords do not match.'); return; }

        var payload = { token: token, name: n, phone: ph, password: pw };
        if (inviteType === 'supervisor') {
          payload.otp = otp;
          var em = document.getElementById('email').value.trim();
          if (!em) { showErr('Email is required.'); return; }
          payload.email = em;
        }

        document.getElementById('form-view').style.display = 'none';
        var loadingDiv = document.createElement('div');
        loadingDiv.className = 'login-loading';
        loadingDiv.id = 'submit-loading';
        loadingDiv.innerHTML = '<span class="spinner"></span><span>Creating your account...</span>';
        document.getElementById('signup-form').parentNode.insertBefore(loadingDiv, document.getElementById('signup-form'));

        try {
          var endpoint = inviteType === 'supervisor'
            ? API + '/auth/supervisor/signup'
            : API + '/auth/employee/signup';
          var r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          var d = await r.json();
          if (r.ok && d.success) {
            document.getElementById('submit-loading').remove();
            document.getElementById('success-view').style.display = 'block';
            document.getElementById('copy-signup').style.display = 'none';
            if (inviteType === 'employee') {
              document.getElementById('success-message').textContent = 'Account created! Redirecting you to the login page...';
              // Redirect to the web admin login page after a short delay
              var loginUrl = '${env.FRONTEND_URL.replace(/\/+$/, "")}/#/login';
              // Hardcoded fallback in case FRONTEND_URL env var is misconfigured.
              // The web admin is always deployed at backup-alt.github.io/AJUI/.
              // After the redirect, if the URL doesn't work, the user can still
              // navigate manually to https://backup-alt.github.io/AJUI/#/login
              setTimeout(function () {
                try {
                  window.location.href = loginUrl;
                  // Safety net: if the redirect doesn't work within 3 seconds,
                  // try the hardcoded correct URL as a last resort.
                  setTimeout(function () {
                    if (window.location.href.indexOf('login') === -1) {
                      window.location.href = 'https://backup-alt.github.io/AJUI/#/login';
                    }
                  }, 3000);
                } catch (e) {
                  window.location.href = 'https://backup-alt.github.io/AJUI/#/login';
                }
              }, 2500);
            } else {
              document.getElementById('success-message').textContent = 'You can now sign in to the AGB Supervisor app with your phone number and password.';
            }
          } else {
            document.getElementById('submit-loading').remove();
            document.getElementById('form-view').style.display = 'block';
            showErr(d.error || d.message || 'Signup failed. The invite may have expired.');
          }
        } catch (err) {
          document.getElementById('submit-loading').remove();
          document.getElementById('form-view').style.display = 'block';
          showErr('Network error. Please try again.');
        }
      });

      loadInvite();
    })();
  </script>
</body>
</html>`;