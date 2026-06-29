import { Types } from "mongoose";
import { CustomField, CustomFieldEntityType } from "../models/CustomField";
import { AppError } from "../middleware/errorHandler";
import { CreateCustomFieldInput, UpdateCustomFieldInput } from "../schemas/entities.schema";

export async function createCustomField(input: CreateCustomFieldInput) {
  const entityId = new Types.ObjectId(input.entityId);
  const existing = await CustomField.findOne({ entityType: input.entityType, entityId, key: input.key });
  if (existing) {
    existing.value = input.value ?? null;
    existing.label = input.label;
    existing.fieldType = input.fieldType;
    existing.order = input.order;
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
  });
  return field.toObject();
}

export async function listCustomFields(entityType: CustomFieldEntityType, entityId: string) {
  const fields = await CustomField.find({
    entityType,
    entityId: new Types.ObjectId(entityId),
  })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return fields.map((f) => ({
    id: f._id.toString(),
    key: f.key,
    label: f.label,
    value: f.value,
    fieldType: f.fieldType,
    order: f.order,
  }));
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
