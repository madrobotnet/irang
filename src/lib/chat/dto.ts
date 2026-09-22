/**
 * E5 chat envelopes (DTO seat only).
 *
 * Shapes follow TypeSafe Judgment answers:
 * - Choice: `choice`, `probabilities`, `confidence`
 * - Score: `score`, `legend`, `probabilities`, `confidence`
 * - Noul: `noul` (probability of yes). No confidence field.
 *
 * Confidence summarizes how peaked a Choice or Score distribution is.
 * It is not a Noul probability and not permission to act.
 *
 * Store Jev output as returned. Do not add a second model pass that
 * re-verifies the judgment. Codex generation and note writes are outside
 * this module.
 *
 * TypeSafe or key failure is `ChatErrorBody`. Server-canonical codes
 * (Ada lock) are `typesafe_misconfigured` and `judgment_failed`.
 * `key_missing` and `jev_error` remain accepted aliases for those cases.
 * Over-budget context is `context_limit`. There is no keyword or heuristic
 * success variant and no silent fallback field.
 *
 * `typesafe_misconfigured` and its alias `key_missing` mean `TYPESAFE_API_KEY`
 * is absent or blank for the second-brain environment. The key value is never
 * part of an envelope.
 */

/** Hard cap for notes placed in one chat turn's context. */
export const CHAT_CONTEXT_MAX_NOTES = 10 as const;

/** Hard cap for context size on one chat turn (tokens). */
export const CHAT_CONTEXT_MAX_TOKENS = 32_000 as const;

/**
 * Closed Choice set for auto-routing a chat turn.
 * `none` is the no-match outcome. Generation stays with Codex.
 * A note change is `propose_edit` only — this set has no write route.
 */
export const CHAT_ROUTE_IDS = ["answer", "propose_edit", "none"] as const;

export type ChatRouteId = (typeof CHAT_ROUTE_IDS)[number];

/** Choice answer. Confidence is distribution concentration, not a second judgment. */
export type ChatChoiceJudgmentDto<Option extends string = string> = {
  type: "choice";
  /** Highest-probability option. */
  choice: Option;
  /** Option → probability. Floats that sum to 1. */
  probabilities: Record<Option, number>;
  /** 0–1, derived from `probabilities`. */
  confidence: number;
};

/** Score answer. Confidence is distribution concentration, not a second judgment. */
export type ChatScoreJudgmentDto = {
  type: "score";
  /** Probability-weighted position. May fall between levels. */
  score: number;
  /** Level index (string) → description. */
  legend: Record<string, string>;
  /** Level index → probability. Floats that sum to 1. */
  probabilities: Record<string, number>;
  /** 0–1, derived from `probabilities`. */
  confidence: number;
};

/** Noul answer. Probability of yes. No separate confidence. */
export type ChatNoulJudgmentDto = {
  type: "noul";
  /** 0–1. Near 0.5 is yes/no uncertainty, not medium intensity. */
  noul: number;
};

/** Jev Choice over `CHAT_ROUTE_IDS`. Stored as returned. */
export type ChatRouteJudgmentDto = ChatChoiceJudgmentDto<ChatRouteId>;

/**
 * One candidate note judged for context.
 * `include` is a Noul (several notes may apply).
 * `relevance` is a Score of how well the note serves the question.
 * Neither field is a keyword score.
 */
export type ChatContextCandidateDto = {
  noteId: string;
  include: ChatNoulJudgmentDto;
  relevance: ChatScoreJudgmentDto;
};

/**
 * Context selection for one turn.
 * Candidates are retrieved in code. Jev judges them; `selectedNoteIds`
 * is the code selection from those judgments, capped by the context limit.
 */
export type ChatContextSelectionDto = {
  candidates: ChatContextCandidateDto[];
  selectedNoteIds: string[];
};

/** Routing Choice plus context-selection judgments for one turn. */
export type ChatJudgmentsDto = {
  route: ChatRouteJudgmentDto;
  context: ChatContextSelectionDto;
};

/**
 * Context-limit signal. Counts at or under the caps are in budget.
 * A turn over either cap uses `context_limit` instead of a truncated success.
 */
export type ChatContextLimitDto = {
  maxNotes: typeof CHAT_CONTEXT_MAX_NOTES;
  maxTokens: typeof CHAT_CONTEXT_MAX_TOKENS;
  noteCount: number;
  tokenCount: number;
};

export type ChatThreadDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type UserChatMessageDto = {
  id: string;
  threadId: string;
  role: "user";
  body: string;
  createdAt: string;
};

/** Required note link on an assistant reply. */
export type CitationNoteLinkDto = {
  noteId: string;
  title: string;
};

/**
 * Codex reply seat. `sources` is required and non-empty: an assistant
 * reply without a note link is not this type.
 */
export type AssistantChatMessageDto = {
  id: string;
  threadId: string;
  role: "assistant";
  body: string;
  createdAt: string;
  sources: readonly [CitationNoteLinkDto, ...CitationNoteLinkDto[]];
};

export type ChatMessageDto = UserChatMessageDto | AssistantChatMessageDto;

/** `GET /api/chat` success. */
export type ChatThreadListOk = {
  ok: true;
  threads: ChatThreadDto[];
  nextCursor: string | null;
};

/** `GET /api/chat/:threadId` success. */
export type ChatThreadOk = {
  ok: true;
  thread: ChatThreadDto;
};

/** `GET /api/chat/:threadId/messages` success. */
export type ChatMessageListOk = {
  ok: true;
  threadId: string;
  messages: ChatMessageDto[];
  nextCursor: string | null;
};

/**
 * One completed turn. Judgments are stored as Jev returned them.
 * `assistantMessage` is present when Codex produced a reply.
 * `proposal` is present for `propose_edit` and is not a note write.
 */
export type ChatTurnOk = {
  ok: true;
  threadId: string;
  userMessage: UserChatMessageDto;
  judgments: ChatJudgmentsDto;
  contextLimit: ChatContextLimitDto;
  assistantMessage: AssistantChatMessageDto | null;
  proposal: NoteEditProposalDto | null;
};

/**
 * Proposed note text. Status stays pending until a person approves.
 * This seat has no applied note and no write result.
 */
export type NoteEditProposalDto = {
  proposalId: string;
  threadId: string;
  messageId: string;
  noteId: string;
  proposedTitle: string;
  proposedBody: string;
  status: "pending_approval";
};

/**
 * Human decision on a proposal. `approve` records permission for a later
 * note write outside this type. This object does not mutate a note.
 */
export type NoteEditDecisionDto = {
  proposalId: string;
  decision: "approve" | "reject";
};

/** `POST /api/chat/:threadId/propose-edit` success. */
export type ChatProposeEditOk = {
  ok: true;
  proposal: NoteEditProposalDto;
};

/** `POST /api/chat` body. */
export type CreateChatThreadBody = {
  title: string;
};

/**
 * `POST /api/chat/:threadId/messages` body.
 * `candidateNoteIds` are retrieved notes (for example search `evidence` ids).
 * The list is not a rank and not a keyword fallback.
 */
export type CreateChatMessageBody = {
  body: string;
  candidateNoteIds?: string[];
};

/** `POST /api/chat/:threadId/propose-edit` body. Does not write the note. */
export type CreateNoteEditProposalBody = {
  noteId: string;
  messageId: string;
  proposedTitle: string;
  proposedBody: string;
};

/**
 * Ada lock. Rex chat responses use these strings.
 * `typesafe_misconfigured` is a missing or blank key (503).
 * `judgment_failed` is a System One call failure (502).
 */
export type ChatServerCanonicalErrorCode = "typesafe_misconfigured" | "judgment_failed";

export const CHAT_SERVER_CANONICAL_ERROR_CODES = [
  "typesafe_misconfigured",
  "judgment_failed",
] as const satisfies readonly ChatServerCanonicalErrorCode[];

/**
 * Alias for server-canonical `judgment_failed`.
 * Callers show the error. They do not route or pick context another way.
 */
export type ChatJevErrorCode = "jev_error";

/**
 * Alias for server-canonical `typesafe_misconfigured`.
 * Callers show the error. They do not call Jev or Codex without a key.
 */
export type ChatKeyErrorCode = "key_missing";

/** Selected context is over 10 notes or 32k tokens. */
export type ChatContextLimitErrorCode = "context_limit";

/** Canonical codes plus the older aliases. `context_limit` stays its own case. */
export type ChatFailClosedErrorCode =
  | ChatServerCanonicalErrorCode
  | ChatJevErrorCode
  | ChatKeyErrorCode
  | ChatContextLimitErrorCode;

export const CHAT_FAIL_CLOSED_ERROR_CODES = [
  "typesafe_misconfigured",
  "judgment_failed",
  "jev_error",
  "key_missing",
  "context_limit",
] as const satisfies readonly ChatFailClosedErrorCode[];

export type ChatErrorCode = ChatFailClosedErrorCode | "validation" | "unauthorized";

export type ChatContextLimitErrorBody = {
  ok: false;
  code: "context_limit";
  contextLimit: ChatContextLimitDto;
};

export type ChatErrorBody =
  | {
      ok: false;
      code: Exclude<ChatErrorCode, "context_limit">;
    }
  | ChatContextLimitErrorBody;

export type ChatThreadsResponse = ChatThreadListOk | ChatErrorBody;

export type ChatThreadResponse = ChatThreadOk | ChatErrorBody;

export type ChatMessagesResponse = ChatMessageListOk | ChatErrorBody;

export type ChatTurnResponse = ChatTurnOk | ChatErrorBody;

export type ChatProposeEditResponse = ChatProposeEditOk | ChatErrorBody;

export function chatContextLimitSignal(
  noteCount: number,
  tokenCount: number,
): ChatContextLimitDto {
  return {
    maxNotes: CHAT_CONTEXT_MAX_NOTES,
    maxTokens: CHAT_CONTEXT_MAX_TOKENS,
    noteCount,
    tokenCount,
  };
}

/** True when note count or token count is over the chat context cap. */
export function chatContextExceeded(
  signal: Pick<ChatContextLimitDto, "noteCount" | "tokenCount">,
): boolean {
  return (
    signal.noteCount > CHAT_CONTEXT_MAX_NOTES || signal.tokenCount > CHAT_CONTEXT_MAX_TOKENS
  );
}

export function chatErrorBody(
  code: Exclude<ChatErrorCode, "context_limit">,
): ChatErrorBody {
  return { ok: false, code };
}

export function chatContextLimitError(
  contextLimit: ChatContextLimitDto,
): ChatContextLimitErrorBody {
  return { ok: false, code: "context_limit", contextLimit };
}
