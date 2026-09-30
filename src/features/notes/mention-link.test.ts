import { describe, expect, test } from "bun:test";
import { ApiClientError } from "@/lib/api-client";
import type { Note } from "@/lib/types";
import { linkUnlinkedMention, mentionConflict, mentionExcerpt } from "./mention-link";

const TARGET = "00000000-0000-4000-8000-000000000001";
const SOURCE = "00000000-0000-4000-8000-000000000002";

const note = (updatedAt: string) => ({ id: SOURCE, title: "Garden", updatedAt }) as Note;
const conflict = (kind?: string) => new ApiClientError(409, "conflict", "Conflict", {
  error: { code: "conflict", message: "Conflict", ...(kind ? { conflict: kind } : {}) } as never,
});

/** Scripted API: each GET of the source returns the next `updatedAt`, each POST the next outcome. */
function scripted(versions: string[], posts: (Error | Note)[]) {
  const calls: { path: string; body?: unknown }[] = [];
  const request = async <T,>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> => {
    calls.push({ path, body: init?.json });
    if (!init?.method) return { note: note(versions.shift()!) } as T;
    const outcome = posts.shift()!;
    if (outcome instanceof Error) throw outcome;
    return { note: outcome } as T;
  };
  return { calls, request };
}

describe("linkUnlinkedMention", () => {
  test("posts the source's current updatedAt to the link route", async () => {
    const linked = note("2026-09-30T01:00:00.000Z");
    const api = scripted(["2026-09-30T00:00:00.000Z"], [linked]);
    expect(await linkUnlinkedMention(TARGET, SOURCE, api.request)).toEqual({ kind: "linked", note: linked });
    expect(api.calls).toEqual([
      { path: `/api/notes/${SOURCE}`, body: undefined },
      { path: `/api/notes/${TARGET}/mentions/${SOURCE}/link`, body: { expectedUpdatedAt: "2026-09-30T00:00:00.000Z" } },
    ]);
  });

  test("a stale read is refetched and retried once with the new updatedAt", async () => {
    const linked = note("2026-09-30T02:00:00.000Z");
    const api = scripted(["2026-09-30T00:00:00.000Z", "2026-09-30T01:00:00.000Z"], [conflict("stale"), linked]);
    expect(await linkUnlinkedMention(TARGET, SOURCE, api.request)).toEqual({ kind: "linked", note: linked });
    expect(api.calls.filter((call) => call.body).map((call) => call.body)).toEqual([
      { expectedUpdatedAt: "2026-09-30T00:00:00.000Z" },
      { expectedUpdatedAt: "2026-09-30T01:00:00.000Z" },
    ]);
  });

  test("a second stale conflict stops with stale", async () => {
    const api = scripted(["a", "b"], [conflict("stale"), conflict("stale")]);
    expect(await linkUnlinkedMention(TARGET, SOURCE, api.request)).toEqual({ kind: "stale" });
    expect(api.calls).toHaveLength(4);
  });

  test("mention_gone stops without retrying", async () => {
    const api = scripted(["a"], [conflict("mention_gone")]);
    expect(await linkUnlinkedMention(TARGET, SOURCE, api.request)).toEqual({ kind: "gone" });
    expect(api.calls).toHaveLength(2);
  });

  test("other failures, including a 409 without a conflict field, are thrown", async () => {
    const trashed = conflict();
    await expect(linkUnlinkedMention(TARGET, SOURCE, scripted(["a"], [trashed]).request)).rejects.toBe(trashed);
  });
});

describe("mentionConflict", () => {
  test("reads only known conflict kinds on a 409", () => {
    expect(mentionConflict(conflict("stale"))).toBe("stale");
    expect(mentionConflict(conflict("mention_gone"))).toBe("mention_gone");
    expect(mentionConflict(conflict("other"))).toBeNull();
    expect(mentionConflict(new ApiClientError(404, "not_found", "Missing"))).toBeNull();
    expect(mentionConflict(new Error("offline"))).toBeNull();
  });
});

describe("mentionExcerpt", () => {
  const basil = { title: "바질", aliases: ["Basil"] };

  test("splits around the first linkable mention, Hangul particles excluded", () => {
    expect(mentionExcerpt("오늘 바질은 잘 자랐다", basil)).toEqual({ before: "오늘 ", match: "바질", after: "은 잘 자랐다" });
  });

  test("an alias mention keeps its spelling", () => {
    expect(mentionExcerpt("Water the basil daily", basil)).toEqual({ before: "Water the ", match: "basil", after: " daily" });
  });

  test("skips an already linked occurrence", () => {
    expect(mentionExcerpt("[[바질]] 그리고 바질", basil)).toEqual({ before: "[[바질]] 그리고 ", match: "바질", after: "" });
  });

  test("trims a long lead at a word boundary", () => {
    const context = `${"긴 문장이 이어진다 ".repeat(8)}그래서 바질을 샀다`;
    const excerpt = mentionExcerpt(context, basil, 16);
    expect(excerpt?.match).toBe("바질");
    expect(excerpt?.before.startsWith("…")).toBe(true);
    expect(excerpt!.before.length).toBeLessThanOrEqual(17);
    expect(context.endsWith(`${excerpt!.before.slice(1)}${excerpt!.match}${excerpt!.after}`)).toBe(true);
  });

  test("null when the context has no linkable mention", () => {
    expect(mentionExcerpt("`바질` in code", basil)).toBeNull();
    expect(mentionExcerpt("Party time", { title: "Art", aliases: [] })).toBeNull();
  });
});
