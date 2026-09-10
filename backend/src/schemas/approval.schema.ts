import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid ObjectId");

// HIGH-2 fix: Add validation for approval action amounts
export const approveRequestSchema = z.object({
  body: z.object({
    issuedAmount: z.coerce.number().nonnegative().max(10_00_00_000).optional(), // 10 crore max
    givenAmount: z.coerce.number().nonnegative().max(10_00_00_000).optional(),
    approvedAmount: z.coerce.number().nonnegative().max(10_00_00_000).optional(),
    approvedQuantity: z.coerce.number().nonnegative().max(1_000_000).optional(), // 1M max quantity
    vendor: z.string().trim().max(200).optional(),
    poNumber: z.string().trim().max(100).optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
});

export const rejectRequestSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
