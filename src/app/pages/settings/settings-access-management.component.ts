import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from "@angular/core";
import { Router } from "@angular/router";
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
  approvalTypes: Record<string, { canApprove: boolean; canReject: boolean }>;
}

@Component({
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
      <p>Set default approval permissions for each role. These defaults are applied when inviting new employees.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Role Permissions</h2>
          <p>Configure what approvals each role can approve or reject by default.</p>
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
                    <span>Approval Type</span>
                    <span>Approve</span>
                    <span>Reject</span>
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
                          [checked]="getPermission(role.key, approval.key, 'canApprove')"
                          (change)="setPermission(role.key, approval.key, 'canApprove', $any($event.target).checked)"
                        />
                        <span class="toggle-slider"></span>
                      </label>
                      <label class="access-mini-toggle">
                        <input
                          type="checkbox"
                          [checked]="getPermission(role.key, approval.key, 'canReject')"
                          (change)="setPermission(role.key, approval.key, 'canReject', $any($event.target).checked)"
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
    { key: "labour", label: "Labour Attendance", note: "Daily attendance submissions" },
    { key: "expense", label: "Site Expenses", note: "Diesel, equipment, transport" },
    { key: "payment", label: "Client Payments", note: "Collections from clients" },
    { key: "subcontract", label: "Subcontracts", note: "Subcontractor agreements" },
  ];

  readonly roles = [
    { key: "admin", label: "Admin", description: "Full system access with all permissions" },
    { key: "project_manager", label: "Project Manager", description: "Manage projects and approve related requests" },
    { key: "accountant", label: "Accountant", description: "Handle financials, payments and reports" },
    { key: "supervisor", label: "Supervisor", description: "Oversee sites and submit attendance/expenses" },
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

  private mapApprovalTypes(raw: any): Record<string, { canApprove: boolean; canReject: boolean }> {
    const result: Record<string, { canApprove: boolean; canReject: boolean }> = {};
    if (raw instanceof Map) {
      raw.forEach((value: any, key: string) => {
        result[key] = { canApprove: value.canApprove || false, canReject: value.canReject || false };
      });
    } else if (raw && typeof raw === "object") {
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "object" && value !== null) {
          result[key] = { canApprove: (value as any).canApprove || false, canReject: (value as any).canReject || false };
        }
      }
    }
    return result;
  }

  private getDefaultApprovalTypes(): Record<string, { canApprove: boolean; canReject: boolean }> {
    const result: Record<string, { canApprove: boolean; canReject: boolean }> = {};
    for (const approval of this.approvalTypes) {
      result[approval.key] = { canApprove: false, canReject: false };
    }
    return result;
  }

  getPermission(roleKey: string, approvalKey: string, type: "canApprove" | "canReject"): boolean {
    const template = this.templates.get(roleKey);
    return template?.approvalTypes[approvalKey]?.[type] || false;
  }

  setPermission(roleKey: string, approvalKey: string, type: "canApprove" | "canReject", value: boolean) {
    const template = this.templates.get(roleKey);
    if (template) {
      if (!template.approvalTypes[approvalKey]) {
        template.approvalTypes[approvalKey] = { canApprove: false, canReject: false };
      }
      template.approvalTypes[approvalKey][type] = value;
      this.success.set(false);
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
        if (current.canApprove !== orig.canApprove || current.canReject !== orig.canReject) {
          return true;
        }
      }
    }
    return false;
  }

  saveAll() {
    if (!this.hasChanges()) {
      this.error.set("No changes to save");
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    const savePromises: Promise<any>[] = [];
    for (const [roleKey, template] of this.templates) {
      const original = this.originalTemplates.get(roleKey);
      const approvalTypes: Record<string, { canApprove: boolean; canReject: boolean }> = {};
      for (const approval of this.approvalTypes) {
        approvalTypes[approval.key] = template.approvalTypes[approval.key] || { canApprove: false, canReject: false };
      }

      if (original?.id) {
        savePromises.push(
          this.api.updateAccessTemplate(original.id, { approvalTypes }).toPromise()
        );
      } else {
        savePromises.push(
          this.api.createAccessTemplate({
            name: template.name || `${roleKey} Default`,
            role: roleKey,
            approvalTypes,
          }).toPromise()
        );
      }
    }

    Promise.all(savePromises)
      .then(() => {
        this.success.set(true);
        this.saving.set(false);
        this.originalTemplates.clear();
        for (const [roleKey, template] of this.templates) {
          this.originalTemplates.set(roleKey, JSON.parse(JSON.stringify(template)));
        }
        setTimeout(() => this.success.set(false), 3000);
      })
      .catch((err) => {
        this.error.set("Failed to save some templates");
        this.saving.set(false);
      });
  }
}