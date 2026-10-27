import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { PRIVACY } from '@/lib/privacy';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the anonymous visitor ID from the cookie.
 * With create=true a new random ID is issued (and the cookie set) when none exists.
 * Returns null when there is no cookie and create is false.
 */
export async function getVisitorId({ create = false } = {}) {
  const store = await cookies();
  const existing = store.get(PRIVACY.cookieName)?.value;
  if (existing && UUID_PATTERN.test(existing)) return existing;
  if (!create) return null;

  const id = randomUUID();
  store.set(PRIVACY.cookieName, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PRIVACY.cookieMaxAgeDays * 24 * 60 * 60,
  });
  return id;
}
