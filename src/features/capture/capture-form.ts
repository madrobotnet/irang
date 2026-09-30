/** Pure capture-form logic: what the dialog sends to POST /api/capture. */

export type CaptureDraft = { text: string; url: string; title: string };

export const EMPTY_DRAFT: CaptureDraft = { text: "", url: "", title: "" };

export type CapturePayload = { text?: string; url?: string; title?: string };

/** Why a draft cannot be sent; a locale-neutral key the dialog renders through CAPTURE_COPY. */
export type CaptureInvalidReason = "empty" | "badUrl";

export type CaptureBuildResult = { ok: true; payload: CapturePayload } | { ok: false; field: "text" | "url"; reason: CaptureInvalidReason };

const TEXT_LIMIT = 2_000_000;
const URL_LIMIT = 2_000;
const TITLE_LIMIT = 300;

/** True when the whole string is one absolute http(s) URL with no whitespace. */
export function isHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Turns the draft into the wire body. A text field holding nothing but a URL is
 * sent as `url` so the server fetches the page instead of storing the address as prose.
 */
export function buildCapturePayload(draft: CaptureDraft): CaptureBuildResult {
  const text = draft.text.trim().slice(0, TEXT_LIMIT);
  const url = draft.url.trim().slice(0, URL_LIMIT);
  const title = draft.title.trim().slice(0, TITLE_LIMIT);

  if (url && !isHttpUrl(url)) return { ok: false, field: "url", reason: "badUrl" };

  if (!text && !url) return { ok: false, field: "text", reason: "empty" };

  const payload: CapturePayload = {};
  if (!url && isHttpUrl(text)) {
    payload.url = text;
  } else {
    if (text) payload.text = text;
    if (url) payload.url = url;
  }
  if (title) payload.title = title;
  return { ok: true, payload };
}

export function isDraftEmpty(draft: CaptureDraft): boolean {
  return !draft.text.trim() && !draft.url.trim() && !draft.title.trim();
}
