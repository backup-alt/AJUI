import { Types } from "mongoose";
import {
  RolePermission,
  ManagedRole,
  ModuleKey,
  PermissionLevel,
  PermissionScope,
  IRolePermission,
  DEFAULT_PERMISSIONS,
} from "../models/RolePermission.js";
import { AppError } from "../middleware/errorHandler.js";

export async function getAllPermissions(): Promise<IRolePermission[]> {
  return RolePermission.find().sort({ role: 1, module: 1 }).lean() as unknown as Promise<IRolePermission[]>;
}

export async function getPermissionsForRole(role: ManagedRole): Promise<IRolePermission[]> {
  return RolePermission.find({ role }).sort({ module: 1 }).lean() as unknown as Promise<IRolePermission[]>;
}

export async function getPermissionsForRoleModule(
  role: ManagedRole,
  module: ModuleKey
): Promise<IRolePermission | null> {
  return RolePermission.findOne({ role, module }).lean() as unknown as Promise<IRolePermission | null>;
}

export async function getEffectivePermissions(role: ManagedRole): Promise<Map<ModuleKey, {
  scope: PermissionScope;
  fields: Record<string, PermissionLevel>;
}>> {
  const stored = await RolePermission.find({ role }).lean();
  const map = new Map<ModuleKey, { scope: PermissionScope; fields: Record<string, PermissionLevel> }>();

  // Start with defaults
  const defaults = DEFAULT_PERMISSIONS[role];
  const allModules: ModuleKey[] = [
    "clients", "projects", "sites", "supervisors", "materials", "labour",
    "expenses", "payments", "vendors", "subcontractors", "approvals", "reports",
    "users", "dashboard", "settings",
  ];
  for (const module of allModules) {
    const moduleFields = Object.entries(defaults.fields)
      .filter(([key]) => key.startsWith(`${module}.`))
      .reduce<Record<string, PermissionLevel>>((acc, [key, value]) => {
        const field = key.split(".").slice(1).join(".");
        acc[field] = value;
        return acc;
      }, {});
    map.set(module, { scope: defaults.scope, fields: moduleFields });
  }

  // Override with stored
  for (const p of stored) {
    map.set(p.module as ModuleKey, {
      scope: p.scope,
      fields: p.fieldPermissions || {},
    });
  }

  return map;
}

export async function updatePermission(
  role: ManagedRole,
  module: ModuleKey,
  patch: {
    scope?: PermissionScope;
    fieldPermissions?: Record<string, PermissionLevel>;
  },
  updatedBy?: string
): Promise<IRolePermission> {
  const update: Record<string, unknown> = {};
  if (patch.scope) update.scope = patch.scope;
  if (patch.fieldPermissions) update.fieldPermissions = patch.fieldPermissions;
  if (updatedBy) update.updatedBy = new Types.ObjectId(updatedBy);

  const permission = await RolePermission.findOneAndUpdate(
    { role, module },
    { $set: update, $setOnInsert: { role, module } },
    { upsert: true, new: true }
  );
  return permission.toObject();
}

export async function resetPermissionsToDefaults(role: ManagedRole): Promise<void> {
  await RolePermission.deleteMany({ role });

  const defaults = DEFAULT_PERMISSIONS[role];
  const modules: ModuleKey[] = [
    "clients", "projects", "sites", "supervisors", "materials", "labour",
    "expenses", "payments", "vendors", "subcontractors", "approvals", "reports",
    "users", "dashboard", "settings",
  ];

  for (const module of modules) {
    const moduleFields = Object.entries(defaults.fields)
      .filter(([key]) => key.startsWith(`${module}.`))
      .reduce<Record<string, PermissionLevel>>((acc, [key, value]) => {
        const field = key.split(".").slice(1).join(".");
        acc[field] = value;
        return acc;
      }, {});
    if (Object.keys(moduleFields).length > 0 || defaults.scope !== "all") {
      await RolePermission.create({ role, module, scope: defaults.scope, fieldPermissions: moduleFields });
    }
  }
}

export async function checkPermission(
  role: ManagedRole,
  module: ModuleKey,
  field: string,
  requiredLevel: PermissionLevel = "read"
): Promise<boolean> {
  if (role === "admin") return true;

  const perms = await getEffectivePermissions(role);
  const modulePerms = perms.get(module);
  if (!modulePerms) return false;

  const fieldLevel = modulePerms.fields[field] || modulePerms.fields["*"];
  if (!fieldLevel || fieldLevel === "hidden") return false;

  const levelOrder: Record<PermissionLevel, number> = { hidden: 0, read: 1, write: 2, edit: 3 };
  return levelOrder[fieldLevel] >= levelOrder[requiredLevel];
}

export async function filterFieldsByPermission<T extends Record<string, unknown>>(
  role: ManagedRole,
  module: ModuleKey,
  data: T
): Promise<Partial<T>> {
  if (role === "admin") return data;

  const perms = await getEffectivePermissions(role);
  const modulePerms = perms.get(module);
  if (!modulePerms) return {};

  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(data)) {
    const fieldLevel = modulePerms.fields[key];
    if (fieldLevel && fieldLevel !== "hidden") {
      (filtered as Record<string, unknown>)[key] = value;
    }
  }
  return filtered;
}

export function canApprove(role: ManagedRole): boolean {
  return role === "admin" || role === "project_manager" || role === "accountant";
}

export function canManageUsers(role: ManagedRole): boolean {
  return role === "admin";
}

export function canManageSettings(role: ManagedRole): boolean {
  return role === "admin";
}

export function canGenerateReports(role: ManagedRole): boolean {
  return role !== "supervisor";
}

export function getDefaultPermission(role: ManagedRole) {
  return DEFAULT_PERMISSIONS[role];
}
