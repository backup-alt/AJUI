import { z } from "zod";
import { objectIdSchema } from "./financial.schema.js";

const quotationItemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required"),
  unit: z.string().trim().max(40).optional().default(""),
  qty: z.coerce.number().min(0).default(0),
  rate: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().min(0).default(0),
  isCustom: z.boolean().optional().default(false),
});

export const createQuotationSchema = z.object({
  body: z.object({
    quotationNumber: z.string().trim().min(1).optional(),
    date: z.string().trim().default(""),
    companyName: z.string().trim().max(200).default(""),
    companyAddress: z.string().trim().max(500).default(""),
    state: z.string().trim().max(100).default(""),
    gstin: z.string().trim().max(40).default(""),
    clientName: z.string().trim().max(200).default(""),
    clientAddress: z.string().trim().max(500).default(""),
    clientState: z.string().trim().max(100).default(""),
    clientGstin: z.string().trim().max(40).default(""),
    items: z.array(quotationItemSchema).default([]),
    customColumns: z.array(z.string()).default([]),
    subtotal: z.coerce.number().min(0).default(0),
    cgstPercent: z.coerce.number().min(0).max(100).default(0),
    sgstPercent: z.coerce.number().min(0).max(100).default(0),
    cgstAmount: z.coerce.number().min(0).default(0),
    sgstAmount: z.coerce.number().min(0).default(0),
    roundOff: z.coerce.number().default(0),
    totalAmount: z.coerce.number().min(0).default(0),
    amountInWords: z.string().trim().max(500).default(""),
    status: z.enum(["Draft", "Sent", "Accepted", "Rejected"]).default("Draft"),
  }),
});

export const updateQuotationSchema = z.object({
  body: createQuotationSchema.shape.body.partial(),
  params: z.object({ id: objectIdSchema }),
});

export const listQuotationsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(["Draft", "Sent", "Accepted", "Rejected"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>["body"];
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>["body"];
