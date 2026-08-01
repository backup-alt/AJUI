import { Types, type Model, type FilterQuery } from "mongoose";

/**
 * Cursor-based pagination helper for Mongoose queries.
 *
 * Replaces the slow O(skip) `skip().limit()` pattern that times out on
 * Atlas M0 free tier once a collection grows past a few hundred rows.
 *
 * Contract:
 * - Sort is fixed to `{ _id: -1 }` (descending) — newest first.
 * - Page size is `limit` (no lookahead, no +1, no slicing).
 * - When the page is full (items.length === limit), a `nextCursor` is
 *   emitted containing the LAST item's _id. The next page must pass
 *   this back as the `cursor` parameter.
 * - When the page is short, `nextCursor` is null → the walk is done.
 *
 * The caller is expected to apply `cursor` to the query as
 * `{ _id: { $lt: <ObjectId from cursor> } }`. This helper does NOT
 * mutate the query — it only emits the next cursor.
 *
 * Returns `{ items, total, nextCursor, pages, page, limit }`. The
 * `total` is only computed on the first page (no cursor) — for cursor
 * pages, total is estimated as `page * limit` to keep the count query
 * off the hot path.
 */
export interface CursorPaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface CursorPaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  nextCursor: string | null;
}

/**
 * Apply the cursor to a query object. Safe to call with `undefined` or
 * invalid cursor strings — the cursor is simply ignored in that case.
 *
 * Mutates the passed query object.
 */
export function applyCursor(
  query: Record<string, unknown>,
  cursor: string | undefined
): void {
  if (!cursor) return;
  try {
    query._id = { $lt: new Types.ObjectId(cursor) };
  } catch {
    // Invalid cursor string — ignore and start from the beginning
  }
}

/**
 * Run a single cursor-paginated query against a Mongoose model. Returns
 * the page of documents plus the next cursor.
 *
 * @param model      Mongoose model to query
 * @param query      Base MongoDB filter (will be mutated with the _id
 *                   cursor clause if `opts.cursor` is provided)
 * @param opts       Pagination options
 * @param select     Optional Mongoose projection (e.g. `{ receiptImage: 0 }`)
 * @param maxTimeMS  Per-query timeout. Defaults to 60s.
 */
export async function paginateByCursor<T>(
  model: Model<any>,
  query: Record<string, unknown>,
  opts: CursorPaginationOptions,
  select: Record<string, 0 | 1> | null = null,
  maxTimeMS = 60_000
): Promise<CursorPaginationResult<T>> {
  const page = Math.max(Number(opts.page) || 1, 1);
  const limit = Math.min(Math.max(Number(opts.limit) || 25, 1), 100);

  applyCursor(query, opts.cursor);

  const findQuery = model.find(query as FilterQuery<any>).sort({ _id: -1 }).limit(limit).lean().maxTimeMS(maxTimeMS);
  const findExec = select ? findQuery.select(select) : findQuery;
  const items = (await findExec) as unknown as T[];

  let total = 0;
  if (!opts.cursor) {
    try {
      total = await model.countDocuments(query as FilterQuery<any>).maxTimeMS(30_000);
    } catch {
      total = items.length;
    }
  } else {
    total = page * limit; // estimate for cursor pages
  }

  let nextCursor: string | null = null;
  if (items.length === limit) {
    const lastItem = items[items.length - 1] as unknown as { _id?: unknown };
    if (lastItem && lastItem._id) {
      nextCursor = String(lastItem._id);
    }
  }

  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    nextCursor,
  };
}
