import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ErpDataService, managedRoleNames, type ManagedRole, type RolePermissionLevel } from "../../data/erp-data.service";
import type { SharedModuleKey } from "../../data/erp-data.service";

type PermissionModuleKey = Exclude<SharedModuleKey, "settings">;
type PermissionField = { key: string; label: string };
type PermissionGroup = { key: PermissionModuleKey; label: string; fields: PermissionField[] };

const permissionLevels: Array<{ key: RolePermissionLevel; label: string; note: string }> = [
  { key: "hidden", label: "Hidden", note: "Cannot view" },
  { key: "read", label: "Read", note: "View only" },
  { key: "write", label: "Write", note: "Add records" },
  { key: "edit", label: "Edit", note: "Full changes" },
];

const permissionGroups: PermissionGroup[] = [
  { key: "clients", label: "Clients", fields: [
    { key: "clientId", label: "Client ID" }, { key: "clientName", label: "Client Name" },
    { key: "mobile", label: "Mobile" }, { key: "address", label: "Address" },
    { key: "projectCount", label: "Project Count" }, { key: "activeSites", label: "Active Sites" },
    { key: "totalProjectValue", label: "Total Value" }, { key: "amountReceived", label: "Received" },
    { key: "pendingBalance", label: "Pending" }, { key: "supervisor", label: "Supervisor" },
    { key: "status", label: "Status" },
  ]},
  { key: "materials", label: "Materials", fields: [
    { key: "project", label: "Project" }, { key: "site", label: "Site" },
    { key: "materialName", label: "Material Name" }, { key: "unit", label: "Unit" },
    { key: "requestedQuantity", label: "Requested" }, { key: "approvedQuantity", label: "Approved" },
    { key: "vendor", label: "Vendor" }, { key: "poNumber", label: "PO Number" },
    { key: "remainingStock", label: "Remaining Stock" }, { key: "status", label: "Status" },
  ]},
  { key: "labour", label: "Labour", fields: [
    { key: "client", label: "Client" }, { key: "project", label: "Project" },
    { key: "site", label: "Site" }, { key: "attendanceDate", label: "Date" },
    { key: "staffName", label: "Staff Name" }, { key: "labourTypes", label: "Labour Types" },
    { key: "staffCount", label: "Staff Count" }, { key: "attendance", label: "Attendance" },
    { key: "shift", label: "Shift" }, { key: "weeklyPayTotal", label: "Weekly Pay" },
    { key: "status", label: "Status" },
  ]},
  { key: "expenses", label: "Site Expenses", fields: [
    { key: "client", label: "Client" }, { key: "project", label: "Project" },
    { key: "site", label: "Site" }, { key: "expenseDate", label: "Date" },
    { key: "transactionType", label: "Type" }, { key: "description", label: "Description" },
    { key: "amount", label: "Amount" }, { key: "siteMaterial", label: "Site Material" },
    { key: "runningBalance", label: "Balance" }, { key: "supervisor", label: "Supervisor" },
    { key: "reference", label: "Reference" }, { key: "approvalStatus", label: "Status" },
  ]},
  { key: "payments", label: "Payments", fields: [
    { key: "client", label: "Client" }, { key: "project", label: "Project" },
    { key: "paymentDate", label: "Date" }, { key: "amount", label: "Amount" },
    { key: "mode", label: "Mode" }, { key: "transactionReference", label: "Transaction Ref" },
    { key: "receiptNumber", label: "Receipt" }, { key: "collectedBy", label: "Collected By" },
    { key: "approvalStatus", label: "Status" },
  ]},
  { key: "vendors", label: "Vendors", fields: [
    { key: "vendorId", label: "Vendor ID" }, { key: "vendorName", label: "Vendor Name" },
    { key: "materialType", label: "Material Type" }, { key: "materialsBought", label: "Materials Bought" },
    { key: "phoneNumber", label: "Phone" }, { key: "address", label: "Address" },
    { key: "gstNumber", label: "GST" },
  ]},
  { key: "supervisors", label: "Supervisors", fields: [
    { key: "supervisorId", label: "Supervisor ID" }, { key: "supervisorName", label: "Name" },
    { key: "phoneNumber", label: "Phone" }, { key: "role", label: "Role" },
    { key: "assignedProject", label: "Project" }, { key: "assignedSite", label: "Site" },
    { key: "cashLimits", label: "Cash Limit" }, { key: "activeAdvances", label: "Active Advances" },
    { key: "approvalAuthority", label: "Approval Authority" }, { key: "status", label: "Status" },
  ]},
  { key: "subcontractors", label: "Subcontracts", fields: [
    { key: "subcontractId", label: "Subcontract ID" }, { key: "client", label: "Client" },
    { key: "project", label: "Project" },
  ]},
  { key: "reports", label: "Reports", fields: [
    { key: "category", label: "Category" }, { key: "reportName", label: "Report Name" },
    { key: "scope", label: "Scope" }, { key: "owner", label: "Owner" },
    { key: "exportFormat", label: "Format" },
  ]},
];

@Component({
  selector: "agb-settings-approvals",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="settings-w11-header">
      <nav class="settings-w11-breadcrumb" aria-label="Breadcrumb">
        <span>Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Approval Rules</strong>
      </nav>
      <h1>Approval Rules</h1>
      <p>Decide which fields each role can read, write, or edit. Admin always has full access.</p>
    </header>

    <section class="settings-w11-card">
      <div class="settings-w11-tabs" role="tablist">
        @for (role of roles; track role) {
          <button type="button" role="tab" [class.active]="activeRole() === role" (click)="selectRole(role)">
            {{ role }}
          </button>
        }
      </div>

      <div class="settings-w11-approval-grid">
        <aside class="settings-w11-approval-side">
          <div class="settings-w11-approval-role-card">
            <span>Current Role</span>
            <h3>{{ activeRole() }}</h3>
            <p>{{ roleHelpText(activeRole()) }}</p>
          </div>

          <div class="settings-w11-approval-legend">
            <div class="settings-w11-legend-item">
              <strong>Hidden</strong>
              <small>Cannot view</small>
            </div>
            <div class="settings-w11-legend-item">
              <strong>Read</strong>
              <small>View only</small>
            </div>
            <div class="settings-w11-legend-item">
              <strong>Write</strong>
              <small>Add records</small>
            </div>
            <div class="settings-w11-legend-item">
              <strong>Edit</strong>
              <small>Full changes</small>
            </div>
          </div>
        </aside>

        <div class="settings-w11-approval-main">
          <div class="settings-w11-approval-head">
            <strong>Field Access</strong>
            <span>Changes save automatically for {{ activeRole() }}.</span>
          </div>
          @for (group of permissionGroups(); track group.key) {
            <div class="settings-w11-approval-group">
              <h4>{{ group.label }}</h4>
              @for (field of group.fields; track field.key) {
                <div class="settings-w11-approval-row">
                  <div class="settings-w11-approval-field">
                    <strong>{{ field.label }}</strong>
                    <small>{{ group.key }}.{{ field.key }}</small>
                  </div>
                  <div class="settings-w11-approval-levels" role="radiogroup">
                    @for (level of permissionLevels; track level.key) {
                      <label class="settings-w11-level-chip" [class.active]="permissionValue(group.key, field.key) === level.key">
                        <input
                          type="radio"
                          [name]="permissionId(group.key, field.key) + '-' + activeRole()"
                          [checked]="permissionValue(group.key, field.key) === level.key"
                          (change)="setPermission(group.key, field.key, level.key)"
                        />
                        <span>{{ level.label }}</span>
                      </label>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </section>

    <section class="settings-w11-card">
      <div class="settings-w11-card-head">
        <div>
          <h2>Approval Flow Controls</h2>
          <p>Tune how the approval queue behaves.</p>
        </div>
      </div>
      <div class="settings-w11-card-body">
        <div class="settings-w11-check-row">
          <div>
            <strong>Expense review queue</strong>
            <small>Site and general expenses appear in Pending Approvals.</small>
          </div>
          <span class="settings-w11-check-mark" aria-hidden="true">
            <svg viewBox="0 0 20 20"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
        <div class="settings-w11-check-row">
          <div>
            <strong>Payment verification</strong>
            <small>Collections require accountant confirmation.</small>
          </div>
          <span class="settings-w11-check-mark" aria-hidden="true">
            <svg viewBox="0 0 20 20"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
        <div class="settings-w11-check-row">
          <div>
            <strong>Material quantity approval</strong>
            <small>Project managers enter approved quantity before approval.</small>
          </div>
          <span class="settings-w11-check-mark" aria-hidden="true">
            <svg viewBox="0 0 20 20"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
        <label class="settings-w11-toggle-row">
          <div>
            <strong>Single approve for Site Expense and Materials</strong>
            <small>When a site expense creates a material row, approving either linked item clears the pair.</small>
          </div>
          <input type="checkbox" [checked]="data.settings().singleApprovalForSiteExpenseMaterials" (change)="updateSingleApproval($any($event.target).checked)" />
        </label>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsApprovalsComponent {
  readonly data = inject(ErpDataService);
  readonly roles = managedRoleNames;
  readonly permissionLevels = permissionLevels;
  readonly activeRole = signal<ManagedRole>("Project Manager");

  selectRole(role: ManagedRole) {
    this.activeRole.set(role);
  }

  permissionGroups(): PermissionGroup[] {
    return permissionGroups;
  }

  permissionId(module: PermissionModuleKey, field: string): string {
    return `${module}.${field}`;
  }

  permissionValue(module: PermissionModuleKey, field: string): RolePermissionLevel {
    return this.data.rolePermission(this.activeRole(), this.permissionId(module, field));
  }

  setPermission(module: PermissionModuleKey, field: string, level: RolePermissionLevel) {
    this.data.setRolePermission(this.activeRole(), this.permissionId(module, field), level);
  }

  updateSingleApproval(enabled: boolean) {
    this.data.updateSettings({ singleApprovalForSiteExpenseMaterials: enabled });
  }

  roleHelpText(role: ManagedRole): string {
    if (role === "Project Manager") return "Project managers usually review approvals, project progress, site records, and subcontract work.";
    if (role === "Accountant") return "Accountants usually manage payment collections, ledgers, expenses, exports, and verification.";
    return "Supervisors usually enter field-level material, labour, attendance, and site expense records.";
  }
}
