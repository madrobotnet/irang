import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EvidenceNotesOk, SearchResultsOk } from "@/lib/search/dto";
import { JEV_COPY } from "@/components/jev/copy";
import { SEARCH_COPY } from "./copy";
import { initialSearchModel, type SearchModel } from "./search-state";
import { SearchView, type SearchViewProps } from "./SearchView";

const envelope: SearchResultsOk = {
  ok: true,
  query: "소유",
  answersQuery: { type: "noul", noul: 0.93 },
  ranking: {
    type: "choice",
    choice: "note-1",
    probabilities: { "note-1": 0.91, "note-2": 0.09 },
    confidence: 0.82,
  },
  results: [
    { noteId: "note-1", title: "소유권", snippet: "내 노트입니다" },
    { noteId: "note-2", title: "라이선스", snippet: null },
  ],
};

const evidence: EvidenceNotesOk = {
  ok: true,
  query: "소유",
  notes: [
    {
      noteId: "note-1",
      title: "소유권",
      answers: { type: "noul", noul: 0.88 },
      relevance: {
        type: "score",
        score: 2.1,
        legend: { "2": "States an answer" },
        probabilities: { "2": 0.85 },
        confidence: 0.78,
      },
      similarity: {
        type: "score",
        score: 2.4,
        legend: { "2": "비슷한 의미" },
        probabilities: { "2": 0.6 },
        confidence: 0.66,
      },
    },
  ],
};

function noop() {}

function view(model: SearchModel, patch: Partial<SearchViewProps> = {}) {
  const props: SearchViewProps = {
    model,
    onDraft: noop,
    onSubmit: noop,
    onToggleFilters: noop,
    onFilters: noop,
    onApplyFilters: noop,
    onToggleEvidence: noop,
    onRetry: noop,
    onRetryEvidence: noop,
    ...patch,
  };
  return renderToStaticMarkup(<SearchView {...props} />);
}

describe("SearchView", () => {
  it("renders idle search chrome with Jev ON", () => {
    const html = view(initialSearchModel);
    expect(html).toContain('data-search-state="idle"');
    expect(html).toContain('data-jev-on="true"');
    expect(html).toContain(SEARCH_COPY.placeholder);
    expect(html).toContain(SEARCH_COPY.idleHint);
    expect(html).toContain("Jev");
    expect(html).toContain("ON");
    expect(html).not.toContain(SEARCH_COPY.evidenceCta);
  });

  it("renders a loading skeleton", () => {
    const html = view({ ...initialSearchModel, surface: "loading", submittedQuery: "소유" });
    expect(html).toContain('data-search-state="loading"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(SEARCH_COPY.evidenceCta);
  });

  it("renders title, path, snippet, meter, and similar chips", () => {
    const html = view({
      ...initialSearchModel,
      surface: "results",
      submittedQuery: "소유",
      draft: "소유",
      envelope,
    });
    expect(html).toContain("소유권");
    expect(html).toContain("notes/note-1");
    expect(html).toContain("내 노트입니다");
    expect(html).toContain("91%");
    expect(html).toContain("고");
    expect(html).toContain(SEARCH_COPY.similar);
    expect(html).toContain("라이선스");
    expect(html).toContain('data-evidence-cta="disabled"');
    expect(html).toContain(SEARCH_COPY.evidenceCta);
    expect(html).not.toContain('href="/chat');
  });

  it("enables the evidence chat link only when evidence is ready", () => {
    const html = view({
      ...initialSearchModel,
      surface: "results",
      submittedQuery: "소유",
      envelope,
      selected: ["note-1"],
      evidence: { status: "ready", envelope: evidence },
    });
    expect(html).toContain('data-evidence-cta="ready"');
    expect(html).toContain('href="/chat?evidence=note-1"');
    expect(html).toContain("78%");
    expect(html).toContain("66%");
    expect(html).toContain("비슷한 의미");
    expect(html).toContain(SEARCH_COPY.similar);
    expect(html).toContain(SEARCH_COPY.relevance);
  });

  it("shows the empty copy", () => {
    const html = view({
      ...initialSearchModel,
      surface: "empty",
      submittedQuery: "없음",
      envelope: { ...envelope, results: [] },
    });
    expect(html).toContain(SEARCH_COPY.empty);
    expect(html).not.toContain(SEARCH_COPY.evidenceCta);
  });

  it("shows the indexing banner and no keyword rows", () => {
    const html = view({
      ...initialSearchModel,
      surface: "indexing",
      envelope,
    });
    expect(html).toContain(SEARCH_COPY.indexing);
    expect(html).toContain('data-jev-on="false"');
    expect(html).not.toContain("소유권");
    expect(html).not.toContain("내 노트입니다");
  });

  it("forces the TypeSafe error and hides keyword rows", () => {
    const html = view({
      ...initialSearchModel,
      surface: "jev_error",
      submittedQuery: "소유",
      envelope,
    });
    expect(html).toContain(JEV_COPY.jevErrorRetry);
    expect(html).not.toContain("소유권");
    expect(html).not.toContain(SEARCH_COPY.evidenceCta);
  });

  it("shows the missing-key banner without a retry or key form", () => {
    const html = view({
      ...initialSearchModel,
      surface: "key_missing",
      submittedQuery: "소유",
    });
    expect(html).toContain(JEV_COPY.keyMissing);
    expect(html).not.toContain(SEARCH_COPY.retry);
    expect(html).not.toContain("TYPESAFE_API_KEY");
    expect(html).not.toContain("type=\"password\"");
  });

  it("shows a search failure banner", () => {
    const html = view({ ...initialSearchModel, surface: "error", submittedQuery: "소유" });
    expect(html).toContain(SEARCH_COPY.searchFail);
    expect(html).toContain(SEARCH_COPY.retry);
  });

  it("shows an evidence failure without turning ranking into a chat link", () => {
    const html = view({
      ...initialSearchModel,
      surface: "results",
      submittedQuery: "소유",
      envelope,
      selected: ["note-1"],
      evidence: { status: "jev_error" },
    });
    expect(html).toContain("소유권");
    expect(html).toContain(JEV_COPY.jevErrorRetry);
    expect(html).toContain('data-evidence-cta="disabled"');
    expect(html).not.toContain('href="/chat');
  });

  it("renders RouteHint only when a routing judgment is present", () => {
    const hidden = view({
      ...initialSearchModel,
      surface: "results",
      envelope,
    });
    expect(hidden).not.toContain("이 요청 →");
    const shown = view({
      ...initialSearchModel,
      surface: "results",
      envelope,
      route: "chat",
    });
    expect(shown).toContain('data-route-hint="chat"');
    expect(shown).toContain("이 요청 → 채팅");
  });

  it("warns when ranking confidence is low", () => {
    const html = view({
      ...initialSearchModel,
      surface: "results",
      envelope: {
        ...envelope,
        ranking: { ...envelope.ranking, confidence: 0.42 },
      },
    });
    expect(html).toContain(JEV_COPY.lowConfidence);
  });

  it("opens the soft filter sheet", () => {
    const html = view({ ...initialSearchModel, filtersOpen: true });
    expect(html).toContain(SEARCH_COPY.filterType);
    expect(html).toContain(SEARCH_COPY.filterDraft);
    expect(html).toContain(SEARCH_COPY.filterApply);
  });
});
