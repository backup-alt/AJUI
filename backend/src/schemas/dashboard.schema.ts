import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid ObjectId");

export const dashboardQuerySchema = z.object({
  query: z.object({
    projectId: objectIdSchema.optional(),
    clientId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const createReportSchema = z.object({
  body: z.object({
    category: z.enum(["Financial", "Labour", "Material", "Vendor", "Subcontract", "Project"]),
    reportName: z.string().trim().min(1).max(200),
    scope: z.enum(["All", "Project", "Client", "Site"]).default("All"),
    owner: z.string().trim().min(1),
    exportFormat: z.enum(["Excel", "PDF", "CSV"]).default("Excel"),
    schedule: z.enum(["On Demand", "Daily", "Weekly", "Monthly"]).default("On Demand"),
    description: z.string().optional(),
  }),
});

export const updateReportSchema = z.object({
  body: createReportSchema.shape.body.partial(),
  params: z.object({ id: z.string().min(1) }),
});

export const listReportsSchema = z.object({
  query: z.object({
    category: z.enum(["Financial", "Labour", "Material", "Vendor", "Subcontract", "Project"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type CreateReportInput = z.infer<typeof createReportSchema>["body"];

