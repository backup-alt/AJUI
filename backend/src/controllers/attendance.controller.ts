import { Request, Response } from "express";
import { listGroupedAttendance, getLabourReport } from "../services/attendance.service.js";
import { getScopedProjectIds } from "../middleware/rbac.js";

export async function getGroupedAttendance(req: Request, res: Response) {
  const projectId = req.query.projectId as string;
  const from = req.query.from as string;
  const to = req.query.to as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const scopeProjectIds = await getScopedProjectIds(req);

  const result = await listGroupedAttendance({
    projectId,
    from,
    to,
    page,
    limit,
    scopeProjectIds,
  });

  res.json(result);
}

export async function getLabourReportHandler(req: Request, res: Response) {
  const projectId = req.query.projectId as string;
  const from = req.query.from as string;
  const to = req.query.to as string;

  const scopeProjectIds = await getScopedProjectIds(req);

  const result = await getLabourReport({
    projectId,
    from,
    to,
    scopeProjectIds,
  });

  res.json(result);
}