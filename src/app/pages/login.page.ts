import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="login-shell">
      <section class="login-panel">
        <img src="assets/logo.png" alt="Annai Golden Builders" />
        <div>
          <span>Session ended</span>
          <h1>Logged out</h1>
          <p>You have been signed out of the workspace.</p>
        </div>
        <button type="button" (click)="enterDashboard()">Enter dashboard</button>
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
