import {
  E4_DEV_GATES,
  OVERNIGHT_INDEX_LIMIT,
  SEARCH_SHORTLIST,
} from "@/domain/search/dev-process-gates";
import { embedText } from "@/domain/search/embed";
import { reciprocalRankFusion } from "@/domain/search/fusion";
import { buildSnippet } from "@/domain/search/snippet";
import { selectEvidenceNotes } from "@/domain/search/select";
import type { SearchFilters, SearchSourceDoc } from "@/domain/search/types";
import type { EvidenceNotesOk, SearchResultsOk } from "@/lib/search/dto";
import { runOvernightIndexBatch } from "./batch";
import { loadActiveNotes } from "./corpus";
import { judgeEvidence, judgeSearch, orderSearchResults } from "./judgments";
import type { ScoredDoc } from "./ports";
import { getSearchIndex } from "./runtime";
import { getNotesStore } from "../notes/runtime";

export type EvidenceNoteJson = EvidenceNotesOk["notes"][number] & {
  similarity: EvidenceNotesOk["notes"][number]["relevance"];
};

async function retrieve(query: string, filters: SearchFilters): Promise<SearchSourceDoc[]> {
  if (E4_DEV_GATES.corpus !== "notes_only" || E4_DEV_GATES.fusion !== "rrf") {
    throw new Error("unsupported search gate");
  }
  const index = await getSearchIndex();
  const keyword = await index.keyword(query, filters, 30);
  const semantic = await index.semantic(embedText(query), filters, 30);
  const byId = new Map<string, ScoredDoc>();
  for (const doc of [...keyword, ...semantic]) {
    byId.set(doc.id, doc);
  }
  const fused = reciprocalRankFusion(
    keyword.map((doc) => doc.id),
    semantic.map((doc) => doc.id),
  ).slice(0, SEARCH_SHORTLIST);
  const docs: SearchSourceDoc[] = [];
  for (const row of fused) {
    const doc = byId.get(row.id);
    if (doc) {
      docs.push(doc);
    }
  }
  return docs;
}

export async function executeSearch(
  query: string,
  filters: SearchFilters,
): Promise<SearchResultsOk> {
  await runOvernightIndexBatch(OVERNIGHT_INDEX_LIMIT);
  const candidates = await retrieve(query, filters);
  const judgment = await judgeSearch(query, candidates);
  const ordered = orderSearchResults(candidates, judgment.ranking);
  return {
    ok: true,
    query,
    answersQuery: judgment.answersQuery,
    ranking: judgment.ranking,
    results: ordered.map((doc) => ({
      noteId: doc.id,
      title: doc.title,
      snippet: buildSnippet(doc.title, doc.body, query),
    })),
  };
}

export async function executeEvidence(
  query: string,
  candidateNoteIds: readonly string[],
  filters: SearchFilters,
): Promise<{ query: string; notes: EvidenceNoteJson[] }> {
  let ids = [...candidateNoteIds];
  if (ids.length === 0) {
    await runOvernightIndexBatch(OVERNIGHT_INDEX_LIMIT);
    ids = (await retrieve(query, filters)).map((doc) => doc.id);
  }
  const notes = await loadNotesInOrder(ids);
  const judged = await judgeEvidence(
    query,
    notes.map((note) => ({ id: note.id, title: note.title, body: note.body })),
  );
  const selected = selectEvidenceNotes(judged);
  return {
    query,
    notes: selected.map((note) => ({
      noteId: note.noteId,
      title: note.title,
      answers: note.answers,
      relevance: note.relevance,
      similarity: note.similarity,
    })),
  };
}

async function loadNotesInOrder(ids: readonly string[]): Promise<SearchSourceDoc[]> {
  const store = await getNotesStore();
  const active = await loadActiveNotes(store);
  const byId = new Map(active.map((doc) => [doc.id, doc]));
  const notes: SearchSourceDoc[] = [];
  for (const id of ids) {
    const doc = byId.get(id);
    if (!doc) {
      throw new EvidenceCandidatesInvalidError();
    }
    notes.push(doc);
  }
  return notes;
}

export class EvidenceCandidatesInvalidError extends Error {
  readonly code = "validation" as const;
  constructor() {
    super("candidate note ids are not active notes");
    this.name = "EvidenceCandidatesInvalidError";
  }
}
