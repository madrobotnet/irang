import { aiLogExpiry, chatContextBudget } from "@/domain/chat/limits";
import { CitationsRequiredError } from "@/domain/chat/errors";
import { selectChatNotes } from "@/domain/chat/select";
import type { StoredCitation } from "@/domain/chat/types";
import { buildSnippet } from "@/domain/search/snippet";
import type { SearchSourceDoc } from "@/domain/search/types";
import {
  chatContextExceeded,
  type ChatJudgmentsDto,
  type ChatTurnOk,
  type NoteEditDecisionDto,
  type NoteEditProposalDto,
} from "@/lib/chat/dto";
import type { NoteRecord } from "@/domain/notes/types";
import { getNotesStore } from "../notes/runtime";
import { notifySearchCorpusChanged } from "../search/hooks";
import { retrieveSearchCandidates } from "../search/service";
import { SearchIndexUnavailableError } from "../search/runtime";
import { judgmentsForInboxSuggestion } from "../notes/capture-enrichment";
import { getSystemOneInvoker } from "../typesafe/runtime";
import { getCodexGenerator, maybeOrganize, type CodexTurnResult } from "./codex";
import {
  ChatNotFoundError,
  ChatValidationError,
  CodexFailedError,
  ContextLimitFailure,
  ProposalNotPendingError,
} from "./errors";
import { judgeChatTurn } from "./judgments";
import type { ChatStore } from "./ports";
import { getChatStore } from "./runtime";
import {
  toContractProposal,
  toKaiProposal,
  toMessageWire,
  toThreadWire,
  type WireAssistantMessage,
  type WireContractProposal,
  type WireMessage,
  type WireThread,
  type WireUserMessage,
} from "./wire";

const MAX_CANDIDATES = 20;
const RECENT_MESSAGE_LIMIT = 20;

export type ChatTurnWire = ChatTurnOk & {
  routing: ChatTurnOk["judgments"]["route"];
  selectedNoteIds: string[];
  userMessage: WireUserMessage;
  assistantMessage: WireAssistantMessage | null;
};

const PROMPT_MARKER = "CODEX_PROMPT_SECRET";

async function purgeExpiredLogs(store: ChatStore): Promise<void> {
  await store.purgeAiLogs(aiLogExpiry(new Date()));
}

async function loadCandidateNotes(
  query: string,
  candidateNoteIds: string[] | undefined,
): Promise<SearchSourceDoc[]> {
  if (candidateNoteIds && candidateNoteIds.length > 0) {
    if (candidateNoteIds.length > MAX_CANDIDATES) {
      throw new ChatValidationError();
    }
    const notes = await getNotesStore();
    const docs: SearchSourceDoc[] = [];
    for (const id of candidateNoteIds) {
      const note = await notes.getNoteById(id);
      if (!note || note.deletedAt) {
        throw new ChatValidationError();
      }
      docs.push({
        id: note.id,
        title: note.title,
        body: note.body,
        status: note.status,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      });
    }
    return docs;
  }
  try {
    return await retrieveSearchCandidates(query);
  } catch (error) {
    if (error instanceof SearchIndexUnavailableError) {
      throw error;
    }
    throw error;
  }
}

function citationsFor(
  selectedIds: readonly { noteId: string; title: string; excerpt: string }[],
  originals: readonly SearchSourceDoc[],
  query: string,
): StoredCitation[] {
  return selectedIds.map((selected) => {
    const source = originals.find((note) => note.id === selected.noteId);
    const title = source?.title ?? selected.title;
    const snippet = buildSnippet(title, source?.body ?? selected.excerpt, query);
    return {
      noteId: selected.noteId,
      title,
      ...(snippet ? { snippet } : {}),
    };
  });
}

function turnWire(input: {
  threadId: string;
  userMessage: WireUserMessage;
  judgments: ChatJudgmentsDto;
  contextLimit: ChatTurnOk["contextLimit"];
  assistantMessage: WireAssistantMessage | null;
  proposal: NoteEditProposalDto | null;
}): ChatTurnWire {
  return {
    ok: true,
    threadId: input.threadId,
    userMessage: input.userMessage,
    judgments: input.judgments,
    contextLimit: input.contextLimit,
    assistantMessage: input.assistantMessage,
    proposal: input.proposal,
    routing: input.judgments.route,
    selectedNoteIds: input.judgments.context.selectedNoteIds,
  };
}

export async function createChatThread(title: string | null): Promise<WireThread> {
  const store = await getChatStore();
  return toThreadWire(await store.createThread({ title }));
}

export async function listChatThreads(query: {
  limit: number;
  cursor?: string;
}): Promise<{ threads: WireThread[]; nextCursor: string | null }> {
  const store = await getChatStore();
  await purgeExpiredLogs(store);
  const page = await store.listThreads({ ...query, includeArchived: false });
  return { threads: page.threads.map(toThreadWire), nextCursor: page.nextCursor };
}

export async function getChatThread(id: string): Promise<{ thread: WireThread; messages: WireMessage[] } | null> {
  const store = await getChatStore();
  const thread = await store.getThread(id);
  if (!thread) {
    return null;
  }
  const messages = await store.listRecentMessages(id, RECENT_MESSAGE_LIMIT);
  return { thread: toThreadWire(thread), messages: messages.map(toMessageWire) };
}

export async function archiveChatThread(id: string): Promise<WireThread | null> {
  const store = await getChatStore();
  const thread = await store.archiveThread(id, new Date());
  return thread ? toThreadWire(thread) : null;
}

export async function listChatMessages(
  threadId: string,
  query: { limit: number; cursor?: string },
): Promise<{ threadId: string; messages: WireMessage[]; nextCursor: string | null } | null> {
  const store = await getChatStore();
  const thread = await store.getThread(threadId);
  if (!thread) {
    return null;
  }
  const page = await store.listMessages(threadId, query);
  return { threadId, messages: page.messages.map(toMessageWire), nextCursor: page.nextCursor };
}

export async function postChatMessage(
  threadId: string,
  input: { content: string; candidateNoteIds?: string[] },
): Promise<ChatTurnWire> {
  const store = await getChatStore();
  const thread = await store.getThread(threadId);
  if (!thread || thread.archivedAt) {
    throw new ChatNotFoundError();
  }
  const originals = await loadCandidateNotes(input.content, input.candidateNoteIds);
  const user = await store.createMessage({
    threadId,
    role: "user",
    content: input.content,
    citations: [],
    routing: null,
  });
  await store.touchThread(threadId, new Date());
  await purgeExpiredLogs(store);

  const judged = await judgeChatTurn(
    input.content,
    originals.map((note) => ({ id: note.id, title: note.title, body: note.body })),
  );
  const packed = selectChatNotes(judged.candidates, chatContextBudget());
  if (chatContextExceeded(packed.contextLimit)) {
    throw new ContextLimitFailure(packed.contextLimit);
  }
  const judgments: ChatJudgmentsDto = {
    route: judged.route,
    context: {
      candidates: judged.candidates.map((candidate) => ({
        noteId: candidate.noteId,
        include: candidate.include,
        relevance: candidate.relevance,
      })),
      selectedNoteIds: packed.selected.map((note) => note.noteId),
    },
  };
  const userMessage = toMessageWire(user);
  if (userMessage.role !== "user") {
    throw new ChatValidationError();
  }

  if (packed.selected.length < 1) {
    throw new CitationsRequiredError();
  }

  if (judged.route.choice === "none") {
    await store.writeAiLog({
      kind: "chat_turn",
      threadId,
      payload: {
        route: judged.route.choice,
        selectedNoteIds: judgments.context.selectedNoteIds,
        codexPrompt: `${PROMPT_MARKER}\n${input.content}`,
        response: "",
      },
    });
    return turnWire({
      threadId,
      userMessage,
      judgments,
      contextLimit: packed.contextLimit,
      assistantMessage: null,
      proposal: null,
    });
  }

  const codexNotes = packed.selected.map((note) => ({
    noteId: note.noteId,
    title: note.title,
    excerpt: note.excerpt,
  }));
  const codexPrompt = `${PROMPT_MARKER}\n${input.content}\n${codexNotes.map((note) => note.excerpt).join("\n")}`;
  let generated: CodexTurnResult;
  try {
    generated = await getCodexGenerator().generate({
      route: judged.route.choice,
      question: input.content,
      notes: codexNotes,
    });
  } catch (error) {
    if (error instanceof CodexFailedError) {
      throw error;
    }
    throw new CodexFailedError();
  }
  const text = generated.text.trim();
  if (!text) {
    throw new CodexFailedError("codex_empty");
  }
  if (judged.route.choice === "propose_edit" && !generated.proposal) {
    throw new CodexFailedError("codex_proposal");
  }
  const citations = citationsFor(packed.selected, originals, input.content);
  if (citations.length < 1) {
    throw new CitationsRequiredError();
  }
  const assistant = await store.createMessage({
    threadId,
    role: "assistant",
    content: text,
    citations,
    routing: judged.route,
  });
  const assistantMessage = toMessageWire(assistant);
  if (assistantMessage.role !== "assistant") {
    throw new CitationsRequiredError();
  }

  let proposal: NoteEditProposalDto | null = null;
  if (judged.route.choice === "propose_edit") {
    const draft = generated.proposal;
    const target = packed.selected[0];
    if (!draft || !target) {
      throw new CodexFailedError("codex_proposal");
    }
    const created = await store.createProposal({
      messageId: assistant.id,
      threadId,
      noteId: target.noteId,
      patch: { title: draft.title, body: draft.body },
    });
    proposal = toKaiProposal(created);
  }

  await store.writeAiLog({
    kind: "chat_turn",
    threadId,
    payload: {
      route: judged.route.choice,
      selectedNoteIds: judgments.context.selectedNoteIds,
      codexPrompt,
      response: text,
    },
  });

  return turnWire({
    threadId,
    userMessage,
    judgments,
    contextLimit: packed.contextLimit,
    assistantMessage,
    proposal,
  });
}

export async function createExplicitProposal(input: {
  threadId: string;
  noteId: string;
  messageId: string;
  proposedTitle: string;
  proposedBody: string;
}): Promise<NoteEditProposalDto> {
  const store = await getChatStore();
  const thread = await store.getThread(input.threadId);
  if (!thread) {
    throw new ChatNotFoundError();
  }
  const message = await store.getMessage(input.messageId);
  if (!message || message.threadId !== input.threadId) {
    throw new ChatNotFoundError();
  }
  const notes = await getNotesStore();
  const note = await notes.getNoteById(input.noteId);
  if (!note || note.deletedAt) {
    throw new ChatNotFoundError();
  }
  const proposal = await store.createProposal({
    messageId: message.id,
    threadId: thread.id,
    noteId: note.id,
    patch: { title: input.proposedTitle, body: input.proposedBody },
  });
  return toKaiProposal(proposal);
}

export async function listPendingProposals(status: "pending" | "approved" | "rejected" | "all"): Promise<WireContractProposal[]> {
  const store = await getChatStore();
  const rows = await store.listProposals({
    status: status === "all" ? undefined : status,
    limit: 100,
  });
  return rows.map(toContractProposal);
}

export async function approveChatProposal(id: string): Promise<{
  decision: NoteEditDecisionDto;
  proposal: WireContractProposal;
  note: NoteRecord;
}> {
  const store = await getChatStore();
  const existing = await store.getProposal(id);
  if (!existing) {
    throw new ChatNotFoundError();
  }
  if (existing.status !== "pending") {
    throw new ProposalNotPendingError();
  }
  const notes = await getNotesStore();
  const note = await notes.getNoteById(existing.noteId);
  if (!note || note.deletedAt) {
    throw new ChatNotFoundError();
  }
  const resolved = await store.resolveProposal(id, "approved", new Date());
  if (!resolved) {
    throw new ProposalNotPendingError();
  }
  try {
    const updated = await notes.updateNote(existing.noteId, {
      ...(existing.patch.title !== undefined ? { title: existing.patch.title } : {}),
      ...(existing.patch.body !== undefined ? { body: existing.patch.body } : {}),
    });
    if (!updated) {
      await store.reopenProposal(id);
      throw new ChatNotFoundError();
    }
    await notifySearchCorpusChanged();
    return {
      decision: { proposalId: id, decision: "approve" },
      proposal: toContractProposal(resolved),
      note: updated,
    };
  } catch (error) {
    if (!(error instanceof ChatNotFoundError)) {
      await store.reopenProposal(id);
    }
    throw error;
  }
}

export async function rejectChatProposal(id: string): Promise<{
  decision: NoteEditDecisionDto;
  proposal: WireContractProposal;
}> {
  const store = await getChatStore();
  const existing = await store.getProposal(id);
  if (!existing) {
    throw new ChatNotFoundError();
  }
  const resolved = await store.resolveProposal(id, "rejected", new Date());
  if (!resolved) {
    throw new ProposalNotPendingError();
  }
  return {
    decision: { proposalId: id, decision: "reject" },
    proposal: toContractProposal(resolved),
  };
}

export async function suggestManage(input: {
  noteId?: string;
  inboxItemId?: string;
}): Promise<{
  ok: true;
  tags: { tag: string; probability: number }[];
  classification: {
    choice: string;
    probability: number;
    confidence: number;
    probabilities: Record<string, number>;
  } | null;
  proposal: NoteEditProposalDto | null;
  organize: { title: string; body: string } | null;
}> {
  getSystemOneInvoker();
  if (!input.noteId && !input.inboxItemId) {
    throw new ChatValidationError();
  }
  const notes = await getNotesStore();
  let title = "";
  let body = "";
  let noteId: string | null = null;
  if (input.noteId) {
    const note = await notes.getNoteById(input.noteId);
    if (!note || note.deletedAt) {
      throw new ChatNotFoundError();
    }
    title = note.title;
    body = note.body;
    noteId = note.id;
  } else if (input.inboxItemId) {
    const item = await notes.getInboxItemById(input.inboxItemId);
    if (!item || item.discardedAt) {
      throw new ChatNotFoundError();
    }
    title = item.title;
    body = item.body;
  }
  const judged = await judgmentsForInboxSuggestion(title, body);
  let organize: { title: string; body: string } | null;
  try {
    organize = await maybeOrganize({ title, body });
  } catch (error) {
    if (error instanceof CodexFailedError) {
      throw error;
    }
    throw new CodexFailedError();
  }
  let proposal: NoteEditProposalDto | null = null;
  if (organize && noteId) {
    const store = await getChatStore();
    const thread = await store.createThread({ title: "Manage suggestion" });
    await store.archiveThread(thread.id, new Date());
    const message = await store.createMessage({
      threadId: thread.id,
      role: "system",
      content: "manage suggestion",
      citations: [],
      routing: null,
    });
    const created = await store.createProposal({
      messageId: message.id,
      threadId: thread.id,
      noteId,
      patch: { title: organize.title, body: organize.body },
    });
    proposal = toKaiProposal(created);
  }
  const classification = judged.suggestions.classification ?? null;
  return {
    ok: true,
    tags: judged.suggestions.tags,
    classification,
    proposal,
    organize,
  };
}
