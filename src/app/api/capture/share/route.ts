import { after } from "next/server";
import { ApiError, withApi } from "@/server/http";
import { captureInbox, enrichInboxItem } from "@/server/inbox";
import { localeFromRequest } from "@/lib/i18n/server";
import { inboxCopy } from "@/server/i18n/copy";

export const runtime = "nodejs";

function formString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
}

export const POST = withApi(async (request) => {
  const locale = localeFromRequest(request);
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded") && !contentType.startsWith("multipart/form-data")) {
    throw new ApiError("validation", inboxCopy.badShare);
  }
  const form = await request.formData();
  const item = await captureInbox({
    title: formString(form, "title")?.slice(0, 300),
    text: formString(form, "text")?.slice(0, 2_000_000),
    url: formString(form, "url")?.slice(0, 2_000),
    source: "share",
  }, locale);
  after(async () => { await enrichInboxItem(item.id, {}, locale); });
  return new Response(null, { status: 303, headers: { location: "/inbox" } });
});
