import { Types } from "mongoose";
import { IMaterial, Material } from "../models/Material.js";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { Vendor } from "../models/Vendor.js";
import { Site } from "../models/Site.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { CreateMaterialInput } from "../schemas/financial.schema.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { withRetry } from "../utils/retry.js";
import { dbMutex } from "../utils/db-mutex.js";
import { inventoryKeyForMaterial, inventoryStockMapForMaterials } from "./inventory.service.js";

async function populateRefs(input: CreateMaterialInput) {
  let project: any = null;
  let client: any = null;

  if (input.projectId) {
    project = await Project.findById(input.projectId);
    if (!project) throw new AppError(404, "Project not found");

    client = await Client.findById(project.clientId);
    if (!client) throw new AppError(404, "Client not found");
  }

  let vendor: { name: string; vendorId?: Types.ObjectId } | undefined;
  if (input.vendorId) {
    const v = await Vendor.findById(input.vendorId);
    if (!v) throw new AppError(404, "Vendor not found");
    vendor = { name: v.name, vendorId: v._id };
  }

  return { project, client, vendor };
}

async function resolveSiteName(site?: string, siteId?: string): Promise<string | undefined> {
  if (site) return site;
  if (siteId) {
    const siteDoc = await Site.findById(siteId).lean();
    return siteDoc?.name;
  }
  return undefined;
}

export async function createMaterial(input: CreateMaterialInput) {
  const { project, client, vendor } = await populateRefs(input);
  const siteName = await resolveSiteName(input.site, input.siteId);

  if (project) {
    const existingPending = await Material.findOne({
      projectId: project._id,
      site: siteName,
      name: input.name,
      unit: input.unit,
      status: { $in: ["Pending", "Not Received"] },
    });

    if (existingPending) {
      existingPending.requestedQuantity = input.requestedQuantity;
      existingPending.notes = input.notes;
      existingPending.vendor = input.vendor || vendor?.name;
      existingPending.vendorId = input.vendorId ? new Types.ObjectId(input.vendorId) : vendor?.vendorId;
      existingPending.poNumber = input.poNumber;
      existingPending.createdBy = input.createdBy;
      await existingPending.save();
      return existingPending.toObject();
    }
  }

  const materialId = await generateId("MAT");
  const material = await Material.create({
    materialId,
    projectId: project?._id,
    projectName: project?.name,
    clientId: client?._id,
    clientName: client?.name,
    siteId: input.siteId ? new Types.ObjectId(input.siteId) : undefined,
    site: siteName,
    name: input.name,
    unit: input.unit,
    requestedQuantity: input.requestedQuantity,
    approvedQuantity: input.approvedQuantity ?? 0,
    purchasedQuantity: input.purchasedQuantity,
    consumedQuantity: input.consumedQuantity,
    remainingStock: Math.max(0, input.purchasedQuantity - input.consumedQuantity),
    vendor: input.vendor || vendor?.name,
    vendorId: input.vendorId ? new Types.ObjectId(input.vendorId) : vendor?.vendorId,
    poNumber: input.poNumber,
    requestDate: input.requestDate,
    approvalDate: input.approvedQuantity ? new Date().toISOString().slice(0, 10) : undefined,
    status: "Pending",
    createdBy: input.createdBy,
    notes: input.notes,
  });

  return material.toObject();
}

export async function listMaterials(filter: {
  projectId?: string;
  siteId?: string;
  site?: string;
  vendorId?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
  cursor?: string;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.site) query.site = filter.site;
  if (filter.vendorId) query.vendorId = new Types.ObjectId(filter.vendorId);
  if (filter.status) query.status = filter.status;
  if (filter.search) query.name = { $regex: filter.search, $options: "i" };
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  // Cursor-based pagination via _id — uses the _id index for an O(log n)
  // range query instead of the O(n) skip-then-limit pattern that timed
  // out on M0 free tier.
  if (filter.cursor) {
    try {
      query._id = { $gt: new Types.ObjectId(filter.cursor) };
    } catch {
      // Invalid cursor → fall through and start from the beginning
    }
  }

  // Cap default at 25 — Atlas M0 times out on full-table scans above this.
  // Use cursor to paginate beyond 25 if the caller asks for more.
  const effectiveLimit = Math.min(Math.max(filter.limit || 25, 1), 50);
  type MaterialLike = {
    projectId?: unknown;
    siteId?: unknown;
    site?: unknown;
    name?: unknown;
    unit?: unknown;
    remainingStock?: unknown;
    [k: string]: unknown;
  };
  let items: MaterialLike[] = [];
  let total = 0;
  let nextCursor: string | null = null;
  try {
    // Serialize through the in-process mutex so this query doesn't
    // contend with other concurrent requests for the M0 cluster's
    // shared resources. A single fast query returns faster than 5
    // slow ones competing for the same CPU.
    const foundItems = await dbMutex.run(() =>
      withRetry(
        () => Material.find(query)
          .sort({ _id: -1 })
          .limit(effectiveLimit + 1) // +1 so we know if there's another page
          .lean()
          .maxTimeMS(5000),
        { label: "listMaterials.find" }
      )
    );
    // Only fetch countDocuments on the first page (no cursor) — counts on
    // paginated pages are expensive and usually unnecessary.
    if (!filter.cursor) {
      const foundTotal = await dbMutex.run(() =>
        withRetry(
          () => Material.countDocuments(query).maxTimeMS(5000),
          { label: "listMaterials.count" }
        )
      );
      total = foundTotal;
    } else {
      total = filter.page * effectiveLimit; // estimate
    }
    items = foundItems as unknown as MaterialLike[];
    if (items.length > effectiveLimit) {
      const nextItem = items.pop();
      if (nextItem && (nextItem as any)._id) {
        nextCursor = String((nextItem as any)._id);
      }
    }
  } catch (err) {
    console.error(
      "[listMaterials] query failed (projectId=%s siteId=%s status=%s search=%s scopeLen=%s):",
      String(filter.projectId || ""),
      String(filter.siteId || ""),
      String(filter.status || ""),
      String(filter.search || ""),
      String(filter.scopeProjectIds?.length ?? 0),
      (err as Error)?.message || err
    );
    items = [];
    total = 0;
  }

  // Aux queries are best-effort — if they time out on M0 we still want to
  // return the main results rather than failing the entire request.
  try {
    const siteIds = [...new Set(items.map((m) => m.siteId?.toString()).filter(Boolean))];
    if (siteIds.length > 0) {
      const sites = await Site.find({ _id: { $in: siteIds.map((id) => new Types.ObjectId(id)) } }).lean();
      const siteNameMap = new Map(sites.map((s) => [s._id.toString(), s.name]));
      items.forEach((item) => {
        if (item.siteId && (!item.site || typeof item.site === "object")) {
          item.site = siteNameMap.get(item.siteId.toString()) || item.site;
        }
      });
    }
  } catch (err) {
    console.warn("[listMaterials] site-name lookup failed (returning items anyway):", (err as Error).message);
  }

  const typedItems = items as unknown as IMaterial[];
  // Inventory stock lookup is best-effort and asynchronous — never block
  // the response on it. If M0 pool is saturated, the stock map will be
  // empty and the UI will compute remainingStock from purchased − consumed.
  //
  // The fire-and-forget backfillApprovedMaterialsToInventory that previously
  // ran here was REMOVED — it issued another Material.find + Inventory write
  // for every single listMaterials request, and with 5+ parallel hydration
  // calls the M0 connection pool saturated, causing every subsequent query
  // to time out at 8s × 3 retries = 24s. Backfill is now a periodic
  // startup task (see startupTasks()) instead of an inline per-request hook.
  void Promise.race([
    inventoryStockMapForMaterials(items as unknown as Array<Pick<import("../models/Material.js").IMaterial, "projectId" | "siteId" | "site" | "name" | "unit">>),
    new Promise<Map<string, number>>((resolve) => setTimeout(() => resolve(new Map()), 1500)),
  ]).then((stockMap) => {
    items.forEach((item) => {
      const sharedStock = stockMap.get(inventoryKeyForMaterial(item as unknown as Parameters<typeof inventoryKeyForMaterial>[0]));
      if (sharedStock !== undefined) item.remainingStock = sharedStock;
    });
  }).catch((err: unknown) => {
    console.warn("[listMaterials] inventory stock lookup failed (returning items anyway):", (err as Error).message);
  });

  return {
    items: typedItems,
    total,
    page: filter.page,
    limit: effectiveLimit,
    pages: Math.ceil(total / effectiveLimit),
    nextCursor,
  };
}

export async function getMaterialById(id: string) {
  const material = await Material.findById(id).lean();
  if (!material) throw new AppError(404, "Material not found");
  return material;
}

export async function updateMaterial(id: string, patch: Partial<CreateMaterialInput>) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.siteId) {
    update.siteId = new Types.ObjectId(patch.siteId);
    const site = await Site.findById(patch.siteId).lean();
    if (site) update.site = site.name;
  }
  if (patch.vendorId) update.vendorId = new Types.ObjectId(patch.vendorId);

  const customFields = (patch as any).customFields as Record<string, unknown> | undefined;
  if (customFields) {
    delete update.customFields;
    for (const [key, val] of Object.entries(customFields)) {
      update[`customFields.${key}`] = val;
    }
  }

  const material = await Material.findByIdAndUpdate(id, update, { new: true });
  if (!material) throw new AppError(404, "Material not found");
  return material.toObject();
}

export async function deleteMaterial(id: string) {
  const result = await Material.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Material not found");
}

export async function getPendingMaterials(scopeProjectIds?: ProjectScopeIds) {
  // "Pending" status no longer exists; this function is retained for API
  // compatibility but returns materials that have not yet been received.
  const query: Record<string, unknown> = { status: "Not Received" };
  applyProjectScope(query, "projectId", scopeProjectIds);
  return Material.find(query).sort({ createdAt: -1 }).lean();
}

export async function uploadMaterialReceipt(
  id: string,
  payload: { data: string; mimeType: string; fileName?: string; givenAmount?: number }
) {
  const material = await Material.findById(id);
  if (!material) throw new AppError(404, "Material not found");

  const { uploadToPCloud } = await import("./pcloud.service.js");

  try {
    const pcloudResult = await uploadToPCloud(
      payload.data,
      payload.fileName || `receipt_mat_${material.materialId}.${payload.mimeType.split("/")[1] || "jpg"}`,
      payload.mimeType
    );
    material.billUrl = pcloudResult.fileUrl;
  } catch (err) {
    console.warn("[pCloud] Upload failed for material, falling back to base64 storage:", err);
    material.receiptImage = payload.data;
    material.receiptImageMimeType = payload.mimeType;
    material.receiptImageName = payload.fileName;
    material.billUrl = `data:${payload.mimeType};base64,${payload.data}`;
  }

  if (payload.givenAmount !== undefined) {
    material.givenAmount = payload.givenAmount;
    material.status = "Received";
  }

  await material.save();
  return material.toObject();
}

/**
 * Migrate legacy material statuses to the new 2-value enum.
 * Old values: Pending, Approved, Rejected, Completed -> Received | Not Received
 *  - Pending/Approved/Completed  -> "Received"  (we treat any "approved/past" state
 *    as having been delivered, since these were the historical "go ahead" signals)
 *  - Rejected                   -> "Not Received"
 *
 * Safe to call repeatedly: once a row's status is in the new enum, the query
 * returns zero documents.
 */
export async function migrateMaterialStatus(): Promise<{ matched: number; modified: number }> {
  const legacy = ["Pending", "Approved", "Rejected", "Completed"];
  const toReceived = ["Pending", "Approved", "Completed"];
  const toNotReceived = ["Rejected"];

  const [a, b] = await Promise.all([
    Material.updateMany(
      { status: { $in: toReceived } },
      { $set: { status: "Received" } }
    ),
    Material.updateMany(
      { status: { $in: toNotReceived } },
      { $set: { status: "Not Received" } }
    ),
  ]);

  const matched = (a.matchedCount ?? 0) + (b.matchedCount ?? 0);
  const modified = (a.modifiedCount ?? 0) + (b.modifiedCount ?? 0);

  if (matched > 0) {
    console.log(`[MIGRATE] material.status: ${modified} row(s) updated (matched ${matched} legacy values)`);
  }

  // Sanity: log any stragglers (should be impossible given the enum constraint)
  const stragglers = await Material.countDocuments({ status: { $nin: ["Received", "Not Received"] } });
  if (stragglers > 0) {
    console.warn(`[MIGRATE] material.status: ${stragglers} row(s) still have legacy status`);
  }

  return { matched, modified };
}
