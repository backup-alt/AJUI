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
    vendorId: objectIdSchema.optional(),
    poNumber: z.string().trim().optional(),
    requestDate: z.string().min(1),
    issuedAmount: z.coerce.number().nonnegative().optional(),
    notes: z.string().trim().max(2000).optional(),
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
    transactionType: z.enum(["Purchase", "Cash Added"]).optional(),
    amount: z.coerce.number().nonnegative(),
    date: z.string().min(1),
    description: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(2000).optional(),
    isSiteMaterial: z.boolean().optional(),
    materialName: z.string().trim().optional(),
    materialUnit: z.string().trim().optional(),
    materialQuantity: z.coerce.number().nonnegative().optional(),
    materialVendor: z.string().trim().optional(),
    materialVendorId: objectIdSchema.optional(),
    issuedAmount: z.coerce.number().nonnegative().optional(),
    customFields: z.record(z.unknown()).optional(),
  }),
});

export const uploadExpenseReceiptMobileSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    data: z.string().min(20),
    mimeType: z.string().min(1).max(120),
    fileName: z.string().max(200).optional(),
    received: z.boolean().optional(),
  }),
});

export const updateMaterialStockSchema = z.object({
  body: z.object({
    purchasedQuantity: z.coerce.number().nonnegative().optional(),
    consumedQuantity: z.coerce.number().nonnegative().optional(),
  }),
});

export const updateMaterialReceivedSchema = z.object({
  body: z.object({
    received: z.boolean(),
  }),
});

/**
 * Schema for "Add Existing Material" workflow (supervisor mobile app).
 *
 * Supervisors record materials that ALREADY exist at the site. No approval
 * workflow is involved — the record is saved directly to the Inventory
 * collection (or upserted if it already exists for that site/unit).
 *
 * If a record with the same (projectId, siteId, name, unit) exists, the
 * quantities are ADDED to the existing record. Otherwise a new record
 * is created.
 */
export const addExistingMaterialMobileSchema = z.object({
  body: z.object({
    projectId: objectIdSchema,
    siteId: objectIdSchema.optional(),
    site: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(200),
    unit: z.string().trim().min(1).max(50),
    quantity: z.coerce.number().nonnegative().default(0),
    vendor: z.string().trim().max(200).optional(),
    vendorId: objectIdSchema.optional(),
    poNumber: z.string().trim().max(100).optional(),
    minimumQuantity: z.coerce.number().nonnegative().optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
});

export const approvalActionSchema = z.object({
  body: z.object({
    action: z.enum(["approve", "reject"]),
    comment: z.string().trim().optional(),
  }),
});

// =================== WORKER SCHEMAS ===================
export const createWorkerSchema = z.object({
  body: z.object({
    projectId: objectIdSchema,
    siteId: objectIdSchema.optional(),
    site: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().max(500).optional(),
    // Optional on the wire — the mobile supervisor form does not collect
    // these today, but the web admin "Add Worker" dialog does. Validation
    // is permissive so existing mobile clients keep working.
    phone: z.string().trim().max(32).optional(),
    notes: z.string().trim().max(1000).optional(),
    labourType: z.string().trim().min(1).max(100),
    // The supervisor mobile worker-create form no longer collects
    // weeklyPay (per-project wages are tracked via admin-side custom
    // fields). It remains available for the web admin / API clients.
    weeklyPay: z.coerce.number().nonnegative().min(0).optional(),
    isSubcontract: z.boolean().default(false),
    subcontractorId: z.string().trim().min(1).max(100).optional(),
    subcontractorName: z.string().trim().max(200).optional(),
    // For non-subcontract workers: the supervising user responsible
    // for this worker. Required when isSubcontract=false.
    supervisorId: objectIdSchema.optional(),
    supervisorName: z.string().trim().max(200).optional(),
  })
  // Cross-field rule: at most one of (subcontractorId, supervisorId)
  // is set. Enforced at the controller/service layer; Zod refinement
  // here would force a breaking order-of-keys check.
});

export const markAttendanceSchema = z.object({
  body: z.object({
    workerId: objectIdSchema,
    projectId: objectIdSchema,
    siteId: objectIdSchema.optional(),
    site: z.string().trim().min(1).max(200),
    attendanceDate: z.string().min(1).refine(
      (val) => {
        const date = new Date(val + "T00:00:00");
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return !isNaN(date.getTime()) && date <= today;
      },
      { message: "Attendance cannot be marked for future dates" }
    ),
    shiftCount: z.coerce.number().int().min(1).max(2).default(1),
    overtimeHours: z.coerce.number().nonnegative().default(0),
    overtimeAmount: z.coerce.number().nonnegative().default(0),
    lateFine: z.coerce.number().nonnegative().default(0),
    paymentMode: z.enum(["Cash", "NEFT", "UPI", "Cheque"]).default("Cash"),
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const updateAttendanceSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    shiftCount: z.coerce.number().int().min(1).max(2).optional(),
    overtimeHours: z.coerce.number().nonnegative().optional(),
    overtimeAmount: z.coerce.number().nonnegative().optional(),
    lateFine: z.coerce.number().nonnegative().optional(),
    paymentMode: z.enum(["Cash", "NEFT", "UPI", "Cheque"]).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
});

// ----- Bulk sub-contractor attendance (mobile) -----
// Captures the daily muster as a list of (labourType, count) pairs per
// sub-contractor. No individual worker data is stored — the user wants
// the headcount only.
export const bulkAttendanceEntrySchema = z.object({
  labourType: z.string().trim().min(1).max(80),
  count: z.coerce.number().int().min(0).max(1000).default(0),
});

export const markBulkAttendanceSchema = z.object({
  body: z.object({
    subcontractorId: objectIdSchema,
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    siteName: z.string().trim().max(200).optional(),
    attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)").refine(
      (val) => {
        const date = new Date(val + "T00:00:00");
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return !isNaN(date.getTime()) && date <= today;
      },
      { message: "Attendance cannot be marked for future dates" }
    ),
    entries: z.array(bulkAttendanceEntrySchema).default([]),
    shifts: z.number().int().min(1).max(2).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const createQuickSubcontractorSchema = z.object({
  body: z.object({
    subcontractorName: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(40).optional(),
    address: z.string().trim().max(500).optional(),
    // The supervisor's currently-selected project is used as a fallback
    // when this is omitted (the most common case when adding a fresh
    // sub-contractor from the attendance screen).
    projectId: objectIdSchema.optional(),
  }),
});

