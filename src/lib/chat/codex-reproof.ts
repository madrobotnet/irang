/**
 * E5 re-proof seat for live citation and AiApproveModal.
 *
 * The Jev live path in `src/server/chat/live.proof.test.ts` stubs Codex so
 * it can run with a TypeSafe key alone. That stub is not this proof.
 *
 * When `CODEX_API_KEY` is injected, re-run live citation and open
 * AiApproveModal (`data-ai-approve="open"` in ChatView) against the real
 * generator. Until that run is recorded, `status` stays `pending_codex_key`.
 * E6 does not wait on it.
 *
 * A missing Codex key is not a cited reply and not an approved edit.
 * Do not fill either target with a stub success. Jev output stays as
 * returned; this seat does not re-verify a judgment. TypeSafe or key
 * failure stays an explicit error code.
 */

export const E5_CODEX_REPROOF_ENV = "CODEX_API_KEY" as const;

export const E5_CODEX_REPROOF_TARGETS = ["live_cite", "approve_modal"] as const;

export type E5CodexReproofTarget = (typeof E5_CODEX_REPROOF_TARGETS)[number];

/** `proven` is set only after a run with CODEX_API_KEY, not by a stub. */
export type E5CodexReproofStatus = "pending_codex_key" | "proven";

export type E5CodexReproofHook = {
  env: typeof E5_CODEX_REPROOF_ENV;
  targets: typeof E5_CODEX_REPROOF_TARGETS;
  status: E5CodexReproofStatus;
};

export const E5_CODEX_REPROOF_HOOK: E5CodexReproofHook = {
  env: E5_CODEX_REPROOF_ENV,
  targets: E5_CODEX_REPROOF_TARGETS,
  status: "pending_codex_key",
};
