import { Schema, model, Document, Types } from "mongoose";

export type ManagedRole = "admin" | "accountant" | "project_manager" | "supervisor";
export type PermissionLevel = "hidden" | "read" | "write" | "edit";
export type PermissionScope = "all" | "own" | "assigned";

export type ModuleKey =
  | "clients"
  | "projects"
  | "sites"
  | "supervisors"
  | "materials"
  | "labour"
  | "expenses"
  | "payments"
  | "vendors"
  | "subcontractors"
  | "approvals"
  | "reports"
  | "users"
  | "dashboard"
  | "settings";

export type FieldKey =
  | `${ModuleKey}.${string}`;

export interface IRolePermission extends Document {
  _id: Types.ObjectId;
  role: ManagedRole;
  module: ModuleKey;
  scope: PermissionScope;
  fieldPermissions: Record<string, PermissionLevel>;
  updatedBy?: Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

const rolePermissionSchema = new Schema<IRolePermission>(
  {
    role: {
      type: String,
      enum: ["admin", "accountant", "project_manager", "supervisor"],
      required: true,
      index: true,
    },
    module: { type: String, required: true, index: true },
    scope: { type: String, enum: ["all", "own", "assigned"], default: "all" },
    fieldPermissions: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

rolePermissionSchema.index({ role: 1, module: 1 }, { unique: true });

export const RolePermission = model<IRolePermission>("RolePermission", rolePermissionSchema);

export const DEFAULT_PERMISSIONS: Record<ManagedRole, { scope: PermissionScope; fields: Record<string, PermissionLevel> }> = {
  admin: {
    scope: "all",
    fields: {},
  },
  accountant: {
    scope: "all",
    fields: {
      "clients.read": "read",
      "projects.read": "read",
      "expenses.write": "write",
      "expenses.read": "read",
      "generalExpenses.write": "write",
      "generalExpenses.read": "read",
      "payments.write": "write",
      "payments.read": "read",
      "reports.read": "read",
      "reports.write": "write",
      "labour.read": "read",
      "materials.read": "read",
      "vendors.read": "read",
      "approvals.read": "read",
      "approvals.approve": "write",
      "dashboard.read": "read",
      "settings.hidden": "hidden",
    },
  },
  project_manager: {
    scope: "own",
    fields: {
      "clients.read": "read",
      "clients.write": "write",
      "projects.read": "read",
      "projects.write": "write",
      "projects.edit": "edit",
      "sites.read": "read",
      "sites.write": "write",
      "supervisors.read": "read",
      "supervisors.write": "write",
      "materials.read": "read",
      "materials.approve": "write",
      "labour.read": "read",
      "labour.approve": "write",
      "expenses.read": "read",
      "expenses.approve": "write",
      "payments.read": "read",
      "vendors.read": "read",
      "vendors.write": "write",
      "subcontractors.read": "read",
      "subcontractors.write": "write",
      "subcontractors.approve": "write",
      "approvals.read": "read",
      "approvals.approve": "write",
      "reports.read": "read",
      "dashboard.read": "read",
      "users.read": "read",
      "settings.hidden": "hidden",
    },
  },
  supervisor: {
    scope: "assigned",
    fields: {
      "clients.read": "read",
      "projects.read": "read",
      "sites.read": "read",
      "materials.read": "read",
      "materials.write": "write",
      "labour.read": "read",
      "labour.write": "write",
      "expenses.read": "read",
      "expenses.write": "write",
      "payments.read": "read",
      "vendors.read": "read",
      "subcontractors.read": "read",
      "approvals.read": "read",
      "dashboard.read": "read",
      "settings.hidden": "hidden",
      "users.hidden": "hidden",
    },
  },
};

export async function ensureDefaultPermissions(): Promise<void> {
  const modules: ModuleKey[] = [
    "clients",
    "projects",
    "sites",
    "supervisors",
    "materials",
    "labour",
    "expenses",
    "payments",
    "vendors",
    "subcontractors",
    "approvals",
    "reports",
    "users",
    "dashboard",
    "settings",
  ];

  for (const [role, config] of Object.entries(DEFAULT_PERMISSIONS) as [ManagedRole, typeof DEFAULT_PERMISSIONS.admin][]) {
    for (const module of modules) {
      const moduleFields = Object.entries(config.fields)
        .filter(([key]) => key.startsWith(`${module}.`))
        .reduce<Record<string, PermissionLevel>>((acc, [key, value]) => {
          const field = key.split(".").slice(1).join(".");
          acc[field] = value;
          return acc;
        }, {});

      // Use updateOne with upsert; safe to re-run
      await RolePermission.updateOne(
        { role, module },
        {
          $set: { scope: config.scope, fieldPermissions: moduleFields },
          $setOnInsert: { role, module },
        },
        { upsert: true }
      );
    }
  }
}
