import { Types } from "mongoose";
import { Supervisor } from "../models/Supervisor.js";
import { Site } from "../models/Site.js";
import { Project } from "../models/Project.js";
import { Expense } from "../models/Expense.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import {
  CreateSupervisorInput,
  FundSupervisorInput,
  UpdateSupervisorInput,
} from "../schemas/entities.schema.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";
import { paginateByCursor } from "../utils/cursor-pagination.js";
import { recomputeSiteLedger } from "./expense.service.js";

type SiteAssignmentInput = {
  assignedSite?: string;
  assignedSites?: string[];
  assignedSiteId?: string;
  assignedSiteIds?: string[];
};

function toObjectId(value: unknown): Types.ObjectId | undefined {
  if (!value) return undefined;
  const str = String(value).trim();
  if (!str || !Types.ObjectId.isValid(str)) return undefined;
  return new Types.ObjectId(str);
}

function uniqueObjectIds(values: Array<Types.ObjectId | undefined>): Types.ObjectId[] {
  const seen = new Set<string>();
  const ids: Types.ObjectId[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(value);
  }
  return ids;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(trimmed);
  }
  return list;
}

async function normalizeSiteAssignment(input: SiteAssignmentInput) {
  const assignedSiteIds = uniqueObjectIds([
    toObjectId(input.assignedSiteId),
    ...(input.assignedSiteIds || []).map(toObjectId),
  ]);

  // Parse assignedSites to separate ObjectIds from names
  const assignedSitesInput = input.assignedSites || [];
  const assignedSiteIdStrings: string[] = [];
  const assignedSiteNames: string[] = [];

  for (const value of assignedSitesInput) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (Types.ObjectId.isValid(trimmed)) {
      assignedSiteIdStrings.push(trimmed);
    } else {
      assignedSiteNames.push(trimmed);
    }
  }

  // Also include any ObjectIds from assignedSiteIdStrings
  const allAssignedSiteIds = uniqueObjectIds([
    ...assignedSiteIds,
    ...assignedSiteIdStrings.map(toObjectId),
  ]);

  const sites = allAssignedSiteIds.length > 0
    ? await Site.find({ _id: { $in: allAssignedSiteIds } }).select("name").lean()
    : [];

  const siteNamesFromIds = sites.map((site) => site.name);

  return {
    assignedSiteId: allAssignedSiteIds[0],
    assignedSiteIds: allAssignedSiteIds,
    assignedSites: uniqueStrings([
      ...assignedSiteNames,
      input.assignedSite,
      ...siteNamesFromIds,
    ]),
  };
}

async function backfillAssignedSites(
  supervisorId: Types.ObjectId,
  supervisorName: string,
  assignedSiteIds: Types.ObjectId[]
) {
  if (assignedSiteIds.length === 0) return;
  await Site.updateMany(
    { _id: { $in: assignedSiteIds } },
    { $set: { supervisor: supervisorName, supervisorId } }
  );
}

/**
 * Sync project supervisor assignments bidirectionally.
 * - Projects removed from the supervisor's list: clear supervisorId/supervisor fields
 * - Projects added to the supervisor's list: set supervisorId/supervisor fields
 */
async function syncProjectSupervisorAssignments(
  supervisorId: Types.ObjectId,
  supervisorName: string,
  oldProjectIds: Types.ObjectId[],
  newProjectIds: Types.ObjectId[]
) {
  const oldIds = new Set(oldProjectIds.map(id => id.toString()));
  const newIds = new Set(newProjectIds.map(id => id.toString()));

  // Projects to remove: in old but not in new
  const toRemove = oldProjectIds.filter(id => !newIds.has(id.toString()));

  // Projects to add: in new but not in old
  const toAdd = newProjectIds.filter(id => !oldIds.has(id.toString()));

  // Remove supervisor from projects that are no longer assigned
  if (toRemove.length > 0) {
    await Project.updateMany(
      { _id: { $in: toRemove }, supervisorId },
      { $unset: { supervisorId: "", supervisor: "" } }
    );
  }

  // Add supervisor to newly assigned projects
  if (toAdd.length > 0) {
    await Project.updateMany(
      { _id: { $in: toAdd } },
      { $set: { supervisorId, supervisor: supervisorName } }
    );
  }
}

export async function createSupervisor(input: CreateSupervisorInput) {
  const supervisorId = await generateId("SUP");
  const siteAssignment = await normalizeSiteAssignment(input);

  const assignedProjectIds = uniqueObjectIds([
    toObjectId(input.assignedProjectId),
    ...(input.assignedProjectIds || []).map(toObjectId),
  ]);

  const supervisor = await Supervisor.create({
    ...input,
    supervisorId,
    assignedProjectId: assignedProjectIds[0],
    assignedProjects: assignedProjectIds,
    ...siteAssignment,
  });
  await backfillAssignedSites(supervisor._id, supervisor.name, siteAssignment.assignedSiteIds);
  return supervisor.toObject();
}

export async function listSupervisors(filter: { status?: string; search?: string; scopeProjectIds?: ProjectScopeIds; page?: number; limit?: number; cursor?: string } = {}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: "i" } },
      { phone: { $regex: filter.search, $options: "i" } },
      { email: { $regex: filter.search, $options: "i" } },
    ];
  }
  applyProjectScope(query, "assignedProjects", filter.scopeProjectIds);
  return paginateByCursor(Supervisor, query, {
    page: filter.page,
    limit: filter.limit,
    cursor: filter.cursor,
  });
}

export async function getSupervisorById(id: string, scopeProjectIds?: ProjectScopeIds) {
  const query: Record<string, unknown> = { _id: id };
  applyProjectScope(query, "assignedProjects", scopeProjectIds);
  const supervisor = await Supervisor.findOne(query).lean();
  if (!supervisor) throw new AppError(404, "Supervisor not found");
  return supervisor;
}

export async function fundSupervisor(
  id: string,
  input: FundSupervisorInput,
  adminName: string,
) {
  const supervisor = await Supervisor.findById(id);
  if (!supervisor) throw new AppError(404, "Supervisor not found");

  const projectId = new Types.ObjectId(input.projectId);
  const isAssigned = [supervisor.assignedProjectId, ...(supervisor.assignedProjects || [])]
    .filter(Boolean)
    .some((assignedId) => String(assignedId) === projectId.toString());
  const project = await Project.findById(projectId).lean();
  if (!project || (!isAssigned && String(project.supervisorId || "") !== supervisor._id.toString())) {
    throw new AppError(400, "Select a project assigned to this supervisor");
  }

  let site: { _id: Types.ObjectId; name: string } | null = null;
  if (input.siteId) {
    site = await Site.findOne({
      _id: new Types.ObjectId(input.siteId),
      projectIds: projectId,
    }).select("_id name").lean();
    if (!site) throw new AppError(400, "Select a site belonging to the assigned project");
  } else if (project.siteIds?.length) {
    site = await Site.findOne({ _id: project.siteIds[0], projectIds: projectId })
      .select("_id name")
      .lean();
  }

  const siteName = site?.name || project.siteNames?.[0] || "Project";
  const amount = Number(input.amount);
  const isOpeningAmount = !supervisor.openingAmountAddedAt;

  if (isOpeningAmount) {
    let openingExpense: Record<string, unknown> | undefined;
    if (site) {
      await Site.updateOne({ _id: site._id }, { $set: { openingBalance: amount } });
    } else {
      const expense = await Expense.create({
        expenseId: await generateId("EXP"),
        type: "site",
        projectId,
        projectName: project.name,
        clientId: project.clientId,
        site: siteName,
        supervisor: supervisor.name,
        supervisorId: supervisor._id,
        transactionType: "Cash Added",
        amount,
        runningBalance: 0,
        date: new Date().toISOString().slice(0, 10),
        description: input.note || `Opening amount added to ${supervisor.name}`,
        notes: input.note,
        status: "Approved",
        submittedBy: adminName,
        approvedBy: adminName,
        approvedAt: new Date(),
      });
      openingExpense = expense.toObject() as unknown as Record<string, unknown>;
    }
    supervisor.openingAmountAddedAt = new Date();
    supervisor.activeAdvances = amount;
    await supervisor.save();
    await recomputeSiteLedger(projectId, siteName);
    return {
      kind: "opening" as const,
      amount,
      projectId: projectId.toString(),
      siteId: site?._id.toString(),
      site: siteName,
      expense: openingExpense,
      supervisor: supervisor.toObject(),
    };
  }

  const expense = await Expense.create({
    expenseId: await generateId("EXP"),
    type: "site",
    projectId,
    projectName: project.name,
    clientId: project.clientId,
    siteId: site?._id,
    site: siteName,
    supervisor: supervisor.name,
    supervisorId: supervisor._id,
    transactionType: "Cash Added",
    amount,
    runningBalance: 0,
    date: new Date().toISOString().slice(0, 10),
    description: input.note || `Cash added to ${supervisor.name}`,
    notes: input.note,
    status: "Approved",
    submittedBy: adminName,
    approvedBy: adminName,
    approvedAt: new Date(),
  });
  supervisor.activeAdvances = Number(supervisor.activeAdvances || 0) + amount;
  await supervisor.save();
  await recomputeSiteLedger(projectId, siteName);
  const refreshedExpense = await Expense.findById(expense._id).lean();

  return {
    kind: "cash" as const,
    amount,
    projectId: projectId.toString(),
    siteId: site?._id.toString(),
    site: siteName,
    expense: refreshedExpense,
    supervisor: supervisor.toObject(),
  };
}

/**
 * Lightweight supervisor list — `{ _id, name, phone, email, supervisorId }`
 * per row. Used by the mobile worker create page so a supervisor can
 * be picked for directly-hired (non-subcontract) workers. Scoped to
 * the calling supervisor's accessible projects so a site-A supervisor
 * cannot pick a site-B supervisor.
 *
 * Note: Supervisor.status is the capitalized enum
 *   ["Active", "On Leave", "Inactive"] — distinct from Subcontractor's
 * lowercase "active"/"inactive" enum. Match the exact case.
 */
export async function listSupervisorsForWorker(filter: {
  scopeProjectIds?: ProjectScopeIds;
} = {}) {
  const query: Record<string, unknown> = { status: "Active" };
  applyProjectScope(query, "assignedProjects", filter.scopeProjectIds);

  const items = await Supervisor.find(query)
    .select("_id name phone email supervisorId assignedProjects")
    .sort({ name: 1 })
    .lean();
  return items.map((s) => ({
    _id: String(s._id),
    name: s.name,
    phone: s.phone || "",
    email: s.email || "",
    supervisorId: s.supervisorId || "",
    projectId: s.assignedProjects?.length ? String(s.assignedProjects[0]) : "",
  }));
}

export async function updateSupervisor(id: string, patch: UpdateSupervisorInput, scopeProjectIds?: ProjectScopeIds) {
  const existingSupervisor = await getSupervisorById(id, scopeProjectIds);
  const updateData: Record<string, unknown> = { ...patch };

  if (patch.assignedProjectId) {
    updateData.assignedProjectId = new Types.ObjectId(patch.assignedProjectId);
  }
  if (patch.assignedProjectIds) {
    const projectIds = patch.assignedProjectIds
      .map((pid) => toObjectId(pid))
      .filter((id): id is Types.ObjectId => id !== undefined);
    updateData.assignedProjects = projectIds;
    if (projectIds.length > 0 && !patch.assignedProjectId) {
      updateData.assignedProjectId = projectIds[0];
    }
  }

  const shouldNormalizeSites = ["assignedSite", "assignedSites", "assignedSiteId", "assignedSiteIds"].some((key) =>
    Object.prototype.hasOwnProperty.call(patch, key)
  );
  if (shouldNormalizeSites) {
    Object.assign(updateData, await normalizeSiteAssignment(patch));
    delete updateData.assignedSite;
  }

  const update: Record<string, unknown> = { $set: updateData };
  if (shouldNormalizeSites && !updateData.assignedSiteId) {
    delete updateData.assignedSiteId;
    update.$unset = { assignedSiteId: "" };
  }

  const supervisor = await Supervisor.findByIdAndUpdate(id, update, { new: true });
  if (!supervisor) throw new AppError(404, "Supervisor not found");
  if (shouldNormalizeSites) {
    await backfillAssignedSites(
      supervisor._id,
      supervisor.name,
      (updateData.assignedSiteIds as Types.ObjectId[] | undefined) || []
    );
  }

  // Sync project assignments bidirectionally
  if (patch.assignedProjectIds !== undefined) {
    await syncProjectSupervisorAssignments(
      supervisor._id,
      supervisor.name,
      existingSupervisor.assignedProjects || [],
      updateData.assignedProjects as Types.ObjectId[] || []
    );
  }

  return supervisor.toObject();
}

export async function deleteSupervisor(id: string, scopeProjectIds?: ProjectScopeIds) {
  await getSupervisorById(id, scopeProjectIds);
  const result = await Supervisor.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Supervisor not found");
}
