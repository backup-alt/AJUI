import { z } from "zod";

export const createVendorCustomColumnSchema = z.object({
  body: z.object({
    vendorName: z.string().trim().min(1).max(200),
    siteName: z.string().trim().min(1).max(200),
    columnKey: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(120),
    order: z.coerce.number().int().nonnegative().default(0),
  }),
});

export const deleteVendorCustomColumnSchema = z.object({
  query: z.object({
    vendorName: z.string().min(1),
    siteName: z.string().min(1),
    columnKey: z.string().min(1),
  }),
});

export const listVendorCustomColumnsSchema = z.object({
  query: z.object({
    vendorName: z.string().min(1),
    siteName: z.string().min(1),
  }),
});

export const upsertMaterialBillLinkSchema = z.object({
  body: z.object({
    vendorName: z.string().trim().min(1).max(200),
    siteName: z.string().trim().min(1).max(200),
    materialId: z.string().trim().min(1).max(120),
    billUrl: z.string().trim().min(1).max(1000),
    billLabel: z.string().trim().max(200).optional(),
  }),
});

export const listMaterialBillLinksSchema = z.object({
  query: z.object({
    vendorName: z.string().min(1),
    siteName: z.string().min(1),
  }),
});

export const deleteMaterialBillLinkSchema = z.object({
  query: z.object({
    vendorName: z.string().min(1),
    siteName: z.string().min(1),
    materialId: z.string().min(1),
  }),
});

export type CreateVendorCustomColumnInput = z.infer<typeof createVendorCustomColumnSchema>["body"];
export type UpsertMaterialBillLinkInput = z.infer<typeof upsertMaterialBillLinkSchema>["body"];
