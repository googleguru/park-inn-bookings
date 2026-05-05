/** Strip HTML tags and dangerous characters from user input */
export function sanitizeInput(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`]/g, '')
    .trim();
}

/** Basic email validation */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Simple client-side rate limiter keyed by action */
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(key: string, maxCalls: number, windowMs: number): boolean {
  const now = Date.now();
  const calls = (rateLimitMap.get(key) ?? []).filter(t => now - t < windowMs);
  if (calls.length >= maxCalls) return false;
  calls.push(now);
  rateLimitMap.set(key, calls);
  return true;
}

/** Mask sensitive strings for display (e.g. emails, phones) */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || local.length <= 2) return email;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}${'*'.repeat(phone.length - 6)}${phone.slice(-3)}`;
}
