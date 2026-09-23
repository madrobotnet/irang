import type { ChatMessageRecord, ChatProposalRecord, ChatThreadRecord, StoredCitation } from "@/domain/chat/types";
import { CitationsRequiredError } from "@/domain/chat/errors";
import type {
  AssistantChatMessageDto,
  ChatThreadDto,
  CitationNoteLinkDto,
  NoteEditProposalDto,
  UserChatMessageDto,
} from "@/lib/chat/dto";

export type WireThread = ChatThreadDto & { archivedAt: string | null };

export type WireUserMessage = UserChatMessageDto & {
  content: string;
  citations: StoredCitation[];
};

export type WireAssistantMessage = AssistantChatMessageDto & {
  content: string;
  citations: StoredCitation[];
  routing: ChatMessageRecord["routing"];
};

export type WireSystemMessage = {
  id: string;
  threadId: string;
  role: "system";
  body: string;
  content: string;
  createdAt: string;
  citations: [];
};

export type WireMessage = WireUserMessage | WireAssistantMessage | WireSystemMessage;

export type WireContractProposal = {
  id: string;
  messageId: string;
  threadId: string;
  noteId: string;
  patch: ChatProposalRecord["patch"];
  status: ChatProposalRecord["status"];
  createdAt: string;
  resolvedAt: string | null;
};

function citationSources(citations: StoredCitation[]): [CitationNoteLinkDto, ...CitationNoteLinkDto[]] {
  const sources = citations.map((citation) => ({ noteId: citation.noteId, title: citation.title }));
  const first = sources[0];
  if (!first) {
    throw new CitationsRequiredError();
  }
  return [first, ...sources.slice(1)];
}

export function toThreadWire(thread: ChatThreadRecord): WireThread {
  return {
    id: thread.id,
    title: thread.title ?? "",
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    archivedAt: thread.archivedAt,
  };
}

export function toMessageWire(message: ChatMessageRecord): WireMessage {
  if (message.role === "assistant") {
    return {
      id: message.id,
      threadId: message.threadId,
      role: "assistant",
      body: message.content,
      content: message.content,
      createdAt: message.createdAt,
      sources: citationSources(message.citations),
      citations: message.citations,
      routing: message.routing,
    };
  }
  if (message.role === "system") {
    return {
      id: message.id,
      threadId: message.threadId,
      role: "system",
      body: message.content,
      content: message.content,
      createdAt: message.createdAt,
      citations: [],
    };
  }
  return {
    id: message.id,
    threadId: message.threadId,
    role: "user",
    body: message.content,
    content: message.content,
    createdAt: message.createdAt,
    citations: [],
  };
}

export function toKaiProposal(proposal: ChatProposalRecord): NoteEditProposalDto {
  return {
    proposalId: proposal.id,
    threadId: proposal.threadId,
    messageId: proposal.messageId,
    noteId: proposal.noteId,
    proposedTitle: proposal.patch.title ?? "",
    proposedBody: proposal.patch.body ?? "",
    status: "pending_approval",
  };
}

export function toContractProposal(proposal: ChatProposalRecord): WireContractProposal {
  return {
    id: proposal.id,
    messageId: proposal.messageId,
    threadId: proposal.threadId,
    noteId: proposal.noteId,
    patch: proposal.patch,
    status: proposal.status,
    createdAt: proposal.createdAt,
    resolvedAt: proposal.resolvedAt,
  };
}
