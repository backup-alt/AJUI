import { Types } from "mongoose";

export type ProjectScopeIds = Types.ObjectId[] | null;

export function uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  const seen = new Set<string>();
  const unique: Types.ObjectId[] = [];
  for (const id of ids) {
    const value = id.toString();
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(id);
  }
  return unique;
}

export function applyProjectScope(
  query: Record<string, unknown>,
  field: string,
  scopeProjectIds: ProjectScopeIds | undefined
): void {
  if (scopeProjectIds === undefined || scopeProjectIds === null) return;

  const scopedCondition = { $in: scopeProjectIds };
  const existingCondition = query[field];

  if (existingCondition === undefined) {
    query[field] = scopedCondition;
    return;
  }

  delete query[field];
  const existingAnd = Array.isArray(query.$and) ? query.$and : [];
  query.$and = [
    ...existingAnd,
    { [field]: existingCondition },
    { [field]: scopedCondition },
  ];
}

export function isProjectInScope(
  projectId: string | Types.ObjectId | undefined | null,
  scopeProjectIds: ProjectScopeIds | undefined
): boolean {
  if (scopeProjectIds === undefined || scopeProjectIds === null) return true;
  if (!projectId) return false;
  const value = projectId.toString();
  return scopeProjectIds.some((id) => id.toString() === value);
}

export function projectScopeMatch(
  field: string,
  scopeProjectIds: ProjectScopeIds | undefined
): Record<string, unknown> {
  if (scopeProjectIds === undefined || scopeProjectIds === null) return {};
  return { [field]: { $in: scopeProjectIds } };
}
