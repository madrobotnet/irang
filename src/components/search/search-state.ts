import { JEV_LOW_CONFIDENCE_THRESHOLD, type JevUiState } from "@/lib/jev/jev-state";
import type { EvidenceNotesOk, SearchResultsOk } from "@/lib/search/dto";
import type { SearchCallFailure, SearchRequestFilters, SearchUiFailure } from "@/lib/search/parse";

export type SearchSurface =
  | "idle"
  | "loading"
  | "results"
  | "empty"
  | "indexing"
  | "jev_error"
  | "key_missing"
  | "error";

/** Soft filters. Sent as the status/from/to params Rex already reads. */
export type SearchFilters = SearchRequestFilters;

export type RouteTarget = "chat" | "search" | "inbox";

export type EvidenceUi =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; envelope: EvidenceNotesOk }
  | { status: "jev_error" }
  | { status: "key_missing" }
  | { status: "error" };

export type SearchModel = {
  draft: string;
  submittedQuery: string;
  filters: SearchFilters;
  filtersOpen: boolean;
  surface: SearchSurface;
  envelope: SearchResultsOk | null;
  /** Set only when a routing judgment is already present. Search envelopes do not invent one. */
  route: RouteTarget | null;
  selected: string[];
  evidence: EvidenceUi;
};

export const initialFilters: SearchFilters = { status: "", from: "", to: "" };

const idleEvidence: EvidenceUi = { status: "idle" };

export const initialSearchModel: SearchModel = {
  draft: "",
  submittedQuery: "",
  filters: initialFilters,
  filtersOpen: false,
  surface: "idle",
  envelope: null,
  route: null,
  selected: [],
  evidence: idleEvidence,
};

export type SearchEvent =
  | { type: "draft"; value: string }
  | { type: "toggle_filters" }
  | { type: "filters"; filters: SearchFilters }
  | { type: "close_filters" }
  | { type: "begin"; query: string }
  | { type: "succeed"; envelope: SearchResultsOk }
  | { type: "fail"; reason: SearchCallFailure }
  | { type: "toggle_evidence"; id: string }
  | { type: "evidence_clear" }
  | { type: "evidence_loading" }
  | { type: "evidence_ok"; envelope: EvidenceNotesOk }
  | { type: "evidence_fail"; reason: SearchUiFailure }
  | { type: "clear" };

function toggleId(selected: readonly string[], id: string): string[] {
  if (!id) return [...selected];
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
}

export function searchReducer(model: SearchModel, event: SearchEvent): SearchModel {
  switch (event.type) {
    case "draft":
      return { ...model, draft: event.value };
    case "toggle_filters":
      return { ...model, filtersOpen: !model.filtersOpen };
    case "filters":
      return { ...model, filters: event.filters };
    case "close_filters":
      return { ...model, filtersOpen: false };
    case "begin":
      return {
        ...model,
        draft: event.query,
        submittedQuery: event.query,
        filtersOpen: false,
        surface: "loading",
        envelope: null,
        route: null,
        selected: [],
        evidence: idleEvidence,
      };
    case "succeed":
      return {
        ...model,
        surface: event.envelope.results.length === 0 ? "empty" : "results",
        envelope: event.envelope,
        route: null,
        selected: [],
        evidence: idleEvidence,
      };
    case "fail":
      return {
        ...model,
        surface: event.reason,
        envelope: null,
        route: null,
        selected: [],
        evidence: idleEvidence,
      };
    case "toggle_evidence":
      if (model.surface !== "results") return model;
      return { ...model, selected: toggleId(model.selected, event.id) };
    case "evidence_clear":
      if (model.evidence.status === "idle") return model;
      return { ...model, evidence: idleEvidence };
    case "evidence_loading":
      if (model.surface !== "results") return model;
      return { ...model, evidence: { status: "loading" } };
    case "evidence_ok":
      if (model.surface !== "results") return model;
      return { ...model, evidence: { status: "ready", envelope: event.envelope } };
    case "evidence_fail":
      if (model.surface !== "results") return model;
      return { ...model, evidence: { status: event.reason } };
    case "clear":
      return {
        ...initialSearchModel,
        draft: model.draft,
        filters: model.filters,
      };
    default:
      return model;
  }
}

export function showsJevOn(surface: SearchSurface, evidence: EvidenceUi["status"]): boolean {
  if (evidence === "jev_error" || evidence === "key_missing") return false;
  return (
    surface === "idle" || surface === "loading" || surface === "results" || surface === "empty"
  );
}

export function searchBadgeState(
  surface: SearchSurface,
  confidence: number | null,
  evidence: EvidenceUi["status"],
): JevUiState {
  if (surface === "jev_error" || evidence === "jev_error") return "jev_error";
  if (surface === "key_missing" || evidence === "key_missing") return "key_missing";
  if (!showsJevOn(surface, evidence)) return "jev_idle";
  if (
    surface === "results" &&
    confidence !== null &&
    confidence < JEV_LOW_CONFIDENCE_THRESHOLD
  ) {
    return "jev_low_confidence";
  }
  return "jev_ready";
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return Boolean(filters.status || filters.from || filters.to);
}

export function evidenceChatReady(model: SearchModel): boolean {
  return model.surface === "results" && model.selected.length >= 1 && model.evidence.status === "ready";
}
