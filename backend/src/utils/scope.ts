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

/**
 * Resolve a `projectId` query-string value to a Mongo ObjectId.
 *
 * The frontend may pass either:
 *  - a 24-hex-char Mongo `_id`  (e.g. `"665abc…"`)
 *  - a human-readable `projectId` (e.g. `"AB-1024"`)
 *
 * When the value is already a valid ObjectId whose string round-trips, we
 * return it directly. Otherwise we look up `Project.projectId` and return
 * the matching document's `_id`. If no document matches, we return a
 * freshly-minted ObjectId that will never collide with real data so the
 * caller's query safely returns zero rows instead of throwing.
 */
export async function resolveProjectObjectId(
  raw: string,
): Promise<Types.ObjectId> {
  // Fast path – value IS a 24-hex Mongo ObjectId
  if (
    Types.ObjectId.isValid(raw) &&
    String(new Types.ObjectId(raw)) === raw
  ) {
    return new Types.ObjectId(raw);
  }

  // Slow path – look up the human-readable projectId
  const { Project } = await import("../models/Project.js");
  const project = await Project.findOne({ projectId: raw })
    .select("_id")
    .lean();
  if (project) return project._id;

  // No match → return a dummy ObjectId so the query returns [] instead of
  // crashing on an invalid cast.
  return new Types.ObjectId();
}
