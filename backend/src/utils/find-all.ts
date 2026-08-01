import type { Model } from "mongoose";

/**
 * Generic cursor-walk fallback for "give me everything" hydration
 * endpoints. Used when the single-shot `find().lean().limit(N)` query
 * times out (which happens on M0 free tier during cold start or pool
 * exhaustion).
 *
 * Pages of 25 rows with 200ms between pages, 3 retry attempts per page,
 * hard cap on total returned. Never throws — returns whatever it could
 * fetch, including an empty array if every page failed.
 *
 * Mutates the passed `query` object across pages to advance the cursor
 * (the Mongoose query is rebuilt with the new _id clause on each call).
 */
export async function walkAllByCursor<T>(
  label: string,
  query: Record<string, unknown>,
  hardCap: number,
  pageFn: (q: Record<string, unknown>, limit: number) => Promise<T[]>
): Promise<T[]> {
  const PAGE_SIZE = 25;
  const PAGE_DELAY_MS = 500;
  const MAX_PAGE_ATTEMPTS = 3;
  const out: T[] = [];
  let cursor: string | undefined = undefined;
  let failedAttempts = 0;

  while (out.length < hardCap) {
    if (cursor) {
      try {
        // Sort is {_id: -1} (descending), cursor is the SMALLEST _id
        // in the page. Next page needs _id < cursor → $lt.
        query._id = { $lt: toObjectId(cursor) };
      } catch {
        break;
      }
    }

    let pageItems: T[] | null = null;
    for (let attempt = 1; attempt <= MAX_PAGE_ATTEMPTS; attempt++) {
      try {
        pageItems = await pageFn(query, PAGE_SIZE);
        break;
      } catch (err) {
        failedAttempts++;
        console.warn(`[${label}/cursor] page attempt ${attempt} failed: ${(err as Error).message}`);
        if (attempt < MAX_PAGE_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 300 * attempt));
        }
      }
    }

    if (!pageItems || pageItems.length === 0) break;
    out.push(...pageItems);
    if (pageItems.length < PAGE_SIZE) break;

    const last = pageItems[pageItems.length - 1] as unknown as { _id?: unknown };
    if (!last?._id) break;
    cursor = String(last._id);

    await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
  }

  console.log(
    `[${label}/cursor] fallback walk returned ${out.length} items after ${failedAttempts} failed attempts`
  );
  return out;
}

/**
 * Wrap a "find N rows of collection" call in try/catch with cursor-walk
 * fallback. Returns an array of plain objects (lean). Never throws.
 *
 * @param model      Mongoose model to query
 * @param label      Short label for log messages (e.g. "materials/all")
 * @param query      Base MongoDB query object (will be mutated for cursor)
 * @param hardCap    Maximum total rows to return
 * @param singleShotMs   maxTimeMS for the single-shot query (default 15s)
 */
export async function findAllOrFallback<T extends Record<string, unknown>>(
  model: Model<any>,
  label: string,
  query: Record<string, unknown>,
  hardCap = 500,
  singleShotMs = 60_000
): Promise<T[]> {
  const cap = Math.min(Math.max(hardCap, 1), 1000);

  try {
    // Exclude receiptImage from the single-shot query — it's base64-encoded
    // and can be 100KB-2MB per record, causing the query to balloon to
    // multiple MB and timeout on M0. The cursor-walk fallback also excludes
    // it for the same reason.
    const items = await model
      .find(query)
      .select({ receiptImage: 0 })
      .sort({ _id: -1 })
      .limit(cap)
      .lean()
      .maxTimeMS(singleShotMs);
    if (Array.isArray(items) && items.length > 0) return items as T[];
  } catch (err) {
    console.warn(
      `[${label}] single-shot query failed, falling back to cursor walk: ${(err as Error).message}`
    );
  }

  return walkAllByCursor<T>(
    label,
    query,
    cap,
    async (q, limit) => {
      const items = await model
        .find(q)
        .select({ receiptImage: 0 })
        .sort({ _id: -1 })
        .limit(limit)
        .lean()
        .maxTimeMS(30_000);
      return items as unknown as T[];
    }
  );
}

function toObjectId(id: string): unknown {
  // Lazy import to avoid a hard dependency cycle at module load
  const { Types } = require("mongoose") as typeof import("mongoose");
  return new Types.ObjectId(id);
}
