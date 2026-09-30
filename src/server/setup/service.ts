import { localizedIssue } from "@/lib/i18n/validation";
import { setupIssueCopy } from "@/lib/i18n/ai-validation-copy";
import { setupCopy } from "@/server/i18n/setup-copy";
import argon2 from "argon2";
import { z } from "zod";
import { AiSettingsInputSchema, type AiSettingsInput } from "@/lib/ai-settings";
import { passwordHash } from "@/server/auth/config";
import { queryOne, tx } from "@/server/db";
import { ApiError } from "@/server/http";
import { resolveAiSettings } from "./settings";
import { OCCUPIED_SQL, requireInstallerAccess } from "./access";

export { setupState } from "./access";
export type { SetupState } from "./access";

export const SetupInputSchema = z.object({
  setupToken: z.string().min(32).max(256),
  password: z.string().min(12).max(512),
  passwordConfirmation: z.string().min(12).max(512),
  ai: AiSettingsInputSchema,
}).strict().refine((input) => input.password === input.passwordConfirmation, {
  path: ["passwordConfirmation"],
  ...localizedIssue(setupIssueCopy.passwordMismatch),
});

/** Existing AUTH_PASSWORD_HASH remains authoritative; only wizard-created owners are a fallback. */
export async function loginPasswordHash(): Promise<string | null> {
  const configured = passwordHash();
  if (configured) return configured;
  const owner = await queryOne<{ password_hash: string }>(
    `SELECT u.password_hash FROM installation_settings s
     JOIN users u ON u.id = s.owner_id WHERE s.singleton AND s.setup_completed`,
  );
  return owner?.password_hash ?? null;
}

export async function completeSetup(input: {
  readonly setupToken: string;
  readonly password: string;
  readonly ai: AiSettingsInput;
}, options: { readonly browserHash?: string } = {}): Promise<void> {
  const scopeKey = await requireInstallerAccess(input.setupToken);
  const hash = await argon2.hash(input.password, { type: argon2.argon2id });
  await tx(async (client) => {
    // Shared with legacy owner creation and settings writes, across processes.
    await client.query("SELECT pg_advisory_xact_lock(7431003)");
    const existing = await client.query<{ occupied: boolean }>(OCCUPIED_SQL);
    if (existing.rows[0]?.occupied) throw new ApiError("conflict", setupCopy.hasData);
    const result = await client.query<{ id: string }>(
      "INSERT INTO users (password_hash) VALUES ($1) RETURNING id",
      [hash],
    );
    const owner = result.rows[0];
    if (!owner) throw new ApiError("internal", setupCopy.saveFailed);
    const ai = await resolveAiSettings(client, input.ai, {
      ownerId: owner.id, previous: null,
      scope: { key: scopeKey, browserHash: options.browserHash },
    });
    await client.query(
      `INSERT INTO installation_settings (singleton, owner_id, setup_completed, ai)
       VALUES (true, $1, true, $2::jsonb)`,
      [owner.id, JSON.stringify(ai)],
    );
    await client.query("DELETE FROM ai_auth_attempts WHERE scope_key = $1", [scopeKey]);
  });
}
