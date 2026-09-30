import { constants } from "node:fs";
import { access, lstat, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { GoogleCredentialSchema, type GoogleCredential } from "@/lib/ai-auth";
import type { Locale } from "@/lib/i18n/locale";
import { readinessCopy } from "@/server/i18n/copy";

export type CliAuthProvider = "google";
export type CliStoredSession = {
  readonly credential: GoogleCredential;
  readonly persist: (credential: GoogleCredential) => Promise<void>;
};

export async function stageCliCredential(file: string, credential: GoogleCredential): Promise<void> {
  await writeFile(file, JSON.stringify({
    access_token: credential.accessToken, refresh_token: credential.refreshToken, expiry_date: credential.expiresAt,
    id_token: credential.idToken, scope: credential.scope, token_type: credential.tokenType ?? "Bearer",
  }), { mode: 0o600 });
}

/** Read only the bounded isolated credential file after the child has exited.
 * Google may omit refresh_token on rotation; retain the saved refresh grant. */
export async function collectCliCredential(file: string, session: CliStoredSession): Promise<void> {
  const info = await lstat(file);
  if (!info.isFile() || info.size > 64 * 1024) throw new TypeError("Invalid CLI credential file");
  const tokens = z.object({
    access_token: z.string(), refresh_token: z.string().optional(), expiry_date: z.number(),
    id_token: z.string().optional(), scope: z.string().optional(), token_type: z.string().optional(),
  }).parse(JSON.parse(await readFile(file, "utf8")));
  const previous = session.credential;
  const next = GoogleCredentialSchema.parse({
    provider: "google", accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? previous.refreshToken,
    expiresAt: tokens.expiry_date, idToken: tokens.id_token ?? previous.idToken,
    scope: tokens.scope ?? previous.scope, tokenType: tokens.token_type ?? previous.tokenType,
  });
  if (JSON.stringify(next) !== JSON.stringify(previous)) await session.persist(next);
}
export type CliEnvironment = Readonly<Record<string, string | undefined>>;
export type CliAuthReadiness = {
  readonly provider: CliAuthProvider;
  readonly available: boolean;
  readonly instructions: string;
  readonly detail: string;
};

export function cliSearchPath(env: CliEnvironment): string {
  return (env.PATH ?? "").split(path.delimiter).filter((entry) => path.isAbsolute(entry)).join(path.delimiter);
}

/** Locate the fixed executable without starting it, loading a shell, or using cwd. */
export async function findCliBinary(env: CliEnvironment): Promise<string | undefined> {
  for (const directory of cliSearchPath(env).split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory, "gemini");
    try {
      await access(candidate, constants.X_OK);
      if ((await stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      // Filesystem failures mean this candidate is not an executable available to us.
    }
  }
  return undefined;
}

/** Only the explicitly injected credential root is consulted; no host-home fallback. */
export async function cliCredentialFile(
  env: CliEnvironment,
): Promise<string | undefined> {
  const directory = env.GEMINI_CLI_HOME;
  if (!directory || !path.isAbsolute(directory)) return undefined;
  const relative = ".gemini/oauth_creds.json";
  try {
    const root = await realpath(directory);
    const file = await realpath(path.join(root, relative));
    const withinRoot = path.relative(root, file);
    if (withinRoot.startsWith(`..${path.sep}`) || path.isAbsolute(withinRoot) || withinRoot === "..") return undefined;
    await access(file, constants.R_OK);
    const info = await stat(file);
    return info.isFile() && info.size > 0 && info.size <= 64 * 1024 ? file : undefined;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return undefined;
  }
}

/**
 * Readiness is executable + readable nonempty official credential FILE, not token
 * validity, subscription entitlement, or live model access. Never runs the CLI,
 * reads credential contents, refreshes tokens, or probes any network endpoint.
 *
 * Gemini 0.61.0 uses its own homedir(), which prefers GEMINI_CLI_HOME over HOME:
 * https://github.com/google-gemini/gemini-cli/blob/v0.61.0/packages/core/src/utils/paths.ts
 * Storage.getOAuthCredsPath() then appends .gemini/oauth_creds.json to that root.
 */
export async function getCliAuthReadiness(
  provider: CliAuthProvider,
  options: { readonly env?: CliEnvironment; readonly locale?: Locale } = {},
): Promise<CliAuthReadiness> {
  const env = options.env ?? process.env;
  const locale = options.locale ?? "ko";
  const instructions = "docker compose exec -e NO_BROWSER=true app gemini";
  const result = (available: boolean, detail: string): CliAuthReadiness =>
    ({ provider, available, instructions, detail });
  if (process.platform !== "linux") return result(false, readinessCopy.linuxOnly[locale]);
  if (!await findCliBinary(env)) {
    return result(false, readinessCopy.geminiMissing[locale]);
  }
  if (!await cliCredentialFile(env)) {
    return result(false, readinessCopy.googleNoLogin[locale]);
  }
  return result(true, readinessCopy.cliReady[locale]);
}
