import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError } from "./errorHandler";
import { User, UserRole } from "../models/User";
import { Project } from "../models/Project";
import { Supervisor } from "../models/Supervisor";

import { AccessTokenPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      scopedQuery?: Record<string, unknown>;
    }
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.sub) throw new AppError(401, "Not authenticated");
      if (!allowedRoles.includes(req.user.role as UserRole)) {
        throw new AppError(403, `Access denied. Required role: ${allowedRoles.join(" or ")}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.sub) {
    next(new AppError(401, "Not authenticated"));
    return;
  }
  if (req.user.role !== "admin") {
    next(new AppError(403, "Admin access required"));
    return;
  }
  next();
}

export function applyScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.sub) {
    next();
    return;
  }

  const role = req.user.role;
  const userId = new Types.ObjectId(req.user.sub);

  // Admins see everything
  if (role === "admin") {
    req.scopedQuery = {};
    next();
    return;
  }

  // For non-admins, attach scope filter
  // Default scope is restrictive; specific routes can refine this
  req.scopedQuery = { _scope: { role, userId: req.user.sub } } as Record<string, unknown>;
  next();
}

export async function getScopedProjectQuery(req: Request): Promise<Record<string, unknown>> {
  if (!req.user?.sub) return {};
  const role = req.user.role;

  if (role === "admin" || role === "accountant") {
    return {};
  }

  const userId = new Types.ObjectId(req.user.sub);

  if (role === "supervisor") {
    const supervisor = await Supervisor.findOne({ userId }).lean();
    const projectIds = supervisor?.assignedProjectId
      ? [supervisor.assignedProjectId]
      : [];
    const user = await User.findById(userId).lean();
    if (user?.managedProjectIds?.length) {
      projectIds.push(...user.managedProjectIds);
    }
    const uniqueProjectIds = [...new Set(projectIds.map((id) => id.toString()))].map(
      (id) => new Types.ObjectId(id)
    );
    return { _id: { $in: uniqueProjectIds } };
  }

  if (role === "project_manager") {
    const user = await User.findById(userId).lean();
    const projectIds = (user?.managedProjectIds || []).map((id) => new Types.ObjectId(id));
    return { _id: { $in: projectIds } };
  }

  return {};
}

export async function getScopedClientQuery(req: Request): Promise<Record<string, unknown>> {
  if (!req.user?.sub) return {};
  const role = req.user.role;

  if (role === "admin" || role === "accountant") {
    return {};
  }

  // For PM/Supervisor: clients of projects they have access to
  const projectQuery = await getScopedProjectQuery(req);
  if (Object.keys(projectQuery).length === 0) return {};
  const projects = await Project.find(projectQuery).select("clientId").lean();
  const clientIds = [...new Set(projects.map((p) => p.clientId?.toString()).filter(Boolean))].map(
    (id) => new Types.ObjectId(id!)
  );
  return { _id: { $in: clientIds } };
}

export function filterProjectsForUser<T extends { _id: Types.ObjectId | string }>(
  projects: T[],
  userRole: string,
  userId: string
): T[] {
  if (userRole === "admin" || userRole === "accountant") return projects;
  // For PM/Supervisor, scope is already applied via the query
  return projects;
}

export function canViewFinancials(role: string): boolean {
  return role === "admin" || role === "accountant";
}

export function canEditFinancials(role: string): boolean {
  return role === "admin" || role === "accountant";
}

export function canApproveItems(role: string): boolean {
  return role === "admin" || role === "accountant" || role === "project_manager";
}

export function canManageProjects(role: string): boolean {
  return role === "admin" || role === "project_manager";
}

export function canCreateMaterials(role: string): boolean {
  return role === "admin" || role === "project_manager" || role === "supervisor";
}

export function canCreateLabour(role: string): boolean {
  return role === "admin" || role === "project_manager" || role === "supervisor";
}

export function canCreateExpenses(role: string): boolean {
  return role === "admin" || role === "accountant" || role === "supervisor";
}

export function canCreatePayments(role: string): boolean {
  return role === "admin" || role === "accountant";
}

export function canCreateVendors(role: string): boolean {
  return role === "admin" || role === "project_manager";
}

export function canCreateSubcontractors(role: string): boolean {
  return role === "admin" || role === "project_manager";
}

export function canManageUsers(role: string): boolean {
  return role === "admin";
}

export function canManageSettings(role: string): boolean {
  return role === "admin";
}

export function canViewReports(role: string): boolean {
  if (role === "admin" || role === "accountant" || role === "project_manager") return true;
  return false; // Supervisors limited
}

export function canViewUniversalDashboard(role: string): boolean {
  return role === "admin" || role === "accountant" || role === "project_manager";
}
