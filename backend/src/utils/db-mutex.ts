/**
 * In-process semaphore to serialize MongoDB queries.
 *
 * Why this exists:
 * - Atlas M0 free tier is a shared cluster. When several queries hit it
 *   simultaneously, every query slows down because they all share the
 *   same CPU/RAM/connection budget.
 * - With maxPoolSize: 5, the driver can only check out 5 connections at
 *   once. The 6th+ request waits waitQueueTimeoutMS then fails.
 * - Limiting concurrency to 3 lets cursor-paginated fetches across
 *   materials/inventory/expenses run in parallel (one page each) without
 *   saturating the cluster.
 *
 * Trade-off:
 * - 3 concurrent DB ops is enough headroom for the hydration chain
 *   (materials cursor walk, inventory cursor walk, expenses cursor walk
 *   each running their pages concurrently). It keeps M0 happy while
 *   not serializing the dashboard into oblivion.
 */
class Semaphore {
  private available = 3;
  private waiting: Array<() => void> = [];

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
      this.waiting.push(() => {
        this.available--;
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => this.release());
      });
    });
  }

  private release(): void {
    this.available++;
    const next = this.waiting.shift();
    if (next) {
      this.available--;
      next();
    }
  }
}

export const dbMutex = new Semaphore();
