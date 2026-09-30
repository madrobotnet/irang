import { api, ApiClientError } from "@/lib/api-client";
import { linkFirstMention, type MentionTarget } from "@/lib/link-mention";
import type { ApiErrorBody, Note } from "@/lib/types";

export type MentionConflict = NonNullable<ApiErrorBody["error"]["conflict"]>;

export function mentionConflict(error: unknown): MentionConflict | null {
  if (!(error instanceof ApiClientError) || error.status !== 409) return null;
  const conflict: unknown = error.body?.error?.conflict;
  return conflict === "stale" || conflict === "mention_gone" ? conflict : null;
}

export type LinkMentionOutcome = { kind: "linked"; note: Note } | { kind: "gone" } | { kind: "stale" };
type Request = <T>(path: string, init?: RequestInit & { json?: unknown }) => Promise<T>;

/** Edits note `sourceId` so its first mention of `targetId` becomes a link; a stale read is retried once. */
export async function linkUnlinkedMention(targetId: string, sourceId: string, request: Request = api): Promise<LinkMentionOutcome> {
  for (let attempt = 1; ; attempt++) {
    const { note: source } = await request<{ note: Note }>(`/api/notes/${sourceId}`);
    try {
      const { note } = await request<{ note: Note }>(`/api/notes/${targetId}/mentions/${sourceId}/link`, {
        method: "POST",
        json: { expectedUpdatedAt: source.updatedAt },
      });
      return { kind: "linked", note };
    } catch (error) {
      const conflict = mentionConflict(error);
      if (conflict === "mention_gone") return { kind: "gone" };
      if (conflict === "stale") {
        if (attempt < 2) continue;
        return { kind: "stale" };
      }
      throw error;
    }
  }
}

export type MentionExcerpt = { before: string; match: string; after: string };

/** Splits the context around the text the server would link, trimming the lead to keep it in a two-line clamp. */
export function mentionExcerpt(context: string, target: MentionTarget, lead = 32): MentionExcerpt | null {
  const linked = linkFirstMention(context, target);
  if (linked === null) return null;
  // Names never contain [ or ], so the first and last differences bound the wrapped text exactly.
  let start = 0;
  while (context[start] === linked[start]) start++;
  let tail = 0;
  while (tail < context.length - start && context[context.length - 1 - tail] === linked[linked.length - 1 - tail]) tail++;
  const end = context.length - tail;
  let before = context.slice(0, start);
  if (before.length > lead) {
    const cut = before.indexOf(" ", before.length - lead);
    before = `…${cut >= 0 ? before.slice(cut + 1) : before.slice(-lead)}`;
  }
  return { before, match: context.slice(start, end), after: context.slice(end) };
}
