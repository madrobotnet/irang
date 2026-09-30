import { afterEach, describe, expect, test } from "bun:test";
import { createNoteFromTemplate, usesTitle } from "./template-note";

type Call = { url: string; method: string; body: unknown };

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(responses: { status: number; json: unknown }[]): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return new Response(JSON.stringify(next.json), { status: next.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

const note = { id: "00000000-0000-4000-8000-000000000009", title: "Untitled 2" };

describe("usesTitle", () => {
  test("detects the title placeholder the renderer replaces, and nothing else", () => {
    expect(usesTitle("# {{title}}")).toBe(true);
    expect(usesTitle("# {{ title }}")).toBe(true);
    expect(usesTitle("{{date}} {{Title}} {{time}}")).toBe(false);
    expect(usesTitle("")).toBe(false);
  });
});

describe("createNoteFromTemplate", () => {
  test("renders the date and creates the note in one request when the title is not used", async () => {
    const calls = stubFetch([{ status: 201, json: { note } }]);
    const result = await createNoteFromTemplate("## {{date}}\n- [ ] ", "2026-09-30");
    expect(result).toEqual({ note, bodyError: null });
    expect(calls).toEqual([{ url: "/api/notes", method: "POST", body: { body: "## 2026-09-30\n- [ ] " } }]);
  });

  test("fills {{title}} with the server's default title in a follow-up PATCH", async () => {
    const calls = stubFetch([{ status: 201, json: { note } }, { status: 200, json: { note } }]);
    const result = await createNoteFromTemplate("# {{title}} ({{date}})", "2026-09-30");
    expect(result).toEqual({ note, bodyError: null });
    expect(calls).toEqual([
      { url: "/api/notes", method: "POST", body: {} },
      { url: `/api/notes/${note.id}`, method: "PATCH", body: { body: "# Untitled 2 (2026-09-30)" } },
    ]);
  });

  test("keeps the created note and reports a failed PATCH instead of throwing", async () => {
    stubFetch([{ status: 201, json: { note } }, { status: 500, json: { error: { code: "internal", message: "boom" } } }]);
    const result = await createNoteFromTemplate("{{title}}", "2026-09-30");
    expect(result.note).toEqual(note);
    expect(result.bodyError).toBeInstanceOf(Error);
  });

  test("a failed create throws", async () => {
    stubFetch([{ status: 500, json: { error: { code: "internal", message: "boom" } } }]);
    await expect(createNoteFromTemplate("{{date}}", "2026-09-30")).rejects.toThrow("boom");
  });
});
