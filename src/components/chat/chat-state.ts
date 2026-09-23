import type { ChatContextLimitDto, ChatThreadDto } from "@/lib/chat/dto";
import type { JevUiState } from "@/lib/jev/jev-state";
import type { ChatMessageView, ParsedTurn, ProposalView } from "./parse";
import { candidateNoteIds, type ChatQuery, type ChatScope } from "./scope";

export type ChatSurface =
  | "idle"
  | "loading"
  | "streaming"
  | "done"
  | "error"
  | "approving"
  | "context_limit"
  | "jev_error"
  | "key_missing"
  | "jev_low_confidence";

export type ChatModel = {
  scope: ChatScope;
  evidenceIds: string[];
  selectedIds: string[];
  currentNoteId: string | null;
  threads: ChatThreadDto[];
  threadsReady: boolean;
  activeThreadId: string | null;
  messages: ChatMessageView[];
  draft: string;
  surface: ChatSurface;
  jev: JevUiState;
  contextLimit: ParsedTurn["contextLimit"];
  activeCitation: number | null;
  citationMessageId: string | null;
  citationsOpen: boolean;
  proposal: ProposalView | null;
  selectedTags: string[];
  approvalPending: boolean;
  approvalError: boolean;
  lastQuestion: string | null;
  routeLabel: string | null;
  partial: string;
};

export function initialChatModel(query: ChatQuery): ChatModel {
  return {
    scope: query.scope,
    evidenceIds: query.evidenceIds,
    selectedIds: query.selectedIds,
    currentNoteId: query.currentNoteId,
    threads: [],
    threadsReady: false,
    activeThreadId: null,
    messages: [],
    draft: "",
    surface: "idle",
    jev: "jev_ready",
    contextLimit: null,
    activeCitation: null,
    citationMessageId: null,
    citationsOpen: true,
    proposal: null,
    selectedTags: [],
    approvalPending: false,
    approvalError: false,
    lastQuestion: null,
    routeLabel: null,
    partial: "",
  };
}

export type ChatFailReason = "jev_error" | "key_missing" | "context_limit" | "error" | "unauthorized";

export type ChatEvent =
  | { type: "query"; query: ChatQuery }
  | { type: "scope"; scope: ChatScope }
  | { type: "draft"; value: string }
  | { type: "threads"; threads: ChatThreadDto[] }
  | { type: "threads_quiet" }
  | { type: "select_thread"; threadId: string }
  | { type: "messages"; threadId: string; messages: ChatMessageView[] }
  | { type: "new_thread" }
  | { type: "thread_created"; thread: ChatThreadDto }
  | { type: "begin"; question: string }
  | { type: "delta"; delta: string }
  | { type: "turn"; turn: ParsedTurn }
  | { type: "fail"; reason: ChatFailReason; contextLimit?: ChatContextLimitDto | null }
  | { type: "retry" }
  | { type: "focus_citation"; messageId: string; index: number }
  | { type: "toggle_citations" }
  | { type: "open_proposal" }
  | { type: "cancel_approval" }
  | { type: "toggle_tag"; tag: string }
  | { type: "approval_pending" }
  | { type: "approval_fail" }
  | { type: "approval_ok" };

function routeLabel(choice: ParsedTurn["judgments"]["route"]["choice"]): string | null {
  if (choice === "answer") return "채팅";
  if (choice === "propose_edit") return "노트 수정";
  return null;
}

function jevFor(turn: ParsedTurn): JevUiState {
  return turn.lowConfidence ? "jev_low_confidence" : "jev_ready";
}

function surfaceFor(turn: ParsedTurn, approving: boolean): ChatSurface {
  if (approving) return "approving";
  if (turn.lowConfidence) return "jev_low_confidence";
  return "done";
}

function localProposal(turn: ParsedTurn): ProposalView | null {
  if (turn.proposal) return turn.proposal;
  if (turn.judgments.route.choice !== "propose_edit" || !turn.assistantMessage) return null;
  const source = turn.assistantMessage.citations[0];
  if (!source) return null;
  return {
    proposalId: null,
    threadId: turn.threadId,
    messageId: turn.assistantMessage.id,
    noteId: source.noteId,
    proposedTitle: source.title,
    proposedBody: turn.assistantMessage.body,
    tags: [],
  };
}

function withoutStream(messages: ChatMessageView[]): ChatMessageView[] {
  return messages.filter((message) => !message.id.startsWith("local-"));
}

export function chatReducer(model: ChatModel, event: ChatEvent): ChatModel {
  switch (event.type) {
    case "query":
      return {
        ...model,
        scope: event.query.scope,
        evidenceIds: event.query.evidenceIds,
        selectedIds: event.query.selectedIds,
        currentNoteId: event.query.currentNoteId,
      };
    case "scope":
      return { ...model, scope: event.scope };
    case "draft":
      return { ...model, draft: event.value };
    case "threads":
      return { ...model, threads: event.threads, threadsReady: true };
    case "threads_quiet":
      return { ...model, threadsReady: true };
    case "select_thread":
      return {
        ...model,
        activeThreadId: event.threadId,
        surface: "loading",
        messages: [],
        partial: "",
        proposal: null,
        approvalError: false,
        routeLabel: null,
        activeCitation: null,
        citationMessageId: null,
      };
    case "messages":
      if (model.activeThreadId !== event.threadId) return model;
      return {
        ...model,
        messages: event.messages,
        surface: event.messages.length === 0 ? "idle" : "done",
        partial: "",
        jev: "jev_ready",
      };
    case "new_thread":
      return {
        ...model,
        activeThreadId: null,
        messages: [],
        draft: "",
        surface: "idle",
        partial: "",
        proposal: null,
        approvalError: false,
        approvalPending: false,
        routeLabel: null,
        contextLimit: null,
        activeCitation: null,
        citationMessageId: null,
        lastQuestion: null,
        jev: "jev_ready",
      };
    case "thread_created":
      return {
        ...model,
        activeThreadId: event.thread.id,
        threads: [event.thread, ...model.threads.filter((thread) => thread.id !== event.thread.id)],
      };
    case "begin":
      return {
        ...model,
        draft: "",
        lastQuestion: event.question,
        surface: "streaming",
        partial: "",
        approvalError: false,
        proposal: null,
        jev: "jev_ready",
        messages: [
          ...withoutStream(model.messages),
          {
            id: "local-user",
            threadId: model.activeThreadId ?? "",
            role: "user",
            body: event.question,
            createdAt: "",
            citations: [],
          },
        ],
      };
    case "delta":
      if (model.surface !== "streaming") return model;
      return { ...model, partial: model.partial + event.delta };
    case "turn": {
      const proposal = localProposal(event.turn);
      const approving = proposal !== null;
      const assistant = event.turn.assistantMessage;
      return {
        ...model,
        activeThreadId: event.turn.threadId,
        messages: [...withoutStream(model.messages), event.turn.userMessage, ...(assistant ? [assistant] : [])],
        partial: "",
        surface: surfaceFor(event.turn, approving),
        jev: jevFor(event.turn),
        contextLimit: event.turn.contextLimit,
        proposal,
        selectedTags: [],
        approvalPending: false,
        approvalError: false,
        routeLabel: routeLabel(event.turn.judgments.route.choice),
        citationMessageId: assistant?.id ?? null,
        activeCitation: null,
      };
    }
    case "fail": {
      const surface: ChatSurface =
        event.reason === "jev_error"
          ? "jev_error"
          : event.reason === "key_missing"
            ? "key_missing"
            : event.reason === "context_limit"
              ? "context_limit"
              : "error";
      const jev: JevUiState =
        event.reason === "jev_error" ? "jev_error" : event.reason === "key_missing" ? "key_missing" : model.jev;
      return {
        ...model,
        surface,
        jev,
        partial: "",
        proposal: null,
        approvalPending: false,
        routeLabel: null,
        contextLimit: event.reason === "context_limit" ? (event.contextLimit ?? null) : model.contextLimit,
      };
    }
    case "focus_citation":
      return {
        ...model,
        citationMessageId: event.messageId,
        activeCitation: event.index,
        citationsOpen: true,
      };
    case "toggle_citations":
      return { ...model, citationsOpen: !model.citationsOpen };
    case "open_proposal":
      if (!model.proposal) return model;
      return { ...model, surface: "approving", approvalError: false };
    case "cancel_approval":
      return {
        ...model,
        surface: model.jev === "jev_low_confidence" ? "jev_low_confidence" : "done",
        approvalPending: false,
        approvalError: false,
      };
    case "toggle_tag": {
      const selectedTags = model.selectedTags.includes(event.tag)
        ? model.selectedTags.filter((tag) => tag !== event.tag)
        : [...model.selectedTags, event.tag];
      return { ...model, selectedTags };
    }
    case "approval_pending":
      return { ...model, approvalPending: true, approvalError: false, surface: "approving" };
    case "approval_fail":
      return { ...model, approvalPending: false, approvalError: true, surface: "approving" };
    case "approval_ok":
      return {
        ...model,
        approvalPending: false,
        approvalError: false,
        surface: model.jev === "jev_low_confidence" ? "jev_low_confidence" : "done",
      };
    case "retry":
      return model;
    default:
      return model;
  }
}

export function scopeQuery(model: ChatModel): ChatQuery {
  return {
    scope: model.scope,
    evidenceIds: model.evidenceIds,
    selectedIds: model.selectedIds,
    currentNoteId: model.currentNoteId,
  };
}

export function messageCandidateIds(model: ChatModel): string[] | undefined {
  return candidateNoteIds(scopeQuery(model));
}

export function citationMessage(model: ChatModel): ChatMessageView | null {
  if (model.citationMessageId) {
    const focused = model.messages.find((message) => message.id === model.citationMessageId);
    if (focused?.role === "assistant") return focused;
  }
  for (let i = model.messages.length - 1; i >= 0; i -= 1) {
    const message = model.messages[i];
    if (message?.role === "assistant") return message;
  }
  return null;
}
