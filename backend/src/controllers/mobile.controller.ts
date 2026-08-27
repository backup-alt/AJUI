import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError } from "../middleware/errorHandler.js";
import { invalidateCachePrefix } from "../middleware/cache.js";
import * as mobileService from "../services/supervisor-mobile.service.js";
import * as workerService from "../services/worker.service.js";
import * as vendorService from "../services/vendor.service.js";
import * as subcontractorService from "../services/subcontractor.service.js";
import * as subcontractorAttendanceService from "../services/subcontractorAttendance.service.js";
import * as supervisorService from "../services/supervisor.service.js";
import * as deviceService from "../services/device-token.service.js";

const MOBILE_PAGE_SIZE = 25;

function mobilePageLimit(value: unknown): number {
  const requested = Number(value);
  if (!Number.isFinite(requested)) return MOBILE_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(requested), 1), MOBILE_PAGE_SIZE);
}

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
    const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const dashboard = await mobileService.getSupervisorDashboard(userId, { siteId, projectId });
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

// =================== MATERIAL NAMES ===================
export async function listMaterialNames(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const names = await mobileService.listMaterialNames(userId, req.query.search as string | undefined);
    res.json({ names });
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
      limit: mobilePageLimit(req.query.limit),
      cursor: req.query.cursor as string | undefined,
      search: req.query.search as string | undefined,
      stockStatus: req.query.stockStatus as "all" | "available" | "low" | "out" | undefined,
      receivedOnly: req.query.receivedOnly === "true",
      view: req.query.view === "materials" ? "materials" : "inventory",
    });
    res.json(result);
  } catch (e) {
    console.error("[mobile.listMaterials] failed:", (e as Error).message);
    res.status(503).json({
      error: "Materials are temporarily unavailable. Please retry.",
      materials: [],
      pagination: { total: 0, limit: MOBILE_PAGE_SIZE, pages: 0, nextCursor: null },
    });
  }
}

export async function listMaterialBillRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const result = await mobileService.listMaterialBillRequestsForSupervisor(userId, {
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      limit: mobilePageLimit(req.query.limit),
      cursor: req.query.cursor as string | undefined,
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

/**
 * "Add Existing Material" endpoint — supervisors record materials that
 * already exist at the site. No approval workflow; saves directly to
 * the Inventory collection (upsert by projectId+site+name+unit) and
 * mirrors the entry onto the Material collection so the supervisor's
 * record (and any typed notes) shows up immediately in the web app's
 * Materials table.
 */
export async function addExistingMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const result = await mobileService.addExistingMaterialForSupervisor(userId, req.body);
    // Invalidate relevant caches so the new data shows up immediately
    invalidateCachePrefix("/api/supervisor/materials");
    invalidateCachePrefix("/api/supervisor/material-names");
    invalidateCachePrefix("/api/supervisor/dashboard");
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/inventory");
    invalidateCachePrefix("/api/dashboard/batch");
    res.status(result.created ? 201 : 200).json(result);
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
      vendorId: req.body.vendorId ? new Types.ObjectId(req.body.vendorId) : undefined,
      issuedAmount: req.body.issuedAmount,
      notes: req.body.notes,
      purchasedQuantity: initialStock,
      consumedQuantity: 0,
      remainingStock: initialStock,
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
      sourceCollection: "materials",
      sourceId: material._id,
      status: "Pending",
      owner: userId,
    });

    // Invalidate BOTH the supervisor and admin/materials caches. The web
    // admin reads /api/materials, the supervisor app reads
    // /api/supervisor/materials — invalidate both so any new material
    // shows up immediately on either client.
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/supervisor/materials");
    invalidateCachePrefix("/api/approvals");
    invalidateCachePrefix("/api/supervisor/approvals");
    invalidateCachePrefix("/api/supervisor/dashboard");
    invalidateCachePrefix("/api/dashboard/batch");

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

    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/supervisor/materials");
    invalidateCachePrefix("/api/supervisor/dashboard");
    invalidateCachePrefix("/api/dashboard/batch");

    res.json({ material });
  } catch (e) { next(e); }
}

export async function updateMaterialReceived(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const material = await mobileService.updateMaterialReceivedForSupervisor(
      userId,
      req.params.id,
      req.body.received
    );

    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/inventory");
    invalidateCachePrefix("/api/supervisor/materials");
    invalidateCachePrefix("/api/supervisor/material-bill-requests");
    invalidateCachePrefix("/api/supervisor/dashboard");
    invalidateCachePrefix("/api/dashboard/batch");

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
      limit: mobilePageLimit(req.query.limit),
      cursor: req.query.cursor as string | undefined,
    });
    res.json(result);
  } catch (e) {
    console.error("[mobile.listLabour] failed:", (e as Error).message);
    res.status(503).json({
      error: "Labour is temporarily unavailable. Please retry.",
      labour: [],
      pagination: { total: 0, limit: MOBILE_PAGE_SIZE, pages: 0, nextCursor: null },
    });
  }
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
      sourceCollection: "labour",
      sourceId: labour._id,
      status: "Pending",
      owner: userId,
    });

    invalidateCachePrefix("/api/labour");
    invalidateCachePrefix("/api/supervisor/labour");
    invalidateCachePrefix("/api/approvals");
    invalidateCachePrefix("/api/supervisor/approvals");
    invalidateCachePrefix("/api/supervisor/dashboard");
    invalidateCachePrefix("/api/dashboard/batch");

    res.status(201).json({ labour });
  } catch (e) { next(e); }
}

// =================== EXPENSES (mobile) ===================
export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const filters = {
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      limit: mobilePageLimit(req.query.limit),
      cursor: req.query.cursor as string | undefined,
    };
    const result = await mobileService.listExpensesForSupervisor(userId, filters);
    res.json(result);
  } catch (e) {
    console.error("[mobile.listExpenses] failed:", (e as Error).message);
    res.status(503).json({
      error: "Expenses are temporarily unavailable. Please retry.",
      expenses: [],
      pagination: { total: 0, limit: MOBILE_PAGE_SIZE, pages: 0, nextCursor: null },
    });
  }
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

    const { User } = await import("../models/User.js");
    const supervisorUser = await User.findById(userId).select("name").lean();
    const supervisorName = supervisorUser?.name || "";

    const expense = await Expense.create({
      ...req.body,
      expenseId,
      projectName,
      clientId,
      clientName,
      site: siteName,
      supervisor: req.body.supervisor || supervisorName,
      status: "Pending",
      submittedBy: userId,
    });

    const isSiteMaterialExpense = req.body.isSiteMaterial === true;
    if (req.body.type === "site") {
      await Approval.create({
        approvalId: await generateId("APR"),
        type: "expense",
        title: isSiteMaterialExpense
          ? `Site Material: ${expense.materialName || expense.description}`
          : req.body.transactionType === "Cash Added"
          ? `Cash Added: ${expense.description}`
          : `Site Expense: ${expense.description}`,
        projectId: expense.projectId,
        projectName: expense.projectName,
        site: expense.site,
        amount: expense.amount,
        detail: isSiteMaterialExpense
          ? `Material: ${expense.materialName} - Qty: ${expense.materialQuantity} ${expense.materialUnit}`
          : `${expense.transactionType || "Expense"} - ${expense.description}`,
        sourceCollection: "expenses",
        sourceId: expense._id,
        status: "Pending",
        owner: userId,
      });
    }

    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/supervisor/expenses");
    invalidateCachePrefix("/api/approvals");
    invalidateCachePrefix("/api/supervisor/approvals");
    invalidateCachePrefix("/api/supervisor/dashboard");
    invalidateCachePrefix("/api/dashboard/batch");

    res.status(201).json({ expense });
  } catch (e) { next(e); }
}

export async function uploadExpenseReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    console.log(`[uploadExpenseReceipt] id=${req.params.id} user=${userId} hasData=${!!req.body.data} mimeType=${req.body.mimeType}`);
    const { Expense } = await import("../models/Expense.js");
    const expense = await Expense.findById(req.params.id).lean();
    if (!expense) throw new AppError(404, "Expense not found");
    console.log(`[uploadExpenseReceipt] expense found: status=${expense.status} type=${expense.type} site=${expense.site} hasBillUrl=${!!expense.billUrl}`);
    const { Project } = await import("../models/Project.js");
    await mobileService.ensureSupervisorSiteAccess(userId, expense.projectId?.toString(), expense.siteId?.toString());
    const { uploadExpenseReceipt } = await import("../services/expense.service.js");
    const updated = await uploadExpenseReceipt(req.params.id, {
      data: req.body.data,
      mimeType: req.body.mimeType,
      fileName: req.body.fileName,
    });
    console.log(`[uploadExpenseReceipt] success: billUrl=${updated.billUrl?.substring(0, 60)}`);
    invalidateCachePrefix("/api/supervisor/expenses");
    invalidateCachePrefix("/api/supervisor/material-bill-requests");
    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/materials");
    res.json({ expense: updated });
  } catch (e) { console.error(`[uploadExpenseReceipt] FAILED:`, e); next(e); }
}

export async function uploadMaterialReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const { Material } = await import("../models/Material.js");
    let mat = await Material.findById(req.params.id).lean();

    if (mat) {
      await mobileService.ensureSupervisorSiteAccess(userId, mat.projectId?.toString(), mat.siteId?.toString());
      const { uploadMaterialReceipt } = await import("../services/material.service.js");
      const updated = await uploadMaterialReceipt(req.params.id, {
        data: req.body.data,
        mimeType: req.body.mimeType,
        fileName: req.body.fileName,
        received: req.body.received,
      });
      invalidateCachePrefix("/api/supervisor/materials");
      invalidateCachePrefix("/api/supervisor/material-bill-requests");
      invalidateCachePrefix("/api/materials");
      invalidateCachePrefix("/api/inventory");
      res.json({ material: updated });
      return;
    }

    const { Inventory } = await import("../models/Inventory.js");
    const inv = await Inventory.findById(req.params.id).lean();
    if (inv) {
      await mobileService.ensureSupervisorSiteAccess(userId, inv.projectId?.toString(), inv.siteId?.toString());
      const { uploadInventoryReceipt } = await import("../services/inventory.service.js");
      const updated = await uploadInventoryReceipt(req.params.id, {
        data: req.body.data,
        mimeType: req.body.mimeType,
        fileName: req.body.fileName,
        received: req.body.received,
      });
      invalidateCachePrefix("/api/supervisor/materials");
      invalidateCachePrefix("/api/supervisor/material-bill-requests");
      invalidateCachePrefix("/api/materials");
      invalidateCachePrefix("/api/inventory");
      res.json({ material: updated });
      return;
    }

    throw new AppError(404, "Material not found");
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
      limit: mobilePageLimit(req.query.limit),
      cursor: req.query.cursor as string | undefined,
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

    // Approving a material/expense/labour approval changes the
    // underlying record's status — invalidate every relevant cache.
    invalidateCachePrefix("/api/approvals");
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/inventory");
    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/labour");
    invalidateCachePrefix("/api/supervisor");
    invalidateCachePrefix("/api/dashboard/batch");

    res.json({ approval });
  } catch (e) { next(e); }
}

// =================== WORKERS (mobile) ===================
export async function createWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const { Project } = await import("../models/Project.js");

    const project = await Project.findById(req.body.projectId).lean();
    if (!project) throw new AppError(404, "Project not found");

    const worker = await workerService.createWorker({
      ...req.body,
      createdBy: userId,
    });

    res.status(201).json({ worker });
  } catch (e) { next(e); }
}

export async function listWorkers(req: Request, res: Response, next: NextFunction) {
  try {
    requireSupervisor(req);
    const result = await workerService.listWorkersForSupervisor({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      labourType: req.query.labourType as string | undefined,
      page: Number(req.query.page) || 1,
      limit: mobilePageLimit(req.query.limit),
      cursor: req.query.cursor as string | undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const worker = await workerService.getWorkerById(req.params.id);
    res.json({ worker });
  } catch (e) { next(e); }
}

export async function updateWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const worker = await workerService.updateWorker(req.params.id, req.body);
    res.json({ worker });
  } catch (e) { next(e); }
}

// =================== ATTENDANCE (mobile) ===================
export async function markAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const attendance = await workerService.markAttendance({
      ...req.body,
      createdBy: userId,
    });
    res.status(201).json({ attendance });
  } catch (e) { next(e); }
}

export async function listAttendanceForDate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const date = req.query.date as string;
    if (!date) throw new AppError(400, "date is required");
    const attendances = await workerService.listAttendanceForDate(
      req.query.siteId as string,
      date,
      req.query.projectId as string | undefined
    );
    res.json({ attendances });
  } catch (e) { next(e); }
}

export async function listAttendanceForWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await workerService.listAttendanceForWorker(
      req.params.workerId,
      req.query.page ? Number(req.query.page) : 1,
      mobilePageLimit(req.query.limit)
    );
    res.json(result);
  } catch (e) { next(e); }
}

export async function getAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const attendance = await workerService.getAttendanceById(req.params.id);
    res.json({ attendance });
  } catch (e) { next(e); }
}

export async function updateAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const attendance = await workerService.updateAttendance(req.params.id, req.body);
    res.json({ attendance });
  } catch (e) { next(e); }
}

export async function deleteAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    await workerService.deleteAttendance(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getLabourTypeCounts(req: Request, res: Response, next: NextFunction) {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const counts = await workerService.getLabourTypeCounts(req.query.siteId as string, date);
    res.json({ counts });
  } catch (e) { next(e); }
}

// =================== SUBCONTRACTORS (mobile) ===================
export async function listSubcontractors(req: Request, res: Response, next: NextFunction) {
  try {
    // Supervisor-scoped: only show sub-contractors belonging to projects
    // the calling supervisor is assigned to. The web admin list shows
    // duplicates when the same party (e.g. "Sri Balaji Electricals") is
    // registered under several projects — that's the truth in this data
    // model. The mobile view, however, picks ONE row per name (lowest
    // _id wins) so supervisors don't see the same name listed three
    // times when marking attendance.
    const userId = requireSupervisor(req);
    const selectedProjectId = String(req.query.projectId || "").trim() || undefined;
    const rawItems = await subcontractorService.listSubcontractorsForSupervisor(
      userId,
      selectedProjectId,
    );
    const raw = rawItems as any[];

    // Sort: active first, then alphabetical. Active = status === "active"
    // OR status is missing/empty (treat the schema default as active so
    // pre-existing rows without an explicit status still appear).
    const isActive = (s: any) => {
      const st = String(s?.status || "active").toLowerCase();
      return st === "active" || st === "" || st === "undefined" || st === "null";
    };
    raw.sort((a, b) => {
      const aActive = isActive(a) ? 0 : 1;
      const bActive = isActive(b) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return String(a.subcontractorName || "").localeCompare(String(b.subcontractorName || ""));
    });

    // Deduplicate by trimmed lowercase name — keep the first occurrence
    // (active rows win because of the sort above).
    const seen = new Set<string>();
    const items: any[] = [];
    for (const s of raw) {
      const name = String(s.subcontractorName || "").trim();
      if (!name) continue; // skip rows with no name — they would render as blank rows
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        _id: String(s._id),
        subcontractorName: name,
        projectId: s.projectId ? String(s.projectId) : "",
        projectIds: Array.isArray(s.projectIds) ? s.projectIds.map(String) : [],
        address: s.address || "",
        phone: s.phone || "",
        note: s.note || "",
        status: isActive(s) ? "active" : "inactive",
      });
    }

    res.json({
      subcontractors: items,
      total: items.length,
      page: 1,
      limit: items.length,
      pages: 1,
    });
  } catch (e) { next(e); }
}

// =================== BULK ATTENDANCE (mobile) ===================
// Lightweight sub-contractor roster creation from the supervisor app.
// We deliberately accept a MINIMAL payload (name + optional phone) —
// the full subcontractor record (GST, custom fields, multi-project
// assignment, etc.) is still managed from the web admin. Supervisors
// only need a name to mark attendance for a new party on the fly.
export async function createQuickSubcontractor(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const { subcontractorName, phone, address, projectId } = req.body || {};
    if (!subcontractorName || !String(subcontractorName).trim()) {
      throw new AppError(400, "subcontractorName is required");
    }
    // Fall back to the supervisor's currently selected project so a
    // fresh on-site name doesn't strand the record with no project.
    const access = await mobileService.getSupervisorAccess(userId);
    const resolvedProjectId = projectId || access.projectIds?.[0]?.toString();
    if (!resolvedProjectId) {
      throw new AppError(400, "projectId is required (no project currently selected)");
    }
    const sub = await subcontractorService.createSubcontractor({
      projectId: resolvedProjectId,
      subcontractorName: String(subcontractorName).trim(),
      phone: phone ? String(phone).trim() : "",
      address: address ? String(address).trim() : "",
      description: "Created from supervisor mobile app",
    });
    res.status(201).json({ subcontractor: sub });
  } catch (e) { next(e); }
}

export async function markBulkAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const attendance = await subcontractorAttendanceService.markBulkAttendance(req.body, userId);
    res.status(201).json({ attendance });
  } catch (e) { next(e); }
}

export async function listBulkAttendanceForDate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const date = String(req.query.date || "").trim();
    if (!date) throw new AppError(400, "date query param is required");
    const items = await subcontractorAttendanceService.listAttendanceForSupervisor(userId, date);
    res.json({ attendances: items, total: items.length, date });
  } catch (e) { next(e); }
}

export async function getBulkAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    requireSupervisor(req);
    const attendance = await subcontractorAttendanceService.getBulkAttendanceById(req.params.id);
    res.json({ attendance });
  } catch (e) { next(e); }
}

export async function deleteBulkAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    requireSupervisor(req);
    await subcontractorAttendanceService.deleteBulkAttendance(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

// =================== SUPERVISORS (mobile) ===================
export async function listSupervisorsForWorker(req: Request, res: Response, next: NextFunction) {
  try {
    // Lightweight supervisor list for the worker-create page's
    // "directly hired" mode. Scoped to the calling supervisor's
    // accessible projects so cross-tenant assignments aren't possible.
    const userId = requireSupervisor(req);
    const { getSupervisorAccess } = await import("../services/supervisor-mobile.service.js");
    const access = await getSupervisorAccess(userId);
    const items = await supervisorService.listSupervisorsForWorker({
      scopeProjectIds: access.projectIds,
    });
    res.json({ supervisors: items });
  } catch (e) { next(e); }
}

// =================== NOTIFICATIONS (mobile) ===================
export async function getRecentNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireSupervisor(req);
    const limit = mobilePageLimit(req.query.limit);
    const notifications = await mobileService.getRecentNotificationsForSupervisor(userId, limit);
    res.json({ notifications });
  } catch (e) { next(e); }
}
