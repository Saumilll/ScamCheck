/**
 * privacy.js — settings for visitor privacy and abuse protection.
 * Change the numbers here (or the env variables noted) to fit your site.
 */

export const PRIVACY = {
  // Scans older than this are deleted automatically.
  retentionDays: 30,
  // Most scans shown per visitor in "Recent scans".
  maxHistory: 50,
  // Anonymous visitor cookie (random ID, no personal data).
  cookieName: 'sc_vid',
  cookieMaxAgeDays: 365,
};

export const RATE_LIMIT = {
  windowMs: 10 * 60 * 1000, // 10 minutes
  // Max scans per IP address per window. Override with env RATE_LIMIT_MAX.
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '15', 10) || 15,
};

/** Set HISTORY_ENABLED=false to turn off saving and showing history completely. */
export function isHistoryEnabled() {
  return (process.env.HISTORY_ENABLED || 'true').trim().toLowerCase() !== 'false';
}
