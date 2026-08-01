import { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory response cache for read-only GET endpoints.
 *
 * On M0 free tier, even indexed queries can take 1-3 seconds. Caching
 * frequently-accessed static data (sites, clients, projects, company profile)
 * for a short TTL dramatically reduces perceived load time without
 * requiring a Redis instance.
 *
 * Usage:
 *   router.get('/sites', cache(30), handler); // 30 second TTL
 *   router.get('/projects', cache(15), handler); // 15 second TTL
 *
 * Cache is invalidated on any non-GET request to the same path prefix
 * (POST/PATCH/DELETE writes bust the cache).
 *
 * IMPORTANT: All cached responses include Cache-Control: no-store so the
 * BROWSER doesn't cache them independently. Without this, newly created
 * records wouldn't appear in lists until the user did a hard refresh.
 */

interface CacheEntry {
  body: string;
  contentType: string;
  status: number;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

// In-flight request coalescing — when two identical requests arrive
// simultaneously, the second waits for the first's result instead of
// hammering M0 independently. This prevents connection pool exhaustion
// from duplicate hydration/dashboard requests.
const inFlight = new Map<string, Promise<CacheEntry | null>>();

// Per-user cache key prefix — different users see different data
function makeKey(req: Request): string {
  const auth = req.headers.authorization || "";
  const userHash = auth.length > 20 ? auth.slice(-20) : "anon";
  return `${req.method}:${req.originalUrl}:${userHash}`;
}

function getCached(key: string): CacheEntry | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

function setCached(key: string, entry: CacheEntry): void {
  store.set(key, entry);
  // Prevent unbounded growth — evict oldest if over limit
  if (store.size > 500) {
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }
}

export function invalidateCachePrefix(pathPrefix: string): void {
  for (const key of store.keys()) {
    if (key.includes(pathPrefix)) store.delete(key);
  }
}

export function invalidateAllCache(): void {
  store.clear();
}

/**
 * Force-clear all cached entries on server startup. This prevents stale
 * data from being served after a deploy if the in-memory state somehow
 * persists (it shouldn't, but just in case).
 */
if (process.env.NODE_ENV !== "test") {
  store.clear();
  console.log("[Cache] In-memory response cache initialized (empty)");
}

export function cache(ttlSeconds: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== "GET") {
      next();
      return;
    }

    const key = makeKey(req);
    const cached = getCached(key);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-TTL", String(Math.round((cached.expiresAt - Date.now()) / 1000)));
      // Prevent browser from caching — forces fresh data on next request
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.status(cached.status).type(cached.contentType).send(cached.body);
      return;
    }

    // Request coalescing: if an identical request is already in-flight,
    // piggyback on it instead of firing a duplicate DB query.
    const pending = inFlight.get(key);
    if (pending) {
      res.setHeader("X-Cache", "COALESCED");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      pending.then((entry) => {
        if (entry && !res.writableEnded) {
          res.setHeader("X-Cache-TTL", String(Math.round((entry.expiresAt - Date.now()) / 1000)));
          res.status(entry.status).type(entry.contentType).send(entry.body);
        } else if (!res.writableEnded) {
          res.status(200).json({ items: [] });
        }
      }).catch(() => {
        if (!res.writableEnded) res.status(200).json({ items: [] });
      });
      return;
    }

    res.setHeader("X-Cache", "MISS");
    // Prevent browser from caching — forces fresh data on next request
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Track whether we've already sent a response so we don't double-send
    // on error paths (which triggered ERR_HTTP_HEADERS_SENT in production).
    // express.final is set internally and is the most reliable signal.
    const alreadySent = () => (res as any).headersSent || res.writableEnded;

    let resolveInFlight: (val: CacheEntry | null) => void;
    const inFlightPromise = new Promise<CacheEntry | null>((resolve) => {
      resolveInFlight = resolve;
    });
    inFlight.set(key, inFlightPromise);

    const originalSend = res.send.bind(res);
    res.send = function (body?: unknown): Response {
      if (alreadySent()) {
        // Already responded — swallow this call to avoid ERR_HTTP_HEADERS_SENT
        return res;
      }
      const contentType = res.getHeader("Content-Type") || "application/json; charset=utf-8";
      const status = res.statusCode || 200;
      // Don't cache empty-array responses — they can be transient
      // (M0 timeout falling back to [] via the controller catch block)
      // and would poison subsequent requests for the full TTL.
      // Also don't cache non-2xx responses (errors should not be cached).
      const isEmptyArrayBody =
        typeof body === "string" && /"items":\s*\[\s*\]/.test(body);
      let cacheEntry: CacheEntry | null = null;
      if (status >= 200 && status < 300 && body && !isEmptyArrayBody) {
        const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
        cacheEntry = {
          body: bodyStr,
          contentType: String(contentType),
          status,
          expiresAt: Date.now() + ttlSeconds * 1000,
        };
        setCached(key, cacheEntry);
      }
      inFlight.delete(key);
      resolveInFlight!(cacheEntry);
      return originalSend(body);
    };
    next();
  };
}