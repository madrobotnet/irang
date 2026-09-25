import { isBlockedCaptureUrl } from "./url-blocked-host";

const FAIL_HOST = "ingest-fail.test";

export const CAPTURE_FETCH_TIMEOUT_MS = 10_000;
export const CAPTURE_PAGE_BYTE_LIMIT = 262_144;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type UrlSummaryResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

function isHttpProtocol(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch (error) {
    if (error instanceof TypeError) {
      return false;
    }
    throw error;
  }
}

async function readCappedBody(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return "";
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  let stoppedEarly = false;
  while (total < limit) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    const value = next.value;
    if (value === undefined) {
      continue;
    }
    const remaining = limit - total;
    const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
    const piece = new Uint8Array(slice.byteLength);
    piece.set(slice);
    chunks.push(piece);
    total += slice.byteLength;
    stoppedEarly = value.byteLength > remaining;
    if (stoppedEarly) {
      break;
    }
  }
  if (stoppedEarly) {
    try {
      await reader.cancel();
    } catch {
      // The capped prefix is already buffered.
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function summarizeUrl(url: string): Promise<UrlSummaryResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: "invalid_url" };
    }
    throw error;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "unsupported_protocol" };
  }
  if (isBlockedCaptureUrl(parsed.href)) {
    return { ok: false, error: "blocked_host" };
  }
  if (parsed.hostname === FAIL_HOST) {
    return { ok: false, error: "summary_unavailable" };
  }
  if (process.env.URL_SUMMARY_FORCE_FAIL === "1") {
    return { ok: false, error: "forced_fail" };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(CAPTURE_FETCH_TIMEOUT_MS),
      headers: { accept: "text/html,text/plain,*/*" },
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      return { ok: false, error: "timeout" };
    }
    if (error instanceof TypeError || error instanceof DOMException) {
      return { ok: false, error: "fetch_failed" };
    }
    throw error;
  }
  if (!response.ok) {
    return { ok: false, error: `http_${response.status}` };
  }
  if (response.url !== "" && !isHttpProtocol(response.url)) {
    return { ok: false, error: "unsupported_protocol" };
  }
  if (response.url !== "" && isBlockedCaptureUrl(response.url)) {
    return { ok: false, error: "blocked_host" };
  }

  let raw: string;
  try {
    raw = await readCappedBody(response, CAPTURE_PAGE_BYTE_LIMIT);
  } catch (error) {
    if (isTimeoutError(error)) {
      return { ok: false, error: "timeout" };
    }
    if (error instanceof TypeError || error instanceof DOMException) {
      return { ok: false, error: "fetch_failed" };
    }
    throw error;
  }
  const contentType = response.headers.get("content-type") ?? "";
  const text = contentType.includes("html") ? stripHtml(raw) : raw.trim();
  const summary = text.slice(0, 2000);
  if (!summary) {
    return { ok: false, error: "empty_summary" };
  }
  return { ok: true, summary };
}
