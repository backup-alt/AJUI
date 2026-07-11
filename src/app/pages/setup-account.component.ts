import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../core/api.service";
import { WorkspaceHydrationService } from "../core/workspace-hydration.service";

type Step = "loading" | "password" | "otp" | "success" | "invalid" | "error";

@Component({
  selector: "agb-setup-account",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="setup-account-page">
      <div class="setup-account-card">
        <div class="setup-account-logo">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="4" y="4" width="24" height="24" rx="4" fill="#002263"/>
            <path d="M11 16l3 3 7-7" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        @switch (step()) {
          @case ("loading") {
            <h1>Verifying invite…</h1>
            <p class="setup-account-sub">Please wait while we validate your invite link.</p>
          }

          @case ("invalid") {
            <h1>Invalid or expired invite</h1>
            <p class="setup-account-sub">This invite link is no longer valid. Please ask your admin to send a new one.</p>
            <button type="button" class="setup-account-btn setup-account-btn-primary" (click)="goToLogin()">Back to login</button>
          }

          @case ("password") {
            <h1>Set up your account</h1>
            <p class="setup-account-sub">Welcome, <strong>{{ inviteeName() || inviteeEmail() }}</strong>. Create a strong password to continue.</p>

            <form class="setup-account-form" (ngSubmit)="onContinueToOtp()">
              <div class="setup-account-field">
                <label for="setup-password">New password</label>
                <input
                  id="setup-password"
                  type="password"
                  [(ngModel)]="password"
                  name="password"
                  minlength="8"
                  required
                  placeholder="At least 8 characters"
                  autocomplete="new-password"
                />
                <small class="setup-account-hint">Use 8+ characters with a mix of letters, numbers, and symbols.</small>
              </div>

              <div class="setup-account-field">
                <label for="setup-confirm">Confirm password</label>
                <input
                  id="setup-confirm"
                  type="password"
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  minlength="8"
                  required
                  placeholder="Re-enter your password"
                  autocomplete="new-password"
                />
              </div>

              @if (errorMessage()) {
                <div class="setup-account-error">{{ errorMessage() }}</div>
              }

              <button type="submit" class="setup-account-btn setup-account-btn-primary" [disabled]="busy()">
                {{ busy() ? 'Please wait…' : 'Continue' }}
              </button>
            </form>
          }

          @case ("otp") {
            <h1>Verify your email</h1>
            <p class="setup-account-sub">
              @if (otpSent()) {
                We've sent a 6-digit verification code to <strong>{{ inviteeEmail() }}</strong>. Enter it below to finish setting up your account.
              } @else {
                Click <strong>Send OTP</strong> to receive a 6-digit verification code at <strong>{{ inviteeEmail() }}</strong>.
              }
            </p>

            <form class="setup-account-form" (ngSubmit)="onVerifyOtp()">
              @if (otpSent()) {
                <div class="setup-account-field">
                  <label for="setup-otp">Verification code</label>
                  <input
                    id="setup-otp"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    maxlength="6"
                    [(ngModel)]="otp"
                    name="otp"
                    placeholder="123456"
                    autocomplete="one-time-code"
                    class="setup-account-otp-input"
                  />
                </div>
              }

              @if (errorMessage()) {
                <div class="setup-account-error">{{ errorMessage() }}</div>
              }

              @if (otpSent()) {
                <button type="submit" class="setup-account-btn setup-account-btn-primary" [disabled]="busy() || otp.length !== 6">
                  {{ busy() ? 'Verifying…' : 'Verify and create account' }}
                </button>
                <button type="button" class="setup-account-btn setup-account-btn-ghost" (click)="onSendOtp()" [disabled]="resendBusy() || resendCooldown() > 0">
                  @if (resendCooldown() > 0) {
                    Resend in {{ resendCooldown() }}s
                  } @else {
                    {{ resendBusy() ? 'Sending…' : 'Resend OTP' }}
                  }
                </button>
                <button type="button" class="setup-account-btn setup-account-btn-text" (click)="backToPassword()">Back</button>
              } @else {
                <button type="button" class="setup-account-btn setup-account-btn-primary" (click)="onSendOtp()" [disabled]="busy()">
                  {{ busy() ? 'Sending…' : 'Send OTP' }}
                </button>
                <button type="button" class="setup-account-btn setup-account-btn-text" (click)="backToPassword()">Back</button>
              }
            </form>
          }

          @case ("success") {
            <div class="setup-account-success">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="28" fill="#d1fae5" stroke="#10b981" stroke-width="2"/>
                <path d="m20 32 8 8 16-16" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <h1>Account created!</h1>
              <p class="setup-account-sub">You can now sign in with your email and password.</p>
              <button type="button" class="setup-account-btn setup-account-btn-primary" (click)="goToLogin()">Go to login</button>
            </div>
          }

          @case ("error") {
            <h1>Something went wrong</h1>
            <p class="setup-account-sub">{{ errorMessage() || 'An unexpected error occurred. Please try again.' }}</p>
            <button type="button" class="setup-account-btn setup-account-btn-primary" (click)="goToLogin()">Back to login</button>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .setup-account-page {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding: 20px;
      z-index: 100;
    }

    .setup-account-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(15, 23, 42, 0.05);
      padding: 40px;
      width: 100%;
      max-width: 440px;
      text-align: center;
    }

    .setup-account-logo {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;
    }
    .setup-account-logo svg {
      width: 48px;
      height: 48px;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 8px;
      letter-spacing: -0.01em;
    }

    .setup-account-sub {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 28px;
      line-height: 1.5;
    }
    .setup-account-sub strong { color: #0f172a; }

    .setup-account-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .setup-account-field {
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .setup-account-field label {
      font-size: 13px;
      font-weight: 500;
      color: #0f172a;
    }
    .setup-account-field input {
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      color: #0f172a;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .setup-account-field input:focus {
      outline: none;
      border-color: #002263;
      box-shadow: 0 0 0 3px rgba(0, 34, 99, 0.1);
    }

    .setup-account-otp-input {
      font-size: 24px !important;
      letter-spacing: 8px;
      text-align: center;
      font-weight: 600;
    }

    .setup-account-hint {
      font-size: 12px;
      color: #94a3b8;
    }

    .setup-account-error {
      background: #fee2e2;
      color: #991b1b;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 13px;
      text-align: left;
    }

    .setup-account-btn {
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, opacity 0.15s;
      border: 1px solid transparent;
    }
    .setup-account-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .setup-account-btn-primary {
      background: #002263;
      color: #ffffff;
      border-color: #002263;
    }
    .setup-account-btn-primary:hover:not(:disabled) {
      background: #001a4d;
    }
    .setup-account-btn-ghost {
      background: #ffffff;
      color: #334155;
      border-color: #cbd5e1;
    }
    .setup-account-btn-ghost:hover:not(:disabled) {
      background: #f1f5f9;
    }
    .setup-account-btn-text {
      background: transparent;
      color: #64748b;
      border: none;
      padding: 6px;
    }
    .setup-account-btn-text:hover:not(:disabled) {
      color: #002263;
    }

    .setup-account-success {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .setup-account-success svg {
      width: 64px;
      height: 64px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupAccountComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hydration = inject(WorkspaceHydrationService);

  readonly step = signal<Step>("loading");
  readonly inviteeEmail = signal("");
  readonly inviteeName = signal("");
  readonly errorMessage = signal<string | null>(null);
  readonly busy = signal(false);
  readonly resendBusy = signal(false);
  readonly resendCooldown = signal(0);
  readonly otpSent = signal(false);

  password = "";
  confirmPassword = "";
  otp = "";

  private token = "";
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get("token") || "";
    if (!this.token) {
      this.step.set("invalid");
      return;
    }

    // Clear any existing session - this is a fresh signup via invite link
    this.api.clearSession();

    this.api.verifyEmployeeToken(this.token).subscribe({
      next: (res) => {
        if (res?.valid) {
          this.inviteeEmail.set(res.email || "");
          this.inviteeName.set(res.name || "");
          this.step.set("password");
        } else {
          this.step.set("invalid");
        }
      },
      error: () => {
        // If endpoint doesn't exist yet, still let them proceed with token
        this.step.set("password");
      },
    });
  }

  onContinueToOtp() {
    this.errorMessage.set(null);

    if (this.password.length < 8) {
      this.errorMessage.set("Password must be at least 8 characters.");
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set("Passwords do not match.");
      return;
    }
    this.step.set("otp");
  }

  backToPassword() {
    this.otp = "";
    this.errorMessage.set(null);
    this.step.set("password");
  }

  onSendOtp() {
    this.errorMessage.set(null);
    this.busy.set(true);

    this.api.sendEmployeeOtp(this.token).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.otpSent.set(true);
        this.startResendCooldown(res?.expiresIn || 60);
      },
      error: (err) => {
        this.busy.set(false);
        this.errorMessage.set(err?.message || "Failed to send OTP. Please try again.");
      },
    });
  }

  onVerifyOtp() {
    this.errorMessage.set(null);

    if (this.otp.length !== 6) {
      this.errorMessage.set("Please enter the 6-digit code from your email.");
      return;
    }

    this.busy.set(true);
    this.api.verifyEmployeeOtp(this.token, this.otp, this.password).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res?.success && res?.accessToken && res?.user) {
          this.api.setEmployeeSession(res.user, res.accessToken, res.expiresAt || "");
          this.hydration.hydrateFromBackend();
          void this.router.navigate(["/clients"]);
        } else if (res?.success) {
          this.step.set("success");
        } else {
          this.errorMessage.set(res?.message || "Invalid code. Please try again.");
        }
      },
      error: (err) => {
        this.busy.set(false);
        this.errorMessage.set(err?.message || "Verification failed. Please check the code and try again.");
      },
    });
  }

  goToLogin() {
    this.router.navigateByUrl("/login");
  }

  private startResendCooldown(seconds: number) {
    this.resendCooldown.set(seconds);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        this.resendCooldown.set(0);
        if (this.cooldownTimer) {
          clearInterval(this.cooldownTimer);
          this.cooldownTimer = null;
        }
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }
}
