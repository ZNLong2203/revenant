/**
 * Small cache with a TTL. In-memory by default; uses Upstash Redis when
 * UPSTASH_REDIS_REST_URL/TOKEN (or Vercel KV's KV_REST_API_URL/TOKEN) are set,
 * so serverless instances share archive and RDAP lookups.
 */
import { Redis } from "@upstash/redis";

interface Entry {
  value: unknown;
  expires: number;
}

const MAX_ENTRIES = 5000;
const memory = new Map<string, Entry>();

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

let redisDownUntil = 0;

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  if (hit) memory.delete(key);
  const r = getRedis();
  if (!r || Date.now() < redisDownUntil) return undefined;
  try {
    const v = await Promise.race([
      r.get<T>(`rv:${key}`),
      new Promise<undefined>((_, rej) => setTimeout(() => rej(new Error("redis timeout")), 1500)),
    ]);
    return v ?? undefined;
  } catch {
    redisDownUntil = Date.now() + 30_000;
    return undefined;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (memory.size >= MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  const r = getRedis();
  if (!r || Date.now() < redisDownUntil) return;
  try {
    await r.set(`rv:${key}`, value, { ex: ttlSeconds });
  } catch {
    redisDownUntil = Date.now() + 30_000;
  }
}

/** Memoise an async lookup under `key`. */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

export function cacheBackend(): "redis" | "memory" {
  return getRedis() ? "redis" : "memory";
}
