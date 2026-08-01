import { Request, Response, NextFunction } from "express";

/**
 * In-process semaphore to limit concurrent HTTP request handlers.
 *
 * Why this exists:
 * - The frontend (workspace-hydration + dashboard) fires 11+ GET endpoints
 *   simultaneously on every page load.
 * - Each GET endpoint hits MongoDB via dbMutex (max 2 concurrent DB ops).
 *   But the remaining 9+ requests sit in the dbMutex queue, each holding
 *   an HTTP connection and a Mongoose connection-pool slot open.
 * - On Atlas M0 free tier, even 2 concurrent MongoDB queries cause each
 *   to slow from 1-3s to 10-30s. With 11+ queued requests, the last one
 *   waits 5+ minutes.
 *
 * This middleware limits the number of request HANDLERS that can execute
 * concurrently. Excess requests are held in a queue with a timeout. If
 * the queue is full or the timeout expires, the request is rejected
 * immediately with 503 instead of blocking forever.
 *
 * Tuning:
 * - MAX_CONCURRENT: must be >= dbMutex concurrency (2) so that the
 *   dbMutex can always fill its slots. Setting it to 4 gives headroom
 *   for non-DB requests (health checks, static assets).
 * - QUEUE_TIMEOUT_MS: 15s is enough for the frontend's hydration chain
 *   (3 pages × 500ms delay = 1.5s between pages). If a request waits
 *   longer than this, the M0 cluster is too overloaded to be useful.
 */
const MAX_CONCURRENT = 4;
const QUEUE_TIMEOUT_MS = 15_000;

class HttpSemaphore {
  private available = MAX_CONCURRENT;
  private waiting: Array<{
    resolve: () => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiting.findIndex((w) => w.resolve === resolve);
        if (idx !== -1) this.waiting.splice(idx, 1);
        reject(new Error("Queue full — try again"));
      }, QUEUE_TIMEOUT_MS);
      this.waiting.push({ resolve, timer });
    });
  }

  release(): void {
    this.available++;
    const next = this.waiting.shift();
    if (next) {
      clearTimeout(next.timer);
      this.available--;
      next.resolve();
    }
  }
}

const httpSemaphore = new HttpSemaphore();

/**
 * Express middleware that throttles concurrent request handlers.
 *
 * Excess requests wait in a queue. If the queue is full or the wait
 * exceeds QUEUE_TIMEOUT_MS, the request is rejected with 503 immediately
 * instead of consuming resources forever.
 */
export function throttle(req: Request, res: Response, next: NextFunction): void {
  // Skip throttle for health checks, static assets, and non-GET requests
  if (req.method !== "GET" || req.path === "/health" || req.path === "/keepalive") {
    next();
    return;
  }

  httpSemaphore.acquire()
    .then(() => {
      // Release the semaphore slot when the response finishes
      const finish = () => {
        httpSemaphore.release();
        cleanup();
      };
      const cleanup = () => {
        res.removeListener("finish", finish);
        res.removeListener("close", finish);
        res.removeListener("error", finish);
      };
      res.addListener("finish", finish);
      res.addListener("close", finish);
      res.addListener("error", finish);
      next();
    })
    .catch(() => {
      // Queue full — reject immediately
      res.status(503).json({
        error: "Server busy, please retry",
        retryAfter: 2,
      });
    });
}
