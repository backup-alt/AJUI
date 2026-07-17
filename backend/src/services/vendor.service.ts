import { Types } from "mongoose";
import { Vendor } from "../models/Vendor.js";
import { Site } from "../models/Site.js";
import { Material } from "../models/Material.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { CreateVendorInput } from "../schemas/financial.schema.js";

export async function createVendor(input: CreateVendorInput & { siteIds?: string[] }) {
  const vendorId = await generateId("VEN");
  const { siteIds, ...rest } = input;
  const vendor = await Vendor.create({ ...rest, vendorId, siteIds: siteIds || [] });
  if (siteIds?.length) {
    await Site.updateMany({ _id: { $in: siteIds } }, { $addToSet: { vendorIds: vendor._id } });
  }
  return vendor.toObject();
}

export async function listVendors(filter: {
  materialType?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (filter.materialType) query.materialType = filter.materialType;
  if (filter.status) query.status = filter.status;
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: "i" } },
      { vendorId: { $regex: filter.search, $options: "i" } },
      { phone: { $regex: filter.search, $options: "i" } },
    ];
  }

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Vendor.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Vendor.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit, pages: Math.ceil(total / filter.limit) };
}

export async function getVendorById(id: string) {
  const vendor = await Vendor.findById(id).lean();
  if (!vendor) throw new AppError(404, "Vendor not found");
  return vendor;
}

export async function updateVendor(id: string, patch: Partial<CreateVendorInput & { siteIds?: string[] }>) {
  const vendor = await Vendor.findById(id);
  if (!vendor) throw new AppError(404, "Vendor not found");

  const { siteIds, ...rest } = patch;
  const oldSiteIds = (vendor.siteIds || []).map((s: Types.ObjectId) => s.toString());

  if (siteIds !== undefined) {
    const added = siteIds.filter((sid: string) => !oldSiteIds.includes(sid));
    const removed = oldSiteIds.filter((sid: string) => !siteIds.includes(sid));
    await Promise.all([
      Site.updateMany({ _id: { $in: added } }, { $addToSet: { vendorIds: vendor._id } }),
      Site.updateMany({ _id: { $in: removed } }, { $pull: { vendorIds: vendor._id } }),
    ]);
    vendor.siteIds = siteIds.map((sid: string) => new Types.ObjectId(sid));
  }

  Object.assign(vendor, rest);
  await vendor.save();
  return vendor.toObject();
}

export async function deleteVendor(id: string) {
  const result = await Vendor.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Vendor not found");
}

export async function getVendorPurchaseHistory(id: string) {
  const vendor = await getVendorById(id);
  const vendorId = vendor._id as Types.ObjectId;

  const purchases = await Material.find({ vendorId }).sort({ requestDate: -1 }).lean();

  const summary = await Material.aggregate([
    { $match: { vendorId, status: "Approved" } },
    {
      $group: {
        _id: null,
        totalMaterials: { $sum: 1 },
        totalQuantity: { $sum: "$purchasedQuantity" },
      },
    },
  ]);

  return {
    vendor,
    purchases,
    summary: summary[0] || { totalMaterials: 0, totalQuantity: 0 },
  };
}
