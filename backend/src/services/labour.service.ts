import { Types } from "mongoose";
import { Labour } from "../models/Labour.js";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { createApproval } from "./approval.service.js";
import { CreateLabourInput } from "../schemas/financial.schema.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { dbMutex } from "../utils/db-mutex.js";
import { withRetry } from "../utils/retry.js";

type LabourPageCursorState = {
  cursors: Map<number, string>;
  total?: number;
  expiresAt: number;
};

const labourPageCursorCache = new Map<string, LabourPageCursorState>();
const LABOUR_PAGE_CURSOR_TTL_MS = 5 * 60_000;

function labourPageKey(filter: {
  projectId?: string;
  siteId?: string;
  site?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
  scopeProjectIds?: ProjectScopeIds;
}): string {
  return JSON.stringify({
    projectId: filter.projectId || "",
    siteId: filter.siteId || "",
    site: filter.site || "",
    category: filter.category || "",
    status: filter.status || "",
    from: filter.from || "",
    to: filter.to || "",
    scopeProjectIds: (filter.scopeProjectIds || []).map((id) => String(id)).sort(),
  });
}

function getLabourCursorState(key: string): LabourPageCursorState {
  const existing = labourPageCursorCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing;

  const fresh: LabourPageCursorState = {
    cursors: new Map<number, string>(),
    expiresAt: Date.now() + LABOUR_PAGE_CURSOR_TTL_MS,
  };
  labourPageCursorCache.set(key, fresh);
  if (labourPageCursorCache.size > 200) {
    const oldest = labourPageCursorCache.keys().next().value;
    if (oldest) labourPageCursorCache.delete(oldest);
  }
  return fresh;
}

export async function createLabour(input: CreateLabourInput) {
  const project = await Project.findById(input.projectId);
  if (!project) throw new AppError(404, "Project not found");

  const client = await Client.findById(project.clientId);
  if (!client) throw new AppError(404, "Client not found");

  const labourId = await generateId("LAB");
  const labour = await Labour.create({
    labourId,
    projectId: project._id,
    projectName: project.name,
    clientId: client._id,
    siteId: input.siteId ? new Types.ObjectId(input.siteId) : undefined,
    site: input.site,
    partyName: input.partyName,
    category: input.category,
    attendanceDate: input.attendanceDate,
    presentCount: input.presentCount,
    presentDays: input.presentDays,
    absentDays: input.absentDays,
    dailyWage: input.dailyWage,
    overtime: input.overtime,
    lateFine: input.lateFine,
    shift: input.shift,
    paymentMode: input.paymentMode,
    wagePeriod: input.wagePeriod,
    laborTypes: input.laborTypes,
    notes: input.notes,
    submittedBy: input.submittedBy,
  });

  const totalStaff = input.laborTypes.reduce((sum, lt) => sum + lt.staffCount, 0) || input.presentCount;
  await createApproval({
    type: "labour",
    title: `${input.partyName} - ${input.category}`,
    sourceCollection: "labour",
    sourceId: labour._id,
    projectId: project._id,
    projectName: project.name,
    site: input.site,
    owner: input.partyName,
    amount: input.dailyWage * totalStaff,
    detail: `${totalStaff} workers on ${input.attendanceDate}`,
  });

  return labour.toObject();
}

export async function listLabour(filter: {
  projectId?: string;
  siteId?: string;
  site?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  cursor?: string;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = new Types.ObjectId(filter.projectId);
  if (filter.siteId) query.siteId = new Types.ObjectId(filter.siteId);
  if (filter.site) query.site = filter.site;
  if (filter.category) query.category = filter.category;
  if (filter.status) query.status = filter.status;
  if (filter.from || filter.to) {
    query.attendanceDate = {};
    if (filter.from) (query.attendanceDate as Record<string, string>).$gte = filter.from;
    if (filter.to) (query.attendanceDate as Record<string, string>).$lte = filter.to;
  }
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  // Cursor-based pagination by _id. The previous implementation used
  // skip+limit which is O(skip) on MongoDB and times out on M0 once the
  // collection grows past a few hundred rows. Cursor pagination uses an
  // indexed _id range query that's O(log n).
  const effectiveLimit = Math.min(Math.max(filter.limit || 25, 1), 25);
  const effectivePage = Math.max(filter.page || 1, 1);
  const pageState = getLabourCursorState(labourPageKey(filter));
  const internalCursor = filter.cursor || pageState.cursors.get(effectivePage);

  if (internalCursor) {
    try {
      query._id = { $lt: new Types.ObjectId(internalCursor) };
    } catch {
      // Invalid cursor → start from beginning
    }
  }

  const skip = internalCursor ? 0 : (effectivePage - 1) * effectiveLimit;
  type LabourLike = { [k: string]: unknown };
  let items: LabourLike[] = [];
  let total = 0;
  let nextCursor: string | null = null;
  let queryFailed = false;
  try {
    const tDb = Date.now();
    if (!internalCursor && effectivePage === 1) {
      const [foundItems, foundTotal] = await dbMutex.run(() =>
        withRetry(async () => {
          const findPromise = Labour.find(query)
            .sort({ _id: -1 })
            .skip(skip)
            .limit(effectiveLimit)
            .lean()
            .maxTimeMS(60_000);
          const countPromise = Labour.countDocuments(query).maxTimeMS(30_000);
          return Promise.all([findPromise, countPromise]) as Promise<[any[], number]>;
        }, { label: "listLabour.find+count" })
      );
      items = foundItems as unknown as LabourLike[];
      total = foundTotal;
      pageState.total = foundTotal;
      console.log(`[listLabour] dbMutex find+count dt=${Date.now() - tDb}ms items=${items.length} total=${total}`);
    } else {
      const foundItems = await dbMutex.run(() =>
        withRetry(
          () => Labour.find(query)
            .sort({ _id: -1 })
            .skip(skip)
            .limit(effectiveLimit)
            .lean()
            .maxTimeMS(60_000),
          { label: "listLabour.find" }
        )
      );
      items = foundItems as unknown as LabourLike[];
      total = pageState.total ?? (
        items.length < effectiveLimit
          ? skip + items.length
          : skip + effectiveLimit + 1
      );
      console.log(`[listLabour] dbMutex find dt=${Date.now() - tDb}ms items=${items.length}`);
    }
    // Emit nextCursor only when the page is full — a short page means
    // we've reached the end of the collection.
    if (items.length === effectiveLimit) {
      const lastItem = items[items.length - 1];
      if (lastItem && (lastItem as any)._id) {
        nextCursor = String((lastItem as any)._id);
        pageState.cursors.set(effectivePage + 1, nextCursor);
        pageState.expiresAt = Date.now() + LABOUR_PAGE_CURSOR_TTL_MS;
      }
    }
  } catch (err) {
    console.error("[listLabour] query failed:", (err as Error).message);
    items = [];
    total = 0;
    queryFailed = true;
  }
  return {
    items,
    total,
    page: effectivePage,
    limit: effectiveLimit,
    pages: Math.ceil(total / effectiveLimit),
    nextCursor,
    queryFailed,
  };
}

export async function getLabourById(id: string) {
  const labour = await Labour.findById(id).lean();
  if (!labour) throw new AppError(404, "Labour record not found");
  return labour;
}

export async function updateLabour(id: string, patch: Partial<CreateLabourInput>) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.siteId) update.siteId = new Types.ObjectId(patch.siteId);

  const customFields = (patch as any).customFields as Record<string, unknown> | undefined;
  if (customFields) {
    delete update.customFields;
    for (const [key, val] of Object.entries(customFields)) {
      update[`customFields.${key}`] = val;
    }
  }

  const labour = await Labour.findByIdAndUpdate(id, update, { new: true });
  if (!labour) throw new AppError(404, "Labour record not found");
  return labour.toObject();
}

export async function deleteLabour(id: string) {
  const result = await Labour.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Labour record not found");
}

export async function getLabourSummary(projectId: string, scopeProjectIds?: ProjectScopeIds) {
  const pid = new Types.ObjectId(projectId);
  const query: Record<string, unknown> = { projectId: pid, status: "Approved" };
  applyProjectScope(query, "projectId", scopeProjectIds);
  const agg = await Labour.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$category",
        totalStaff: { $sum: "$presentCount" },
        totalDays: { $sum: "$presentDays" },
        totalWages: { $sum: { $multiply: ["$dailyWage", "$presentCount"] } },
        count: { $sum: 1 },
      },
    },
  ]);
  return agg;
}

export async function getPendingLabour(scopeProjectIds?: ProjectScopeIds) {
  const query: Record<string, unknown> = { status: "Pending" };
  applyProjectScope(query, "projectId", scopeProjectIds);
  return Labour.find(query).sort({ createdAt: -1 }).lean();
}
