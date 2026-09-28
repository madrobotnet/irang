import { afterAll, expect, test } from "bun:test";
import { AiSettingsDocumentSchema, ConnectionProfileSchema } from "@/lib/ai-settings";
import { closeDb, tx } from "@/server/db";
import { connectTestDatabase } from "@/server/test/db";
import { MIGRATIONS } from "./migrations";

connectTestDatabase();
afterAll(closeDb);

for (const enabled of [true, false]) {
  test(`upgrades legacy AI selections and owner without losing secrets: enabled=${enabled}`, async () => {
    const migration = MIGRATIONS.find((entry) => entry.id === "0003_ai_connections");
    if (!migration) throw new Error("AI connections migration is missing");
    const schema = `ai_upgrade_${crypto.randomUUID().replaceAll("-", "")}`;
    await tx(async (client) => {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET LOCAL search_path TO ${schema}, public`);
      await client.query("CREATE TABLE users (id uuid PRIMARY KEY, password_hash text NOT NULL)");
      await client.query(`CREATE TABLE installation_settings (
        singleton boolean PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id),
        setup_completed boolean NOT NULL, ai jsonb NOT NULL
      )`);
      const ownerId = crypto.randomUUID();
      const chat = { mode: "api", provider: "anthropic", model: "legacy-model", apiKey: "legacy-chat-secret" } as const;
      const jev = { provider: "openrouter", model: "~typesafe/jev-latest", apiKey: "legacy-jev-secret" } as const;
      await client.query("INSERT INTO users VALUES ($1, 'unchanged-password-hash')", [ownerId]);
      await client.query("INSERT INTO installation_settings VALUES (true, $1, true, $2::jsonb)", [
        ownerId, JSON.stringify({ chat: enabled ? chat : null, jev: enabled ? jev : null }),
      ]);
      await client.query(migration.sql);
      const settings = await client.query<{ owner_id: string; setup_completed: boolean; ai: unknown }>("SELECT * FROM installation_settings");
      const row = settings.rows[0];
      expect(row?.owner_id).toBe(ownerId);
      expect(row?.setup_completed).toBe(true);
      const selection = AiSettingsDocumentSchema.parse(row?.ai);
      const profiles = await client.query<{ id: string; name: string; purpose: string; connection: unknown; owner_id: string }>(
        "SELECT id, name, purpose, connection, owner_id FROM ai_connections",
      );
      expect(profiles.rows).toHaveLength(enabled ? 2 : 0);
      for (const profile of profiles.rows) {
        expect(profile.owner_id).toBe(ownerId);
        const parsed = ConnectionProfileSchema.parse({
          id: profile.id, name: profile.name, purpose: profile.purpose, connection: profile.connection,
        });
        if (parsed.purpose === "chat") {
          expect(selection.chatId).toBe(parsed.id);
          expect(parsed.connection).toEqual(chat);
        } else {
          expect(selection.jevId).toBe(parsed.id);
          expect(parsed.connection).toEqual(jev);
        }
      }
      if (!enabled) expect(selection).toEqual({ version: 2, chatId: null, jevId: null });
      const owner = await client.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [ownerId]);
      expect(owner.rows[0]?.password_hash).toBe("unchanged-password-hash");
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
    });
  });
}
