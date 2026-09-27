export const SESSION_COOKIE = "sb_session";
export const LOGIN_FAIL_LIMIT = 5;
export const LOGIN_FAIL_WINDOW_MIN = 15;

export function sessionTtlDays(): number {
  const raw = Number(process.env.SESSION_TTL_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

export function passwordHash(): string | null {
  const value = process.env.AUTH_PASSWORD_HASH?.trim();
  return value ? value : null;
}
