/**
 * rate-limiter.ts — lightweight in-process rate limiter.
 *
 * Uses a sliding window counter stored in a Map.
 * Works in all Next.js deployment targets (Edge is NOT required).
 *
 * For high-traffic production use, swap the `store` for an
 * Upstash Redis or Vercel KV backend.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *   const { ok, remaining } = limiter.check(identifier);
 *   if (!ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
 */

type WindowEntry = {
  count: number;
  windowStart: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number; // Unix epoch ms
};

export type RateLimiterOptions = {
  /** Window duration in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
  /** Max requests per window. */
  max: number;
};

export function createRateLimiter(options: RateLimiterOptions) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max;
  const store = new Map<string, WindowEntry>();

  // Prune entries older than 2× window every 5 minutes to avoid memory leaks.
  const pruneInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs * 2;
    for (const [key, entry] of store.entries()) {
      if (entry.windowStart < cutoff) store.delete(key);
    }
  }, 5 * 60_000);

  // Don't block process exit
  if (typeof pruneInterval.unref === "function") pruneInterval.unref();

  return {
    check(identifier: string): RateLimitResult {
      const now = Date.now();
      const existing = store.get(identifier);

      if (!existing || now - existing.windowStart >= windowMs) {
        // New window
        store.set(identifier, { count: 1, windowStart: now });
        return { ok: true, remaining: max - 1, resetAt: now + windowMs };
      }

      if (existing.count >= max) {
        return {
          ok: false,
          remaining: 0,
          resetAt: existing.windowStart + windowMs,
        };
      }

      existing.count++;
      return {
        ok: true,
        remaining: max - existing.count,
        resetAt: existing.windowStart + windowMs,
      };
    },

    /** Reset the counter for a specific identifier (e.g. after successful auth). */
    reset(identifier: string) {
      store.delete(identifier);
    },
  };
}

// ── Pre-configured limiters ────────────────────────────────────────────────

/** 10 upload registrations per minute per IP. */
export const uploadRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** 5 publish requests per minute per project. */
export const publishRateLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/** 30 general API calls per minute per IP. */
export const apiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/**
 * Extract the best available client identifier from a Next.js Request.
 * Uses X-Forwarded-For if behind a proxy, otherwise falls back to "unknown".
 */
export function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return "unknown";
}
