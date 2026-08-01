/**
 * In-process semaphore to serialize MongoDB queries.
 *
 * Why this exists:
 * - Atlas M0 free tier is a shared cluster with very limited CPU/RAM.
 *   When several queries hit it simultaneously, every query slows down
 *   because they all share the same CPU/RAM/connection budget.
 * - With maxPoolSize: 10, the driver can check out 10 connections at
 *   once. But M0 can only execute 1-2 queries efficiently. More than
 *   that causes each query to take 30-300s instead of 1-3s.
 * - Limiting concurrency to 2 lets materials + inventory/expenses run
 *   concurrently (one page each) without saturating the cluster.
 *
 * Queue timeout: if a request waits longer than QUEUE_TIMEOUT_MS for a
 * semaphore slot, it rejects immediately instead of blocking forever.
 * This prevents the frontend from queuing up dozens of requests that
 * all time out.
 */
const CONCURRENCY = 2;
const QUEUE_TIMEOUT_MS = 20_000;

class Semaphore {
  private available = CONCURRENCY;
  private waiting: Array<{ fn: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> }> = [];

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.available > 0) {
      this.available--;
      try {
        return await fn();
      } finally {
        this.release();
      }
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove from waiting queue
        const idx = this.waiting.findIndex((w) => w.resolve === resolve);
        if (idx !== -1) this.waiting.splice(idx, 1);
        reject(new Error(`[dbMutex] Queue timeout after ${QUEUE_TIMEOUT_MS}ms — too many concurrent DB operations`));
      }, QUEUE_TIMEOUT_MS);
      this.waiting.push({ fn: fn as () => Promise<any>, resolve: resolve as (v: any) => void, reject, timer });
    });
  }

  private release(): void {
    this.available++;
    const next = this.waiting.shift();
    if (next) {
      clearTimeout(next.timer);
      this.available--;
      next.fn()
        .then(next.resolve)
        .catch(next.reject)
        .finally(() => this.release());
    }
  }
}

export const dbMutex = new Semaphore();
