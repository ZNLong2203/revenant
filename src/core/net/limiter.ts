/**
 * Per-host concurrency limits, so a scan of 200 citations never hammers one
 * server (the Internet Archive asks for politeness; so do small sites).
 */

type Release = () => void;

class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;
  constructor(private readonly max: number) {}

  async acquire(): Promise<Release> {
    if (this.active >= this.max) await new Promise<void>((r) => this.queue.push(r));
    this.active++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.queue.shift()?.();
    };
  }
}

const LIMITS: Record<string, number> = {
  "web.archive.org": 3,
  "rdap.org": 4,
};
const DEFAULT_LIMIT = 2;

const semaphores = new Map<string, Semaphore>();

export async function withHostLimit<T>(host: string, fn: () => Promise<T>): Promise<T> {
  let s = semaphores.get(host);
  if (!s) {
    s = new Semaphore(LIMITS[host] ?? DEFAULT_LIMIT);
    semaphores.set(host, s);
  }
  const release = await s.acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

/** Run `fn` over `items` with at most `n` in flight; results keep input order. */
export async function mapPool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
