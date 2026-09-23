import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { chatContextLimitSignal } from "@/lib/chat/dto";
import { CHAT_COPY } from "./copy";
import { initialChatModel, type ChatModel } from "./chat-state";
import { ChatView, type ChatViewProps } from "./ChatView";
import { readChatQuery } from "./scope";

function view(model: ChatModel) {
  const props: ChatViewProps = {
    model,
    onScope: () => {},
    onDraft: () => {},
    onSend: () => {},
    onRetry: () => {},
    onSelectThread: () => {},
    onNewThread: () => {},
    onCite: () => {},
    onPromote: () => {},
    onOpenProposal: () => {},
    onSwipeCitations: () => {},
    onToggleTag: () => {},
    onApprove: () => {},
    onCancelApproval: () => {},
  };
  return renderToStaticMarkup(<ChatView {...props} />);
}

describe("ChatView", () => {
  it("renders the idle chat screen with scope, Codex, and an empty citation panel", () => {
    const html = view(initialChatModel(readChatQuery(new URLSearchParams())));
    expect(html).toContain('data-chat-state="idle"');
    expect(html).toContain(CHAT_COPY.empty);
    expect(html).toContain(CHAT_COPY.emptyHint);
    expect(html).toContain(CHAT_COPY.send);
    expect(html).toContain('data-model="codex"');
    expect(html).toContain(CHAT_COPY.citations);
    expect(html).toContain(CHAT_COPY.noCitations);
    expect(html).toContain("근거(0)");
    expect(html).toContain('data-scope="all"');
    expect(html).toContain('data-jev-on="true"');
    expect(html).toContain("Jev");
    expect(html).not.toContain("P1 준비 중");
    expect(html).not.toContain('data-ai-approve="open"');
  });

  it("links inline marks to a source note", () => {
    const model = initialChatModel(readChatQuery(new URLSearchParams("evidence=note-1")));
    model.surface = "done";
    model.messages = [
      {
        id: "user-1",
        threadId: "thread-1",
        role: "user",
        body: "소유권은?",
        createdAt: "",
        citations: [],
      },
      {
        id: "assistant-1",
        threadId: "thread-1",
        role: "assistant",
        body: "소유권은 이쪽입니다 [1]",
        createdAt: "",
        citations: [
          {
            index: 1,
            noteId: "note-1",
            title: "소유권",
            path: "notes/note-1",
            snippet: "내 노트",
            confidence: 0.82,
          },
        ],
      },
    ];
    model.citationMessageId = "assistant-1";
    model.activeCitation = 1;
    const html = view(model);
    expect(html).toContain('data-cite="1"');
    expect(html).toContain('data-source-link="note-1"');
    expect(html).toContain('href="/notes?note=note-1"');
    expect(html).toContain("notes/note-1");
    expect(html).toContain("내 노트");
    expect(html).toContain("82%");
    expect(html).toContain('data-promote="new-note"');
    expect(html).not.toContain('data-ai-approve="open"');
  });

  it("shows jev_error as a banner and does not keep a guessed answer", () => {
    const model = initialChatModel(readChatQuery(new URLSearchParams()));
    model.surface = "jev_error";
    model.jev = "jev_error";
    model.messages = [
      {
        id: "user-1",
        threadId: "thread-1",
        role: "user",
        body: "관련 노트 찾아줘",
        createdAt: "",
        citations: [],
      },
    ];
    const html = view(model);
    expect(html).toContain(CHAT_COPY.jevErrorRetry);
    expect(html).toContain('data-jev-on="false"');
    expect(html).not.toContain("키워드");
    expect(html).not.toContain('data-message-role="assistant"');
  });

  it("shows key_missing and context_limit copy", () => {
    const missing = initialChatModel(readChatQuery(new URLSearchParams()));
    missing.surface = "key_missing";
    missing.jev = "key_missing";
    expect(view(missing)).toContain("검색(Jev) 키가 없어요 · 운영 키 필요");

    const limited = initialChatModel(readChatQuery(new URLSearchParams()));
    limited.surface = "context_limit";
    limited.contextLimit = chatContextLimitSignal(11, 100);
    limited.messages = [
      {
        id: "user-1",
        threadId: "thread-1",
        role: "user",
        body: "질문",
        createdAt: "",
        citations: [],
      },
    ];
    const html = view(limited);
    expect(html).toContain(CHAT_COPY.contextLimit);
    expect(html).not.toContain('data-message-role="assistant"');
  });

  it("puts tag chips inside the approve modal and keeps promote outside it", () => {
    const model = initialChatModel(readChatQuery(new URLSearchParams()));
    model.surface = "approving";
    model.messages = [
      {
        id: "assistant-1",
        threadId: "thread-1",
        role: "assistant",
        body: "고칠까요",
        createdAt: "",
        citations: [],
      },
    ];
    model.proposal = {
      proposalId: "proposal-1",
      threadId: "thread-1",
      messageId: "assistant-1",
      noteId: "note-1",
      proposedTitle: "소유권",
      proposedBody: "고친 본문",
      tags: [{ tag: "법", probability: 0.8 }],
    };
    const html = view(model);
    expect(html).toContain('data-ai-approve="open"');
    expect(html).toContain(CHAT_COPY.approve);
    expect(html).toContain(CHAT_COPY.cancel);
    expect(html).toContain("법");
    expect(html).toContain("고친 본문");
    expect(html).toContain('data-promote="new-note"');
  });
});
