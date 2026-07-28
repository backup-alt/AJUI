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
 */

interface CacheEntry {
  body: string;
  contentType: string;
  status: number;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

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
      res.status(cached.status).type(cached.contentType).send(cached.body);
      return;
    }

    res.setHeader("X-Cache", "MISS");
    const originalSend = res.send.bind(res);
    res.send = function (body?: unknown): Response {
      const contentType = res.getHeader("Content-Type") || "application/json; charset=utf-8";
      const status = res.statusCode || 200;
      if (status >= 200 && status < 300 && body) {
        const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
        setCached(key, {
          body: bodyStr,
          contentType: String(contentType),
          status,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
      }
      return originalSend(body);
    };
    next();
  };
}