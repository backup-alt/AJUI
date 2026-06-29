import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { ApiService } from "../core/api.service";
import { ErpDataService } from "../data/erp-data.service";
import { mapClient, mapProject, mapSite, mapVendor, mapSupervisor, mapMaterial, mapLabour, mapExpense, mapPayment, mapSubcontractor } from "../core/mappers";

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

        @if (errorMessage()) {
          <div class="login-error" role="alert">
            <strong>Login failed:</strong> {{ errorMessage() }}
          </div>
        }

        @if (loading()) {
          <div class="login-loading" role="status">
            <span class="spinner"></span>
            <span>Signing in &amp; loading workspace data from backend...</span>
          </div>
        }

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

        <button type="button" class="auth-primary" (click)="enterDashboard()" [disabled]="loading()">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
            <path d="M10 6H6.5A2.5 2.5 0 0 0 4 8.5v7A2.5 2.5 0 0 0 6.5 18H10" />
            <path d="M14 8l4 4-4 4" />
            <path d="M18 12H9" />
          </svg>
          {{ loading() ? 'Signing in...' : 'Enter dashboard' }}
        </button>
      </section>
    </main>
  `,
  styles: [`
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
    .auth-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly erp = inject(ErpDataService);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  // Demo credentials (per project owner instruction)
  // Backend seeded admin: +919999999999 / AdminPass123
  private readonly demoPhone = "+919999999999";
  private readonly demoPassword = "AdminPass123";

  enterDashboard() {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.login(this.demoPhone, this.demoPassword).subscribe({
      next: (res) => {
        try {
          // Clear any old localStorage entries from previous localStorage-only mode
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith("agb-erp:")) localStorage.removeItem(k);
          });
          localStorage.setItem("agb-erp:session", "active");
        } catch {
          // localStorage may be unavailable
        }

        // Hydrate ErpDataService signals with fresh backend data
        // so pages using the original ErpDataService (settings, projects-directory, etc.)
        // also have data to display
        this.hydrateFromBackend();

        // Navigate immediately so user sees dashboard quickly;
        // hydration runs in background
        void this.router.navigate(["/dashboard"]);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.message || err?.statusText || "Unknown error";
        this.errorMessage.set(
          typeof msg === "string" ? msg : "Could not reach backend. Is the API server running?"
        );
      },
    });
  }

  private hydrateFromBackend() {
    this.api.listClients({ limit: 100 }).subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:clients",
            JSON.stringify((res.items || []).map(mapClient))
          );
        } catch {}
      },
      error: () => {},
    });
    this.api.listProjects({ limit: 100 }).subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:projects",
            JSON.stringify((res.items || []).map(mapProject))
          );
        } catch {}
      },
      error: () => {},
    });
    this.api.listSites().subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:sites",
            JSON.stringify((res.items || []).map(mapSite))
          );
        } catch {}
      },
      error: () => {},
    });
    this.api.listVendors({ limit: 100 }).subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:vendors",
            JSON.stringify((res.items || []).map(mapVendor))
          );
        } catch {}
      },
      error: () => {},
    });
    this.api.listSupervisors().subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:supervisors",
            JSON.stringify((res.items || []).map(mapSupervisor))
          );
        } catch {}
      },
      error: () => {},
    });
    this.api.listMaterials({ limit: 100 }).subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:materials",
            JSON.stringify((res.items || []).map(mapMaterial))
          );
        } catch {}
      },
      error: () => {},
    });
    this.api.listLabour({ limit: 100 }).subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:labour",
            JSON.stringify((res.items || []).map(mapLabour))
          );
        } catch {}
      },
      error: () => {},
    });
    this.api.listExpenses({ limit: 100 }).subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:expenses",
            JSON.stringify((res.items || []).map(mapExpense))
          );
        } catch {}
      },
      error: () => {},
    });
    this.api.listPayments({ limit: 100 }).subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:payments",
            JSON.stringify((res.items || []).map(mapPayment))
          );
        } catch {}
      },
      error: () => {},
    });
    this.api.listSubcontractors({ limit: 100 }).subscribe({
      next: (res) => {
        try {
          localStorage.setItem(
            "agb-erp:subcontractors",
            JSON.stringify((res.items || []).map(mapSubcontractor))
          );
        } catch {}
      },
      error: () => {},
    });
  }
}
