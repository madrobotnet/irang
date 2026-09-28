import { after } from "next/server";
import { ApiError, withApi } from "@/server/http";
import { captureInbox, enrichInboxItem } from "@/server/inbox";

export const runtime = "nodejs";

function formString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
}

export const POST = withApi(async (request) => {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded") && !contentType.startsWith("multipart/form-data")) {
    throw new ApiError("validation", "공유 형식이 올바르지 않습니다.");
  }
  const form = await request.formData();
  const item = await captureInbox({
    title: formString(form, "title")?.slice(0, 300),
    text: formString(form, "text")?.slice(0, 2_000_000),
    url: formString(form, "url")?.slice(0, 2_000),
    source: "share",
  });
  after(async () => { await enrichInboxItem(item.id); });
  return new Response(null, { status: 303, headers: { location: "/inbox" } });
});
