import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import path from "node:path";

export type CliAuthProvider = "google";
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
  options: { readonly env?: CliEnvironment } = {},
): Promise<CliAuthReadiness> {
  const env = options.env ?? process.env;
  const instructions = "docker compose exec -e NO_BROWSER=true app gemini";
  const result = (available: boolean, detail: string): CliAuthReadiness =>
    ({ provider, available, instructions, detail });
  if (process.platform !== "linux") return result(false, "This adapter supports Linux file-based CLI credentials only.");
  if (!await findCliBinary(env)) {
    return result(false, "Gemini CLI가 설치되어 있지 않습니다.");
  }
  if (!await cliCredentialFile(env)) {
    return result(false, "지정한 서버 인증 저장소에 Google 로그인 정보가 없습니다.");
  }
  return result(true, "CLI와 로그인 파일을 확인했습니다. 계정 유효성과 모델 사용 권한은 실제 요청 시 확인됩니다.");
}
