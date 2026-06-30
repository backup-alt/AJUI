import { Client } from "../models/Client.js";
import { Project } from "../models/Project.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateId } from "./id-generator.service.js";
import { CreateClientInput, UpdateClientInput } from "../schemas/entities.schema.js";
import { recomputeClientTotals } from "./financial.service.js";

export async function createClient(input: CreateClientInput) {
  const clientId = await generateId("CLI");
  const client = await Client.create({ ...input, clientId, projectIds: [] });
  return client.toObject();
}

export async function listClients(filter: {
  search?: string;
  status?: string;
  page: number;
  limit: number;
  scopeQuery?: Record<string, unknown>;
}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: "i" } },
      { mobile: { $regex: filter.search, $options: "i" } },
      { clientId: { $regex: filter.search, $options: "i" } },
    ];
  }

  if (filter.scopeQuery && Object.keys(filter.scopeQuery).length > 0) {
    Object.assign(query, filter.scopeQuery);
  }

  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Client.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    Client.countDocuments(query),
  ]);

  return {
    items,
    total,
    page: filter.page,
    limit: filter.limit,
    pages: Math.ceil(total / filter.limit),
  };
}

export async function getClientById(id: string) {
  const client = await Client.findById(id).lean();
  if (!client) throw new AppError(404, "Client not found");
  return client;
}

export async function updateClient(id: string, patch: UpdateClientInput) {
  const client = await Client.findByIdAndUpdate(id, patch, { new: true });
  if (!client) throw new AppError(404, "Client not found");
  return client.toObject();
}

export async function deleteClient(id: string) {
  const projects = await Project.find({ clientId: id });
  if (projects.length > 0) {
    throw new AppError(409, `Cannot delete client with ${projects.length} active project(s)`);
  }
  const result = await Client.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Client not found");
}

export async function getClientSummary(id: string) {
  const client = await getClientById(id);
  await recomputeClientTotals(client._id);
  const updated = await getClientById(id);
  const projects = await Project.find({ clientId: id }).select("_id name status totalValue receivedAmount");
  return {
    client: updated,
    projectCount: projects.length,
    projects,
  };
}
