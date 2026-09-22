import type { ChatContextLimitDto } from "@/lib/chat/dto";

export class ContextLimitFailure extends Error {
  readonly code = "context_limit" as const;
  constructor(readonly contextLimit: ChatContextLimitDto) {
    super("context limit");
    this.name = "ContextLimitFailure";
  }
}

export class CodexFailedError extends Error {
  readonly code = "codex_failed" as const;
  constructor(message = "Codex generation failed") {
    super(message);
    this.name = "CodexFailedError";
  }
}

export class ChatNotFoundError extends Error {
  readonly code = "not_found" as const;
  constructor() {
    super("not found");
    this.name = "ChatNotFoundError";
  }
}

export class ChatValidationError extends Error {
  readonly code = "validation" as const;
  constructor() {
    super("validation");
    this.name = "ChatValidationError";
  }
}

export class StreamingUnsupportedError extends Error {
  readonly code = "streaming_unsupported" as const;
  constructor() {
    super("streaming is not supported");
    this.name = "StreamingUnsupportedError";
  }
}

export class ProposalNotPendingError extends Error {
  readonly code = "proposal_not_pending" as const;
  constructor() {
    super("proposal is not pending");
    this.name = "ProposalNotPendingError";
  }
}
