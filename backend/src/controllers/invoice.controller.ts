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
      cursor: req.query.cursor as string | undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
}

/**
 * Production hydration endpoint: returns EVERY non-archived invoice in a
 * single HTTP round-trip. Mirrors the materials/inventory/expenses
 * pattern — single-shot query with cursor-walk fallback, never throws,
 * always returns an array.
 */
export async function listAllInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const t0 = Date.now();
    const items = await invoiceService.listAllInvoices({
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      max: req.query.max ? Number(req.query.max) : undefined,
    });
    const dt = Date.now() - t0;
    console.log(`[invoices/all] returned ${items.length} items in ${dt}ms`);
    res.json({ items, total: items.length, count: items.length, durationMs: dt });
  } catch (err) {
    if (res.headersSent) {
      console.error("[invoices/all] error after headers sent:", (err as Error).message);
      return;
    }
    console.error("[invoices/all] unexpected failure:", (err as Error).message);
    res.status(503).json({
      error: "Database temporarily unavailable, please retry",
      items: [],
      total: 0,
      count: 0,
    });
  }
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