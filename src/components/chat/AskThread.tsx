"use client";

import type { TouchEvent } from "react";
import { useRef } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CHAT_COPY } from "./copy";
import type { ChatMessageView } from "./parse";
import { splitCitationMarks } from "./parse";
import styles from "./ChatScreen.module.css";

type AskThreadProps = {
  messages: ChatMessageView[];
  partial: string;
  streaming: boolean;
  showEmpty: boolean;
  showHint: boolean;
  proposalMessageId: string | null;
  showProposalAction: boolean;
  onCite: (messageId: string, index: number) => void;
  onPromote: (messageId: string) => void;
  onOpenProposal: () => void;
  onSwipeCitations: () => void;
};

function MessageBody({
  body,
  onCite,
}: {
  body: string;
  onCite: (index: number) => void;
}) {
  const parts = splitCitationMarks(body);
  return (
    <p className={styles.body}>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          <button
            key={index}
            type="button"
            className={styles.citeMark}
            data-cite={part.n}
            onClick={() => onCite(part.n)}
          >
            [{part.n}]
          </button>
        ),
      )}
    </p>
  );
}

export function AskThread({
  messages,
  partial,
  streaming,
  showEmpty,
  showHint,
  proposalMessageId,
  showProposalAction,
  onCite,
  onPromote,
  onOpenProposal,
  onSwipeCitations,
}: AskThreadProps) {
  const touchX = useRef<number | null>(null);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchX.current;
    const end = event.changedTouches[0]?.clientX;
    touchX.current = null;
    if (start == null || end == null) return;
    if (start - end > 48) onSwipeCitations();
  };

  return (
    <div className={styles.thread} data-ask-thread="true" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {showEmpty ? <EmptyState message={CHAT_COPY.empty} /> : null}
      {showEmpty && showHint ? <p className={styles.hint}>{CHAT_COPY.emptyHint}</p> : null}
      {messages.map((message) => (
        <article
          key={message.id}
          className={message.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}
          data-message-role={message.role}
        >
          <MessageBody body={message.body} onCite={(index) => onCite(message.id, index)} />
          {message.role === "assistant" ? (
            <div className={styles.actions}>
              <button type="button" className={styles.quiet} data-promote="new-note" onClick={() => onPromote(message.id)}>
                {CHAT_COPY.promote}
              </button>
              {showProposalAction && proposalMessageId === message.id ? (
                <button type="button" className={styles.quiet} data-open-proposal="true" onClick={onOpenProposal}>
                  {CHAT_COPY.approve}
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
      {streaming ? (
        <article className={styles.bubbleAssistant} data-streaming="true" aria-live="polite">
          <p className={styles.body}>
            {partial}
            <span className={styles.caret} aria-hidden="true">
              ▍
            </span>
          </p>
        </article>
      ) : null}
    </div>
  );
}
