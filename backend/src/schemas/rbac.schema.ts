import { z } from "zod";

export const permissionLevelSchema = z.enum(["hidden", "read", "write", "edit"]);
export const permissionScopeSchema = z.enum(["all", "own", "assigned"]);
export const managedRoleSchema = z.enum(["admin", "accountant", "project_manager", "supervisor"]);

export const moduleKeys = [
  "clients", "projects", "sites", "supervisors",
  "materials", "labour", "expenses", "payments",
  "vendors", "subcontractors", "approvals", "reports",
  "users", "dashboard", "settings",
] as const;

export const moduleKeySchema = z.enum(moduleKeys);

export const updatePermissionSchema = z.object({
  body: z.object({
    scope: permissionScopeSchema.optional(),
    fieldPermissions: z.record(permissionLevelSchema).optional(),
  }),
  params: z.object({
    role: managedRoleSchema,
    module: moduleKeySchema,
  }),
});

export const getPermissionsSchema = z.object({
  params: z.object({
    role: managedRoleSchema.optional(),
  }),
});

export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>["body"];
