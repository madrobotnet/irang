const FAIL_HOST = "ingest-fail.test";

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

export async function summarizeUrl(url: string): Promise<UrlSummaryResult> {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === FAIL_HOST) {
      return { ok: false, error: "summary_unavailable" };
    }
  } catch {
    return { ok: false, error: "invalid_url" };
  }

  if (process.env.URL_SUMMARY_FORCE_FAIL === "1") {
    return { ok: false, error: "forced_fail" };
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { accept: "text/html,text/plain,*/*" },
    });
    if (!response.ok) {
      return { ok: false, error: `http_${response.status}` };
    }
    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();
    const text = contentType.includes("html") ? stripHtml(raw) : raw.trim();
    const summary = text.slice(0, 2000);
    if (!summary) {
      return { ok: false, error: "empty_summary" };
    }
    return { ok: true, summary };
  } catch {
    return { ok: false, error: "fetch_failed" };
  }
}
