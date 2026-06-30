import { Types } from "mongoose";
import { Vendor } from "../models/Vendor.js";
import { Material } from "../models/Material.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { CreateVendorInput } from "../schemas/financial.schema.js";

export async function createVendor(input: CreateVendorInput) {
  const vendorId = await generateId("VEN");
  const vendor = await Vendor.create({ ...input, vendorId });
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

export async function updateVendor(id: string, patch: Partial<CreateVendorInput>) {
  const vendor = await Vendor.findByIdAndUpdate(id, patch, { new: true });
  if (!vendor) throw new AppError(404, "Vendor not found");
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
