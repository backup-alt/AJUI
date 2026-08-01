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
  if (filter.cursor) {
    try {
      query._id = { $lt: new Types.ObjectId(filter.cursor) };
    } catch {
      // Invalid cursor → start from beginning
    }
  }

  const effectiveLimit = Math.min(Math.max(filter.limit || 25, 1), 25);
  type LabourLike = { [k: string]: unknown };
  let items: LabourLike[] = [];
  let total = 0;
  let nextCursor: string | null = null;
  try {
    const tDb = Date.now();
    if (!filter.cursor) {
      const [foundItems, foundTotal] = await dbMutex.run(async () => {
        const findPromise = Labour.find(query)
          .sort({ _id: -1 })
          .limit(effectiveLimit)
          .lean()
          .maxTimeMS(60_000);
        const countPromise = Labour.estimatedDocumentCount(query).maxTimeMS(30_000);
        return Promise.all([findPromise, countPromise]) as Promise<[any[], number]>;
      });
      items = foundItems as unknown as LabourLike[];
      total = foundTotal;
      console.log(`[listLabour] dbMutex find+count dt=${Date.now() - tDb}ms items=${items.length} total=${total}`);
    } else {
      const foundItems = await dbMutex.run(async () => {
        return await Labour.find(query)
          .sort({ _id: -1 })
          .limit(effectiveLimit)
          .lean()
          .maxTimeMS(60_000);
      });
      items = foundItems as unknown as LabourLike[];
      total = filter.page * effectiveLimit;
      console.log(`[listLabour] dbMutex find dt=${Date.now() - tDb}ms items=${items.length}`);
    }
    // Emit nextCursor only when the page is full — a short page means
    // we've reached the end of the collection.
    if (items.length === effectiveLimit) {
      const lastItem = items[items.length - 1];
      if (lastItem && (lastItem as any)._id) {
        nextCursor = String((lastItem as any)._id);
      }
    }
  } catch (err) {
    console.error("[listLabour] query failed:", (err as Error).message);
    items = [];
    total = 0;
  }
  return {
    items,
    total,
    page: filter.page,
    limit: effectiveLimit,
    pages: Math.ceil(total / effectiveLimit),
    nextCursor,
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
