import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError } from "../middleware/errorHandler.js";
import * as mobileService from "../services/supervisor-mobile.service.js";
import * as vendorService from "../services/vendor.service.js";
import * as deviceService from "../services/device-token.service.js";

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
    const approvals = await mobileService.getActionableApprovals(userId, "all");
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

// =================== MATERIALS (mobile) ===================
export async function listMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const result = await mobileService.listMaterialsForSupervisor(userId, {
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const material = await mobileService.getMaterialDetailForSupervisor(userId, req.params.id);
    res.json({ material });
  } catch (e) { next(e); }
}

export async function createMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const { Project } = await import("../models/Project.js");
    const { Site } = await import("../models/Site.js");
    const { generateId } = await import("../services/id-generator.service.js");
    const { Approval } = await import("../models/Approval.js");
    const { User } = await import("../models/User.js");

    await mobileService.ensureSupervisorSiteAccess(userId, req.body.projectId, req.body.siteId);

    const project = await Project.findById(req.body.projectId).lean();
    if (!project) throw new AppError(404, "Project not found");

    const supervisor = await User.findById(userId).select("name").lean();
    const supervisorName = supervisor?.name || "";

    let siteName = req.body.site;
    if (req.body.siteId) {
      const site = await Site.findById(req.body.siteId).lean();
      if (site) siteName = site.name;
    }

    const materialId = await generateId("MAT");
    const initialStock =
      typeof req.body.remainingStock === "number" ? req.body.remainingStock : 0;
    const requestDate = req.body.requestDate || new Date().toISOString().slice(0, 10);
    const material = await (await import("../models/Material.js")).Material.create({
      ...req.body,
      materialId,
      projectName: project.name,
      clientId: project.clientId,
      clientName: project.client,
      site: siteName,
      purchasedQuantity: initialStock,
      consumedQuantity: 0,
      status: "Pending",
      createdBy: userId,
      supervisorName,
      requestDate,
    });

    await Approval.create({
      approvalId: await generateId("APR"),
      type: "material",
      title: `Material: ${material.name}`,
      projectId: material.projectId,
      projectName: material.projectName,
      site: material.site,
      amount: material.requestedQuantity,
      detail: `${material.requestedQuantity} ${material.unit} requested`,
      sourceCollection: "Material",
      sourceId: material._id,
      status: "Pending",
      owner: userId,
    });

    res.status(201).json({ material });
  } catch (e) { next(e); }
}

export async function updateMaterialStock(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const { purchasedQuantity, consumedQuantity } = req.body;
    const material = await mobileService.updateMaterialStockForSupervisor(
      userId,
      req.params.id,
      { purchasedQuantity, consumedQuantity }
    );
    res.json({ material });
  } catch (e) { next(e); }
}

// =================== LABOUR (mobile) ===================
export async function listLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const result = await mobileService.listLabourForSupervisor(userId, {
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const labour = await mobileService.getLabourDetailForSupervisor(userId, req.params.id);
    res.json({ labour });
  } catch (e) { next(e); }
}

export async function createLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const { Project } = await import("../models/Project.js");
    const { Site } = await import("../models/Site.js");
    const { generateId } = await import("../services/id-generator.service.js");
    const { Approval } = await import("../models/Approval.js");
    const { Labour } = await import("../models/Labour.js");

    await mobileService.ensureSupervisorSiteAccess(userId, req.body.projectId, req.body.siteId);

    const project = await Project.findById(req.body.projectId).lean();
    if (!project) throw new AppError(404, "Project not found");

    let siteName = req.body.site;
    if (req.body.siteId) {
      const site = await Site.findById(req.body.siteId).lean();
      if (site) siteName = site.name;
    }

    // Once-per-day-per-(site, partyName) guard. If a labour entry already exists
    // for the same site + party + attendanceDate, reject the duplicate.
    const attendanceDate = String(req.body.attendanceDate || "").slice(0, 10);
    const partyName = String(req.body.partyName || "").trim();
    if (req.body.siteId && partyName && attendanceDate) {
      const existing = await Labour.findOne({
        siteId: req.body.siteId,
        partyName,
        attendanceDate,
      }).lean();
      if (existing) {
        throw new AppError(
          409,
          `Attendance for "${partyName}" on ${attendanceDate} has already been submitted.`
        );
      }
    }

    const totalAmount = (req.body.dailyWage || 0) * (req.body.presentCount || 0);
    const labourId = await generateId("LAB");
    const labour = await Labour.create({
      ...req.body,
      labourId,
      projectName: project.name,
      clientId: project.clientId,
      clientName: project.client,
      site: siteName,
      totalAmount,
      status: "Pending",
      submittedBy: userId,
    });

    await Approval.create({
      approvalId: await generateId("APR"),
      type: "labour",
      title: `Labour: ${labour.partyName} (${labour.presentCount} workers)`,
      projectId: labour.projectId,
      projectName: labour.projectName,
      site: labour.site,
      amount: totalAmount,
      detail: `${req.body.category || "Labour"} - ${labour.partyName}`,
      sourceCollection: "Labour",
      sourceId: labour._id,
      status: "Pending",
      owner: userId,
    });

    res.status(201).json({ labour });
  } catch (e) { next(e); }
}

// =================== EXPENSES (mobile) ===================
export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const result = await mobileService.listExpensesForSupervisor(userId, {
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const expense = await mobileService.getExpenseDetailForSupervisor(userId, req.params.id);
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const { Project } = await import("../models/Project.js");
    const { Site } = await import("../models/Site.js");
    const { generateId } = await import("../services/id-generator.service.js");
    const { Approval } = await import("../models/Approval.js");
    const { Expense } = await import("../models/Expense.js");

    await mobileService.ensureSupervisorSiteAccess(userId, req.body.projectId, req.body.siteId);

    let projectName: string | undefined;
    let clientId: Types.ObjectId | undefined;
    let clientName: string | undefined;
    if (req.body.projectId) {
      const project = await Project.findById(req.body.projectId).lean();
      if (!project) throw new AppError(404, "Project not found");
      projectName = project.name;
      clientId = project.clientId;
      clientName = project.client;
    }

    let siteName = req.body.site;
    if (req.body.siteId) {
      const site = await Site.findById(req.body.siteId).lean();
      if (site) siteName = site.name;
    }

    const expenseId = await generateId("EXP");
    const expense = await Expense.create({
      ...req.body,
      expenseId,
      projectName,
      clientId,
      clientName,
      site: siteName,
      status: "Pending",
      submittedBy: userId,
    });

    if (req.body.type === "site" || req.body.transactionType === "Cash Added") {
      await Approval.create({
        approvalId: await generateId("APR"),
        type: "expense",
        title: `Site Expense: ${expense.description}`,
        projectId: expense.projectId,
        projectName: expense.projectName,
        site: expense.site,
        amount: expense.amount,
        detail: `${expense.transactionType || "Expense"} - ${expense.description}`,
        sourceCollection: "Expense",
        sourceId: expense._id,
        status: "Pending",
        owner: userId,
      });
    }

    res.status(201).json({ expense });
  } catch (e) { next(e); }
}

// =================== VENDORS (mobile) ===================
export async function listVendorsForSupervisor(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    // Supervisors can view all vendors (no project scoping needed)
    const result = await vendorService.listVendors({
      materialType: req.query.materialType as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    });
    res.json(result);
  } catch (e) { next(e); }
}

// =================== APPROVALS (mobile) ===================
export async function getApprovalDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const approval = await mobileService.getApprovalDetailForSupervisor(userId, req.params.id);
    res.json({ approval });
  } catch (e) { next(e); }
}

export async function takeApprovalAction(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const { action, comment } = req.body;
    if (!action || !["approve", "reject"].includes(action)) {
      throw new AppError(400, "Invalid action. Must be 'approve' or 'reject'");
    }
    const approval = await mobileService.takeApprovalActionForSupervisor(userId, req.params.id, {
      action,
      comment,
    });
    res.json({ approval });
  } catch (e) { next(e); }
}
