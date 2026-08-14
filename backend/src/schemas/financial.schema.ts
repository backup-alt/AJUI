import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid ObjectId");

export const createMaterialSchema = z.object({
  body: z.object({
    projectId: objectIdSchema.optional().nullable(),
    siteId: objectIdSchema.optional(),
    site: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(200),
    unit: z.string().trim().min(1).max(50),
    requestedQuantity: z.coerce.number().nonnegative().default(0),
    approvedQuantity: z.coerce.number().nonnegative().optional(),
    purchasedQuantity: z.coerce.number().nonnegative().default(0),
    consumedQuantity: z.coerce.number().nonnegative().default(0),
    vendor: z.string().trim().optional(),
    vendorId: objectIdSchema.optional(),
    poNumber: z.string().trim().optional(),
    requestDate: z.string().min(1),
    issuedAmount: z.coerce.number().nonnegative().optional(),
    givenAmount: z.coerce.number().nonnegative().optional(),
    notes: z.string().trim().max(2000).optional(),
    createdBy: z.string().trim().optional(),
  }),
});

export const updateMaterialSchema = z.object({
  body: createMaterialSchema.shape.body.partial().extend({
    customFields: z.record(z.unknown()).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const listMaterialsSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    site: z.string().trim().optional(),
    vendorId: objectIdSchema.optional(),
    type: z.enum(["received", "notReceived"]).optional(),
    status: z.enum(["Received", "Not Received"]).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(200),
    cursor: z.string().optional(),
  }),
});

export const laborTypeSchema = z.object({
  name: z.string().trim().min(1),
  dailyWage: z.coerce.number().nonnegative().default(0),
  staffCount: z.coerce.number().int().nonnegative().default(0),
});

export const createLabourSchema = z.object({
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
    laborTypes: z.array(laborTypeSchema).default([]),
    notes: z.string().optional(),
    submittedBy: z.string().trim().optional(),
  }),
});

export const updateLabourSchema = z.object({
  body: createLabourSchema.shape.body.partial().extend({
    customFields: z.record(z.unknown()).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const listLabourSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    site: z.string().trim().optional(),
    category: z.string().optional(),
    status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(200),
    cursor: z.string().optional(),
  }),
});

export const expenseBaseSchema = z.object({
  type: z.enum(["site", "general"]),
  projectId: objectIdSchema.optional(),
  siteId: objectIdSchema.optional(),
  site: z.string().trim().optional(),
  supervisor: z.string().trim().optional(),
  supervisorId: objectIdSchema.optional(),
  transactionType: z.enum(["Purchase", "Cash Added"]).optional(),
  siteMaterialBalance: z.coerce.number().optional(),
  receiptImageName: z.string().optional(),
  amount: z.coerce.number().nonnegative(),
  date: z.string().min(1),
  description: z.string().trim().min(1).max(500),
  notes: z.string().trim().max(2000).optional(),
  submittedBy: z.string().trim().optional(),
  isSiteMaterial: z.boolean().optional(),
  materialName: z.string().trim().optional(),
  materialUnit: z.string().trim().optional(),
  materialQuantity: z.coerce.number().nonnegative().optional(),
  materialVendor: z.string().trim().optional(),
  materialVendorId: objectIdSchema.optional(),
  materialRemainingStock: z.coerce.number().nonnegative().optional(),
  issuedAmount: z.coerce.number().nonnegative().optional(),
  givenAmount: z.coerce.number().nonnegative().optional(),
  received: z.boolean().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const createExpenseSchema = z.object({
  body: expenseBaseSchema
    .refine(
      (data) => data.type !== "site" || !!data.projectId,
      { message: "projectId is required for site expenses", path: ["projectId"] }
    )
    .refine(
      (data) => data.type !== "site" || !!data.transactionType,
      { message: "transactionType is required for site expenses", path: ["transactionType"] }
    ),
});

export const updateExpenseSchema = z.object({
  body: expenseBaseSchema.partial().extend({
    customFields: z.record(z.unknown()).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const uploadExpenseReceiptSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    data: z.string().min(20, "Receipt data is required"),
    mimeType: z.string().min(1).max(120),
    fileName: z.string().max(200).optional(),
  }),
});

export const listExpensesSchema = z.object({
  query: z.object({
    type: z.enum(["site", "general"]).optional(),
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    site: z.string().trim().optional(),
    status: z.enum(["Pending", "Approved", "Rejected", "Completed"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(200),
    cursor: z.string().optional(),
  }),
});

export const createPaymentSchema = z.object({
  body: z.object({
    projectId: objectIdSchema,
    clientId: objectIdSchema,
    date: z.string().min(1),
    amount: z.coerce.number().nonnegative(),
    mode: z.enum(["Cash", "Bank Transfer", "Cheque", "UPI", "NEFT"]),
    receiptNumber: z.string().trim().optional(),
    transactionReference: z.string().trim().optional(),
    collectedBy: z.string().trim().min(1),
    notes: z.string().optional(),
  }),
});

export const updatePaymentSchema = z.object({
  body: createPaymentSchema.shape.body.partial().extend({
    customFields: z.record(z.unknown()).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const listPaymentsSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    clientId: objectIdSchema.optional(),
    status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
    mode: z.enum(["Cash", "Bank Transfer", "Cheque", "UPI", "NEFT"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(200),
    cursor: z.string().optional(),
  }),
});

export const createVendorSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    materialType: z.string().trim().min(1).max(100),
    materialBoard: z.string().trim().optional(),
    phone: z.string().trim().min(8).max(20),
    email: z.string().email().optional(),
    address: z.string().trim().min(1).max(500),
    gstNumber: z.string().trim().optional(),
    rating: z.coerce.number().min(0).max(5).default(0),
    status: z.enum(["Active", "Inactive", "Not Active"]).default("Active"),
    siteIds: z.array(objectIdSchema).min(0).optional(),
  }),
});

export const updateVendorSchema = z.object({
  body: createVendorSchema.shape.body.partial().extend({
    siteIds: z.array(objectIdSchema).min(0).optional(),
    customFields: z.record(z.unknown()).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const listVendorsSchema = z.object({
  query: z.object({
    materialType: z.string().optional(),
    status: z.enum(["Active", "Inactive", "Not Active"]).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(200),
    cursor: z.string().optional(),
  }),
});

export const createSubcontractorSchema = z.object({
  body: z.object({
    projectId: objectIdSchema,
    subcontractorName: z.string().trim().min(1).max(200),
    description: z.string().trim().max(500).optional().default(""),
    employeeCount: z.coerce.number().int().nonnegative().optional(),
    note: z.string().trim().max(1000).optional().default(""),
    address: z.string().trim().max(500).optional().default(""),
    phone: z.string().trim().max(40).optional().default(""),
    status: z.enum(["active", "inactive"]).optional().default("active"),
    payments: z
      .array(
        z.object({
          amount: z.coerce.number().nonnegative(),
          date: z.string().min(1),
          note: z.string().trim().max(500).optional(),
        })
      )
      .optional(),
  }),
});

export const updateSubcontractorSchema = z.object({
  body: createSubcontractorSchema.shape.body.partial().extend({
    customFields: z.record(z.unknown()).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const addSubcontractorPaymentSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive(),
    date: z.string().min(1),
    note: z.string().trim().max(500).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const createSubcontractorPaymentSchema = z.object({
  body: z.object({
    subcontractorId: objectIdSchema,
    projectId: objectIdSchema,
    siteId: objectIdSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must be YYYY-MM-DD"),
    description: z.string().trim().max(500).optional().default(""),
    employeeCount: z.coerce.number().int().min(1),
    amount: z.coerce.number().positive(),
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const createSubcontractorLaborSchema = z.object({
  body: z.object({
    subcontractorId: objectIdSchema,
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().max(500).optional().default(""),
    phone: z.string().trim().min(5).max(40),
    role: z.string().trim().min(1).max(100),
    notes: z.string().trim().max(1000).optional().default(""),
  }),
});

export const updateSubcontractorLaborSchema = z.object({
  body: createSubcontractorLaborSchema.shape.body.omit({ subcontractorId: true }).partial(),
  params: z.object({ id: objectIdSchema }),
});

const purchaseOrderItemSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("existing"),
    materialId: objectIdSchema,
    rate: z.coerce.number().nonnegative(),
    gstPercent: z.coerce.number().min(0).max(100),
  }),
  z.object({
    source: z.literal("manual"),
    materialId: objectIdSchema.optional(),
    description: z.string().trim().min(1).max(200),
    unit: z.string().trim().min(1).max(50),
    quantity: z.coerce.number().positive(),
    rate: z.coerce.number().nonnegative(),
    gstPercent: z.coerce.number().min(0).max(100),
  }),
]);

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    projectId: objectIdSchema,
    vendorId: objectIdSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must be YYYY-MM-DD"),
    items: z.array(purchaseOrderItemSchema).min(1),
    roundOff: z.coerce.number().min(-1000).max(1000).optional().default(0),
  }),
});

export const updatePurchaseOrderSchema = z.object({
  body: z.object({
    vendorId: objectIdSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must be YYYY-MM-DD"),
    items: z.array(purchaseOrderItemSchema).min(1),
    roundOff: z.coerce.number().min(-1000).max(1000).optional().default(0),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const listPurchaseOrdersSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
  }),
});

export const createGstRateSchema = z.object({
  body: z.object({ rate: z.coerce.number().min(0).max(100) }),
});

export const updateSubcontractorPaymentSchema = z.object({
  body: createSubcontractorPaymentSchema.shape.body.partial().extend({
    // Allow clearing the site by sending an empty string.
    siteId: z.union([objectIdSchema, z.literal("")]).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const listSubcontractorPaymentsSchema = z.object({
  query: z.object({
    subcontractorId: objectIdSchema.optional(),
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    cursor: z.string().optional(),
  }),
});

export const listSubcontractorsSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    status: z.enum(["active", "inactive"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    cursor: z.string().optional(),
  }),
});

export const createApprovalSchema = z.object({
  body: z.object({
    type: z.enum(["material", "labour", "expense", "payment", "subcontract"]),
    sourceCollection: z.string(),
    sourceId: objectIdSchema,
    title: z.string().trim().min(1),
    detail: z.string().optional(),
  }),
});

export const approvalActionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const listApprovalsSchema = z.object({
  query: z.object({
    type: z.enum(["material", "labour", "expense", "payment", "subcontract"]).optional(),
    projectId: objectIdSchema.optional(),
    status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(200),
    cursor: z.string().optional(),
  }),
});

export const listInventorySchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(200),
    cursor: z.string().optional(),
  }),
});

export const missingMaterialsForSiteSchema = z.object({
  query: z.object({
    siteId: objectIdSchema,
  }),
});

export const initializeInventorySchema = z.object({
  body: z.object({
    siteId: objectIdSchema,
    items: z.array(z.object({
      materialId: objectIdSchema,
      quantity: z.coerce.number().nonnegative(),
    })).min(1),
  }),
});

export const addInventoryMaterialSchema = z.object({
  body: z.object({
    siteId: objectIdSchema,
    name: z.string().trim().min(1).max(200),
    unit: z.string().trim().min(1).max(50),
    quantity: z.coerce.number().nonnegative().default(0),
    remarks: z.string().trim().max(2000).optional(),
    requestDate: z.string().min(1).optional(),
  }),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>["body"];
export type CreateLabourInput = z.infer<typeof createLabourSchema>["body"];
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>["body"];
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>["body"];
export type CreateVendorInput = z.infer<typeof createVendorSchema>["body"];
export type CreateSubcontractorInput = z.infer<typeof createSubcontractorSchema>["body"];
