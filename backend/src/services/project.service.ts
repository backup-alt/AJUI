import { Types } from "mongoose";
import { Project } from "../models/Project.js";
import { Client } from "../models/Client.js";
import { Site } from "../models/Site.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import {
  CreateProjectInput,
  UpdateProjectInput,
} from "../schemas/entities.schema.js";
import { recomputeClientTotals, computeProjectLedger } from "./financial.service.js";
import { applyProjectScope, ProjectScopeIds } from "../utils/scope.js";

export async function createProject(input: CreateProjectInput) {
  const client = await Client.findById(input.clientId);
  if (!client) throw new AppError(404, "Client not found");

  const projectId = await generateId("AB");
  const siteIds = (input.siteIds || []).map((id) => new Types.ObjectId(id));
  const sites = siteIds.length > 0 ? await Site.find({ _id: { $in: siteIds } }).lean() : [];
  const siteNames = sites.map((s) => s.name);

  const project = await Project.create({
    projectId,
    name: input.name,
    client: client.name,
    clientId: client._id,
    mobile: input.mobile,
    address: input.address,
    supervisor: input.supervisor,
    supervisorId: input.supervisorId ? new Types.ObjectId(input.supervisorId) : undefined,
    siteIds,
    siteNames,
    status: input.status,
    startDate: input.startDate,
    totalValue: input.totalValue,
    estimatedValue: input.estimatedValue,
    advanceAmount: input.advanceAmount,
    receivedAmount: input.receivedAmount,
    materialSpend: input.materialSpend,
    labourPayable: input.labourPayable,
    expenseBalance: input.expenseBalance,
    completion: input.completion,
  });

  await Client.findByIdAndUpdate(client._id, { $addToSet: { projectIds: project.projectId } });

  if (siteIds.length > 0) {
    await Site.updateMany(
      { _id: { $in: siteIds } },
      { $addToSet: { projectIds: project._id } }
    );
  }

  return project.toObject();
}

export async function listProjects(filter: {
  search?: string;
  status?: string;
  clientId?: string;
  siteId?: string;
  supervisorId?: string;
  page: number;
  limit: number;
  scopeQuery?: Record<string, unknown>;
}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.clientId) query.clientId = new Types.ObjectId(filter.clientId);
  if (filter.siteId) query.siteIds = new Types.ObjectId(filter.siteId);
  if (filter.supervisorId) query.supervisorId = new Types.ObjectId(filter.supervisorId);
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: "i" } },
      { projectId: { $regex: filter.search, $options: "i" } },
      { client: { $regex: filter.search, $options: "i" } },
    ];
  }

  // Apply role-based scope
  if (filter.scopeQuery && Object.keys(filter.scopeQuery).length > 0) {
    Object.assign(query, filter.scopeQuery);
  }

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Project.find(query)
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(filter.limit)
      .lean(),
    Project.countDocuments(query),
  ]);

  return {
    items,
    total,
    page: filter.page,
    limit: filter.limit,
    pages: Math.ceil(total / filter.limit),
  };
}

export async function getProjectById(id: string, scopeProjectIds?: ProjectScopeIds) {
  const query: Record<string, unknown> = { _id: id };
  applyProjectScope(query, "_id", scopeProjectIds);
  const project = await Project.findOne(query).lean();
  if (!project) throw new AppError(404, "Project not found");
  return project;
}

export async function updateProject(id: string, patch: UpdateProjectInput, scopeProjectIds?: ProjectScopeIds) {
  await getProjectById(id, scopeProjectIds);
  const updateData: Record<string, unknown> = { ...patch };
  if (patch.clientId) updateData.clientId = new Types.ObjectId(patch.clientId);
  if (patch.supervisorId) updateData.supervisorId = new Types.ObjectId(patch.supervisorId);
  if (patch.siteIds) {
    const siteIds = patch.siteIds.map((sid) => new Types.ObjectId(sid));
    updateData.siteIds = siteIds;
    const sites = await Site.find({ _id: { $in: siteIds } }).lean();
    updateData.siteNames = sites.map((s) => s.name);
  }
  delete (updateData as Record<string, unknown>).client;

  const project = await Project.findByIdAndUpdate(id, updateData, { new: true });
  if (!project) throw new AppError(404, "Project not found");

  if (patch.clientId) {
    await Client.findByIdAndUpdate(patch.clientId, { $addToSet: { projectIds: project.projectId } });
  }

  return project.toObject();
}

export async function deleteProject(id: string, scopeProjectIds?: ProjectScopeIds) {
  await getProjectById(id, scopeProjectIds);
  const project = await Project.findById(id);
  if (!project) throw new AppError(404, "Project not found");

  await Client.findByIdAndUpdate(project.clientId, {
    $pull: { projectIds: project.projectId },
  });

  if (project.siteIds.length > 0) {
    await Site.updateMany(
      { _id: { $in: project.siteIds } },
      { $pull: { projectIds: project._id } }
    );
  }

  await Project.deleteOne({ _id: id });
}

export async function getProjectLedger(id: string, scopeProjectIds?: ProjectScopeIds) {
  const project = await getProjectById(id, scopeProjectIds);
  await recomputeClientTotals(project.clientId);
  return computeProjectLedger(project);
}

export async function getProjectsSummary(scopeProjectIds?: ProjectScopeIds) {
  const projectQuery: Record<string, unknown> = {};
  applyProjectScope(projectQuery, "_id", scopeProjectIds);
  const [active, onHold, completed, financials] = await Promise.all([
    Project.countDocuments({ ...projectQuery, status: "Active" }),
    Project.countDocuments({ ...projectQuery, status: "On Hold" }),
    Project.countDocuments({ ...projectQuery, status: "Completed" }),
    Project.aggregate([
      { $match: projectQuery },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$totalValue" },
          receivedAmount: { $sum: "$receivedAmount" },
          pendingBalance: { $sum: "$pendingBalance" },
          materialSpend: { $sum: "$materialSpend" },
          labourPayable: { $sum: "$labourPayable" },
        },
      },
    ]),
  ]);

  return {
    counts: { active, onHold, completed, total: active + onHold + completed },
    financials: financials[0] || {
      totalValue: 0,
      receivedAmount: 0,
      pendingBalance: 0,
      materialSpend: 0,
      labourPayable: 0,
    },
  };
}
