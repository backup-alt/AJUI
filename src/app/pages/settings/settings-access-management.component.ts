import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from "@angular/core";
import { ApiService } from "../../core/api.service";

interface ApprovalType {
  key: string;
  label: string;
  note: string;
}

interface RoleTemplate {
  id?: string;
  name: string;
  role: string;
  approvalTypes: Record<string, { canApprove: boolean }>;
}

@Component({
  selector: "agb-settings-access-management",
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Access Management</strong>
      </nav>
      <h1>Access Management</h1>
      <p>Control which approval types each role can access. When disabled, employees with that role cannot view, approve, or reject that request type.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Role Permissions</h2>
          <p>Toggle access for each approval type per role.</p>
        </div>
        <button
          type="button"
          class="settings-w11-btn settings-w11-btn-primary"
          (click)="saveAll()"
          [disabled]="saving()"
        >
          {{ saving() ? 'Saving…' : 'Save Changes' }}
        </button>
      </div>

      <div class="settings-w11-card-body">
        @if (loading()) {
          <p class="settings-w11-empty-hint">Loading access templates…</p>
        } @else {
          <div class="access-roles-list">
            @for (role of roles; track role.key) {
              <div class="access-role-card">
                <div class="access-role-header">
                  <h3>{{ role.label }}</h3>
                  <p class="access-role-desc">{{ role.description }}</p>
                </div>
                <div class="access-perm-table">
                  <div class="access-perm-header">
                    <span>Request Type</span>
                    <span>Has Access</span>
                  </div>
                  @for (approval of approvalTypes; track approval.key) {
                    <div class="access-perm-row">
                      <div class="access-perm-label">
                        <strong>{{ approval.label }}</strong>
                        <small>{{ approval.note }}</small>
                      </div>
                      <label class="access-mini-toggle">
                        <input
                          type="checkbox"
                          [checked]="getPermission(role.key, approval.key)"
                          (change)="setPermission(role.key, approval.key, $any($event.target).checked)"
                        />
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      @if (error()) {
        <div class="settings-w11-message error">{{ error() }}</div>
      }

      @if (success()) {
        <div class="settings-w11-message success">Changes saved successfully!</div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAccessManagementComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  readonly approvalTypes: ApprovalType[] = [
    { key: "material", label: "Material Requests", note: "Cement, steel, sand, etc." },
    { key: "labour", label: "Labour / Attendance", note: "Daily attendance submissions" },
    { key: "site_expense", label: "Site Expenses", note: "Diesel, equipment, transport" },
    { key: "general_expense", label: "General Expenses", note: "Office supplies, miscellaneous" },
    { key: "payment", label: "Client Payments", note: "Collections from clients" },
    { key: "subcontract", label: "Subcontracts", note: "Subcontractor agreements" },
  ];

  readonly roles = [
    { key: "project_manager", label: "Project Manager", description: "Manage projects and approve related requests" },
    { key: "accountant", label: "Accountant", description: "Handle financials, payments and reports" },
  ];

  private templates: Map<string, RoleTemplate> = new Map();
  private originalTemplates: Map<string, RoleTemplate> = new Map();

  ngOnInit() {
    this.loadTemplates();
  }

  private loadTemplates() {
    this.loading.set(true);
    this.api.listAccessTemplates().subscribe({
      next: (res) => {
        this.templates.clear();
        this.originalTemplates.clear();
        for (const t of res.templates || []) {
          if (t.role === "admin" || t.role === "supervisor") continue;
          const template: RoleTemplate = {
            id: t._id,
            name: t.name,
            role: t.role,
            approvalTypes: this.mapApprovalTypes(t.approvalTypes),
          };
          this.templates.set(t.role, template);
          this.originalTemplates.set(t.role, JSON.parse(JSON.stringify(template)));
        }
        for (const role of this.roles) {
          if (!this.templates.has(role.key)) {
            const defaultTemplate: RoleTemplate = {
              name: `${role.label} Default`,
              role: role.key,
              approvalTypes: this.getDefaultApprovalTypes(),
            };
            this.templates.set(role.key, defaultTemplate);
            this.originalTemplates.set(role.key, JSON.parse(JSON.stringify(defaultTemplate)));
          }
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set("Failed to load access templates");
        this.loading.set(false);
        for (const role of this.roles) {
          const defaultTemplate: RoleTemplate = {
            name: `${role.label} Default`,
            role: role.key,
            approvalTypes: this.getDefaultApprovalTypes(),
          };
          this.templates.set(role.key, defaultTemplate);
          this.originalTemplates.set(role.key, JSON.parse(JSON.stringify(defaultTemplate)));
        }
      },
    });
  }

  private mapApprovalTypes(raw: any): Record<string, { canApprove: boolean }> {
    const result: Record<string, { canApprove: boolean }> = {};
    if (raw instanceof Map) {
      raw.forEach((value: any, key: string) => {
        result[key] = { canApprove: value.canApprove || false };
      });
    } else if (raw && typeof raw === "object") {
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "object" && value !== null) {
          result[key] = { canApprove: (value as any).canApprove || false };
        }
      }
    }
    return result;
  }

  private getDefaultApprovalTypes(): Record<string, { canApprove: boolean }> {
    const result: Record<string, { canApprove: boolean }> = {};
    for (const approval of this.approvalTypes) {
      result[approval.key] = { canApprove: false };
    }
    return result;
  }

  getPermission(roleKey: string, approvalKey: string): boolean {
    const template = this.templates.get(roleKey);
    return template?.approvalTypes[approvalKey]?.canApprove || false;
  }

  setPermission(roleKey: string, approvalKey: string, value: boolean) {
    const template = this.templates.get(roleKey);
    if (template) {
      if (!template.approvalTypes[approvalKey]) {
        template.approvalTypes[approvalKey] = { canApprove: false };
      }
      template.approvalTypes[approvalKey].canApprove = value;
      this.success.set(false);
      this.error.set(null);
    }
  }

  hasChanges(): boolean {
    for (const [roleKey, template] of this.templates) {
      const original = this.originalTemplates.get(roleKey);
      if (!original) return true;
      for (const approval of this.approvalTypes) {
        const current = template.approvalTypes[approval.key];
        const orig = original.approvalTypes[approval.key];
        if (!current || !orig) return true;
        if (current.canApprove !== orig.canApprove) {
          return true;
        }
      }
    }
    return false;
  }

  saveAll() {
    if (!this.hasChanges()) {
      this.error.set(null);
      this.success.set(true);
      setTimeout(() => this.success.set(false), 2000);
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    const operations: Promise<any>[] = [];

    for (const [roleKey, template] of this.templates) {
      const original = this.originalTemplates.get(roleKey);
      const approvalTypes: Record<string, { canApprove: boolean }> = {};

      for (const approval of this.approvalTypes) {
        const val = template.approvalTypes[approval.key]?.canApprove || false;
        approvalTypes[approval.key] = { canApprove: val };
      }

      if (original?.id) {
        operations.push(
          this.api.updateAccessTemplate(original.id, { approvalTypes }).toPromise()
        );
      } else {
        operations.push(
          this.api.createAccessTemplate({
            name: template.name || `${roleKey} Default`,
            role: roleKey,
            approvalTypes,
          }).toPromise()
        );
      }
    }

    Promise.all(operations)
      .then((results) => {
        this.success.set(true);
        this.saving.set(false);
        this.originalTemplates.clear();
        for (const [roleKey, template] of this.templates) {
          this.originalTemplates.set(roleKey, JSON.parse(JSON.stringify(template)));
        }
        setTimeout(() => this.success.set(false), 3000);
      })
      .catch((err) => {
        this.error.set("Failed to save some templates. Please try again.");
        this.saving.set(false);
      });
  }
}