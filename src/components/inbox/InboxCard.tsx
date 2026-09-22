"use client";

import { useRef, useState } from "react";
import type { InboxItem } from "@/lib/inbox/types";
import { formatInboxTime } from "./format-time";
import type { CardState } from "./inbox-state";
import { INBOX_COPY } from "./copy";
import { sourceLabel } from "./source-label";
import { swipeIntent } from "./swipe";
import styles from "./InboxCard.module.css";

type InboxCardProps = {
  item: InboxItem;
  state: CardState;
  onPromote: () => void;
  onDiscard: () => void;
};

type DragPoint = { x: number; y: number };

export function InboxCard({ item, state, onPromote, onDiscard }: InboxCardProps) {
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const origin = useRef<DragPoint | null>(null);
  const busy = state === "promoting";
  const summary = item.body.trim();

  const endDrag = (clientX: number, clientY: number) => {
    const start = origin.current;
    origin.current = null;
    setDragging(false);
    setDrag(0);
    if (!start || busy) return;
    const intent = swipeIntent(clientX - start.x, clientY - start.y);
    if (intent === "promote") onPromote();
    if (intent === "discard") onDiscard();
  };

  return (
    <div className={styles.swipeHost}>
      {drag !== 0 ? (
        <div
          className={drag > 0 ? `${styles.hint} ${styles.hintPromote}` : `${styles.hint} ${styles.hintDiscard}`}
          aria-hidden="true"
        >
          {drag > 0 ? INBOX_COPY.promote : INBOX_COPY.discard}
        </div>
      ) : null}
      <article
        className={dragging ? `${styles.card} ${styles.cardDragging}` : styles.card}
        data-card-state={state}
        aria-busy={busy || undefined}
        style={{ transform: drag === 0 ? undefined : `translate3d(${drag}px, 0, 0)` }}
        onPointerDown={(event) => {
          if (busy || event.button !== 0) return;
          const target = event.target as HTMLElement;
          if (target.closest("button")) return;
          origin.current = { x: event.clientX, y: event.clientY };
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!origin.current) return;
          setDrag(event.clientX - origin.current.x);
        }}
        onPointerUp={(event) => endDrag(event.clientX, event.clientY)}
        onPointerCancel={() => {
          origin.current = null;
          setDragging(false);
          setDrag(0);
        }}
      >
        <h2 className={styles.title}>{item.title.trim() || INBOX_COPY.capture}</h2>
        {summary ? <p className={styles.summary}>{summary}</p> : null}
        <div className={styles.meta}>
          <span className={styles.source}>{sourceLabel(item.source)}</span>
          {item.createdAt ? (
            <time dateTime={item.createdAt}>{formatInboxTime(item.createdAt)}</time>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={onPromote}
            disabled={busy}
          >
            {INBOX_COPY.promote}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={onDiscard}
            disabled={busy}
          >
            {INBOX_COPY.discard}
          </button>
        </div>
      </article>
    </div>
  );
}
