import { Request, Response, NextFunction } from "express";
import * as dashboardService from "../services/dashboard.service.js";
import * as reportService from "../services/report.service.js";

export async function getKPIs(_req: Request, res: Response, next: NextFunction) {
  try {
    const kpis = await dashboardService.getDashboardKPIs();
    res.json({ kpis });
  } catch (e) { next(e); }
}

export async function getUniversalDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dashboardService.getUniversalDashboard({
      projectId: req.query.projectId as string | undefined,
      clientId: req.query.clientId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    res.json(data);
  } catch (e) { next(e); }
}

// Reports
export async function createReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await reportService.createReport(req.body);
    res.status(201).json({ report });
  } catch (e) { next(e); }
}

export async function listReports(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reportService.listReports({
      category: req.query.category as never,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await reportService.getReportById(req.params.id);
    res.json({ report });
  } catch (e) { next(e); }
}

export async function updateReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await reportService.updateReport(req.params.id, req.body);
    res.json({ report });
  } catch (e) { next(e); }
}

export async function deleteReport(req: Request, res: Response, next: NextFunction) {
  try {
    await reportService.deleteReport(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function generateReport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reportService.generateReport(req.params.id);
    res.json(result);
  } catch (e) { next(e); }
}
