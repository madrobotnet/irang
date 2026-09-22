export class CodexMisconfiguredError extends Error {
  readonly name = "CodexMisconfiguredError";

  constructor() {
    super("codex_misconfigured");
  }
}

export function readCodexAuth(): string {
  const auth = process.env["CODEX_AUTH"]?.trim() ?? "";
  if (auth === "") throw new CodexMisconfiguredError();
  return auth;
}
