export interface PasswordCheckResult {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too weak" | "Weak" | "Fair" | "Good" | "Strong";
  errors: string[];
}

export function checkPasswordStrength(pw: string): PasswordCheckResult {
  const errors: string[] = [];
  if (pw.length < 8) errors.push("Use at least 8 characters");
  if (!/[a-z]/.test(pw)) errors.push("Add a lowercase letter");
  if (!/[A-Z]/.test(pw)) errors.push("Add an uppercase letter");
  if (!/\d/.test(pw)) errors.push("Add a number");
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push("Add a symbol (e.g. !@#)");

  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score = Math.min(4, score + 0);
  const s = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"] as const;
  return { ok: errors.length === 0, score: s, label: labels[s], errors };
}
