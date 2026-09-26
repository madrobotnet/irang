import { sourceLabel } from "@/components/inbox/source-label";
import type { InboxSource } from "@/lib/inbox/types";
import type { HomeInboxRowView } from "./home-inbox-rows-ui";

export function homeSourcePill(source: InboxSource): string {
  switch (source) {
    case "share":
      return "클립";
    case "file":
      return "메모";
    case "web":
    case "url":
      return "웹";
    default:
      return sourceLabel(source);
  }
}

function detailText(row: HomeInboxRowView): string {
  const body = row.summary.trim();
  if (body) {
    if (body.length <= 48) return body;
    return `본문 ${body.length}자`;
  }
  if (row.url) {
    try {
      const host = new URL(row.url).hostname.replace(/^www\./, "");
      return host ? `${host} 링크` : row.url;
    } catch {
      return row.url;
    }
  }
  return "태그 없음 · 미분류";
}

export function inboxPreviewMetaDesktop(row: HomeInboxRowView): { pill: string; detail: string } {
  return { pill: homeSourcePill(row.source), detail: detailText(row) };
}

export function inboxPreviewMetaMobile(row: HomeInboxRowView, when: string): string {
  return `${homeSourcePill(row.source)} · ${when}`;
}
