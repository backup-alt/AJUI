import { Types } from "mongoose";
import { SubcontractorPayment } from "../models/SubcontractorPayment.js";
import { Subcontractor } from "../models/Subcontractor.js";
import { Project } from "../models/Project.js";
import { Site } from "../models/Site.js";
import { AppError } from "../middleware/errorHandler.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { invalidateAccessCache } from "../middleware/rbac.js";

export interface CreateSubcontractorPaymentInput {
  subcontractorId: string;
  projectId: string;
  siteId?: string;
  date: string;
  description: string;
  employeeCount: number;
  amount: number;
  notes?: string;
}

export interface UpdateSubcontractorPaymentInput {
  subcontractorId?: string;
  projectId?: string;
  siteId?: string;
  date?: string;
  description?: string;
  employeeCount?: number;
  amount?: number;
  notes?: string;
}

function toObjectId(id: string | undefined | null, label: string): Types.ObjectId {
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new AppError(400, `Invalid ${label}`);
  }
  return new Types.ObjectId(id);
}

/**
 * Resolve a sub-contractor + project + site triple and validate that
 * the chosen site belongs to the chosen project. Returns the populated
 * documents so the service can stamp the payment's denormalized
 * display fields without a second round-trip.
 */
async function resolveRefs(
  subcontractorId: string,
  projectId: string,
  siteId?: string
) {
  const sub = await Subcontractor.findById(toObjectId(subcontractorId, "subcontractorId"));
  if (!sub) throw new AppError(404, "Subcontractor not found");
  const project = await Project.findById(toObjectId(projectId, "projectId"));
  if (!project) throw new AppError(404, "Project not found");
  if (sub.projectId && String(sub.projectId) !== String(project._id)) {
    // Sub-contractor is associated with a single project by default;
    // the spec still allows them to supply labourers to other projects
    // (multi-project assignment). Allow it but log a warning to make
    // it visible in logs.
  }
  let siteDoc: { _id: Types.ObjectId; name: string } | undefined;
  if (siteId) {
    const oid = toObjectId(siteId, "siteId");
    const found = await Site.findById(oid).select("_id name projectIds").lean();
    if (!found) throw new AppError(404, "Site not found");
    siteDoc = { _id: found._id as Types.ObjectId, name: found.name };
    // Ensure the site actually belongs to the selected project.
    const belongs = (found.projectIds || []).some(
      (pid: any) => String(pid) === String(project._id)
    );
    if (!belongs) {
      throw new AppError(400, "Selected site does not belong to the selected project");
    }
  }
  return { sub, project, site: siteDoc };
}

function validatePaymentShape(input: {
  date?: string;
  description?: string;
  employeeCount?: number;
  amount?: number;
}) {
  if (input.date !== undefined && !/^\d{4}-\d{2}-\d{2}/.test(String(input.date))) {
    throw new AppError(400, "Date is invalid (expected YYYY-MM-DD)");
  }
  if (input.description !== undefined && !String(input.description).trim()) {
    throw new AppError(400, "Description is required");
  }
  if (input.employeeCount !== undefined) {
    if (!Number.isFinite(input.employeeCount) || input.employeeCount < 1 || !Number.isInteger(input.employeeCount)) {
      throw new AppError(400, "Number of employees must be a positive whole number");
    }
  }
  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new AppError(400, "Amount must be a number greater than zero");
    }
  }
}

/**
 * Strip null/undefined/empty-string siteId so we don't store bogus
 * empty ObjectIds in the index.
 */
function normalizeSiteId(siteId?: string) {
  if (!siteId || !Types.ObjectId.isValid(siteId)) return undefined;
  return new Types.ObjectId(siteId);
}

export async function createSubcontractorPayment(
  input: CreateSubcontractorPaymentInput,
  recordedBy?: string,
  scopeProjectIds?: ProjectScopeIds
) {
  validatePaymentShape(input);
  const { sub, project, site } = await resolveRefs(
    input.subcontractorId,
    input.projectId,
    input.siteId
  );

  // RBAC: a project manager / accountant can only record payments
  // against projects they're scoped to. Admins have null scope
  // (see getScopedProjectIds) and skip this check.
  if (scopeProjectIds !== undefined && scopeProjectIds !== null) {
    const allowed = scopeProjectIds.some((id) => String(id) === String(project._id));
    if (!allowed) {
      throw new AppError(403, "Not authorized to record payments for this project");
    }
  }

  const payment = await SubcontractorPayment.create({
    subcontractorId: sub._id,
    projectId: project._id,
    siteId: site?._id,
    subcontractorName: sub.subcontractorName,
    projectName: project.name,
    siteName: site?.name,
    date: input.date,
    description: String(input.description || "").trim(),
    employeeCount: Number(input.employeeCount),
    amount: Number(input.amount),
    notes: input.notes || "",
    createdBy: recordedBy && Types.ObjectId.isValid(recordedBy)
      ? new Types.ObjectId(recordedBy)
      : undefined,
  });
  return payment.toObject();
}

export async function updateSubcontractorPayment(
  id: string,
  patch: UpdateSubcontractorPaymentInput,
  scopeProjectIds?: ProjectScopeIds
) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid payment id");
  validatePaymentShape(patch);

  const existing = await SubcontractorPayment.findById(id);
  if (!existing) throw new AppError(404, "Payment not found");

  // RBAC: enforce the scope against the *current* projectId on the
  // payment. If the caller is moving the payment to a different
  // project, the destination is also checked below.
  if (scopeProjectIds !== undefined && scopeProjectIds !== null) {
    const allowed = scopeProjectIds.some((id) => String(id) === String(existing.projectId));
    if (!allowed) {
      throw new AppError(403, "Not authorized to edit payments for this project");
    }
  }

  // If the project or subcontractor is being moved, re-validate the
  // refs and update the denormalized display fields. If only the site
  // is being moved, re-validate that the site still belongs to the
  // (possibly new) project.
  let sub = existing.subcontractorId as unknown as { _id: Types.ObjectId; subcontractorName: string };
  let project = existing.projectId as unknown as { _id: Types.ObjectId; name: string };
  let siteDoc: { _id: Types.ObjectId; name: string } | undefined =
    existing.siteId
      ? ({ _id: existing.siteId as Types.ObjectId, name: existing.siteName || "" } as any)
      : undefined;

  if (patch.subcontractorId || patch.projectId) {
    const subcontractorId = patch.subcontractorId || String(existing.subcontractorId);
    const projectId = patch.projectId || String(existing.projectId);
    const siteId = patch.siteId !== undefined ? patch.siteId : existing.siteId ? String(existing.siteId) : undefined;
    // RBAC: when moving a payment to another project, the destination
    // project must also be in the user's scope.
    if (scopeProjectIds !== undefined && scopeProjectIds !== null && patch.projectId) {
      const allowed = scopeProjectIds.some((id) => String(id) === projectId);
      if (!allowed) {
        throw new AppError(403, "Not authorized to move this payment to the selected project");
      }
    }
    const resolved = await resolveRefs(subcontractorId, projectId, siteId);
    sub = resolved.sub as any;
    project = resolved.project as any;
    siteDoc = resolved.site as any;
    existing.subcontractorId = sub._id;
    existing.projectId = project._id;
    existing.subcontractorName = sub.subcontractorName;
    existing.projectName = project.name;
    if (resolved.site) {
      existing.siteId = resolved.site._id;
      existing.siteName = resolved.site.name;
    } else if (patch.siteId === null || patch.siteId === "") {
      existing.siteId = undefined;
      existing.siteName = undefined;
    }
  } else if (patch.siteId !== undefined) {
    const siteId = patch.siteId || undefined;
    if (!siteId) {
      existing.siteId = undefined;
      existing.siteName = undefined;
    } else {
      const resolved = await resolveRefs(String(existing.subcontractorId), String(existing.projectId), siteId);
      siteDoc = resolved.site as any;
      existing.siteId = resolved.site?._id;
      existing.siteName = resolved.site?.name;
    }
  }

  if (patch.date !== undefined) existing.date = patch.date;
  if (patch.description !== undefined) existing.description = String(patch.description).trim();
  if (patch.employeeCount !== undefined) existing.employeeCount = Number(patch.employeeCount);
  if (patch.amount !== undefined) existing.amount = Number(patch.amount);
  if (patch.notes !== undefined) existing.notes = patch.notes || "";

  await existing.save();
  return existing.toObject();
}

export async function deleteSubcontractorPayment(id: string, scopeProjectIds?: ProjectScopeIds) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid payment id");
  const existing = await SubcontractorPayment.findById(id).select("projectId").lean();
  if (!existing) throw new AppError(404, "Payment not found");
  if (scopeProjectIds !== undefined && scopeProjectIds !== null) {
    const allowed = scopeProjectIds.some((pid) => String(pid) === String(existing.projectId));
    if (!allowed) {
      throw new AppError(403, "Not authorized to delete payments for this project");
    }
  }
  const result = await SubcontractorPayment.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Payment not found");
  return { projectId: existing.projectId ? String(existing.projectId) : "" };
}

/**
 * List payments, scoped by user role. Optional filters combine with
 * AND. If `subcontractorId` is provided, returns every payment for
 * that sub-contractor across all projects/sites.
 */
export async function listSubcontractorPayments(filter: {
  subcontractorId?: string;
  projectId?: string;
  siteId?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  cursor?: string;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  if (filter.subcontractorId) query.subcontractorId = toObjectId(filter.subcontractorId, "subcontractorId");
  if (filter.projectId) query.projectId = toObjectId(filter.projectId, "projectId");
  if (filter.siteId) query.siteId = toObjectId(filter.siteId, "siteId");
  if (filter.from || filter.to) {
    const range: Record<string, string> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    query.date = range;
  }
  // When listing by subcontractorId, we still apply RBAC scope so a
  // project_manager can only see payments tied to their assigned
  // projects. Admins (null scope) see everything.
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  const PAGE_SIZE = Math.min(Math.max(filter.limit || 200, 1), 500);
  const pageNum = Math.max(filter.page || 1, 1);
  // Cursor-based pagination by _id desc to match the rest of the API.
  if (filter.cursor && Types.ObjectId.isValid(filter.cursor)) {
    query._id = { $lt: new Types.ObjectId(filter.cursor) };
  }

  const [items, total] = await Promise.all([
    SubcontractorPayment.find(query)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1)
      .lean(),
    SubcontractorPayment.countDocuments(query),
  ]);
  const hasMore = items.length > PAGE_SIZE;
  const trimmed = hasMore ? items.slice(0, PAGE_SIZE) : items;
  const nextCursor = hasMore ? String(trimmed[trimmed.length - 1]._id) : null;
  return {
    items: trimmed,
    total,
    page: pageNum,
    limit: PAGE_SIZE,
    nextCursor,
    hasMore,
  };
}

/**
 * Recompute subcontractor spend for a project (or all projects if
 * no projectId is given). This is the source of truth for the project
 * total expense rollup — no stored aggregate to drift out of sync.
 */
export async function subcontractorSpendRollup(filter: {
  projectId?: string;
  scopeProjectIds?: ProjectScopeIds;
}): Promise<{ totalPaid: number; perProject: Record<string, number> }> {
  const query: Record<string, unknown> = {};
  if (filter.projectId) query.projectId = toObjectId(filter.projectId, "projectId");
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  const rows = await SubcontractorPayment.find(query)
    .select("projectId amount")
    .lean();
  const perProject: Record<string, number> = {};
  let totalPaid = 0;
  for (const row of rows) {
    const pid = row.projectId ? String(row.projectId) : "unassigned";
    const amount = Number(row.amount) || 0;
    perProject[pid] = (perProject[pid] || 0) + amount;
    totalPaid += amount;
  }
  return { totalPaid, perProject };
}

/**
 * Summary for the sub-contractor details page — total paid, number
 * of records, distinct projects and distinct sites. RBAC-scoped so a
 * project manager / accountant only sees rows for their projects.
 */
export async function subcontractorPaymentSummary(subcontractorId: string, scopeProjectIds?: ProjectScopeIds) {
  if (!Types.ObjectId.isValid(subcontractorId)) {
    throw new AppError(400, "Invalid subcontractor id");
  }
  const oid = new Types.ObjectId(subcontractorId);
  const query: Record<string, unknown> = { subcontractorId: oid };
  applyProjectScope(query, "projectId", scopeProjectIds);
  const rows = await SubcontractorPayment.find(query)
    .select("projectId siteId amount")
    .lean();
  let totalPaid = 0;
  const projects = new Set<string>();
  const sites = new Set<string>();
  for (const row of rows) {
    totalPaid += Number(row.amount) || 0;
    if (row.projectId) projects.add(String(row.projectId));
    if (row.siteId) sites.add(String(row.siteId));
  }
  return {
    totalPaid,
    recordCount: rows.length,
    projectCount: projects.size,
    siteCount: sites.size,
  };
}