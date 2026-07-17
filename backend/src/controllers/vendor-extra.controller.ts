import { Request, Response, NextFunction } from "express";
import * as service from "../services/vendor-extra.service.js";

export async function addCustomColumn(req: Request, res: Response, next: NextFunction) {
  try {
    const column = await service.addCustomColumn(req.body);
    res.status(201).json({ column });
  } catch (e) { next(e); }
}

export async function removeCustomColumn(req: Request, res: Response, next: NextFunction) {
  try {
    const { vendorName, siteName, columnKey } = req.query as Record<string, string>;
    const result = await service.removeCustomColumn(vendorName, siteName, columnKey);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function listCustomColumns(req: Request, res: Response, next: NextFunction) {
  try {
    const { vendorName, siteName } = req.query as Record<string, string>;
    const items = await service.listCustomColumns(vendorName, siteName);
    res.json({ items });
  } catch (e) { next(e); }
}

export async function upsertBillLink(req: Request, res: Response, next: NextFunction) {
  try {
    const link = await service.upsertBillLink(req.body);
    res.json({ link });
  } catch (e) { next(e); }
}

export async function listBillLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const { vendorName, siteName } = req.query as Record<string, string>;
    const items = await service.listBillLinks(vendorName, siteName);
    res.json({ items });
  } catch (e) { next(e); }
}

export async function removeBillLink(req: Request, res: Response, next: NextFunction) {
  try {
    const { vendorName, siteName, materialId } = req.query as Record<string, string>;
    const result = await service.removeBillLink(vendorName, siteName, materialId);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}
