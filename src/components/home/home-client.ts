import { E6_HOME_SUMMARY_PATH } from "@/lib/auth/e6-gate-paths";
import { homeErrorBody, type HomePageModel } from "@/lib/home/dto";
import { INBOX_API } from "@/lib/inbox/api-contract";
import { parseInboxListBody } from "@/lib/inbox/parse";
import { pageModelFromBody, previewRows, type InboxPreviewRow } from "./home-model";

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function loadHomeSummary(fetchImpl: typeof fetch = fetch): Promise<HomePageModel> {
  try {
    const res = await fetchImpl(E6_HOME_SUMMARY_PATH, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const body = await readJson(res);
    if (res.status === 401) {
      const model = pageModelFromBody(body);
      if (model.state === "error" && model.error.code === "unauthorized") return model;
      return { state: "error", error: homeErrorBody("unauthorized") };
    }
    if (!res.ok) {
      const model = pageModelFromBody(body);
      if (model.state === "error") return model;
      return { state: "error", error: homeErrorBody("summary_failed") };
    }
    return pageModelFromBody(body);
  } catch {
    return { state: "error", error: homeErrorBody("summary_failed") };
  }
}

export async function loadInboxPreview(fetchImpl: typeof fetch = fetch): Promise<InboxPreviewRow[]> {
  try {
    const res = await fetchImpl(`${INBOX_API.list}?limit=3`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const items = parseInboxListBody(await readJson(res));
    if (!items) return [];
    return previewRows(items);
  } catch {
    return [];
  }
}
