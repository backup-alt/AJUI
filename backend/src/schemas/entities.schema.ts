import { z } from "zod";

export const idSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid ID"),
});

export const createClientSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    mobile: z.string().trim().min(8).max(20),
    address: z.string().trim().min(1).max(500),
    gstNumber: z.string().trim().optional(),
    status: z.enum(["Active", "On Hold", "Completed"]).default("Active"),
    supervisor: z.string().trim().optional(),
    supervisorId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  }),
});

export const updateClientSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    mobile: z.string().trim().min(8).max(20).optional(),
    address: z.string().trim().min(1).max(500).optional(),
    gstNumber: z.string().trim().optional(),
    status: z.enum(["Active", "On Hold", "Completed"]).optional(),
    supervisor: z.string().trim().optional(),
    supervisorId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  }),
  params: idSchema,
});

export const listClientsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(["Active", "On Hold", "Completed"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const createSiteSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    status: z.enum(["Active", "On Hold", "Completed"]).default("Active"),
    supervisor: z.string().trim().optional(),
    supervisorId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    startDate: z.string().optional(),
    targetEndDate: z.string().optional(),
    projectIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).optional(),
  }),
});

export const updateSiteSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["Active", "On Hold", "Completed"]).optional(),
    supervisor: z.string().trim().optional(),
    supervisorId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    startDate: z.string().optional(),
    targetEndDate: z.string().optional(),
    projectIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).optional(),
  }),
  params: idSchema,
});

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    clientId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid clientId"),
    mobile: z.string().trim().min(8).max(20),
    address: z.string().trim().min(1).max(500),
    supervisor: z.string().trim().min(1).max(200),
    supervisorId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    siteIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).default([]),
    status: z.enum(["Active", "On Hold", "Completed"]).default("Active"),
    startDate: z.string().min(1),
    totalValue: z.coerce.number().nonnegative().default(0),
    estimatedValue: z.coerce.number().nonnegative().default(0),
    advanceAmount: z.coerce.number().nonnegative().default(0),
    receivedAmount: z.coerce.number().nonnegative().default(0),
    materialSpend: z.coerce.number().nonnegative().default(0),
    labourPayable: z.coerce.number().nonnegative().default(0),
    expenseBalance: z.coerce.number().nonnegative().default(0),
    completion: z.coerce.number().min(0).max(100).default(0),
  }),
});

export const updateProjectSchema = z.object({
  body: createProjectSchema.shape.body.partial(),
  params: idSchema,
});

export const listProjectsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(["Active", "On Hold", "Completed"]).optional(),
    clientId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    siteId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    supervisorId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const createSupervisorSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(8).max(20),
    email: z.string().email().toLowerCase(),
    address: z.string().trim().optional(),
    role: z.string().trim().default("Site Supervisor"),
    assignedProject: z.string().trim().optional(),
    assignedProjectId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    assignedSite: z.string().trim().optional(),
    assignedSiteId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    assignedSites: z.array(z.string().trim().min(1)).optional(),
    assignedSiteIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).optional(),
    cashLimit: z.coerce.number().nonnegative().default(0),
    approvalAuthority: z.coerce.number().nonnegative().default(0),
    status: z.enum(["Active", "On Leave", "Inactive"]).default("Active"),
  }),
});

export const updateSupervisorSchema = z.object({
  body: createSupervisorSchema.shape.body.partial(),
  params: idSchema,
});

export const customFieldTypeSchema = z.enum(["text", "number", "date", "boolean"]);

export const createCustomFieldSchema = z.object({
  body: z.object({
    entityType: z.enum([
      "clients",
      "projects",
      "materials",
      "labour",
      "expenses",
      "payments",
      "vendors",
      "subcontractors",
    ]),
    entityId: z.string().regex(/^[a-f0-9]{24}$/i),
    key: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(200),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    fieldType: customFieldTypeSchema.default("text"),
    order: z.coerce.number().int().min(0).default(0),
  }),
});

export const updateCustomFieldSchema = z.object({
  body: z.object({
    label: z.string().trim().min(1).max(200).optional(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    order: z.coerce.number().int().min(0).optional(),
  }),
  params: idSchema,
});

export const getCustomFieldsSchema = z.object({
  query: z.object({
    entityType: z.enum([
      "clients",
      "projects",
      "materials",
      "labour",
      "expenses",
      "payments",
      "vendors",
      "subcontractors",
    ]),
    entityId: z.string().regex(/^[a-f0-9]{24}$/i),
  }),
});

export type CreateClientInput = z.infer<typeof createClientSchema>["body"];
export type UpdateClientInput = z.infer<typeof updateClientSchema>["body"];
export type CreateSiteInput = z.infer<typeof createSiteSchema>["body"];
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>["body"];
export type CreateProjectInput = z.infer<typeof createProjectSchema>["body"];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>["body"];
export type CreateSupervisorInput = z.infer<typeof createSupervisorSchema>["body"];
export type UpdateSupervisorInput = z.infer<typeof updateSupervisorSchema>["body"];
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>["body"];
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>["body"];
