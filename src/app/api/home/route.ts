import { getHomeData } from "@/server/home";
import { ApiError, json, withApi } from "@/server/http";
import { z } from "zod";
import { homeCopy } from "@/server/i18n/copy";

export const runtime = "nodejs";

const Query = z.object({ timeZone: z.string().max(100).optional() }).strict();

export const GET = withApi(async (request) => {
  const { timeZone } = Query.parse(Object.fromEntries(new URL(request.url).searchParams));
  if (timeZone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
    } catch {
      throw new ApiError("validation", homeCopy.badTimeZone);
    }
  }
  return json(await getHomeData({ timeZone }));
});
