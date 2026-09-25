import { afterAll, describe, expect, it } from "vitest";
import { handleCreateNote } from "@/server/notes/http";
import { MemoryNotesStore } from "@/server/notes/memory-store";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import { E5_CODEX_REPROOF_HOOK } from "@/lib/chat/codex-reproof";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";
import { MemorySearchIndex } from "@/server/search/memory-index";
import { resetSearchRuntimeForTests, setSearchIndexForTests } from "@/server/search/runtime";
import { setCodexGeneratorForTests, type CodexGenerator } from "./codex";
import { handleCreateThread, handlePostMessage } from "./http";
import { MemoryChatStore } from "./memory-store";
import { resetChatRuntimeForTests, setChatStoreForTests } from "./runtime";

const runLive = process.env.RUN_TYPESAFE_PROOF === "1" && Boolean(process.env.TYPESAFE_API_KEY);

type HookKeys = keyof typeof E5_CODEX_REPROOF_HOOK;
type NoQuietFallback = Extract<HookKeys, "fallback" | "citedReply" | "approved"> extends never ? true : never;
const noQuietFallback: NoQuietFallback = true;

describe("E5 Codex re-proof hook", () => {
  it("keeps live cite and ApproveModal pending until CODEX_API_KEY is injected", () => {
    expect(noQuietFallback).toBe(true);
    expect(E5_CODEX_REPROOF_HOOK).toEqual({
      env: "CODEX_API_KEY",
      targets: ["live_cite", "approve_modal"],
      status: "pending_codex_key",
    });
  });
});

/**
 * Quoting stub so the Jev live path can run without CODEX_API_KEY.
 * E5_CODEX_REPROOF_HOOK is the later seat: inject the key, then re-prove
 * live citation and AiApproveModal with the real generator. Leave the
 * hook pending. This stub is not that proof and is not a quiet success.
 */
const quotingCodex: CodexGenerator = {
  async generate(input) {
    const ids = input.notes.map((note) => note.noteId);
    if (ids.length < 1) {
      throw new Error("codex saw no notes");
    }
    return {
      text: `Cited ${ids.join(",")}.`,
      proposal: null,
    };
  },
};

describe.runIf(runLive)("live TypeSafe chat judgments", () => {
  afterAll(() => {
    setSystemOneInvokerForTests(null);
    setCodexGeneratorForTests(null);
    resetNotesRuntimeForTests();
    resetChatRuntimeForTests();
    resetSearchRuntimeForTests();
  });

  it("routes and cites notes from Jev, with Codex limited to the selected notes", async () => {
    setSystemOneInvokerForTests(null);
    setCodexGeneratorForTests(quotingCodex);
    setNotesStoreForTests(new MemoryNotesStore());
    setChatStoreForTests(new MemoryChatStore());
    setSearchIndexForTests(new MemorySearchIndex());

    const ownership = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Note ownership",
          body: "Uploaded notes in this vault belong to the single operator who captured them.",
        }),
      }),
    );
    const recipe = await handleCreateNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Kimchi stew",
          body: "Simmer kimchi with tofu and pork for a weeknight stew.",
        }),
      }),
    );
    expect(ownership.status).toBe(201);
    expect(recipe.status).toBe(201);
    const owned = ((await ownership.json()) as { note: { id: string } }).note.id;
    const cooked = ((await recipe.json()) as { note: { id: string } }).note.id;

    const thread = await handleCreateThread(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Live" }),
      }),
    );
    expect(thread.status).toBe(201);
    const threadId = ((await thread.json()) as { thread: { id: string } }).thread.id;

    const response = await handlePostMessage(
      threadId,
      new Request(`http://localhost/api/chat/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: "Who owns uploaded notes in this vault?",
          candidateNoteIds: [owned, cooked],
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      assistantMessage?: { citations?: { noteId: string }[]; sources?: { noteId: string }[] } | null;
      judgments?: {
        route: { type: string; choice: string; confidence?: number };
        context: { candidates: { include: { confidence?: number } }[] };
      };
      selectedNoteIds?: string[];
    };
    expect(payload.judgments?.route.type).toBe("choice");
    expect(["answer", "propose_edit", "none"]).toContain(payload.judgments?.route.choice);
    expect(payload.judgments?.context.candidates[0]?.include).not.toHaveProperty("confidence");
    const cited = payload.assistantMessage?.citations ?? [];
    if (payload.judgments?.route.choice === "none") {
      expect(payload.assistantMessage).toBeNull();
      return;
    }
    expect(cited.length).toBeGreaterThanOrEqual(1);
    for (const citation of cited) {
      expect([owned, cooked]).toContain(citation.noteId);
    }
    expect(payload.selectedNoteIds).toEqual(cited.map((citation) => citation.noteId));
    expect(payload.assistantMessage?.sources?.length).toBe(cited.length);
  }, 90_000);
});
