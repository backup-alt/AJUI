/**
 * Retry a MongoDB query with exponential backoff. Useful when M0 connection
 * pools get cleared because of a transient timeout — the retry hits a
 * re-established pool and usually succeeds.
 *
 * Defaults to 2 attempts (was 3) because:
 *  - On M0, each timeout waits maxTimeMS (8s) before failing.
 *  - With 3 attempts: 8s + 0.25s backoff + 8s + 0.5s backoff + 8s = ~25s.
 *  - That exceeds the client timeout (25s) and trips the frontend retry loop,
 *    which fires ANOTHER parallel request, which saturates the pool further.
 *  - 2 attempts: 8s + 0.25s backoff + 8s = ~16.25s, fits under the client
 *    timeout, gives the connection pool time to recover before the next request.
 */
export async function withRetry<T>(
  factory: () => Promise<T>,
  opts: {
    label: string;
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (err: unknown) => boolean;
  }
): Promise<T> {
  const {
    label,
    maxAttempts = 2,
    baseDelayMs = 250,
    maxDelayMs = 2000,
    shouldRetry = isTransientMongoError,
  } = opts;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await factory();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !shouldRetry(err)) {
        throw err;
      }
      const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const jitter = Math.floor(Math.random() * 100);
      const wait = delay + jitter;
      console.warn(`[${label}] attempt ${attempt} failed (${(err as Error).message}); retrying in ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

export function isTransientMongoError(err: unknown): boolean {
  const e = err as { name?: string; code?: string; message?: string } | null;
  if (!e) return false;
  if (e.name === "MongoNetworkTimeoutError") return true;
  if (e.name === "MongoServerSelectionError") return true;
  if (e.name === "MongoPoolClearedError") return true;
  if (e.name === "MongoNotConnectedError") return true;
  if (typeof e.message === "string" && /connection.*timed out|pool.*cleared/i.test(e.message)) {
    return true;
  }
  return false;
}