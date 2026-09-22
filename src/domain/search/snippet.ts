import { E4_DEV_GATES } from "./dev-process-gates";
import { tokenize } from "./text";

/** Short window around the first query token. Null when the note has no text. */
export function buildSnippet(title: string, body: string, query: string): string | null {
  if (E4_DEV_GATES.snippet !== "match_window") {
    return null;
  }
  const hay = `${title}\n${body}`;
  const trimmedHay = hay.trim();
  if (!trimmedHay) {
    return null;
  }
  const lower = hay.toLowerCase();
  let at = -1;
  let matchedLength = 0;
  for (const token of tokenize(query)) {
    const found = lower.indexOf(token);
    if (found >= 0 && (at < 0 || found < at)) {
      at = found;
      matchedLength = token.length;
    }
  }
  if (at < 0) {
    const bodyText = body.trim().replace(/\s+/g, " ");
    if (!bodyText) {
      return null;
    }
    return bodyText.length > 160 ? `${bodyText.slice(0, 160)}…` : bodyText;
  }
  const start = Math.max(0, at - 40);
  const end = Math.min(hay.length, at + matchedLength + 80);
  let slice = hay.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) {
    slice = `…${slice}`;
  }
  if (end < hay.length) {
    slice = `${slice}…`;
  }
  return slice;
}
