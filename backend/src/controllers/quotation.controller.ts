import { Request, Response, NextFunction } from "express";
import * as quotationService from "../services/quotation.service.js";

export async function createQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const quotationNumber = await quotationService.getNextQuotationNumber();
    const quotation = await quotationService.createQuotation({
      ...req.body,
      quotationNumber,
    });
    res.status(201).json({ quotation });
  } catch (e) { next(e); }
}

export async function listQuotations(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quotationService.listQuotations({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const quotation = await quotationService.getQuotationById(req.params.id);
    res.json({ quotation });
  } catch (e) { next(e); }
}

export async function updateQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const quotation = await quotationService.updateQuotation(req.params.id, req.body);
    res.json({ quotation });
  } catch (e) { next(e); }
}

export async function deleteQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    await quotationService.deleteQuotation(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}