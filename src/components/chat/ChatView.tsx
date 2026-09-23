"use client";

import { JEV_COPY } from "@/components/jev/copy";
import { AiApproveModal } from "@/components/ui/AiApproveModal";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { AskScopeBar } from "./AskScopeBar";
import { AskThread } from "./AskThread";
import { citationMessage, type ChatModel } from "./chat-state";
import { CitationPanel } from "./CitationPanel";
import { Composer } from "./Composer";
import { CHAT_COPY } from "./copy";
import { contextLimitVisible } from "./parse";
import { RouteHint } from "./RouteHint";
import type { ChatScope } from "./scope";
import { notePath } from "./scope";
import styles from "./ChatScreen.module.css";

export type ChatViewProps = {
  model: ChatModel;
  onScope: (scope: ChatScope) => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  onRetry: () => void;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onCite: (messageId: string, index: number) => void;
  onPromote: (messageId: string) => void;
  onOpenProposal: () => void;
  onSwipeCitations: () => void;
  onToggleTag: (tag: string) => void;
  onApprove: () => void;
  onCancelApproval: () => void;
};

export function ChatView({
  model,
  onScope,
  onDraft,
  onSend,
  onRetry,
  onSelectThread,
  onNewThread,
  onCite,
  onPromote,
  onOpenProposal,
  onSwipeCitations,
  onToggleTag,
  onApprove,
  onCancelApproval,
}: ChatViewProps) {
  const streaming = model.surface === "streaming";
  const showEmpty =
    model.messages.length === 0 && !streaming && (model.surface === "idle" || model.surface === "done");
  const cited = citationMessage(model);
  const limit = contextLimitVisible(model.surface, model.contextLimit);

  return (
    <div className={styles.page} data-chat-state={model.surface} data-jev-state={model.jev}>
      <h1 className={styles.title}>{CHAT_COPY.title}</h1>
      <AskScopeBar
        scope={model.scope}
        evidenceCount={model.evidenceIds.length}
        jev={model.jev}
        onScope={onScope}
      />
      {model.routeLabel ? <RouteHint label={model.routeLabel} /> : null}
      {model.threads.length > 0 || !model.threadsReady ? (
        <div className={styles.threads} role="list" aria-label={CHAT_COPY.threadsLabel}>
          <button type="button" className={styles.quiet} onClick={onNewThread}>
            {CHAT_COPY.newThread}
          </button>
          {!model.threadsReady ? <SkeletonBlock lines={1} /> : null}
          {model.threads.map((thread) => {
            const on = thread.id === model.activeThreadId;
            return (
              <button
                key={thread.id}
                type="button"
                role="listitem"
                className={on ? styles.threadBtnOn : styles.threadBtn}
                aria-current={on ? "true" : undefined}
                onClick={() => onSelectThread(thread.id)}
              >
                {thread.title || CHAT_COPY.newThread}
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.threads}>
          <button type="button" className={styles.quiet} onClick={onNewThread}>
            {CHAT_COPY.newThread}
          </button>
        </div>
      )}

      {model.surface === "context_limit" ? (
        <div aria-live="polite">
          <ErrorBanner message={CHAT_COPY.contextLimit} />
        </div>
      ) : limit ? (
        <p className={styles.hint} role="status">
          {CHAT_COPY.contextLimit}
        </p>
      ) : null}
      {model.surface === "jev_error" ? (
        <div aria-live="assertive">
          <ErrorBanner message={CHAT_COPY.jevErrorRetry} onRetry={onRetry} retryLabel={CHAT_COPY.retry} />
        </div>
      ) : null}
      {model.surface === "key_missing" ? (
        <div aria-live="assertive">
          <ErrorBanner message={JEV_COPY.keyMissing} />
        </div>
      ) : null}
      {model.surface === "error" ? (
        <div aria-live="assertive">
          <ErrorBanner message={CHAT_COPY.answerFail} onRetry={onRetry} retryLabel={CHAT_COPY.retry} />
        </div>
      ) : null}
      {model.surface === "jev_low_confidence" ? (
        <p className={styles.low} role="status">
          {CHAT_COPY.lowConfidence}
        </p>
      ) : null}

      <div className={styles.stage}>
        {model.surface === "loading" ? (
          <div aria-busy="true">
            <SkeletonBlock lines={4} />
          </div>
        ) : (
          <AskThread
            messages={model.messages}
            partial={model.partial}
            streaming={streaming}
            showEmpty={showEmpty}
            showHint={model.evidenceIds.length === 0}
            proposalMessageId={model.proposal?.messageId ?? null}
            showProposalAction={model.proposal !== null && model.surface !== "approving"}
            onCite={onCite}
            onPromote={onPromote}
            onOpenProposal={onOpenProposal}
            onSwipeCitations={onSwipeCitations}
          />
        )}
        <CitationPanel message={cited} activeIndex={model.activeCitation} />
      </div>

      <Composer value={model.draft} busy={streaming || model.approvalPending} onChange={onDraft} onSend={onSend} />

      {model.surface === "approving" && model.proposal ? (
        <AiApproveModal
          noteLabel={notePath(model.proposal.noteId)}
          proposedTitle={model.proposal.proposedTitle}
          proposedBody={model.proposal.proposedBody}
          tags={model.proposal.tags}
          selectedTags={model.selectedTags}
          pending={model.approvalPending}
          error={model.approvalError ? CHAT_COPY.approveFail : null}
          onToggleTag={onToggleTag}
          onApprove={onApprove}
          onCancel={onCancelApproval}
        />
      ) : null}
    </div>
  );
}
