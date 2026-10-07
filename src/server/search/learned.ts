import { z } from "zod";

// Weight hash, prompts, pooling, dimensionality and chunker revision define one space.
export const SEMANTIC_MODEL_ID = "eg2-2188ac1d-q8-mean-768-search-chunks-v3";
export const SEMANTIC_DIMENSIONS = 768;
const responseSchema = z.object({
  data: z.array(z.object({
    index: z.number().int().nonnegative(),
    embedding: z.array(z.number().finite()).length(SEMANTIC_DIMENSIONS),
  })),
});

export class EmbeddingUnavailable extends Error {
  constructor() {
    super("Local embeddings unavailable");
    this.name = "EmbeddingUnavailable";
  }
}

export function semanticConfigured(): boolean {
  return Boolean(process.env.EMBEDDING_BASE_URL?.trim());
}

/** Optional local boundary: no fabricated or legacy vector fallback. */
export async function learnedEmbeddings(inputs: readonly string[], timeoutMs = 15000): Promise<number[][]> {
  const base = process.env.EMBEDDING_BASE_URL?.trim();
  if (!base) throw new EmbeddingUnavailable();
  // Keep all local inference below the proven CPU/memory envelope, including queries.
  if (inputs.some((input) => Buffer.byteLength(input, "utf8") > 1024)) throw new EmbeddingUnavailable();
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: SEMANTIC_MODEL_ID, input: inputs }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new EmbeddingUnavailable();
    const parsed = responseSchema.parse(await response.json());
    if (parsed.data.length !== inputs.length) throw new EmbeddingUnavailable();
    const ordered = parsed.data.sort((a, b) => a.index - b.index);
    return ordered.map((row, index) => {
      const norm = Math.hypot(...row.embedding);
      if (row.index !== index || !Number.isFinite(norm) || norm < 0.99 || norm > 1.01) {
        throw new EmbeddingUnavailable();
      }
      return row.embedding.map((value) => value / norm);
    });
  } catch (error) {
    if (error instanceof EmbeddingUnavailable) throw error;
    // Network, timeout and malformed external responses all disable this optional lane.
    throw new EmbeddingUnavailable();
  }
}

export function queryInput(text: string): string {
  return `task: search result | query: ${text}`;
}

export function documentInput(title: string, heading: string, content: string): string {
  // Bound metadata as well as content; title/heading cannot exhaust model context.
  return `title: ${title.slice(0, 64)}${heading ? ` / ${heading.slice(0, 64)}` : ""} | text: ${content}`;
}
