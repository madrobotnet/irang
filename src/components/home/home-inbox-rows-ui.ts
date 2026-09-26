import { INBOX_API } from "@/lib/inbox/api-contract";
import { parseInboxListBody } from "@/lib/inbox/parse";
import type { InboxItem, InboxSource } from "@/lib/inbox/types";
import { INBOX_PREVIEW_LIMIT } from "./home-model";

export type HomeInboxRowView = {
  id: string;
  title: string;
  summary: string;
  source: InboxSource;
  createdAt: string;
  url: string | null;
};

function toRowView(item: InboxItem): HomeInboxRowView {
  return {
    id: item.id,
    title: item.title.trim() || "캡처",
    summary: item.body.trim(),
    source: item.source,
    createdAt: item.createdAt,
    url: item.url,
  };
}

/** UI lane: inbox list fetch for home hero rows (does not change home summary client). */
export async function loadHomeInboxRowViews(
  fetchImpl: typeof fetch = fetch,
): Promise<HomeInboxRowView[]> {
  try {
    const res = await fetchImpl(`${INBOX_API.list}?limit=${INBOX_PREVIEW_LIMIT}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }
    const items = parseInboxListBody(body);
    if (!items) return [];
    return items.slice(0, INBOX_PREVIEW_LIMIT).map(toRowView);
  } catch {
    return [];
  }
}
