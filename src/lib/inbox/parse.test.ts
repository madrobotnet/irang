import { describe, expect, it } from "vitest";
import { parseInboxItem, parseInboxListBody, parseIngestJobsBody } from "./parse";
import { sourceLabel } from "@/components/inbox/source-label";

describe("parseInboxItem", () => {
  it("reads stored suggestions and ignores a rewritten title", () => {
    const item = parseInboxItem({
      id: "abc",
      title: "파일",
      body: "본문",
      source: "file",
      url: null,
      createdAt: "2026-09-22T00:00:00.000Z",
      promotedNoteId: null,
      discardedAt: null,
      suggestions: {
        tags: [{ tag: "clip", probability: 0.6 }],
        classification: { choice: "reference", probability: 0.6, confidence: 0.33 },
        judgedAt: "2026-09-22T00:00:00.000Z",
        title: "무시",
      },
    });
    expect(item?.suggestions?.tags[0]?.tag).toBe("clip");
    expect(item?.suggestions?.classification?.confidence).toBe(0.33);
    expect(item?.title).toBe("파일");
    expect(item?.source).toBe("file");
    expect(item).not.toHaveProperty("ingestFailed");
  });

  it("rejects an unknown source and a malformed suggestion block", () => {
    expect(parseInboxItem({ id: "a", title: "t", source: "email" })).toBeNull();
    const item = parseInboxItem({
      id: "a",
      title: "t",
      body: "b",
      source: "api",
      suggestions: { tags: "idea" },
    });
    expect(item?.suggestions).toBeNull();
  });

  it("parses a list envelope and source chips", () => {
    const items = parseInboxListBody({
      ok: true,
      inboxItems: [
        {
          id: "a",
          title: "t",
          body: "",
          source: "url",
          url: null,
          createdAt: "2026-09-22T00:00:00.000Z",
          promotedNoteId: null,
          discardedAt: null,
          suggestions: null,
        },
      ],
    });
    expect(items?.[0]?.source).toBe("url");
    expect(items?.[0]?.suggestions).toBeNull();
    expect(sourceLabel("url")).toBe("웹");
    expect(sourceLabel("web")).toBe("웹");
    expect(sourceLabel("share")).toBe("공유");
    expect(sourceLabel("api")).toBe("API");
    expect(sourceLabel("file")).toBe("파일");
  });

  it("parses failed ingest jobs", () => {
    const jobs = parseIngestJobsBody({
      ok: true,
      jobs: [
        {
          id: "job-1",
          status: "failed",
          payload: { title: "링크", url: "https://example.com" },
          error: null,
          createdAt: "2026-09-22T03:00:00.000Z",
        },
      ],
    });
    expect(jobs).toEqual([
      {
        id: "job-1",
        title: "링크",
        detail: "https://example.com",
        createdAt: "2026-09-22T03:00:00.000Z",
      },
    ]);
  });
});
