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
    paymentType: z.string().trim().min(1).max(50).optional(),
    requestDate: z.string().min(1),
    receivedDate: z.string().optional(),
    issuedAmount: z.coerce.number().nonnegative().optional(),
    givenAmount: z.coerce.number().nonnegative().optional(),
    isExistingMaterial: z.boolean().optional(),
    orderedDate: z.string().optional(),
    notes: z.string().trim().max(2000).optional(),
    createdBy: z.string().trim().optional(),
  }),
});

export const updateMaterialSchema = z.object({
  body: createMaterialSchema.shape.body.partial().extend({
    status: z.enum(["Received", "Not Received"]).optional(),
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

// =================== GENERAL EXPENSE ===================
// Project-level "Expense" — a separate concept from the legacy site
// expense ledger. Captures admin / manually-logged entries (rent, fuel,
// software, etc.) and is rolled up into the project Total Expense KPI.
export const generalExpenseBaseSchema = z.object({
  origin: z.string().trim().min(1).max(50).optional().default("manual"),
  category: z.string().trim().max(100).optional(),
  amount: z.coerce.number().nonnegative(),
  date: z.string().min(1),
  description: z.string().trim().min(1).max(500),
  projectId: objectIdSchema.optional().nullable(),
  projectName: z.string().trim().max(200).optional(),
  clientId: objectIdSchema.optional().nullable(),
  clientName: z.string().trim().max(200).optional(),
  siteId: objectIdSchema.optional().nullable(),
  site: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  paymentMode: z.string().trim().min(1).max(50).optional().default("Cash"),
  paidBy: z.string().trim().max(200).optional(),
  reference: z.string().trim().max(500).optional(),
  status: z.enum(["Pending", "Approved", "Rejected"]).optional().default("Approved"),
  customFields: z.record(z.unknown()).optional(),
  createdBy: z.string().trim().optional(),
});

export const createGeneralExpenseSchema = z.object({
  body: generalExpenseBaseSchema,
});

export const updateGeneralExpenseSchema = z.object({
  body: generalExpenseBaseSchema.partial().extend({
    // Allow clearing the project/client/site by sending an empty string.
    projectId: z.union([objectIdSchema, z.literal("")]).optional(),
    clientId: z.union([objectIdSchema, z.literal("")]).optional(),
    siteId: z.union([objectIdSchema, z.literal("")]).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const listGeneralExpensesSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    category: z.string().trim().optional(),
    status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    search: z.string().trim().optional(),
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
    amount: z.coerce.number().positive(),
    mode: z.enum(["Cash", "UPI", "Bank Transfer", "NEFT", "RTGS", "IMPS", "Cheque", "Credit Card", "Debit Card", "Net Banking", "Demand Draft", "Wallet", "Other"]),
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
    mode: z.enum(["Cash", "UPI", "Bank Transfer", "NEFT", "RTGS", "IMPS", "Cheque", "Credit Card", "Debit Card", "Net Banking", "Demand Draft", "Wallet", "Other"]).optional(),
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
    gstType: z.enum(["GST", "Non-GST"]).optional().default("GST"),
    rating: z.coerce.number().min(0).max(5).default(0),
    status: z.enum(["Active", "Inactive", "Not Active"]).default("Active"),
    siteIds: z.array(objectIdSchema).min(0).optional(),
    projectIds: z.array(objectIdSchema).min(0).optional(),
  }),
});

export const updateVendorSchema = z.object({
  body: createVendorSchema.shape.body.partial().extend({
    siteIds: z.array(objectIdSchema).min(0).optional(),
    projectIds: z.array(objectIdSchema).min(0).optional(),
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
    projectIds: z.array(objectIdSchema).min(0).optional(),
    subcontractorName: z.string().trim().min(1).max(200),
    description: z.string().trim().max(500).optional().default(""),
    employeeCount: z.coerce.number().int().nonnegative().optional(),
    note: z.string().trim().max(1000).optional().default(""),
    address: z.string().trim().max(500).optional().default(""),
    phone: z.string().trim().max(40).optional().default(""),
    gstType: z.enum(["GST", "Non-GST"]).optional().default("Non-GST"),
    gstNumber: z.string().trim().max(40).optional().default(""),
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
    siteId: objectIdSchema.optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must be YYYY-MM-DD"),
    paymentType: z.string().trim().min(1).max(50).default("Bank Transfer"),
    labourType: z.string().trim().min(1).max(100).optional().default("General Labour"),
    description: z.string().trim().max(500).optional().default(""),
    employeeCount: z.coerce.number().int().min(1),
    amount: z.coerce.number().positive(),
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const createSubcontractorLaborSchema = z.object({
  body: z.object({
    subcontractorId: objectIdSchema,
    // Optional project linkage — when set, the labour row is mirrored
    // into the project's worker roster. May be cleared by passing an
    // empty string on update.
    projectId: objectIdSchema.optional().or(z.literal("")),
    projectName: z.string().trim().max(200).optional().default(""),
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().max(500).optional().default(""),
    // Optional — site supervisors frequently roster labour without a
    // phone number (e.g. walk-in workers). The web admin's labour
    // drawer mirrors that permissiveness.
    phone: z.string().trim().max(40).optional().default(""),
    role: z.string().trim().min(1).max(100),
    notes: z.string().trim().max(1000).optional().default(""),
  }),
});

export const updateSubcontractorLaborSchema = z.object({
  body: createSubcontractorLaborSchema.shape.body
    .omit({ subcontractorId: true })
    .partial()
    .extend({
      // Allow callers to clear the project linkage by sending an empty
      // string explicitly (Zod's `.optional()` would otherwise drop the
      // key entirely on PATCH bodies).
      projectId: z.union([objectIdSchema, z.literal("")]).optional(),
    }),
  params: z.object({ id: objectIdSchema }),
});

const purchaseOrderItemSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("existing"),
    materialId: objectIdSchema,
    // Older callers omit quantity for approved material requests. In that
    // case the service allocates the material's full approved quantity.
    quantity: z.coerce.number().positive().optional(),
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
    paymentMode: z.string().trim().min(1).max(50).optional().default("Bank Transfer"),
    items: z.array(purchaseOrderItemSchema).min(1),
    roundOff: z.coerce.number().min(-1000).max(1000).optional().default(0),
  }),
});

export const updatePurchaseOrderSchema = z.object({
  body: z.object({
    vendorId: objectIdSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must be YYYY-MM-DD"),
    paymentMode: z.string().trim().min(1).max(50).optional().default("Bank Transfer"),
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
    projectId: objectIdSchema.optional(),
    name: z.string().trim().min(1).max(200),
    unit: z.string().trim().min(1).max(50),
    quantity: z.coerce.number().nonnegative().default(0),
    isExistingMaterial: z.boolean().default(false),
    issuedAmount: z.coerce.number().nonnegative().optional(),
    givenAmount: z.coerce.number().nonnegative().optional(),
    remarks: z.string().trim().max(2000).optional(),
    requestDate: z.string().min(1).optional(),
  }),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>["body"];
export type CreateLabourInput = z.infer<typeof createLabourSchema>["body"];
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>["body"];
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>["body"];
export type CreateVendorInput = z.infer<typeof createVendorSchema>["body"];

// =================== WORKER ROSTER (web admin) ===================
// The mobile supervisor app maintains the worker roster via
// /api/mobile/supervisor/workers. The web admin uses these endpoints to
// read + edit the same collection (e.g. fixing a phone number, taking
// notes on a worker) from the project workspace "Labour" tab.
export const createWorkerSchema = z.object({
  body: z.object({
    projectId: objectIdSchema,
    projectIds: z.array(objectIdSchema).min(0).optional(),
    siteId: objectIdSchema.optional(),
    site: z.string().trim().max(200).optional(),
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().max(500).optional(),
    phone: z.string().trim().max(32).optional(),
    notes: z.string().trim().max(1000).optional(),
    labourType: z.string().trim().min(1).max(100),
    weeklyPay: z.coerce.number().nonnegative().optional(),
    isSubcontract: z.boolean().default(true),
    subcontractorId: objectIdSchema,
    subcontractorName: z.string().trim().min(1).max(200),
    supervisorId: objectIdSchema.optional(),
    supervisorName: z.string().trim().max(200).optional(),
  }),
});

export const updateWorkerSchema = z.object({
  body: createWorkerSchema.shape.body.partial(),
  params: z.object({ id: objectIdSchema }),
});

export const listWorkersSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    labourType: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursor: z.string().optional(),
  }),
});
export type CreateSubcontractorInput = z.infer<typeof createSubcontractorSchema>["body"];
