import { Request, Response, NextFunction } from "express";
import * as invoiceService from "../services/invoice.service.js";

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoiceService.createInvoice(req.body);
    res.status(201).json({ invoice });
  } catch (e) { next(e); }
}

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await invoiceService.listInvoices({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    res.json({ invoice });
  } catch (e) { next(e); }
}

export async function updateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
    res.json({ invoice });
  } catch (e) { next(e); }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    await invoiceService.deleteInvoice(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}