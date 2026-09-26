import { showsKeywordIndexBanner } from "@/domain/search/index-status";
import { JEV_LOW_CONFIDENCE_THRESHOLD } from "@/lib/jev/jev-state";
import { projectRows } from "@/lib/search/project";
import { JEV_COPY } from "@/components/jev/copy";
import { JevBadge } from "@/components/jev/JevBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { SEARCH_COPY } from "./copy";
import { EvidencePicker } from "./EvidencePicker";
import { FilterSheet } from "./FilterSheet";
import { RouteHint } from "./RouteHint";
import { DeskCommandBar } from "@/components/desk/DeskCommandBar";
import { SynthPanel } from "@/components/desk/SynthPanel";
import splitStyles from "@/components/desk/DeskSplitLayout.module.css";
import {
  evidenceChatReady,
  hasActiveFilters,
  searchBadgeState,
  showsJevOn,
  type SearchModel,
} from "./search-state";
import type { SearchFilters } from "./search-state";
import styles from "./SearchScreen.module.css";

export type SearchViewProps = {
  model: SearchModel;
  onDraft: (value: string) => void;
  onSubmit: () => void;
  onToggleFilters: () => void;
  onFilters: (filters: SearchFilters) => void;
  onApplyFilters: () => void;
  onToggleEvidence: (id: string) => void;
  onRetry: () => void;
  onRetryEvidence: () => void;
};

export function SearchView({
  model,
  onDraft,
  onSubmit,
  onToggleFilters,
  onFilters,
  onApplyFilters,
  onToggleEvidence,
  onRetry,
  onRetryEvidence,
}: SearchViewProps) {
  const showOn = showsJevOn(model.surface, model.evidence.status);
  const confidence = model.envelope?.ranking.confidence ?? null;
  const badge = searchBadgeState(model.surface, confidence, model.evidence.status);
  const evidenceEnvelope = model.evidence.status === "ready" ? model.evidence.envelope : null;
  const rows =
    model.surface === "results" && model.envelope
      ? projectRows(model.envelope, evidenceEnvelope)
      : [];
  const lowRank = confidence !== null && confidence < JEV_LOW_CONFIDENCE_THRESHOLD;
  const showRoute = model.route !== null && (model.surface === "results" || model.surface === "empty");
  const showIndexBanner =
    (model.surface === "results" || model.surface === "empty") &&
    showsKeywordIndexBanner(model.envelope?.indexStatus);

  return (
    <div
      className={splitStyles.host}
      data-search-state={model.surface}
      data-evidence-state={model.evidence.status}
      data-index-status={model.envelope?.indexStatus}
      data-desk-search-layout
    >
      <h1 className={styles.title}>{SEARCH_COPY.title}</h1>
      <DeskCommandBar
        value={model.draft}
        placeholder={SEARCH_COPY.placeholder}
        onChange={onDraft}
        onSubmit={onSubmit}
        kbdHint={model.draft ? "esc" : "cmd-k"}
        filled={model.draft.length > 0}
      />
      <div className={styles.bar}>
        <button
          type="button"
          className={hasActiveFilters(model.filters) ? styles.filterActive : styles.filter}
          aria-expanded={model.filtersOpen}
          aria-controls="search-filters"
          onClick={onToggleFilters}
        >
          {SEARCH_COPY.filter}
        </button>
        <div className={styles.jev} data-jev-on={showOn ? "true" : "false"}>
          <JevBadge state={badge} />
          {showOn ? <span className={styles.onWord}>· {SEARCH_COPY.on}</span> : null}
        </div>
      </div>
      {model.filtersOpen ? (
        <FilterSheet filters={model.filters} onChange={onFilters} onApply={onApplyFilters} />
      ) : null}

      <div className={splitStyles.grid}>
        <div className={splitStyles.primary}>
      {model.surface === "idle" ? <p className={styles.hint}>{SEARCH_COPY.idleHint}</p> : null}

      {model.surface === "loading" ? (
        <div className={styles.skeletons} aria-busy="true" aria-live="polite">
          <SkeletonBlock lines={3} />
          <SkeletonBlock lines={3} />
          <SkeletonBlock lines={2} />
        </div>
      ) : null}

      {model.surface === "jev_error" ? (
        <div aria-live="assertive">
          <ErrorBanner message={JEV_COPY.jevErrorRetry} onRetry={onRetry} retryLabel={SEARCH_COPY.retry} />
        </div>
      ) : null}
      {model.surface === "key_missing" ? (
        <div aria-live="assertive">
          <ErrorBanner message={JEV_COPY.keyMissing} />
        </div>
      ) : null}
      {model.surface === "error" ? (
        <div aria-live="assertive">
          <ErrorBanner message={SEARCH_COPY.searchFail} onRetry={onRetry} retryLabel={SEARCH_COPY.retry} />
        </div>
      ) : null}
      {model.surface === "indexing" ? (
        <div aria-live="assertive">
          <ErrorBanner message={SEARCH_COPY.indexing} onRetry={onRetry} retryLabel={SEARCH_COPY.retry} />
        </div>
      ) : null}

      {showIndexBanner ? (
        <p className={styles.indexBanner} role="status">
          {SEARCH_COPY.indexing}
        </p>
      ) : null}

      {model.surface === "results" && model.evidence.status === "jev_error" ? (
        <div aria-live="assertive">
          <ErrorBanner
            message={JEV_COPY.jevErrorRetry}
            onRetry={onRetryEvidence}
            retryLabel={SEARCH_COPY.retry}
          />
        </div>
      ) : null}
      {model.surface === "results" && model.evidence.status === "key_missing" ? (
        <div aria-live="assertive">
          <ErrorBanner message={JEV_COPY.keyMissing} />
        </div>
      ) : null}
      {model.surface === "results" && model.evidence.status === "error" ? (
        <div aria-live="assertive">
          <ErrorBanner
            message={SEARCH_COPY.searchFail}
            onRetry={onRetryEvidence}
            retryLabel={SEARCH_COPY.retry}
          />
        </div>
      ) : null}

      {showRoute && model.route ? <RouteHint target={model.route} /> : null}

      {model.surface === "results" && lowRank ? (
        <p className={styles.low}>{JEV_COPY.lowConfidence}</p>
      ) : null}

      {model.surface === "empty" ? <EmptyState message={SEARCH_COPY.empty} /> : null}

      {rows.length > 0 ? (
        <EvidencePicker
          rows={rows}
          selected={model.selected}
          chatReady={evidenceChatReady(model)}
          onToggle={onToggleEvidence}
        />
      ) : null}
        </div>
        <div className={splitStyles.aside}>
          <SynthPanel
            title="합성"
            placeholder={
              model.surface === "results" ? "결과 기준으로 묻기…" : "이어서 질문하기…"
            }
          />
        </div>
      </div>
    </div>
  );
}
