import { Quotation, IQuotation } from "../models/Quotation.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { paginateByCursor } from "../utils/cursor-pagination.js";

const MAX_CREATE_ATTEMPTS = 3;

/**
 * Normalise every line item so that the client-generated `id` and the
 * optional `parentRowId` are always persisted verbatim, regardless of any
 * Mongoose update casting quirks. This guarantees the parent / child
 * hierarchy survives a save → reload round-trip.
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

export async function createQuotation(input: Partial<IQuotation> & { quotationNumber: string }) {
  let lastError: any;
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    try {
      const num = await generateId("QUO", 4);
      const quotation = await Quotation.create({
        ...input,
        quotationNumber: num,
        items: normalizeItems(input.items),
        archived: false,
      });
      return quotation.toObject();
    } catch (err: any) {
      lastError = err;
      if (err?.code !== 11000 || attempt === MAX_CREATE_ATTEMPTS - 1) {
        if (err?.code === 11000) {
          throw new AppError(409, `Quotation ${input.quotationNumber} already exists — please retry`);
        }
        throw err;
      }
    }
  }
  throw lastError;
}

export async function listQuotations(filter: { search?: string; status?: string; page?: number; limit?: number; cursor?: string; includeArchived?: boolean } = {}) {
  const query: Record<string, unknown> = {};
  if (!filter.includeArchived) query.archived = false;
  if (filter.status) query.status = filter.status;
  if (filter.search) {
    query.$or = [
      { quotationNumber: { $regex: filter.search, $options: "i" } },
      { clientName: { $regex: filter.search, $options: "i" } },
      { companyName: { $regex: filter.search, $options: "i" } },
    ];
  }

  const result = await paginateByCursor(Quotation, query, {
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
  });
  return { items: result.items, total: result.total, page: result.page, limit: result.limit, totalPages: result.pages, nextCursor: result.nextCursor };
}

export async function getQuotationById(id: string) {
  const quotation = await Quotation.findById(id).lean();
  if (!quotation) throw new AppError(404, "Quotation not found");
  return quotation;
}

export async function updateQuotation(id: string, patch: Partial<IQuotation>) {
  const update: Partial<IQuotation> = { ...patch };
  if (patch.items) update.items = normalizeItems(patch.items);
  const quotation = await Quotation.findByIdAndUpdate(id, update, { new: true });
  if (!quotation) throw new AppError(404, "Quotation not found");
  return quotation.toObject();
}

export async function deleteQuotation(id: string) {
  const result = await Quotation.findByIdAndUpdate(id, { archived: true }, { new: true });
  if (!result) throw new AppError(404, "Quotation not found");
}

export async function getNextQuotationNumber(): Promise<string> {
  return generateId("QUO", 4);
}