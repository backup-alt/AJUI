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
          <p>Use a strong password with at least 8 characters.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-field">
          <label for="account-current">Current password</label>
          <input
            id="account-current"
            type="password"
            [value]="currentPassword()"
            (input)="currentPassword.set($any($event.target).value)"
            autocomplete="current-password"
          />
        </div>
        <div class="settings-w11-field-row">
          <div class="settings-w11-field">
            <label for="account-new">New password</label>
            <input
              id="account-new"
              type="password"
              [value]="newPassword()"
              (input)="newPassword.set($any($event.target).value)"
              autocomplete="new-password"
            />
          </div>
          <div class="settings-w11-field">
            <label for="account-confirm">Confirm new password</label>
            <input
              id="account-confirm"
              type="password"
              [value]="confirmPassword()"
              (input)="confirmPassword.set($any($event.target).value)"
              autocomplete="new-password"
            />
          </div>
        </div>
        <div class="settings-w11-actions">
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="changePassword()">
            {{ changingPassword() ? 'Updating…' : 'Update password' }}
          </button>
        </div>
        @if (passwordMessage()) {
          <div class="settings-w11-message" [class.error]="passwordError()">{{ passwordMessage() }}</div>
        }
      </div>
    </section>
  `,
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
  readonly changingPassword = signal(false);
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

  changePassword() {
    this.passwordError.set(false);
    this.passwordMessage.set(null);

    if (this.newPassword().length < 8) {
      this.passwordError.set(true);
      this.passwordMessage.set("New password must be at least 8 characters.");
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set(true);
      this.passwordMessage.set("Passwords do not match.");
      return;
    }
    if (!this.currentPassword()) {
      this.passwordError.set(true);
      this.passwordMessage.set("Please enter your current password.");
      return;
    }

    this.changingPassword.set(true);
    this.api.changePassword({ currentPassword: this.currentPassword(), newPassword: this.newPassword() }).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordError.set(false);
        this.passwordMessage.set("Password updated successfully.");
        this.currentPassword.set("");
        this.newPassword.set("");
        this.confirmPassword.set("");
      },
      error: (err) => {
        this.changingPassword.set(false);
        this.passwordError.set(true);
        this.passwordMessage.set(err?.message || "Failed to update password. Please check your current password.");
      },
    });
  }
}
