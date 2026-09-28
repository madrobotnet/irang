import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { query, queryOne } from "@/server/db";
import { setJevForTests } from "@/server/jev/client";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { captureInbox, enrichInboxItem, listInbox, promoteInbox, suggestInbox } from "./service";

connectTestDatabase();

beforeEach(async () => {
  setJevForTests(undefined);
  await resetData();
});

afterAll(async () => {
  setJevForTests(undefined);
  await closeDb();
});

describe("capture and enrichment", () => {
  test("persists text and URL before a URL transport failure and records visible failure", async () => {
    setJevForTests(null);
    const captured = await captureInbox({ title: "자료", text: "내 메모", url: "https://example.com/a" });

    expect(captured.body).toContain("내 메모");
    expect((await listInbox()).items.map((item) => item.id)).toContain(captured.id);

    await enrichInboxItem(captured.id, {
      resolve: async () => ["93.184.216.34"],
      fetch: async () => { throw new TypeError("network down"); },
    });

    const stored = (await listInbox()).items[0]!;
    expect(stored.body).toContain("내 메모");
    expect(stored.body).toContain("URL 내용을 가져오지 못했습니다");
    expect(stored.suggestions?.status).toBe("unavailable");
  });

  test("keeps capture usable when Jev throws", async () => {
    setJevForTests(new TypeSafeClient({
      apiKey: "test",
      logLevel: "off",
      retry: { maxRetries: 0 },
      fetch: async () => { throw new Error("Jev unavailable"); },
    }));
    const captured = await captureInbox({ text: "실패해도 남는 기록" });
    const suggested = await suggestInbox(captured.id);

    expect(suggested.body).toBe("실패해도 남는 기록");
    expect(suggested.suggestions).toEqual({ status: "failed", tags: [], kind: null, duplicateOf: null });
    expect((await listInbox()).count).toBe(1);
  });

  test("maps legacy suggestion JSON without failing the inbox list", async () => {
    await query(
      `INSERT INTO inbox_items (title,body,source,suggestions)
       VALUES ('이전 항목','본문','api',$1::jsonb)`,
      [JSON.stringify({ tags: [{ tag: "idea", noul: 0.8 }, null], classification: { choice: "idea", probability: 0.7 } })],
    );

    const item = (await listInbox()).items[0]!;
    expect(item.suggestions?.status).toBe("ready");
    expect(item.suggestions?.tags).toEqual([{ tag: "idea", probability: 0.8 }]);
    expect(item.suggestions?.kind).toEqual({ choice: "idea", confidence: 0.7 });
  });
});

describe("atomic inbox promotion", () => {
  test("concurrent repeated promotion creates one note and transfers attachment ownership", async () => {
    const item = await captureInbox({ title: "승격", text: "본문" });
    await query(
      `INSERT INTO attachments (inbox_item_id,filename,mime,size_bytes,storage_key)
       VALUES ($1,'file.txt','text/plain',4,'test/file.txt')`,
      [item.id],
    );

    const [first, second] = await Promise.all([promoteInbox(item.id), promoteInbox(item.id)]);

    expect(second.id).toBe(first.id);
    const noteCount = await queryOne<{ count: number }>("SELECT count(*)::int AS count FROM notes");
    expect(noteCount?.count).toBe(1);
    const attachment = await queryOne<{ note_id: string | null; inbox_item_id: string | null }>(
      "SELECT note_id,inbox_item_id FROM attachments LIMIT 1",
    );
    expect(attachment).toEqual({ note_id: first.id, inbox_item_id: null });
  });

  test("suggestions remain proposals and are not copied to a promoted note", async () => {
    const item = await captureInbox({ title: "제안", text: "내용" });
    await query(
      "UPDATE inbox_items SET suggestions=$2::jsonb WHERE id=$1",
      [item.id, JSON.stringify({ status: "ready", tags: [{ tag: "idea", probability: 0.99 }], kind: null, duplicateOf: null })],
    );

    const note = await promoteInbox(item.id);
    expect(note.tags).toEqual([]);
    expect(note.body).toBe("내용");
  });
});
