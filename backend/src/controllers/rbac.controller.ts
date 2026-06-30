import { Request, Response, NextFunction } from "express";
import * as rbacService from "../services/rbac.service.js";
import { AppError } from "../middleware/errorHandler.js";

export async function getAllPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role !== "admin") throw new AppError(403, "Admin only");
    const permissions = await rbacService.getAllPermissions();
    res.json({ permissions });
  } catch (e) { next(e); }
}

export async function getPermissionsForRole(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role !== "admin") throw new AppError(403, "Admin only");
    const role = req.params.role as "admin" | "accountant" | "project_manager" | "supervisor";
    const permissions = await rbacService.getPermissionsForRole(role);
    res.json({ role, permissions });
  } catch (e) { next(e); }
}

export async function updatePermission(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role !== "admin") throw new AppError(403, "Admin only");
    const role = req.params.role as "admin" | "accountant" | "project_manager" | "supervisor";
    const module = req.params.module as
      | "clients" | "projects" | "sites" | "supervisors" | "materials" | "labour"
      | "expenses" | "payments" | "vendors" | "subcontractors" | "approvals"
      | "reports" | "users" | "dashboard" | "settings";

    const permission = await rbacService.updatePermission(
      role,
      module,
      req.body,
      req.user?.sub
    );
    res.json({ permission });
  } catch (e) { next(e); }
}

export async function resetPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role !== "admin") throw new AppError(403, "Admin only");
    const role = req.params.role as "admin" | "accountant" | "project_manager" | "supervisor";
    await rbacService.resetPermissionsToDefaults(role);
    const permissions = await rbacService.getPermissionsForRole(role);
    res.json({ role, permissions, message: "Reset to defaults" });
  } catch (e) { next(e); }
}

export async function getDefaults(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      defaults: rbacService.getDefaultPermission("admin"),
      // We expose all four roles' defaults for the admin UI
      accountant: rbacService.getDefaultPermission("accountant"),
      project_manager: rbacService.getDefaultPermission("project_manager"),
      supervisor: rbacService.getDefaultPermission("supervisor"),
    });
  } catch (e) { next(e); }
}

export async function getMyPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.sub || !req.user.role) throw new AppError(401, "Not authenticated");
    const permissions = await rbacService.getEffectivePermissions(
      req.user.role as "admin" | "accountant" | "project_manager" | "supervisor"
    );
    const result: Record<string, { scope: string; fields: Record<string, string> }> = {};
    for (const [module, config] of permissions.entries()) {
      result[module] = config;
    }
    res.json({ role: req.user.role, permissions: result });
  } catch (e) { next(e); }
}
