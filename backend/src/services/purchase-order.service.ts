import { Types } from "mongoose";
import { Counter } from "../models/Counter.js";
import { GstRate } from "../models/GstRate.js";
import { Material } from "../models/Material.js";
import { Inventory } from "../models/Inventory.js";
import { Project } from "../models/Project.js";
import { PurchaseOrder } from "../models/PurchaseOrder.js";
import { Vendor } from "../models/Vendor.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { paginateByCursor } from "../utils/cursor-pagination.js";
import { syncPurchaseOrderMaterialInventory } from "./inventory.service.js";

async function syncManualInventory(order: any, updatedBy?: string) {
  // Sequential saves also support two lines with the same material name/unit.
  for (const item of order.items || []) {
    if (item.source === "manual") await syncPurchaseOrderMaterialInventory(item.materialId, updatedBy);
  }
  return order;
}

type PurchaseOrderInputItem = {
  materialId?: string;
  source: "existing" | "manual";
  description?: string;
  unit?: string;
  quantity?: number;
  rate: number;
  gstPercent: number;
};

export type CreatePurchaseOrderInput = {
  projectId: string;
  vendorId: string;
  date: string;
  paymentMode: string;
  roundOff?: number;
  items: PurchaseOrderInputItem[];
  createdBy?: string;
};

export type UpdatePurchaseOrderInput = {
  vendorId: string;
  date: string;
  paymentMode: string;
  roundOff?: number;
  items: PurchaseOrderInputItem[];
  createdBy?: string;
};

function money(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function nextPoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `PO-${year}`;
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `PO-${year}-${String(counter?.seq ?? 1).padStart(4, "0")}`;
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  const [project, vendor] = await Promise.all([
    Project.findById(input.projectId).lean(),
    Vendor.findById(input.vendorId).lean(),
  ]);
  if (!project) throw new AppError(404, "Project not found");
  if (!vendor) throw new AppError(404, "Vendor not found");
  if (!input.items.length) throw new AppError(400, "At least one purchase order item is required");

  const poNumber = await nextPoNumber();
  const normalized: Array<{
    materialId: Types.ObjectId;
    source: "existing" | "manual";
    description: string;
    unit: string;
    quantity: number;
    rate: number;
    itemAmount: number;
    gstPercent: number;
    gstAmount: number;
  }> = [];

  const existingItemIds = input.items
    .filter((item) => item.source === "existing")
    .map((item) => String(item.materialId || ""));
  if (new Set(existingItemIds).size !== existingItemIds.length) {
    throw new AppError(400, "The same approved material cannot appear twice in one purchase order");
  }
  const existingMaterials = existingItemIds.length
    ? await Material.find({ _id: { $in: existingItemIds }, projectId: project._id }).lean()
    : [];
  if (existingMaterials.length !== existingItemIds.length) throw new AppError(404, "One or more project materials were not found");
  const existingAllocation = existingItemIds.length
    ? await PurchaseOrder.findOne({ "items.materialId": { $in: existingMaterials.map((material) => material._id) } })
      .select("poNumber")
      .lean()
    : null;
  if (existingAllocation) {
    throw new AppError(409, `One or more selected materials are already allocated to ${existingAllocation.poNumber}`);
  }
  const existingById = new Map(existingMaterials.map((material) => [material._id.toString(), material]));

  // Validate every line before creating manual materials, so a malformed
  // later line cannot leave an orphan Material record behind.
  for (const inputItem of input.items) {
    if (inputItem.source === "existing") {
      const material = existingById.get(String(inputItem.materialId || ""));
      if (!material) throw new AppError(404, "Project material not found");
      if (material.isExistingMaterial) throw new AppError(400, `${material.name} is existing inventory and cannot be added to a purchase order`);
      const currentPo = String(material.poNumber || "").trim();
      if (currentPo && currentPo !== "Pending") throw new AppError(409, `${material.name} is already allocated to ${currentPo}`);
      const approvedQuantity = Number(material.approvedQuantity) || 0;
      const quantity = Number(inputItem.quantity) || approvedQuantity;
      if (quantity <= 0 || (approvedQuantity > 0 && quantity > approvedQuantity)) {
        const range = approvedQuantity > 0 ? `between 0 and ${approvedQuantity}` : "greater than 0";
        throw new AppError(400, `${material.name} quantity must be ${range}`);
      }
    } else {
      const manual = inputItem as PurchaseOrderInputItem & { quantity?: number };
      if (!String(manual.description || "").trim() || !String(manual.unit || "").trim() || (Number(manual.quantity) || 0) <= 0) {
        throw new AppError(400, "New materials require description, unit, and quantity");
      }
    }
  }

  const manualMaterialIds: Types.ObjectId[] = [];
  for (const inputItem of input.items) {
    const rate = money(Math.max(0, Number(inputItem.rate) || 0));
    const gstPercent = Math.max(0, Math.min(100, Number(inputItem.gstPercent) || 0));
    if (inputItem.source === "existing") {
      if (!inputItem.materialId) throw new AppError(400, "Existing material id is required");
      const material = existingById.get(inputItem.materialId);
      if (!material) throw new AppError(404, "Project material not found");
      const quantity = Number(inputItem.quantity) || Number(material.approvedQuantity) || 0;
      const itemAmount = money(quantity * rate);
      normalized.push({
        materialId: material._id,
        source: "existing",
        description: material.name,
        unit: material.unit,
        quantity,
        rate,
        itemAmount,
        gstPercent,
        gstAmount: money(itemAmount * gstPercent / 100),
      });
    } else {
      const description = String(inputItem.description || "").trim();
      const unit = String(inputItem.unit || "").trim();
      const quantity = Number((inputItem as PurchaseOrderInputItem & { quantity?: number }).quantity) || 0;
      if (!description || !unit || quantity <= 0) {
        throw new AppError(400, "New materials require description, unit, and quantity");
      }
      const materialId = await generateId("MAT");
      const material = await Material.create({
        materialId,
        projectId: project._id,
        projectName: project.name,
        clientId: project.clientId,
        clientName: project.client,
        site: "",
        name: description,
        unit,
        requestedQuantity: quantity,
        approvedQuantity: quantity,
        purchasedQuantity: quantity,
        consumedQuantity: 0,
        vendor: vendor.name,
        vendorId: vendor._id,
        poNumber,
        paymentType: input.paymentMode,
        requestDate: input.date,
        orderedDate: input.date,
        approvalDate: input.date,
        approvedAt: new Date(),
        status: "Not Received",
        createdBy: input.createdBy,
        notes: "Created from purchase order",
      });
      manualMaterialIds.push(material._id);
      const itemAmount = money(quantity * rate);
      normalized.push({
        materialId: material._id,
        source: "manual",
        description,
        unit,
        quantity,
        rate,
        itemAmount,
        gstPercent,
        gstAmount: money(itemAmount * gstPercent / 100),
      });
    }
  }

  const subtotal = money(normalized.reduce((sum, item) => sum + item.itemAmount, 0));
  const totalGst = money(normalized.reduce((sum, item) => sum + item.gstAmount, 0));
  const roundOff = money(Number(input.roundOff) || 0);
  const grandTotal = money(subtotal + totalGst + roundOff);
  if (grandTotal <= 0) throw new AppError(400, "Purchase order total must be greater than ₹0");

  const existingIds = normalized.filter((item) => item.source === "existing").map((item) => item.materialId);
  try {
    if (existingIds.length) {
      const claimed = await Material.updateMany(
        {
          _id: { $in: existingIds },
          projectId: project._id,
          $or: [{ poNumber: { $exists: false } }, { poNumber: "" }, { poNumber: "Pending" }, { poNumber: null }],
        },
        { $set: { poNumber, vendor: vendor.name, vendorId: vendor._id, orderedDate: input.date, paymentType: input.paymentMode } },
      );
      if (claimed.modifiedCount !== existingIds.length) {
        throw new AppError(409, "One or more approved materials were allocated by another purchase order");
      }
      await Inventory.updateMany(
        { lastMaterialId: { $in: existingIds } },
        { $set: { poNumber, vendor: vendor.name, vendorId: vendor._id } },
      );
    }

    const purchaseOrder = await PurchaseOrder.create({
      poNumber,
      projectId: project._id,
      projectName: project.name,
      vendorId: vendor._id,
      vendorName: vendor.name,
      date: input.date,
      paymentMode: input.paymentMode,
      items: normalized,
      subtotal,
      totalGst,
      roundOff,
      grandTotal,
      createdBy: input.createdBy ? new Types.ObjectId(input.createdBy) : undefined,
    });
    return syncManualInventory(purchaseOrder.toObject(), input.createdBy);
  } catch (error) {
    await Promise.all([
      existingIds.length
        ? Material.updateMany({ _id: { $in: existingIds }, poNumber }, { $unset: { poNumber: "", paymentType: "" } })
        : Promise.resolve(),
      existingIds.length
        ? Inventory.updateMany({ lastMaterialId: { $in: existingIds }, poNumber }, { $unset: { poNumber: "" } })
        : Promise.resolve(),
      manualMaterialIds.length
        ? Material.deleteMany({ _id: { $in: manualMaterialIds }, poNumber })
        : Promise.resolve(),
    ]);
    throw error;
  }
}

export async function updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid purchase order id");
  const purchaseOrder = await PurchaseOrder.findById(id);
  if (!purchaseOrder) throw new AppError(404, "Purchase order not found");
  if (!input.items.length) throw new AppError(400, "At least one purchase order item is required");
  const vendor = await Vendor.findById(input.vendorId).lean();
  if (!vendor) throw new AppError(404, "Vendor not found");
  const project = await Project.findById(purchaseOrder.projectId).lean();
  if (!project) throw new AppError(404, "Project not found");

  const previous = purchaseOrder.items || [];
  const previousExistingIds = previous.filter((item) => item.source === "existing").map((item) => String(item.materialId || ""));
  const previousManualIds = previous
    .filter((item) => item.source === "manual")
    .map((item) => String(item.materialId || ""))
    .filter((item) => item && Types.ObjectId.isValid(item));

  // Received purchases may already have consumption history. Changing their
  // identity or quantity here would reassign stock that has been used.
  const previousManualMaterials = await Material.find({ _id: { $in: previousManualIds } }).lean();
  for (const item of input.items.filter((line) => line.source === "manual")) {
    if (item.materialId && !previousManualIds.includes(item.materialId)) {
      throw new AppError(400, "Manual material must belong to this purchase order");
    }
    const material = previousManualMaterials.find((row) => String(row._id) === item.materialId);
    if (material && (material.status === "Received" || Number(material.consumedQuantity) > 0) &&
      (material.name !== String(item.description || "").trim() || material.unit !== String(item.unit || "").trim() ||
        Number(material.purchasedQuantity) !== Number(item.quantity))) {
      throw new AppError(400, "Received materials cannot change name, unit, or quantity in a purchase order");
    }
  }

  const newExistingIds = input.items
    .filter((item) => item.source === "existing")
    .map((item) => String(item.materialId || ""));
  if (new Set(newExistingIds).size !== newExistingIds.length) {
    throw new AppError(400, "The same approved material cannot appear twice in one purchase order");
  }
  const existingMaterials = newExistingIds.length
    ? await Material.find({ _id: { $in: newExistingIds }, projectId: project._id }).lean()
    : [];
  if (existingMaterials.length !== newExistingIds.length) throw new AppError(404, "One or more project materials were not found");
  const conflictingAllocation = newExistingIds.length
    ? await PurchaseOrder.findOne({
      _id: { $ne: purchaseOrder._id },
      "items.materialId": { $in: existingMaterials.map((material) => material._id) },
    }).select("poNumber").lean()
    : null;
  if (conflictingAllocation) {
    throw new AppError(409, `One or more selected materials are already allocated to ${conflictingAllocation.poNumber}`);
  }
  const existingById = new Map(existingMaterials.map((material) => [material._id.toString(), material]));

  const toClaim = new Set<string>();
  for (const id of newExistingIds) {
    const material = existingById.get(id);
    if (!material) throw new AppError(404, "Project material not found");
    if (previousExistingIds.includes(id)) continue;
    const currentPo = String(material.poNumber || "").trim();
    if (currentPo && currentPo !== "Pending") throw new AppError(409, `${material.name} is already allocated to ${currentPo}`);
    toClaim.add(id);
  }
  const toUnclaim = previousExistingIds.filter((id) => !newExistingIds.includes(id));

  for (const inputItem of input.items) {
    if (inputItem.source === "existing") {
      const material = existingById.get(String(inputItem.materialId || ""));
      if (!material) throw new AppError(404, "Project material not found");
      if (material.isExistingMaterial) throw new AppError(400, `${material.name} is existing inventory and cannot be added to a purchase order`);
      const approvedQuantity = Number(material.approvedQuantity) || 0;
      const quantity = Number(inputItem.quantity) || approvedQuantity;
      if (quantity <= 0 || (approvedQuantity > 0 && quantity > approvedQuantity)) {
        const range = approvedQuantity > 0 ? `between 0 and ${approvedQuantity}` : "greater than 0";
        throw new AppError(400, `${material.name} quantity must be ${range}`);
      }
    } else {
      const manual = inputItem as PurchaseOrderInputItem & { quantity?: number };
      if (!String(manual.description || "").trim() || !String(manual.unit || "").trim() || (Number(manual.quantity) || 0) <= 0) {
        throw new AppError(400, "New materials require description, unit, and quantity");
      }
    }
  }

  const normalized: Array<{
    materialId: Types.ObjectId;
    source: "existing" | "manual";
    description: string;
    unit: string;
    quantity: number;
    rate: number;
    itemAmount: number;
    gstPercent: number;
    gstAmount: number;
  }> = [];
  const createdManualIds: Types.ObjectId[] = [];

  for (const inputItem of input.items) {
    const rate = money(Math.max(0, Number(inputItem.rate) || 0));
    const gstPercent = Math.max(0, Math.min(100, Number(inputItem.gstPercent) || 0));
    if (inputItem.source === "existing") {
      const material = existingById.get(String(inputItem.materialId || ""));
      if (!material) throw new AppError(404, "Project material not found");
      const quantity = Number(inputItem.quantity) || Number(material.approvedQuantity) || 0;
      const itemAmount = money(quantity * rate);
      normalized.push({
        materialId: material._id,
        source: "existing",
        description: material.name,
        unit: material.unit,
        quantity,
        rate,
        itemAmount,
        gstPercent,
        gstAmount: money(itemAmount * gstPercent / 100),
      });
    } else {
      const description = String(inputItem.description || "").trim();
      const unit = String(inputItem.unit || "").trim();
      const quantity = Number((inputItem as PurchaseOrderInputItem & { quantity?: number }).quantity) || 0;
      if (!description || !unit || quantity <= 0) {
        throw new AppError(400, "New materials require description, unit, and quantity");
      }
      const materialId = String(inputItem.materialId || "").trim();
      let material: { _id: Types.ObjectId; name: string; unit: string } | null = null;
      if (materialId && previousManualIds.includes(materialId)) {
        material = await Material.findByIdAndUpdate(
          materialId,
          { $set: { name: description, unit, requestedQuantity: quantity, approvedQuantity: quantity, purchasedQuantity: quantity, paymentType: input.paymentMode } },
          { new: true },
        ).lean();
      } else if (materialId) {
        throw new AppError(400, "Manual material must belong to this purchase order");
      }
      if (!material) {
        const materialIdNew = await generateId("MAT");
        material = await Material.create({
          materialId: materialIdNew,
          projectId: project._id,
          projectName: project.name,
          clientId: project.clientId,
          clientName: project.client,
          site: "",
          name: description,
          unit,
          requestedQuantity: quantity,
          approvedQuantity: quantity,
          purchasedQuantity: quantity,
          consumedQuantity: 0,
          vendor: vendor.name,
          vendorId: vendor._id,
          poNumber: purchaseOrder.poNumber,
          paymentType: input.paymentMode,
          requestDate: input.date,
          orderedDate: input.date,
          approvalDate: input.date,
          approvedAt: new Date(),
          status: "Not Received",
          createdBy: input.createdBy,
          notes: "Created from purchase order",
        });
        createdManualIds.push(material._id);
      }
      const itemAmount = money(quantity * rate);
      normalized.push({
        materialId: material._id,
        source: "manual",
        description,
        unit,
        quantity,
        rate,
        itemAmount,
        gstPercent,
        gstAmount: money(itemAmount * gstPercent / 100),
      });
    }
  }

  const subtotal = money(normalized.reduce((sum, item) => sum + item.itemAmount, 0));
  const totalGst = money(normalized.reduce((sum, item) => sum + item.gstAmount, 0));
  const roundOff = money(Number(input.roundOff) || 0);
  const grandTotal = money(subtotal + totalGst + roundOff);
  if (grandTotal <= 0) throw new AppError(400, "Purchase order total must be greater than ₹0");

  const claimIds = [...toClaim];
  try {
    if (claimIds.length) {
      const claimed = await Material.updateMany(
        {
          _id: { $in: claimIds },
          projectId: project._id,
          $or: [{ poNumber: { $exists: false } }, { poNumber: "" }, { poNumber: "Pending" }, { poNumber: null }],
        },
        { $set: { poNumber: purchaseOrder.poNumber, vendor: vendor.name, vendorId: vendor._id, orderedDate: input.date, paymentType: input.paymentMode } },
      );
      if (claimed.modifiedCount !== claimIds.length) {
        throw new AppError(409, "One or more approved materials were allocated by another purchase order");
      }
    }
    if (toUnclaim.length) {
      await Material.updateMany(
        { _id: { $in: toUnclaim }, poNumber: purchaseOrder.poNumber },
        { $unset: { poNumber: "", paymentType: "" } },
      );
    }
    if (claimIds.length) {
      await Inventory.updateMany(
        { lastMaterialId: { $in: claimIds } },
        { $set: { poNumber: purchaseOrder.poNumber, vendor: vendor.name, vendorId: vendor._id } },
      );
    }
    if (toUnclaim.length) {
      await Inventory.updateMany(
        { lastMaterialId: { $in: toUnclaim }, poNumber: purchaseOrder.poNumber },
        { $unset: { poNumber: "" } },
      );
    }

    await Material.updateMany(
      { _id: { $in: normalized.map((item) => item.materialId) } },
      {
        $set: {
          vendor: vendor.name,
          vendorId: vendor._id,
          orderedDate: input.date,
          paymentType: input.paymentMode,
        },
      },
    );

    purchaseOrder.vendorId = vendor._id;
    purchaseOrder.vendorName = vendor.name;
    purchaseOrder.date = input.date;
    purchaseOrder.paymentMode = input.paymentMode;
    purchaseOrder.items = normalized;
    purchaseOrder.subtotal = subtotal;
    purchaseOrder.totalGst = totalGst;
    purchaseOrder.roundOff = roundOff;
    purchaseOrder.grandTotal = grandTotal;
    await purchaseOrder.save();
    return syncManualInventory(purchaseOrder.toObject(), input.createdBy);
  } catch (error) {
    await Promise.all([
      claimIds.length
        ? Material.updateMany({ _id: { $in: claimIds }, poNumber: purchaseOrder.poNumber }, { $unset: { poNumber: "", paymentType: "" } })
        : Promise.resolve(),
      toUnclaim.length
        ? Material.updateMany(
          { _id: { $in: toUnclaim } },
          {
            $set: {
              poNumber: purchaseOrder.poNumber,
              vendor: purchaseOrder.vendorName,
              vendorId: purchaseOrder.vendorId,
              paymentType: purchaseOrder.paymentMode,
            },
          },
        )
        : Promise.resolve(),
      createdManualIds.length
        ? Material.deleteMany({ _id: { $in: createdManualIds }, poNumber: purchaseOrder.poNumber })
        : Promise.resolve(),
    ]);
    throw error;
  }
}

export async function listPurchaseOrders(filter: { projectId?: string; page?: number; limit?: number; cursor?: string }) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  return paginateByCursor(PurchaseOrder, query, {
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
    maxLimit: 200,
  });
}

export async function getPurchaseOrder(id: string) {
  const query = Types.ObjectId.isValid(id) ? { _id: id } : { poNumber: id };
  const purchaseOrder = await PurchaseOrder.findOne(query).lean();
  if (!purchaseOrder) throw new AppError(404, "Purchase order not found");
  return purchaseOrder;
}

export async function listGstRates() {
  const custom = await GstRate.find().sort({ rate: 1 }).lean();
  return [...new Set([0, 5, 12, 18, 28, ...custom.map((item) => item.rate)])].sort((a, b) => a - b);
}

export async function addGstRate(rate: number, createdBy?: string) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new AppError(400, "GST rate must be between 0 and 100");
  const item = await GstRate.findOneAndUpdate(
    { rate: value },
    { $setOnInsert: { rate: value, createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return item.toObject();
}
