import { Request, Response, NextFunction } from "express";
import { Client } from "../models/Client.js";
import { Project } from "../models/Project.js";
import { Site } from "../models/Site.js";
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
 * Uses Promise.allSettled with .lean() for fast serialization and
 * graceful degradation — if one entity fails, others still load.
 */
export async function getBatchDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.sub) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const scopeProjectIds = await getScopedProjectIds(req);
    const isAdmin = req.user.role === "admin";
    // For admin: no scope filter (sees everything)
    // For PM/accountant/supervisor: scope to their projects
    // scopeProjectIds is null for admin, array for others
    const projectScope = (scopeProjectIds && scopeProjectIds.length > 0)
      ? { projectId: { $in: scopeProjectIds } }
      : isAdmin
        ? {}
        : { projectId: { $in: [] } }; // explicit empty match for non-admin with no projects

    const today = new Date().toISOString().slice(0, 10);

    // Use Promise.allSettled so one failing query doesn't break the whole batch
    const results = await Promise.allSettled([
      Client.find({}).select("_id name status").lean(),
      Project.find(isAdmin ? {} : { _id: { $in: scopeProjectIds || [] } }).select("_id name clientId status").lean(),
      Site.find({}).select("_id name projectId status").lean(),
      Material.find(projectScope).select("_id name quantity unit projectId siteId status").limit(200).lean(),
      Labour.find(projectScope).select("_id workerName labourType projectId siteId date status").limit(200).lean(),
      Expense.find(projectScope).select("_id description amount date projectId siteId status").limit(200).lean(),
      Payment.find(projectScope).select("_id amount date projectId mode status").limit(200).lean(),
      Vendor.find({}).select("_id name materialType phone").limit(200).lean(),
      Subcontractor.find(projectScope).select("_id subcontractorName workPackage projectId").limit(200).lean(),
      Inventory.find({}).select("_id name quantity unit projectId siteId").limit(200).lean(),
      Attendance.find({ date: today, ...projectScope }).select("_id workerId date shift status").limit(500).lean(),
    ]);

    const unwrap = (r: PromiseSettledResult<unknown[]>, fallback: unknown[] = []) =>
      r.status === "fulfilled" ? r.value : fallback;

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
    ] = results.map((r) => (r.status === "fulfilled" ? r.value : []));

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
      counts: {
        clients: clients.length,
        projects: projects.length,
        sites: sites.length,
        materials: materials.length,
        labour: labour.length,
        expenses: expenses.length,
        payments: payments.length,
        vendors: vendors.length,
        subcontractors: subcontractors.length,
        inventory: inventory.length,
        attendance: attendance.length,
      },
      fetchedAt: Date.now(),
    });
  } catch (e) {
    next(e);
  }
}