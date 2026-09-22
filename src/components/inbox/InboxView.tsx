"use client";

import type { InboxItem, IngestJobView, Proposal } from "@/lib/inbox/types";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { JEV_COPY } from "@/components/jev/copy";
import { DiscardConfirm } from "./DiscardConfirm";
import { EmptyState } from "./EmptyState";
import { InboxCard } from "./InboxCard";
import {
  cardState,
  primaryState,
  visibleJobs,
  type InboxModel,
  type ListErrorKind,
} from "./inbox-state";
import { IngestFailBadge } from "./IngestFailBadge";
import { INBOX_COPY } from "./copy";
import { formatInboxTime } from "./format-time";
import { PromoteSheet } from "./PromoteSheet";
import styles from "./InboxScreen.module.css";

export type InboxViewProps = {
  model: InboxModel;
  onCapture: () => void;
  onReload: () => void;
  onPromote: (item: InboxItem) => void;
  onAskDiscard: (id: string) => void;
  onToggleIngest: (id: string) => void;
  onRetryIngest: (id: string) => void;
  onConfirmIngest: (id: string) => void;
  onToggleTag: (tag: string) => void;
  onApprove: () => void;
  onLater: () => void;
  onRetryJev: () => void;
  onConfirmDiscard: () => void;
  onCancelDiscard: () => void;
};

function proposalItem(model: InboxModel): Proposal | null {
  return model.proposal;
}

function listMessage(kind: ListErrorKind | null): string {
  if (kind === "jev_error") return JEV_COPY.jevErrorRetry;
  if (kind === "key_missing") return JEV_COPY.keyMissing;
  return INBOX_COPY.loadFail;
}

function jevNotice(kind: "jev_error" | "key_missing"): string {
  if (kind === "key_missing") return JEV_COPY.keyMissing;
  return JEV_COPY.jevErrorRetry;
}

function IngestJobRow({
  job,
  open,
  notice,
  onToggle,
  onRetry,
  onConfirm,
}: {
  job: IngestJobView;
  open: boolean;
  notice: "jev_error" | "key_missing" | null;
  onToggle: () => void;
  onRetry: () => void;
  onConfirm: () => void;
}) {
  return (
    <article className={styles.job} data-job-state="ingest_failed">
      <h2 className={styles.jobTitle}>{job.title.trim() || INBOX_COPY.capture}</h2>
      {job.detail ? <p className={styles.jobDetail}>{job.detail}</p> : null}
      <div className={styles.jobMeta}>
        {job.createdAt ? (
          <time dateTime={job.createdAt}>{formatInboxTime(job.createdAt)}</time>
        ) : null}
        <IngestFailBadge open={open} onToggle={onToggle} onRetry={onRetry} onConfirm={onConfirm} />
      </div>
      {notice ? (
        <div aria-live="assertive">
          <ErrorBanner message={jevNotice(notice)} onRetry={onRetry} retryLabel={INBOX_COPY.retry} />
        </div>
      ) : null}
    </article>
  );
}

export function InboxView({
  model,
  onCapture,
  onReload,
  onPromote,
  onAskDiscard,
  onToggleIngest,
  onRetryIngest,
  onConfirmIngest,
  onToggleTag,
  onApprove,
  onLater,
  onRetryJev,
  onConfirmDiscard,
  onCancelDiscard,
}: InboxViewProps) {
  const state = primaryState(model);
  const showCount = model.loadStatus !== "loading";
  const proposal = proposalItem(model);
  const jobs = visibleJobs(model);
  const showEmpty =
    model.loadStatus !== "loading" && model.loadStatus !== "error" && model.items.length === 0;

  return (
    <div className={styles.page} data-inbox-state={state}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {INBOX_COPY.title}
          {showCount ? <span className={styles.count}>({model.items.length})</span> : null}
        </h1>
        <button type="button" className={styles.capture} onClick={onCapture}>
          {INBOX_COPY.capture}
        </button>
      </header>

      {model.loadStatus === "error" ? (
        <div aria-live="assertive">
          <ErrorBanner
            message={listMessage(model.listError)}
            onRetry={onReload}
            retryLabel={INBOX_COPY.retry}
          />
        </div>
      ) : null}

      {model.loadStatus === "loading" ? (
        <div className={styles.skeletonList} aria-busy="true">
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : null}

      {showEmpty ? <EmptyState onCapture={onCapture} /> : null}

      {jobs.length > 0 ? (
        <ul className={styles.jobs}>
          {jobs.map((job) => (
            <li key={job.id}>
              <IngestJobRow
                job={job}
                open={model.ingestOpenId === job.id}
                notice={model.ingestNotice?.jobId === job.id ? model.ingestNotice.kind : null}
                onToggle={() => onToggleIngest(job.id)}
                onRetry={() => onRetryIngest(job.id)}
                onConfirm={() => onConfirmIngest(job.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {model.items.length > 0 ? (
        <ul className={styles.list}>
          {model.items.map((item) => (
            <li key={item.id}>
              <InboxCard
                item={item}
                state={cardState(model, item)}
                onPromote={() => onPromote(item)}
                onDiscard={() => onAskDiscard(item.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {proposal ? (
        <PromoteSheet
          proposal={proposal}
          promoting={model.promotingId === proposal.itemId}
          promoteError={model.promoteError}
          onToggleTag={onToggleTag}
          onApprove={onApprove}
          onLater={onLater}
          onRetryJev={onRetryJev}
          onRetryPromote={onApprove}
        />
      ) : null}

      {model.discardId ? (
        <DiscardConfirm
          busy={model.discarding}
          error={model.discardError}
          onConfirm={onConfirmDiscard}
          onCancel={onCancelDiscard}
        />
      ) : null}
    </div>
  );
}
