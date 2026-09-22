import type { InboxSource } from "@/lib/inbox/types";
import { INBOX_COPY } from "./copy";

export function sourceLabel(source: InboxSource): string {
  switch (source) {
    case "web":
    case "url":
      return INBOX_COPY.sourceWeb;
    case "share":
      return INBOX_COPY.sourceShare;
    case "api":
      return INBOX_COPY.sourceApi;
    case "file":
      return INBOX_COPY.sourceFile;
  }
}
