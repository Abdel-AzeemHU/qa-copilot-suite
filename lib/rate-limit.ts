/**
 * In-memory sliding-window rate limiter.
 * Resets on server restart — acceptable for single-instance deployment.
 */

const store = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until the oldest entry expires
}

/**
 * @param key      Unique key, e.g. `${userId}:${endpoint}`
 * @param limit    Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Get (or create) the timestamps list for this key.
  let timestamps = store.get(key) ?? [];

  // Evict timestamps outside the current window.
  timestamps = timestamps.filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    // The oldest timestamp in the window — the window will slide past it next.
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    store.set(key, timestamps);
    return { allowed: false, retryAfter };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true };
}
