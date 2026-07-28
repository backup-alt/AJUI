import { Request, Response, NextFunction } from "express";
import { Client } from "../models/Client.js";
import { Project } from "../models/Project.js";
import { Material } from "../models/Material.js";
import { Labour } from "../models/Labour.js";
import { Expense } from "../models/Expense.js";
import { Payment } from "../models/Payment.js";
import { Vendor } from "../models/Vendor.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { Inventory } from "../models/Inventory.js";
import { Attendance } from "../models/Attendance.js";
import { getScopedProjectIds } from "../middleware/rbac.js";

/**
 * BATCH DASHBOARD ENDPOINT
 *
 * Returns all dashboard data in a single response. Replaces the previous
 * pattern of 10+ parallel API calls on page load, which hammered the M0
 * free-tier MongoDB and caused 30-60s page loads.
 *
 * Uses Promise.all with .lean() for fast serialization.
 */
export async function getBatchDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.sub) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const scopeProjectIds = await getScopedProjectIds(req);
    const scopeFilter = scopeProjectIds ? { projectId: { $in: scopeProjectIds } } : {};

    const [
      clients,
      projects,
      sites,
      materials,
      labour,
      expenses,
      payments,
      vendors,
      subcontractors,
      inventory,
      attendance,
    ] = await Promise.all([
      Client.find({}).select("_id name status").lean(),
      Project.find(scopeProjectIds ? { _id: { $in: scopeProjectIds } } : {}).select("_id name clientId status").lean(),
      req.user?.role === "supervisor" ? [] : (await import("../models/Site.js")).Site.find({}).select("_id name projectId status").lean(),
      Material.find(scopeFilter).select("_id name quantity unit projectId siteId status").limit(100).lean(),
      Labour.find(scopeFilter).select("_id workerName labourType projectId siteId date status").limit(100).lean(),
      Expense.find(scopeFilter).select("_id description amount date projectId siteId status").limit(100).lean(),
      Payment.find(scopeFilter).select("_id amount date projectId mode status").limit(100).lean(),
      Vendor.find({}).select("_id name materialType phone").limit(100).lean(),
      Subcontractor.find(scopeFilter).select("_id subcontractorName workPackage projectId").limit(100).lean(),
      Inventory.find({}).select("_id name quantity unit projectId siteId").limit(100).lean(),
      // Attendance — only fetch for today to keep response small
      (() => {
        const today = new Date().toISOString().slice(0, 10);
        return Attendance.find({ date: today, ...scopeFilter }).select("_id workerId date shift status").limit(200).lean();
      })(),
    ]);

    res.json({
      clients,
      projects,
      sites,
      materials,
      labour,
      expenses,
      payments,
      vendors,
      subcontractors,
      inventory,
      attendance,
      fetchedAt: Date.now(),
    });
  } catch (e) {
    next(e);
  }
}