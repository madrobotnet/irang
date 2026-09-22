import { E4_EVIDENCE_PATH } from "@/lib/auth/e4-gate-paths";
import type { EvidenceQueryDto, SearchQueryDto } from "./dto";
import {
  evidenceRequestBody,
  interpretEvidenceBody,
  interpretSearchBody,
  searchCollectionUrl,
  type ParsedEvidence,
  type ParsedSearch,
  type SearchRequestFilters,
} from "./parse";

export type EvidenceClientInput = EvidenceQueryDto & {
  filters?: SearchRequestFilters;
};

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** `GET /api/search?query=` — search-result envelope only. No second endpoint. */
export async function searchNotes(
  query: SearchQueryDto["query"],
  filters?: SearchRequestFilters,
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedSearch> {
  try {
    const res = await fetchImpl(searchCollectionUrl(query, filters), { credentials: "include" });
    return interpretSearchBody(res.status, await readBody(res));
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** `POST /api/search/evidence` — evidence-note envelope. Not a rank. */
export async function judgeEvidence(
  input: EvidenceClientInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedEvidence> {
  try {
    const res = await fetchImpl(E4_EVIDENCE_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: evidenceRequestBody(input, input.filters),
    });
    return interpretEvidenceBody(res.status, await readBody(res));
  } catch {
    return { ok: false, reason: "error" };
  }
}
