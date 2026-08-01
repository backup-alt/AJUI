/**
 * In-process semaphore to serialize MongoDB queries.
 *
 * Why this exists:
 * - Atlas M0 free tier is a shared cluster. When several queries hit it
 *   simultaneously, every query slows down because they all share the
 *   same CPU/RAM/connection budget.
 * - Limiting concurrency to 2 lets materials, inventory, and expenses
 *   each run one page at a time without saturating the cluster.
 *
 * No queue timeout — the frontend already has its own 60s RxJS timeout
 * per page. Adding a backend queue timeout just causes premature 503s
 * that abort the cursor walk.
 */
class Semaphore {
  private available = 2;
  private waiting: Array<() => void> = [];

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const tWait = Date.now();
    if (this.available > 0) {
      this.available--;
      try {
        return await fn();
      } finally {
        this.release();
      }
    }
    const queueDepth = this.waiting.length + 1;
    return new Promise<T>((resolve, reject) => {
      this.waiting.push(() => {
        const waited = Date.now() - tWait;
        if (waited > 500) {
          console.log(`[dbMutex] queued ${waited}ms depth=${queueDepth}`);
        }
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
