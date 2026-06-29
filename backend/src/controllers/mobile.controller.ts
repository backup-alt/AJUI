import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import * as mobileService from "../services/supervisor-mobile.service";
import * as deviceService from "../services/device-token.service";

function requireSupervisor(req: Request): string {
  if (!req.user?.sub) throw new AppError(401, "Not authenticated");
  if (req.user.role !== "supervisor") {
    throw new AppError(403, "Supervisor access required");
  }
  return req.user.sub;
}

// =================== PROFILE ===================
export async function getOwnProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const profile = await mobileService.getSupervisorByUserId(userId);
    res.json(profile);
  } catch (e) { next(e); }
}

export async function updateOwnProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const profile = await mobileService.updateSupervisorProfile(userId, req.body);
    res.json(profile);
  } catch (e) { next(e); }
}

// =================== DASHBOARD ===================
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const dashboard = await mobileService.getSupervisorDashboard(userId);
    res.json({ dashboard });
  } catch (e) { next(e); }
}

// =================== PROJECTS ===================
export async function getAssignedProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const projects = await mobileService.getAssignedProjects(userId);
    res.json({ projects });
  } catch (e) { next(e); }
}

export async function getAssignedProjectsDetailed(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const projects = await mobileService.getSupervisorProjectsDetailed(userId);
    res.json({ projects });
  } catch (e) { next(e); }
}

export async function getProjectDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const project = await mobileService.getSupervisorProjectDetail(userId, req.params.projectId);
    res.json({ project });
  } catch (e) { next(e); }
}

export async function getProjectApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const approvals = await mobileService.getSupervisorProjectApprovals(userId, req.params.projectId);
    res.json({ approvals });
  } catch (e) { next(e); }
}

// =================== SITES ===================
export async function getAssignedSites(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const sites = await mobileService.getAssignedSites(userId);
    res.json({ sites });
  } catch (e) { next(e); }
}

// =================== APPROVALS ===================
export async function getActionableApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const approvals = await mobileService.getActionableApprovals(userId);
    res.json({ approvals });
  } catch (e) { next(e); }
}

// =================== DEVICE TOKENS ===================
export async function registerDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const device = await deviceService.registerDeviceToken({
      userId,
      fcmToken: req.body.fcmToken,
      platform: req.body.platform,
      deviceId: req.body.deviceId,
      appVersion: req.body.appVersion,
    });
    res.status(201).json({ device });
  } catch (e) { next(e); }
}

export async function unregisterDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const result = await deviceService.unregisterDeviceToken(userId, req.body.fcmToken);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getMyDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const devices = await deviceService.getUserDevices(userId);
    res.json({ devices });
  } catch (e) { next(e); }
}
