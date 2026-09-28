import { createHash, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { AiSettingsInputSchema, type AiSettingsInput } from "@/lib/ai-settings";
import { passwordHash } from "@/server/auth/config";
import { queryOne, tx } from "@/server/db";
import { ApiError } from "@/server/http";
import { resolveAiSettings } from "./settings";

export const SetupInputSchema = z.object({
  setupToken: z.string().min(32).max(256),
  password: z.string().min(12).max(512),
  passwordConfirmation: z.string().min(12).max(512),
  ai: AiSettingsInputSchema,
}).strict().refine((input) => input.password === input.passwordConfirmation, {
  path: ["passwordConfirmation"],
  message: "비밀번호가 일치하지 않습니다.",
});

export type SetupState = "ready" | "disabled" | "complete";

const OCCUPIED_SQL = `SELECT
  EXISTS (SELECT 1 FROM users)
  OR EXISTS (SELECT 1 FROM installation_settings)
  OR EXISTS (SELECT 1 FROM notes)
  OR EXISTS (SELECT 1 FROM inbox_items)
  OR EXISTS (SELECT 1 FROM chat_threads)
  OR EXISTS (SELECT 1 FROM attachments) AS occupied`;

export async function setupState(): Promise<SetupState> {
  // Environment-managed installations never expose first-run account creation.
  if (process.env.AUTH_PASSWORD_HASH?.trim()) return "complete";
  const existing = await queryOne<{ occupied: boolean }>(OCCUPIED_SQL);
  if (existing?.occupied) return "complete";
  const token = process.env.SETUP_TOKEN?.trim();
  return token && token.length >= 32 && token.length <= 256 ? "ready" : "disabled";
}

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
}): Promise<void> {
  if (await setupState() === "complete") {
    throw new ApiError("conflict", "최초 설정이 이미 완료되었습니다. 로그인해 주세요.");
  }
  const expected = process.env.SETUP_TOKEN?.trim();
  if (!expected || expected.length < 32 || expected.length > 256) {
    throw new ApiError("unavailable", "서버에 32자 이상의 SETUP_TOKEN을 먼저 설정해 주세요.");
  }
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(expected), digest(input.setupToken))) {
    throw new ApiError("forbidden", "설치 확인 코드가 맞지 않습니다.");
  }
  if (process.env.AUTH_PASSWORD_HASH?.trim()) throw new ApiError("conflict", "이미 설정된 서버입니다.");
  const ai = resolveAiSettings(input.ai, null);
  const hash = await argon2.hash(input.password, { type: argon2.argon2id });
  await tx(async (client) => {
    // Shared with legacy owner creation and settings writes, across processes.
    await client.query("SELECT pg_advisory_xact_lock(7431003)");
    const existing = await client.query<{ occupied: boolean }>(OCCUPIED_SQL);
    if (existing.rows[0]?.occupied) throw new ApiError("conflict", "기존 데이터가 있는 서버는 최초 설정으로 변경할 수 없습니다.");
    const result = await client.query<{ id: string }>(
      "INSERT INTO users (password_hash) VALUES ($1) RETURNING id",
      [hash],
    );
    const owner = result.rows[0];
    if (!owner) throw new ApiError("internal", "설정을 저장하지 못했습니다.");
    await client.query(
      `INSERT INTO installation_settings (singleton, owner_id, setup_completed, ai)
       VALUES (true, $1, true, $2::jsonb)`,
      [owner.id, JSON.stringify(ai)],
    );
  });
}
