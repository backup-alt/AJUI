import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import { ApiService } from "../core/api.service";
import { WorkspaceHydrationService } from "../core/workspace-hydration.service";

type Mode = 'login' | 'forgot' | 'reset';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="login-shell">
      <section class="auth-card" aria-label="Annai Golden Builders login">
        <div class="auth-brand">
          <img src="assets/logo.png" alt="Annai Golden Builders" />
          <div>
            <span>Annai Golden Builders</span>
            <strong>Operations Workspace</strong>
          </div>
        </div>

        <div class="auth-copy">
          @if (mode() === 'login') {
            <span>Secure access</span>
            <h1>Sign in to continue</h1>
            <p>Manage clients, project records, approvals, expenses, labour attendance, and reports from one controlled workspace.</p>
          }
          @if (mode() === 'forgot') {
            <span>Password recovery</span>
            <h1>Reset your password</h1>
            <p>Enter your work email and we'll send you a link to reset your password.</p>
          }
          @if (mode() === 'reset') {
            <span>Set new password</span>
            <h1>Create a new password</h1>
            <p>Choose a strong password (at least 8 characters) to regain access to your account.</p>
          }
        </div>

        @if (successMessage()) {
          <div class="login-success" role="status">
            <strong>✓ {{ successMessage() }}</strong>
          </div>
        }

        @if (errorMessage()) {
          <div class="login-error" role="alert">
            <strong>Error:</strong> {{ errorMessage() }}
          </div>
        }

        @if (loading()) {
          <div class="login-loading" role="status">
            <span class="spinner"></span>
            <span>{{ loadingMessage() }}</span>
          </div>
        }

        <!-- ============= LOGIN FORM ============= -->
        @if (mode() === 'login' && !loading()) {
          <form class="auth-form" (ngSubmit)="onLogin()" #f="ngForm">
            <label class="form-field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                [(ngModel)]="loginEmail"
                placeholder="you@annaigoldenbuilders.online"
                autocomplete="username"
                required
              />
            </label>

            <label class="form-field">
              <span>Password</span>
              <div class="password-row">
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  name="password"
                  [(ngModel)]="loginPassword"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  required
                />
                <button type="button" class="eye-btn" (click)="showPassword.set(!showPassword())" aria-label="Toggle password visibility">
                  {{ showPassword() ? 'Hide' : 'Show' }}
                </button>
              </div>
            </label>

            <div class="form-row">
              <label class="remember">
                <input type="checkbox" [(ngModel)]="rememberMe" name="remember" />
                <span>Remember me</span>
              </label>
              <a class="link" (click)="switchMode('forgot')">Forgot password?</a>
            </div>

            <button type="submit" class="auth-primary" [disabled]="!loginEmail || !loginPassword">
              <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                <path d="M10 6H6.5A2.5 2.5 0 0 0 4 8.5v7A2.5 2.5 0 0 0 6.5 18H10" />
                <path d="M14 8l4 4-4 4" />
                <path d="M18 12H9" />
              </svg>
              Sign in
            </button>
          </form>
        }

        <!-- ============= FORGOT PASSWORD FORM ============= -->
        @if (mode() === 'forgot' && !loading()) {
          <form class="auth-form" (ngSubmit)="onForgotPassword()">
            <label class="form-field">
              <span>Email address</span>
              <input
                type="email"
                name="forgotEmail"
                [(ngModel)]="forgotEmail"
                placeholder="you@annaigoldenbuilders.online"
                autocomplete="email"
                required
              />
            </label>

            <button type="submit" class="auth-primary" [disabled]="!forgotEmail">
              Send reset link
            </button>

            <button type="button" class="auth-secondary" (click)="switchMode('login')">
              ← Back to sign in
            </button>
          </form>
        }

        <!-- ============= RESET PASSWORD FORM ============= -->
        @if (mode() === 'reset' && !loading()) {
          <form class="auth-form" (ngSubmit)="onResetPassword()">
            <label class="form-field">
              <span>New password</span>
              <div class="password-row">
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  name="newPassword"
                  [(ngModel)]="newPassword"
                  placeholder="At least 8 characters"
                  autocomplete="new-password"
                  required
                />
                <button type="button" class="eye-btn" (click)="showPassword.set(!showPassword())" aria-label="Toggle password visibility">
                  {{ showPassword() ? 'Hide' : 'Show' }}
                </button>
              </div>
            </label>

            <label class="form-field">
              <span>Confirm new password</span>
              <input
                [type]="showPassword() ? 'text' : 'password'"
                name="confirmPassword"
                [(ngModel)]="confirmPassword"
                placeholder="Re-enter your new password"
                autocomplete="new-password"
                required
              />
            </label>

            <button type="submit" class="auth-primary" [disabled]="!newPassword || !confirmPassword">
              Update password
            </button>
          </form>
        }

        <div class="auth-session-card">
          <div>
            <span>Current role</span>
            <strong>{{ sessionRole() }}</strong>
          </div>
          <div>
            <span>Workspace</span>
            <strong>Project ERP</strong>
          </div>
        </div>

        <p class="footer-note">
          Need an account? Contact your administrator at
          <a href="mailto:admin@annaigoldenbuilders.online">admin@annaigoldenbuilders.online</a>
        </p>
      </section>
    </main>
  `,
  styles: [`
    .login-success {
      margin: 16px 0 0;
      padding: 12px 14px;
      background: #ecfdf5;
      border: 1px solid #a7e6c1;
      border-radius: 8px;
      color: #0d6b3f;
      font-size: 13px;
      line-height: 1.5;
    }
    .login-error {
      margin: 16px 0 0;
      padding: 12px 14px;
      background: #fef0f0;
      border: 1px solid #f5c6c6;
      border-radius: 8px;
      color: #b03030;
      font-size: 13px;
      line-height: 1.5;
    }
    .login-error strong { display: block; margin-bottom: 4px; }
    .login-loading {
      margin: 16px 0 0;
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
    .auth-form { margin-top: 18px; display: flex; flex-direction: column; gap: 14px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field span {
      font-size: 12px; font-weight: 600; color: #475467;
      text-transform: uppercase; letter-spacing: 0.04em;
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
      box-shadow: 0 0 0 3px rgba(44,92,255,0.12);
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
    .form-row {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 13px;
    }
    .remember { display: flex; align-items: center; gap: 6px; color: #475467; cursor: pointer; }
    .remember input { width: 16px; height: 16px; cursor: pointer; }
    .link {
      color: #2c5cff; font-weight: 600; cursor: pointer; text-decoration: none;
    }
    .link:hover { text-decoration: underline; }
    .auth-primary:disabled, .auth-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
    .auth-secondary {
      background: none; border: 1.5px solid #d5dcea; color: #475467;
      padding: 10px 16px; border-radius: 10px; font-size: 14px;
      font-weight: 600; cursor: pointer; font-family: inherit;
    }
    .auth-secondary:hover { background: #f9fafb; }
    .footer-note {
      margin: 18px 0 0;
      text-align: center;
      font-size: 12px;
      color: #98a2b3;
      line-height: 1.5;
    }
    .footer-note a { color: #2c5cff; text-decoration: none; font-weight: 600; }
    .footer-note a:hover { text-decoration: underline; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly hydration = inject(WorkspaceHydrationService);

  mode = signal<Mode>('login');
  loading = signal(false);
  loadingMessage = signal('Signing in...');
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  showPassword = signal(false);
  sessionRole = signal('Admin');

  loginEmail = '';
  loginPassword = '';
  rememberMe = false;
  forgotEmail = '';
  newPassword = '';
  confirmPassword = '';

  // Reset token from URL query param
  private resetToken: string | null = null;

  ngOnInit() {
    // Force light mode for password reset flows
    this.forceLightMode();

    // Check for ?token=... query param (password reset link)
    this.route.queryParams.subscribe((params) => {
      if (params['token']) {
        this.resetToken = params['token'];
        this.switchMode('reset');
      } else if (params['mode'] === 'forgot') {
        this.switchMode('forgot');
      }
    });
  }

  private forceLightMode() {
    try {
      document.documentElement.classList.remove("dark-mode");
    } catch {}
  }

  switchMode(m: Mode) {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.mode.set(m);
    if (m === 'reset' || m === 'forgot') {
      this.forceLightMode();
    }
  }

  onLogin() {
    if (!this.loginEmail || !this.loginPassword) return;
    this.loading.set(true);
    this.loadingMessage.set('Signing in & loading workspace data from backend...');
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.api.login(this.loginEmail, this.loginPassword).subscribe({
      next: (res) => {
        try {
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith("agb-erp:")) localStorage.removeItem(k);
          });
          localStorage.setItem("agb-erp:session", "active");
          const role = (res?.user as any)?.role || 'admin';
          this.sessionRole.set(this.formatRole(role));
        } catch {}

        this.hydration.hydrateFromBackend();
        void this.router.navigate(["/dashboard"]);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.message || err?.error?.message || err?.error?.error || err?.statusText || "Unknown error";
        this.errorMessage.set(
          typeof msg === "string" ? msg : "Could not reach backend. Is the API server running?"
        );
      },
    });
  }

  onForgotPassword() {
    if (!this.forgotEmail) return;
    this.loading.set(true);
    this.loadingMessage.set('Sending reset link...');
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.api.forgotPassword(this.forgotEmail).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.successMessage.set(res?.message || 'If the email exists, a reset link has been sent. Check your inbox.');
        this.forgotEmail = '';
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message || err?.message || 'Could not send reset link.';
        this.errorMessage.set(typeof msg === 'string' ? msg : 'Request failed');
      },
    });
  }

  onResetPassword() {
    if (!this.newPassword || !this.confirmPassword) return;
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }
    if (this.newPassword.length < 8) {
      this.errorMessage.set('Password must be at least 8 characters.');
      return;
    }
    if (!this.resetToken) {
      this.errorMessage.set('Reset token is missing. Please request a new link.');
      return;
    }

    this.loading.set(true);
    this.loadingMessage.set('Updating password...');
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.api.resetPassword(this.resetToken, this.newPassword).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.successMessage.set(res?.message || 'Password updated! You can now sign in.');
        this.newPassword = '';
        this.confirmPassword = '';
        this.resetToken = null;
        setTimeout(() => this.switchMode('login'), 1500);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message || err?.message || 'Could not reset password.';
        this.errorMessage.set(typeof msg === 'string' ? msg : 'Request failed');
      },
    });
  }

  private formatRole(role: string): string {
    const map: Record<string, string> = {
      admin: 'Admin',
      accountant: 'Accountant',
      project_manager: 'Project Manager',
      supervisor: 'Supervisor',
    };
    return map[role] || role;
  }

}
