import { Types } from "mongoose";
import { Subcontractor } from "../models/Subcontractor.js";
import { Project } from "../models/Project.js";
import { AppError } from "../middleware/errorHandler.js";
import { paginateByCursor } from "../utils/cursor-pagination.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { getSupervisorAccess } from "./supervisor-mobile.service.js";

export interface CreateSubcontractorInput {
  projectId: string;
  projectIds?: string[];
  subcontractorName: string;
  description?: string;
  employeeCount?: number;
  note?: string;
  address?: string;
  phone?: string;
  gstType?: "GST" | "Non-GST";
  status?: "active" | "inactive";
}

function toObjectId(id: string | undefined | null): Types.ObjectId | undefined {
  if (!id) return undefined;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid projectId");
  return new Types.ObjectId(id);
}

export async function createSubcontractor(input: CreateSubcontractorInput) {
  const projectId = toObjectId(input.projectId);
  const project = projectId ? await Project.findById(projectId) : null;
  if (!project) throw new AppError(404, "Project not found");

  const sub = await Subcontractor.create({
    projectId: project._id,
    projectIds: input.projectIds?.length ? input.projectIds : [project._id],
    projectName: project.name,
    clientId: project.clientId,
    subcontractorName: input.subcontractorName,
    description: input.description || "",
    employeeCount: input.employeeCount,
    note: input.note || "",
    address: input.address || "",
    phone: input.phone || "",
    gstType: input.gstType || "Non-GST",
    status: input.status || "active",
  });
  return sub.toObject();
}

export async function listSubcontractors(filter: {
  projectId?: string;
  status?: string;
  page: number;
  limit: number;
  cursor?: string;
  scopeProjectIds?: ProjectScopeIds;
}) {
  const query: Record<string, unknown> = {};
  const projectConditions: Record<string, unknown>[] = [];
  if (filter.projectId) {
    const projectId = toObjectId(filter.projectId);
    projectConditions.push({ $or: [{ projectId }, { projectIds: projectId }] });
  }
  if (filter.status) query.status = filter.status;
  if (filter.scopeProjectIds !== undefined && filter.scopeProjectIds !== null) {
    projectConditions.push({
      $or: [
        { projectId: { $in: filter.scopeProjectIds } },
        { projectIds: { $in: filter.scopeProjectIds } },
      ],
    });
  }
  if (projectConditions.length) query.$and = projectConditions;

  return paginateByCursor(Subcontractor, query, {
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
    maxLimit: 500,
  });
}

/**
 * Lightweight list — just `{ _id, subcontractorName, status, projectId }`
 * per row. Used by the mobile worker create page to populate the
 * universal dropdown.
 *
 * When no `scopeProjectIds` is passed the call returns EVERY active
 * subcontractor in the database — appropriate for admin tooling but
 * dangerous for a supervisor-scoped API. Always prefer
 * {@link listSubcontractorsForSupervisor} from supervisor endpoints.
 */
export async function listSubcontractorsForWorker(filter: {
  scopeProjectIds?: ProjectScopeIds;
} = {}) {
  const query: Record<string, unknown> = { status: "active" };
  applyProjectScope(query, "projectId", filter.scopeProjectIds);

  const items = await Subcontractor.find(query)
    .select("_id subcontractorName projectId")
    .sort({ subcontractorName: 1 })
    .lean();
  return items.map((s) => ({
    _id: String(s._id),
    subcontractorName: s.subcontractorName,
    projectId: s.projectId ? String(s.projectId) : "",
  }));
}

/**
 * Supervisor-scoped variant: only sub-contractors belonging to projects
 * the calling supervisor is assigned to. Returns an empty list (not 403)
 * when the supervisor has no accessible projects — the worker-create
 * UI then shows the empty-state message.
 */
export async function listSubcontractorsForSupervisor(userId: string) {
  const access = await getSupervisorAccess(userId);
  const query: Record<string, unknown> = { status: "active" };

  if (access.projectIds.length > 0) {
    query.projectId = { $in: access.projectIds };
  } else if (access.siteNames.length > 0) {
    // No explicit project assignment, but the supervisor is bound to
    // sites by name — match subcontractors whose project contains
    // those sites by looking up the projects by site name.
    const { Project } = await import("../models/Project.js");
    const projects = await Project.find({ "sites.name": { $in: access.siteNames } })
      .select("_id")
      .lean();
    const projectIds = projects.map((p) => p._id);
    if (projectIds.length === 0) return [];
    query.projectId = { $in: projectIds };
  } else {
    return [];
  }

  const items = await Subcontractor.find(query)
    .select("_id subcontractorName projectId")
    .sort({ subcontractorName: 1 })
    .lean();
  return items.map((s) => ({
    _id: String(s._id),
    subcontractorName: s.subcontractorName,
    projectId: s.projectId ? String(s.projectId) : "",
  }));
}

/**
 * Universal list — every ACTIVE sub-contractor across all projects.
 * Used by the mobile worker-create page so a sub-contractor that works
 * across multiple projects/sites can be picked from a single dropdown.
 *
 * The Subcontractor model is intentionally project-agnostic: a single
 * party ("Sri Balaji Electricals") can be assigned to many projects
 * concurrently, so the worker-create flow should show every active
 * sub-contractor regardless of which site/project is currently
 * selected. Project-scoping is still applied where it matters
 * (e.g. the admin subcontractor list, the financial rollup).
 */
export async function listAllActiveSubcontractors() {
  const items = await Subcontractor.find({ status: "active" })
    .select("_id subcontractorName projectId projectIds address phone note gstType status")
    .sort({ subcontractorName: 1 })
    .lean();
  return items.map((s) => ({
    _id: String(s._id),
    subcontractorName: s.subcontractorName,
    projectId: s.projectId ? String(s.projectId) : "",
    projectIds: (s.projectIds || []).map((projectId) => String(projectId)),
    address: s.address || "",
    phone: s.phone || "",
    gstType: s.gstType || "Non-GST",
    note: s.note || "",
    status: s.status,
  }));
}

export async function getSubcontractorById(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid subcontractor id");
  const sub = await Subcontractor.findById(id).lean();
  if (!sub) throw new AppError(404, "Subcontractor not found");
  return sub;
}

export async function updateSubcontractor(
  id: string,
  patch: Partial<CreateSubcontractorInput>
) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid subcontractor id");
  const normalizedPatch: Record<string, unknown> = { ...patch };
  if (patch.projectIds) normalizedPatch.projectIds = patch.projectIds.map((projectId) => toObjectId(projectId));
  const sub = await Subcontractor.findByIdAndUpdate(id, normalizedPatch, { new: true });
  if (!sub) throw new AppError(404, "Subcontractor not found");
  return sub.toObject();
}

export async function deleteSubcontractor(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid subcontractor id");
  const result = await Subcontractor.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Subcontractor not found");
}
