import { Quotation, IQuotation } from "../models/Quotation.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";

export async function createQuotation(input: Partial<IQuotation> & { quotationNumber: string }) {
  try {
    const quotation = await Quotation.create({ ...input, archived: false });
    return quotation.toObject();
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new AppError(409, `Quotation ${input.quotationNumber} already exists`);
    }
    throw err;
  }
}

export async function listQuotations(filter: { search?: string; status?: string; page?: number; limit?: number; includeArchived?: boolean } = {}) {
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

  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Quotation.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Quotation.countDocuments(query),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getQuotationById(id: string) {
  const quotation = await Quotation.findById(id).lean();
  if (!quotation) throw new AppError(404, "Quotation not found");
  return quotation;
}

export async function updateQuotation(id: string, patch: Partial<IQuotation>) {
  const quotation = await Quotation.findByIdAndUpdate(id, patch, { new: true });
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