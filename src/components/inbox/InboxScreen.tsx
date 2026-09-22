"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useCapture } from "@/components/capture/CaptureContext";
import {
  discardInbox,
  listInbox,
  listIngestFailures,
  promoteInbox,
  retryIngest,
  suggestInbox,
} from "@/lib/inbox/client-api";
import { proposalAfterSuggest } from "@/lib/inbox/draft";
import type { InboxItem } from "@/lib/inbox/types";
import { InboxView } from "./InboxView";
import { inboxReducer, initialInboxModel } from "./inbox-state";

export function InboxScreen() {
  const { openCapture } = useCapture();
  const [model, dispatch] = useReducer(inboxReducer, initialInboxModel);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const token = ++requestId.current;
    dispatch({ type: "reload" });
    const [itemsResult, jobsResult] = await Promise.all([listInbox(), listIngestFailures()]);
    if (token !== requestId.current) return;
    if (!itemsResult.ok) {
      const reason =
        itemsResult.reason === "jev_error" || itemsResult.reason === "key_missing"
          ? itemsResult.reason
          : "load";
      dispatch({ type: "load_err", reason });
      return;
    }
    dispatch({
      type: "load_ok",
      items: itemsResult.items,
      jobs: jobsResult.ok ? jobsResult.jobs : [],
    });
  }, []);

  useEffect(() => {
    const token = ++requestId.current;
    void (async () => {
      const [itemsResult, jobsResult] = await Promise.all([listInbox(), listIngestFailures()]);
      if (token !== requestId.current) return;
      if (!itemsResult.ok) {
        const reason =
          itemsResult.reason === "jev_error" || itemsResult.reason === "key_missing"
            ? itemsResult.reason
            : "load";
        dispatch({ type: "load_err", reason });
        return;
      }
      dispatch({
        type: "load_ok",
        items: itemsResult.items,
        jobs: jobsResult.ok ? jobsResult.jobs : [],
      });
    })();
  }, []);

  const sync = useCallback(async () => {
    const [itemsResult, jobsResult] = await Promise.all([listInbox(), listIngestFailures()]);
    if (!itemsResult.ok) return;
    dispatch({
      type: "sync_items",
      items: itemsResult.items,
      jobs: jobsResult.ok ? jobsResult.jobs : undefined,
    });
  }, []);

  useEffect(() => {
    let sawSheet = false;
    const watch = () => {
      const open = document.getElementById("capture-sheet-title") !== null;
      if (sawSheet && !open) void sync();
      sawSheet = open;
    };
    const observer = new MutationObserver(watch);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [sync]);

  const suggestLock = useRef(false);
  const onPromote = useCallback(async (item: InboxItem) => {
    if (suggestLock.current) return;
    suggestLock.current = true;
    try {
      const result = await suggestInbox(item.id);
      if (!result.ok && result.reason === "unauthorized") {
        dispatch({ type: "load_err", reason: "load" });
        return;
      }
      const proposal = proposalAfterSuggest(item, result);
      if (!proposal) {
        void sync();
        return;
      }
      dispatch({ type: "open_proposal", proposal });
    } finally {
      suggestLock.current = false;
    }
  }, [sync]);

  const onRetryJev = useCallback(async () => {
    const current = model.proposal;
    if (!current) return;
    const item = model.items.find((row) => row.id === current.itemId);
    if (!item) return;
    await onPromote(item);
  }, [model.items, model.proposal, onPromote]);

  const promoteLock = useRef(false);
  const onApprove = useCallback(async () => {
    const proposal = model.proposal;
    if (promoteLock.current || !proposal || model.promotingId || !proposal.title.trim()) return;
    promoteLock.current = true;
    dispatch({ type: "approve" });
    try {
      const result = await promoteInbox(proposal.itemId);
      if (result.ok) {
        dispatch({ type: "promote_ok", id: proposal.itemId });
        return;
      }
      if (result.reason === "jev_error" || result.reason === "key_missing") {
        dispatch({ type: "promote_jev", reason: result.reason });
        return;
      }
      dispatch({ type: "promote_err" });
    } finally {
      promoteLock.current = false;
    }
  }, [model.promotingId, model.proposal]);

  const onConfirmDiscard = useCallback(async () => {
    const id = model.discardId;
    if (!id || model.discarding) return;
    dispatch({ type: "discard_start" });
    const result = await discardInbox(id);
    if (result.ok) {
      dispatch({ type: "discard_ok", id });
      return;
    }
    dispatch({ type: "discard_err" });
  }, [model.discardId, model.discarding]);

  const onRetryIngest = useCallback(
    async (id: string) => {
      const result = await retryIngest(id);
      if (result.ok || result.reason === "not_failed") {
        await sync();
        return;
      }
      if (result.reason === "jev_error" || result.reason === "key_missing") {
        dispatch({ type: "ingest_notice", jobId: id, kind: result.reason });
      }
    },
    [sync],
  );

  return (
    <InboxView
      model={model}
      onCapture={() => openCapture("inbox")}
      onReload={() => {
        void load();
      }}
      onPromote={(item) => {
        void onPromote(item);
      }}
      onAskDiscard={(id) => dispatch({ type: "ask_discard", id })}
      onToggleIngest={(id) => dispatch({ type: "toggle_ingest", id })}
      onRetryIngest={(id) => {
        void onRetryIngest(id);
      }}
      onConfirmIngest={(id) => dispatch({ type: "confirm_ingest", id })}
      onToggleTag={(tag) => dispatch({ type: "toggle_tag", tag })}
      onApprove={() => {
        void onApprove();
      }}
      onLater={() => dispatch({ type: "close_proposal" })}
      onRetryJev={() => {
        void onRetryJev();
      }}
      onConfirmDiscard={() => {
        void onConfirmDiscard();
      }}
      onCancelDiscard={() => dispatch({ type: "cancel_discard" })}
    />
  );
}
