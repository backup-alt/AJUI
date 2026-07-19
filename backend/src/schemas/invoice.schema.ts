import { z } from "zod";
import { objectIdSchema } from "./financial.schema.js";

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1),
  hsnCode: z.string().optional(),
  unit: z.string().default(""),
  qty: z.coerce.number().default(0),
  rate: z.coerce.number().default(0),
  amount: z.coerce.number().default(0),
  isCustom: z.boolean().optional(),
});

export const createInvoiceSchema = z.object({
  body: z.object({
    date: z.string().optional(),
    companyName: z.string().optional(),
    companyAddress: z.string().optional(),
    state: z.string().optional(),
    gstin: z.string().optional(),
    clientName: z.string().trim().min(1),
    clientAddress: z.string().optional(),
    clientState: z.string().optional(),
    clientGstin: z.string().optional(),
    items: z.array(invoiceItemSchema).default([]),
    customColumns: z.array(z.string()).default([]),
    subtotal: z.coerce.number().default(0),
    cgstPercent: z.coerce.number().default(9),
    sgstPercent: z.coerce.number().default(9),
    cgstAmount: z.coerce.number().default(0),
    sgstAmount: z.coerce.number().default(0),
    roundOff: z.coerce.number().default(0),
    totalAmount: z.coerce.number().default(0),
    amountInWords: z.string().optional(),
    supplyType: z.enum(["Intrastate", "Interstate"]).optional(),
    status: z.enum(["Draft", "Sent", "Paid"]).default("Draft"),
  }),
});

export const updateInvoiceSchema = z.object({
  body: createInvoiceSchema.shape.body.partial(),
  params: z.object({ id: objectIdSchema }),
});

export const listInvoicesSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(["Draft", "Sent", "Paid"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>["body"];