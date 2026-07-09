import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnDestroy, DestroyRef } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../core/api.service";

interface ActiveInviteDisplay {
  inviteId: string;
  token: string;
  qrDataUrl: string;
  supervisorName: string;
  supervisorEmail: string;
  supervisorPhone: string;
  expiresAt: string;
  remainingMs: number;
  scanned: boolean;
  otp?: string;
  emailSent?: boolean;
}

@Component({
  selector: "agb-settings-add-supervisor",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Roles and Employees</strong>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Add Supervisor</strong>
      </nav>
      <h1>Add Supervisor</h1>
      <p>Generate a time-limited QR code for a new supervisor. They scan it from the AGB app to activate their account.</p>
    </header>

    <div class="settings-w11-two-col">
      <section class="settings-w11-card">
        <div class="settings-w11-card-head">
          <div>
            <h2>Supervisor details</h2>
            <p>Enter the supervisor's name, email, and phone.</p>
          </div>
        </div>
        <div class="settings-w11-card-body">
          @if (!currentInvite() && !scanSuccess()) {
            <div class="settings-w11-form">
              <div class="settings-w11-field">
                <label>Supervisor name</label>
                <input
                  type="text"
                  [value]="supervisorNameDraft()"
                  (input)="supervisorNameDraft.set($any($event.target).value)"
                  placeholder="e.g. Rajesh Kumar"
                  maxlength="80"
                />
              </div>
              <div class="settings-w11-field">
                <label>Email</label>
                <input
                  type="email"
                  [value]="supervisorEmailDraft()"
                  (input)="supervisorEmailDraft.set($any($event.target).value)"
                  placeholder="e.g. rajesh@agbuilders.com"
                />
              </div>
              <div class="settings-w11-field">
                <label>Phone</label>
                <input
                  type="tel"
                  [value]="supervisorPhoneDraft()"
                  (input)="supervisorPhoneDraft.set($any($event.target).value)"
                  placeholder="e.g. +91 98765 43210"
                />
              </div>
              @if (supervisorError()) {
                <div class="settings-w11-message error">{{ supervisorError() }}</div>
              }
              <button
                type="button"
                class="settings-w11-btn settings-w11-btn-primary"
                [disabled]="supervisorLoading()"
                (click)="generateSupervisorQr()">
                {{ supervisorLoading() ? 'Generating…' : 'Generate QR Code' }}
              </button>
            </div>
          }

          @if (currentInvite(); as invite) {
            <div class="settings-w11-qr-card" [class.scanned]="invite.scanned">
              <header class="settings-w11-qr-head">
                <div>
                  <strong>{{ invite.supervisorName }}</strong>
                  <small>{{ invite.supervisorEmail }}</small>
                </div>
                <div class="settings-w11-qr-timer" [class.expired]="invite.remainingMs <= 0">
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" fill="none"
                      [style.stroke-dasharray]="countdownCircle(invite.remainingMs)"
                      stroke-dashoffset="0"
                      transform="rotate(-90 10 10)"
                    />
                    <text x="10" y="14" text-anchor="middle" font-size="7" fill="currentColor">{{ formatCountdown(invite.remainingMs) }}</text>
                  </svg>
                  <span *ngIf="invite.remainingMs > 0">{{ formatCountdown(invite.remainingMs) }}</span>
                  <span *ngIf="invite.remainingMs <= 0" class="settings-w11-expired-label">Expired</span>
                </div>
              </header>
              <div class="settings-w11-qr-frame">
                <img [src]="invite.qrDataUrl" alt="Supervisor QR Code" />
              </div>
              <p class="settings-w11-hint" *ngIf="!invite.scanned">
                Ask the supervisor to open the <strong>AGB</strong> app, tap <strong>Scan QR</strong> on the welcome screen, and enter the OTP sent to their email.
              </p>
              <div class="settings-w11-otp-block" *ngIf="!invite.scanned && invite.otp && invite.emailSent === false">
                <span class="settings-w11-otp-label">Email delivery failed — share this code verbally with the supervisor</span>
                <strong class="settings-w11-otp-code">{{ invite.otp }}</strong>
              </div>
              <div class="settings-w11-scan-success" *ngIf="invite.scanned">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="10" cy="10" r="8" fill="#d4edda" stroke="#28a745" stroke-width="1.5"/>
                  <path d="m6 10.5 2.5 2.5 5-5" stroke="#28a745" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
                <span>Supervisor scanned! They can now set up their password.</span>
              </div>
              <div class="settings-w11-qr-actions">
                <button type="button" class="settings-w11-btn settings-w11-btn-ghost" (click)="resendOtp(invite.token)" [disabled]="resendingOtp()">
                  {{ resendingOtp() ? 'Sending…' : 'Resend OTP' }}
                </button>
                <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="resetSupervisorInvite()">
                  Generate another
                </button>
              </div>
            </div>
          }

          @if (scanSuccess() && !currentInvite()) {
            <div class="settings-w11-callout success">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="8" fill="#d4edda" stroke="#28a745" stroke-width="1.5"/>
                <path d="m6 10.5 2.5 2.5 5-5" stroke="#28a745" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
              <div>
                <strong>Supervisor account activated!</strong>
                <p>They can now log in with their phone and password.</p>
              </div>
              <button type="button" class="settings-w11-btn settings-w11-btn-ghost small" (click)="scanSuccess.set(false)">Dismiss</button>
            </div>
          }
        </div>
      </section>

      <section class="settings-w11-card">
        <div class="settings-w11-card-head">
          <div>
            <h2>Active QR Codes</h2>
            <p>Pending invites waiting for the supervisor to scan.</p>
          </div>
        </div>
        <div class="settings-w11-card-body">
          @if (activeInvites().length === 0) {
            <p class="settings-w11-drawer-hint">No active invites right now.</p>
          } @else {
            @for (inv of activeInvites(); track inv.token) {
              <div class="settings-w11-invite-row" [class.scanned]="!isInviteInList(inv.token)">
                <div>
                  <strong>{{ inv.supervisorName }}</strong>
                  <small>{{ inv.supervisorEmail }}</small>
                </div>
                @if (isInviteInList(inv.token)) {
                  <span [class.expired]="inv.remainingMs <= 0">{{ formatCountdown(inv.remainingMs) }}</span>
                } @else {
                  <span class="settings-w11-status-pill" data-status="active">Scanned</span>
                }
              </div>
            }
          }
        </div>
      </section>
    </div>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Deactivate Supervisor</h2>
          <p>Remove a supervisor's access (e.g. if they cannot complete setup).</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-form inline">
          <div class="settings-w11-field grow">
            <label>Email or phone</label>
            <input
              type="text"
              [value]="deactivateSearch()"
              (input)="deactivateSearch.set($any($event.target).value)"
              placeholder="e.g. rajesh@agbuilders.com or +91 98765 43210"
            />
          </div>
          <button
            type="button"
            class="settings-w11-btn settings-w11-btn-danger-outline"
            [disabled]="deactivateLoading()"
            (click)="deactivateSupervisor()">
            {{ deactivateLoading() ? 'Deactivating…' : 'Deactivate' }}
          </button>
        </div>
        @if (deactivateError()) {
          <div class="settings-w11-message error">{{ deactivateError() }}</div>
        }
        @if (deactivateSuccess()) {
          <div class="settings-w11-message success">{{ deactivateSuccess() }}</div>
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAddSupervisorComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly supervisorNameDraft = signal("");
  readonly supervisorEmailDraft = signal("");
  readonly supervisorPhoneDraft = signal("");
  readonly supervisorLoading = signal(false);
  readonly supervisorError = signal<string | null>(null);
  readonly resendingOtp = signal(false);
  readonly currentInvite = signal<ActiveInviteDisplay | null>(null);
  readonly activeInvites = signal<Array<{ token: string; supervisorName: string; supervisorEmail: string; expiresAt: string; remainingMs: number }>>([]);
  readonly scanSuccess = signal(false);

  readonly deactivateSearch = signal("");
  readonly deactivateLoading = signal(false);
  readonly deactivateError = signal<string | null>(null);
  readonly deactivateSuccess = signal<string | null>(null);

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startActiveInvitesPoll();
  }

  ngOnDestroy() {
    this.stopPolls();
  }

  private startActiveInvitesPoll() {
    this.pollActiveInvites();
    this.pollInterval = setInterval(() => this.pollActiveInvites(), 10_000);
  }

  private stopPolls() {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }

  private pollActiveInvites() {
    this.api.listActiveInvites().subscribe({
      next: (res) => {
        const fresh = res.invites.map((inv) => ({
          token: inv.token,
          supervisorName: inv.supervisorName,
          supervisorEmail: inv.supervisorEmail,
          expiresAt: inv.expiresAt,
          remainingMs: Math.max(0, inv.remainingMs),
        }));
        this.activeInvites.set(fresh);

        const current = this.currentInvite();
        if (current && !current.scanned) {
          const found = fresh.find((f) => f.token === current.token);
          if (!found) {
            this.currentInvite.set({ ...current, scanned: true });
            this.scanSuccess.set(true);
            setTimeout(() => {
              this.currentInvite.set(null);
              this.scanSuccess.set(false);
            }, 5000);
          } else {
            this.currentInvite.update((c) => c ? { ...c, remainingMs: found.remainingMs } : c);
          }
        }
      },
      error: () => {},
    });
  }

  private startCountdown() {
    this.stopPolls();
    this.countdownInterval = setInterval(() => {
      const current = this.currentInvite();
      if (!current) return;
      const newRemaining = Math.max(0, current.remainingMs - 1000);
      if (newRemaining <= 0) {
        this.currentInvite.update((c) => c ? { ...c, remainingMs: 0 } : c);
        clearInterval(this.countdownInterval!);
        return;
      }
      this.currentInvite.update((c) => c ? { ...c, remainingMs: newRemaining } : c);
    }, 1000);
    this.pollInterval = setInterval(() => this.pollActiveInvites(), 10_000);
  }

  generateSupervisorQr() {
    const name = this.supervisorNameDraft().trim();
    const email = this.supervisorEmailDraft().trim();
    const phone = this.supervisorPhoneDraft().trim();
    if (name.length < 2) {
      this.supervisorError.set("Please enter at least 2 characters for the name.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.supervisorError.set("Please enter a valid email address.");
      return;
    }
    if (!phone || phone.replace(/\D/g, "").length < 8) {
      this.supervisorError.set("Please enter a valid mobile number (at least 8 digits).");
      return;
    }
    this.supervisorError.set(null);
    this.supervisorLoading.set(true);

    this.api.createSupervisorInvite({ supervisorName: name, supervisorEmail: email, supervisorPhone: phone }).subscribe({
      next: (invite) => {
        const fiveMinMs = 5 * 60 * 1000;
        this.currentInvite.set({
          inviteId: invite.inviteId,
          token: invite.token,
          qrDataUrl: invite.qrDataUrl,
          supervisorName: invite.supervisorName,
          supervisorEmail: invite.supervisorEmail,
          supervisorPhone: phone,
          expiresAt: invite.expiresAt,
          remainingMs: fiveMinMs,
          scanned: false,
          otp: invite.otp,
          emailSent: invite.emailSent,
        });
        this.supervisorLoading.set(false);
        this.startCountdown();
      },
      error: (err) => {
        const status = err?.status ?? err?.statusCode;
        const detail = err?.error?.error || err?.message || "Failed to generate QR.";
        this.supervisorError.set(`[${status ?? "?"}] ${detail}`);
        this.supervisorLoading.set(false);
      },
    });
  }

  resetSupervisorInvite() {
    this.stopPolls();
    this.currentInvite.set(null);
    this.supervisorNameDraft.set("");
    this.supervisorEmailDraft.set("");
    this.supervisorPhoneDraft.set("");
    this.supervisorError.set(null);
    this.startActiveInvitesPoll();
  }

  resendOtp(token: string) {
    this.resendingOtp.set(true);
    this.api.resendInviteOtp(token).subscribe({
      next: () => {
        this.resendingOtp.set(false);
        alert("OTP resent.");
      },
      error: () => {
        this.resendingOtp.set(false);
        alert("Failed to resend OTP.");
      },
    });
  }

  isInviteInList(token: string): boolean {
    return this.activeInvites().some((i) => i.token === token);
  }

  deactivateSupervisor() {
    const search = this.deactivateSearch().trim();
    if (!search) {
      this.deactivateError.set("Please enter an email or phone number.");
      return;
    }

    const payload: { email?: string; phone?: string } = {};
    if (search.includes("@")) {
      payload.email = search;
    } else {
      payload.phone = search;
    }

    this.deactivateLoading.set(true);
    this.deactivateError.set(null);
    this.deactivateSuccess.set(null);

    this.api.deactivateSupervisor(payload).subscribe({
      next: (res) => {
        this.deactivateSuccess.set(`Supervisor "${res.supervisor.name}" (${res.supervisor.email || res.supervisor.phone}) has been deactivated.`);
        this.deactivateSearch.set("");
        this.deactivateLoading.set(false);
      },
      error: (err) => {
        this.deactivateError.set(err?.error?.error || "Failed to deactivate supervisor.");
        this.deactivateLoading.set(false);
      },
    });
  }

  formatCountdown(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  countdownCircle(ms: number): string {
    const total = 5 * 60 * 1000;
    const remaining = Math.max(0, Math.min(total, ms));
    const ratio = remaining / total;
    const circumference = 2 * Math.PI * 8;
    return `${(circumference * ratio).toFixed(2)} ${circumference.toFixed(2)}`;
  }
}
