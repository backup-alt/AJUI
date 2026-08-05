import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../core/api.service";

@Component({
  selector: "agb-settings-account",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Account</strong>
      </nav>
      <h1>Account</h1>
      <p>Your personal information and sign-in credentials.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Profile</h2>
          <p>Your name and contact details are visible to your team.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-field">
          <label for="account-name">Full name</label>
          <input
            id="account-name"
            type="text"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
            placeholder="Your full name"
          />
        </div>
        <div class="settings-w11-field-row">
          <div class="settings-w11-field">
            <label for="account-email">Email</label>
            <input
              id="account-email"
              type="email"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
              placeholder="you@agbuilders.com"
            />
          </div>
          <div class="settings-w11-field">
            <label for="account-phone">Phone</label>
            <input
              id="account-phone"
              type="tel"
              [value]="phone()"
              (input)="phone.set($any($event.target).value)"
              placeholder="+91 98765 43210"
            />
          </div>
        </div>
        <div class="settings-w11-field">
          <label>Role</label>
          <div class="settings-w11-readonly">
            <span class="settings-w11-role-pill">{{ api.user()?.role || '—' }}</span>
            <small>Role is set by the admin. Contact them to change it.</small>
          </div>
        </div>
        <div class="settings-w11-actions">
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="saveProfile()">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
        @if (message()) {
          <div class="settings-w11-message" [class.error]="isError()">{{ message() }}</div>
        }
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Change password</h2>
          <p>Request a password reset link to be sent to your email.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-field">
          <label for="account-email">Email</label>
          <input
            id="account-email"
            type="email"
            [value]="email()"
            readonly
            class="settings-w11-readonly-input"
          />
        </div>
        <div class="settings-w11-actions">
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="requestPasswordReset()">
            {{ sendingReset() ? 'Sending…' : 'Send password reset link' }}
          </button>
        </div>
        @if (passwordMessage()) {
          <div class="settings-w11-message" [class.error]="passwordError()">{{ passwordMessage() }}</div>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; color: #0f172a; background: transparent; }
    :host .settings-w11-header { color: #0f172a; }
    :host .settings-w11-header h1 { color: #0f172a; }
    :host .settings-w11-header p { color: #475569; }
    :host .settings-w11-breadcrumb { color: #475569; }
    :host .settings-w11-breadcrumb strong { color: #0f172a; }
    :host .settings-w11-card { background: #ffffff; color: #0f172a; }
    :host .settings-w11-card-head h2 { color: #0f172a; }
    :host .settings-w11-card-head p { color: #475569; }
    :host .settings-w11-card-body { color: #0f172a; }
    :host .settings-w11-field label { color: #334155; }
    :host .settings-w11-field input,
    :host .settings-w11-field select,
    :host .settings-w11-field textarea {
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
    }
    :host .settings-w11-readonly small { color: #475569; }
    :host .settings-w11-role-pill { color: #3730a3; background: #eef2ff; }
    :host .settings-w11-message { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
    :host .settings-w11-message.error { color: #991b1b; background: #fef2f2; border-color: #fecaca; }
    @media (prefers-color-scheme: dark) {
      :host, :host .settings-w11-header, :host .settings-w11-card, :host .settings-w11-card-body {
        color: #0f172a !important;
        background: #ffffff !important;
      }
      :host .settings-w11-header p,
      :host .settings-w11-card-head p,
      :host .settings-w11-readonly small { color: #475569 !important; }
      :host .settings-w11-field label { color: #334155 !important; }
      :host .settings-w11-field input,
      :host .settings-w11-field select,
      :host .settings-w11-field textarea {
        color: #0f172a !important;
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAccountComponent {
  readonly api = inject(ApiService);

  readonly name = signal(this.api.user()?.name ?? "");
  readonly email = signal(this.api.user()?.email ?? "");
  readonly phone = signal(this.api.user()?.phone ?? "");
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly isError = signal(false);

  readonly currentPassword = signal("");
  readonly newPassword = signal("");
  readonly confirmPassword = signal("");
  readonly sendingReset = signal(false);
  readonly passwordMessage = signal<string | null>(null);
  readonly passwordError = signal(false);

  saveProfile() {
    this.isError.set(false);
    this.message.set(null);
    this.saving.set(true);

    this.api.patchMe({ name: this.name().trim(), phone: this.phone().trim() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set("Profile updated successfully.");
      },
      error: (err) => {
        this.saving.set(false);
        this.isError.set(true);
        this.message.set(err?.message || "Failed to update profile. Please try again.");
      },
    });
  }

  requestPasswordReset() {
    this.passwordError.set(false);
    this.passwordMessage.set(null);

    this.sendingReset.set(true);
    this.api.forgotPassword(this.email()).subscribe({
      next: () => {
        this.sendingReset.set(false);
        this.passwordError.set(false);
        this.passwordMessage.set("Password reset link sent! Check your email.");
      },
      error: (err) => {
        this.sendingReset.set(false);
        this.passwordError.set(false);
        this.passwordMessage.set("If an account exists with this email, a reset link has been sent.");
      },
    });
  }
}
