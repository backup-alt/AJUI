import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError } from "./errorHandler.js";
import { User, UserRole } from "../models/User.js";
import { Project } from "../models/Project.js";
import { Supervisor } from "../models/Supervisor.js";
import { ProjectScopeIds, uniqueObjectIds } from "../utils/scope.js";
import { withRetry } from "../utils/retry.js";

import { AccessTokenPayload } from "../utils/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      scopedQuery?: Record<string, unknown>;
      _cachedScopedProjectIds?: ProjectScopeIds;
    }
  }
}

// Process-level cache of non-admin users' managedProjectIds. Bypasses
// the User.findById call for 60 seconds after the first lookup, which
// eliminates the User collection query that was firing on every list
// request and consuming M0 connection-pool slots.
interface UserScopeEntry {
  managedProjectIds: string[];
  expiresAt: number;
}
const userScopeCache = new Map<string, UserScopeEntry>();

// Periodically prune expired entries to keep the map small under load.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of userScopeCache) {
    if (v.expiresAt <= now) userScopeCache.delete(k);
  }
}, 60_000).unref();

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

/**
 * Drop a single user's entry from the process-level scope cache. Call
 * this whenever `User.managedProjectIds` changes (admin re-assigning
 * projects to a PM, etc.) so the user sees their new scope on the very
 * next request instead of waiting for the 60s TTL to expire.
 */
export function invalidateAccessCache(userId: string): void {
  userScopeCache.delete(String(userId));
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

  const projectIds = await getScopedProjectIds(req);
  if (projectIds === null) {
    return {};
  }

  return { _id: { $in: projectIds } };
}

export async function getScopedProjectIds(req: Request): Promise<ProjectScopeIds> {
  if (req._cachedScopedProjectIds !== undefined) return req._cachedScopedProjectIds;
  if (!req.user?.sub) { req._cachedScopedProjectIds = null; return null; }

  const role = req.user.role;
  const userId = new Types.ObjectId(req.user.sub);

  // Admin short-circuit — don't even hit the DB, admins see everything.
  if (role === "admin") {
    req._cachedScopedProjectIds = null;
    return null;
  }

  // Process-level cache for the user lookup. The User document rarely
  // changes (managedProjectIds only update on role edits), so caching for
  // 60s eliminates ~99% of the User.findById calls that were burning
  // M0 connection pool slots on every listMaterials request.
  const now = Date.now();
  const cached = userScopeCache.get(req.user.sub);
  let user: { managedProjectIds?: Types.ObjectId[] } | null = null;
  if (cached && cached.expiresAt > now) {
    user = { managedProjectIds: cached.managedProjectIds.map((id) => new Types.ObjectId(id)) };
  } else {
    try {
      user = await withRetry(
        () => User.findById(userId).select("managedProjectIds").lean().maxTimeMS(2000),
        { label: "rbac.userLookup", maxAttempts: 1 }
      );
      if (user) {
        userScopeCache.set(req.user.sub, {
          managedProjectIds: (user.managedProjectIds || []).map((id) => String(id)),
          expiresAt: now + 60_000,
        });
      }
    } catch (err) {
      console.warn("[rbac] User lookup failed:", (err as Error).message);
    }
  }
  const managedProjectIds: Types.ObjectId[] = (user?.managedProjectIds || []).map(
    (id) => new Types.ObjectId(String(id))
  );

  // For PM/accountant, ALWAYS scope to their assigned projects.
  // Empty managedProjectIds means they see nothing (not everything).
  if (role === "project_manager" || role === "accountant") {
    const result = uniqueObjectIds(managedProjectIds);
    req._cachedScopedProjectIds = result;
    return req._cachedScopedProjectIds;
  }

  if (role === "supervisor") {
    let supervisor: { assignedProjects?: Types.ObjectId[]; assignedProjectId?: Types.ObjectId } | null = null;
    try {
      supervisor = await withRetry(
        () =>
          Supervisor.findOne({ userId })
            .select("assignedProjects assignedProjectId")
            .lean()
            .maxTimeMS(3000),
        { label: "rbac.supervisorLookup" }
      );
    } catch (err) {
      console.warn("[rbac] Supervisor lookup failed after retries:", (err as Error).message);
    }
    const supervisorProjectIds: Types.ObjectId[] = supervisor?.assignedProjects?.length
      ? supervisor.assignedProjects.map((id) => new Types.ObjectId(id.toString()))
      : supervisor?.assignedProjectId
        ? [new Types.ObjectId(supervisor.assignedProjectId.toString())]
        : [];
    const projectIds = [...supervisorProjectIds, ...managedProjectIds];
    const result = uniqueObjectIds(projectIds);
    req._cachedScopedProjectIds = result;
    return req._cachedScopedProjectIds;
  }

  req._cachedScopedProjectIds = null;
  return null;
}

export async function getScopedClientQuery(req: Request): Promise<Record<string, unknown>> {
  if (!req.user?.sub) return {};

  const projectIds = await getScopedProjectIds(req);
  if (projectIds === null) {
    return {};
  }

  const projects = await Project.find({ _id: { $in: projectIds } }).select("clientId").lean();
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
