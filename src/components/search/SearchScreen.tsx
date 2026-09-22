"use client";

import { useEffect, useReducer, useRef } from "react";
import { judgeEvidence, searchNotes } from "@/lib/search/client";
import type { EvidenceQueryDto } from "@/lib/search/dto";
import { SearchView } from "./SearchView";
import { initialSearchModel, searchReducer, type SearchFilters } from "./search-state";

export function SearchScreen() {
  const [model, dispatch] = useReducer(searchReducer, initialSearchModel);
  const searchReq = useRef(0);
  const evidenceReq = useRef(0);
  const selectedKey = model.selected.join("\n");

  const run = (query: string, filters: SearchFilters) => {
    const q = query.trim();
    if (!q) {
      evidenceReq.current += 1;
      dispatch({ type: "clear" });
      return;
    }
    const token = ++searchReq.current;
    evidenceReq.current += 1;
    dispatch({ type: "begin", query: q });
    void searchNotes(q, filters).then((result) => {
      if (token !== searchReq.current) return;
      if (!result.ok) {
        dispatch({ type: "fail", reason: result.reason });
        return;
      }
      dispatch({ type: "succeed", envelope: result.envelope });
    });
  };

  const requestEvidence = (input: EvidenceQueryDto, filters: SearchFilters) => {
    const token = ++evidenceReq.current;
    dispatch({ type: "evidence_loading" });
    void judgeEvidence({ ...input, filters }).then((result) => {
      if (token !== evidenceReq.current) return;
      if (!result.ok) {
        dispatch({ type: "evidence_fail", reason: result.reason });
        return;
      }
      dispatch({ type: "evidence_ok", envelope: result.envelope });
    });
  };

  useEffect(() => {
    if (model.surface !== "results" || model.selected.length === 0 || !model.submittedQuery) {
      evidenceReq.current += 1;
      dispatch({ type: "evidence_clear" });
      return;
    }
    requestEvidence(
      {
        query: model.submittedQuery,
        candidateNoteIds: [...model.selected],
      },
      model.filters,
    );
  }, [model.surface, model.submittedQuery, selectedKey, model.filters]);

  return (
    <SearchView
      model={model}
      onDraft={(value) => dispatch({ type: "draft", value })}
      onSubmit={() => run(model.draft, model.filters)}
      onToggleFilters={() => dispatch({ type: "toggle_filters" })}
      onFilters={(filters) => dispatch({ type: "filters", filters })}
      onApplyFilters={() => run(model.draft.trim() || model.submittedQuery, model.filters)}
      onToggleEvidence={(id) => dispatch({ type: "toggle_evidence", id })}
      onRetry={() => {
        if (model.submittedQuery) run(model.submittedQuery, model.filters);
      }}
      onRetryEvidence={() => {
        if (model.surface !== "results" || model.selected.length === 0) return;
        requestEvidence(
          {
            query: model.submittedQuery,
            candidateNoteIds: [...model.selected],
          },
          model.filters,
        );
      }}
    />
  );
}
