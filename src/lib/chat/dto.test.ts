import { describe, expect, it } from "vitest";
import {
  E5_CHAT_COLLECTION_PATH,
  E5_GATED_PATHS,
  E5_PROTECTED_API_ROUTES,
  e5ChatMessagesPath,
  e5ChatProposeEditPath,
  e5ChatThreadPath,
} from "@/lib/auth/e5-gate-paths";
import {
  CHAT_CONTEXT_MAX_NOTES,
  CHAT_CONTEXT_MAX_TOKENS,
  CHAT_FAIL_CLOSED_ERROR_CODES,
  CHAT_ROUTE_IDS,
  chatContextExceeded,
  chatContextLimitError,
  chatContextLimitSignal,
  chatErrorBody,
  type AssistantChatMessageDto,
  type ChatContextLimitDto,
  type ChatJudgmentsDto,
  type ChatNoulJudgmentDto,
  type ChatProposeEditOk,
  type ChatRouteJudgmentDto,
  type ChatScoreJudgmentDto,
  type ChatTurnOk,
  type CitationNoteLinkDto,
  type NoteEditDecisionDto,
  type NoteEditProposalDto,
} from "./dto";
import * as chatDto from "./dto";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type FailClosedCode = (typeof CHAT_FAIL_CLOSED_ERROR_CODES)[number];

type ForbiddenChatKeys =
  | "fallback"
  | "keywordFallback"
  | "keywordScore"
  | "heuristic"
  | "heuristicRoute"
  | "applied"
  | "appliedNote"
  | "writtenNote"
  | "reverified"
  | "llmVerified";

type AssertNoForbidden<T> = Extract<keyof T, ForbiddenChatKeys> extends never ? true : never;

type NoulKeys = keyof ChatNoulJudgmentDto;
type AssertNoulHasNoConfidence = "confidence" extends NoulKeys ? never : true;

type SourcesNonEmpty = AssistantChatMessageDto["sources"] extends readonly [
  CitationNoteLinkDto,
  ...CitationNoteLinkDto[],
]
  ? readonly [] extends AssistantChatMessageDto["sources"]
    ? never
    : true
  : never;

type ProposalKeys = keyof NoteEditProposalDto;
type NoDirectWriteOnProposal = Extract<
  ProposalKeys,
  "applied" | "appliedNote" | "writtenNote" | "mutation"
> extends never
  ? true
  : never;

type DecisionKeys = keyof NoteEditDecisionDto;
type DecisionIsNotAWrite = Extract<
  DecisionKeys,
  "applied" | "note" | "body" | "title"
> extends never
  ? true
  : never;

const failClosedCodesMatch: Equal<FailClosedCode, "jev_error" | "key_missing" | "context_limit"> =
  true;
const routeIdsMatch: Equal<(typeof CHAT_ROUTE_IDS)[number], "answer" | "propose_edit" | "none"> =
  true;
const noForbiddenOnTurn: AssertNoForbidden<ChatTurnOk> = true;
const noForbiddenOnProposal: AssertNoForbidden<NoteEditProposalDto> = true;
const noForbiddenOnJudgments: AssertNoForbidden<ChatJudgmentsDto> = true;
const noulHasNoConfidence: AssertNoulHasNoConfidence = true;
const sourcesNonEmpty: SourcesNonEmpty = true;
const proposalHasNoWrite: NoDirectWriteOnProposal = true;
const decisionIsNotAWrite: DecisionIsNotAWrite = true;

const route: ChatRouteJudgmentDto = {
  type: "choice",
  choice: "answer",
  probabilities: { answer: 0.86, propose_edit: 0.1, none: 0.04 },
  confidence: 0.74,
};

const include: ChatNoulJudgmentDto = { type: "noul", noul: 0.91 };

const relevance: ChatScoreJudgmentDto = {
  type: "score",
  score: 2.6,
  legend: {
    "0": "Does not help answer",
    "1": "Mentions the topic",
    "2": "Useful context",
    "3": "Directly answers",
  },
  probabilities: { "0": 0.02, "1": 0.08, "2": 0.18, "3": 0.72 },
  confidence: 0.7,
};

const source: CitationNoteLinkDto = { noteId: "note-1", title: "Ownership" };

function assistantMessage(): AssistantChatMessageDto {
  return {
    id: "msg-2",
    threadId: "thread-1",
    role: "assistant",
    body: "You own your notes.",
    createdAt: "2026-09-22T00:01:00.000Z",
    sources: [source],
  };
}

function proposal(): NoteEditProposalDto {
  return {
    proposalId: "proposal-1",
    threadId: "thread-1",
    messageId: "msg-2",
    noteId: "note-1",
    proposedTitle: "Ownership",
    proposedBody: "You own your notes.",
    status: "pending_approval",
  };
}

function turnEnvelope(): ChatTurnOk {
  return {
    ok: true,
    threadId: "thread-1",
    userMessage: {
      id: "msg-1",
      threadId: "thread-1",
      role: "user",
      body: "Who owns uploaded notes?",
      createdAt: "2026-09-22T00:00:00.000Z",
    },
    judgments: {
      route,
      context: {
        candidates: [{ noteId: "note-1", include, relevance }],
        selectedNoteIds: ["note-1"],
      },
    },
    contextLimit: chatContextLimitSignal(1, 400),
    assistantMessage: assistantMessage(),
    proposal: null,
  };
}

describe("E5 chat DTO seat", () => {
  it("keeps Choice confidence distinct from Noul and requires citation links", () => {
    expect(failClosedCodesMatch).toBe(true);
    expect(routeIdsMatch).toBe(true);
    expect(noForbiddenOnTurn).toBe(true);
    expect(noForbiddenOnProposal).toBe(true);
    expect(noForbiddenOnJudgments).toBe(true);
    expect(noulHasNoConfidence).toBe(true);
    expect(sourcesNonEmpty).toBe(true);
    expect(proposalHasNoWrite).toBe(true);
    expect(decisionIsNotAWrite).toBe(true);

    const turn = turnEnvelope();
    expect(turn.judgments.route.confidence).toBe(0.74);
    expect(turn.judgments.route.probabilities[turn.judgments.route.choice]).toBe(0.86);
    expect(turn.judgments.context.candidates[0]?.include).toEqual({ type: "noul", noul: 0.91 });
    expect(turn.judgments.context.candidates[0]?.include).not.toHaveProperty("confidence");
    expect(turn.judgments.context.candidates[0]?.relevance.type).toBe("score");
    expect(turn.judgments.context.candidates[0]?.relevance.confidence).toBe(0.7);
    expect(turn.assistantMessage?.sources).toEqual([source]);
    expect(turn.assistantMessage?.sources[0]?.noteId).toBe("note-1");
    expect(CHAT_ROUTE_IDS).toEqual(["answer", "propose_edit", "none"]);
  });

  it("signals the 10-note and 32k context caps and fails closed when either is over", () => {
    const within = chatContextLimitSignal(CHAT_CONTEXT_MAX_NOTES, CHAT_CONTEXT_MAX_TOKENS);
    const overNotes = chatContextLimitSignal(CHAT_CONTEXT_MAX_NOTES + 1, 100);
    const overTokens = chatContextLimitSignal(1, CHAT_CONTEXT_MAX_TOKENS + 1);
    expect(within).toEqual({
      maxNotes: 10,
      maxTokens: 32_000,
      noteCount: 10,
      tokenCount: 32_000,
    });
    expect(chatContextExceeded(within)).toBe(false);
    expect(chatContextExceeded(overNotes)).toBe(true);
    expect(chatContextExceeded(overTokens)).toBe(true);

    const limited = chatContextLimitError(overNotes);
    const asLimit: ChatContextLimitDto = limited.contextLimit;
    expect(limited).toEqual({
      ok: false,
      code: "context_limit",
      contextLimit: asLimit,
    });
    expect(CHAT_CONTEXT_MAX_NOTES).toBe(10);
    expect(CHAT_CONTEXT_MAX_TOKENS).toBe(32_000);
  });

  it("reports Jev and key failure as explicit error codes", () => {
    expect(CHAT_FAIL_CLOSED_ERROR_CODES).toEqual(["jev_error", "key_missing", "context_limit"]);
    expect(chatErrorBody("jev_error")).toEqual({ ok: false, code: "jev_error" });
    expect(chatErrorBody("key_missing")).toEqual({ ok: false, code: "key_missing" });
    expect(chatErrorBody("unauthorized")).toEqual({ ok: false, code: "unauthorized" });
    expect(Object.keys(chatDto).sort()).toEqual(
      [
        "CHAT_CONTEXT_MAX_NOTES",
        "CHAT_CONTEXT_MAX_TOKENS",
        "CHAT_FAIL_CLOSED_ERROR_CODES",
        "CHAT_ROUTE_IDS",
        "chatContextExceeded",
        "chatContextLimitError",
        "chatContextLimitSignal",
        "chatErrorBody",
      ].sort(),
    );
  });

  it("carries a pending note-edit proposal and no write export", () => {
    const pending = proposal();
    const envelope: ChatProposeEditOk = { ok: true, proposal: pending };
    const decision: NoteEditDecisionDto = { proposalId: pending.proposalId, decision: "approve" };
    expect(envelope.proposal.status).toBe("pending_approval");
    expect(decision).toEqual({ proposalId: "proposal-1", decision: "approve" });
    expect(pending.proposedTitle).toBe("Ownership");
    expect(E5_CHAT_COLLECTION_PATH).toBe("/api/chat");
    expect(e5ChatThreadPath("thread-id")).toBe("/api/chat/thread-id");
    expect(e5ChatMessagesPath("thread-id")).toBe("/api/chat/thread-id/messages");
    expect(e5ChatProposeEditPath("thread-id")).toBe("/api/chat/thread-id/propose-edit");
    expect([...E5_GATED_PATHS]).toEqual(["/chat", ...E5_PROTECTED_API_ROUTES]);
  });
});
