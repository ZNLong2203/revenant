/**
 * Fixed-window rate limit per client IP, so the public demo can't be turned
 * into a crawler. Memory per instance; good enough for a demo, and the
 * shared cache means repeated scans are cheap anyway.
 */
const windows = new Map<string, { start: number; count: number }>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

export function rateLimit(req: Request, bucket: string, limit: number, windowMs = 3_600_000): { ok: true } | { ok: false; retryAfter: number } {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 20_000) windows.delete(windows.keys().next().value!);
    return { ok: true };
  }
  if (w.count >= limit) return { ok: false, retryAfter: Math.ceil((w.start + windowMs - now) / 1000) };
  w.count++;
  return { ok: true };
}

export function tooMany(retryAfter: number): Response {
  return Response.json(
    { error: "The crypt is crowded. Try again shortly, or run Revenant yourself (npx tsx bin/revenant.ts)." },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}
