/** Basic email validation */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Simple client-side rate limiter keyed by action.
 *
 * This only smooths accidental double-submits — it lives in page memory and is
 * gone on reload, so it is not a defence against anyone deliberate. The real
 * limits are enforced in Code.gs (MAX_PENDING_PER_CUSTOMER, CODE_SENDS_PER_WINDOW).
 */
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(key: string, maxCalls: number, windowMs: number): boolean {
  const now = Date.now();
  const calls = (rateLimitMap.get(key) ?? []).filter(t => now - t < windowMs);
  if (calls.length >= maxCalls) return false;
  calls.push(now);
  rateLimitMap.set(key, calls);
  return true;
}
