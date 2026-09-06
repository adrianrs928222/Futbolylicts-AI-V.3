import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/cache/supabase";

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
  staleUntil: number;
}

export type CacheSource = "memory" | "supabase" | "stale-memory" | "stale-supabase" | "miss";

export interface CacheRead<T> {
  value: T | null;
  source: CacheSource;
}

const memory = new Map<string, MemoryEntry>();
const counters = {
  memoryHits: 0,
  supabaseHits: 0,
  staleHits: 0,
  misses: 0,
  writes: 0,
};

export function cacheKey(namespace: string, params: Record<string, unknown>) {
  const stable = JSON.stringify(
    Object.keys(params)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {}),
  );
  return crypto.createHash("sha256").update(`${namespace}:${stable}`).digest("hex");
}

export async function readCached<T>(key: string, allowStale = false): Promise<CacheRead<T>> {
  const now = Date.now();
  const mem = memory.get(key);

  if (mem && mem.expiresAt > now) {
    counters.memoryHits += 1;
    return { value: mem.value as T, source: "memory" };
  }
  if (mem && allowStale && mem.staleUntil > now) {
    counters.staleHits += 1;
    return { value: mem.value as T, source: "stale-memory" };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    counters.misses += 1;
    return { value: null, source: "miss" };
  }

  const { data, error } = await supabase
    .from("api_cache")
    .select("data, expires_at, stale_until")
    .eq("cache_key", key)
    .maybeSingle();

  if (error || !data) {
    counters.misses += 1;
    return { value: null, source: "miss" };
  }

  const expiresAt = new Date(data.expires_at).getTime();
  const staleUntil = new Date(data.stale_until).getTime();

  if (expiresAt > now) {
    memory.set(key, { value: data.data, expiresAt, staleUntil });
    counters.supabaseHits += 1;
    return { value: data.data as T, source: "supabase" };
  }

  if (allowStale && staleUntil > now) {
    memory.set(key, { value: data.data, expiresAt, staleUntil });
    counters.staleHits += 1;
    return { value: data.data as T, source: "stale-supabase" };
  }

  counters.misses += 1;
  return { value: null, source: "miss" };
}

export async function getCached<T>(key: string, allowStale = false): Promise<T | null> {
  return (await readCached<T>(key, allowStale)).value;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  staleSeconds: number,
): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const staleUntil = expiresAt + staleSeconds * 1000;
  memory.set(key, { value, expiresAt, staleUntil });
  counters.writes += 1;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("api_cache").upsert({
    cache_key: key,
    data: value,
    expires_at: new Date(expiresAt).toISOString(),
    stale_until: new Date(staleUntil).toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export function getMemoryCacheStats() {
  const hits = counters.memoryHits + counters.supabaseHits + counters.staleHits;
  const totalReads = hits + counters.misses;
  return {
    ...counters,
    entries: memory.size,
    hitRate: totalReads > 0 ? hits / totalReads : 0,
  };
}

export function clearMemoryCache() {
  memory.clear();
}
