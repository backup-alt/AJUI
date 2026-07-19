import { Invoice, IInvoice } from "../models/Invoice.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";

const MAX_CREATE_ATTEMPTS = 3;

export async function createInvoice(input: Partial<IInvoice>) {
  let lastError: any;
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    try {
      const num = await generateId("INV", 4);
      const invoice = await Invoice.create({ ...input, invoiceNumber: num, archived: false });
      return invoice.toObject();
    } catch (err: any) {
      lastError = err;
      if (err?.code !== 11000 || attempt === MAX_CREATE_ATTEMPTS - 1) {
        if (err?.code === 11000) {
          throw new AppError(409, "Invoice number conflict — please retry");
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

  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(query),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getInvoiceById(id: string) {
  const invoice = await Invoice.findById(id).lean();
  if (!invoice) throw new AppError(404, "Invoice not found");
  return invoice;
}

export async function updateInvoice(id: string, patch: Partial<IInvoice>) {
  const invoice = await Invoice.findByIdAndUpdate(id, patch, { new: true });
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