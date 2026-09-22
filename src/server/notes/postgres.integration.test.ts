import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAuthSchema, getPool, resetPoolForTests } from "../db/postgres";
import { ensureNotesSchema, resetNotesSchemaForTests } from "./schema";
import { PostgresNotesStore } from "./postgres-store";
import { setNotesStoreForTests, resetNotesRuntimeForTests } from "./runtime";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";
import { mockClassificationAnswer, mockSystemOneInvoker } from "@/server/typesafe/test-helpers";
import { handleCapture, handleCreateNote, handleInboxCommand, handleListInbox, handleListNotes, handlePromoteInbox } from "./http";

const databaseUrl = process.env.DATABASE_URL ?? "";
const runIntegration = process.env.RUN_PG_INTEGRATION === "1" && databaseUrl.length > 0;

describe.runIf(runIntegration)("Postgres notes schema", () => {
  beforeAll(async () => {
    resetPoolForTests();
    resetNotesSchemaForTests();
    await ensureAuthSchema(databaseUrl);
    await ensureNotesSchema(databaseUrl);
    setNotesStoreForTests(new PostgresNotesStore(getPool(databaseUrl)));
  });

  afterAll(() => {
    resetNotesRuntimeForTests();
    resetPoolForTests();
  });

  it("persists notes through handlers", async () => {
    const create = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "PG", body: "round trip" }),
      }),
    );
    expect(create.status).toBe(201);
    const list = await handleListNotes(new Request("http://localhost/api/notes"));
    expect(list.status).toBe(200);
    const body = (await list.json()) as { notes: { title: string }[] };
    expect(body.notes.some((n) => n.title === "PG")).toBe(true);
  });

  it("promotes an inbox item and round-trips suggestions without applying tags", async () => {
    setSystemOneInvokerForTests(
      mockSystemOneInvoker({
        tag_idea: { type: "noul", noul: 0.8 },
        classification: mockClassificationAnswer("idea", 0.8),
      }),
    );
    process.env.TYPESAFE_API_KEY = "test-key-not-used-with-mock";
    const capture = await handleCapture(
      new Request("http://localhost/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "PG inbox", body: "round trip", target: "inbox" }),
      }),
    );
    expect(capture.status).toBe(201);
    const captured = (await capture.json()) as { inboxItem: { id: string } };
    const promoted = await handlePromoteInbox(captured.inboxItem.id);
    expect(promoted.status).toBe(200);
    const body = (await promoted.json()) as {
      note: { title: string; id: string };
      inboxItem: { promotedNoteId: string; suggestions: { tags: { tag: string }[] } | null };
    };
    expect(body.inboxItem.promotedNoteId).toBe(body.note.id);
    expect(body.note).not.toHaveProperty("tags");
    expect(body.inboxItem.suggestions?.tags.some((tag) => tag.tag === "idea")).toBe(true);
    const list = await handleListInbox(new Request("http://localhost/api/inbox?includeClosed=1"));
    expect(list.status).toBe(200);
    const listed = (await list.json()) as {
      inboxItems: { id: string; suggestions: { classification: { choice: string } } | null }[];
    };
    const row = listed.inboxItems.find((item) => item.id === captured.inboxItem.id);
    expect(row?.suggestions?.classification.choice).toBe("idea");
    setSystemOneInvokerForTests(null);
    delete process.env.TYPESAFE_API_KEY;
  });

  it("records a failed ingest job and retries it through postgres", async () => {
    setSystemOneInvokerForTests(mockSystemOneInvoker());
    process.env.TYPESAFE_API_KEY = "test-key-not-used-with-mock";
    process.env.URL_SUMMARY_FORCE_FAIL = "1";
    const failed = await handleCapture(
      new Request("http://localhost/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "PG url",
          body: "body",
          target: "inbox",
          url: "https://example.com/pg",
        }),
      }),
    );
    expect(failed.status).toBe(502);
    const { jobId } = (await failed.json()) as { jobId: string };
    delete process.env.URL_SUMMARY_FORCE_FAIL;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("pg summary", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })) as typeof fetch;
    try {
      const retried = await handleInboxCommand(
        new Request("http://localhost/api/inbox", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "retry", id: jobId }),
        }),
      );
      expect(retried.status).toBe(200);
      const body = (await retried.json()) as {
        inboxItem: { suggestions: { classification: { choice: string } } | null };
      };
      expect(body.inboxItem.suggestions?.classification.choice).toBe("unsorted");
    } finally {
      globalThis.fetch = originalFetch;
      setSystemOneInvokerForTests(null);
      delete process.env.TYPESAFE_API_KEY;
    }
  });
});
