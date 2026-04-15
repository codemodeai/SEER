// Per-minute sliding window rate limiter
//
// Uses a true sliding window: stores individual request timestamps, evicts
// those older than 60 seconds, and counts what remains. This avoids the
// burst-at-boundary problem of fixed-window counters.
//
// Limits are per-plan (applied to API key prefix) and per-IP (shared ceiling).

const WINDOW_MS = 60_000; // 1 minute

/** Per-plan requests-per-minute limits */
export const PLAN_RPM: Record<string, number> = {
  free: 10,
  starter: 30,
  pro: 60,
  agency: 120,
};

/** Default IP-level ceiling (no plan context) */
const IP_RPM = 60;

/** Sliding window: array of timestamps for each key */
const windows = new Map<string, number[]>();

/** Evict stale keys every 5 minutes to prevent memory leak */
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, timestamps] of windows) {
    // Remove all entries older than the window
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      windows.delete(key);
    } else {
      windows.set(key, fresh);
    }
  }
}, 5 * 60_000).unref?.();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number; // 0 when allowed, otherwise ms until oldest entry expires
}

/**
 * Check and record a request against the sliding window.
 *
 * @param key   - Namespace key, e.g. "ip:1.2.3.4" or "key:sk-seer-abc"
 * @param limit - Max requests per minute for this key (default: IP_RPM)
 */
export function checkRateLimit(key: string, limit: number = IP_RPM): RateLimitResult {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  // Get or create the window
  let timestamps = windows.get(key);
  if (!timestamps) {
    timestamps = [];
    windows.set(key, timestamps);
  }

  // Evict expired timestamps (slide the window)
  // Find first index that's within the window using binary search for efficiency
  let firstValid = 0;
  while (firstValid < timestamps.length && timestamps[firstValid] <= cutoff) {
    firstValid++;
  }
  if (firstValid > 0) {
    timestamps.splice(0, firstValid);
  }

  // Check limit
  if (timestamps.length >= limit) {
    // Oldest timestamp in window determines when a slot opens
    const retryAfterMs = timestamps[0] + WINDOW_MS - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  // Record this request
  timestamps.push(now);
  const remaining = limit - timestamps.length;

  return { allowed: true, remaining, retryAfterMs: 0 };
}

/**
 * Convenience: check both IP-level and key-level limits in one call.
 * Returns the more restrictive result.
 */
export function checkDualRateLimit(
  ip: string,
  apiKeyPrefix: string,
  plan: string = "free"
): RateLimitResult {
  const ipResult = checkRateLimit(`ip:${ip}`, IP_RPM);
  if (!ipResult.allowed) return ipResult;

  if (!apiKeyPrefix) return ipResult;

  const keyLimit = PLAN_RPM[plan] ?? PLAN_RPM.free;
  const keyResult = checkRateLimit(`key:${apiKeyPrefix}`, keyLimit);
  if (!keyResult.allowed) return keyResult;

  // Return the lower remaining count
  return keyResult.remaining < ipResult.remaining ? keyResult : ipResult;
}

/**
 * Plan-aware rate limit check for use inside tool handlers (after auth).
 * The middleware does IP-level + key-prefix checks without knowing the plan.
 * This function applies the correct per-plan RPM limit using the full API key.
 *
 * @returns Error message string if rate limited, null if allowed.
 */
export function checkPlanRateLimit(apiKey: string, plan: string): string | null {
  const limit = PLAN_RPM[plan] ?? PLAN_RPM.free;
  const result = checkRateLimit(`plan:${apiKey}`, limit);
  if (!result.allowed) {
    const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
    return JSON.stringify({
      error: `Rate limit exceeded (${limit} requests/min for ${plan} plan). Retry in ${retryAfterSec}s.`,
      retry_after: retryAfterSec,
    });
  }
  return null;
}

/** Reset a specific key — useful for testing */
export function _resetKey(key: string): void {
  windows.delete(key);
}

/** Reset all windows — useful for testing */
export function _resetAll(): void {
  windows.clear();
}
