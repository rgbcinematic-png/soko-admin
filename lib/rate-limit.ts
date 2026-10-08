/**
 * Minimal in-process rate limiter.
 *
 * Good enough for a single long-running server and for slowing down casual
 * credential stuffing. It does NOT survive a restart and is NOT shared across
 * serverless instances — if this site ever sees real attack traffic, swap the
 * map for Upstash Redis or Vercel KV. The call sites do not need to change.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

// Keep the map from growing without bound in a long-lived process.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}, 60_000).unref?.();
