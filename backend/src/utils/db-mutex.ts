/**
 * In-process semaphore to serialize MongoDB queries.
 *
 * Why this exists:
 * - Atlas M0 free tier is a shared cluster. When several queries hit it
 *   simultaneously, every query slows down because they all share the
 *   same CPU/RAM/connection budget.
 * - With maxPoolSize: 3, the driver can only check out 3 connections at
 *   once. The 4th+ request waits waitQueueTimeoutMS (3s) then fails with
 *   WaitQueueTimeoutError.
 * - Sequentializing queries (1 at a time) makes each query faster on
 *   average because it doesn't compete for cluster resources.
 *
 * Trade-off:
 * - Throughput drops (no parallel queries), but per-query latency stays
 *   predictable and bounded. For a dashboard that issues a handful of
 *   queries per page load, this is the right trade-off.
 */
class Semaphore {
  private available = 1;
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
