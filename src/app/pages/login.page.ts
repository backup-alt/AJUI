import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

@Component({
  standalone: true,
  imports: [CommonModule],
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
          <span>Secure access</span>
          <h1>Sign in to continue</h1>
          <p>Manage clients, project records, approvals, expenses, labour attendance, and reports from one controlled workspace.</p>
        </div>

        <div class="auth-session-card">
          <div>
            <span>Current role</span>
            <strong>Admin</strong>
          </div>
          <div>
            <span>Workspace</span>
            <strong>Project ERP</strong>
          </div>
        </div>

        <button type="button" class="auth-primary" (click)="enterDashboard()">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
            <path d="M10 6H6.5A2.5 2.5 0 0 0 4 8.5v7A2.5 2.5 0 0 0 6.5 18H10" />
            <path d="M14 8l4 4-4 4" />
            <path d="M18 12H9" />
          </svg>
          Enter dashboard
        </button>
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly router = inject(Router);

  enterDashboard() {
    try {
      localStorage.setItem("agb-erp:session", "active");
    } catch {
      // Session state is local-only for this static dashboard.
    }
    void this.router.navigate(["/dashboard"]);
  }
}
