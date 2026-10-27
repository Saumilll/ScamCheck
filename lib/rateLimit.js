import { RATE_LIMIT } from '@/lib/privacy';

/**
 * Simple in-memory limiter: at most RATE_LIMIT.maxRequests per IP per window.
 * On Vercel each serverless instance keeps its own counter, so this is a best-effort
 * guard against casual abuse. For a hard limit, add Vercel Firewall rate limiting.
 */
const store = (globalThis.__scanRateStore = globalThis.__scanRateStore || new Map());

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function checkRateLimit(request) {
  const now = Date.now();
  const ip = getClientIp(request);

  // Drop expired entries now and then so the map cannot grow forever.
  if (store.size > 5000) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }

  let entry = store.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + RATE_LIMIT.windowMs };
    store.set(ip, entry);
  }

  entry.count += 1;
  const allowed = entry.count <= RATE_LIMIT.maxRequests;
  return {
    allowed,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}
