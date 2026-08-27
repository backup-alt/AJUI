import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import * as materialService from "../services/material.service.js";
import * as labourService from "../services/labour.service.js";
import * as expenseService from "../services/expense.service.js";
import * as generalExpenseService from "../services/general-expense.service.js";
import * as paymentService from "../services/payment.service.js";
import * as vendorService from "../services/vendor.service.js";
import * as subcontractorService from "../services/subcontractor.service.js";
import * as subcontractorPaymentService from "../services/subcontractor-payment.service.js";
import * as subcontractorLaborService from "../services/subcontractor-labor.service.js";
import * as purchaseOrderService from "../services/purchase-order.service.js";
import * as approvalService from "../services/approval.service.js";
import * as inventoryService from "../services/inventory.service.js";
import * as workerService from "../services/worker.service.js";
import { recomputeClientTotals, recomputeProjectTotals } from "../services/financial.service.js";
import { getScopedProjectIds } from "../middleware/rbac.js";
import { User } from "../models/User.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { AppError } from "../middleware/errorHandler.js";
import { invalidateCachePrefix } from "../middleware/cache.js";

// =================== MATERIALS ===================
export async function createMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const { Site } = await import("../models/Site.js");
    const body = { ...req.body };

    // Resolve site name from siteId if provided
    if (body.siteId) {
      const site = await Site.findById(body.siteId).lean();
      if (site) body.site = site.name;
    }

    const material = await materialService.createMaterial(body);
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/inventory");
    invalidateCachePrefix("/api/dashboard/batch");
    invalidateCachePrefix("/api/supervisor/materials");
    invalidateCachePrefix("/api/supervisor/material-names");
    invalidateCachePrefix("/api/supervisor/dashboard");
    res.status(201).json({ material });
  } catch (e) { next(e); }
}

export async function listMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const t0 = Date.now();
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await materialService.listMaterials({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      site: req.query.site as string | undefined,
      vendorId: req.query.vendorId as string | undefined,
      type: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25,
      cursor: req.query.cursor as string | undefined,
      scopeProjectIds,
    });
    if (result.queryFailed) {
      res.status(503).json({ error: "Materials are temporarily unavailable. Please retry.", ...result });
      return;
    }
    const dt = Date.now() - t0;
    console.log(
      `[listMaterials] dt=${dt}ms limit=${req.query.limit ?? "default"} items=${result.items?.length ?? 0} total=${result.total} scope=${scopeProjectIds?.length ?? "null"}`
    );
    res.json(result);
  } catch (e) {
    if (res.headersSent) {
      console.error("[listMaterials] error after headers sent:", (e as Error).message);
      return;
    }
    console.error("[listMaterials] failed:", (e as Error).message);
    res.status(503).json({
      error: "Database temporarily unavailable, please retry",
      items: [],
      total: 0,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25,
      pages: 0,
    });
  }
}

export async function diagnosticFindOneMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const t0 = Date.now();
    const { Material } = await import("../models/Material.js");
    const test = await Material.findOne().lean();
    const dt = Date.now() - t0;
    console.log(`[diagnostic] Material.findOne().lean() returned in ${dt}ms — _id: ${test?._id}`);
    res.json({ ok: true, durationMs: dt, id: test?._id ?? null });
  } catch (e) { next(e); }
}

export async function diagnosticFindOneInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const t0 = Date.now();
    const { Inventory } = await import("../models/Inventory.js");
    const test = await Inventory.findOne().lean();
    const dt = Date.now() - t0;
    console.log(`[diagnostic] Inventory.findOne().lean() returned in ${dt}ms — _id: ${test?._id}`);
    res.json({ ok: true, durationMs: dt, id: test?._id ?? null });
  } catch (e) { next(e); }
}

export async function diagnosticFindOneExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const t0 = Date.now();
    const { Expense } = await import("../models/Expense.js");
    const test = await Expense.findOne().lean();
    const dt = Date.now() - t0;
    console.log(`[diagnostic] Expense.findOne().lean() returned in ${dt}ms — _id: ${test?._id}`);
    res.json({ ok: true, durationMs: dt, id: test?._id ?? null });
  } catch (e) { next(e); }
}

/**
 * Production hydration endpoint: returns EVERY material visible to the
 * caller in a single HTTP round-trip. The frontend hydration service calls
 * this on every page boot (and on demand from the refresh button) instead
 * of walking cursor pages. M0 can serve a few hundred lean documents in
 * a single query without timing out, so the cursor pagination walk that
 * the previous implementation required is no longer necessary.
 *
 * Cached server-side for 15s — concurrent dashboard loads from the same
 * user share a single DB query.
 */
export async function listAllMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const t0 = Date.now();
    const items = await materialService.listAllMaterials({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      site: req.query.site as string | undefined,
      vendorId: req.query.vendorId as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      scopeProjectIds,
      max: req.query.max ? Number(req.query.max) : undefined,
    });
    const dt = Date.now() - t0;
    console.log(`[materials/all] returned ${items.length} items in ${dt}ms`);
    // The service uses a single-shot query with cursor-walk fallback, so it
    // ALWAYS returns data (or an empty array if every page failed). No more
    // 503s — an empty array means "nothing visible to this user" rather
    // than "DB is down", which is what the frontend wants for rendering.
    res.json({ items, total: items.length, count: items.length, durationMs: dt });
  } catch (err) {
    if (res.headersSent) {
      console.error("[materials/all] error after headers sent:", (err as Error).message);
      return;
    }
    console.error("[materials/all] unexpected failure:", (err as Error).message);
    res.status(503).json({
      error: "Database temporarily unavailable, please retry",
      items: [],
      total: 0,
      count: 0,
    });
  }
}

export async function listAllInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const t0 = Date.now();
    const items = await inventoryService.listAllInventory({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      search: req.query.search as string | undefined,
      scopeProjectIds,
      max: req.query.max ? Number(req.query.max) : undefined,
    });
    const dt = Date.now() - t0;
    console.log(`[inventory/all] returned ${items.length} items in ${dt}ms`);
    res.json({ items, total: items.length, count: items.length, durationMs: dt });
  } catch (err) {
    if (res.headersSent) {
      console.error("[inventory/all] error after headers sent:", (err as Error).message);
      return;
    }
    console.error("[inventory/all] unexpected failure:", (err as Error).message);
    res.status(503).json({
      error: "Database temporarily unavailable, please retry",
      items: [],
      total: 0,
      count: 0,
    });
  }
}

export async function listAllExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const t0 = Date.now();
    const items = await expenseService.listAllExpenses({
      type: req.query.type as string | undefined,
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      site: req.query.site as string | undefined,
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      scopeProjectIds,
      max: req.query.max ? Number(req.query.max) : undefined,
    });
    const dt = Date.now() - t0;
    console.log(`[expenses/all] returned ${items.length} items in ${dt}ms`);
    res.json({ items, total: items.length, count: items.length, durationMs: dt });
  } catch (err) {
    if (res.headersSent) {
      console.error("[expenses/all] error after headers sent:", (err as Error).message);
      return;
    }
    console.error("[expenses/all] unexpected failure:", (err as Error).message);
    res.status(503).json({
      error: "Database temporarily unavailable, please retry",
      items: [],
      total: 0,
      count: 0,
    });
  }
}

export async function getMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await materialService.getMaterialById(req.params.id);
    res.json({ material });
  } catch (e) { next(e); }
}

export async function updateMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const { Site } = await import("../models/Site.js");
    const body = { ...req.body };

    if (body.siteId) {
      const site = await Site.findById(body.siteId).lean();
      if (site) body.site = site.name;
    }

    const material = await materialService.updateMaterial(req.params.id, body);
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/inventory");
    invalidateCachePrefix("/api/supervisor/materials");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ material });
  } catch (e) { next(e); }
}

export async function deleteMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    await materialService.deleteMaterial(req.params.id);
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function uploadMaterialReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await materialService.uploadMaterialReceipt(req.params.id, {
      data: req.body.data,
      mimeType: req.body.mimeType,
      fileName: req.body.fileName,
      givenAmount: req.body.givenAmount,
    });
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ material });
  } catch (e) { next(e); }
}

export async function getPendingMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const materials = await materialService.getPendingMaterials(scopeProjectIds);
    res.json({ materials });
  } catch (e) { next(e); }
}

// =================== INVENTORY ===================
export async function listInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const t0 = Date.now();
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await inventoryService.listInventory({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25,
      cursor: req.query.cursor as string | undefined,
      scopeProjectIds,
    });
    if (result.queryFailed) {
      res.status(503).json({ error: "Inventory is temporarily unavailable. Please retry.", ...result });
      return;
    }
    const dt = Date.now() - t0;
    console.log(
      `[listInventory] dt=${dt}ms limit=${req.query.limit ?? "default"} items=${result.items?.length ?? 0} total=${result.total} scope=${scopeProjectIds?.length ?? "null"}`
    );
    res.json(result);
  } catch (e) {
    if (res.headersSent) {
      console.error("[listInventory] error after headers sent:", (e as Error).message);
      return;
    }
    console.error("[listInventory] failed:", (e as Error).message);
    res.status(503).json({
      error: "Database temporarily unavailable, please retry",
      items: [],
      total: 0,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25,
      pages: 0,
    });
  }
}

export async function getMissingMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await inventoryService.getMissingMaterialsForSite(req.query.siteId as string);
    if (Array.isArray(scopeProjectIds) && result.materials.length > 0) {
      const allowed = new Set(scopeProjectIds.map((id) => String(id)));
      result.materials = result.materials.filter((m) => m.projectId && allowed.has(String(m.projectId)));
    }
    res.json(result);
  } catch (e) { next(e); }
}

export async function initializeInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const updatedBy = user?.username || user?.email || user?._id?.toString();
    const { siteId, items } = req.body;
    const result = await inventoryService.initializeSiteInventory(siteId, items, updatedBy);
    res.status(201).json(result);
  } catch (e) { next(e); }
}

export async function addInventoryMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const updatedBy = user?.username || user?.email || user?._id?.toString();
    const result = await inventoryService.addInventoryMaterial(req.body, updatedBy);

    invalidateCachePrefix("/api/inventory");
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/dashboard/batch");
    invalidateCachePrefix("/api/supervisor/materials");
    invalidateCachePrefix("/api/supervisor/material-names");
    invalidateCachePrefix("/api/supervisor/dashboard");

    res.status(201).json(result);
  } catch (e) { next(e); }
}

// =================== LABOUR ===================
export async function createLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const labour = await labourService.createLabour(req.body);
    invalidateCachePrefix("/api/labour");
    invalidateCachePrefix("/api/dashboard/batch");
    res.status(201).json({ labour });
  } catch (e) { next(e); }
}

export async function listLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await labourService.listLabour({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      site: req.query.site as string | undefined,
      category: req.query.category as string | undefined,
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25,
      cursor: req.query.cursor as string | undefined,
      scopeProjectIds,
    });
    if (result.queryFailed) {
      res.status(503).json({ error: "Labour is temporarily unavailable. Please retry.", ...result });
      return;
    }
    res.json(result);
  } catch (e) { next(e); }
}

export async function getLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const labour = await labourService.getLabourById(req.params.id);
    res.json({ labour });
  } catch (e) { next(e); }
}

export async function updateLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const labour = await labourService.updateLabour(req.params.id, req.body);
    invalidateCachePrefix("/api/labour");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ labour });
  } catch (e) { next(e); }
}

export async function deleteLabour(req: Request, res: Response, next: NextFunction) {
  try {
    await labourService.deleteLabour(req.params.id);
    invalidateCachePrefix("/api/labour");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getLabourSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const summary = await labourService.getLabourSummary(req.params.projectId, scopeProjectIds);
    res.json({ summary });
  } catch (e) { next(e); }
}

export async function getPendingLabour(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const labour = await labourService.getPendingLabour(scopeProjectIds);
    res.json({ labour });
  } catch (e) { next(e); }
}

// =================== EXPENSES ===================
export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.createExpense(req.body);
    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/dashboard/batch");
    res.status(201).json({ expense });
  } catch (e) { next(e); }
}

export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const t0 = Date.now();
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await expenseService.listExpenses({
      type: req.query.type as string | undefined,
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      site: req.query.site as string | undefined,
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25,
      cursor: req.query.cursor as string | undefined,
      scopeProjectIds,
    });
    if (result.queryFailed) {
      res.status(503).json({ error: "Expenses are temporarily unavailable. Please retry.", ...result });
      return;
    }
    const dt = Date.now() - t0;
    console.log(
      `[listExpenses] dt=${dt}ms limit=${req.query.limit ?? "default"} items=${result.items?.length ?? 0} total=${result.total} scope=${scopeProjectIds?.length ?? "null"}`
    );
    res.json(result);
  } catch (e) {
    // Don't silently swallow DB timeouts — return 503 so the frontend
    // knows this is a transient failure (not "0 expenses in DB") and
    // can retry. Empty 200 fallbacks were hiding M0 pool exhaustion.
    if (res.headersSent) {
      console.error("[listExpenses] error after headers sent:", (e as Error).message);
      return;
    }
    console.error("[listExpenses] failed:", (e as Error).message);
    res.status(503).json({
      error: "Database temporarily unavailable, please retry",
      items: [],
      total: 0,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25,
      pages: 0,
    });
  }
}

export async function getExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.getExpenseById(req.params.id);
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.updateExpense(req.params.id, req.body);
    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function uploadExpenseReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.uploadExpenseReceipt(req.params.id, {
      data: req.body.data,
      mimeType: req.body.mimeType,
      fileName: req.body.fileName,
    });
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function markAsReceived(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.markExpenseAsReceived(req.params.id);
    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/supervisor/expenses");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    await expenseService.deleteExpense(req.params.id);
    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getExpenseLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const ledger = await expenseService.getExpenseLedger(req.params.projectId, req.params.site, scopeProjectIds);
    res.json({ ledger });
  } catch (e) { next(e); }
}

export async function getPendingExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const expenses = await expenseService.getPendingExpenses(scopeProjectIds);
    res.json({ expenses });
  } catch (e) { next(e); }
}

// =================== GENERAL EXPENSES (project-level "Expense") ===================
export async function createGeneralExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await generalExpenseService.createGeneralExpense(req.body);
    invalidateCachePrefix("/api/general-expenses");
    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/dashboard/batch");
    res.status(201).json({ expense });
  } catch (e) { next(e); }
}

export async function listGeneralExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const t0 = Date.now();
    const scopeProjectIds = await getScopedProjectIds(req);
    const rawStatus = req.query.status as string | undefined;
    const status = (["Pending", "Approved", "Rejected"] as const).includes(rawStatus as any)
      ? (rawStatus as "Pending" | "Approved" | "Rejected")
      : undefined;
    const result = await generalExpenseService.listGeneralExpenses({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      category: req.query.category as string | undefined,
      status,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 200,
      cursor: req.query.cursor as string | undefined,
      scopeProjectIds,
    });
    if (result.queryFailed) {
      res.status(503).json({ error: "General expenses are temporarily unavailable. Please retry.", ...result });
      return;
    }
    const dt = Date.now() - t0;
    console.log(
      `[listGeneralExpenses] dt=${dt}ms limit=${req.query.limit ?? "default"} items=${result.items?.length ?? 0} total=${result.total} scope=${scopeProjectIds?.length ?? "null"}`
    );
    res.json(result);
  } catch (e) {
    if (res.headersSent) {
      console.error("[listGeneralExpenses] error after headers sent:", (e as Error).message);
      return;
    }
    console.error("[listGeneralExpenses] failed:", (e as Error).message);
    res.status(503).json({
      error: "Database temporarily unavailable, please retry",
      items: [],
      total: 0,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 200,
      pages: 0,
    });
  }
}

export async function listAllGeneralExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const t0 = Date.now();
    const scopeProjectIds = await getScopedProjectIds(req);
    const rawStatus = req.query.status as string | undefined;
    const status = (["Pending", "Approved", "Rejected"] as const).includes(rawStatus as any)
      ? (rawStatus as "Pending" | "Approved" | "Rejected")
      : undefined;
    const result = await generalExpenseService.listAllGeneralExpenses({
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      category: req.query.category as string | undefined,
      status,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      search: req.query.search as string | undefined,
      scopeProjectIds,
    });
    const dt = Date.now() - t0;
    console.log(
      `[listAllGeneralExpenses] dt=${dt}ms count=${result.items?.length ?? 0} scope=${scopeProjectIds?.length ?? "null"}`
    );
    res.json(result);
  } catch (e) { next(e); }
}

export async function getGeneralExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await generalExpenseService.getGeneralExpenseById(req.params.id);
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function uploadGeneralExpenseReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await generalExpenseService.uploadGeneralExpenseReceipt(req.params.id, {
      data: req.body.data,
      mimeType: req.body.mimeType,
      fileName: req.body.fileName,
    });
    invalidateCachePrefix("/api/general-expenses");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function updateGeneralExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await generalExpenseService.updateGeneralExpense(req.params.id, req.body);
    invalidateCachePrefix("/api/general-expenses");
    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ expense });
  } catch (e) { next(e); }
}

export async function deleteGeneralExpense(req: Request, res: Response, next: NextFunction) {
  try {
    await generalExpenseService.deleteGeneralExpense(req.params.id);
    invalidateCachePrefix("/api/general-expenses");
    invalidateCachePrefix("/api/expenses");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ success: true });
  } catch (e) { next(e); }
}

// =================== PAYMENTS ===================
async function recomputePaymentRollups(...payments: any[]): Promise<void> {
  const projectIds = new Set<string>();
  const clientIds = new Set<string>();
  for (const payment of payments) {
    if (payment?.projectId) projectIds.add(String(payment.projectId));
    if (payment?.clientId) clientIds.add(String(payment.clientId));
  }
  await Promise.all([...projectIds].map((id) => recomputeProjectTotals(new Types.ObjectId(id))));
  await Promise.all([...clientIds].map((id) => recomputeClientTotals(new Types.ObjectId(id))));
}

function invalidatePaymentCaches(): void {
  invalidateCachePrefix("/api/payments");
  invalidateCachePrefix("/api/projects");
  invalidateCachePrefix("/api/clients");
  invalidateCachePrefix("/api/dashboard/kpis");
  invalidateCachePrefix("/api/dashboard/batch");
}

export async function createPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.createPayment(req.body);
    await recomputePaymentRollups(payment);
    invalidatePaymentCaches();
    res.status(201).json({ payment });
  } catch (e) { next(e); }
}

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await paymentService.listPayments({
      projectId: req.query.projectId as string | undefined,
      clientId: req.query.clientId as string | undefined,
      status: req.query.status as string | undefined,
      mode: req.query.mode as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      cursor: req.query.cursor as string | undefined,
      scopeProjectIds,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    res.json({ payment });
  } catch (e) { next(e); }
}

export async function updatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const previousPayment = await paymentService.getPaymentById(req.params.id);
    const payment = await paymentService.updatePayment(req.params.id, req.body);
    await recomputePaymentRollups(previousPayment, payment);
    invalidatePaymentCaches();
    res.json({ payment });
  } catch (e) { next(e); }
}

export async function deletePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.deletePayment(req.params.id);
    await recomputePaymentRollups(payment);
    invalidatePaymentCaches();
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getPaymentCollectionSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const summary = await paymentService.getCollectionSummary({
      projectId: req.query.projectId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      scopeProjectIds,
    });
    res.json({ summary });
  } catch (e) { next(e); }
}

export async function getPendingPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const payments = await paymentService.getPendingPayments(scopeProjectIds);
    res.json({ payments });
  } catch (e) { next(e); }
}

// =================== VENDORS ===================
export async function createVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const vendor = await vendorService.createVendor(req.body);
    invalidateCachePrefix("/api/vendors");
    invalidateCachePrefix("/api/dashboard/batch");
    res.status(201).json({ vendor });
  } catch (e) { next(e); }
}

export async function listVendors(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vendorService.listVendors({
      materialType: req.query.materialType as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      cursor: req.query.cursor as string | undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const vendor = await vendorService.getVendorById(req.params.id);
    res.json({ vendor });
  } catch (e) { next(e); }
}

export async function updateVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const vendor = await vendorService.updateVendor(req.params.id, req.body);
    invalidateCachePrefix("/api/vendors");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ vendor });
  } catch (e) { next(e); }
}

export async function deleteVendor(req: Request, res: Response, next: NextFunction) {
  try {
    await vendorService.deleteVendor(req.params.id);
    invalidateCachePrefix("/api/vendors");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getVendorPurchaseHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vendorService.getVendorPurchaseHistory(req.params.id);
    res.json(result);
  } catch (e) { next(e); }
}

// =================== SUBCONTRACTORS ===================
export async function createSubcontractor(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await subcontractorService.createSubcontractor(req.body);
    invalidateCachePrefix("/api/subcontractors");
    invalidateCachePrefix("/api/dashboard/batch");
    res.status(201).json({ subcontractor: sub });
  } catch (e) { next(e); }
}

export async function listSubcontractors(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await subcontractorService.listSubcontractors({
      projectId: req.query.projectId as string | undefined,
      status: req.query.status as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      cursor: req.query.cursor as string | undefined,
      scopeProjectIds,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getSubcontractor(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await subcontractorService.getSubcontractorById(req.params.id);
    res.json({ subcontractor: sub });
  } catch (e) { next(e); }
}

export async function updateSubcontractor(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await subcontractorService.updateSubcontractor(req.params.id, req.body);
    invalidateCachePrefix("/api/subcontractors");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ subcontractor: sub });
  } catch (e) { next(e); }
}

export async function deleteSubcontractor(req: Request, res: Response, next: NextFunction) {
  try {
    await subcontractorService.deleteSubcontractor(req.params.id);
    invalidateCachePrefix("/api/subcontractors");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ success: true });
  } catch (e) { next(e); }
}

// =================== SUBCONTRACTOR PAYMENTS ===================
// The legacy embedded-payment endpoints (`POST /subcontractors/:id/payments`
// and `DELETE /subcontractors/:id/payments/:paymentIndex`) were replaced
// by the proper /subcontractor-payments CRUD endpoints below, which
// store each payment as its own row in the SubcontractorPayment
// collection.

/**
 * Lightweight subcontractor list for the mobile worker create page.
 * Returns every active sub-contractor the supervisor has access to
 * (universal — not filtered by site or project), so the worker create
 * form can pick any one.
 */
export async function listSubcontractorsForWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const items = await subcontractorService.listSubcontractorsForWorker({
      scopeProjectIds,
    });
    res.json({ subcontractors: items });
  } catch (e) { next(e); }
}

/**
 * Assignment picker source for the web project workspace. This deliberately
 * returns every active profile so an existing subcontractor can be assigned
 * to an additional project instead of being duplicated.
 */
export async function listAllActiveSubcontractors(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await subcontractorService.listAllActiveSubcontractors();
    res.json({ items });
  } catch (e) { next(e); }
}

/**
 * Spend rollup for the project workspace "total expense" line. Returns
 * the sum of every SubcontractorPayment row for the given project (or
 * the user's scoped projects, when no projectId is given).
 */
export async function getSubcontractorSpendRollup(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const rollup = await subcontractorPaymentService.subcontractorSpendRollup({
      projectId: req.query.projectId as string | undefined,
      scopeProjectIds,
    });
    res.json(rollup);
  } catch (e) { next(e); }
}

// =================== SUBCONTRACTOR PAYMENTS ===================
/**
 * List sub-contractor payments. Always RBAC-scoped to the user's
 * projects. Optional filters: subcontractorId, projectId, siteId,
 * from, to.
 */
export async function listSubcontractorPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await subcontractorPaymentService.listSubcontractorPayments({
      subcontractorId: req.query.subcontractorId as string | undefined,
      projectId: req.query.projectId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 200,
      cursor: req.query.cursor as string | undefined,
      scopeProjectIds,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function createSubcontractorPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const sub = await subcontractorPaymentService.createSubcontractorPayment(
      req.body,
      req.user?.sub,
      scopeProjectIds
    );
    invalidateCachePrefix("/api/subcontractor-payments");
    invalidateCachePrefix("/api/subcontractors");
    invalidateCachePrefix("/api/dashboard/batch");
    if (sub.projectId) await recomputeProjectTotals(new Types.ObjectId(sub.projectId));
    res.status(201).json({ payment: sub });
  } catch (e) { next(e); }
}

export async function updateSubcontractorPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const sub = await subcontractorPaymentService.updateSubcontractorPayment(
      req.params.id,
      req.body,
      scopeProjectIds
    );
    invalidateCachePrefix("/api/subcontractor-payments");
    invalidateCachePrefix("/api/subcontractors");
    invalidateCachePrefix("/api/dashboard/batch");
    if (sub.projectId) await recomputeProjectTotals(new Types.ObjectId(sub.projectId));
    res.json({ payment: sub });
  } catch (e) { next(e); }
}

export async function deleteSubcontractorPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const deleted = await subcontractorPaymentService.deleteSubcontractorPayment(req.params.id, scopeProjectIds);
    invalidateCachePrefix("/api/subcontractor-payments");
    invalidateCachePrefix("/api/subcontractors");
    invalidateCachePrefix("/api/dashboard/batch");
    if (deleted.projectId) await recomputeProjectTotals(new Types.ObjectId(deleted.projectId));
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getSubcontractorPaymentSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const summary = await subcontractorPaymentService.subcontractorPaymentSummary(
      req.params.id,
      scopeProjectIds
    );
    res.json(summary);
  } catch (e) { next(e); }
}

// =================== SUBCONTRACTOR LABOR ROSTER ===================
export async function listSubcontractorLabor(req: Request, res: Response, next: NextFunction) {
  try {
    const subcontractorId = String(req.query.subcontractorId || "");
    if (!Types.ObjectId.isValid(subcontractorId)) throw new AppError(400, "Valid subcontractorId is required");
    const items = await subcontractorLaborService.listSubcontractorLabor(subcontractorId);
    res.json({ items, total: items.length });
  } catch (e) { next(e); }
}

export async function createSubcontractorLabor(req: Request, res: Response, next: NextFunction) {
  try {
    const labor = await subcontractorLaborService.createSubcontractorLabor({ ...req.body, createdBy: req.user?.sub });
    invalidateCachePrefix("/api/subcontractor-labor");
    invalidateCachePrefix("/api/subcontractors");
    invalidateCachePrefix("/api/workers");
    invalidateCachePrefix("/api/dashboard/batch");
    res.status(201).json({ labor });
  } catch (e) { next(e); }
}

export async function updateSubcontractorLabor(req: Request, res: Response, next: NextFunction) {
  try {
    const labor = await subcontractorLaborService.updateSubcontractorLabor(req.params.id, req.body);
    invalidateCachePrefix("/api/subcontractor-labor");
    invalidateCachePrefix("/api/subcontractors");
    invalidateCachePrefix("/api/workers");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ labor });
  } catch (e) { next(e); }
}

// =================== PURCHASE ORDERS ===================
export async function createPurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const purchaseOrder = await purchaseOrderService.createPurchaseOrder({ ...req.body, createdBy: req.user?.sub });
    invalidateCachePrefix("/api/purchase-orders");
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/supervisor/materials");
    invalidateCachePrefix("/api/dashboard/batch");
    res.status(201).json({ purchaseOrder });
  } catch (e) { next(e); }
}

export async function listPurchaseOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await purchaseOrderService.listPurchaseOrders({
      projectId: req.query.projectId as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
      cursor: req.query.cursor as string | undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getPurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const purchaseOrder = await purchaseOrderService.getPurchaseOrder(req.params.id);
    res.json({ purchaseOrder });
  } catch (e) { next(e); }
}

export async function updatePurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const purchaseOrder = await purchaseOrderService.updatePurchaseOrder(req.params.id, { ...req.body, createdBy: req.user?.sub });
    invalidateCachePrefix("/api/purchase-orders");
    invalidateCachePrefix("/api/materials");
    invalidateCachePrefix("/api/supervisor/materials");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ purchaseOrder });
  } catch (e) { next(e); }
}

export async function listPurchaseOrderGstRates(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ rates: await purchaseOrderService.listGstRates() });
  } catch (e) { next(e); }
}

export async function createPurchaseOrderGstRate(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await purchaseOrderService.addGstRate(req.body.rate, req.user?.sub);
    invalidateCachePrefix("/api/purchase-orders/gst-rates");
    res.status(201).json({ rate: item.rate });
  } catch (e) { next(e); }
}

// =================== APPROVALS ===================
export async function listApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const result = await approvalService.listApprovals({
      type: req.query.type as never,
      projectId: req.query.projectId as string | undefined,
      status: req.query.status as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      cursor: req.query.cursor as string | undefined,
      scopeProjectIds,
      userRole: req.user?.role,
      userId: req.user?.sub,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const approval = await approvalService.getApprovalById(req.params.id);
    res.json({ approval });
  } catch (e) { next(e); }
}

export async function approveApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewer = req.user?.sub || "unknown";
    const approval = await approvalService.getApprovalById(req.params.id);
    if (!approval) throw new AppError(404, "Approval not found");

    if (req.user?.role !== "admin") {
      const user = await User.findById(req.user?.sub).select("requestPermissions").lean();
      const perms = user?.requestPermissions;

      const permMap: Record<string, boolean> = {
        material: perms?.canApproveMaterial ?? false,
        labour: perms?.canApproveLabour ?? false,
        expense: perms?.canApproveExpense ?? false,
        payment: perms?.canApprovePayment ?? false,
        subcontract: perms?.canApproveSubcontract ?? false,
      };

      if (!permMap[approval.type]) {
        throw new AppError(403, `You do not have permission to approve ${approval.type} requests`);
      }
    }

    const { issuedAmount, givenAmount, approvedAmount, poNumber, approvedQuantity, vendor } = req.body;
    const updated = await approvalService.approveRequest(req.params.id, reviewer, {
      issuedAmount,
      givenAmount,
      approvedAmount,
      poNumber,
      approvedQuantity,
      vendor,
    });
    if (approval.type === "payment") invalidatePaymentCaches();

    if (req.user?.sub) {
      await ActivityLog.create({
        userId: new Types.ObjectId(req.user.sub),
        action: "approval_approved",
        description: `Approved ${approval.type} request: ${approval.title || approval.approvalId}`,
        metadata: { approvalId: req.params.id, approvalType: approval.type },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      }).catch(() => {});
    }

    res.json({ approval: updated });
  } catch (e) { next(e); }
}

export async function rejectApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewer = req.user?.sub || "unknown";
    const approval = await approvalService.getApprovalById(req.params.id);
    if (!approval) throw new AppError(404, "Approval not found");

    if (req.user?.role !== "admin") {
      const user = await User.findById(req.user?.sub).select("requestPermissions").lean();
      const perms = user?.requestPermissions;

      const permMap: Record<string, boolean> = {
        material: perms?.canApproveMaterial ?? false,
        labour: perms?.canApproveLabour ?? false,
        expense: perms?.canApproveExpense ?? false,
        payment: perms?.canApprovePayment ?? false,
        subcontract: perms?.canApproveSubcontract ?? false,
      };

      if (!permMap[approval.type]) {
        throw new AppError(403, `You do not have permission to reject ${approval.type} requests`);
      }
    }

    const updated = await approvalService.rejectRequest(req.params.id, reviewer);
    if (approval.type === "payment") invalidatePaymentCaches();

    if (req.user?.sub) {
      await ActivityLog.create({
        userId: new Types.ObjectId(req.user.sub),
        action: "approval_rejected",
        description: `Rejected ${approval.type} request: ${approval.title || approval.approvalId}`,
        metadata: { approvalId: req.params.id, approvalType: approval.type },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      }).catch(() => {});
    }

    res.json({ approval: updated });
  } catch (e) { next(e); }
}

export async function getApprovalCount(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const count = await approvalService.getApprovalCount({
      projectId: req.query.projectId as string | undefined,
      type: req.query.type as never,
      scopeProjectIds,
      userRole: req.user?.role,
      userId: req.user?.sub,
    });
    res.json(count);
  } catch (e) { next(e); }
}

// =================== WORKER ROSTER (web admin) ===================
// Powers the "Labour" tab in the project workspace. The same Worker
// collection the mobile supervisor app writes to — these endpoints expose
// it to the web admin so editing phone/notes/address doesn't require
// opening the supervisor app.
export async function listWorkers(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeProjectIds = await getScopedProjectIds(req);
    const requestedProjectId = req.query.projectId as string | undefined;
    // Non-admins: clamp the requested project to their scope.
    if (scopeProjectIds !== null) {
      if (!requestedProjectId || !scopeProjectIds.some((id) => String(id) === requestedProjectId)) {
        res.json({ items: [], page: 1, limit: 0, total: 0, hasMore: false, nextCursor: null });
        return;
      }
    }
    const result = await workerService.listWorkers({
      projectId: requestedProjectId,
      siteId: req.query.siteId as string | undefined,
      labourType: req.query.labourType as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: req.query.cursor as string | undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function createWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.sub;
    if (!userId) throw new AppError(401, "Not authenticated");
    const worker = await workerService.createWorker({
      ...req.body,
      createdBy: userId,
    });
    invalidateCachePrefix("/api/workers");
    invalidateCachePrefix("/api/dashboard/batch");
    res.status(201).json({ worker });
  } catch (e) { next(e); }
}

export async function updateWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const worker = await workerService.updateWorker(req.params.id, req.body);
    invalidateCachePrefix("/api/workers");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ worker });
  } catch (e) { next(e); }
}

export async function deleteWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const { Worker } = await import("../models/Worker.js");
    const { Types } = await import("mongoose");
    if (!Types.ObjectId.isValid(req.params.id)) throw new AppError(400, "Invalid worker id");
    const result = await Worker.deleteOne({ _id: new Types.ObjectId(req.params.id) });
    if (result.deletedCount === 0) throw new AppError(404, "Worker not found");
    invalidateCachePrefix("/api/workers");
    invalidateCachePrefix("/api/dashboard/batch");
    res.json({ ok: true });
  } catch (e) { next(e); }
}

// =================== SUBCONTRACTOR ATTENDANCE (bulk headcount from mobile) ===================
export async function listSubcontractorAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { default: subcontractorAttendanceService } = await import("../services/subcontractorAttendance.service.js");
    const scopeProjectIds = await getScopedProjectIds(req);
    const { SubcontractorAttendance } = await import("../models/SubcontractorAttendance.js");
    
    const query: Record<string, any> = {};
    
    // Apply project scope
    if (scopeProjectIds !== null) {
      query.projectId = { $in: scopeProjectIds };
    }
    
    // Filter by projectId if provided
    if (req.query.projectId) {
      const { Types } = await import("mongoose");
      if (Types.ObjectId.isValid(req.query.projectId as string)) {
        query.projectId = new Types.ObjectId(req.query.projectId as string);
      }
    }
    
    // Filter by date range if provided
    if (req.query.dateFrom || req.query.dateTo) {
      query.attendanceDate = {};
      if (req.query.dateFrom) query.attendanceDate.$gte = req.query.dateFrom;
      if (req.query.dateTo) query.attendanceDate.$lte = req.query.dateTo;
    }
    
    // Pagination
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || "200"), 10)));
    const skip = (page - 1) * limit;
    
    const [items, total] = await Promise.all([
      SubcontractorAttendance.find(query)
        .sort({ attendanceDate: -1, subcontractorName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SubcontractorAttendance.countDocuments(query),
    ]);
    
    res.json({
      items: items.map((item) => ({
        _id: String(item._id),
        subcontractorId: String(item.subcontractorId),
        subcontractorName: item.subcontractorName,
        projectId: item.projectId ? String(item.projectId) : undefined,
        projectName: item.projectName,
        siteId: item.siteId ? String(item.siteId) : undefined,
        siteName: item.siteName,
        attendanceDate: item.attendanceDate,
        entries: item.entries,
        totalCount: item.totalCount,
        notes: item.notes,
        submittedBy: item.submittedBy ? String(item.submittedBy) : undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (e) { next(e); }
}
