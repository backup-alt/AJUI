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
    createdBy: z.string().trim().optional(),
  }),
});

export const updateMaterialSchema = z.object({
  body: createMaterialSchema.shape.body.partial(),
  params: z.object({ id: objectIdSchema }),
});

export const listMaterialsSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    vendorId: objectIdSchema.optional(),
    status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
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
  body: createLabourSchema.shape.body.partial(),
  params: z.object({ id: objectIdSchema }),
});

export const listLabourSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    category: z.string().optional(),
    status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
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
  receiptImage: z.string().optional(),
  receiptImageMimeType: z.string().optional(),
  receiptImageName: z.string().optional(),
  amount: z.coerce.number().nonnegative(),
  date: z.string().min(1),
  description: z.string().trim().min(1).max(500),
  submittedBy: z.string().trim().optional(),
  isSiteMaterial: z.boolean().optional(),
  materialName: z.string().trim().optional(),
  materialUnit: z.string().trim().optional(),
  materialQuantity: z.coerce.number().nonnegative().optional(),
  materialVendor: z.string().trim().optional(),
  materialVendorId: objectIdSchema.optional(),
  materialRemainingStock: z.coerce.number().nonnegative().optional(),
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
  body: expenseBaseSchema.partial(),
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
    status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
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
  body: createPaymentSchema.shape.body.partial(),
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
    limit: z.coerce.number().int().min(1).max(100).default(20),
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
    siteIds: z.array(objectIdSchema).min(1, "At least one site must be assigned"),
  }),
});

export const updateVendorSchema = z.object({
  body: createVendorSchema.shape.body.partial().extend({
    siteIds: z.array(objectIdSchema).min(1).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const listVendorsSchema = z.object({
  query: z.object({
    materialType: z.string().optional(),
    status: z.enum(["Active", "Inactive", "Not Active"]).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const createSubcontractorSchema = z.object({
  body: z.object({
    projectId: objectIdSchema,
    siteId: objectIdSchema.optional(),
    site: z.string().trim().min(1).max(200),
    subcontractorName: z.string().trim().min(1).max(200),
    workPackage: z.string().trim().min(1).max(200),
    contractValue: z.coerce.number().nonnegative(),
    advancePaid: z.coerce.number().nonnegative().default(0),
    startDate: z.string().min(1),
    dueDate: z.string().min(1),
    supervisor: z.string().trim().min(1),
    supervisorId: objectIdSchema.optional(),
  }),
});

export const updateSubcontractorSchema = z.object({
  body: createSubcontractorSchema.shape.body.partial().extend({
    approvalStatus: z.enum(["Pending", "Approved", "Rejected"]).optional(),
    paymentStatus: z.enum(["Not Started", "Part Paid", "Paid"]).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const listSubcontractorsSchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    approvalStatus: z.enum(["Pending", "Approved", "Rejected"]).optional(),
    paymentStatus: z.enum(["Not Started", "Part Paid", "Paid"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
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
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>["body"];
export type CreateLabourInput = z.infer<typeof createLabourSchema>["body"];
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>["body"];
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>["body"];
export type CreateVendorInput = z.infer<typeof createVendorSchema>["body"];
export type CreateSubcontractorInput = z.infer<typeof createSubcontractorSchema>["body"];
