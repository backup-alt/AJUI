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
import { resolveProjectObjectId } from "../utils/scope.js";
import { syncPurchaseOrderMaterialInventory } from "./inventory.service.js";

async function syncManualInventory(order: any, updatedBy?: string) {
  // Sequential saves also support two lines with the same material name/unit.
  for (const item of order.items || []) {
    await syncPurchaseOrderMaterialInventory(item.materialId, updatedBy, Number(item.quantity) || 0);
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
  paymentMode?: string;
  gstPercent: number;
};

export type CreatePurchaseOrderInput = {
  projectId: string;
  vendorId: string;
  date: string;
  paymentMode?: string;
  notes?: string;
  roundOff?: number;
  items: PurchaseOrderInputItem[];
  createdBy?: string;
};

export type UpdatePurchaseOrderInput = {
  vendorId: string;
  date: string;
  paymentMode?: string;
  notes?: string;
  roundOff?: number;
  items: PurchaseOrderInputItem[];
  createdBy?: string;
};

function money(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function itemPaymentMode(item: PurchaseOrderInputItem, fallback?: string): string {
  return String(item.paymentMode || fallback || "Bank Transfer").trim() || "Bank Transfer";
}

function purchaseOrderPaymentMode(items: Array<{ paymentMode: string }>): string {
  const modes = [...new Set(items.map((item) => item.paymentMode))];
  return modes.length === 1 ? modes[0] : "Multiple";
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
  const projectObjectId = await resolveProjectObjectId(input.projectId);
  const [project, vendor] = await Promise.all([
    Project.findById(projectObjectId).lean(),
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
    paymentMode: string;
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
    ? await Material.find({ _id: { $in: existingItemIds } }).lean()
    : [];
  if (existingMaterials.length !== existingItemIds.length) throw new AppError(404, "One or more project materials were not found");
  const existingById = new Map(existingMaterials.map((material) => [material._id.toString(), material]));

  // Validate every line before creating manual materials, so a malformed
  // later line cannot leave an orphan Material record behind.
  for (const inputItem of input.items) {
    if (inputItem.source === "existing") {
      const material = existingById.get(String(inputItem.materialId || ""));
      if (!material) throw new AppError(404, "Project material not found");
      const approvedQuantity = Number(material.approvedQuantity) || 0;
      const quantity = Number(inputItem.quantity) || approvedQuantity;
      if (quantity <= 0) throw new AppError(400, `${material.name} quantity must be greater than 0`);
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
        paymentMode: itemPaymentMode(inputItem, input.paymentMode),
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
        paymentType: itemPaymentMode(inputItem, input.paymentMode),
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
        paymentMode: itemPaymentMode(inputItem, input.paymentMode),
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
  const existingItems = normalized.filter((item) => item.source === "existing");
  try {
    if (existingIds.length) {
      for (const item of existingItems) {
        await Material.updateOne(
          { _id: item.materialId },
          {
            $set: { poNumber, vendor: vendor.name, vendorId: vendor._id, orderedDate: input.date },
            $inc: { purchasedQuantity: item.quantity },
          },
        );
      }
      await Inventory.updateMany(
        { lastMaterialId: { $in: existingIds } },
        { $set: { poNumber, vendor: vendor.name, vendorId: vendor._id } },
      );
    }
    for (const item of normalized) {
      await Material.updateOne({ _id: item.materialId }, { $set: { paymentType: item.paymentMode } });
    }

    const purchaseOrder = await PurchaseOrder.create({
      poNumber,
      projectId: project._id,
      projectName: project.name,
      vendorId: vendor._id,
      vendorName: vendor.name,
      date: input.date,
      paymentMode: purchaseOrderPaymentMode(normalized),
      notes: String(input.notes || "").trim(),
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
        ? Promise.all(existingItems.map((item) =>
          Material.updateOne(
            { _id: item.materialId, poNumber },
            { $unset: { poNumber: "", paymentType: "" }, $inc: { purchasedQuantity: -item.quantity } },
          ),
        ))
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
  const purchaseOrder = await PurchaseOrder.findOne({ _id: id, deletedAt: { $exists: false } });
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
    if (material && Number(material.consumedQuantity) > 0 &&
      (material.name !== String(item.description || "").trim() || material.unit !== String(item.unit || "").trim())) {
      throw new AppError(400, "Materials with consumption history cannot change name or unit");
    }
  }

  // Validate the resulting stock for the whole group before changing any lines.
  const manualInputs = input.items.filter(item => item.source === "manual");
  const removedManualIds = previousManualIds.filter(id => !manualInputs.some(item => item.materialId === id));
  if (previousManualMaterials.some(material => removedManualIds.includes(String(material._id)) && Number(material.givenAmount) > 0)) {
    throw new AppError(409, "Adjust the recorded payment before removing a paid PO line");
  }
  const stockGroups = await Inventory.find({ "purchaseHistory.materialId": { $in: previousManualIds } }).lean();
  for (const stock of stockGroups) {
    let projected = Number(stock.purchasedQuantity) || 0;
    for (const material of previousManualMaterials) {
      const contributions = (stock.purchaseHistory || []).filter(entry => String(entry.materialId) === String(material._id));
      if (!contributions.length) continue;
      const next = manualInputs.find(item => item.materialId === String(material._id));
      const sameGroup = next && String(next.description || "").trim().toLowerCase() === stock.normalizedName && String(next.unit || "").trim().toLowerCase() === stock.normalizedUnit;
      projected += (sameGroup ? Number(next.quantity) || 0 : 0) - contributions.reduce((sum, entry) => sum + entry.quantity, 0);
    }
    if (projected < Number(stock.consumedQuantity || 0)) throw new AppError(409, "This change would reduce purchased stock below the quantity already consumed");
  }

  const newExistingIds = input.items
    .filter((item) => item.source === "existing")
    .map((item) => String(item.materialId || ""));
  if (new Set(newExistingIds).size !== newExistingIds.length) {
    throw new AppError(400, "The same approved material cannot appear twice in one purchase order");
  }
  const existingMaterials = newExistingIds.length
    ? await Material.find({ _id: { $in: newExistingIds } }).lean()
    : [];
  if (existingMaterials.length !== newExistingIds.length) throw new AppError(404, "One or more project materials were not found");
  const existingById = new Map(existingMaterials.map((material) => [material._id.toString(), material]));

  const toClaim = new Set<string>();
  for (const id of newExistingIds) {
    const material = existingById.get(id);
    if (!material) throw new AppError(404, "Project material not found");
    if (previousExistingIds.includes(id)) continue;
    toClaim.add(id);
  }
  const toUnclaim = previousExistingIds.filter((id) => !newExistingIds.includes(id));

  for (const inputItem of input.items) {
    if (inputItem.source === "existing") {
      const material = existingById.get(String(inputItem.materialId || ""));
      if (!material) throw new AppError(404, "Project material not found");
      const approvedQuantity = Number(material.approvedQuantity) || 0;
      const quantity = Number(inputItem.quantity) || approvedQuantity;
      if (quantity <= 0) throw new AppError(400, `${material.name} quantity must be greater than 0`);
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
    paymentMode: string;
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
        paymentMode: itemPaymentMode(inputItem, input.paymentMode),
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
          { $set: { name: description, unit, requestedQuantity: quantity, approvedQuantity: quantity, purchasedQuantity: quantity, paymentType: itemPaymentMode(inputItem, input.paymentMode) } },
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
          paymentType: itemPaymentMode(inputItem, input.paymentMode),
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
        paymentMode: itemPaymentMode(inputItem, input.paymentMode),
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
        },
        { $set: { poNumber: purchaseOrder.poNumber, vendor: vendor.name, vendorId: vendor._id, orderedDate: input.date } },
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
        },
      },
    );
    for (const item of normalized) {
      await Material.updateOne({ _id: item.materialId }, { $set: { paymentType: item.paymentMode } });
    }

    purchaseOrder.vendorId = vendor._id;
    purchaseOrder.vendorName = vendor.name;
    purchaseOrder.projectName = project.name;
    purchaseOrder.date = input.date;
    purchaseOrder.paymentMode = purchaseOrderPaymentMode(normalized);
    purchaseOrder.notes = String(input.notes || "").trim();
    purchaseOrder.items = normalized;
    purchaseOrder.subtotal = subtotal;
    purchaseOrder.totalGst = totalGst;
    purchaseOrder.roundOff = roundOff;
    purchaseOrder.grandTotal = grandTotal;
    await purchaseOrder.save();
    // Keep removed source records for audit; reconcile their contribution to zero.
    for (const materialId of removedManualIds) {
      await Material.updateOne({ _id: materialId }, { $set: { requestedQuantity: 0, approvedQuantity: 0, purchasedQuantity: 0 } });
      await syncPurchaseOrderMaterialInventory(materialId, input.createdBy, 0, purchaseOrder.poNumber);
    }
    for (const materialId of toUnclaim) {
      await syncPurchaseOrderMaterialInventory(materialId, input.createdBy, 0, purchaseOrder.poNumber);
    }
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
  const query: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (filter.projectId) query.projectId = await resolveProjectObjectId(filter.projectId);
  const result = await paginateByCursor(PurchaseOrder, query, {
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
    maxLimit: 200,
  });
  return { ...result, items: await summarizePurchaseOrders(result.items) };
}

async function summarizePurchaseOrders(orders: any[]) {
  const ids = orders.flatMap(order => order.items.map((item: any) => item.materialId));
  const projectIds = [...new Set<string>(orders.map(order => String(order.projectId || "")).filter(Boolean))];
  const [materialResults, projectResults] = await Promise.all([
    ids.length ? Material.find({ _id: { $in: ids } }).select("givenAmount billUrl receiptImageName billHistory").lean() : [],
    projectIds.length ? Project.find({ _id: { $in: projectIds } }).select("name").lean() : [],
  ]);
  const materials = materialResults as any[];
  const projects = projectResults as any[];
  const byId = new Map<string, any>(materials.map((material): [string, any] => [String(material._id), material]));
  const projectNamesById = new Map<string, string>(projects.map((project): [string, string] => [String(project._id), project.name]));
  return orders.map(order => {
    const linked = [...new Set<string>(order.items.map((item: any) => String(item.materialId)))].map(id => byId.get(id)).filter(Boolean);
    const billReferences = linked.flatMap(material => {
      const bills = (material?.billHistory || []).map(bill => ({ url: bill.billUrl, label: bill.fileName || "View bill" }));
      if (material?.billUrl && !bills.some(bill => bill.url === material.billUrl)) bills.push({ url: material.billUrl, label: material.receiptImageName || "View bill" });
      return bills;
    });
    return {
      ...order,
      projectName: projectNamesById.get(String(order.projectId || "")) || order.projectName,
      givenAmount: linked.reduce((sum, material) => sum + Number(material?.givenAmount || 0), 0),
      billReferences,
    };
  });
}

export async function getPurchaseOrder(id: string) {
  const query = Types.ObjectId.isValid(id) ? { _id: id } : { poNumber: id };
  const purchaseOrder = await PurchaseOrder.findOne({ ...query, deletedAt: { $exists: false } }).lean();
  if (!purchaseOrder) throw new AppError(404, "Purchase order not found");
  return (await summarizePurchaseOrders([purchaseOrder]))[0];
}

export async function deletePurchaseOrder(id: string, deletedBy?: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid purchase order id");
  const purchaseOrder = await PurchaseOrder.findOne({ _id: id, deletedAt: { $exists: false } });
  if (!purchaseOrder) throw new AppError(404, "Purchase order not found");

  const materialIds = [...new Set(
    (purchaseOrder.items || []).map((item) => String(item.materialId || "")).filter((item) => Types.ObjectId.isValid(item)),
  )];
  const materials = materialIds.length ? await Material.find({ _id: { $in: materialIds } }).lean() : [];
  if (materials.some((material) => Number(material.givenAmount || 0) > 0)) {
    throw new AppError(409, "Adjust the recorded PO payment before deleting this purchase order");
  }

  const inventories = materialIds.length
    ? await Inventory.find({ "purchaseHistory.materialId": { $in: materialIds } }).lean()
    : [];
  for (const inventory of inventories) {
    const contribution = (inventory.purchaseHistory || [])
      .filter((entry) =>
        materialIds.includes(String(entry.materialId))
        && String(entry.poNumber || "").trim() === purchaseOrder.poNumber
      )
      .reduce((total, entry) => total + Number(entry.quantity || 0), 0);
    if (Number(inventory.purchasedQuantity || 0) - contribution < Number(inventory.consumedQuantity || 0)) {
      throw new AppError(409, "This PO has material that is already consumed. Correct the consumed quantity before deleting it");
    }
  }

  const manualIds = new Set(
    (purchaseOrder.items || []).filter((item) => item.source === "manual").map((item) => String(item.materialId || "")),
  );
  const quantityByMaterialId = new Map(
    (purchaseOrder.items || []).map((item) => [String(item.materialId || ""), Number(item.quantity) || 0]),
  );
  for (const material of materials) {
    const itemQuantity = quantityByMaterialId.get(String(material._id)) || 0;
    const update = manualIds.has(String(material._id))
      ? { $set: { requestedQuantity: 0, approvedQuantity: 0, purchasedQuantity: 0 } }
      : {
        $set: { purchasedQuantity: Math.max(0, Number(material.purchasedQuantity || 0) - itemQuantity) },
        $unset: { poNumber: "", paymentType: "", vendor: "", vendorId: "", orderedDate: "" },
      };
    await Material.updateOne({ _id: material._id }, update);
    await syncPurchaseOrderMaterialInventory(material._id, deletedBy, 0, purchaseOrder.poNumber);
  }

  purchaseOrder.deletedAt = new Date();
  await purchaseOrder.save();
  return { id: String(purchaseOrder._id), poNumber: purchaseOrder.poNumber, removedMaterialCount: materials.length };
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
