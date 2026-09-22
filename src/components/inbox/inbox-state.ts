import type { InboxItem, IngestJobView, JevFailure, Proposal } from "@/lib/inbox/types";

export type InboxLoadStatus = "loading" | "ready" | "empty" | "error";

export type InboxScreenState =
  | "loading"
  | "ready"
  | "empty"
  | "promoting"
  | "propose_pending"
  | "error"
  | "ingest_failed";

export type CardState = "ready" | "promoting" | "propose_pending";

export type ListErrorKind = "load" | "jev_error" | "key_missing";

export type IngestNotice = {
  jobId: string;
  kind: JevFailure;
};

export type InboxModel = {
  loadStatus: InboxLoadStatus;
  listError: ListErrorKind | null;
  items: InboxItem[];
  jobs: IngestJobView[];
  promotingId: string | null;
  proposal: Proposal | null;
  discardId: string | null;
  discarding: boolean;
  promoteError: boolean;
  discardError: boolean;
  ingestOpenId: string | null;
  ingestNotice: IngestNotice | null;
  acknowledgedIngestIds: string[];
};

export const initialInboxModel: InboxModel = {
  loadStatus: "loading",
  listError: null,
  items: [],
  jobs: [],
  promotingId: null,
  proposal: null,
  discardId: null,
  discarding: false,
  promoteError: false,
  discardError: false,
  ingestOpenId: null,
  ingestNotice: null,
  acknowledgedIngestIds: [],
};

export type InboxEvent =
  | { type: "reload" }
  | { type: "load_ok"; items: InboxItem[]; jobs?: IngestJobView[] }
  | { type: "sync_items"; items: InboxItem[]; jobs?: IngestJobView[] }
  | { type: "load_err"; reason?: ListErrorKind }
  | { type: "open_proposal"; proposal: Proposal }
  | { type: "close_proposal" }
  | { type: "toggle_tag"; tag: string }
  | { type: "approve" }
  | { type: "promote_ok"; id: string }
  | { type: "promote_err" }
  | { type: "promote_jev"; reason: JevFailure }
  | { type: "ask_discard"; id: string }
  | { type: "cancel_discard" }
  | { type: "discard_start" }
  | { type: "discard_ok"; id: string }
  | { type: "discard_err" }
  | { type: "toggle_ingest"; id: string }
  | { type: "confirm_ingest"; id: string }
  | { type: "ingest_notice"; jobId: string; kind: JevFailure }
  | { type: "clear_promote_error" };

function withoutItem(items: InboxItem[], id: string): InboxItem[] {
  return items.filter((item) => item.id !== id);
}

function statusAfter(items: InboxItem[], jobs: IngestJobView[]): InboxLoadStatus {
  return items.length === 0 && jobs.length === 0 ? "empty" : "ready";
}

export function visibleJobs(model: InboxModel): IngestJobView[] {
  return model.jobs.filter((job) => !model.acknowledgedIngestIds.includes(job.id));
}

export function inboxReducer(model: InboxModel, event: InboxEvent): InboxModel {
  switch (event.type) {
    case "reload":
      return {
        ...initialInboxModel,
        loadStatus: "loading",
        acknowledgedIngestIds: model.acknowledgedIngestIds,
      };
    case "load_ok": {
      const jobs = event.jobs ?? [];
      return {
        ...model,
        loadStatus: statusAfter(event.items, jobs),
        listError: null,
        items: event.items,
        jobs,
        promotingId: null,
        proposal: null,
        discardId: null,
        discarding: false,
        ingestNotice: null,
      };
    }
    case "sync_items": {
      if (model.promotingId || model.discarding || model.loadStatus === "loading") return model;
      const items = event.items;
      const jobs = event.jobs ?? model.jobs;
      const kept = (id: string | null | undefined) => !id || items.some((item) => item.id === id);
      const notice =
        model.ingestNotice && jobs.some((job) => job.id === model.ingestNotice?.jobId)
          ? model.ingestNotice
          : null;
      const ingestOpenId =
        model.ingestOpenId && jobs.some((job) => job.id === model.ingestOpenId)
          ? model.ingestOpenId
          : null;
      return {
        ...model,
        items,
        jobs,
        loadStatus: statusAfter(items, jobs),
        proposal: kept(model.proposal?.itemId) ? model.proposal : null,
        discardId: kept(model.discardId) ? model.discardId : null,
        ingestNotice: notice,
        ingestOpenId,
      };
    }
    case "load_err":
      return {
        ...model,
        loadStatus: "error",
        listError: event.reason ?? "load",
        items: [],
        jobs: [],
        promotingId: null,
        proposal: null,
        discardId: null,
        discarding: false,
        ingestNotice: null,
      };
    case "open_proposal":
      if (model.promotingId) return model;
      return {
        ...model,
        proposal: event.proposal,
        promoteError: false,
      };
    case "close_proposal":
      if (model.promotingId) return model;
      return { ...model, proposal: null, promoteError: false };
    case "toggle_tag": {
      if (!model.proposal || model.proposal.mode !== "suggest" || model.promotingId) {
        return model;
      }
      const has = model.proposal.selectedTags.includes(event.tag);
      const selectedTags = has
        ? model.proposal.selectedTags.filter((tag) => tag !== event.tag)
        : [...model.proposal.selectedTags, event.tag];
      return { ...model, proposal: { ...model.proposal, selectedTags } };
    }
    case "approve":
      if (!model.proposal || model.promotingId) return model;
      if (!model.proposal.title.trim()) return model;
      return {
        ...model,
        promotingId: model.proposal.itemId,
        promoteError: false,
      };
    case "promote_ok": {
      const items = withoutItem(model.items, event.id);
      return {
        ...model,
        items,
        loadStatus: statusAfter(items, model.jobs),
        promotingId: null,
        proposal: null,
        promoteError: false,
      };
    }
    case "promote_err":
      return { ...model, promotingId: null, promoteError: true };
    case "promote_jev":
      if (!model.proposal) {
        return { ...model, promotingId: null, promoteError: false };
      }
      return {
        ...model,
        promotingId: null,
        promoteError: false,
        proposal: {
          ...model.proposal,
          mode: "manual",
          tags: [],
          selectedTags: [],
          confidence: null,
          jevError: event.reason,
        },
      };
    case "ask_discard":
      if (model.promotingId === event.id) return model;
      return { ...model, discardId: event.id, discarding: false, discardError: false };
    case "cancel_discard":
      if (model.discarding) return model;
      return { ...model, discardId: null, discardError: false };
    case "discard_start":
      if (!model.discardId) return model;
      return { ...model, discarding: true, discardError: false };
    case "discard_ok": {
      const items = withoutItem(model.items, event.id);
      const proposal = model.proposal?.itemId === event.id ? null : model.proposal;
      return {
        ...model,
        items,
        loadStatus: statusAfter(items, model.jobs),
        proposal,
        discardId: null,
        discarding: false,
        discardError: false,
        promotingId: model.promotingId === event.id ? null : model.promotingId,
      };
    }
    case "discard_err":
      return { ...model, discarding: false, discardError: true };
    case "toggle_ingest":
      return {
        ...model,
        ingestOpenId: model.ingestOpenId === event.id ? null : event.id,
      };
    case "confirm_ingest":
      return {
        ...model,
        ingestOpenId: null,
        ingestNotice: model.ingestNotice?.jobId === event.id ? null : model.ingestNotice,
        acknowledgedIngestIds: model.acknowledgedIngestIds.includes(event.id)
          ? model.acknowledgedIngestIds
          : [...model.acknowledgedIngestIds, event.id],
      };
    case "ingest_notice":
      return {
        ...model,
        ingestOpenId: event.jobId,
        ingestNotice: { jobId: event.jobId, kind: event.kind },
      };
    case "clear_promote_error":
      return { ...model, promoteError: false };
    default:
      return model;
  }
}

export function cardState(model: InboxModel, item: InboxItem): CardState {
  if (model.promotingId === item.id) return "promoting";
  if (model.proposal?.itemId === item.id) return "propose_pending";
  return "ready";
}

export function primaryState(model: InboxModel): InboxScreenState {
  if (model.loadStatus === "loading") return "loading";
  if (model.loadStatus === "error") return "error";
  if (model.promotingId) return "promoting";
  if (model.promoteError || model.discardError) return "error";
  if (model.proposal) return "propose_pending";
  if (model.items.length === 0 && visibleJobs(model).length > 0) return "ingest_failed";
  if (model.items.length === 0) return "empty";
  return "ready";
}
