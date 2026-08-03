import { Invoice, IInvoice } from "../models/Invoice.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { findAllOrFallback } from "../utils/find-all.js";
import { paginateByCursor } from "../utils/cursor-pagination.js";

const MAX_CREATE_ATTEMPTS = 3;

/**
 * Normalise every line item so the client-generated `id` and the optional
 * `parentRowId` are always persisted verbatim, guaranteeing the parent /
 * child hierarchy survives a save → reload round-trip.
 */
function normalizeItems(items: any[] | undefined): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = (raw && typeof raw === "object") ? raw : {};
    return {
      ...item,
      id: item.id != null ? String(item.id) : null,
      parentRowId:
        item.parentRowId === null || item.parentRowId === undefined
          ? null
          : String(item.parentRowId),
    };
  });
}

export async function createInvoice(input: Partial<IInvoice>) {
  let lastError: any;
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    try {
      const num = await generateId("INV", 4);
      const invoice = await Invoice.create({
        ...input,
        invoiceNumber: num,
        items: normalizeItems(input.items),
        archived: false,
      });
      return invoice.toObject();
    } catch (err: any) {
      lastError = err;
      if (err?.code !== 11000 || attempt === MAX_CREATE_ATTEMPTS - 1) {
        if (err?.code === 11000) {
          throw new AppError(409, `Invoice number conflict — please retry`);
        }
        throw err;
      }
    }
  }
throw lastError;
}

export async function listInvoices(filter: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  cursor?: string;
} = {}) {
  const query: Record<string, unknown> = { archived: false };
  if (filter.status) query.status = filter.status;
  if (filter.search) {
    query.$or = [
      { invoiceNumber: { $regex: filter.search, $options: "i" } },
      { clientName: { $regex: filter.search, $options: "i" } },
      { companyName: { $regex: filter.search, $options: "i" } },
    ];
  }

  const result = await paginateByCursor(Invoice, query, {
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
  });
  return { items: result.items, total: result.total, page: result.page, limit: result.limit, totalPages: result.pages, nextCursor: result.nextCursor };
}

export async function getInvoiceById(id: string) {
  const invoice = await Invoice.findById(id).lean();
  if (!invoice) throw new AppError(404, "Invoice not found");
  return invoice;
}

export async function updateInvoice(id: string, patch: Partial<IInvoice>) {
  const update: Partial<IInvoice> = { ...patch };
  if (patch.items) update.items = normalizeItems(patch.items);
  const invoice = await Invoice.findByIdAndUpdate(id, update, { new: true });
  if (!invoice) throw new AppError(404, "Invoice not found");
  return invoice.toObject();
}

export async function deleteInvoice(id: string) {
  const result = await Invoice.findByIdAndUpdate(id, { archived: true }, { new: true });
  if (!result) throw new AppError(404, "Invoice not found");
}

export async function getNextInvoiceNumber(): Promise<string> {
  return generateId("INV", 4);
}

/**
 * Single-shot "give me everything" endpoint — mirrors the materials/
 * inventory/expenses pattern. Tries one query with 15s maxTimeMS, falls
 * back to a cursor walk that always returns data (never throws).
 */
export async function listAllInvoices(filter: {
  status?: string;
  search?: string;
  max?: number;
}): Promise<any[]> {
  const query: Record<string, unknown> = { archived: false };
  if (filter.status) query.status = filter.status;
  if (filter.search) {
    query.$or = [
      { invoiceNumber: { $regex: filter.search, $options: "i" } },
      { clientName: { $regex: filter.search, $options: "i" } },
      { companyName: { $regex: filter.search, $options: "i" } },
    ];
  }
  return findAllOrFallback(Invoice, "invoices/all", query, filter.max ?? 500);
}