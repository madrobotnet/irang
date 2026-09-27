import { afterAll, describe, expect, test } from "bun:test";
import { closeDb, query } from "@/server/db";
import { useTestDatabase } from "@/server/test/db";

useTestDatabase();
afterAll(closeDb);

describe("migrations", () => {
  test("apply once and record every migration", async () => {
    const rows = await query<{ id: string }>("SELECT id FROM schema_migrations ORDER BY id");
    expect(rows.map((r) => r.id)).toContain("0001_v2_baseline");
    const cols = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'notes'",
    );
    const names = cols.map((c) => c.column_name);
    for (const c of ["tags", "aliases", "pinned", "daily_date", "search_tsv", "search_embedding"]) {
      expect(names).toContain(c);
    }
  });
});
