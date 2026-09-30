import { aiAuthCopy } from "@/server/i18n/ai-auth-copy";
import { createHash, randomBytes } from "node:crypto";
import { getSession } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { requireInstallerAccess } from "@/server/setup/access";
import type { AiAuthScope } from "./attempt-store";

export const AI_AUTH_COOKIE = "sb_ai_auth";

function browserKey(request: Request): string | undefined {
  const value = request.headers.get("cookie")?.split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(`${AI_AUTH_COOKIE}=`))
    ?.slice(AI_AUTH_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

export function authBrowserHash(request: Request): string | undefined {
  const value = browserKey(request);
  return value ? createHash("sha256").update(value).digest("hex") : undefined;
}

export function authBrowserIdentity(request: Request): { readonly key: string; readonly hash: string } {
  const key = browserKey(request) ?? randomBytes(32).toString("hex");
  return { key, hash: createHash("sha256").update(key).digest("hex") };
}

export async function authorizeAiAuth(request: Request, setupToken?: string): Promise<AiAuthScope> {
  const session = await getSession();
  if (session) return { key: `owner:${session.userId}`, browserHash: authBrowserHash(request) };
  if (!setupToken) throw new ApiError("unauthorized", aiAuthCopy.loginOrSetupCode);
  return { key: await requireInstallerAccess(setupToken), browserHash: authBrowserHash(request) };
}
