import { Types } from "mongoose";
import { CustomField, CustomFieldEntityType } from "../models/CustomField.js";
import { AppError } from "../middleware/errorHandler.js";
import { CreateCustomFieldInput, UpdateCustomFieldInput } from "../schemas/entities.schema.js";

/**
 * Bulk variant of `listCustomFields` — accepts an array of entity IDs so the
 * client can collapse the (entityType × N_sites) call storm into a single
 * HTTP roundtrip. The response is grouped by entityId for cheap merging on
 * the frontend.
 */
export async function listCustomFieldsBulk(
  entityType: CustomFieldEntityType,
  entityIds: string[],
  includeSupervisorOnly = false
) {
  if (!Array.isArray(entityIds) || entityIds.length === 0) {
    return {} as Record<string, Array<ReturnType<typeof toDto>>>;
  }

  const validIds: Types.ObjectId[] = [];
  const idMap = new Map<string, string>();
  for (const raw of entityIds) {
    const str = String(raw || "").trim();
    if (!str || !Types.ObjectId.isValid(str)) continue;
    const oid = new Types.ObjectId(str);
    validIds.push(oid);
    idMap.set(str, str);
  }
  if (validIds.length === 0) {
    return {} as Record<string, Array<ReturnType<typeof toDto>>>;
  }

  const query: Record<string, unknown> = {
    entityType,
    entityId: { $in: validIds },
  };
  if (includeSupervisorOnly) {
    query.askSupervisor = true;
  }

  const fields = await CustomField.find(query).sort({ order: 1, createdAt: 1 }).lean();

  const grouped: Record<string, Array<ReturnType<typeof toDto>>> = {};
  for (const id of idMap.values()) grouped[id] = [];
  for (const f of fields) {
    const key = String(f.entityId);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(toDto(f));
  }
  return grouped;
}

function toDto(f: any) {
  return {
    id: f._id.toString(),
    key: f.key,
    label: f.label,
    value: f.value,
    fieldType: f.fieldType,
    order: f.order,
    askSupervisor: f.askSupervisor,
  };
}

export async function createCustomField(input: CreateCustomFieldInput) {
  const entityId = new Types.ObjectId(input.entityId);
  const existing = await CustomField.findOne({ entityType: input.entityType, entityId, key: input.key });
  if (existing) {
    existing.value = input.value ?? null;
    existing.label = input.label;
    existing.fieldType = input.fieldType;
    existing.order = input.order;
    existing.askSupervisor = input.askSupervisor ?? false;
    await existing.save();
    return existing.toObject();
  }

  const field = await CustomField.create({
    entityType: input.entityType,
    entityId,
    key: input.key,
    label: input.label,
    value: input.value ?? null,
    fieldType: input.fieldType,
    order: input.order,
    askSupervisor: input.askSupervisor ?? false,
  });
  return field.toObject();
}

export async function listCustomFields(entityType: CustomFieldEntityType, entityId: string, includeSupervisorOnly = false) {
  const query: Record<string, unknown> = {
    entityType,
    entityId: new Types.ObjectId(entityId),
  };
  if (includeSupervisorOnly) {
    query.askSupervisor = true;
  }
  const fields = await CustomField.find(query)
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return fields.map(toDto);
}

export async function updateCustomField(id: string, patch: UpdateCustomFieldInput) {
  const field = await CustomField.findByIdAndUpdate(id, patch, { new: true });
  if (!field) throw new AppError(404, "Custom field not found");
  return field.toObject();
}

export async function deleteCustomField(id: string) {
  const result = await CustomField.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new AppError(404, "Custom field not found");
}
