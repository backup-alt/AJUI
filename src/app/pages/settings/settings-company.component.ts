import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ErpDataService } from "../../data/erp-data.service";

const INDIAN_STATES = [
  "Tamil Nadu",
  "Kerala",
  "Karnataka",
  "Andhra Pradesh",
  "Telangana",
  "Maharashtra",
  "Gujarat",
  "Rajasthan",
  "Madhya Pradesh",
  "Uttar Pradesh",
  "Bihar",
  "West Bengal",
  "Odisha",
  "Punjab",
  "Haryana",
  "Delhi",
  "Chandigarh",
  "Goa",
  "Other",
];

@Component({
  selector: "agb-settings-company",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Company Profile</strong>
      </nav>
      <h1>Company Profile</h1>
      <p>Your company details for quotations, invoices, and official documents.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Company Information</h2>
          <p>This information will appear on all generated quotations.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-field">
          <label for="company-name">Company Name</label>
          <input
            id="company-name"
            type="text"
            [value]="companyName()"
            (input)="companyName.set($any($event.target).value)"
            placeholder="Enter company name"
          />
        </div>
        <div class="settings-w11-field">
          <label for="company-address">Company Address</label>
          <textarea
            id="company-address"
            rows="3"
            [value]="companyAddress()"
            (input)="companyAddress.set($any($event.target).value)"
            placeholder="Enter full company address"
          ></textarea>
        </div>
        <div class="settings-w11-field-row">
          <div class="settings-w11-field">
            <label for="company-state">State</label>
            <select
              id="company-state"
              [value]="companyState()"
              (change)="companyState.set($any($event.target).value)"
            >
              @for (state of states; track state) {
                <option [value]="state" [selected]="state === companyState()">{{ state }}</option>
              }
            </select>
          </div>
          <div class="settings-w11-field">
            <label for="company-gstin">GSTIN</label>
            <input
              id="company-gstin"
              type="text"
              [value]="companyGstin()"
              (input)="companyGstin.set($any($event.target).value)"
              placeholder="Enter 15-digit GSTIN"
              maxlength="15"
            />
          </div>
        </div>
        <div class="settings-w11-actions">
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="saveCompanyProfile()">
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
          <h2>Bank Details</h2>
          <p>Appears on Tax Invoices for banking and payment reference.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-field-row">
          <div class="settings-w11-field">
            <label for="bank-name">Bank Name</label>
            <input
              id="bank-name"
              type="text"
              [value]="bankName()"
              (input)="bankName.set($any($event.target).value)"
              placeholder="e.g. State Bank of India"
            />
          </div>
          <div class="settings-w11-field">
            <label for="account-number">Account Number</label>
            <input
              id="account-number"
              type="text"
              [value]="accountNumber()"
              (input)="accountNumber.set($any($event.target).value)"
              placeholder="e.g. 123456789012"
            />
          </div>
        </div>
        <div class="settings-w11-field-row">
          <div class="settings-w11-field">
            <label for="ifsc">IFSC Code</label>
            <input
              id="ifsc"
              type="text"
              [value]="ifsc()"
              (input)="ifsc.set($any($event.target).value)"
              placeholder="e.g. SBIN0001234"
            />
          </div>
          <div class="settings-w11-field">
            <label for="branch">Branch</label>
            <input
              id="branch"
              type="text"
              [value]="branch()"
              (input)="branch.set($any($event.target).value)"
              placeholder="e.g. Chennai Main Branch"
            />
          </div>
        </div>
        <div class="settings-w11-actions">
          <button type="button" class="settings-w11-btn settings-w11-btn-primary" (click)="saveCompanyProfile()">
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
          <h2>Preview</h2>
          <p>This is how your company details will appear on quotations.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="company-preview">
          <div class="preview-row">
            <span class="preview-label">Company Name:</span>
            <span class="preview-value">{{ companyName() || 'Not set' }}</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">Address:</span>
            <span class="preview-value">{{ companyAddress() || 'Not set' }}</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">State:</span>
            <span class="preview-value">{{ companyState() || 'Not set' }}</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">GSTIN:</span>
            <span class="preview-value">{{ companyGstin() || 'Not set' }}</span>
          </div>
          @if (bankName()) {
            <div class="preview-row">
              <span class="preview-label">Bank:</span>
              <span class="preview-value">{{ bankName() }} {{ branch() ? '— ' + branch() : '' }}</span>
            </div>
          }
          @if (accountNumber()) {
            <div class="preview-row">
              <span class="preview-label">A/C No.:</span>
              <span class="preview-value">{{ accountNumber() }}</span>
            </div>
          }
          @if (ifsc()) {
            <div class="preview-row">
              <span class="preview-label">IFSC:</span>
              <span class="preview-value">{{ ifsc() }}</span>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .settings-w11-header {
      margin-bottom: 28px;
    }
    .settings-w11-breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .settings-w11-breadcrumb strong {
      color: #1e293b;
    }
    .settings-w11-header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px;
    }
    .settings-w11-header p {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }
    .settings-w11-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .settings-w11-card-head {
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
    }
    .settings-w11-card-head h2 {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 2px;
    }
    .settings-w11-card-head p {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .settings-w11-card-body {
      padding: 20px;
    }
    .settings-w11-field {
      margin-bottom: 16px;
    }
    .settings-w11-field label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
    }
    .settings-w11-field input,
    .settings-w11-field select,
    .settings-w11-field textarea {
      width: 100%;
      padding: 9px 12px;
      font-size: 14px;
      color: #1e293b;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      outline: none;
      transition: border-color 150ms;
      box-sizing: border-box;
    }
    .settings-w11-field input:focus,
    .settings-w11-field select:focus,
    .settings-w11-field textarea:focus {
      border-color: #2c5cff;
      box-shadow: 0 0 0 3px rgba(44, 92, 255, 0.1);
    }
    .settings-w11-field textarea {
      resize: vertical;
      min-height: 80px;
    }
    .settings-w11-field select {
      cursor: pointer;
    }
    .settings-w11-field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .settings-w11-actions {
      margin-top: 20px;
    }
    .settings-w11-btn {
      padding: 9px 18px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      transition: all 150ms;
    }
    .settings-w11-btn-primary {
      background: #2c5cff;
      color: #fff;
    }
    .settings-w11-btn-primary:hover {
      background: #1e4ae8;
    }
    .settings-w11-btn-primary:disabled {
      background: #94a3b8;
      cursor: not-allowed;
    }
    .settings-w11-message {
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .settings-w11-message.error {
      background: #fef2f2;
      color: #991b1b;
      border-color: #fecaca;
    }
    .company-preview {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .preview-row {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }
    .preview-row:last-child {
      margin-bottom: 0;
    }
    .preview-label {
      font-size: 13px;
      color: #64748b;
      min-width: 100px;
    }
    .preview-value {
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
    }
    @media (max-width: 640px) {
      .settings-w11-field-row {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsCompanyComponent {
  private readonly data = inject(ErpDataService);

  readonly states = INDIAN_STATES;

  readonly companyName = signal(this.data.companyProfile().name);
  readonly companyAddress = signal(this.data.companyProfile().address);
  readonly companyState = signal(this.data.companyProfile().state);
  readonly companyGstin = signal(this.data.companyProfile().gstin);
  readonly bankName = signal(this.data.companyProfile().bankName || "");
  readonly accountNumber = signal(this.data.companyProfile().accountNumber || "");
  readonly ifsc = signal(this.data.companyProfile().ifsc || "");
  readonly branch = signal(this.data.companyProfile().branch || "");

  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly isError = signal(false);

  saveCompanyProfile() {
    this.isError.set(false);
    this.message.set(null);
    this.saving.set(true);

    const profile = {
      name: this.companyName().trim(),
      address: this.companyAddress().trim(),
      state: this.companyState(),
      gstin: this.companyGstin().trim().toUpperCase(),
      bankName: this.bankName().trim(),
      accountNumber: this.accountNumber().trim(),
      ifsc: this.ifsc().trim().toUpperCase(),
      branch: this.branch().trim(),
    };

    this.data.updateCompanyProfile(profile);

    setTimeout(() => {
      this.saving.set(false);
      this.message.set("Company profile saved successfully.");
      setTimeout(() => this.message.set(null), 3000);
    }, 300);
  }
}