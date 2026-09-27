import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type CodexSession = {
  kind: "chatgpt";
  accessToken: string;
  accountId: string;
  refreshToken: string | null;
  authFilePath: string;
};

export type CodexAuth = CodexSession | { kind: "absent" } | { kind: "blocked" };
type Environment = Record<string, string | undefined>;

const AUTH_CLAIM = "https://api.openai.com/auth";
const CHATGPT_MODES = new Set(["chatgpt", "chatgptAuthTokens"]);

export function codexAuthFilePath(env: Environment = process.env): string {
  return path.join(env.CODEX_HOME?.trim() || path.join(homedir(), ".codex"), "auth.json");
}

function jwtPayload(token: string): Record<string, unknown> | null {
  const encoded = token.split(".")[1];
  if (!encoded) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function accountId(token: string, explicit: unknown): string | null {
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const payload = jwtPayload(token);
  const claim = payload?.[AUTH_CLAIM];
  const nested = claim && typeof claim === "object" && !Array.isArray(claim)
    ? (claim as Record<string, unknown>).chatgpt_account_id
    : null;
  const value = nested ?? payload?.chatgpt_account_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveCodexAuth(text: string | null, filePath = codexAuthFilePath()): CodexAuth {
  if (text === null) return { kind: "absent" };
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { kind: "blocked" };
    const row = parsed as Record<string, unknown>;
    if (typeof row.auth_mode === "string" && !CHATGPT_MODES.has(row.auth_mode)) return { kind: "blocked" };
    const tokens = row.tokens && typeof row.tokens === "object" && !Array.isArray(row.tokens)
      ? row.tokens as Record<string, unknown>
      : null;
    const accessToken = typeof tokens?.access_token === "string" ? tokens.access_token.trim() : "";
    const id = accountId(accessToken, tokens?.account_id);
    if (!accessToken || !id) return { kind: "blocked" };
    const refresh = typeof tokens?.refresh_token === "string" ? tokens.refresh_token.trim() : "";
    return {
      kind: "chatgpt",
      accessToken,
      accountId: id,
      refreshToken: refresh || null,
      authFilePath: filePath,
    };
  } catch {
    return { kind: "blocked" };
  }
}

export async function loadCodexAuth(env: Environment = process.env): Promise<CodexAuth> {
  const filePath = codexAuthFilePath(env);
  try {
    return resolveCodexAuth(await readFile(filePath, "utf8"), filePath);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? { kind: "absent" } : { kind: "blocked" };
  }
}

export function accessTokenExpired(token: string, now = Date.now()): boolean {
  const exp = jwtPayload(token)?.exp;
  return typeof exp === "number" && Number.isFinite(exp) && exp * 1000 <= now + 60_000;
}

export async function persistCodexSession(session: CodexSession): Promise<void> {
  const parsed = JSON.parse(await readFile(session.authFilePath, "utf8")) as Record<string, unknown>;
  const tokens = parsed.tokens && typeof parsed.tokens === "object" && !Array.isArray(parsed.tokens)
    ? parsed.tokens as Record<string, unknown>
    : {};
  tokens.access_token = session.accessToken;
  tokens.account_id = session.accountId;
  if (session.refreshToken) tokens.refresh_token = session.refreshToken;
  parsed.tokens = tokens;
  parsed.last_refresh = new Date().toISOString();
  const temporaryPath = `${session.authFilePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, session.authFilePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
