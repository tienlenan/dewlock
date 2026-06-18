/**
 * In-process sliding-window rate limiter — per-IP, server-side only.
 *
 * Algorithm: fixed-window counter reset every `windowMs` milliseconds.
 * Suitable for single-process deployments (Vercel lambda, local dev).
 * For multi-instance deployments, replace with Redis-backed counter.
 *
 * Usage:
 *   const { limited, remaining, resetMs } = checkRateLimit(ip, { max: 30, windowMs: 60_000 });
 *   if (limited) return Response.json({ error: "Too many requests" }, { status: 429 });
 */

export interface RateLimitOptions {
  /** Maximum requests allowed per window. Default: 30. */
  max?: number;
  /** Window duration in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
  /**
   * Logical bucket name. Without it, every endpoint shares ONE per-IP window —
   * and in local dev the IP is the constant "local", so all routes contend for a
   * single counter and the lowest limit trips 429 from unrelated traffic. Pass a
   * distinct scope per route so each endpoint gets its own window.
   */
  scope?: string;
}

export interface RateLimitResult {
  /** True when the key has exceeded the limit for the current window. */
  limited: boolean;
  /** Requests remaining in the current window (0 when limited). */
  remaining: number;
  /** Milliseconds until the current window resets. */
  resetMs: number;
}

interface WindowState {
  count: number;
  windowStart: number;
}

// Module-level store — persists for the lifetime of the process/lambda instance.
const store = new Map<string, WindowState>();

/**
 * Check and increment the request count for `key` (typically the client IP).
 * Mutates the store — call once per request.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {},
): RateLimitResult {
  const max = options.max ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();

  // Per-endpoint isolation: prefix the IP with the logical scope so routes don't
  // share one bucket (critical in dev where every IP resolves to "local").
  const storeKey = options.scope ? `${options.scope}:${key}` : key;

  const existing = store.get(storeKey);
  const windowStart =
    existing && now - existing.windowStart < windowMs ? existing.windowStart : now;

  // Reset count when entering a new window.
  const count = existing && now - existing.windowStart < windowMs ? existing.count : 0;
  const next = count + 1;

  store.set(storeKey, { count: next, windowStart });

  const resetMs = windowMs - (now - windowStart);
  const limited = next > max;
  const remaining = limited ? 0 : max - next;

  return { limited, remaining, resetMs };
}

/**
 * Extract a best-effort client IP from a Next.js request.
 * Checks x-forwarded-for first (Vercel/CDN), falls back to a sentinel.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may be a comma-separated list; leftmost is the client.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  // Fallback: single-instance dev where no proxy header is set.
  return "local";
}

/**
 * Build standard rate-limit response headers for a 429 or regular response.
 */
export function rateLimitHeaders(result: RateLimitResult, max: number): Record<string, string> {
  return {
    "x-ratelimit-limit": String(max),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(Math.ceil(result.resetMs / 1000)),
    ...(result.limited ? { "retry-after": String(Math.ceil(result.resetMs / 1000)) } : {}),
  };
}
