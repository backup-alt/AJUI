import { Types } from "mongoose";
import { VendorCustomColumn } from "../models/VendorCustomColumn.js";
import { MaterialBillLink } from "../models/MaterialBillLink.js";
import { AppError } from "../middleware/errorHandler.js";
import type {
  CreateVendorCustomColumnInput,
  UpsertMaterialBillLinkInput,
} from "../schemas/vendor-extra.schema.js";

export async function addCustomColumn(input: CreateVendorCustomColumnInput) {
  const existing = await VendorCustomColumn.findOne({
    vendorName: input.vendorName,
    siteName: input.siteName,
    columnKey: input.columnKey,
  });
  if (existing) {
    existing.label = input.label;
    existing.order = input.order;
    await existing.save();
    return existing.toObject();
  }
  const created = await VendorCustomColumn.create(input);
  return created.toObject();
}

export async function removeCustomColumn(vendorName: string, siteName: string, columnKey: string) {
  const result = await VendorCustomColumn.deleteOne({ vendorName, siteName, columnKey });
  return { deletedCount: result.deletedCount };
}

export async function listCustomColumns(vendorName: string, siteName: string) {
  const items = await VendorCustomColumn.find({ vendorName, siteName })
    .sort({ order: 1, createdAt: 1 })
    .lean();
  return items;
}

export async function upsertBillLink(input: UpsertMaterialBillLinkInput) {
  const existing = await MaterialBillLink.findOne({
    vendorName: input.vendorName,
    siteName: input.siteName,
    materialId: input.materialId,
  });
  if (existing) {
    existing.billUrl = input.billUrl;
    if (input.billLabel !== undefined) existing.billLabel = input.billLabel;
    await existing.save();
    return existing.toObject();
  }
  const created = await MaterialBillLink.create(input);
  return created.toObject();
}

export async function listBillLinks(vendorName: string, siteName: string) {
  const items = await MaterialBillLink.find({ vendorName, siteName }).lean();
  return items;
}

export async function removeBillLink(vendorName: string, siteName: string, materialId: string) {
  const result = await MaterialBillLink.deleteOne({ vendorName, siteName, materialId });
  return { deletedCount: result.deletedCount };
}
