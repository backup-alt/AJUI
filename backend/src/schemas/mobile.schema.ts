import { z } from "zod";

export const updateOwnProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().min(8).max(20).optional(),
    address: z.string().trim().optional(),
  }),
});

export const registerDeviceSchema = z.object({
  body: z.object({
    fcmToken: z.string().min(10),
    platform: z.enum(["ios", "android", "web"]),
    deviceId: z.string().optional(),
    appVersion: z.string().optional(),
  }),
});

export const unregisterDeviceSchema = z.object({
  body: z.object({
    fcmToken: z.string().min(10),
  }),
});

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid ObjectId");

// =================== MOBILE CREATE SCHEMAS ===================
export const createMaterialMobileSchema = z.object({
  body: z.object({
    projectId: objectIdSchema,
    siteId: objectIdSchema.optional(),
    site: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(200),
    unit: z.string().trim().min(1).max(50),
    requestedQuantity: z.coerce.number().nonnegative().default(0),
    remainingStock: z.coerce.number().nonnegative().optional(),
    vendor: z.string().trim().optional(),
    poNumber: z.string().trim().optional(),
    requestDate: z.string().min(1),
  }),
});

export const createLabourMobileSchema = z.object({
  body: z.object({
    projectId: objectIdSchema,
    siteId: objectIdSchema.optional(),
    site: z.string().trim().min(1).max(200),
    partyName: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(100),
    attendanceDate: z.string().min(1),
    presentCount: z.coerce.number().int().nonnegative().default(0),
    presentDays: z.coerce.number().int().nonnegative().default(0),
    absentDays: z.coerce.number().int().nonnegative().default(0),
    dailyWage: z.coerce.number().nonnegative().default(0),
    overtime: z.coerce.number().nonnegative().default(0),
    lateFine: z.coerce.number().nonnegative().default(0),
    shift: z.enum(["Day", "Night", "Evening"]).default("Day"),
    paymentMode: z.enum(["Cash", "NEFT", "UPI", "Cheque"]).default("Cash"),
    wagePeriod: z.string().optional(),
    laborTypes: z
      .array(
        z.object({
          name: z.string().min(1),
          dailyWage: z.coerce.number().nonnegative().default(0),
          staffCount: z.coerce.number().int().nonnegative().default(0),
        })
      )
      .default([]),
    notes: z.string().optional(),
  }),
});

export const createExpenseMobileSchema = z.object({
  body: z.object({
    type: z.enum(["site", "general"]).default("site"),
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    site: z.string().trim().optional(),
    transactionType: z.string().trim().optional(),
    reference: z.string().trim().optional(),
    category: z.string().trim().optional(),
    amountPaidBy: z.string().trim().optional(),
    amount: z.coerce.number().nonnegative(),
    date: z.string().min(1),
    description: z.string().trim().min(1).max(500),
  }),
});

export const updateMaterialStockSchema = z.object({
  body: z.object({
    purchasedQuantity: z.coerce.number().nonnegative().optional(),
    consumedQuantity: z.coerce.number().nonnegative().optional(),
  }),
});

export const approvalActionSchema = z.object({
  body: z.object({
    action: z.enum(["approve", "reject"]),
    comment: z.string().trim().optional(),
  }),
});
